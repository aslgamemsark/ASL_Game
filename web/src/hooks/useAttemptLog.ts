import { useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { track, trackFirstSignSuccess } from '@/analytics';
import { logAttempt, type TrainingDataSource } from '@/hooks/useProgressSync';
import type { AttemptRecord } from '@/hooks/useRecognition';
import type { AttemptSource } from '@/analytics/types';
import { EVIDENCE_SCHEMA_VERSION, RECOGNITION_VERSION } from '@/lib/recognition/provenance';

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
   * The recognition loop reached an explicit boundary. Pass the record exactly as
   * useRecognition's onAttempt supplied it.
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

/** Unscorable attempts stay in aggregate analytics but never enter learning/training storage. */
export function shouldPersistAttempt(outcome: AttemptRecord['outcome'], hasUser: boolean, source: AttemptSource): boolean {
  return outcome !== 'NOT_SCORABLE' && hasUser && trainingSourceFor(source) !== null;
}

export function useAttemptLog({ source, worldId = null }: Options): AttemptLog {
  const { user } = useAuth();
  const persistedSource = trainingSourceFor(source);
  // Set once, when this recognition screen mounts — a proxy for "session/lesson start" close
  // enough for every current caller (each of Lesson/Practice/Story/Speed instantiates its own
  // useAttemptLog exactly once per screen visit). Was previously attempt.durationMs, i.e. the
  // WINNING ATTEMPT'S OWN duration (how long the user held/repeated that one sign — resets every
  // sign, see useRecognition.ts's loopStartRef) — a real, different quantity mislabelled as this
  // one, silently deflating every first_sign_success.ms_since_lesson_start to a few hundred/
  // thousand ms regardless of how long the actual session took to get there (found 2026-08-30).
  const mountedAtRef = useRef(Date.now());

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
        attempt_trigger: attempt.trigger,
        outcome: attempt.outcome,
        not_scorable_reason: attempt.outcome === 'NOT_SCORABLE' ? attempt.reasons[0] ?? null : null,
        ai_prediction: attempt.aiPrediction,
        ai_confidence: attempt.aiConfidence,
        duration_ms: attempt.durationMs,
        attempt_number: attempt.attemptNumber,
        evidence_schema_version: EVIDENCE_SCHEMA_VERSION,
        recognition_version: RECOGNITION_VERSION,
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
          msSinceLessonStart: Date.now() - mountedAtRef.current,
          attemptsTaken: attempt.attemptNumber,
        });
      }
      if (!shouldPersistAttempt(attempt.outcome, Boolean(user), source) || !user || !persistedSource) return;
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
        evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
        recognitionVersion: RECOGNITION_VERSION,
        source: persistedSource,
        frames: attempt.frames,
      });
    },
    [user, worldId, source, persistedSource]
  );

  return useMemo(() => ({ recordAttempt: record }), [record]);
}
