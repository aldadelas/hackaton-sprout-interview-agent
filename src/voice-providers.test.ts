import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useDirectProviderApis,
  validateDirectProviderEnv,
} from './voice-providers';

describe('voice-providers env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('useDirectProviderApis true hanya jika USE_DIRECT_PROVIDER_APIS=true', () => {
    vi.stubEnv('USE_DIRECT_PROVIDER_APIS', 'true');
    expect(useDirectProviderApis()).toBe(true);
    vi.stubEnv('USE_DIRECT_PROVIDER_APIS', 'false');
    expect(useDirectProviderApis()).toBe(false);
  });

  it('validateDirectProviderEnv mengembalikan daftar key yang kosong', () => {
    vi.stubEnv('USE_DIRECT_PROVIDER_APIS', 'true');
    vi.stubEnv('DEEPGRAM_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', 'x');
    vi.stubEnv('ELEVEN_API_KEY', 'y');
    vi.stubEnv('ELEVENLABS_VOICE_ID', 'z');
    expect(validateDirectProviderEnv()).toContain('DEEPGRAM_API_KEY');
  });
});
