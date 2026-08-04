import { AnimatePresence, motion } from 'framer-motion';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * A persistent, app-wide "you're offline" banner. Mount once, near the root.
 *
 * Without this, going offline was invisible: the PWA shell is precached, so the app keeps loading
 * and rendering perfectly, then every network feature (Leaderboard, Friends, progress sync, ...)
 * fails as a generic, unexplained error — and the lesson/practice/story loop, whose recognition
 * models are `CacheFirst`, genuinely still works, which the same undifferentiated error obscures.
 * One global banner answers "why is everything broken?" once, instead of each screen inventing its
 * own guess at an explanation for a condition that isn't specific to it.
 */
const MESSAGE = "You're offline — lessons already downloaded still work, but scores, friends, "
  + "and multiplayer won't update until you're back online.";

export function OfflineBanner() {
  const online = useOnlineStatus();

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          // `role="status"` is a live-region role: its ACCESSIBLE NAME doesn't get computed from
          // text content the way an interactive element's does (an ARIA accname-spec nuance, not
          // a bug) — found because getByRole('status', {name}) couldn't find this element in the
          // e2e test despite the text visibly being there. aria-label is redundant with the
          // visible text but is what actually makes the name queryable/reliable.
          aria-label={MESSAGE}
          className="fixed top-0 inset-x-0 z-elevated pt-safe bg-z-red text-white text-xs font-bold text-center py-1.5"
          initial={{ y: -40 }}
          animate={{ y: 0 }}
          exit={{ y: -40 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        >
          {MESSAGE}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
