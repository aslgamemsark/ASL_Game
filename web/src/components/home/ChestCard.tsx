import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/stores/useUserStore';
import { Zippy } from '@/components/shared/Zippy';
import { pickZippyLine } from '@/data/zippy';
import type { Chest } from '@/types/user';

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatTime(ms: number): string {
  if (ms <= 0) return 'Ready!';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function ChestItem({ chest }: { chest: Chest }) {
  const { gold, openChest, skipChest } = useUserStore();
  const now = useNow();
  const ready = chest.readyAt <= now;
  const msLeft = Math.max(0, chest.readyAt - now);
  const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
  const skipCost = Math.max(5, hoursLeft * 20);
  const [openResult, setOpenResult] = useState<{ signs: number; gold: number } | null>(null);

  const handleOpen = () => {
    if (!ready) return;
    const result = openChest(chest.id);
    setOpenResult(result);
  };

  const handleSkip = () => {
    skipChest(chest.id);
  };

  if (openResult) {
    return (
      <motion.div
        className="flex items-center gap-3 bg-z-card border border-z-green/30 rounded-2xl p-4"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <Zippy expression="reward" size="xs" />
        <div className="flex-1">
          <p className="font-bold text-sm text-z-green">{pickZippyLine('chestReward')}</p>
          <p className="text-xs text-z-gray-300 mt-0.5">
            +{openResult.signs} 🤟 Signs · +{openResult.gold} 🪙 Gold
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-z-card border border-white/8 rounded-2xl p-4">
      {/* Locked: the chest itself. Ready: Zippy pops in, wide-eyed, to announce it can be opened. */}
      {ready ? (
        <Zippy expression="surprised" size="xs" />
      ) : (
        <motion.span
          className="text-3xl"
          // Bounded (was Infinity): a chest that stays "ready" for hours shouldn't bounce the whole
          // time - a few cycles announce readiness, then it holds still until opened.
          transition={{ duration: 1.5, repeat: 3, ease: 'easeInOut' }}
        >
          📦
        </motion.span>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">Reward Chest</p>
        <p className={`text-xs mt-0.5 ${ready ? 'text-z-green font-bold' : 'text-z-gray-400'}`}>
          {ready ? '✓ Ready to open!' : `⏳ ${formatTime(msLeft)}`}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        {!ready && (
          <motion.button
            onClick={handleSkip}
            disabled={gold < skipCost}
            className="text-xs px-3 py-1.5 rounded-xl border border-z-yellow/30 text-z-yellow disabled:opacity-40 disabled:cursor-not-allowed"
            whileTap={{ scale: 0.95 }}
          >
            Skip {skipCost}🪙
          </motion.button>
        )}
        <motion.button
          onClick={handleOpen}
          disabled={!ready}
          className={`text-xs px-3 py-1.5 rounded-xl font-bold ${
            ready
              ? 'bg-z-purple text-white'
              : 'bg-z-surface/50 text-z-gray-500 cursor-default'
          }`}
          whileTap={ready ? { scale: 0.95 } : {}}
        >
          Open
        </motion.button>
      </div>
    </div>
  );
}

export function ChestCard() {
  const { pendingChests } = useUserStore();

  if (pendingChests.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="mb-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <div className="space-y-2">
          {pendingChests.map((chest) => (
            <ChestItem key={chest.id} chest={chest} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
