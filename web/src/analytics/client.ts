import type { PostHog } from 'posthog-js';
import { isAnalyticsOptedOut } from './consent';
import { trafficType } from './trafficType';
import { attributionProperties, sanitizeAnalyticsProperties } from './attribution';
export { sanitizeAnalyticsProperties } from './attribution';

/**
 * The PostHog singleton — internal to the analytics module. Nothing outside `analytics/` should
 * import this directly; go through `capture.ts`'s `track()`/`identifyUser()`/etc, which are the
 * only sanctioned capture surface (enforced by the self-audit test in analytics/tests/).
 */

// Analytics is gated on BOTH a real key being configured AND (production OR an explicit local
// opt-in for testing before launch) — so a dev machine with no key never talks to PostHog, and a
// deployed preview without VITE_POSTHOG_KEY set stays silent rather than half-configured.
const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com';
const DEV_OPT_IN = import.meta.env.VITE_ANALYTICS_DEV === '1';

export const analyticsConfigured = Boolean(KEY) && (import.meta.env.PROD || DEV_OPT_IN);

let initialized = false;
let initialization: Promise<void> | null = null;
let posthog: PostHog | null = null;

// Callers that fire before the dynamic posthog-js import (below) resolves would otherwise
// silently no-op forever under the old "not initialized yet" contract — a real risk for the very
// first events of a session (landing_view, hero_cta_clicked), which are also the top-of-funnel
// metrics this project's whole analytics process is built around. `whenAnalyticsReady` lets a
// caller (capture.ts's `track`) queue exactly one retry instead of dropping the event.
let readyCallbacks: (() => void)[] = [];
export function whenAnalyticsReady(cb: () => void): void {
  if (initialized) { cb(); return; }
  if (!analyticsConfigured) return; // never becomes ready — nothing to queue
  readyCallbacks.push(cb);
}

/** Restore acquisition/release context after initialization and identity resets. */
export function registerAnalyticsContext(ph: Pick<PostHog, 'register' | 'group'>): void {
  ph.register({
    ...attributionProperties(), app_version: __APP_VERSION__, git_commit: __GIT_COMMIT__,
    deployment_environment: __DEPLOY_ENV__, build_timestamp: __BUILD_TIMESTAMP__, traffic_type: trafficType(),
  });
  ph.group('beta_cohort', 'reddit-beta-2026');
}

/**
 * Initialize PostHog once, as early as possible (main.tsx). Safe to call when analytics isn't
 * configured — it's a no-op. Privacy posture (reviewed 2026-07-23 — do not loosen further
 * without re-reviewing the product's "your camera never leaves your browser" promise):
 *   - Session replay is ON, but with every typed input MASKED (maskAllInputs) — replay records
 *     the flow/navigation/clicks so we can see where users get stuck, but never the actual text
 *     a user types (email, password, username, chat). It does NOT and cannot capture the webcam
 *     stream, so the "video never leaves your device" promise still holds. Still gated by the
 *     existing opt-out (Settings -> Privacy) and respect_dnt below. Also requires the project-
 *     level "Record user sessions" toggle to be on in PostHog.
 *   - Autocapture is ON (since 2026-07-27) purely so PostHog can derive $rageclick and so the AI
 *     replay summaries have an event stream to read. Product analytics still comes exclusively
 *     from deliberate, typed `track()` calls (see capture.ts) — autocaptured events are
 *     diagnostic noise, never a funnel source. Typed input is still masked (maskAllInputs).
 *   - NO automatic $pageview capture — this is a screen-state-machine SPA, not route-based; App.tsx
 *     sends one `screen_viewed` per screen change instead (see useScreenView.ts). $pageleave IS
 *     captured (unlike $pageview) — it fires once on tab-close/navigate-away regardless of the SPA's
 *     internal screen state, and PostHog needs it to compute accurate bounce rate/session duration;
 *     disabling it was an unrelated side effect of disabling $pageview, not an intentional choice.
 *   - person_profiles: 'identified_only' — anonymous users generate events but not a Person
 *     profile until they actually sign in (identifyUser in capture.ts).
 *   - respect_dnt — a browser's Do Not Track signal disables capture outright.
 *   - Web Vitals ARE captured (capture_performance) — that's product-quality telemetry, not
 *     behavioral tracking, and carries no PII.
 *
 * `posthog-js` (~73 KB gzip — larger than React itself) is loaded via a dynamic import rather
 * than a static one, so the browser can paint the app shell without waiting on it (found
 * 2026-07-30: a static top-level import puts a dependency in the SAME module graph as
 * `main.tsx`'s `createRoot(...).render(...)`, which must wait for every statically-imported
 * chunk to fetch+evaluate first). `whenAnalyticsReady` above is what keeps this safe for the
 * events that fire in that now-real window before the import resolves.
 */
export async function initAnalytics(): Promise<void> {
  if (!initialization) initialization = initializeAnalytics().catch(error => { initialization = null; throw error; });
  return initialization;
}

async function initializeAnalytics(): Promise<void> {
  if (initialized || !analyticsConfigured || !KEY) return;

  const { default: ph } = await import('posthog-js');
  posthog = ph;

  posthog.init(KEY, {
    api_host: HOST,
    disable_session_recording: false,
    // Record the session but never the text users type — passwords, emails, usernames and any
    // message content are masked; only the UI structure, navigation and clicks are captured.
    session_recording: { maskAllInputs: true },
    // Enabled 2026-07-27. Previously false on the reasoning that every event should be a
    // deliberate track() call — but that also disabled the two things needed to diagnose why
    // users leave: PostHog cannot compute $rageclick without it, and the AI session-replay
    // summaries return "no usable events" because the summarizer reads the EVENT stream, not the
    // replay (verified on three real recordings). The privacy posture is unchanged: autocapture
    // records click targets and selectors, never the webcam stream, and maskAllInputs below still
    // means typed text — emails, passwords, usernames, chat — is never recorded. The product
    // promise is "your camera never leaves your device", which this does not touch.
    autocapture: true,
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: 'identified_only',
    respect_dnt: true,
    opt_out_capturing_by_default: isAnalyticsOptedOut(),
    capture_performance: { web_vitals: true },
    // Wired via before_send, NOT sanitize_properties: posthog-js 1.404 still honours the latter
    // but logs a deprecation error on EVERY captured event and is dropping it in a future major.
    // A redaction step that both spams the console and is scheduled for removal is the wrong place
    // for a security control. before_send is the supported hook and runs on the same path.
    before_send: (event) => {
      if (event?.properties) sanitizeAnalyticsProperties(event.properties);
      return event;
    },
    loaded: (ph) => {
      // Release + deployment metadata as SESSION super properties (registered once, carried on
      // every event automatically) — never threaded manually into individual track() calls.
      registerAnalyticsContext(ph);
    },
  });

  // Sync any previously-saved opt-out choice (Settings -> Privacy) before anything captures.
  if (isAnalyticsOptedOut()) posthog.opt_out_capturing();
  initialized = true;

  // Replay events queued by track() while this import was in flight, in the order they fired.
  readyCallbacks.splice(0).forEach((cb) => cb());
}

/** Internal accessor for the rest of analytics/ — returns null when analytics isn't configured
 *  or hasn't initialized, so every call site stays a safe no-op rather than needing its own guard. */
export function getPosthog(): PostHog | null {
  return initialized ? posthog : null;
}
