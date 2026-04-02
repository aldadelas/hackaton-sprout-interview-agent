import { describe, expect, it, vi } from 'vitest';
import { createTranscriptStore, sendTranscriptToExternalApi } from './transcript';

describe('transcript store', () => {
  it('hanya menyimpan item percakapan valid', () => {
    const store = createTranscriptStore();

    store.addFromConversationItem({ role: 'user', textContent: 'Halo', createdAt: 1 });
    store.addFromConversationItem({ role: 'assistant', textContent: 'Hai juga', createdAt: 2 });
    store.addFromConversationItem({ role: 'tool', textContent: 'internal', createdAt: 3 });
    store.addFromConversationItem({ role: 'user', textContent: '   ', createdAt: 4 });

    const payload = store.buildPayload({
      roomName: 'room-a',
      roomSid: 'RM_123',
      jobId: 'job-1',
      applicationId: 'app-1',
      endedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(payload.transcript).toHaveLength(2);
    expect(payload.transcript[0]).toMatchObject({ role: 'user', text: 'Halo' });
    expect(payload.transcript[1]).toMatchObject({ role: 'assistant', text: 'Hai juga' });
    expect(payload.applicationId).toBe('app-1');
  });
});

describe('sendTranscriptToExternalApi', () => {
  it('mengirim payload ke endpoint eksternal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendTranscriptToExternalApi({
      url: 'https://example.com/transcript',
      token: 'abc123',
      payload: {
        roomName: 'room-a',
        roomSid: 'RM_123',
        jobId: 'job-1',
        applicationId: 'app-1',
        endedAt: '2026-01-01T00:00:00.000Z',
        transcript: [{ role: 'user', text: 'Halo', createdAt: 1 }],
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/transcript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer abc123',
      },
      body: JSON.stringify({
        roomName: 'room-a',
        roomSid: 'RM_123',
        jobId: 'job-1',
        applicationId: 'app-1',
        endedAt: '2026-01-01T00:00:00.000Z',
        transcript: [{ role: 'user', text: 'Halo', createdAt: 1 }],
      }),
    });
  });
});
