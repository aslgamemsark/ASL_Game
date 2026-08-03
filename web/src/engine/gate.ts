/**
 * Disambiguation gate — combines the rule verifier's pass with the ML classifier's vote.
 *
 * Design invariant: the rule verifier remains authoritative for the per-parameter Sign Coach.
 * The classifier NEVER overrides a rule failure into a pass; it can only ADD a veto (reject a
 * rule-pass when the model is confident the user signed something else) and an optional hint.
 * When the classifier is disabled (no model loaded), behavior is exactly today's: rules alone.
 *
 * Enforcement is currently OFF (shadow mode) — the model votes and every vote is recorded, but it
 * cannot reject a learner. See GATE_ENFORCED in config/classifier.ts.
 */
import { GATE_ENFORCED } from '@/config/classifier';

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
  /** What the MODEL wanted, independent of whether enforcement is on. In shadow mode this can
   *  read 'veto' while the learner still passed — read `enforced` to tell the two apart. */
  decision: 'pass' | 'veto';
  /** False in shadow mode: `decision` was recorded but not applied to the learner's result. */
  enforced: boolean;
  /** Top predictions, highest first. */
  topK: { sign: string; prob: number }[];
  /** Coaching hint when the model confidently saw a different sign. */
  hint: string | null;
}

/**
 * The MODEL'S OPINION of a rule-pass — a VETO gate, not a confirmation gate. This is not the
 * learner's result; call `gateOutcome` for that.
 *
 * The rule verifier is authoritative. The classifier can only REJECT a rule-pass, and only
 * when it is confident (>= `vetoConfidence`) that the user actually signed a DIFFERENT, NAMED
 * sign. It NEVER vetoes on uncertainty: a correct sign the model is merely unsure about still
 * passes. It also never vetoes on `NO_SIGN` — see the mechanism note below.
 *
 * CORRECTION (2026-07-27): this function's comment previously claimed the worst case was "missed
 * a confusor... never rejected a correct sign the user actually made". Production data disproved
 * that. The claim assumed the model's errors would be LOW-confidence; on live webcam input they
 * are high-confidence, so veto-only did reject correct signs — 170 of 240 correct HELLO attempts.
 * Being a veto rather than a confirmation gate bounds the damage only when the model is calibrated.
 * See GATE_ENFORCED in config/classifier.ts for the full evidence and the re-enable criteria.
 *
 * MECHANISM FIX (2026-08-04): 87% of every production veto (108 of 124, 30-day PostHog sample)
 * was the model voting `NO_SIGN` — "you didn't sign anything" — about an attempt the rule
 * verifier had just cleared on every required parameter. `NO_SIGN` is an ABSENCE class, not a
 * confusable sign: this gate exists to disambiguate "did you sign X or the similar-looking Y",
 * a question that presupposes a sign happened. Whether one happened at all is exactly what the
 * rule verifier already answered, with a stronger, more specific signal (per-parameter geometry)
 * than a single softmax score. Letting the classifier re-litigate that question is a category
 * error, not a confidence-threshold problem — no `vetoConfidence` value fixes it, since these
 * false vetoes measured HIGHER (0.82-0.93) than genuine sign-vs-sign vetoes (as low as 0.72).
 * `NO_SIGN` can still drive `gateHint`'s coaching message below — that's additive and never
 * blocks a learner, unlike a veto.
 */
export function gatePass(
  rulePassed: boolean,
  vote: ClassifierVote | null,
  promptedSign: string,
  vetoConfidence = 0.7
): boolean {
  if (!rulePassed) return false; // rules authoritative for failure
  if (!vote) return true; // classifier disabled -> rules alone (unchanged behavior)
  if (vote.topSign === 'NO_SIGN') return true; // absence is not a competing sign — never a veto
  // Veto only on confident disagreement with a NAMED sign.
  if (vote.topSign !== promptedSign && vote.confidence >= vetoConfidence) return false;
  return true;
}

/** What the learner actually experiences, plus what the model wanted — from one call. */
export interface GateOutcome {
  /** The learner's result. With enforcement off this is the rule verdict alone. */
  passed: boolean;
  /** Whether the model wanted to reject this rule-pass. Recorded to `sign_attempts.ai_vetoed`
   *  even in shadow mode, so veto precision can be measured on production traffic before the
   *  model is trusted to block anyone again. False whenever the rules already failed — a rule
   *  failure is not a veto. */
  modelVetoed: boolean;
}

/**
 * Resolve one attempt into the learner's result and the model's opinion.
 *
 * Callers must use this rather than `gatePass` directly: it owns the enforcement policy, so the
 * "is the veto live?" decision exists in exactly one place and a second call site cannot drift
 * out of sync with the first.
 *
 * `enforced` is injectable purely so tests can drive both branches without module mocking;
 * production callers pass three arguments and get the configured behavior.
 */
export function gateOutcome(
  rulePassed: boolean,
  vote: ClassifierVote | null,
  promptedSign: string,
  vetoConfidence = 0.7,
  enforced: boolean = GATE_ENFORCED
): GateOutcome {
  const survivesModel = gatePass(rulePassed, vote, promptedSign, vetoConfidence);
  return {
    passed: enforced ? survivesModel : rulePassed,
    modelVetoed: rulePassed && !survivesModel,
  };
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
