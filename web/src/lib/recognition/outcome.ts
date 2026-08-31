export const RECOGNITION_OUTCOME_KINDS = ['PASS', 'NEEDS_CORRECTION', 'NOT_SCORABLE'] as const;

export type RecognitionOutcomeKind = (typeof RECOGNITION_OUTCOME_KINDS)[number];

/** The explicit moment that closed an attempt. Keep this shared with analytics. */
export const ATTEMPT_TRIGGERS = [
  'recognition_pass',
  'classifier_veto',
  'skip',
  'timeout',
  'camera_interruption',
] as const;

export type AttemptTrigger = (typeof ATTEMPT_TRIGGERS)[number];

/** Environmental reasons that prevent a reliable learner assessment. */
export type RecognitionReason =
  | 'CAMERA_UNAVAILABLE'
  | 'MISSING_REQUIRED_POSE'
  | 'MISSING_REQUIRED_FACE'
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
  primaryReason: RecognitionReason | null;
}

/**
 * Separates an unobservable camera/track condition from a sign correction before game code
 * considers rewards or progression.
 */
export function decideRecognitionOutcome(input: RecognitionOutcomeInput): RecognitionOutcome {
  if (!input.scorable) {
    const reasons = [...input.reasons];
    return { kind: 'NOT_SCORABLE', reasons, primaryReason: reasons[0] ?? 'CAMERA_UNAVAILABLE' };
  }

  return input.recognitionPassed
    ? { kind: 'PASS', reasons: [], primaryReason: null }
    : { kind: 'NEEDS_CORRECTION', reasons: [], primaryReason: null };
}

/** Explicit camera interruptions are neutral: there is no learner evidence to score. */
export function decideAttemptBoundaryOutcome(reason: Extract<RecognitionReason, 'CAMERA_UNAVAILABLE' | 'CAMERA_STALLED' | 'CAMERA_RESTARTED'> = 'CAMERA_UNAVAILABLE'): RecognitionOutcome {
  return { kind: 'NOT_SCORABLE', reasons: [reason], primaryReason: reason };
}
