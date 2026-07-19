// Analytics opt-out state. Separate from the app's existing AI-training-data consent
// (contexts/AuthContext.tsx's needsTrainingConsent/collectTrainingData) — that governs whether
// hand-landmark coordinates are saved to Supabase for model training; this governs whether
// anonymous PRODUCT USAGE events go to PostHog. Different data, different purpose, so a separate
// toggle (Settings → Privacy) rather than overloading one flag for two different consents.

const OPT_OUT_KEY = 'quicksign_analytics_opt_out';

/** True if the user has explicitly opted out of analytics (Settings → Privacy toggle). Capture
 *  defaults to ON (anonymous, no session replay) per the project's locked privacy posture — this
 *  is the one flag that turns it off. Wrapped in try/catch: a storage-blocked context (private
 *  browsing, strict cookie settings) must fail closed to "not opted out is unreadable -> treat as
 *  default (capture)" rather than throw and break the app. */
export function isAnalyticsOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAnalyticsOptedOut(optedOut: boolean): void {
  try {
    localStorage.setItem(OPT_OUT_KEY, optedOut ? 'true' : 'false');
  } catch {
    /* storage blocked — the in-memory PostHog opt state below still applies for this session */
  }
}
