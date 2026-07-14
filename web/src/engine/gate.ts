/**
 * Disambiguation gate — combines the rule verifier's pass with the ML classifier's vote.
 *
 * Design invariant: the rule verifier remains authoritative for the per-parameter Sign Coach.
 * The classifier NEVER overrides a rule failure into a pass; it can only ADD a veto (reject a
 * rule-pass when the model is confident the user signed something else) and an optional hint.
 * When the classifier is disabled (no model loaded), behavior is exactly today's: rules alone.
 */

export interface ClassifierVote {
  /** Highest-probability sign id. */
  topSign: string;
  /** Probability of topSign, 0..1. */
  confidence: number;
  /** Probability per sign id (only the game vocabulary needs to be present). */
  perSign: Record<string, number>;
}

/** Full record of one gate decision — emitted to onVote for logging/debug overlays. */
export interface GateDecision {
  /** The sign the user was asked to make. */
  prompted: string;
  /** The classifier's raw vote (null if it produced nothing for this window). */
  vote: ClassifierVote | null;
  /** Whether the rule-pass survived the gate. */
  decision: 'pass' | 'veto';
  /** Top predictions, highest first. */
  topK: { sign: string; prob: number }[];
  /** Coaching hint when the model confidently saw a different sign. */
  hint: string | null;
}

/**
 * Final pass decision — a VETO gate, not a confirmation gate.
 *
 * The rule verifier is authoritative. The classifier can only REJECT a rule-pass, and only
 * when it is confident (>= `vetoConfidence`) that the user actually signed a DIFFERENT sign.
 * It NEVER vetoes on uncertainty: a correct sign the model is merely unsure about still passes.
 *
 * This is deliberately safe for an imperfect model — a 66%-accurate classifier would wrongly
 * reject correct attempts if we instead demanded it CONFIRM the prompted sign. Veto-only means
 * the worst case is "missed a confusor" (rules alone, i.e. today's behavior), never "rejected a
 * correct sign the user actually made".
 */
export function gatePass(
  rulePassed: boolean,
  vote: ClassifierVote | null,
  promptedSign: string,
  vetoConfidence = 0.7
): boolean {
  if (!rulePassed) return false; // rules authoritative for failure
  if (!vote) return true; // classifier disabled -> rules alone (unchanged behavior)
  // Veto only on confident disagreement.
  if (vote.topSign !== promptedSign && vote.confidence >= vetoConfidence) return false;
  return true;
}

/**
 * Additive coaching hint shown next to (never replacing) the Sign Coach checklist. Returns a
 * message only when the model is confidently pointing at a DIFFERENT sign than the prompt.
 */
export function gateHint(
  vote: ClassifierVote | null,
  promptedSign: string,
  hintConfidence = 0.6
): string | null {
  if (!vote) return null;
  if (vote.topSign !== promptedSign && vote.confidence >= hintConfidence) {
    if (vote.topSign === 'NO_SIGN') {
      return "That didn't look like a sign at all — check the reference.";
    }
    return `That looked more like ${vote.topSign.replace(/_/g, ' ')} — check the reference.`;
  }
  return null;
}
