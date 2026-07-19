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
            className={`h-1.5 rounded-full transition-all duration-300 ease-out ${
              active
                ? 'w-6 bg-z-purple-light shadow-[0_0_10px_rgba(167,139,250,0.7)]'
                : done
                  ? 'w-1.5 bg-z-purple/70'
                  : 'w-1.5 bg-white/15'
            }`}
          />
        );
      })}
    </div>
  );
}
