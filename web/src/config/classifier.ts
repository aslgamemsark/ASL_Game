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
 * `GATE_ENFORCED`. Turned off 2026-07-30, back on 2026-08-04 to resume shadow-mode measurement,
 * then back OFF again 2026-08-30: `vite.config.ts`'s `stripDevOnlyPublicAssets` plugin still
 * deleted `dist/models/signs` post-build (its own comment says as much — it was never updated
 * when this flag flipped on), so every production camera-screen load fetched `MODEL_URL`/
 * `CLASSES_URL` into a 404, `useClassifier` failed open into `status: 'error'`, and shadow-mode
 * had been recording nothing since 08-04. Un-deleting the weights was the other option, but
 * model_v4 is already known out-of-distribution (see `GATE_ENFORCED` below) — shipping it now
 * would spend ~421 KB per camera user measuring a model nobody intends to trust yet. Flip this
 * back on together with a retrained model, not on its own.
 *
 * Cost, paid only by users who open a camera screen (Lesson/Practice/Story call `useClassifier`;
 * `App.tsx` does not warm it up app-wide — do not reintroduce that): ~272 KB gzip TF.js + ~428 KB
 * of weights, plus a WebGL/WASM init. `GATE_ENFORCED` below stays false, so this only ever bought
 * measurement — no user could be blocked by a vote while it's false.
 *
 * Setting this false makes `useClassifier`'s `loadOnce()` return the same `{classifier: null,
 * status: 'disabled'}` shape used for "no model deployed" — every existing consumer (recognition
 * gating, `ClassifierDevPanel`) already handles that shape correctly.
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
 * STAYS FALSE as of 2026-08-04, even though `CLASSIFIER_LOAD_ENABLED` above is back on. The two
 * flags are a sequence, not a pair flipped together: load first, measure, then enforce. With this
 * false, the classifier runs inference on every camera-screen attempt and every vote is recorded
 * to `sign_attempts` (ai_prediction / ai_confidence / ai_vetoed), but cannot reject a rule-pass —
 * measurement without the user-facing harm.
 *
 * ORIGINAL FAILURE (set to false 2026-07-27): production data proved the veto was rejecting
 * correct signs — HELLO 240 attempts, rule verifier passed 231 (96.3%), users saw 61 pass (25.4%).
 * All 170 losses were vetoes, and the model was CONFIDENTLY wrong, not uncertain: it called a
 * correct HELLO "NO_SIGN" @ 0.872 avg confidence and "HOSPITAL" @ 0.938 (max 0.967).
 *
 * MECHANISM FOUND (2026-08-04): a 30-day PostHog sample of every production veto showed 108 of
 * 124 (87%) were `NO_SIGN` — the model claiming no sign happened, about attempts the rule
 * verifier had just cleared. `NO_SIGN` is an absence class, not a competing sign; the gate had no
 * business vetoing on it at all. Fixed at the source in `gatePass` (`engine/gate.ts`) — `NO_SIGN`
 * can no longer produce a veto, only `gateHint`'s additive coaching message. This was a category
 * error, not a confidence problem: the false NO_SIGN vetoes measured HIGHER (0.82-0.93) than
 * genuine sign-vs-sign vetoes (as low as 0.72), so no `GATE_CONFIDENCE` value could have fixed it
 * — raising the threshold would have removed correct vetoes before wrong ones.
 *
 * This does NOT mean the model is now trustworthy — only that its worst, most common failure mode
 * is structurally impossible. It is still out-of-distribution on live webcam input (model_v4 was
 * trained on ASL Citizen / WLASL studio video, 85% there) for genuine sign-vs-sign confusions.
 *
 * BEFORE FLIPPING THIS BACK TO TRUE, all four must hold:
 *   1. Veto precision >= 95% on fresh shadow-mode data (post-NO_SIGN-fix) — of attempts where
 *      ai_vetoed = true, at least 95% must be confirmed genuinely wrong signs, not assumed.
 *   2. >= 200 vetoes across >= 20 distinct users in that sample, excluding Pakistan traffic
 *      (friends/family test accounts, not the real US/CA market) and any day spanning a bundle
 *      change (a stale cached bundle produces false signal — see docs/WORKLOG.md 2026-07-26).
 *   3. Live-pipeline preprocessing verified identical to training preprocessing, if any residual
 *      high-confidence wrong-sign vetoes remain.
 *   4. Re-enabled PER SIGN via GATE_EXCLUDED_SIGNS, never globally in one step.
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
