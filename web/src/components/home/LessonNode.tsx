import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LessonNode as LessonNodeType } from '@/types/lesson';

interface Props {
  node: LessonNodeType;
  index: number;
  unitColor: string;
  onSelect: (id: string) => void;
  skipCost?: number;
  signsBalance?: number;
  onSkip?: (id: string) => void;
}

export function LessonNode({ node, index, unitColor, onSelect, skipCost, signsBalance, onSkip }: Props) {
  const isLocked = node.status === 'locked';
  const isCurrent = node.status === 'current' || node.status === 'available';
  const isCompleted = node.status === 'completed';
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const canSkip = isCurrent && typeof skipCost === 'number' && typeof onSkip === 'function';
  const canAfford = canSkip && (signsBalance ?? 0) >= (skipCost as number);

  const offsets = [0, -24, -8, 20, 28, 8, -20];
  const xOffset = offsets[index % offsets.length];

  return (
    <motion.div
      className="flex flex-col items-center"
      style={{ marginLeft: xOffset }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      {/* idle float lives on this wrapper so it never fights the hover gesture */}
      <motion.div
        animate={isCurrent ? { y: [0, -5, 0] } : { y: 0 }}
        transition={isCurrent ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      >
        <motion.button
          onClick={() => !isLocked && onSelect(node.id)}
          disabled={isLocked}
          className={`
            relative w-[68px] h-[68px] rounded-2xl flex items-center justify-center
            text-2xl font-bold transition-colors border-2
            ${isLocked
              ? 'bg-z-surface/40 border-z-gray-500/30 text-z-gray-400 cursor-not-allowed'
              : isCompleted
                ? 'bg-z-green/20 border-z-green text-white shadow-lg shadow-z-green/20'
                : 'text-white cursor-pointer border-transparent'
            }
          `}
          style={
            isCurrent
              ? {
                  background: `linear-gradient(135deg, ${unitColor}CC, ${unitColor})`,
                  boxShadow: `0 6px 20px ${unitColor}50`,
                }
              : undefined
          }
          // concrete resting scale + filter so hover lift/glow fully reverts on mouse-leave
          initial={{ scale: 1, filter: `drop-shadow(0 0 0px ${isCurrent ? unitColor : isCompleted ? '#34D399' : '#7C3AED'}00)` }}
          whileHover={!isLocked ? {
            scale: 1.07,
            filter: `drop-shadow(0 0 14px ${isCurrent ? unitColor : isCompleted ? '#34D399' : '#7C3AED'})`,
            transition: { duration: 0.18 },
          } : undefined}
          whileTap={!isLocked ? { scale: 0.93 } : undefined}
        >
          {isLocked ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          ) : isCompleted ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <span>{node.iconEmoji}</span>
          )}

          {isCurrent && (
            <motion.div
              className="absolute -inset-1 rounded-2xl border-2"
              style={{ borderColor: `${unitColor}80` }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
          )}
        </motion.button>
      </motion.div>

      <span className={`
        mt-2 text-xs font-semibold text-center max-w-[100px] tracking-wide
        ${isLocked ? 'text-z-gray-400' : 'text-z-gray-200'}
      `}>
        {node.title}
      </span>

      {isCurrent && (
        <motion.div
          className="mt-1.5 px-3 py-1 rounded-lg text-[10px] font-bold text-white uppercase tracking-widest"
          style={{ background: unitColor }}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Go
        </motion.div>
      )}

      {canSkip && (
        <div className="mt-2">
          <AnimatePresence mode="wait">
            {confirmingSkip ? (
              <motion.div
                key="confirm"
                className="flex items-center gap-1.5"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <button
                  onClick={() => { onSkip!(node.id); setConfirmingSkip(false); }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-z-green/80 text-white"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmingSkip(false)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-z-surface/60 text-z-gray-300"
                >
                  Cancel
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="skip"
                onClick={() => canAfford && setConfirmingSkip(true)}
                disabled={!canAfford}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                  canAfford
                    ? 'bg-z-surface/60 text-z-gray-200 hover:bg-z-surface/90 cursor-pointer'
                    : 'bg-z-surface/30 text-z-gray-500 cursor-not-allowed'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileTap={canAfford ? { scale: 0.94 } : undefined}
              >
                Skip · 🤟 {skipCost}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
