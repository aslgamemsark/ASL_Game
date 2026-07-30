import { maxRetentionOffset, retentionCell, formatDayLabel, type RetentionCohort } from '@/lib/adminAnalytics';

// The classic retention triangle: rows = signup-week cohorts, columns = weeks since signup, cell
// shade ∝ the % of that cohort still active. Deliberately a plain table, not a charting-library
// widget — a colored grid says everything a heatmap would, with zero dependency and no bug surface.

// Green with opacity scaled to the retention %, so a denser cell reads as better retention. A hard
// floor keeps a non-zero cell faintly visible instead of washing out to the background.
function cellStyle(pct: number): React.CSSProperties {
  const opacity = 0.12 + pct * 0.78;
  return { backgroundColor: `color-mix(in srgb, var(--color-z-green) ${Math.round(opacity * 100)}%, transparent)` };
}

export function CohortGrid({ cohorts }: { cohorts: RetentionCohort[] }) {
  if (cohorts.length === 0) {
    return <p className="text-sm text-z-gray-400">Not enough signups yet to show cohorts.</p>;
  }

  const maxOffset = maxRetentionOffset(cohorts);
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="text-left font-semibold text-z-gray-400 px-1 whitespace-nowrap">Signup week</th>
            <th className="text-right font-semibold text-z-gray-400 px-1">Users</th>
            {offsets.map((o) => (
              <th key={o} className="font-semibold text-z-gray-400 px-1 whitespace-nowrap">
                {o === 0 ? 'Signup wk' : `+${o} wk`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.cohort_week}>
              <td className="text-z-gray-200 px-1 whitespace-nowrap">{formatDayLabel(c.cohort_week)}</td>
              <td className="text-right text-z-gray-300 px-1 font-semibold">{c.cohort_size}</td>
              {offsets.map((o) => {
                const pct = retentionCell(c, o);
                return (
                  <td
                    key={o}
                    className="text-center rounded-md px-1.5 py-1 tabular-nums"
                    style={pct === null ? undefined : cellStyle(pct)}
                    title={pct === null ? undefined : `${Math.round(pct * 100)}% of ${c.cohort_size} active in week ${o}`}
                  >
                    <span className={pct === null ? 'text-z-gray-400' : 'text-white font-semibold'}>
                      {pct === null ? '·' : `${Math.round(pct * 100)}%`}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-z-gray-400 mt-2 leading-snug">
        Each row is the group of people who signed up in that week. Reading across: the % of them
        who came back and practiced a sign in their signup week, then +1 week later, +2 weeks, and
        so on. A greener cell = more people stuck around. Blank = that week hasn't happened yet.
      </p>
    </div>
  );
}
