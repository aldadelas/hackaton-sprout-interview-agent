import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSessionInstructionUrl,
  extractSessionIdFromRoomMetadata,
  resolveAgentInstructions,
} from './instruction-api';

const defaultInstructions = 'DEFAULT_SYSTEM_PROMPT';
const roomMetadata = '{"name":"Alda","sessionId":"872hysvY62"}';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('extractSessionIdFromRoomMetadata', () => {
  it('mengambil sessionId dari metadata room JSON', () => {
    expect(extractSessionIdFromRoomMetadata(roomMetadata)).toBe('872hysvY62');
  });

  it('mengembalikan undefined jika metadata invalid', () => {
    expect(extractSessionIdFromRoomMetadata('{invalid-json')).toBeUndefined();
  });
});

describe('buildSessionInstructionUrl', () => {
  it('mengganti placeholder :sessionId di URL template', () => {
    expect(
      buildSessionInstructionUrl('https://69ce0cad33a09f831b7cd3ec.mockapi.io/kuantum/:sessionId', 'abc'),
    ).toBe('https://69ce0cad33a09f831b7cd3ec.mockapi.io/kuantum/abc');
  });
});

describe('resolveAgentInstructions', () => {
  it('mengembalikan instruksi default tanpa memanggil fetch jika URL template kosong', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await resolveAgentInstructions({
      urlTemplate: '',
      defaultInstructions,
      roomMetadata,
      signal: new AbortController().signal,
    });

    expect(result.instructions).toBe(defaultInstructions);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('tidak memanggil fetch jika sessionId tidak ada di room metadata', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await resolveAgentInstructions({
      urlTemplate: 'https://69ce0cad33a09f831b7cd3ec.mockapi.io/kuantum/:sessionId',
      defaultInstructions,
      roomMetadata: '{"name":"Alda"}',
      signal: new AbortController().signal,
    });

    expect(result.instructions).toBe(defaultInstructions);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('menyusun instruksi final dengan data job dan company dari API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: '872hysvY62',
          instruction: 'agent ai interview',
          applicationId: 'app-77',
          job: {
            title: 'Software Engineer',
            description: 'anything about job',
          },
          company: {
            name: 'Sprout Digital Labs',
            description: 'anything about the company',
            address: '',
          },
          jobUrl: 'https://example.com/software-engineer',
          companyLandingPage: 'https://company.com',
        }),
      }),
    );

    const result = await resolveAgentInstructions({
      urlTemplate: 'https://69ce0cad33a09f831b7cd3ec.mockapi.io/kuantum/:sessionId',
      defaultInstructions,
      roomMetadata,
      signal: new AbortController().signal,
    });

    expect(result.sessionId).toBe('872hysvY62');
    expect(result.applicationId).toBe('app-77');
    expect(result.instructions).toContain(defaultInstructions);
    expect(result.instructions).toContain('Instruksi backend: agent ai interview');
    expect(result.instructions).toContain('Job title: Software Engineer');
    expect(result.instructions).toContain('Company name: Sprout Digital Labs');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('mengembalikan default jika HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    const result = await resolveAgentInstructions({
      urlTemplate: 'https://69ce0cad33a09f831b7cd3ec.mockapi.io/kuantum/:sessionId',
      defaultInstructions,
      roomMetadata,
      signal: new AbortController().signal,
    });

    expect(result.instructions).toBe(defaultInstructions);
    expect(result.sessionId).toBe('872hysvY62');
  });

  it('memakai GET dan Authorization Bearer jika token diset', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: '872hysvY62',
        instruction: 'x',
        job: {},
        company: {},
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await resolveAgentInstructions({
      urlTemplate: 'https://69ce0cad33a09f831b7cd3ec.mockapi.io/kuantum/:sessionId',
      token: 'secret-token',
      defaultInstructions,
      roomMetadata,
      signal: new AbortController().signal,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
        }),
      }),
    );
    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe('/kuantum/872hysvY62');
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeUndefined();
  });
});
