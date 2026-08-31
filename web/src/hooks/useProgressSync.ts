import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseReady } from '@/lib/supabase';
import { detectCountryCode } from '@/lib/geolocation';
import { useUserStore } from '@/stores/useUserStore';
import type { SignStats, SpeedHighScore, Chest } from '@/types/user';
import type { VerificationEntry } from '@/hooks/useRecognition';
import type { Frame } from '@/engine/landmarks';
import type { RecognitionOutcomeKind } from '@/lib/recognition/outcome';
import type { AttemptSource } from '@/analytics/types';

const DEBOUNCE_MS = 3000;

type ProgressRow = {
  xp: number; level: number; streak: number;
  last_practice_date: string | null;
  completed_lessons: string[];
  sign_accuracy: Record<string, SignStats>;
  gold: number;
  owned_cosmetics: string[];
  equipped_border: string | null;
  equipped_avatar: string | null;
  active_badge: string | null;
  showcase_badges: string[];
  unlocked_world_ids: string[];
  signs: number;
  rename_cards: number;
  badges: string[];
  pending_chests: Chest[];
  total_correct_signs: number;
  streak_freezes: number;
  streak_milestones_awarded: number[];
  speed_high_scores: Record<string, SpeedHighScore>;
  dominant_hand: 'left' | 'right' | null;
};

