import { getPosthog, whenAnalyticsReady } from './client';
import { EVENTS } from './events';
import { setAnalyticsOptedOut, isAnalyticsOptedOut } from './consent';
import type { ActiveEventName, EventPayloads } from './types';

/**
 * THE only capture surface for this app. Every `posthog.capture()` call in the codebase lives
 * here — no other file may call it directly (enforced by analytics/tests/noDirectCapture.test.ts).
 * Reasons this matters for a product expected to serve real event volume: one place to add
 * validation/sampling/batching later, one place that already handles "analytics disabled or user
 * opted out" as a safe no-op, and a compiler-checked event name + payload for every call site.
 */

/**
 * Fire a typed product event. No-ops silently when analytics isn't configured (no key, or dev
 * without VITE_ANALYTICS_DEV) or the user opted out — callers never need their own guard.
 *
 * If posthog-js is still being fetched (initAnalytics dynamically imports it — see client.ts),
 * the event is queued and replayed in order once it's ready, rather than silently dropped. That
 * window is real now (it wasn't when the import was static) and top-of-funnel events like
 * `landing_view` fire in exactly that window on a fresh page load.
 */
export function track<E extends ActiveEventName>(event: E, properties: EventPayloads[E]): void {
  const ph = getPosthog();
  if (ph) {
    ph.capture(EVENTS[event], properties as Record<string, unknown>);
    return;
  }
  whenAnalyticsReady(() => getPosthog()?.capture(EVENTS[event], properties as Record<string, unknown>));
}

/** Identity a signed-in user. Call once, right after AuthContext resolves a session — never with
 *  email, password, or any other PII. `account_age_days` is computed by the caller from the
 *  Supabase user's created_at, not stored here. */
export function identifyUser(
  userId: string,
  props: {
    username: string | null;
    provider: 'email' | 'google';
    account_age_days: number;
    plan: 'beta';
    language: string | null;
    country: string | null;
  }
): void {
  const ph = getPosthog();
  if (!ph) return;
  ph.identify(userId, props);
  if (props.country) ph.group('country', props.country);
  if (props.language) ph.group('language', props.language);
}

/** Link the current anonymous distinct id to a newly-created account id, preserving pre-signup
 *  event history under the new identified person. Call BEFORE identifyUser on first sign-up. */
export function aliasAnon(userId: string): void {
  const ph = getPosthog();
  if (!ph) return;
  ph.alias(userId);
}

/** Call on sign-out (AuthContext's SIGNED_OUT handling) — starts a fresh anonymous distinct id so
 *  the next guest session on this device isn't attributed to the account that just logged out. */
export function resetIdentity(): void {
  const ph = getPosthog();
  if (!ph) return;
  ph.reset();
}

/** Reserved for future segmentation (organization/team accounts) — not populated today; see
 *  types.ts's FuturePayloads.organization_created for what would start using this. */
export function setGroup(groupType: 'organization', groupKey: string): void {
  const ph = getPosthog();
  if (!ph) return;
  ph.group(groupType, groupKey);
}

export { isAnalyticsOptedOut, setAnalyticsOptedOut };

/** Applies (or clears) the user's opt-out choice on the live PostHog instance immediately — call
 *  from the Settings toggle. Capture stops on the very next line after opting out. */
export function setAnalyticsOptOut(optedOut: boolean): void {
  setAnalyticsOptedOut(optedOut);
  const ph = getPosthog();
  if (!ph) return;
  if (optedOut) ph.opt_out_capturing();
  else ph.opt_in_capturing();
}
