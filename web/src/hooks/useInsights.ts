import { useEffect, useState } from 'react';
import { supabase, supabaseReady } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface StruggleSign {
  sign_id: string;
  fail_count: number;
  attempt_count: number;
}

export interface SignAttemptStat {
  sign_id: string;
  attempts: number;
  passes: number;
  avg_attempts_per_pass: number | null;
}

export interface VetoStats {
  ai_gated_attempts: number;
  veto_count: number;
  veto_rate_pct: number | null;
}

export interface DailyAccuracy {
  day: string;
  attempts: number;
  passes: number;
  pass_rate_pct: number | null;
}

// Personal "Insights" data — most-failed signs, attempts-to-pass, AI veto rate, accuracy over
// time. Each query reads from a `security_invoker` view (supabase/schema.sql) so RLS already
// scopes every row to the signed-in user; nothing here is visible cross-user.
export function useInsights() {
  const { user } = useAuth();
  const [struggleSigns, setStruggleSigns] = useState<StruggleSign[]>([]);
  const [signStats, setSignStats] = useState<SignAttemptStat[]>([]);
  const [vetoStats, setVetoStats] = useState<VetoStats | null>(null);
  const [dailyAccuracy, setDailyAccuracy] = useState<DailyAccuracy[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabaseReady || !user) return;
    setLoading(true);
    Promise.all([
      supabase.from('most_failed_signs').select('*').order('fail_count', { ascending: false }).limit(5),
      supabase.from('sign_attempt_stats').select('*'),
      supabase.from('ai_veto_stats').select('*').maybeSingle(),
      supabase.from('daily_accuracy').select('*').order('day', { ascending: true }).limit(14),
    ]).then(([sf, ss, vs, da]) => {
      setStruggleSigns(((sf.data as unknown as StruggleSign[]) ?? []).filter((s) => s.fail_count > 0));
      setSignStats((ss.data as unknown as SignAttemptStat[]) ?? []);
      setVetoStats((vs.data as unknown as VetoStats) ?? null);
      setDailyAccuracy((da.data as unknown as DailyAccuracy[]) ?? []);
      setLoading(false);
    });
  }, [user]);

  const overallAvgAttempts =
    signStats.length > 0
      ? signStats.reduce((sum, s) => sum + (s.avg_attempts_per_pass ?? s.attempts), 0) / signStats.length
      : null;

  return { struggleSigns, signStats, vetoStats, dailyAccuracy, overallAvgAttempts, loading };
}