// Loads remote progress on sign-in and merges it with local state.
// Debounce-syncs every store change back to Supabase while logged in.
export function useProgressSync() {
  const { user } = useAuth();
  const store = useUserStore();
  const mergeProgress = useUserStore((s) => s.mergeProgress);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedUserRef = useRef<string | null>(null);
  // Surfaced to the UI (see App.tsx) so a failed sync isn't silently invisible to the user —
  // previously every Supabase call here ignored `error` entirely, so a dropped upsert looked
  // identical to a successful one (progress just quietly never showed up on another device).
  const [syncError, setSyncError] = useState(false);

  // On login: fetch remote progress and merge. Retries once on failure before giving up — a
  // transient failure here must not be treated as "no remote progress exists", since the
  // debounced upsert effect would then push default/stale local state over real remote progress.
  useEffect(() => {
    if (!supabaseReady || !user || syncedUserRef.current === user.id) return;
    const userId = user.id;

    const load = async (isRetry: boolean): Promise<void> => {
      const [{ data, error: progressError }, { data: profileRow, error: profileError }] = await Promise.all([
        supabase.from('user_progress').select('*').eq('user_id', userId).single(),
        supabase.from('profiles').select('collect_training_data, region').eq('id', userId).single(),
      ]);

      if (progressError) {
        console.error('Failed to load remote progress:', progressError);
        if (!isRetry) {
          setTimeout(() => void load(true), 2000);
          return;
        }
        setSyncError(true);
        syncedUserRef.current = userId;
        return;
      }
      if (profileError) console.error('Failed to load profile settings:', profileError);

      syncedUserRef.current = userId;
      setSyncError(false);

      if (data) {
        const row = data as unknown as ProgressRow;
        mergeProgress({
          xp: row.xp,
          level: row.level,
          streak: row.streak,
          lastPracticeDate: row.last_practice_date,
          completedLessons: row.completed_lessons,
          signAccuracy: row.sign_accuracy ?? {},
          gold: row.gold,
          ownedCosmetics: row.owned_cosmetics ?? [],
          equippedBorder: row.equipped_border,
          equippedAvatar: row.equipped_avatar,
          activeBadge: row.active_badge,
          showcaseBadges: row.showcase_badges ?? [],
          unlockedWorldIds: row.unlocked_world_ids ?? [],
          signs: row.signs,
          renameCards: row.rename_cards,
          badges: row.badges ?? [],
          pendingChests: row.pending_chests ?? [],
          totalCorrectSigns: row.total_correct_signs,
          streakFreezes: row.streak_freezes,
          streakMilestonesAwarded: row.streak_milestones_awarded ?? [],
          speedHighScores: row.speed_high_scores ?? {},
          dominantHand: row.dominant_hand ?? null,
        });
      }
      if (profileRow && typeof (profileRow as { collect_training_data?: boolean }).collect_training_data === 'boolean') {
        mergeProgress({ collectTrainingData: (profileRow as { collect_training_data: boolean }).collect_training_data });
      }

      // One-time best-effort region detection for the region leaderboard — fire-and-forget,
      // never blocks the sync path, and only runs when the profile doesn't have one yet.
      if (profileRow && !(profileRow as { region?: string | null }).region) {
        void detectCountryCode().then((code) => {
          if (!code) return;
          void supabase.from('profiles').update({ region: code }).eq('id', userId);
        });
      }
    };

    void load(false);
  }, [user, mergeProgress]);

  // Reset sync marker on sign-out so next login re-fetches.
  useEffect(() => {
    if (!user) {
      syncedUserRef.current = null;
      setSyncError(false);
    }
  }, [user]);

  // Debounced upsert on every store change. Retries once on failure, then surfaces `syncError`
  // so a dropped write isn't silently invisible — previously this never checked `{ error }` at
  // all, so a failed sync looked identical to a successful one from the user's point of view.
  useEffect(() => {
    if (!supabaseReady || !user) return;
    const userId = user.id;

    const buildPayload = () => ({
      user_id: userId,
      xp: store.xp,
      level: store.level,
      streak: store.streak,
      longest_streak: Math.max(store.streak, 0),
      last_practice_date: store.lastPracticeDate,
      completed_lessons: store.completedLessons,
      sign_accuracy: store.signAccuracy as unknown as Record<string, unknown>,
      gold: store.gold,
      owned_cosmetics: store.ownedCosmetics,
      equipped_border: store.equippedBorder,
      equipped_avatar: store.equippedAvatar,
      active_badge: store.activeBadge,
      showcase_badges: store.showcaseBadges,
      unlocked_world_ids: store.unlockedWorldIds,
      signs: store.signs,
      rename_cards: store.renameCards,
      badges: store.badges,
      pending_chests: store.pendingChests as unknown as Record<string, unknown>[],
      total_correct_signs: store.totalCorrectSigns,
      streak_freezes: store.streakFreezes,
      streak_milestones_awarded: store.streakMilestonesAwarded,
      speed_high_scores: store.speedHighScores as unknown as Record<string, unknown>,
      dominant_hand: store.dominantHand,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>);

    const push = async (isRetry: boolean): Promise<void> => {
      const { error } = await supabase
        .from('user_progress')
        .upsert(buildPayload(), { onConflict: 'user_id' });

      if (error) {
        console.error('Failed to sync progress:', error);
        if (!isRetry) {
          setTimeout(() => void push(true), 2000);
          return;
        }
        setSyncError(true);
        return;
      }
      setSyncError(false);
    };

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void push(false), DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user, store.xp, store.streak, store.completedLessons, store.signAccuracy,
    store.gold, store.ownedCosmetics, store.equippedBorder, store.equippedAvatar, store.activeBadge,
    store.showcaseBadges, store.unlockedWorldIds, store.signs, store.renameCards, store.badges, store.pendingChests,
    store.totalCorrectSigns, store.streakFreezes, store.streakMilestonesAwarded, store.speedHighScores,
    store.dominantHand,
  ]);

  // Debounced sync of the training-data opt-out flag (separate table from user_progress).
  const collectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!supabaseReady || !user) return;
    if (collectTimerRef.current) clearTimeout(collectTimerRef.current);
    collectTimerRef.current = setTimeout(() => {
      void supabase
        .from('profiles')
        .update({ collect_training_data: store.collectTrainingData })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.error('Failed to sync training-data preference:', error);
        });
    }, DEBOUNCE_MS);
    return () => {
      if (collectTimerRef.current) clearTimeout(collectTimerRef.current);
    };
  }, [user, store.collectTrainingData]);

  return { syncError };
}

// Call this when a sign is attempted to log it for leaderboard tracking (no rule/AI/landmark
// breakdown — used by the multiple-choice receptive practice mode, which has no camera).
// Same contract as logAttempt: failures are logged, never rethrown — callers fire-and-forget,
// and a thrown insert must never surface as an unhandledrejection (ASL-A2; c9b8150 only
// covered logAttempt, leaving this path live on every receptive-practice question).
export async function logSignAttempt(userId: string, signId: string, passed: boolean) {
  if (!supabaseReady) return;
  try {
    const { error } = await supabase.from('sign_attempts').insert(
      { user_id: userId, sign_id: signId, passed } as Record<string, unknown>
    );
    if (error) console.error('[telemetry] sign_attempts insert failed:', error.message);
  } catch (e) {
    console.error('[telemetry] sign_attempts insert failed (non-fatal):', e);
  }
}

