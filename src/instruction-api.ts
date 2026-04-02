import { z } from 'zod';

const roomMetadataSchema = z.object({
  sessionId: z.string().min(1),
});

const instructionDetailSchema = z.object({
  id: z.string(),
  instruction: z.string(),
  job: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
  company: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    address: z.string().optional(),
  }),
  jobUrl: z.string().optional(),
  companyLandingPage: z.string().optional(),
  applicationId: z.string().optional()
});

export type InstructionDetail = z.infer<typeof instructionDetailSchema>;

export type ResolveInstructionsResult = {
  instructions: string;
  sessionId?: string;
  applicationId?: string;
};

export type ResolveAgentInstructionsParams = {
  urlTemplate: string;
  token?: string;
  defaultInstructions: string;
  roomMetadata?: string;
  signal: AbortSignal;
  /** Timeout request dalam ms (default 10_000). */
  timeoutMs?: number;
};

export function extractSessionIdFromRoomMetadata(metadata?: string): string | undefined {
  if (!metadata?.trim()) {
    return undefined;
  }

  try {
    const parsed = roomMetadataSchema.safeParse(JSON.parse(metadata));
    if (!parsed.success) {
      return undefined;
    }
    return parsed.data.sessionId;
  } catch {
    return undefined;
  }
}

export function buildSessionInstructionUrl(urlTemplate: string, sessionId: string): string {
  const safeSessionId = encodeURIComponent(sessionId);
  if (urlTemplate.includes(':sessionId')) {
    return urlTemplate.replace(':sessionId', safeSessionId);
  }

  const normalized = urlTemplate.endsWith('/') ? urlTemplate.slice(0, -1) : urlTemplate;
  return `${normalized}/${safeSessionId}`;
}

function buildAugmentedInstruction(detail: InstructionDetail, defaultInstructions: string): string {
  const parts = [
    defaultInstructions.trim(),
    '',
    'KONTEKS TAMBAHAN DARI SISTEM',
    `Instruksi backend: ${detail.instruction}`,
    `Job title: ${detail.job.title ?? '-'}`,
    `Job description: ${detail.job.description ?? '-'}`,
    `Company name: ${detail.company.name ?? '-'}`,
    `Company description: ${detail.company.description ?? '-'}`,
    `Company address: ${detail.company.address ?? '-'}`,
    `Job URL: ${detail.jobUrl ?? '-'}`,
    `Company landing page: ${detail.companyLandingPage ?? '-'}`,
    '',
    'Gunakan konteks di atas sebagai sumber kebenaran saat wawancara.',
  ];

  return parts.join('\n');
}

export async function resolveAgentInstructions(
  params: ResolveAgentInstructionsParams,
): Promise<ResolveInstructionsResult> {
  const { urlTemplate, token, defaultInstructions, roomMetadata, signal, timeoutMs = 10_000 } =
    params;

  if (!urlTemplate.trim()) {
    return { instructions: defaultInstructions };
  }

  const sessionId = extractSessionIdFromRoomMetadata(roomMetadata);
  if (!sessionId) {
    return { instructions: defaultInstructions };
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const combined = AbortSignal.any([signal, timeoutController.signal]);

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-internal-token'] = token;
  }

  const requestUrl = buildSessionInstructionUrl(urlTemplate, sessionId);

  try {
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers,
      signal: combined,
    });

    if (!response.ok) {
      console.warn('AGENT_INSTRUCTION_API: respons HTTP tidak OK.', {
        status: response.status,
      });
      return { instructions: defaultInstructions, sessionId };
    }

    const json: unknown = await response.json();
    const parsed = instructionDetailSchema.safeParse(json);

    if (!parsed.success) {
      console.warn('AGENT_INSTRUCTION_API: body JSON tidak sesuai skema.', {
        issues: parsed.error.flatten(),
      });
      return { instructions: defaultInstructions, sessionId };
    }

    return {
      instructions: buildAugmentedInstruction(parsed.data, defaultInstructions),
      sessionId,
      ...(parsed.data.applicationId ? { applicationId: parsed.data.applicationId } : {}),
    };
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      console.warn('AGENT_INSTRUCTION_API: permintaan dibatalkan atau timeout.', { error });
    } else {
      console.error('AGENT_INSTRUCTION_API: gagal mengambil instruksi.', { error });
    }
    return { instructions: defaultInstructions, sessionId };
  } finally {
    clearTimeout(timeoutId);
  }
}
