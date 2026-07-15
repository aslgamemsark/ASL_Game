import { describe, it, expect } from 'vitest';
import { buildFeedbackPayload, MAX_FEEDBACK_LEN } from '../feedback';

describe('buildFeedbackPayload', () => {
  const base = { category: 'bug' as const, message: 'it broke', anonymous: false, userId: 'user-1' };

  it('attaches the user id when signed in and not anonymous', () => {
    const row = buildFeedbackPayload(base);
    expect(row).not.toBeNull();
    expect(row!.user_id).toBe('user-1');
    expect(row!.anonymous).toBe(false);
  });

  it('drops the user id to null when anonymous — anonymity is enforced here, not just in the UI', () => {
    // This is the shape the RLS insert policy requires: anonymous rows must carry no user_id, so
    // the feedback genuinely can't be traced back to a profile even though a signed-in user filed it.
    const row = buildFeedbackPayload({ ...base, anonymous: true });
    expect(row!.user_id).toBeNull();
    expect(row!.anonymous).toBe(true);
  });

  it('carries a null user id straight through for a signed-out tester', () => {
    const row = buildFeedbackPayload({ ...base, userId: null });
    expect(row!.user_id).toBeNull();
  });

  it('trims surrounding whitespace from the message', () => {
    const row = buildFeedbackPayload({ ...base, message: '  hello  ' });
    expect(row!.message).toBe('hello');
  });

  it('returns null when the message is empty or whitespace-only (nothing to submit)', () => {
    expect(buildFeedbackPayload({ ...base, message: '' })).toBeNull();
    expect(buildFeedbackPayload({ ...base, message: '   ' })).toBeNull();
  });

  it('truncates an over-long paste to the DB cap so the insert can never bounce on length', () => {
    const row = buildFeedbackPayload({ ...base, message: 'x'.repeat(MAX_FEEDBACK_LEN + 500) });
    expect(row!.message.length).toBe(MAX_FEEDBACK_LEN);
  });

  it('passes category and auto-captured context through unchanged', () => {
    const row = buildFeedbackPayload({
      ...base,
      category: 'feature',
      page: '/lesson',
      userAgent: 'Mozilla/5.0',
      appVersion: 'abc123',
    });
    expect(row!.category).toBe('feature');
    expect(row!.page).toBe('/lesson');
    expect(row!.user_agent).toBe('Mozilla/5.0');
    expect(row!.app_version).toBe('abc123');
  });

  it('defaults missing context fields to null rather than undefined', () => {
    const row = buildFeedbackPayload(base);
    expect(row!.page).toBeNull();
    expect(row!.user_agent).toBeNull();
    expect(row!.app_version).toBeNull();
  });
});
