import { describe, expect, it } from 'vitest';
import {
  hasEndConversationIntent,
  parseEndIntentDecision,
  shouldEndConversationWithLlm,
  shouldRunEndIntentLlm,
} from './end-conversation';

describe('hasEndConversationIntent', () => {
  it('mengembalikan true untuk frasa mengakhiri percakapan yang eksplisit', () => {
    expect(hasEndConversationIntent('Tolong akhiri percakapan sekarang')).toBe(true);
    expect(hasEndConversationIntent('saya ingin selesai')).toBe(true);
    expect(hasEndConversationIntent('tolong tutup room ini')).toBe(true);
    expect(hasEndConversationIntent('sekian dulu')).toBe(true);
    expect(hasEndConversationIntent('cukup terima kasih')).toBe(true);
    expect(hasEndConversationIntent('selamat tinggal')).toBe(true);
  });

  it('mengembalikan false untuk percakapan biasa', () => {
    expect(hasEndConversationIntent('Bisa jelaskan produk ini?')).toBe(false);
    expect(hasEndConversationIntent('Saya ingin tanya soal harga')).toBe(false);
  });

  it('tidak memicu dari kata tunggal yang sering jadi noise STT', () => {
    expect(hasEndConversationIntent('cukup')).toBe(false);
    expect(hasEndConversationIntent('sekian')).toBe(false);
    expect(hasEndConversationIntent('ya')).toBe(false);
  });
});

describe('shouldRunEndIntentLlm', () => {
  it('false untuk teks terlalu pendek atau tanpa petunjuk end-session', () => {
    expect(shouldRunEndIntentLlm('ok')).toBe(false);
    expect(shouldRunEndIntentLlm('the quick brown fox')).toBe(false);
    expect(shouldRunEndIntentLlm('')).toBe(false);
  });

  it('true jika ada beberapa kata dan petunjuk end-session', () => {
    expect(shouldRunEndIntentLlm('sudah cukup ya terima kasih')).toBe(true);
    expect(shouldRunEndIntentLlm('tolong tutup saja percakapan ini')).toBe(true);
  });
});

describe('parseEndIntentDecision', () => {
  it('membaca output YES/NO dari classifier', () => {
    expect(parseEndIntentDecision('YES')).toBe(true);
    expect(parseEndIntentDecision('YES - user wants to end')).toBe(true);
    expect(parseEndIntentDecision('NO')).toBe(false);
  });
});

describe('shouldEndConversationWithLlm', () => {
  it('menggunakan hasil classifier untuk menentukan end intent', async () => {
    const yesClassifier = {
      async *chat() {
        yield { delta: { content: 'YES' } };
      },
    };

    const noClassifier = {
      async *chat() {
        yield { delta: { content: 'NO' } };
      },
    };

    await expect(
      shouldEndConversationWithLlm('sudah cukup', yesClassifier),
    ).resolves.toBe(true);
    await expect(
      shouldEndConversationWithLlm('tolong jelaskan fitur', noClassifier),
    ).resolves.toBe(false);
  });
});
