export const RECOGNITION_OUTCOME_KINDS = ['PASS', 'NEEDS_CORRECTION', 'NOT_SCORABLE'] as const;

export type RecognitionOutcomeKind = (typeof RECOGNITION_OUTCOME_KINDS)[number];

/** Environmental reasons that prevent a reliable learner assessment. */
export type RecognitionReason =
  | 'MISSING_REQUIRED_HAND'
  | 'FRAME_CLIPPED'
  | 'INSUFFICIENT_TEMPORAL_SAMPLES'
  | 'TRACKING_UNSTABLE'
  | 'CAMERA_RESTARTED'
  | 'CAMERA_STALLED';

/** The minimum normalized evidence needed to turn a verifier result into learner feedback. */
export interface RecognitionOutcomeInput {
  recognitionPassed: boolean;
  scorable: boolean;
  reasons: readonly RecognitionReason[];
}

/**
 * A learner-facing recognition decision. NOT_SCORABLE deliberately contains only evidence reasons:
 * it does not decide score, progress, lives, or any other game consequence.
 */
export interface RecognitionOutcome {
  kind: RecognitionOutcomeKind;
  reasons: readonly RecognitionReason[];
}

/**
 * Separates an unobservable camera/track condition from a sign correction before game code
 * considers rewards or progression.
 */
export function decideRecognitionOutcome(input: RecognitionOutcomeInput): RecognitionOutcome {
  if (!input.scorable) {
    return { kind: 'NOT_SCORABLE', reasons: [...input.reasons] };
  }

  return input.recognitionPassed
    ? { kind: 'PASS', reasons: [] }
    : { kind: 'NEEDS_CORRECTION', reasons: [] };
}
