import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/stores/useUserStore';
import { useConfetti } from '@/hooks/useConfetti';
import { Zippy } from '@/components/shared/Zippy';
import { pickZippyLine } from '@/data/zippy';
import { ChestIcon } from '@/components/home/ChestIcon';
import type { Chest } from '@/types/user';

/** How long an opened-chest's reward row stays visible before it's cleared from ChestCard. */
const REWARD_VISIBLE_MS = 5000;

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

function ChestRewardRow({ result }: { result: { signs: number; gold: number } }) {
  return (
    <motion.div
      className="flex items-center gap-3 bg-z-card border border-z-green/30 rounded-2xl p-4"
      initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', damping: 12, stiffness: 260 }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10, stiffness: 300, delay: 0.1 }}
      >
        <Zippy expression="reward" size="xs" />
      </motion.div>
      <div className="flex-1">
        <p className="font-bold text-sm text-z-green">{pickZippyLine('chestReward')}</p>
        <p className="text-xs text-z-gray-300 mt-0.5">
          +{result.signs} 🤟 Signs · +{result.gold} 🪙 Gold
        </p>
      </div>
    </motion.div>
  );
}

interface ChestItemProps {
  chest: Chest;
  onOpened: (chestId: string, result: { signs: number; gold: number }) => void;
}

function ChestItem({ chest, onOpened }: ChestItemProps) {
  const { gold, openChest, skipChest } = useUserStore();
  const { bigCelebration } = useConfetti();
  const now = useNow();
  const ready = chest.readyAt <= now;
  const msLeft = Math.max(0, chest.readyAt - now);
  const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
  const skipCost = Math.max(5, hoursLeft * 20);
  const [opening, setOpening] = useState(false);

  // Every chest id is `chest-<createdAtMs>` or `streak-chest-<createdAtMs>` (useUserStore.ts) —
  // reading the timestamp back out of it gives a real cooldown-progress fraction for the ring
  // without adding a persisted field to the Chest type just for this display.
  const createdAt = Number(chest.id.slice(chest.id.lastIndexOf('-') + 1));
  const totalMs = chest.readyAt - createdAt;
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, (now - createdAt) / totalMs)) : 1;

  const handleOpen = () => {
    if (!ready || opening) return;
    setOpening(true);
  };

  // Called by ChestIcon once the open flourish (shake -> lid pop -> golden flash) resolves —
  // the actual reward is granted here, right as the reveal lands, not at the initial click.
  // Memoized: ChestIcon's animation-sequence effect depends on this callback's identity, and
  // ChestItem re-renders every second (useNow's tick) — an unmemoized function here restarted
  // that effect on every tick, cancelling the in-flight sequence before it could ever resolve.
  //
  // Reports the result to ChestCard via `onOpened` instead of keeping it in local state:
  // openChest() removes this chest from the store's pendingChests list in the same tick, which
  // drops this ChestItem out of ChestCard's map() and unmounts it — any local "openResult" state
  // here would be destroyed before it ever got to render the reward panel. ChestCard outlives
  // the unmount, so it owns displaying the reward instead.
  const handleOpenComplete = useCallback(() => {
    const result = openChest(chest.id);
    onOpened(chest.id, result);
    bigCelebration();
  }, [chest.id, openChest, onOpened, bigCelebration]);

  const handleSkip = () => {
    skipChest(chest.id);
  };

  return (
    <div className="flex items-center gap-3 bg-z-card border border-white/8 rounded-2xl p-4">
      <ChestIcon
        size={48}
        ready={ready}
        progress={progress}
        opening={opening}
        onOpenComplete={handleOpenComplete}
      />
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
          disabled={!ready || opening}
          className={`text-xs px-3 py-1.5 rounded-xl font-bold disabled:cursor-default ${
            ready
              ? 'bg-z-purple text-white disabled:opacity-70'
              : 'bg-z-surface/50 text-z-gray-400'
          }`}
          whileTap={ready && !opening ? { scale: 0.95 } : {}}
        >
          {opening ? '…' : 'Open'}
        </motion.button>
      </div>
    </div>
  );
}

export function ChestCard() {
  const { pendingChests } = useUserStore();
  const [openedResults, setOpenedResults] = useState<Record<string, { signs: number; gold: number }>>({});

  const handleOpened = useCallback((chestId: string, result: { signs: number; gold: number }) => {
    setOpenedResults((prev) => ({ ...prev, [chestId]: result }));
    // Bounded, not standing forever: clears itself so a session with several opened chests
    // doesn't pile up reward rows indefinitely.
    setTimeout(() => {
      setOpenedResults((prev) => {
        const { [chestId]: _drop, ...rest } = prev;
        return rest;
      });
    }, REWARD_VISIBLE_MS);
  }, []);

  if (pendingChests.length === 0 && Object.keys(openedResults).length === 0) return null;

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
            <ChestItem key={chest.id} chest={chest} onOpened={handleOpened} />
          ))}
          <AnimatePresence>
            {Object.entries(openedResults).map(([id, result]) => (
              <ChestRewardRow key={id} result={result} />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
