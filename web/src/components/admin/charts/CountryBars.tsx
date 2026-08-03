import type { CountryCount } from '@/lib/adminAnalytics';
import { ProgressBar } from '@/components/shared/ProgressBar';

// Users by country as a horizontal bar list, reusing the fail-rate bar idiom already in
// AdminPanel. "Unknown" (users whose region never resolved) is shown explicitly and greyed rather
// than hidden, so the reader knows how much of the total is uncounted.

// Turn a 2-letter ISO country code into its flag emoji via regional-indicator symbols. Anything
// that isn't a clean AA code (notably the 'Unknown' bucket) falls back to a globe.
function flag(region: string): string {
  if (!/^[A-Za-z]{2}$/.test(region)) return '🌐';
  const base = 0x1f1e6;
  const cc = region.toUpperCase();
  return String.fromCodePoint(base + (cc.charCodeAt(0) - 65), base + (cc.charCodeAt(1) - 65));
}

export function CountryBars({ data }: { data: CountryCount[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-z-gray-400">No users yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.users), 1);
  const total = data.reduce((sum, d) => sum + d.users, 0);

  return (
    <div className="space-y-1.5">
      {data.map((d) => {
        const isUnknown = d.region === 'Unknown';
        return (
          <div key={d.region} className="flex items-center gap-2 text-sm">
            <span className="w-16 shrink-0 flex items-center gap-1.5">
              <span aria-hidden>{flag(d.region)}</span>
              <span className={`font-mono font-semibold ${isUnknown ? 'text-z-gray-400' : ''}`}>{d.region}</span>
            </span>
            <ProgressBar
              value={d.users / max}
              label={`${d.region}: ${d.users} users`}
              size="sm"
              fillClassName={isUnknown ? 'bg-z-gray-400/50' : 'bg-z-purple/70'}
              className="flex-1"
            />
            <span className="text-xs text-z-gray-400 w-20 text-right shrink-0 tabular-nums">
              {d.users} · {Math.round((d.users / total) * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
