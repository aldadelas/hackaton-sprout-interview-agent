export type SileroVadLoadOverrides = {
  minSpeechDuration: number;
  minSilenceDuration: number;
  activationThreshold: number;
};

export function readEnvInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function readEnvFloat(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Silero VAD: kurang sensitif terhadap noise latar — butuh ucapan sedikit lebih panjang & probabilitas lebih tinggi.
 */
export function getSileroVadLoadOptions(env: NodeJS.ProcessEnv = process.env): SileroVadLoadOverrides {
  return {
    minSpeechDuration: readEnvInt(env, 'VAD_MIN_SPEECH_MS', 160),
    minSilenceDuration: readEnvInt(env, 'VAD_MIN_SILENCE_MS', 650),
    activationThreshold: readEnvFloat(env, 'VAD_ACTIVATION_THRESHOLD', 0.58),
  };
}

function parseInterruptionMode(
  env: NodeJS.ProcessEnv,
): 'adaptive' | 'vad' | undefined {
  const v = env.INTERRUPTION_MODE?.trim().toLowerCase();
  if (v === undefined || v === '') {
    return 'vad';
  }
  if (v === 'vad') {
    return 'vad';
  }
  if (v === 'adaptive') {
    return 'adaptive';
  }
  if (v === 'auto' || v === 'default') {
    return undefined;
  }
  return 'vad';
}

/**
 * Interupsi: butuh lebih banyak bukti ucapan (durasi + kata dari STT) sebelum agent terpotong.
 * Mode default `vad` lebih konservatif di ruang berisik dibanding deteksi adaptif.
 */
export function getTurnHandlingOptions(env: NodeJS.ProcessEnv = process.env): {
  interruption: {
    mode: 'adaptive' | 'vad' | undefined;
    minWords: number;
    minDuration: number;
  };
  endpointing: {
    minDelay: number;
  };
} {
  const minWords = readEnvInt(env, 'INTERRUPTION_MIN_WORDS', 3);
  const minDuration = readEnvInt(env, 'INTERRUPTION_MIN_DURATION_MS', 900);
  const mode = parseInterruptionMode(env);

  return {
    interruption: {
      mode,
      minWords,
      minDuration,
    },
    endpointing: {
      minDelay: readEnvInt(env, 'ENDPOINTING_MIN_DELAY_MS', 600),
    },
  };
}

export function getAecWarmupMs(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env.AEC_WARMUP_MS?.trim();
  if (raw === '' || raw === undefined) {
    return 3500;
  }
  if (raw === '0' || raw.toLowerCase() === 'off' || raw.toLowerCase() === 'false') {
    return null;
  }
  return readEnvInt(env, 'AEC_WARMUP_MS', 3500);
}
