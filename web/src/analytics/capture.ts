import { analyticsConfigured, getPosthog, registerAnalyticsContext, whenAnalyticsReady } from './client';
import { EVENTS } from './events';
import { setAnalyticsOptedOut, isAnalyticsOptedOut } from './consent';
import type { ActiveEventName, EventPayloads } from './types';
let desiredIdentity: { id: string; props: Parameters<typeof identifyUser>[1] } | null = null;

/** Correlates telemetry only; never use this fallback as a security token. */
export function newAnalyticsId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

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
export function track<E extends ActiveEventName>(event: E, properties: EventPayloads[E], onCaptured?: (captured: boolean) => void): boolean {
  if (!analyticsConfigured || isAnalyticsOptedOut()) return false;
  const ph = getPosthog();
  if (ph) {
    const captured = Boolean(ph.capture(EVENTS[event], properties as Record<string, unknown>));
    onCaptured?.(captured);
    return true;
  }
  whenAnalyticsReady(() => {
    const captured = !isAnalyticsOptedOut() && Boolean(getPosthog()?.capture(EVENTS[event], properties as Record<string, unknown>));
    onCaptured?.(captured);
  });
  return true; // accepted by the local queue, not a server delivery acknowledgement
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
  desiredIdentity = { id: userId, props };
  whenAnalyticsReady(() => {
    const ph = getPosthog();
    if (!ph || isAnalyticsOptedOut()) return;
    const previous = ph.get_property('$user_id');
    if (previous && previous !== userId) { ph.reset(); registerAnalyticsContext(ph); }
    ph.identify(userId, props);
    if (props.country) ph.group('country', props.country);
    if (props.language) ph.group('language', props.language);
  });
}

/** Call on sign-out (AuthContext's SIGNED_OUT handling) — starts a fresh anonymous distinct id so
 *  the next guest session on this device isn't attributed to the account that just logged out. */
export function resetIdentity(onlyIfIdentified = false): void {
  desiredIdentity = null;
  whenAnalyticsReady(() => {
    const ph = getPosthog();
    if (!ph || (onlyIfIdentified && !ph.get_property('$user_id'))) return;
    ph.reset();
    registerAnalyticsContext(ph);
  });
}

export { isAnalyticsOptedOut, setAnalyticsOptedOut };

/** Applies (or clears) the user's opt-out choice on the live PostHog instance immediately — call
 *  from the Settings toggle. Capture stops on the very next line after opting out. */
export function setAnalyticsOptOut(optedOut: boolean): void {
  setAnalyticsOptedOut(optedOut);
  const ph = getPosthog();
  if (!ph) return;
  if (optedOut) ph.opt_out_capturing();
  else {
    ph.opt_in_capturing({ captureEventName: false });
    if (desiredIdentity) identifyUser(desiredIdentity.id, desiredIdentity.props);
    else resetIdentity(true);
  }
}
