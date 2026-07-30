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
 * Master switch for LOADING the classifier at all — separate from, and upstream of,
 * `GATE_ENFORCED`. While `GATE_ENFORCED` was already false (shadow mode), every returning user
 * was still downloading the full model (~272 KB gzip TF.js + ~428 KB of weights) and paying a
 * WebGL/WASM init on the camera critical path, purely to log shadow-mode votes for a veto that
 * could not affect them. Product decision 2026-07-30: stop paying that cost for everyone.
 *
 * Setting this false makes `useClassifier`'s `loadOnce()` return the same `{classifier: null,
 * status: 'disabled'}` shape used for "no model deployed" — every existing consumer (recognition
 * gating, `ClassifierDevPanel`) already handles that shape correctly, so nothing downstream needed
 * to change. Shadow-mode vote collection (`ai_prediction`/`ai_confidence`/`ai_vetoed` on
 * `sign_attempts`) stops while this is false; the 808 `training_samples` + 442
 * `sign_verification_log` rows already collected remain the basis for any future retrain.
 *
 * Flip back to true only as a deliberate decision to resume shadow-mode measurement (e.g. to
 * validate a retrained model before considering `GATE_ENFORCED` again) — not as a quick undo.
 */
export const CLASSIFIER_LOAD_ENABLED = false;

/**
 * Veto threshold: a rule-pass is rejected ONLY when the model is at least this confident that
 * the user signed a DIFFERENT sign. Higher = more conservative (fewer vetoes). Tuned high
 * because model_v1 is ~66% — we only want to catch confident mismatches, never second-guess a
 * correct sign the model is unsure about.
 *
 * NOTE: this threshold is inert while GATE_ENFORCED is false. Do not tune it as a fix — see below.
 */
export const GATE_CONFIDENCE = 0.7;

/**
 * Master switch for veto ENFORCEMENT ("shadow mode" when false).
 *
 * When false the classifier still loads, still runs inference on every attempt, and every vote is
 * still recorded to `sign_attempts` (ai_prediction / ai_confidence / ai_vetoed) — it simply cannot
 * reject a rule-pass. That keeps the measurement while removing the user-facing harm.
 *
 * Set to FALSE on 2026-07-27 because production data proved the veto was rejecting correct signs:
 *   HELLO — 240 attempts, rule verifier passed 231 (96.3%), users saw 61 pass (25.4%).
 *   All 170 losses were vetoes. The model was CONFIDENTLY wrong, not uncertain:
 *   it called a correct HELLO "NO_SIGN" @ 0.872 avg confidence and "HOSPITAL" @ 0.938 (max 0.967).
 *   One user attempted HELLO 73 times. YOU 28.9%, MEDICINE 16.0%, WANT 33.3% — same mechanism.
 *
 * This is out-of-distribution failure: model_v4 was trained on ASL Citizen / WLASL studio video
 * and scored 85% there, but runs on live webcam landmarks. Raising GATE_CONFIDENCE cannot fix it
 * (the bad predictions sit above any usable threshold) and would be exactly the kind of
 * threshold-tuning band-aid .claude/rules/fixes.md prohibits.
 *
 * BEFORE FLIPPING THIS BACK TO TRUE, all three must hold:
 *   1. Live-pipeline preprocessing verified identical to training preprocessing (the "NO_SIGN
 *      @ 0.87 on a correct sign" signature points at a temporal-window/feature mismatch).
 *   2. Measured veto precision from shadow-mode production data is high — i.e. attempts where
 *      ai_vetoed = true were genuinely wrong signs, not correct ones.
 *   3. Re-enabled PER SIGN via GATE_EXCLUDED_SIGNS, never globally in one step.
 */
export const GATE_ENFORCED = false;

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
