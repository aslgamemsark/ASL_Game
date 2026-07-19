import { motion, useReducedMotion } from 'framer-motion';

interface ScoreDelta {
  label: string;
  delta: number;
}

interface Props {
  correctSignName: string;
  scoreDeltas: ScoreDelta[];
}

/** Shared "reveal" beat shown to every player at the end of a round, before scores/roles advance. */
export function RoundResultCard({ correctSignName, scoreDeltas }: Props) {
  const reduce = useReducedMotion();
  const earned = scoreDeltas.filter((d) => d.delta !== 0);

  return (
    <motion.div
      className="relative w-full max-w-xs overflow-hidden rounded-3xl bg-z-card p-6 text-center ring-1 ring-inset ring-z-purple/40"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Soft purple glow behind the reveal — an earned moment, not ambient decoration. */}
      <div
        className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.45) 0%, transparent 70%)' }}
      />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-z-gray-400">The sign was</p>
        <motion.p
          className="mt-2 text-3xl font-extrabold text-z-purple-glow"
          initial={reduce ? false : { scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {correctSignName.replace(/_/g, ' ')}
        </motion.p>

        {earned.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {earned.map((d, i) => (
              <motion.span
                key={i}
                className="rounded-full bg-z-green/15 px-3 py-1 text-sm font-bold text-z-green ring-1 ring-inset ring-z-green/30"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.28 + i * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                +{d.delta} {d.label}
              </motion.span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
