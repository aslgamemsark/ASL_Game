import { useUserStore, todayStr } from '@/stores/useUserStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Zippy } from '@/components/shared/Zippy';

const MILESTONES = [7, 30, 100];

export function StreakCard() {
  const { streak, dailyGoalMinutes, dailyProgressMinutes, dailyProgressDate, streakMilestonesAwarded, streakFreezes } = useUserStore();
  // Stored minutes count only if they belong to today; a past day's total reads as 0 so the
  // card resets at midnight even before the user practices again (addDailyMinutes zeroes it too).
  const todaysMinutes = dailyProgressDate === todayStr() ? dailyProgressMinutes : 0;
  const progress = Math.min(1, todaysMinutes / dailyGoalMinutes);

  const nextMilestone = MILESTONES.find(m => streak < m) ?? null;
  const latestMilestone = [...MILESTONES].reverse().find(m => streakMilestonesAwarded.includes(m)) ?? null;

  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl p-5 mb-6 cursor-default bg-gradient-streak"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover="blaze"
      variants={{ blaze: { scale: 1.018, transition: { duration: 0.25, ease: 'easeOut' } } }}
    >
      {/* Orange glow orb */}
      <motion.div
        className="absolute top-0 right-0 w-44 h-44 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.35) 0%, transparent 70%)' }}
        variants={{
          blaze: {
            opacity: [0.4, 0.85, 0.4],
            scale:   [1, 1.3, 1],
            transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
          },
        }}
      />
      <div className="absolute -bottom-4 -left-4 w-28 h-28 bg-z-purple-light/10 rounded-full blur-2xl pointer-events-none" />

      {/* The hand-rolled bg-black/20 scrim that used to sit here is now baked into
          bg-gradient-streak — /20 was below what this gradient needs anyway (it left the
          white/70 captions at 4.67:1, and the family floor is /45). See index.css. */}

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <motion.span
                className="text-3xl inline-block"
                variants={{
                  blaze: {
                    rotate: [0, -5, 4, -4, 2, 0],
                    x:      [0, -2, 1.5, -1.5, 0.5, 0],
                    scale:  [1, 1.1, 1.05, 1.13, 1.06, 1],
                    filter: [
                      'brightness(1)    drop-shadow(0 0px 0px rgba(249,115,22,0))',
                      'brightness(1.25) drop-shadow(0 -4px 10px rgba(249,115,22,0.7))',
                      'brightness(1.1)  drop-shadow(0 -2px 5px rgba(249,115,22,0.4))',
                      'brightness(1.3)  drop-shadow(0 -5px 12px rgba(249,115,22,0.8))',
                      'brightness(1.12) drop-shadow(0 -3px 6px rgba(249,115,22,0.5))',
                      'brightness(1)    drop-shadow(0 0px 0px rgba(249,115,22,0))',
                    ],
                    transition: { duration: 1.9, repeat: Infinity, ease: 'easeInOut' },
                  },
                }}
              >
                🔥
              </motion.span>
              <span className="text-2xl font-bold text-white">
                {streak} day{streak !== 1 ? 's' : ''}
              </span>
              {/* Latest milestone badge. White, not text-z-yellow: this badge sits on the streak
                  gradient, which does NOT invert with the theme, while z-yellow does (#5EEAD4 dark
                  -> #006B88 light). The light-theme value measured 1.95:1 here. */}
              {latestMilestone && (
                <span className="text-2xs font-bold text-white bg-white/15 px-2 py-0.5 rounded-full">
                  🏅 {latestMilestone}-day
                </span>
              )}
              {/* Streak-protection cards on hand — auto-saves the streak on a missed day. */}
              {streakFreezes > 0 && (
                <span
                  className="text-2xs font-bold text-white bg-white/15 px-2 py-0.5 rounded-full"
                  title="Streak protection — auto-saves your streak if you miss too many days"
                >
                  🛡️ {streakFreezes}
                </span>
              )}
            </div>
            <p className="text-sm text-white/80">
              {streak === 0 ? 'Start signing today!' : 'Keep the momentum!'}
            </p>
          </div>

          <motion.div
            className="shrink-0"
            variants={{
              blaze: {
                rotate: [0, -10, 10, -8, 8, 0],
                transition: { duration: 0.5 },
              },
            }}
          >
            <Zippy expression="streak" size="sm" />
          </motion.div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white/80">Today&apos;s goal</span>
            <span className="font-bold text-z-orange-bright">
              {todaysMinutes}/{dailyGoalMinutes} min
            </span>
          </div>
          <div className="h-2.5 bg-white/15 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--color-z-orange), var(--color-z-orange-bright))' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
            />
          </div>
        </div>

        {/* Footer: next milestone */}
        <div className="flex items-center justify-end mt-3">
          <AnimatePresence>
            {nextMilestone && streak > 0 && (
              <motion.span
                className="text-xs text-white/80"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {nextMilestone - streak} day{nextMilestone - streak !== 1 ? 's' : ''} to 🏅{nextMilestone}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
