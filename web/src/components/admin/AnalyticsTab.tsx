import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { withRollingWau, type AdminAnalytics } from '@/lib/adminAnalytics';
import { formatAdminTimestamp } from '@/lib/formatTimestamp';
import { GrowthChart, ActiveChart } from './charts/TrendChart';
import { CohortGrid } from './charts/CohortGrid';
import { CountryBars } from './charts/CountryBars';
import { DistributionBars } from './charts/DistributionBars';

// The Analytics tab: growth, active users, retention, geography and engagement — every number
// computed server-side from Supabase by the admin_analytics RPC (see its migration for the honest
// scope). This whole module is lazy-loaded by AdminPanel so recharts stays out of the main bundle.

const RANGES = [30, 90] as const;

// One reusable section frame so every block shares the same card + caption rhythm.
function Section({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <div className="bg-z-card border border-white/5 rounded-2xl p-4">
      <h3 className="font-bold text-sm text-z-gray-300 uppercase tracking-wide">{title}</h3>
      <p className="text-xs text-z-gray-400 mt-0.5 mb-3">{caption}</p>
      {children}
    </div>
  );
}

function Median({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-z-surface rounded-xl py-2.5 text-center">
      <p className="text-xl font-bold tabular-nums">{Math.round(value)}</p>
      <p className="text-[11px] text-z-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function AnalyticsTab({ showToast }: { showToast: (m: string) => void }) {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [days, setDays] = useState<number>(90);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async (rangeDays: number) => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data: rpcData, error } = await supabase.rpc('admin_analytics', { p_days: rangeDays });
      if (error) {
        showToast(`Error: ${error.message}`);
        setLoadError(true);
      } else {
        setData(rpcData as AdminAnalytics);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void load(days); }, [load, days]);

  if (loading && !data) return <p className="text-sm text-z-gray-400">Loading…</p>;
  if (loadError && !data) {
    return (
      <div className="text-center py-10">
        <p className="text-z-gray-300 text-sm">Couldn't load analytics</p>
        <button onClick={() => void load(days)} className="text-z-purple-light text-xs mt-1 font-semibold hover:underline py-2.5 -my-2.5 px-2 -mx-2">
          Try again
        </button>
      </div>
    );
  }
  if (!data) return null;

  const active = withRollingWau(data.active);
  const eng = data.engagement;

  return (
    <div className="space-y-5">
      {/* Controls: day-range selector + manual refresh (the tab otherwise only fetches on mount). */}
      <div className="flex items-center gap-2">
        <div className="flex bg-z-surface/50 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                days === r ? 'bg-z-purple text-white' : 'text-z-gray-400'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
        <button
          onClick={() => void load(days)}
          disabled={loading}
          className="ml-auto text-xs font-semibold text-z-purple-light hover:underline disabled:opacity-50 py-2.5 -my-2.5 px-2 -mx-2"
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      <Section
        title="Growth"
        caption="New registered users per day, and the running total. Guests (no account) aren't counted."
      >
        <GrowthChart data={data.growth} />
      </Section>

      <Section
        title="Active users"
        caption='"Active" = practiced at least one sign that day. Browsing without attempting a sign isn’t counted, so this is a floor.'
      >
        <ActiveChart data={active} />
      </Section>

      <Section
        title="Retention"
        caption="Of everyone who signed up in a given week, the % who practiced a sign again in each later week."
      >
        <CohortGrid cohorts={data.retention} />
      </Section>

      <Section
        title="Where users are"
        caption="By country (best-effort from IP at signup). “Unknown” = users whose location never resolved."
      >
        <CountryBars data={data.geography} />
      </Section>

      <Section
        title="Engagement"
        caption={`Across ${eng.total_with_progress} users with saved progress — the typical (median) user and how the base is distributed.`}
      >
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Median label="Median level" value={eng.median_level} />
          <Median label="Median streak" value={eng.median_streak} />
          <Median label="Median XP" value={eng.median_xp} />
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-z-gray-400 mb-1 font-semibold">Level</p>
            <DistributionBars data={eng.level_hist} />
          </div>
          <div>
            <p className="text-xs text-z-gray-400 mb-1 font-semibold">Streak (days)</p>
            <DistributionBars data={eng.streak_hist} />
          </div>
          <div>
            <p className="text-xs text-z-gray-400 mb-1 font-semibold">Lessons completed</p>
            <DistributionBars data={eng.lessons_hist} />
          </div>
        </div>
      </Section>

      <p className="text-[11px] text-z-gray-500 text-center">
        Registered users only · updated {formatAdminTimestamp(data.generated_at)}
      </p>
    </div>
  );
}
