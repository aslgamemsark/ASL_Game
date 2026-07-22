import posthog, { type PostHog } from 'posthog-js';
import { isAnalyticsOptedOut } from './consent';

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

/**
 * Strips any query string off $current_url/$referrer/$referring_domain before PostHog ingests
 * the event — belt-and-suspenders alongside capture_pageview:false, in case a query string (e.g.
 * a password-reset or magic-link token) ever leaks into one of these via autocapture-adjacent
 * paths. Exported standalone (not inlined in the init config) so it's unit-testable without
 * spinning up a real PostHog instance.
 */
export function sanitizeAnalyticsProperties(properties: Record<string, unknown>): Record<string, unknown> {
  for (const key of ['$current_url', '$referrer', '$referring_domain'] as const) {
    const value = properties[key];
    if (typeof value === 'string' && value.includes('?')) {
      properties[key] = value.split('?')[0];
    }
  }
  return properties;
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
 *   - NO autocapture (every event is a deliberate, typed `track()` call — see capture.ts).
 *   - NO automatic $pageview capture — this is a screen-state-machine SPA, not route-based; App.tsx
 *     sends one `screen_viewed` per screen change instead (see useScreenView.ts).
 *   - person_profiles: 'identified_only' — anonymous users generate events but not a Person
 *     profile until they actually sign in (identifyUser in capture.ts).
 *   - respect_dnt — a browser's Do Not Track signal disables capture outright.
 *   - Web Vitals ARE captured (capture_performance) — that's product-quality telemetry, not
 *     behavioral tracking, and carries no PII.
 */
export function initAnalytics(): void {
  if (initialized || !analyticsConfigured || !KEY) return;
  initialized = true;

  posthog.init(KEY, {
    api_host: HOST,
    disable_session_recording: false,
    // Record the session but never the text users type — passwords, emails, usernames and any
    // message content are masked; only the UI structure, navigation and clicks are captured.
    session_recording: { maskAllInputs: true },
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    person_profiles: 'identified_only',
    respect_dnt: true,
    capture_performance: { web_vitals: true },
    sanitize_properties: sanitizeAnalyticsProperties,
    loaded: (ph) => {
      // Release + deployment metadata as SESSION super properties (registered once, carried on
      // every event automatically) — never threaded manually into individual track() calls.
      ph.register({
        app_version: __APP_VERSION__,
        git_commit: __GIT_COMMIT__,
        deployment_environment: __DEPLOY_ENV__,
        build_timestamp: __BUILD_TIMESTAMP__,
      });
      // beta_cohort is a PostHog Group (not a person property) — every user in this launch is a
      // member, which is what lets a future post-beta cohort be compared against this one later.
      ph.group('beta_cohort', 'reddit-beta-2026');
    },
  });

  // Sync any previously-saved opt-out choice (Settings -> Privacy) before anything captures.
  if (isAnalyticsOptedOut()) posthog.opt_out_capturing();
}

/** Internal accessor for the rest of analytics/ — returns null when analytics isn't configured
 *  or hasn't initialized, so every call site stays a safe no-op rather than needing its own guard. */
export function getPosthog(): PostHog | null {
  return initialized ? posthog : null;
}
