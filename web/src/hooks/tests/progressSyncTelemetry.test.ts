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

const insertMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: insertMock }),
  },
  supabaseReady: true,
}));

import { logSignAttempt, logVerification } from '@/hooks/useProgressSync';

describe('telemetry helpers never reject', () => {
  beforeEach(() => {
    insertMock.mockReset();
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
});
