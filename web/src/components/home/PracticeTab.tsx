import { motion } from 'framer-motion';
import { SIGNS } from '@/data/signs';
import { useUserStore } from '@/stores/useUserStore';

interface Props {
  onStartPractice: () => void;
  onStartWeakPractice: (signIds: string[]) => void;
  onStartStory: () => void;
  onStartSpeed: () => void;
}

export function PracticeTab({ onStartPractice, onStartWeakPractice, onStartStory, onStartSpeed }: Props) {
  const { signAccuracy } = useUserStore();

  const signEntries = Object.entries(SIGNS);

  const dueForReview = signEntries.filter(([id]) => {
    const stats = signAccuracy[id];
    return stats && stats.nextReviewAt <= Date.now();
  });

  const weakSignIds = signEntries
    .filter(([id]) => {
      const stats = signAccuracy[id];
      return stats && stats.attempts > 0 && stats.easeFactor < 2.2;
    })
    .sort(([idA], [idB]) => {
      return (signAccuracy[idA]?.easeFactor ?? 99) - (signAccuracy[idB]?.easeFactor ?? 99);
    })
    .slice(0, 8)
    .map(([id]) => id);

  return (
    <div className="px-4 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-2xl font-bold mb-1 tracking-tight">Review</h2>
        <p className="text-z-gray-300 text-sm mb-6">
          Sharpen your signs with spaced recall
        </p>
      </motion.div>

      {/* Quick session */}
      <motion.div
        className="mb-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <motion.button
          onClick={onStartPractice}
          className="w-full rounded-2xl p-5 text-left border border-white/5 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #5B21B6, #7C3AED)' }}
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileTap={{ scale: 0.97 }}
          variants={{
            rest:  { scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' },
            hover: { scale: 1.02, boxShadow: '0 14px 40px rgba(91,33,182,0.55)', transition: { duration: 0.25, ease: 'easeOut' } },
          }}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Quick Session</h3>
              <p className="text-purple-200 text-sm mt-1">
                {dueForReview.length > 0
                  ? `${dueForReview.length} sign${dueForReview.length > 1 ? 's' : ''} to review`
                  : 'Warm up with your learned signs'}
              </p>
            </div>
            <motion.span
              className="text-3xl inline-block"
              style={{ transformOrigin: '75% 80%' }}
              variants={{
                rest:  { rotate: 0, transition: { duration: 0.3, ease: 'easeOut' } },
                hover: { rotate: [0, -18, 14, -18, 14, 0], transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } },
              }}
            >🤟</motion.span>
          </div>
        </motion.button>
      </motion.div>

      {/* Speed Challenge */}
      <motion.div
        className="mb-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.11 }}
      >
        <motion.button
          onClick={onStartSpeed}
          className="w-full rounded-2xl p-5 text-left border border-white/5 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #1E40AF, #3B82F6)' }}
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileTap={{ scale: 0.97 }}
          variants={{
            rest:  { scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' },
            hover: { scale: 1.02, boxShadow: '0 14px 40px rgba(59,130,246,0.45)', transition: { duration: 0.25, ease: 'easeOut' } },
          }}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">⚡ Speed Challenge</h3>
              <p className="text-blue-200 text-sm mt-1">Race the clock · 3× XP in Blitz mode</p>
            </div>
            <motion.span
              className="text-3xl inline-block"
              variants={{
                rest:  { x: 0, transition: { duration: 0.3 } },
                hover: { x: [0, 6, -3, 5, 0], transition: { duration: 0.8, repeat: Infinity } },
              }}
            >⚡</motion.span>
          </div>
        </motion.button>
      </motion.div>

      {/* Weak Signs — only shows if there are struggling signs */}
      {weakSignIds.length > 0 && (
        <motion.div
          className="mb-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <motion.button
            onClick={() => onStartWeakPractice(weakSignIds)}
            className="w-full rounded-2xl p-5 text-left border border-z-orange/20 overflow-hidden relative"
            style={{ background: 'linear-gradient(135deg, #78180A, #C2410C)' }}
            initial="rest"
            animate="rest"
            whileHover="hover"
            whileTap={{ scale: 0.97 }}
            variants={{
              rest:  { scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' },
              hover: { scale: 1.02, boxShadow: '0 14px 40px rgba(194,65,12,0.45)', transition: { duration: 0.25, ease: 'easeOut' } },
            }}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Weak Signs</h3>
                <p className="text-orange-200 text-sm mt-1">
                  {weakSignIds.length} sign{weakSignIds.length > 1 ? 's' : ''} that need extra practice
                </p>
              </div>
              <motion.span
                className="text-3xl inline-block"
                variants={{
                  rest:  { rotate: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
                  hover: { rotate: [0, -8, 8, -6, 0], scale: [1, 1.1, 1], transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } },
                }}
              >
                💪
              </motion.span>
            </div>
          </motion.button>
        </motion.div>
      )}

      {/* Story mode */}
      <motion.div
        className="mb-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.17 }}
      >
        <motion.button
          onClick={onStartStory}
          className="w-full rounded-2xl p-5 text-left border border-white/5 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #0F766E, #14B8A6)' }}
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileTap={{ scale: 0.97 }}
          variants={{
            rest:  { scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' },
            hover: { scale: 1.02, boxShadow: '0 14px 40px rgba(15,118,110,0.55)', transition: { duration: 0.25, ease: 'easeOut' } },
          }}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          {/* White text directly on this gradient failed WCAG contrast (2.3:1, needs 4.5:1) —
              caught by an `impeccable detect` scan. A scrim behind the text keeps the vibrant
              gradient intact while giving text enough contrast to read on. */}
          <div className="absolute inset-0 bg-black/30 rounded-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Coffee Shop Story</h3>
              <p className="text-teal-100 text-sm mt-1">Chat with Zippy the barista in ASL</p>
            </div>
            <div className="relative inline-flex items-center justify-center">
              {[0, 1, 2].map((s) => (
                <motion.span
                  key={s}
                  className="absolute rounded-full bg-white/60"
                  style={{ width: 4, height: 9, left: `${36 + s * 13}%`, bottom: '70%', filter: 'blur(1.5px)' }}
                  variants={{
                    rest:  { opacity: 0, y: 0, transition: { duration: 0.3 } },
                    hover: { opacity: [0, 0.65, 0], y: [0, -16], transition: { duration: 1.5, repeat: Infinity, delay: s * 0.3, ease: 'easeOut' } },
                  }}
                />
              ))}
              <motion.span
                className="text-3xl inline-block"
                variants={{
                  rest:  { y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
                  hover: { y: -4, transition: { duration: 0.25, ease: 'easeOut' } },
                }}
              >☕</motion.span>
            </div>
          </div>
        </motion.button>
      </motion.div>

      {/* Vocabulary grid */}
      <h3 className="font-bold text-sm mb-3 mt-6 text-z-gray-300 uppercase tracking-widest">
        Your vocabulary
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {signEntries.map(([id, sign], i) => {
          const stats = signAccuracy[id];
          const accuracy = stats
            ? Math.round((stats.successes / stats.attempts) * 100)
            : null;
          const isWeak = stats && stats.easeFactor < 2.2 && stats.attempts > 0;

          return (
            <motion.div
              key={id}
              className={`border rounded-xl p-3 text-center ${
                isWeak ? 'bg-z-orange/10 border-z-orange/20' : 'bg-z-card border-white/5'
              }`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
            >
              <p className="font-semibold text-xs truncate text-z-gray-100">
                {sign.name.replace(/_/g, ' ')}
              </p>
              {accuracy !== null ? (
                <p className={`text-[11px] mt-1 font-bold ${
                  accuracy >= 70 ? 'text-emerald-400' : 'text-z-orange'
                }`}>
                  {accuracy}%
                </p>
              ) : (
                <p className="text-[11px] mt-1 text-z-gray-500">—</p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
