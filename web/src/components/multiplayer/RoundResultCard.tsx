import { motion } from 'framer-motion';

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
  return (
    <motion.div
      className="bg-z-card border border-z-purple/30 rounded-2xl p-5 text-center flex flex-col items-center gap-3"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <p className="text-xs text-z-gray-400 uppercase tracking-widest">The sign was</p>
      <p className="text-2xl font-bold text-z-purple-light">{correctSignName.replace(/_/g, ' ')}</p>
      {scoreDeltas.some((d) => d.delta !== 0) && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
          {scoreDeltas.filter((d) => d.delta !== 0).map((d, i) => (
            <span key={i} className="text-sm font-semibold text-z-green">+{d.delta} {d.label}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
