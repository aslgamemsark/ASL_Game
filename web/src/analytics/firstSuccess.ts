import { track } from './capture';
import { analyticsConfigured, whenAnalyticsReady } from './client';
import { isAnalyticsOptedOut } from './consent';
import type { AttemptSource } from './types';

const FIRST_SUCCESS_KEY = 'quicksign-first-sign-success-v3:';
let userId: string | null = null;

/** Device-local dedup scoped to the current account/guest; identify links guest history. */
export function setFirstSuccessIdentity(next: string | null): void {
  const previous = userId;
  userId = next;
  if (previous === next) return;
  // Preserve the same order as capture/identify/reset, including transitions during SDK load.
  whenAnalyticsReady(() => {
    try {
      const guestKey = FIRST_SUCCESS_KEY + 'guest';
      if (!previous && next && localStorage.getItem(guestKey) === '1') {
        localStorage.setItem(FIRST_SUCCESS_KEY + next, '1');
        localStorage.removeItem(guestKey); // a later account must not inherit this guest again
      }
      if (previous && !next) localStorage.removeItem(guestKey);
    } catch { /* optional telemetry */ }
  });
}

/**
 * First accepted sign per guest/account in this browser, across all learning surfaces.
 * SDK acceptance is not a server receipt, and this does not deduplicate across devices.
 * Storage failures cost telemetry rather than interrupting the lesson.
 */
export function trackFirstSignSuccess(args: {
  signId: string;
  source: AttemptSource;
  msSinceLessonStart: number;
  attemptsTaken: number;
}): void {
  if (!analyticsConfigured || isAnalyticsOptedOut()) return;
  const key = FIRST_SUCCESS_KEY + (userId ?? 'guest');
  const scope = userId ? 'account' : 'guest';
  whenAnalyticsReady(() => {
    try {
      if (localStorage.getItem(key) === '1') return;
    } catch {
      return;
    }
    // Check here, not when enqueuing: an earlier queued guest success may have migrated to
    // this account while the SDK loaded. track() also rechecks consent before capturing.
    track('first_sign_success', {
      sign_id: args.signId, source: args.source, flow_version: 3, identity_scope: scope,
      ms_since_lesson_start: args.msSinceLessonStart, attempts_taken: args.attemptsTaken,
    }, captured => {
      if (captured) {
        try { localStorage.setItem(key, '1'); } catch { /* optional telemetry */ }
      }
    });
  });
}
