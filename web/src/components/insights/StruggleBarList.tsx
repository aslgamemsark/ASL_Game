import type { StruggleSign } from '@/hooks/useInsights';

interface Props {
  signs: StruggleSign[];
  labelFor: (signId: string) => string;
}

// Minimal horizontal bar list — deliberately no chart library (see README "Future work";
// the codebase already avoids heavy deps where a handful of small visualizations suffice).
export function StruggleBarList({ signs, labelFor }: Props) {
  if (signs.length === 0) {
    return <p className="text-z-gray-400 text-xs text-center py-3">No struggle signs yet — keep practicing!</p>;
  }
  const maxFails = Math.max(...signs.map((s) => s.fail_count));

  return (
    <div className="space-y-2.5">
      {signs.map((s) => {
        const pct = Math.max(8, Math.round((s.fail_count / maxFails) * 100));
        return (
          <div key={s.sign_id} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold text-z-gray-300 truncate">
              {labelFor(s.sign_id)}
            </span>
            <div className="flex-1 h-3 rounded-full bg-z-surface/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-z-red to-orange-400"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-[11px] text-z-gray-400 tabular-nums">
              {s.fail_count}/{s.attempt_count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
