import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { track, trackFirstSignSuccess } from '@/analytics';
import { logAttempt, type TrainingDataSource } from '@/hooks/useProgressSync';
import type { AttemptRecord } from '@/hooks/useRecognition';
import type { AttemptSource } from '@/analytics/types';

/**
 * Records what happened on one prompted sign, for every screen that runs the recognition loop.
 *
 * Callers say only *what* occurred; where it goes is this module's business. Before this existed,
 * all six signing screens each hand-wrote the same ~30-line block — fire a `sign_attempt` event,
 * bail out for guests, then map AttemptRecord field-by-field onto the Supabase payload — so adding
 * one field to AttemptRecord meant editing six files, and the six copies had already drifted.
 */
export interface AttemptLog {
  /**
   * The recognition loop reached a verdict on this sign (rule-pass, or rule-pass overturned by the
   * classifier's veto). Pass the record exactly as useRecognition's onAttempt supplied it.
   */
  recordAttempt: (attempt: AttemptRecord) => void;
}

interface Options {
  source: AttemptSource;
  /**
   * The world these signs belong to, when the screen draws from exactly one. Practice, Speed and
   * multiplayer deliberately mix signs across worlds, so they omit it and the field logs as null.
   */
  worldId?: string | null;
}

/**
 * Which sources also persist to Supabase. Multiplayer maps to null deliberately: Duel and Room
 * have always been analytics-only — a documented scope limit on the landmark-training pipeline,
 * not an oversight — and `sign_attempts.source` is commented for these four values only. Being a
 * total Record (not a partial lookup) means adding a source to AttemptSource fails to compile
 * until someone decides whether it persists, rather than silently defaulting to "no".
 */
const PERSISTED_SOURCES: Record<AttemptSource, TrainingDataSource | null> = {
  lesson: 'lesson',
  practice: 'practice',
  story: 'story',
  speed: 'speed',
  duel: null,
  room: null,
};

/** The Supabase source a screen's attempts persist under, or null when it is analytics-only.
 *  Exported as a pure function so the routing policy is testable without rendering React. */
export function trainingSourceFor(source: AttemptSource): TrainingDataSource | null {
  return PERSISTED_SOURCES[source];
}

export function useAttemptLog({ source, worldId = null }: Options): AttemptLog {
  const { user } = useAuth();
  const persistedSource = trainingSourceFor(source);

  // Analytics covers guests too — the activation funnel needs anonymous data. Supabase persistence
  // below stays user-gated: those rows are tied to an account, unlike PostHog's anonymous-until-
  // identify model.
  const record = useCallback(
    (attempt: AttemptRecord) => {
      track('sign_attempt', {
        sign_id: attempt.signId,
        world_id: worldId,
        source,
        rule_passed: attempt.rulePassed,
        ai_vetoed: attempt.aiVetoed,
        final_passed: attempt.finalPassed,
        outcome: attempt.outcome,
        ai_prediction: attempt.aiPrediction,
        ai_confidence: attempt.aiConfidence,
        duration_ms: attempt.durationMs,
        attempt_number: attempt.attemptNumber,
        quality_metrics: attempt.quality,
      });
      // Activation. Fires at most once per browser ever — trackFirstSignSuccess owns that guard —
      // so calling it on every pass from every surface is both safe and the only way the metric
      // stays correct: a guest's first success is as likely to happen in Practice or Story as in a
      // lesson. It lives here rather than in the pages because two hand-written copies had already
      // diverged (Lesson and Practice had it; Story, Speed and multiplayer silently did not).
      // Deliberately before the `!user` return: guests are the population this metric exists for.
      if (attempt.finalPassed) {
        trackFirstSignSuccess({
          signId: attempt.signId,
          msSinceLessonStart: attempt.durationMs,
          attemptsTaken: attempt.attemptNumber,
        });
      }
      if (attempt.outcome === 'NOT_SCORABLE' || !user || !persistedSource) return;
      void logAttempt({
        userId: user.id,
        signId: attempt.signId,
        rulePassed: attempt.rulePassed,
        aiPrediction: attempt.aiPrediction,
        aiConfidence: attempt.aiConfidence,
        aiVetoed: attempt.aiVetoed,
        finalPassed: attempt.finalPassed,
        outcome: attempt.outcome,
        quality: attempt.quality,
        source: persistedSource,
        frames: attempt.frames,
      });
    },
    [user, worldId, source, persistedSource]
  );

  return useMemo(() => ({ recordAttempt: record }), [record]);
}
