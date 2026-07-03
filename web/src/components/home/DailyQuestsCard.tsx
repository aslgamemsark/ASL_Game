import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/stores/useUserStore';

const DIFF_STYLE = {
  easy:   { text: 'text-emerald-400', bg: 'bg-emerald-400/15' },
  medium: { text: 'text-z-yellow',   bg: 'bg-z-yellow/15'    },
  hard:   { text: 'text-z-orange',   bg: 'bg-z-orange/15'    },
};

export function DailyQuestsCard() {
  const { dailyQuests, claimQuest } = useUserStore();
  const [expanded, setExpanded] = useState(false);

  if (dailyQuests.length === 0) return null;

  const claimed = dailyQuests.filter(q => q.claimed).length;
  const allDone = claimed === dailyQuests.length;
  const hasClaimable = dailyQuests.some(q => q.completed && !q.claimed);

  // Collapse to a one-line summary once there's nothing actionable (no claimable quest, not all
  // done yet) - this is the biggest single contributor to the "too much chrome before Worlds"
  // finding: 3 full quest cards render every visit even when there's nothing to do about them yet.
  const showCollapsed = !expanded && !hasClaimable && !allDone;

  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-z-gray-300 uppercase tracking-widest">
          Daily Quests
        </h3>
        <span className={`text-xs font-bold ${allDone ? 'text-emerald-400' : 'text-z-gray-300'}`}>
          {allDone ? '✓ All claimed!' : `${claimed}/${dailyQuests.length} done`}
        </span>
      </div>

      {showCollapsed ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full bg-z-card border border-white/5 rounded-2xl p-3 text-left text-sm text-z-gray-300 flex items-center justify-between"
        >
          <span>{claimed}/{dailyQuests.length} quests in progress</span>
          <span className="text-z-gray-400 text-xs">View all →</span>
        </button>
      ) : (
      <div className="flex flex-col gap-2">
        {dailyQuests.map((quest, i) => {
          const pct = quest.target > 0 ? Math.min(1, quest.progress / quest.target) : 0;
          const style = DIFF_STYLE[quest.difficulty];

          return (
            <motion.div
              key={quest.id}
              className={`bg-z-card border rounded-2xl p-4 transition-colors ${
                quest.claimed ? 'border-emerald-500/20' : 'border-white/5'
              }`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 + i * 0.07 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${style.bg} ${style.text}`}>
                  {quest.difficulty}
                </span>
                <p className="font-semibold text-sm text-white flex-1 truncate">{quest.title}</p>

                <AnimatePresence mode="wait">
                  {quest.claimed ? (
                    <motion.span
                      key="check"
                      className="text-emerald-400 text-sm font-bold flex-shrink-0"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      ✓
                    </motion.span>
                  ) : quest.completed ? (
                    <motion.button
                      key="claim"
                      onClick={() => claimQuest(quest.id)}
                      className="text-xs font-bold px-3 py-1 rounded-full text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{
                        scale: [1, 1.05, 1],
                        opacity: 1,
                        // Bounded: 3 pulses announce "this is claimable", then it holds still -
                        // an infinite pulse is ambient decoration, not the one-off celebration
                        // PRODUCT.md's "celebrate deliberately" principle calls for.
                        transition: { scale: { duration: 1.4, repeat: 3 }, opacity: { duration: 0.2 } },
                      }}
                      whileHover={{ scale: 1.07 }}
                      whileTap={{ scale: 0.94 }}
                    >
                      Claim!
                    </motion.button>
                  ) : null}
                </AnimatePresence>
              </div>

              <p className="text-z-gray-400 text-xs mb-3">{quest.description}</p>

              {/* Progress row */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: quest.claimed
                        ? '#34D399'
                        : 'linear-gradient(90deg, #7C3AED, #A78BFA)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct * 100}%` }}
                    transition={{ duration: 0.65, ease: 'easeOut', delay: 0.2 + i * 0.07 }}
                  />
                </div>
                <span className="text-[11px] text-z-gray-400 whitespace-nowrap tabular-nums">
                  {quest.progress}/{quest.target}
                </span>
                <span className="text-[11px] text-z-yellow whitespace-nowrap">
                  +{quest.xpReward} XP
                </span>
                <span className="text-[11px] text-z-purple-glow whitespace-nowrap">
                  +{quest.signsReward} 🤟
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}
    </motion.div>
  );
}
