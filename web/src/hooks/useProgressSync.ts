import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseReady } from '@/lib/supabase';
import { useUserStore } from '@/stores/useUserStore';
import type { SignStats } from '@/types/user';
import type { VerificationEntry } from '@/hooks/useRecognition';
import type { Frame } from '@/engine/landmarks';

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
};

// Loads remote progress on sign-in and merges it with local state.
// Debounce-syncs every store change back to Supabase while logged in.
export function useProgressSync() {
  const { user } = useAuth();
  const store = useUserStore();
  const mergeProgress = useUserStore((s) => s.mergeProgress);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedUserRef = useRef<string | null>(null);

  // On login: fetch remote progress and merge.
  useEffect(() => {
    if (!supabaseReady || !user || syncedUserRef.current === user.id) return;
    syncedUserRef.current = user.id;

    (async () => {
      const [{ data }, { data: profileRow }] = await Promise.all([
        supabase.from('user_progress').select('*').eq('user_id', user.id).single(),
        supabase.from('profiles').select('collect_training_data').eq('id', user.id).single(),
      ]);

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
        });
      }
      if (profileRow && typeof (profileRow as { collect_training_data?: boolean }).collect_training_data === 'boolean') {
        mergeProgress({ collectTrainingData: (profileRow as { collect_training_data: boolean }).collect_training_data });
      }
    })();
  }, [user, mergeProgress]);

  // Reset sync marker on sign-out so next login re-fetches.
  useEffect(() => {
    if (!user) syncedUserRef.current = null;
  }, [user]);

  // Debounced upsert on every store change.
  useEffect(() => {
    if (!supabaseReady || !user) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await supabase.from('user_progress').upsert(
        {
          user_id: user.id,
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
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>,
        { onConflict: 'user_id' }
      );
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user, store.xp, store.streak, store.completedLessons, store.signAccuracy,
    store.gold, store.ownedCosmetics, store.equippedBorder, store.equippedAvatar,
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
        .eq('id', user.id);
    }, DEBOUNCE_MS);
    return () => {
      if (collectTimerRef.current) clearTimeout(collectTimerRef.current);
    };
  }, [user, store.collectTrainingData]);
}

// Call this when a sign is attempted to log it for leaderboard tracking (no rule/AI/landmark
// breakdown — used by the multiple-choice receptive practice mode, which has no camera).
export async function logSignAttempt(userId: string, signId: string, passed: boolean) {
  if (!supabaseReady) return;
  await supabase.from('sign_attempts').insert(
    { user_id: userId, sign_id: signId, passed } as Record<string, unknown>
  );
}

// Call this on every rule-verifier PASS or VETO event (see useRecognition's onVerified) to
// build a real dataset of per-parameter scores + classifier agreement from actual play — the
// "the scores pass on minor edge cases" complaint needs numbers to fix, not just a feeling.
// No-ops silently when Supabase isn't configured or the classifier didn't run, matching
// logSignAttempt's existing gating pattern; never sends video/landmarks, only these already-
// computed numeric scores.
export async function logVerification(userId: string, entry: VerificationEntry) {
  if (!supabaseReady) return;
  await supabase.from('sign_verification_log').insert(
    {
      user_id: userId,
      sign_id: entry.signName,
      decision: entry.decision,
      param_scores: entry.params as unknown as Record<string, unknown>,
      classifier_vote: entry.vote as unknown as Record<string, unknown> | null,
    } as Record<string, unknown>
  );
}

export type AttemptSource = 'lesson' | 'story' | 'practice' | 'speed';

export interface AttemptPayload {
  userId: string;
  signId: string;
  rulePassed: boolean;
  aiPrediction: string | null;
  aiConfidence: number | null;
  aiVetoed: boolean;
  finalPassed: boolean;
  source: AttemptSource;
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
  const { userId, signId, rulePassed, aiPrediction, aiConfidence, aiVetoed, finalPassed } = payload;

  await supabase.from('sign_attempts').insert({
    user_id: userId,
    sign_id: signId,
    passed: finalPassed,
    rule_passed: rulePassed,
    ai_prediction: aiPrediction,
    ai_confidence: aiConfidence,
    ai_vetoed: aiVetoed,
  } as Record<string, unknown>);

  const collectEnabled = useUserStore.getState().collectTrainingData;
  if (collectEnabled && payload.frames.length > 0) {
    await supabase.from('training_samples').insert({
      user_id: userId,
      sign_id: signId,
      frames: payload.frames as unknown,
      rule_passed: rulePassed,
      ai_prediction: aiPrediction,
      ai_confidence: aiConfidence,
      final_passed: finalPassed,
      source: payload.source,
    } as Record<string, unknown>);
  }
}
