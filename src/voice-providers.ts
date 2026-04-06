import { inference } from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import type { STTOptions as DeepgramSTTOptions } from '@livekit/agents-plugin-deepgram';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import * as openai from '@livekit/agents-plugin-openai';
import type { stt as sttNs } from '@livekit/agents';
import type { llm as llmNs } from '@livekit/agents';
import type { tts as ttsNs } from '@livekit/agents';

/** Pakai kunci API provider langsung (Deepgram, OpenAI, ElevenLabs), bukan LiveKit Inference. */
export function useDirectProviderApis(): boolean {
  return process.env.USE_DIRECT_PROVIDER_APIS === 'true';
}

export function validateDirectProviderEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.DEEPGRAM_API_KEY?.trim()) {
    missing.push('DEEPGRAM_API_KEY');
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    missing.push('OPENAI_API_KEY');
  }
  if (!process.env.ELEVEN_API_KEY?.trim()) {
    missing.push('ELEVEN_API_KEY');
  }
  if (!process.env.ELEVENLABS_VOICE_ID?.trim()) {
    missing.push('ELEVENLABS_VOICE_ID');
  }
  return missing;
}

export type SessionVoiceComponents = {
  stt: sttNs.STT;
  llm: llmNs.LLM;
  tts: ttsNs.TTS;
  endIntentLlm: llmNs.LLM;
};

const DEFAULT_INFERENCE_CARTESIA_VOICE = '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc';

export function createSessionVoiceComponents(): SessionVoiceComponents {
  const openaiModel = process.env.OPENAI_LLM_MODEL?.trim() || 'gpt-4.1-mini';

  if (useDirectProviderApis()) {
    const sttModel = (process.env.DEEPGRAM_STT_MODEL?.trim() ||
      'nova-3') as DeepgramSTTOptions['model'];
    const sttLanguage = process.env.DEEPGRAM_LANGUAGE?.trim() || 'id';
    const elevenModel =
      process.env.ELEVENLABS_MODEL?.trim() || 'eleven_flash_v2_5';
    const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
    if (!voiceId) {
      throw new Error('ELEVENLABS_VOICE_ID wajib diset saat USE_DIRECT_PROVIDER_APIS=true');
    }

    return {
      stt: new deepgram.STT({
        model: sttModel,
        language: sttLanguage,
      }),
      llm: new openai.LLM({ model: openaiModel }),
      tts: new elevenlabs.TTS({
        model: elevenModel,
        voiceId,
      }),
      endIntentLlm: new openai.LLM({ model: openaiModel }),
    };
  }

  return {
    stt: new inference.STT({
      model: 'deepgram/nova-3',
      language: 'id',
    }),
    llm: new inference.LLM({
      model: 'openai/gpt-4.1-mini',
    }),
    tts: new inference.TTS({
      model: 'cartesia/sonic-3',
      voice: DEFAULT_INFERENCE_CARTESIA_VOICE,
    }),
    endIntentLlm: new inference.LLM({
      model: 'openai/gpt-4.1-mini',
    }),
  };
}
