import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ALL_BADGES, getBadge, BADGE_RARITY_COLOR, type BadgeDef } from '@/data/badges';
import { useUserStore } from '@/stores/useUserStore';
import { Tooltip } from '@/components/shared/Tooltip';

export function BadgesSection() {
  const { badges, activeBadge, showcaseBadges, setActiveBadge, toggleShowcaseBadge } =
    useUserStore();
  const [selected, setSelected] = useState<BadgeDef | null>(null);

  const earned = ALL_BADGES.filter((b) => badges.includes(b.id));
  const locked = ALL_BADGES.filter((b) => !badges.includes(b.id));

  return (
    <div>
      {/* Showcase strip */}
      {showcaseBadges.length > 0 && (
        <div className="flex items-center gap-2 mb-4 px-1">
          {showcaseBadges.map((id) => {
            const def = getBadge(id);
            if (!def) return null;
            return (
              <Tooltip key={id} title={def.title} description={def.description} placement="bottom">
                <motion.div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl bg-z-card border border-white/10"
                  style={{ boxShadow: `0 0 14px ${BADGE_RARITY_COLOR[def.rarity]}55` }}
                  whileHover={{ scale: 1.1 }}
                  tabIndex={0}
                >
                  {def.icon}
                </motion.div>
              </Tooltip>
            );
          })}
          <p className="text-xs text-z-gray-400 ml-1">Showcase</p>
        </div>
      )}

      {/* Earned badges */}
      {earned.length > 0 && (
        <>
          <p className="text-[11px] font-bold text-z-gray-400 uppercase tracking-widest mb-2">
            Earned · {earned.length}/{ALL_BADGES.length}
          </p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {earned.map((badge) => {
              const isActive = activeBadge === badge.id;
              const inShowcase = showcaseBadges.includes(badge.id);
              return (
                <Tooltip key={badge.id} title={badge.title} description={badge.description} className="aspect-square">
                  <motion.button
                    onClick={() => setSelected(badge)}
                    className={`w-full h-full rounded-2xl flex flex-col items-center justify-center gap-0.5 border relative ${
                      isActive
                        ? 'border-z-purple-light bg-z-purple/20'
                        : 'border-white/10 bg-z-card'
                    }`}
                    style={{
                      boxShadow: `0 0 16px ${BADGE_RARITY_COLOR[badge.rarity]}33`,
                    }}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.93 }}
                  >
                    <span className="text-2xl">{badge.icon}</span>
                    {inShowcase && (
                      <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-z-purple-light rounded-full" />
                    )}
                  </motion.button>
                </Tooltip>
              );
            })}
          </div>
        </>
      )}

      {/* Locked badges */}
      {locked.length > 0 && (
        <>
          <p className="text-[11px] font-bold text-z-gray-400 uppercase tracking-widest mb-2">
            Locked
          </p>
          <div className="grid grid-cols-4 gap-2">
            {locked.map((badge) => (
              <Tooltip
                key={badge.id}
                title={badge.title}
                description={`🔒 To unlock: ${badge.description}`}
                className="aspect-square"
              >
                <div
                  tabIndex={0}
                  className="w-full h-full rounded-2xl flex items-center justify-center border border-white/5 bg-z-surface/30 opacity-40"
                >
                  <span className="text-2xl grayscale">{badge.icon}</span>
                </div>
              </Tooltip>
            ))}
          </div>
        </>
      )}

      {earned.length === 0 && (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">🔒</p>
          <p className="text-z-gray-400 text-sm">Complete lessons and challenges to earn badges</p>
        </div>
      )}

      {/* Badge detail sheet */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="bg-z-card rounded-3xl p-6 w-full max-w-sm border border-white/10"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-5">
                <div className="text-5xl mb-2">{selected.icon}</div>
                <h3 className="font-bold text-xl">{selected.title}</h3>
                <p className="text-z-gray-400 text-sm mt-1">{selected.description}</p>
                <span
                  className="text-xs font-bold mt-2 inline-block tracking-widest uppercase"
                  style={{ color: BADGE_RARITY_COLOR[selected.rarity] }}
                >
                  {selected.rarity}
                </span>
                {selected.goldReward > 0 && (
                  <p className="text-z-yellow text-xs mt-1">Reward: +{selected.goldReward} 🪙</p>
                )}
              </div>

              <div className="flex gap-3">
                <motion.button
                  onClick={() => {
                    setActiveBadge(activeBadge === selected.id ? null : selected.id);
                    setSelected(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                    activeBadge === selected.id
                      ? 'bg-z-purple/25 border-z-purple-light text-z-purple-light'
                      : 'border-white/10 text-z-gray-300 hover:border-white/20'
                  }`}
                  whileTap={{ scale: 0.96 }}
                >
                  {activeBadge === selected.id ? '✓ Profile pic' : 'Set as PFP'}
                </motion.button>
                <motion.button
                  onClick={() => {
                    toggleShowcaseBadge(selected.id);
                    setSelected(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                    showcaseBadges.includes(selected.id)
                      ? 'bg-z-orange/20 border-z-orange text-z-orange'
                      : showcaseBadges.length >= 3
                        ? 'border-white/5 text-z-gray-500 cursor-not-allowed'
                        : 'border-white/10 text-z-gray-300 hover:border-white/20'
                  }`}
                  disabled={!showcaseBadges.includes(selected.id) && showcaseBadges.length >= 3}
                  whileTap={{ scale: 0.96 }}
                >
                  {showcaseBadges.includes(selected.id)
                    ? '✓ Showcased'
                    : showcaseBadges.length >= 3
                      ? 'Showcase full'
                      : 'Pin to showcase'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
