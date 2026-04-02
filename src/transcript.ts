export type TranscriptEntry = {
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: number;
};

export type TranscriptPayload = {
  roomName: string;
  roomSid: string;
  jobId: string;
  applicationId?: string;
  endedAt: string;
  transcript: TranscriptEntry[];
};

type ConversationItemLike = {
  role: string;
  textContent: string | undefined;
  createdAt: number | undefined;
};

const ALLOWED_ROLES = new Set<TranscriptEntry['role']>(['user', 'assistant', 'system']);

export function createTranscriptStore() {
  const entries: TranscriptEntry[] = [];

  return {
    addFromConversationItem(item: ConversationItemLike): void {
      const role = item.role as TranscriptEntry['role'];
      const text = item.textContent?.trim();

      if (!ALLOWED_ROLES.has(role) || !text) {
        return;
      }

      entries.push({
        role,
        text,
        createdAt: item.createdAt ?? Date.now(),
      });
    },
    buildPayload(meta: {
      roomName: string;
      roomSid: string;
      jobId: string;
      applicationId?: string;
      endedAt?: string;
    }): TranscriptPayload {
      return {
        roomName: meta.roomName,
        roomSid: meta.roomSid,
        jobId: meta.jobId,
        ...(meta.applicationId ? { applicationId: meta.applicationId } : {}),
        endedAt: meta.endedAt ?? new Date().toISOString(),
        transcript: [...entries],
      };
    },
    size(): number {
      return entries.length;
    },
  };
}

export async function sendTranscriptToExternalApi(params: {
  url: string;
  payload: TranscriptPayload;
  token?: string;
}): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (params.token) {
    headers.Authorization = `Bearer ${params.token}`;
  }

  const response = await fetch(params.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params.payload),
  });

  if (!response.ok) {
    throw new Error(`Gagal kirim transcript: HTTP ${response.status}`);
  }
}
