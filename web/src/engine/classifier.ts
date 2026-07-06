/**
 * ML disambiguation classifier (TF.js) — loader + inference, disabled-safe.
 *
 * There is no trained model committed yet (it comes from the Kaggle ASL Citizen run, Phase C.3).
 * Until a model URL is configured AND @tensorflow/tfjs is installed, this stays DISABLED and the
 * app behaves exactly as today (rule verifier only). When a model is dropped in, set the URL via
 * loadClassifier() and the gate (engine/gate.ts) starts using its votes.
 *
 * tfjs is imported through a guarded dynamic import so the app builds and runs WITHOUT the
 * dependency present — install it only when you actually wire a model in.
 */
import type { Frame } from './landmarks';
import { clipToSequence } from './sequenceFeatures';
import type { ClassifierVote } from './gate';

// Minimal structural type for the slice of tfjs we use (avoids a hard dependency/types).
interface TfLike {
  loadLayersModel: (url: string) => Promise<TfModel>;
  tensor: (data: number[][][]) => TfTensor;
}
interface TfModel {
  predict: (t: TfTensor) => TfTensor;
}
interface TfTensor {
  data: () => Promise<Float32Array>;
  dispose: () => void;
}

export interface SignClassifier {
  classify: (frames: Frame[]) => Promise<ClassifierVote | null>;
  readonly enabled: boolean;
  /** Signs this model was actually trained on (its softmax output classes). A sign outside this
   * set (e.g. fingerspelled letters, which no training dataset had enough of — see README) must
   * never be gated through this classifier: it would be forced to output a confident guess from
   * its known vocabulary for every attempt, which can veto a correct sign it was never trained
   * to recognize in the first place. */
  readonly knownSigns: ReadonlySet<string>;
}

const DISABLED: SignClassifier = {
  enabled: false,
  classify: async () => null,
  knownSigns: new Set(),
};

/**
 * Load a TF.js classifier. Returns a DISABLED classifier (never throws) if tfjs isn't
 * installed or the model can't be fetched, so callers can always use the result safely.
 *
 * @param modelUrl  URL to model.json (e.g. '/models/signs/model.json')
 * @param classes   sign-id order matching the model's output logits
 */
export async function loadClassifier(modelUrl: string, classes: string[]): Promise<SignClassifier> {
  let tf: TfLike;
  try {
    // Real dynamic import: Vite code-splits tfjs into its own async chunk that loads on
    // demand (kept out of the main bundle), and the browser can actually resolve it. The
    // try/catch still degrades gracefully if the chunk fails to fetch at runtime.
    tf = (await import('@tensorflow/tfjs')) as unknown as TfLike;
  } catch {
    console.warn('[classifier] @tensorflow/tfjs unavailable — disambiguation disabled.');
    return DISABLED;
  }

  let model: TfModel;
  try {
    model = await tf.loadLayersModel(modelUrl);
  } catch (e) {
    console.warn('[classifier] could not load model, disambiguation disabled:', e);
    return DISABLED;
  }

  const knownSigns = new Set(classes);

  return {
    enabled: true,
    knownSigns,
    classify: async (frames: Frame[]) => {
      const seq = clipToSequence(frames);
      if (!seq) return null;
      const input = tf.tensor([seq]); // (1, SEQ_LEN, FEAT_DIM)
      const out = model.predict(input);
      const probs = await out.data();
      input.dispose();
      out.dispose();

      const perSign: Record<string, number> = {};
      let topSign = classes[0] ?? '';
      let top = -1;
      for (let i = 0; i < classes.length; i++) {
        const p = probs[i] ?? 0;
        perSign[classes[i]] = p;
        if (p > top) {
          top = p;
          topSign = classes[i];
        }
      }
      return { topSign, confidence: top < 0 ? 0 : top, perSign };
    },
  };
}

export const disabledClassifier = DISABLED;

/** Top-k predictions from a vote, highest probability first — for debugging/overlays. */
export function topK(vote: ClassifierVote, k = 3): { sign: string; prob: number }[] {
  return Object.entries(vote.perSign)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([sign, prob]) => ({ sign, prob }));
}
