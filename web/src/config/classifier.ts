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
 * Verbose classifier logging during testing. Logs every gate decision (prompt, top-k, pass/veto)
 * and stashes the last vote on window.__lastVote for manual inspection. Tied to Vite's DEV flag
 * so it's automatically off in production builds (`npm run build`/`npm run preview`) — no manual
 * toggle to remember before release.
 */
export const CLASSIFIER_DEBUG = import.meta.env.DEV;

/** How many top predictions to surface for debugging. */
export const TOP_K = 3;
