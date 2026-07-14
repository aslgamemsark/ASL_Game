interface Props {
  total: number;
  /** 1-indexed current round. */
  current: number;
}

export function RoundProgressDots({ total, current }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const roundNum = i + 1;
        const done = roundNum < current;
        const active = roundNum === current;
        return (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              active ? 'w-5 bg-z-purple-light' : done ? 'w-1.5 bg-z-purple/60' : 'w-1.5 bg-white/15'
            }`}
          />
        );
      })}
    </div>
  );
}
