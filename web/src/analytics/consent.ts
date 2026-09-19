// Analytics opt-out state. Separate from the app's existing AI-training-data consent
// (contexts/AuthContext.tsx's needsTrainingConsent/collectTrainingData) — that governs whether
// hand-landmark coordinates are saved to Supabase for model training; this governs whether
// anonymous PRODUCT USAGE events go to PostHog. Different data, different purpose, so a separate
// toggle (Settings → Privacy) rather than overloading one flag for two different consents.

const OPT_OUT_KEY = 'quicksign_analytics_opt_out';

/** DNT or the Settings privacy toggle disables analytics. Storage failure retains the existing
 *  default; the live SDK also applies the current session's opt-out independently. */
export function isAnalyticsOptedOut(): boolean {
  if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') return true;
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
