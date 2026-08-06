import { motion } from 'framer-motion';

interface Props {
  onStart: () => void;
}

/**
 * Replaces the old always-visible StreakCard in this spot (2026-08-04) — that detail moved into a
 * hover popover under the TopBar streak pill instead. The "Start" button opens the "Say Hello"
 * world and scrolls to its first lesson node (see WorldMap's openWorldId prop, wired up in
 * HomePage).
 */
export function StartJourneyCard({ onStart }: Props) {
  return (
    <motion.div
      className="relative w-full overflow-hidden rounded-3xl p-5 mb-6 bg-gradient-primary"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Scrim so white text clears the 4.5:1 AA floor against the gradient's lighter end — same
          technique as StreakCard/PracticeTab/SpeedChallengePage. */}
      <div className="absolute inset-0 bg-black/25 pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-white">Start your journey</h3>
          <p className="text-sm text-white/80 mt-1">Say Hello is ready — learn your first signs</p>
        </div>
        {/* Same bg-gradient-primary pill used for every other primary CTA in the app (Sign In,
            Continue, etc.) — a border keeps it readable as a distinct button even though the
            card behind it is the same gradient. */}
        <motion.button
          onClick={onStart}
          className="shrink-0 px-6 py-3 rounded-full font-bold text-sm text-white bg-gradient-primary border border-white/25 shadow-lg shadow-black/20"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Start
        </motion.button>
      </div>
    </motion.div>
  );
}
