import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseReady } from '@/lib/supabase';
import { useUserStore } from '@/stores/useUserStore';
import type { SignStats } from '@/types/user';
import type { VerificationEntry } from '@/hooks/useRecognition';

const DEBOUNCE_MS = 3000;

type ProgressRow = {
  xp: number; level: number; streak: number;
  last_practice_date: string | null;
  completed_lessons: string[];
  sign_accuracy: Record<string, SignStats>;
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
      const { data } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        const row = data as unknown as ProgressRow;
        mergeProgress({
          xp: row.xp,
          level: row.level,
          streak: row.streak,
          lastPracticeDate: row.last_practice_date,
          completedLessons: row.completed_lessons,
          signAccuracy: row.sign_accuracy ?? {},
        });
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
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>,
        { onConflict: 'user_id' }
      );
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, store.xp, store.streak, store.completedLessons, store.signAccuracy]);
}

// Call this when a sign is attempted to log it for leaderboard tracking.
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
