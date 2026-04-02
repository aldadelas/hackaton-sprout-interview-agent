import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
} from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { RoomServiceClient } from 'livekit-server-sdk';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { Agent, DEFAULT_AGENT_INSTRUCTIONS } from './agent';
import { resolveAgentInstructions } from './instruction-api';
import {
  hasEndConversationIntent,
  shouldEndConversationWithLlm,
  shouldRunEndIntentLlm,
} from './end-conversation';
import { createTranscriptStore, sendTranscriptToExternalApi } from './transcript';
import {
  getAecWarmupMs,
  getSileroVadLoadOptions,
  getTurnHandlingOptions,
} from './voice-turn-settings';

// Load environment variables from a local file.
// Make sure to set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET
// when running locally or self-hosting your agent server.
dotenv.config({ path: '.env.local' });

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load(getSileroVadLoadOptions());
  },
  entry: async (ctx: JobContext) => {
    const transcriptStore = createTranscriptStore();
    const transcriptApiUrl = process.env.TRANSCRIPT_API_URL;
    const transcriptApiToken = process.env.TRANSCRIPT_API_TOKEN;
    const endIntentClassifier = new inference.LLM({
      model: 'openai/gpt-4.1-mini',
    });
    const roomServiceClient = new RoomServiceClient(
      process.env.LIVEKIT_URL ?? '',
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );
    let transcriptSent = false;
    let endingConversation = false;

    const instructionApiUrl =
      process.env.AGENT_INSTRUCTION_API_URL ??
      'https://69ce0cad33a09f831b7cd3ec.mockapi.io/kuantum/session/:sessionId';
    const instructionApiToken = process.env.AGENT_INSTRUCTION_API_TOKEN;
    const instructionResult = await resolveAgentInstructions({
      urlTemplate: instructionApiUrl,
      ...(instructionApiToken ? { token: instructionApiToken } : {}),
      defaultInstructions: DEFAULT_AGENT_INSTRUCTIONS,
      ...(ctx.job.room?.metadata ? { roomMetadata: ctx.job.room.metadata } : {}),
      signal: new AbortController().signal,
    });

    const agentInstructions = instructionResult.instructions;

    await ctx.connect();

    // Set up a voice AI pipeline using OpenAI, Cartesia, Deepgram, and the LiveKit turn detector
    const session = new voice.AgentSession({
      aecWarmupDuration: getAecWarmupMs(),
      turnHandling: getTurnHandlingOptions(),
      // Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
      // See all available models at https://docs.livekit.io/agents/models/stt/
      stt: new inference.STT({
        model: 'deepgram/nova-3',
        language: 'id',
      }),

      // A Large Language Model (LLM) is your agent's brain, processing user input and generating a response
      // See all providers at https://docs.livekit.io/agents/models/llm/
      llm: new inference.LLM({
        model: 'openai/gpt-4.1-mini',
      }),

      // Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
      // See all available models as well as voice selections at https://docs.livekit.io/agents/models/tts/
      tts: new inference.TTS({
        model: 'cartesia/sonic-3',
        voice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
      }),

      // VAD and turn detection are used to determine when the user is speaking and when the agent should respond
      // See more at https://docs.livekit.io/agents/build/turns
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad! as silero.VAD,
      voiceOptions: {
        // Allow the LLM to generate a response while waiting for the end of turn
        preemptiveGeneration: true,
      },
    });

    // To use a realtime model instead of a voice pipeline, use the following session setup instead.
    // (Note: This is for the OpenAI Realtime API. For other providers, see https://docs.livekit.io/agents/models/realtime/))
    // 1. Install '@livekit/agents-plugin-openai'
    // 2. Set OPENAI_API_KEY in .env.local
    // 3. Add import `import * as openai from '@livekit/agents-plugin-openai'` to the top of this file
    // 4. Use the following session setup instead of the version above
    // const session = new voice.AgentSession({
    //   llm: new openai.realtime.RealtimeModel({ voice: 'marin' }),
    // });

    // Start the session, which initializes the voice pipeline and warms up the models
    await session.start({
      agent: new Agent({ instructions: agentInstructions }),
      room: ctx.room,
      inputOptions: {
        // LiveKit Cloud enhanced noise cancellation
        // - If self-hosting, omit this parameter
        // - For telephony applications, use `BackgroundVoiceCancellationTelephony` for best results
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
      transcriptStore.addFromConversationItem(event.item);
    });

    const kickRemoteParticipants = async () => {
      try {
        const roomName = ctx.room.name ?? '';
        if (!roomName) {
          return;
        }

        const participants = await roomServiceClient.listParticipants(roomName);
        const localAgentIdentity = ctx.agent?.identity;
        const identitiesToKick = participants
          .map((participant) => participant.identity)
          .filter((identity): identity is string => Boolean(identity && identity !== localAgentIdentity));

        await Promise.allSettled(
          identitiesToKick.map((identity) => roomServiceClient.removeParticipant(roomName, identity)),
        );
      } catch (error) {
        console.error('Gagal mengeluarkan participant dari room.', { error });
      }
    };

    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, async (event) => {
      if (endingConversation || !event.isFinal) {
        return;
      }

      let shouldEndConversation = hasEndConversationIntent(event.transcript);

      const useEndIntentLlm = process.env.END_CONVERSATION_USE_LLM !== 'false';

      if (!shouldEndConversation && useEndIntentLlm && shouldRunEndIntentLlm(event.transcript)) {
        try {
          shouldEndConversation = await shouldEndConversationWithLlm(
            event.transcript,
            endIntentClassifier,
          );
        } catch (error) {
          console.error('Gagal klasifikasi intent akhir percakapan via LLM.', { error });
        }
      }

      if (!shouldEndConversation) {
        return;
      }

      endingConversation = true;

      try {
        await session.interrupt({ force: true }).await;
        const farewell = session.say(
          'Baik, percakapan kita akhiri di sini. Room akan saya tutup setelah pesan ini. Terima kasih, sampai jumpa.',
          {
            addToChatCtx: true,
            allowInterruptions: false,
          },
        );
        await farewell.waitForPlayout();
        await new Promise((resolve) => setTimeout(resolve, 800));
      } catch (error) {
        console.error('Gagal memutar ucapan penutup.', { error });
      }

      await kickRemoteParticipants();

      try {
        await session.close();
      } catch (error) {
        console.error('Gagal menutup sesi setelah intent akhir percakapan.', { error });
      }

      ctx.shutdown('user_requested_end_conversation');
    });

    const flushTranscript = async (reason: string) => {
      if (transcriptSent) {
        return;
      }

      if (!transcriptApiUrl) {
        console.warn('TRANSCRIPT_API_URL belum diset. Pengiriman transcript dilewati.');
        transcriptSent = true;
        return;
      }

      if (transcriptStore.size() === 0) {
        transcriptSent = true;
        return;
      }

      try {
        const roomSid = ctx.job.room?.sid ?? '';
        const payload = transcriptStore.buildPayload({
          roomName: ctx.room.name ?? '',
          roomSid,
          jobId: ctx.job.id,
        });

        const request = {
          url: transcriptApiUrl,
          payload,
          ...(transcriptApiToken ? { token: transcriptApiToken } : {}),
        };

        await sendTranscriptToExternalApi(request);

        transcriptSent = true;
      } catch (error) {
        console.error('Gagal mengirim transcript saat sesi berakhir.', {
          reason,
          error,
        });
      }
    };

    session.on(voice.AgentSessionEventTypes.Close, async (event) => {
      await flushTranscript(String(event.reason));
    });

    ctx.addShutdownCallback(async () => {
      await flushTranscript('job_shutdown');
      await endIntentClassifier.aclose();
    });

    // Sapaan pembuka: tidak boleh diinterupsi (noise / percakapan latar saat agent mulai berbicara)
    session.generateReply({
      instructions: 'Sapa pengguna dalam Bahasa Indonesia dengan sopan, singkat, dan jelas.',
      allowInterruptions: false,
    });
  },
});

// Run the agent server
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'hackathon-sprout',
  }),
);
