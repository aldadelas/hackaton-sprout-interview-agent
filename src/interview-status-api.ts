/**
 * Notifikasi ke backend Kuantum saat wawancara selesai atau tidak bisa dilanjutkan.
 * Contoh URL: https://host/api/interviews/:applicationId/?status=completed
 */

export type InterviewTerminalStatus = 'completed' | 'failed' | 'aborted';

/** Coba ambil applicationId dari room metadata JSON (fallback jika tidak dari API instruksi). */
export function extractApplicationIdFromRoomMetadata(metadata?: string): string | undefined {
  if (!metadata?.trim()) {
    return undefined;
  }
  try {
    const o = JSON.parse(metadata) as Record<string, unknown>;
    const raw = o.applicationId ?? o.application_id;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  } catch {
    return undefined;
  }
}

export function buildInterviewStatusUrl(
  baseUrl: string,
  applicationId: string,
  status: InterviewTerminalStatus,
): string {
  const root = baseUrl.replace(/\/$/, '');
  const path = `${root}/${encodeURIComponent(applicationId)}/`;
  const u = new URL(path);
  u.searchParams.set('status', status);
  return u.toString();
}

export type PatchInterviewStatusParams = {
  baseUrl: string;
  applicationId: string;
  status: InterviewTerminalStatus;
  token?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export async function patchInterviewStatus(params: PatchInterviewStatusParams): Promise<void> {
  const { baseUrl, applicationId, status, token, signal, timeoutMs = 10_000 } = params;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const combined = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  const url = buildInterviewStatusUrl(baseUrl, applicationId, status);
  const method = (process.env.INTERVIEW_STATUS_HTTP_METHOD?.trim().toUpperCase() || 'PATCH') as
    | 'PATCH'
    | 'POST'
    | 'PUT';

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-api-key'] = token;
    headers['x-internal-token'] = token;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      signal: combined,
    });

    if (!response.ok) {
      console.warn('INTERVIEW_STATUS_API: respons HTTP tidak OK.', {
        status: response.status,
        url,
      });
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      console.warn('INTERVIEW_STATUS_API: permintaan dibatalkan atau timeout.', { error });
    } else {
      console.error('INTERVIEW_STATUS_API: gagal memanggil endpoint status wawancara.', {
        error,
        url,
      });
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
