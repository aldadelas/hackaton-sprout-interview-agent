import { llm } from '@livekit/agents';

/**
 * Pola eksplisit saja — cocok untuk lingkungan berisik: tidak memicu dari kata tunggal
 * yang sering muncul sebagai artefak STT.
 */
const STRONG_END_PATTERNS = [
  /\b(akhiri|sudahi|selesaikan)\s+(percakapan|obrolan|chat)\b/i,
  /\b(tutup|end|close)\s+(room|ruangan)\b/i,
  /\b(saya|aku)\s+(ingin|mau)\s+(selesai|akhiri|sudahi)\b/i,
  /\b(cukup)\s+(terima kasih|makasih|thanks)\b/i,
  /\b(terima kasih|makasih),?\s*(selesai|cukup|sekian)\b/i,
  /\b(sekian dulu|cukup dulu|sekian ya|cukup ya)\b/i,
  /\b(bye|dadah)\b|\bselamat tinggal\b|\bsampai jumpa\b/i,
];

/**
 * Minimal ada “petunjuk” end-session sebelum kita tanya LLM — mengurangi false positive dari noise.
 */
const SOFT_END_HINT =
  /\b(akhiri|sudahi|selesai|selesaikan|tutup|room|percakapan|obrolan|pamit|undur|cukup|sekian|bye|dadah|makasih|terima kasih|selamat tinggal|sampai jumpa)\b/i;

const MIN_LLM_TRANSCRIPT_LEN = 4;
const MAX_LLM_TRANSCRIPT_LEN = 240;

export function hasEndConversationIntent(text: string): boolean {
  const normalized = text.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return STRONG_END_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Hanya panggil LLM jika teks cukup bermakna dan mengandung petunjuk end-session,
 * supaya noise/ruas pendek dari STT tidak diklasifikasi sebagai “tutup room”.
 */
export function shouldRunEndIntentLlm(text: string): boolean {
  const trimmed = text.trim();

  if (trimmed.length < MIN_LLM_TRANSCRIPT_LEN || trimmed.length > MAX_LLM_TRANSCRIPT_LEN) {
    return false;
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2) {
    return false;
  }

  return SOFT_END_HINT.test(trimmed);
}

export function parseEndIntentDecision(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return normalized.startsWith('YES');
}

type IntentClassifier = {
  chat: (args: { chatCtx: llm.ChatContext }) => AsyncIterable<{ delta?: { content?: string } }>;
};

export async function shouldEndConversationWithLlm(
  text: string,
  classifier: IntentClassifier,
): Promise<boolean> {
  const chatCtx = new llm.ChatContext();
  chatCtx.addMessage({
    role: 'system',
    content: [
      'Anda mengklasifikasi apakah user JELAS-JELAS ingin mengakhiri sesi suara / menutup percakapan / keluar dari room.',
      'Jawab HANYA satu token: YES atau NO.',
      '',
      'YES hanya jika niat mengakhiri sesi sangat jelas (mis. pamit permanen, minta tutup room, akhiri percakapan).',
      '',
      'NO untuk: pertanyaan bisnis, lanjut topik, ucapan terima kasih biasa tanpa pamit, noise/fragment STT, teks ambigu,',
      'satu-dua kata acak, atau jika user masih bisa ingin bantuan.',
      '',
      'Di lingkungan berisik, STT sering salah: jika ragu, jawab NO.',
    ].join('\n'),
  });
  chatCtx.addMessage({
    role: 'user',
    content: `Ucapan user (transkrip): "${text}"`,
  });

  const chunks: string[] = [];
  for await (const chunk of classifier.chat({ chatCtx })) {
    const content = chunk.delta?.content;
    if (content) {
      chunks.push(content);
    }
  }

  return parseEndIntentDecision(chunks.join(''));
}
