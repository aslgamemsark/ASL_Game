import type { HistogramBucket } from '@/lib/adminAnalytics';

// A fixed-bucket histogram as vertical bars — used for the level / streak / lessons-completed
// distributions. Plain flex columns, no charting library: a handful of labelled buckets doesn't
// need one, and this keeps the recharts chunk reserved for the true time-series charts.

export function DistributionBars({ data }: { data: HistogramBucket[] }) {
  const max = Math.max(...data.map((b) => b.count), 1);

  return (
    <div className="flex items-end justify-between gap-2 h-28">
      {data.map((b) => (
        <div key={b.bucket} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
          <span className="text-[11px] text-z-gray-300 font-semibold tabular-nums">{b.count}</span>
          <div
            className="w-full bg-z-purple/70 rounded-t-md min-h-[2px] transition-[height]"
            style={{ height: `${Math.round((b.count / max) * 100)}%` }}
          />
          <span className="text-[10px] text-z-gray-400 text-center leading-tight">{b.bucket}</span>
        </div>
      ))}
    </div>
  );
}
