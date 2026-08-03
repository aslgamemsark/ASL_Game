import { track } from './capture';
import type { SignAttemptBase } from './types';

/** The recognition loop's per-attempt outcome, as `useRecognition` reports it. Structurally the
 *  same shape as `AttemptRecord`, restated here so the analytics module does not depend on a hook —
 *  it is consumed by tools and tests that never mount React. */
export interface AttemptOutcome {
  signId: string;
  rulePassed: boolean;
  aiVetoed: boolean;
  finalPassed: boolean;
  aiPrediction: string | null;
  aiConfidence: number | null;
  durationMs: number;
  attemptNumber: number;
}

/**
 * Report one recognition attempt from whichever screen produced it.
 *
 * Every surface that runs the recognition loop needs to send the identical eight-field payload and
 * differs only in `source` and `world_id`. Before this existed, all six built that payload by hand
 * (Lesson, Practice, Story, Speed, Duel, Room) — so adding a field to the event meant editing six
 * files, and missing one produced analytics that were silently incomplete for exactly one surface
 * rather than obviously broken everywhere. `source` is typed to the union in `SignAttemptBase`, so
 * a new screen cannot invent an unrecognised value.
 */
export function trackSignAttempt(
  attempt: AttemptOutcome,
  context: { source: SignAttemptBase['source']; worldId: string | null },
): void {
  track('sign_attempt', {
    sign_id: attempt.signId,
    world_id: context.worldId,
    source: context.source,
    rule_passed: attempt.rulePassed,
    ai_vetoed: attempt.aiVetoed,
    final_passed: attempt.finalPassed,
    ai_prediction: attempt.aiPrediction,
    ai_confidence: attempt.aiConfidence,
    duration_ms: attempt.durationMs,
    attempt_number: attempt.attemptNumber,
  });
}
