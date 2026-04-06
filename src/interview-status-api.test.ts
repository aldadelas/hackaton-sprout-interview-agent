import { describe, expect, it } from 'vitest';
import {
  buildInterviewStatusUrl,
  extractApplicationIdFromRoomMetadata,
} from './interview-status-api';

describe('extractApplicationIdFromRoomMetadata', () => {
  it('mengambil applicationId dari JSON room metadata', () => {
    expect(
      extractApplicationIdFromRoomMetadata('{"applicationId":"app-99","sessionId":"s1"}'),
    ).toBe('app-99');
    expect(extractApplicationIdFromRoomMetadata('{"application_id":"app-88"}')).toBe('app-88');
  });

  it('mengembalikan undefined jika tidak ada', () => {
    expect(extractApplicationIdFromRoomMetadata('{"sessionId":"s1"}')).toBeUndefined();
  });
});

describe('buildInterviewStatusUrl', () => {
  it('membangun URL dengan path applicationId dan query status', () => {
    const u = buildInterviewStatusUrl(
      'https://kuantum-api-production.up.railway.app/api/interviews',
      'app-123',
      'completed',
    );
    expect(u).toBe(
      'https://kuantum-api-production.up.railway.app/api/interviews/app-123/?status=completed',
    );
  });
});
