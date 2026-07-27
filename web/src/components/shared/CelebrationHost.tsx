import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { useConfetti } from '@/hooks/useConfetti';
import { getBadge } from '@/data/badges';
import { pickZippyLine } from '@/data/zippy';
import { Zippy } from '@/components/shared/Zippy';

type Celebration =
  | { kind: 'level'; level: number }
  | { kind: 'badge'; badgeId: string }
  | { kind: 'quest'; title: string; xpReward: number; signsReward: number };

// Mounted once inside the authed app tree. Watches the progress store for level-ups and newly
// earned badges — both of which the app otherwise applies silently — and shows a one-at-a-time
// celebration modal for each.
//
// The hard part is NOT celebrating on things that aren't achievements: when a user signs in,
// useProgressSync pulls their remote progress and mergeProgress() can bump level/badges up to the
// server's values in one shot. That's hydration, not a live win. So the host stays *disarmed* for
// a short window around every auth-identity change, silently absorbing whatever the merge does into
// its baseline refs, and only fires for increases that happen once it's armed (i.e. real gameplay).
export function CelebrationHost() {
  const level = useUserStore((s) => s.level);
  const badges = useUserStore((s) => s.badges);
  const dailyQuests = useUserStore((s) => s.dailyQuests);
  const { user } = useAuth();

  const { burst, bigCelebration } = useConfetti();

  const [queue, setQueue] = useState<Celebration[]>([]);
  const current = queue[0] ?? null;

  // Baselines. Initialized lazily on first render to the current values so nothing fires for the
  // state the app booted with.
  const prevLevel = useRef<number | null>(null);
  const prevBadges = useRef<Set<string> | null>(null);
  const prevClaimedQuests = useRef<Set<string> | null>(null);
  const armed = useRef(false);
  const initialized = useRef(false);
  const lastUserId = useRef<string | undefined>(undefined);

  // Disarm around auth-identity changes (login, logout) AND the initial mount, re-arming after a
  // settle window so the post-sign-in progress merge (which can bump level/badges up to the server
  // values) is absorbed as a baseline rather than celebrated. Two subtleties this handles:
  //   - A guest's user id is `undefined`, the same as the ref's starting value, so we can't detect
  //     "first mount" from the id alone — hence the explicit `initialized` flag for the baseline reset.
  //   - React StrictMode (dev) runs effects setup→cleanup→setup; the timer is therefore (re)scheduled
  //     unconditionally on every run, so the cleanup between the two setups can't leave us permanently
  //     disarmed.
  useEffect(() => {
    const uid = user?.id;
    if (!initialized.current || uid !== lastUserId.current) {
      prevLevel.current = useUserStore.getState().level;
      prevBadges.current = new Set(useUserStore.getState().badges);
      prevClaimedQuests.current = new Set(
        useUserStore.getState().dailyQuests.filter((q) => q.claimed).map((q) => q.id)
      );
    }
    initialized.current = true;
    lastUserId.current = uid;
    armed.current = false;
    const t = setTimeout(() => { armed.current = true; }, 1800);
    return () => clearTimeout(t);
  }, [user?.id]);

  // Detect increases. When disarmed, quietly move the baseline; when armed, enqueue celebrations.
  useEffect(() => {
    if (prevLevel.current === null) prevLevel.current = level;
    if (prevBadges.current === null) prevBadges.current = new Set(badges);
    if (prevClaimedQuests.current === null) {
      prevClaimedQuests.current = new Set(dailyQuests.filter((q) => q.claimed).map((q) => q.id));
    }

    if (!armed.current) {
      prevLevel.current = level;
      prevBadges.current = new Set(badges);
      prevClaimedQuests.current = new Set(dailyQuests.filter((q) => q.claimed).map((q) => q.id));
      return;
    }

    const next: Celebration[] = [];
    if (level > prevLevel.current) next.push({ kind: 'level', level });
    for (const id of badges) {
      if (!prevBadges.current.has(id)) next.push({ kind: 'badge', badgeId: id });
    }
    for (const quest of dailyQuests) {
      if (quest.claimed && !prevClaimedQuests.current.has(quest.id)) {
        next.push({ kind: 'quest', title: quest.title, xpReward: quest.xpReward, signsReward: quest.signsReward });
      }
    }

    prevLevel.current = level;
    prevBadges.current = new Set(badges);
    prevClaimedQuests.current = new Set(dailyQuests.filter((q) => q.claimed).map((q) => q.id));

    if (next.length) setQueue((q) => [...q, ...next]);
  }, [level, badges, dailyQuests]);

  // Fire confetti whenever a new celebration reaches the front of the queue.
  useEffect(() => {
    if (!current) return;
    if (current.kind === 'level') bigCelebration();
    else burst();
  }, [current, burst, bigCelebration]);

  const dismiss = () => setQueue((q) => q.slice(1));

  const badge = current?.kind === 'badge' ? getBadge(current.badgeId) : null;
  // A badge id with no definition (e.g. removed in a later release) shouldn't strand a blank modal.
  if (current?.kind === 'badge' && !badge) {
    // Drop it on the next tick; render nothing meanwhile.
    queueMicrotask(dismiss);
    return null;
  }

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />
          <motion.div
            className="relative w-full max-w-sm bg-z-card border border-white/10 rounded-3xl p-6 shadow-2xl text-center"
            initial={{ y: 40, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          >
            {current.kind === 'level' ? (
              <>
                <Zippy expression="levelup" size="lg" priority className="mx-auto mb-3" />
                <p className="text-xs font-bold uppercase tracking-widest text-z-purple-light mb-1">
                  Level up
                </p>
                <h2 className="font-bold text-2xl mb-1">Level {current.level}</h2>
                <p className="text-z-gray-300 text-sm mb-5">{pickZippyLine('levelUp')}</p>
              </>
            ) : current.kind === 'badge' ? (
              <>
                <Zippy expression="achievement" size="lg" priority className="mx-auto mb-3" />
                <p className="text-xs font-bold uppercase tracking-widest text-z-yellow mb-1">
                  {pickZippyLine('badgeEarned')}
                </p>
                <h2 className="font-bold text-2xl mb-1 flex items-center justify-center gap-2">
                  <span className="text-3xl">{badge!.icon}</span>
                  {badge!.title}
                </h2>
                <p className="text-z-gray-300 text-sm mb-1">{badge!.description}</p>
                {badge!.goldReward > 0 && (
                  <p className="text-z-yellow text-xs mb-4">+{badge!.goldReward} 🪙</p>
                )}
                {badge!.goldReward === 0 && <div className="mb-4" />}
              </>
            ) : (
              <>
                <Zippy expression="achievement" size="lg" priority className="mx-auto mb-3" />
                <p className="text-xs font-bold uppercase tracking-widest text-z-green mb-1">
                  Quest complete
                </p>
                <h2 className="font-bold text-2xl mb-3">{current.title}</h2>
                <p className="text-sm mb-5 flex items-center justify-center gap-3">
                  <span className="text-z-yellow font-semibold">+{current.xpReward} XP</span>
                  <span className="text-z-purple-glow font-semibold">+{current.signsReward} 🤟</span>
                </p>
              </>
            )}
            <button
              onClick={dismiss}
              className="w-full py-2.5 rounded-xl bg-z-purple text-white font-bold text-sm"
            >
              {queue.length > 1 ? 'Next' : 'Continue'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
