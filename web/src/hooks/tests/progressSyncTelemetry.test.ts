import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertMock = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ insert: insertMock }) }, supabaseReady: true }));

import { logSignAttempt, logVerification } from '@/hooks/useProgressSync';

describe('telemetry helpers', () => {
  beforeEach(() => insertMock.mockReset());

  it('never reject when Supabase inserts throw', async () => {
    insertMock.mockRejectedValueOnce(new TypeError('network down'));
    await expect(logSignAttempt('user', 'HELLO', true)).resolves.toBeUndefined();
    insertMock.mockRejectedValueOnce(new TypeError('network down'));
    await expect(logVerification('user', { signName: 'HELLO', decision: 'pass', params: [], vote: null } as never)).resolves.toBeUndefined();
  });
});
