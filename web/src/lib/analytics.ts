// Thin wrapper around posthog-js. Deliberately conservative given the app's existing privacy
// promises ("your video never leaves your device" — CameraOnboarding.tsx, PrivacyPage.tsx):
// no autocapture (would risk scraping sign-in/username form inputs) and no session recording
// (would record the webcam <video>/<canvas>, reading exactly like a broken promise even though
// no raw camera bytes would actually leave the device).
import posthog from 'posthog-js';

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com';

let ready = false;

/** No-ops if VITE_POSTHOG_KEY isn't set (e.g. local dev) — safe to call unconditionally. */
export function initAnalytics(): void {
  if (ready || !KEY) return;
  ready = true;
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: 'identified_only',
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
  });
}

/** Ties events to the signed-in Supabase account. Always the UUID — never email/username,
 *  which are reachable from the same session object but must never leave the device via analytics. */
export function identifyUser(userId: string): void {
  if (!ready) return;
  posthog.identify(userId);
}

export function resetAnalytics(): void {
  if (!ready) return;
  posthog.reset();
}

export function trackScreen(screen: string): void {
  if (!ready) return;
  posthog.capture('$pageview', { screen });
}
