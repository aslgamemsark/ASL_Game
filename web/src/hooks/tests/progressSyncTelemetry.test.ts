/**
 * ASL-A2 acceptance test: none of the three telemetry helpers in useProgressSync may reject.
 *
 * `c9b8150` gave logAttempt a try/catch ("telemetry inserts never reject into
 * unhandledrejection") but left logSignAttempt and logVerification bare — an insert that
 * THROWS (network failure surfacing as an exception rather than the `{ error }` field) still
 * escapes into an unhandled rejection on every lesson/practice page that fire-and-forgets
 * them. This test must FAIL against the pre-A2 code (logVerification rejects), and pass once
 * all three helpers swallow-and-log like logAttempt does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { insertMock, fromMock, consent } = vi.hoisted(() => {
  const insert = vi.fn();
  return { insertMock: insert, fromMock: vi.fn(() => ({ insert })), consent: { enabled: false } };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
  supabaseReady: true,
}));

vi.mock('@/stores/useUserStore', () => ({
  useUserStore: { getState: () => ({ collectTrainingData: consent.enabled }) },
}));

import { logAttempt, logSignAttempt, logVerification } from '@/hooks/useProgressSync';

describe('telemetry helpers never reject', () => {
  beforeEach(() => {
    insertMock.mockReset();
    fromMock.mockClear();
    consent.enabled = false;
  });

  it('logSignAttempt swallows a throwing insert', async () => {
    insertMock.mockRejectedValueOnce(new TypeError('fetch failed: network down'));
    await expect(logSignAttempt('user-1', 'HELLO', true)).resolves.toBeUndefined();
  });

  it('logVerification swallows a throwing insert', async () => {
    insertMock.mockRejectedValueOnce(new TypeError('fetch failed: network down'));
    await expect(
      logVerification('user-1', {
        signName: 'HELLO',
        decision: 'pass',
        params: [],
        vote: null,
      } as never),
    ).resolves.toBeUndefined();
  });

  it('does not upload landmark frames before explicit training-data consent', async () => {
    insertMock.mockResolvedValue({ error: null });
    await logAttempt({
      userId: 'user-1', signId: 'HELLO', rulePassed: true, aiPrediction: null,
      aiConfidence: null, aiVetoed: false, finalPassed: true, outcome: 'PASS',
      quality: { requiredHandCoverage: 1, clippedFrameRatio: 0, poseCoverage: 1, signerScale: 0.4, durationSeconds: 1, maxFrameGapSeconds: 0.1, normalizedWristMotion: 0.2 },
      evidenceSchemaVersion: 1, recognitionVersion: 'rules-v1',
      source: 'lesson', frames: [{ t: 0 } as never],
    });

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('sign_attempts');
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      evidence_schema_version: 1,
      recognition_version: 'rules-v1',
    }));
  });
});
