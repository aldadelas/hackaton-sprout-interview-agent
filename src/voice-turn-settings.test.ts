import { describe, expect, it } from 'vitest';
import {
  getAecWarmupMs,
  getSileroVadLoadOptions,
  getTurnHandlingOptions,
  readEnvFloat,
  readEnvInt,
} from './voice-turn-settings';

describe('readEnvInt', () => {
  it('mengembalikan fallback jika kosong atau tidak valid', () => {
    expect(readEnvInt({}, 'X', 10)).toBe(10);
    expect(readEnvInt({ X: '' }, 'X', 10)).toBe(10);
    expect(readEnvInt({ X: 'nope' }, 'X', 10)).toBe(10);
  });

  it('membaca integer dari env', () => {
    expect(readEnvInt({ X: '42' }, 'X', 10)).toBe(42);
  });
});

describe('readEnvFloat', () => {
  it('membaca float dari env', () => {
    expect(readEnvFloat({ X: '0.62' }, 'X', 0.5)).toBe(0.62);
    expect(readEnvFloat({ X: 'bad' }, 'X', 0.5)).toBe(0.5);
  });
});

describe('getSileroVadLoadOptions', () => {
  it('menggunakan default yang lebih konservatif', () => {
    const o = getSileroVadLoadOptions({});
    expect(o.minSpeechDuration).toBe(160);
    expect(o.minSilenceDuration).toBe(650);
    expect(o.activationThreshold).toBe(0.58);
  });
});

describe('getTurnHandlingOptions', () => {
  it('default: vad + minimal kata & durasi interupsi', () => {
    const o = getTurnHandlingOptions({});
    expect(o.interruption.mode).toBe('vad');
    expect(o.interruption.minWords).toBe(3);
    expect(o.interruption.minDuration).toBe(900);
    expect(o.endpointing.minDelay).toBe(600);
  });

  it('INTERRUPTION_MODE=auto mengembalikan mode undefined', () => {
    const o = getTurnHandlingOptions({ INTERRUPTION_MODE: 'auto' });
    expect(o.interruption.mode).toBeUndefined();
  });
});

describe('getAecWarmupMs', () => {
  it('default 3500', () => {
    expect(getAecWarmupMs({})).toBe(3500);
  });

  it('null jika dimatikan', () => {
    expect(getAecWarmupMs({ AEC_WARMUP_MS: '0' })).toBeNull();
    expect(getAecWarmupMs({ AEC_WARMUP_MS: 'off' })).toBeNull();
  });
});
