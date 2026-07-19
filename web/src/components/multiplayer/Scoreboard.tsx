import { motion, useReducedMotion } from 'framer-motion';

interface Entry {
  label: string;
  score: number;
  isYou: boolean;
}

interface Props {
  entries: Entry[];
}

// Live scoreboard for a duel (2) or a room (up to 4). "You" is purple-accented; the current leader
// gets a subtle crown so a glance reads standings without counting. Each score pops when it changes
// — the one moment worth animating here — so a point landing is felt, not just displayed.
export function Scoreboard({ entries }: Props) {
  const reduce = useReducedMotion();
  const top = Math.max(...entries.map((e) => e.score), 0);

  return (
    <div className="flex items-stretch gap-1.5 rounded-2xl bg-z-card/80 p-1.5 ring-1 ring-inset ring-z-purple-deep/50 overflow-x-auto">
      {entries.map((e, i) => {
        const leading = e.score === top && top > 0;
        return (
          <div
            key={i}
            className={`flex items-center gap-1.5 shrink-0 rounded-xl px-2.5 py-1 ${
              e.isYou ? 'bg-z-purple/15 ring-1 ring-inset ring-z-purple/40' : 'bg-z-surface/50'
            }`}
          >
            {leading && <span className="text-[11px] leading-none" aria-label="leading">👑</span>}
            <motion.span
              key={`${i}-${e.score}`}
              initial={reduce ? false : { scale: 0.5, y: -2 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className={`text-base font-extrabold tabular-nums ${e.isYou ? 'text-z-purple-glow' : 'text-white'}`}
            >
              {e.score}
            </motion.span>
            <span className="text-[11px] font-medium text-z-gray-400 truncate max-w-[6rem]">
              {e.isYou ? 'You' : e.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
