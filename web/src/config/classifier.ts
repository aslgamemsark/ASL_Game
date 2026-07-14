/**
 * Configuration for the optional ML disambiguation layer.
 *
 * Nothing here activates until a trained TF.js model is actually present at MODEL_URL AND
 * @tensorflow/tfjs is installed. Until then the app runs on the rule verifier alone — exactly
 * as it does today. To enable after a Kaggle run (Phase C):
 *   1. npm i @tensorflow/tfjs
 *   2. drop the export into  web/public/models/signs/  (model.json + *.bin + classes.json)
 */

/** URL to the TF.js model graph (served from web/public). */
export const MODEL_URL = '/models/signs/model.json';

/** URL to the class-order JSON (array of sign ids matching the model's output logits). */
export const CLASSES_URL = '/models/signs/classes.json';

/**
 * Veto threshold: a rule-pass is rejected ONLY when the model is at least this confident that
 * the user signed a DIFFERENT sign. Higher = more conservative (fewer vetoes). Tuned high
 * because model_v1 is ~66% — we only want to catch confident mismatches, never second-guess a
 * correct sign the model is unsure about.
 */
export const GATE_CONFIDENCE = 0.7;

/**
 * Verbose classifier logging + the on-screen ClassifierDevPanel, during testing. Logs every gate
 * decision (prompt, top-k, pass/veto) and stashes the last vote on window.__lastVote.
 *
 * A RUNTIME check, not a build-time `import.meta.env.DEV` constant: the classifier itself only
 * loads under `vite build` + `vite preview` (see MODEL_URL/CLASSES_URL fetch in useClassifier.ts —
 * `npm run dev` doesn't serve the model correctly), which is exactly the mode where DEV is FALSE.
 * A DEV-only gate meant the debug panel could never be visible at the same time the classifier
 * was actually loaded — found 2026-07-14 while trying to test the AI veto layer via
 * `npm run preview`. Default (no opt-in) still behaves like DEV-only: on under `vite dev`, off in
 * a plain production build/deploy. Opt in during a preview/production build with either
 * `?debug=1` in the URL or `localStorage.setItem('quicksign_debug', '1')` in the console.
 */
export function isClassifierDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1'
      || window.localStorage.getItem('quicksign_debug') === '1';
  } catch {
    return false;
  }
}

/** How many top predictions to surface for debugging. */
export const TOP_K = 3;

/**
 * Signs excluded from the AI gate even though the model was technically trained on them —
 * because that training data is too thin to trust (see README "Results"). EMERGENCY has only
 * 5-7 total clips across ASL Citizen + WLASL (ASL Citizen has none at all; WLASL has 7 total
 * instances). A class trained on that few examples doesn't generalize — it memorizes those
 * specific signers — so it must never be allowed to veto a real user's correct attempt. Treated
 * identically to signs the model was never trained on at all (see useRecognition.ts's
 * knownSigns check). Remove an entry here once its class has enough real data to trust
 * (e.g. after tools/export_supabase_samples.py has collected enough EMERGENCY attempts).
 */
export const GATE_EXCLUDED_SIGNS = new Set<string>(['EMERGENCY']);