// Call this on every rule-verifier PASS or VETO event (see useRecognition's onVerified) to
// build a real dataset of per-parameter scores + classifier agreement from actual play — the
// "the scores pass on minor edge cases" complaint needs numbers to fix, not just a feeling.
// No-ops silently when Supabase isn't configured or the classifier didn't run, matching
// logSignAttempt's existing gating pattern; never sends video/landmarks, only these already-
// computed numeric scores. Same contract as logAttempt (ASL-A2): failures are logged, never
// rethrown — LessonPage/PracticePage call this fire-and-forget on every verified event.
export async function logVerification(userId: string, entry: VerificationEntry) {
  if (!supabaseReady) return;
  try {
    const { error } = await supabase.from('sign_verification_log').insert(
      {
        user_id: userId,
        sign_id: entry.signName,
        decision: entry.decision,
        param_scores: entry.params as unknown as Record<string, unknown>,
        classifier_vote: entry.vote as unknown as Record<string, unknown> | null,
      } as Record<string, unknown>
    );
    if (error) console.error('[telemetry] sign_verification_log insert failed:', error.message);
  } catch (e) {
    console.error('[telemetry] sign_verification_log insert failed (non-fatal):', e);
  }
}

/**
 * The subset of attempt sources whose landmark data feeds the training pipeline, and the only
 * values `sign_attempts.source` is documented to hold (see the initial_schema migration). Derived
 * from AttemptSource via Extract rather than re-listed, so dropping or renaming a source upstream
 * breaks this line at compile time instead of silently diverging — the two lists drifting apart is
 * exactly how the analytics union came to carry 'duel'/'room' while this one didn't.
 */
export type TrainingDataSource = Extract<AttemptSource, 'lesson' | 'story' | 'practice' | 'speed'>;

export interface AttemptPayload {
  userId: string;
  signId: string;
  rulePassed: boolean;
  aiPrediction: string | null;
  aiConfidence: number | null;
  aiVetoed: boolean;
  finalPassed: boolean;
  outcome: RecognitionOutcomeKind;
  source: TrainingDataSource;
  /** Landmark snapshot for this attempt. Persisted only if the user hasn't opted out. */
  frames: Frame[];
}

/**
 * Logs a camera-driven recognition attempt: always writes the lightweight `sign_attempts` row
 * (powers analytics + leaderboard), and additionally writes the landmark snapshot to
 * `training_samples` when the user has training-data collection enabled (default on, opt-out
 * in Profile -> Insights). Fire-and-forget — never awaited from the render path.
 */
export async function logAttempt(payload: AttemptPayload) {
  if (!supabaseReady) return;
  const { userId, signId, rulePassed, aiPrediction, aiConfidence, aiVetoed, finalPassed, outcome } = payload;

  // Fire-and-forget telemetry: failures are logged, never rethrown — callers invoke this with
  // `void` from render-adjacent paths, so a rejection here would surface as a spurious
  // unhandledrejection (and a misleading session_crashed analytics event) for what is a
  // non-critical write. Gameplay/progress never depends on these rows landing.
  try {
    const { error } = await supabase.from('sign_attempts').insert({
      user_id: userId,
      sign_id: signId,
      passed: finalPassed,
      rule_passed: rulePassed,
      ai_prediction: aiPrediction,
      ai_confidence: aiConfidence,
      ai_vetoed: aiVetoed,
      outcome,
    } as Record<string, unknown>);
    if (error) console.error('[telemetry] sign_attempts insert failed:', error.message);

    const collectEnabled = useUserStore.getState().collectTrainingData;
    if (collectEnabled && payload.frames.length > 0) {
      const { error: tsError } = await supabase.from('training_samples').insert({
        user_id: userId,
        sign_id: signId,
        frames: payload.frames as unknown,
        rule_passed: rulePassed,
        ai_prediction: aiPrediction,
        ai_confidence: aiConfidence,
        final_passed: finalPassed,
        source: payload.source,
      } as Record<string, unknown>);
      if (tsError) console.error('[telemetry] training_samples insert failed:', tsError.message);
    }
  } catch (e) {
    console.error('[telemetry] attempt logging failed (non-fatal):', e);
  }
}
