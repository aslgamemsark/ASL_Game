import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WORLDS } from '@/data/worlds';
import { LESSON_UNITS } from '@/data/lessons';
import { STORIES } from '@/data/stories';
import { useUserStore } from '@/stores/useUserStore';
import { LessonNode } from './LessonNode';

interface Props {
  onSelectLesson: (id: string) => void;
  onStartStory: (id: string) => void;
}

export function WorldMap({ onSelectLesson, onStartStory }: Props) {
  const { completedLessons } = useUserStore();
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);

  const selectedWorld = WORLDS.find((w) => w.id === selectedWorldId);

  function isWorldUnlocked(world: (typeof WORLDS)[0]): boolean {
    if (!world.unlockCondition) return true;
    return completedLessons.includes(world.unlockCondition);
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

  function getNodeStatus(nodeId: string): 'completed' | 'current' | 'locked' {
    if (completedLessons.includes(nodeId)) return 'completed';
    for (const unit of LESSON_UNITS) {
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
                  const status = getNodeStatus(node.id);
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
                      <span className="text-2xl">{node.iconEmoji}</span>
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
                    node={{ ...node, status: getNodeStatus(node.id) }}
                    index={unitIdx * 10 + nodeIdx}
                    unitColor={unit.color}
                    onSelect={onSelectLesson}
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
        {WORLDS.map((world, i) => {
          const unlocked = isWorldUnlocked(world);
          const { done, total } = getWorldProgress(world);
          const pct = total > 0 ? (done / total) * 100 : 0;

          return (
            <motion.button
              key={world.id}
              onClick={() => unlocked && setSelectedWorldId(world.id)}
              disabled={!unlocked}
              className={`w-full rounded-2xl overflow-hidden border text-left relative ${
                unlocked
                  ? 'border-white/10'
                  : 'border-white/5 opacity-55 cursor-default'
              }`}
              style={{ background: unlocked ? world.bgGradient : 'linear-gradient(135deg,#1a1a2e,#16213e)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={unlocked ? { scale: 1.02, boxShadow: `0 14px 40px ${world.color}44` } : {}}
              whileTap={unlocked ? { scale: 0.98 } : {}}
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
                  {!unlocked && <span className="text-2xl shrink-0">🔒</span>}
                  {unlocked && done === total && total > 0 && <span className="text-2xl shrink-0">✅</span>}
                  {unlocked && (done < total || total === 0) && (
                    <span className="text-white/70 text-sm font-bold shrink-0 mt-1">{done}/{total}</span>
                  )}
                </div>

                {unlocked ? (
                  <>
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
                  </>
                ) : (
                  <p className="text-white/60 text-xs mt-1">
                    Finish {world.unlockCondition?.replace(/-/g, ' ')} to open this world!
                  </p>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
