import type { DailyAccuracy } from '@/hooks/useInsights';

interface Props {
  data: DailyAccuracy[];
}

const WIDTH = 280;
const HEIGHT = 56;
const PAD = 4;

// Tiny inline-SVG sparkline of daily pass rate — no charting library, see StruggleBarList.
export function AccuracySparkline({ data }: Props) {
  if (data.length < 2) {
    return <p className="text-z-gray-400 text-xs text-center py-3">Practice a few more days to see a trend.</p>;
  }

  const values = data.map((d) => d.pass_rate_pct ?? 0);
  const n = values.length;
  const points = values.map((v, i) => {
    const x = PAD + (i / (n - 1)) * (WIDTH - PAD * 2);
    const y = PAD + (1 - v / 100) * (HEIGHT - PAD * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = data[data.length - 1];

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="overflow-visible">
        <path d={path} fill="none" stroke="#A78BFA" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 3 : 1.5} fill="#A78BFA" />
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-z-gray-400 mt-1">
        <span>{data[0].day}</span>
        <span className="text-z-purple-light font-semibold">{last.pass_rate_pct ?? 0}% today</span>
      </div>
    </div>
  );
}
