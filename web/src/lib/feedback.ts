/**
 * Beta feedback payload construction — the pure, testable core of the "Report a Problem" flow.
 * Kept separate from the modal so the anonymity/trimming/context rules can be unit-tested without
 * rendering React or mocking Supabase.
 */

import { safeTruncate } from './text';

export type FeedbackCategory = 'bug' | 'feature' | 'other';

/** Matches the `feedback` table columns (see migration 20260715020000_feedback_table.sql). */
export interface FeedbackRow {
  user_id: string | null;
  category: FeedbackCategory;
  message: string;
  anonymous: boolean;
  page: string | null;
  user_agent: string | null;
  app_version: string | null;
}

/** DB CHECK caps message at 4000 chars; trim to that so a long paste can't bounce the insert. */
export const MAX_FEEDBACK_LEN = 4000;

interface BuildArgs {
  category: FeedbackCategory;
  message: string;
  anonymous: boolean;
  /** The current user's id, or null if not signed in. */
  userId: string | null;
  /** Which screen the tester was on (for reproduction). */
  page?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
}

/**
 * Builds the row to insert. Anonymity is enforced here, not just in the UI: when `anonymous` is
 * true the user_id is dropped to null so the row genuinely can't be traced back to a profile —
 * which is exactly the shape the RLS insert policy requires. Returns null if the message is empty
 * after trimming (nothing to submit).
 */
export function buildFeedbackPayload(args: BuildArgs): FeedbackRow | null {
  const message = safeTruncate(args.message.trim(), MAX_FEEDBACK_LEN);
  if (!message) return null;
  const anonymous = args.anonymous;
  return {
    user_id: anonymous ? null : args.userId,
    category: args.category,
    message,
    anonymous,
    page: args.page ?? null,
    user_agent: args.userAgent ?? null,
    app_version: args.appVersion ?? null,
  };
}
