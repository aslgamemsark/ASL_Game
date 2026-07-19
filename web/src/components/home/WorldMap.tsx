import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WORLDS, WORLD_UNLOCK_GOLD_COST } from '@/data/worlds';
import { LESSON_UNITS, LESSON_SKIP_COST } from '@/data/lessons';
import { STORIES } from '@/data/stories';
import { Zippy } from '@/components/shared/Zippy';

// Maps a world's unlockCondition (a raw story/lesson id like "coffee-story") to a real display
// title. The previous code did `unlockCondition.replace(/-/g, ' ')`, which for "greetings-story"
// produced "greetings story" — a raw internal id leaking into copy, and actively misleading since
// that story's real title is "Meet Zippy" (first-time-user pass, 2026-07-12).
function unlockConditionLabel(conditionId: string): string {
  return STORIES.find((s) => s.id === conditionId)?.title ?? conditionId.replace(/-/g, ' ');
}
import { useUserStore } from '@/stores/useUserStore';
import { supabase, supabaseReady } from '@/lib/supabase';
import { LessonNode } from './LessonNode';

interface Props {
  onSelectLesson: (id: string) => void;
  onStartStory: (id: string) => void;
}

interface WorldFlag {
  enabled: boolean;
  coming_soon: boolean;
}

export function WorldMap({ onSelectLesson, onStartStory }: Props) {
  const { completedLessons, signs, skipLesson, gold, unlockedWorldIds, unlockWorldWithGold } = useUserStore();
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  // Admin-controlled override layer on top of the static WORLDS array (see AdminPanel's Worlds
  // tab) — lets a world be hidden or marked "coming soon" without a code deploy. Missing row =
  // default (visible, not coming-soon), so this is a no-op until an admin actually touches it.
  const [worldFlags, setWorldFlags] = useState<Record<string, WorldFlag>>({});

  useEffect(() => {
    if (!supabaseReady) return;
    (async () => {
      const { data } = (await supabase.from('world_flags').select('world_id, enabled, coming_soon')) as {
        data: { world_id: string; enabled: boolean; coming_soon: boolean }[] | null;
      };
      const map: Record<string, WorldFlag> = {};
      for (const row of data ?? []) map[row.world_id] = { enabled: row.enabled, coming_soon: row.coming_soon };
      setWorldFlags(map);
    })();
  }, []);

  const visibleWorlds = WORLDS.filter((w) => worldFlags[w.id]?.enabled !== false);
  const selectedWorld = visibleWorlds.find((w) => w.id === selectedWorldId);

  // A world opens either by finishing the previous world's story, OR by paying gold instead —
  // the two are independent paths, so unlockedWorldIds never touches completedLessons (that
  // would falsely mark a story "done" that was actually skipped).
  function isWorldUnlocked(world: (typeof WORLDS)[0]): boolean {
    if (worldFlags[world.id]?.coming_soon) return false;
    if (!world.unlockCondition) return true;
    return completedLessons.includes(world.unlockCondition) || unlockedWorldIds.includes(world.id);
  }

  function getWorldProgress(world: (typeof WORLDS)[0]) {
    const units = LESSON_UNITS.filter((u) => world.unitIds.includes(u.id));
    let done = 0, total = 0;
    for (const unit of units) {
      for (const node of unit.nodes) {
        total++;
        if (completedLessons.includes(node.id)) done++;
      }
    }
    return { done, total };
  }

  // Scoped to the CURRENT world's own units, not the global LESSON_UNITS list — a world reached
  // via gold-unlock (see isWorldUnlocked above) is an independent path from story progression, so
  // its own first lesson must be playable without requiring every earlier world to be finished.
  function getNodeStatus(nodeId: string, worldUnits: typeof LESSON_UNITS): 'completed' | 'current' | 'locked' {
    if (completedLessons.includes(nodeId)) return 'completed';
    for (const unit of worldUnits) {
      for (const node of unit.nodes) {
        if (!completedLessons.includes(node.id)) {
          return node.id === nodeId ? 'current' : 'locked';
        }
      }
    }
    return 'locked';
  }

  if (selectedWorld) {
    const units = LESSON_UNITS.filter((u) => selectedWorld.unitIds.includes(u.id));
    const { done, total } = getWorldProgress(selectedWorld);

    return (
      <div className="pb-32">
        {/* Back + world header */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => setSelectedWorldId(null)}
            className="flex items-center gap-2 text-z-gray-400 hover:text-white text-sm mb-4 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            All Worlds
          </button>
          <div
            className="rounded-2xl p-5 border border-white/10"
            style={{ background: selectedWorld.bgGradient }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{selectedWorld.emoji}</span>
              <div>
                <h2 className="font-bold text-xl text-white">{selectedWorld.title}</h2>
                <p className="text-white/60 text-sm">{selectedWorld.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-white/60 mb-1.5">
              <span>{done}/{total} lessons</span>
              <span>{total > 0 ? Math.round((done / total) * 100) : 0}%</span>
            </div>
            <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-white/70"
                initial={{ width: 0 }}
                animate={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>

        {units.map((unit, unitIdx) => (
          <div key={unit.id} className="mb-10">
            <motion.div
              className="rounded-2xl p-4 mb-6 mx-1 border border-white/5 cursor-default"
              style={{ background: `linear-gradient(135deg, ${unit.color}18, ${unit.color}08)` }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: unitIdx * 0.1 }}
            >
              <h3 className="font-bold text-base tracking-wide" style={{ color: unit.color }}>
                {unit.title}
              </h3>
              <p className="text-xs text-z-gray-300 mt-0.5">{unit.description}</p>
            </motion.div>
            <div className="flex flex-col items-center gap-7">
              {unit.nodes.map((node, nodeIdx) => {
                // A node is a "story" card whenever its id matches ANY registered story, not just
                // the world's primary one — lets a world host more than one story (e.g. a second,
                // harder chapter) without widening World.storyId's single-value badge/unlock role.
                const isStoryNode = node.id === selectedWorld.storyId || STORIES.some((s) => s.id === node.id);
                if (isStoryNode) {
                  const status = getNodeStatus(node.id, units);
                  // Dr. Zippy / Mr. Zippy / the coffee-shop barista are Zippy in costume — show
                  // that art here too instead of the generic emoji, so the character who's
                  // actually waiting to talk to you is visible before you even tap in.
                  const npcCostume = STORIES.find((s) => s.id === node.id)?.npcCostume;
                  return (
                    <motion.button
                      key={node.id}
                      onClick={() => onStartStory(node.id)}
                      disabled={status === 'locked'}
                      className={`flex items-center gap-3 px-5 py-3 rounded-2xl border text-left w-64 ${
                        status === 'locked'
                          ? 'border-white/5 bg-z-surface/30 opacity-50 cursor-default'
                          : status === 'completed'
                            ? 'border-z-green/30 bg-z-green/10'
                            : 'border-z-purple/40 bg-z-purple/20 cursor-pointer'
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: unitIdx * 0.1 + nodeIdx * 0.05 }}
                      whileHover={status !== 'locked' ? { scale: 1.02 } : {}}
                      whileTap={status !== 'locked' ? { scale: 0.97 } : {}}
                    >
                      {npcCostume ? (
                        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-z-purple">
                          <Zippy expression={npcCostume} fit="cover" />
                        </div>
                      ) : (
                        <span className="text-2xl">{node.iconEmoji}</span>
                      )}
                      <div>
                        <p className="font-bold text-sm">{node.title}</p>
                        <p className="text-xs text-z-gray-400">{node.description}</p>
                      </div>
                      {status === 'completed' && <span className="ml-auto text-z-green">✓</span>}
                      {status === 'locked' && <span className="ml-auto text-z-gray-500">🔒</span>}
                    </motion.button>
                  );
                }
                return (
                  <LessonNode
                    key={node.id}
                    node={{ ...node, status: getNodeStatus(node.id, units) }}
                    index={unitIdx * 10 + nodeIdx}
                    unitColor={unit.color}
                    onSelect={onSelectLesson}
                    skipCost={LESSON_SKIP_COST}
                    signsBalance={signs}
                    onSkip={(id) => skipLesson(id, LESSON_SKIP_COST)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pb-32">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-2xl font-bold mb-1 tracking-tight">Worlds</h2>
          <p className="text-z-gray-300 text-sm mb-6">Choose a world to explore</p>
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-col gap-4">
        {visibleWorlds.map((world, i) => {
          const unlocked = isWorldUnlocked(world);
          const comingSoon = worldFlags[world.id]?.coming_soon ?? false;
          const { done, total } = getWorldProgress(world);
          const pct = total > 0 ? (done / total) * 100 : 0;

          if (!unlocked) {
            // A locked card can't be a <button> itself once it contains its own "Unlock for
            // gold" button — nested buttons are invalid HTML — so it renders as a plain
            // container with only the gold-unlock control being interactive.
            const canAfford = gold >= WORLD_UNLOCK_GOLD_COST;
            return (
              <motion.div
                key={world.id}
                className="w-full rounded-2xl overflow-hidden border border-white/5 text-left relative opacity-90"
                style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl grayscale opacity-70">{world.emoji}</span>
                      <div>
                        <h3 className="font-bold text-lg text-white">{world.title}</h3>
                        <p className="text-white/60 text-xs mt-0.5 max-w-[180px]">{world.description}</p>
                      </div>
                    </div>
                    <span className="text-2xl shrink-0">{comingSoon ? '🚧' : '🔒'}</span>
                  </div>

                  {comingSoon ? (
                    <p className="text-white/60 text-xs mt-1 mb-1">Coming soon!</p>
                  ) : (
                    <>
                      <p className="text-white/60 text-xs mt-1 mb-3">
                        Finish {world.unlockCondition ? unlockConditionLabel(world.unlockCondition) : 'the previous world'} to open this world!
                      </p>
                      <button
                        onClick={() => unlockWorldWithGold(world.id, WORLD_UNLOCK_GOLD_COST)}
                        disabled={!canAfford}
                        className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                          canAfford
                            ? 'bg-z-yellow/20 text-z-yellow hover:bg-z-yellow/30 cursor-pointer'
                            : 'bg-white/5 text-white/30 cursor-not-allowed'
                        }`}
                      >
                        🪙 Unlock for {WORLD_UNLOCK_GOLD_COST}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          }

          return (
            <motion.button
              key={world.id}
              onClick={() => setSelectedWorldId(world.id)}
              className="w-full rounded-2xl overflow-hidden border border-white/10 text-left relative"
              style={{ background: world.bgGradient }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.02, boxShadow: `0 14px 40px ${world.color}44` }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{world.emoji}</span>
                    <div>
                      <h3 className="font-bold text-lg text-white">{world.title}</h3>
                      <p className="text-white/60 text-xs mt-0.5 max-w-[180px]">{world.description}</p>
                    </div>
                  </div>
                  {done === total && total > 0 && <span className="text-2xl shrink-0">✅</span>}
                  {(done < total || total === 0) && (
                    <span className="text-white/70 text-sm font-bold shrink-0 mt-1">{done}/{total}</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-white/75 mb-1.5">
                  <span>{done} of {total} lessons</span>
                  <span>{Math.round(pct)}%</span>
                </div>
                <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-white/65"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.1 + 0.2 }}
                  />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
