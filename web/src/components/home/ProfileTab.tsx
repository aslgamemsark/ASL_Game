import { useState } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { SetUsernameModal } from '@/components/auth/SetUsernameModal';
import { BadgesSection } from '@/components/home/BadgesSection';
import { getBadge } from '@/data/badges';
import { Tooltip } from '@/components/shared/Tooltip';
import { getRankProgress } from '@/data/ranks';
import { SHOP_ITEMS, getShopItem } from '@/data/shop';

const FIRE_REST  = { rotate: 0, x: 0, scale: 1, filter: 'brightness(1) drop-shadow(0 0 0px rgba(249,115,22,0))', transition: { duration: 0.3, ease: 'easeOut' as const } };
const FIRE_HOVER = { rotate: [0, -4, 3, -3, 2, 0], x: [0, -1.5, 1, -1, 0.5, 0], scale: [1, 1.09, 1.04, 1.11, 1.05, 1], filter: ['brightness(1) drop-shadow(0 0px 0px rgba(249,115,22,0))', 'brightness(1.25) drop-shadow(0 -3px 8px rgba(249,115,22,0.7))', 'brightness(1.3) drop-shadow(0 -4px 10px rgba(249,115,22,0.8))', 'brightness(1) drop-shadow(0 0px 0px rgba(249,115,22,0))'], transition: { duration: 1.9, repeat: Infinity, ease: 'easeInOut' as const } };
const SPARKLE_REST  = { scale: 1, filter: 'brightness(1) drop-shadow(0 0 0px rgba(94,234,212,0))', transition: { duration: 0.3, ease: 'easeOut' as const } };
const SPARKLE_HOVER = { scale: [1, 1.07, 1, 1.05, 1], filter: ['brightness(1) drop-shadow(0 0 0px rgba(94,234,212,0))', 'brightness(1.6) drop-shadow(0 0 6px rgba(94,234,212,0.8))', 'brightness(1) drop-shadow(0 0 0px rgba(94,234,212,0))'], transition: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' as const } };

const CONFETTI = [
  { x: -26, y: -30, rot: -130, color: '#A78BFA', w: 5, h: 3 }, { x: -36, y: -16, rot: -158, color: '#F97316', w: 4, h: 4 },
  { x: -20, y: -40, rot: -92,  color: '#5EEAD4', w: 3, h: 5 }, { x: -40, y: -26, rot: -58,  color: '#FDBA74', w: 5, h: 3 },
  { x: -15, y: -22, rot: -176, color: '#7C3AED', w: 4, h: 4 }, { x:  26, y: -30, rot:  130, color: '#14B8A6', w: 5, h: 3 },
  { x:  36, y: -16, rot:  158, color: '#A78BFA', w: 4, h: 4 }, { x:  20, y: -40, rot:  92,  color: '#F97316', w: 3, h: 5 },
  { x:  40, y: -26, rot:  58,  color: '#FDBA74', w: 5, h: 3 }, { x:  15, y: -22, rot:  176, color: '#7C3AED', w: 4, h: 4 },
];

function TrophyIcon({ burst }: { burst: number }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <motion.span className="text-2xl inline-block" variants={{ rest: { scale: 1, y: 0, rotate: 0, transition: { duration: 0.25 } }, hover: { scale: 1.18, y: -3, rotate: [-5, 5, -3, 0], transition: { duration: 0.4 } } }}>🏆</motion.span>
      {burst > 0 && (
        <div key={burst} className="absolute inset-0 pointer-events-none">
          {CONFETTI.map((p, i) => (
            <motion.div key={i} className="absolute rounded-sm" style={{ width: p.w, height: p.h, background: p.color, top: '50%', left: '50%', marginLeft: -p.w / 2, marginTop: -p.h / 2, zIndex: 20 }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0 }}
              animate={{ x: p.x, y: p.y, opacity: [1, 1, 0], rotate: p.rot, scale: [0, 1.2, 0.9] }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: i * 0.025 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function cardVariants(glowColor: string) {
  return {
    rest:  { scale: 1, y: 0, boxShadow: '0 0 0 rgba(0,0,0,0)', transition: { duration: 0.22 } },
    hover: { scale: 1.05, y: -4, boxShadow: `0 10px 28px ${glowColor}`, transition: { duration: 0.22 } },
  };
}

export function ProfileTab() {
  const { xp, level, streak, signs, gold, lastPracticeDate, completedLessons, signAccuracy, badges, showcaseBadges, speedHighScores, activeBadge, equippedAvatar, equippedBorder, ownedCosmetics, equipAvatar, equipBorder } = useUserStore();
  const borderClasses = equippedBorder ? (getShopItem(equippedBorder)?.preview ?? '') : '';
  const { user, username } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showSetUsername, setShowSetUsername] = useState(false);
  const [levelBurst, setLevelBurst] = useState(0);
  const [profileSection, setProfileSection] = useState<'stats' | 'badges'>('stats');
  const [cosmeticTab, setCosmeticTab] = useState<'avatar' | 'border'>('avatar');

  const totalSigns = Object.keys(signAccuracy).length;
  const masteredSigns = Object.values(signAccuracy).filter((s) => s.successes >= 3 && s.successes / s.attempts >= 0.7).length;
  const bestSpeed = Object.entries(speedHighScores).reduce<{ tier: string; score: number } | null>((best, [tier, hs]) => (!best || hs.score > best.score) ? { tier, score: hs.score } : best, null);

  return (
    <div className="px-4 pb-24">
      {/* Auth banner */}
      <motion.div className="mb-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {user ? (
          <div className="bg-z-card border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-z-purple to-z-purple-deep flex items-center justify-center text-lg ${borderClasses}`}>
                {equippedAvatar
                  ? (SHOP_ITEMS.find((i) => i.id === equippedAvatar)?.icon ?? '🤟')
                  : activeBadge ? (getBadge(activeBadge)?.icon ?? '🤟') : '🤟'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-sm">@{username ?? '…'}</p>
                  <button
                    onClick={() => setShowSetUsername(true)}
                    className="text-z-gray-500 hover:text-z-gray-300 transition-colors"
                    title="Change username"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
                <p className="text-z-gray-400 text-xs">Progress syncing</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-z-card border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">Save your progress</p>
              <p className="text-z-gray-400 text-xs">Sign in to sync + join leaderboards</p>
            </div>
            <button onClick={() => setShowAuth(true)} className="text-xs bg-z-purple text-white rounded-xl px-4 py-2 font-bold">Sign in</button>
          </div>
        )}
      </motion.div>

      {/* Avatar + showcase */}
      <motion.div className="text-center mb-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <motion.div
          className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-z-purple to-z-purple-deep flex items-center justify-center text-4xl mx-auto mb-3 cursor-default ${borderClasses || 'shadow-lg shadow-z-purple/30'}`}
          animate={{ rotate: 0, scale: 1 }}
          whileHover={{ rotate: [0, -12, 12, -8, 0], scale: 1.08, transition: { duration: 0.45 } }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          {equippedAvatar
            ? (SHOP_ITEMS.find((i) => i.id === equippedAvatar)?.icon ?? '🤟')
            : activeBadge ? (getBadge(activeBadge)?.icon ?? '🤟') : '🤟'}
        </motion.div>
        {showcaseBadges.length > 0 && (
          <div className="flex justify-center gap-2 mb-2">
            {showcaseBadges.map((id) => {
              const b = getBadge(id);
              return b ? (
                <Tooltip key={id} title={b.title} description={b.description} placement="bottom">
                  <span className="text-lg" tabIndex={0}>{b.icon}</span>
                </Tooltip>
              ) : null;
            })}
          </div>
        )}
        <p className="text-z-gray-300 text-sm">
          {masteredSigns > 0 ? `${masteredSigns} of ${totalSigns} signs mastered` : 'Start signing to track progress'}
        </p>
        {badges.length > 0 && (
          <p className="text-z-gray-400 text-xs mt-0.5">{badges.length} badge{badges.length !== 1 ? 's' : ''} earned</p>
        )}
      </motion.div>

      {/* Rank card */}
      {(() => {
        const { rank, next, progress } = getRankProgress(xp);
        return (
          <motion.div className="bg-z-card border border-white/5 rounded-2xl p-4 mb-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{rank.emoji}</span>
                <div>
                  <p className="font-bold text-sm">{rank.name}</p>
                  <p className="text-[11px] text-z-gray-400">{xp.toLocaleString()} XP total</p>
                </div>
              </div>
              {next && (
                <div className="text-right">
                  <p className="text-[11px] text-z-gray-400">Next rank</p>
                  <p className="text-xs font-bold text-z-gray-300">{next.emoji} {next.name}</p>
                  <p className="text-[10px] text-z-gray-500">{(next.minXp - xp).toLocaleString()} XP away</p>
                </div>
              )}
            </div>
            <div className="h-2 bg-z-surface rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #7B2FBE, #A855F7)' }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(progress * 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            {!next && <p className="text-[11px] text-z-yellow text-center mt-2 font-bold">Max rank reached! 🌟</p>}
          </motion.div>
        );
      })()}

      {/* Stats / Badges section toggle */}
      <div className="flex bg-z-surface/50 rounded-xl p-1 mb-5">
        {(['stats', 'badges'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setProfileSection(s)}
            className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${
              profileSection === s ? 'bg-z-card text-z-gray-50' : 'text-z-gray-400'
            }`}
          >
            {s === 'stats' ? '📊 Stats' : `🏅 Badges (${badges.length})`}
          </button>
        ))}
      </div>

      {profileSection === 'stats' && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0 }}>
              <motion.div className="bg-z-card border border-white/5 rounded-2xl p-4 text-center cursor-default" initial="rest" animate="rest" whileHover="hover" variants={cardVariants('rgba(94,234,212,0.22)')}>
                <motion.span className="text-2xl inline-block" variants={{ rest: SPARKLE_REST, hover: SPARKLE_HOVER }}>✨</motion.span>
                <p className="text-2xl font-bold mt-1 text-z-yellow">{xp}</p>
                <p className="text-[11px] text-z-gray-400 mt-0.5 tracking-wide">Total XP</p>
              </motion.div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.06 }}>
              <motion.div className="bg-z-card border border-white/5 rounded-2xl p-4 text-center cursor-default" initial="rest" animate="rest" whileHover="hover" onHoverStart={() => setLevelBurst((b) => b + 1)} variants={cardVariants('rgba(250,204,21,0.32)')}>
                <TrophyIcon burst={levelBurst} />
                <p className="text-2xl font-bold mt-1 text-z-orange">{level}</p>
                <p className="text-[11px] text-z-gray-400 mt-0.5 tracking-wide">Level</p>
              </motion.div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12 }}>
              <motion.div className="bg-z-card border border-white/5 rounded-2xl p-4 text-center cursor-default" initial="rest" animate="rest" whileHover="hover" variants={cardVariants('rgba(249,115,22,0.22)')}>
                <motion.span className="text-2xl inline-block" variants={{ rest: FIRE_REST, hover: FIRE_HOVER }}>🔥</motion.span>
                <p className="text-2xl font-bold mt-1 text-z-orange-bright">{streak}d</p>
                <p className="text-[11px] text-z-gray-400 mt-0.5 tracking-wide">Streak</p>
              </motion.div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.18 }}>
              <motion.div className="bg-z-card border border-white/5 rounded-2xl p-4 text-center cursor-default" initial="rest" animate="rest" whileHover="hover" variants={cardVariants('rgba(96,165,250,0.32)')}>
                <motion.span className="text-2xl inline-block" variants={{ rest: { y: 0, rotate: 0, transition: { duration: 0.25 } }, hover: { y: -5, rotate: [0, -7, 6, -4, 0], transition: { duration: 0.55 } } }}>📖</motion.span>
                <p className="text-2xl font-bold mt-1 text-z-purple-light">{completedLessons.length}</p>
                <p className="text-[11px] text-z-gray-400 mt-0.5 tracking-wide">Completed</p>
              </motion.div>
            </motion.div>
          </div>

          {/* Currency */}
          <motion.div className="bg-z-card border border-white/5 rounded-2xl p-4 mb-5 flex justify-around" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            <div className="text-center">
              <p className="text-xl font-bold text-z-purple-light">🤟 {signs}</p>
              <p className="text-[11px] text-z-gray-400 mt-0.5">Signs</p>
            </div>
            <div className="w-px bg-z-gray-500/40" />
            <div className="text-center">
              <p className="text-xl font-bold text-z-yellow">🪙 {gold}</p>
              <p className="text-[11px] text-z-gray-400 mt-0.5">Gold</p>
            </div>
            {bestSpeed && (
              <>
                <div className="w-px bg-z-gray-500/40" />
                <div className="text-center">
                  <p className="text-xl font-bold text-z-blue">⚡ {bestSpeed.score}</p>
                  <p className="text-[11px] text-z-gray-400 mt-0.5">Best speed</p>
                </div>
              </>
            )}
          </motion.div>

          {/* Cosmetics selector — avatars + borders */}
          {(() => {
            const ownedAvatars = SHOP_ITEMS.filter((i) => i.type === 'avatar' && ownedCosmetics.includes(i.id));
            const ownedBorders = SHOP_ITEMS.filter((i) => i.type === 'border' && ownedCosmetics.includes(i.id));
            if (ownedAvatars.length === 0 && ownedBorders.length === 0) return null;

            const items = cosmeticTab === 'avatar' ? ownedAvatars : ownedBorders;
            const isEquippedId = cosmeticTab === 'avatar' ? equippedAvatar : equippedBorder;
            const onToggle = cosmeticTab === 'avatar' ? equipAvatar : equipBorder;

            return (
              <motion.div className="bg-z-card border border-white/5 rounded-2xl p-4 mb-5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
                <div className="flex bg-z-surface/50 rounded-lg p-1 mb-3 gap-1 w-fit">
                  {(['avatar', 'border'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setCosmeticTab(t)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                        cosmeticTab === t ? 'bg-z-card text-white' : 'text-z-gray-400 hover:text-z-gray-200'
                      }`}
                    >
                      {t === 'avatar' ? 'Avatars' : 'Borders'}
                    </button>
                  ))}
                </div>

                {items.length === 0 ? (
                  <p className="text-[11px] text-z-gray-500">
                    No {cosmeticTab === 'avatar' ? 'avatars' : 'borders'} owned yet — check the Shop!
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => {
                      const isEquipped = isEquippedId === item.id;
                      return (
                        <motion.button
                          key={item.id}
                          onClick={() => onToggle(isEquipped ? null : item.id)}
                          className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 border-2 transition-colors ${
                            isEquipped
                              ? 'border-z-purple bg-z-purple/20 shadow-md shadow-z-purple/30'
                              : 'border-white/10 bg-z-surface/40 hover:border-z-purple/50'
                          }`}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          title={item.title}
                        >
                          {cosmeticTab === 'border' ? (
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br from-z-purple to-z-purple-deep ${item.preview}`} />
                          ) : (
                            <span className="text-2xl">{item.icon}</span>
                          )}
                          {isEquipped && <span className="text-[8px] font-bold text-z-purple-light leading-none">ON</span>}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
                {isEquippedId && items.length > 0 && (
                  <p className="text-[11px] text-z-gray-400 mt-2">Tap your equipped {cosmeticTab} to unequip</p>
                )}
              </motion.div>
            );
          })()}

          {/* Weekly calendar */}
          <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5 mb-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
            <h3 className="font-bold text-base mb-3 tracking-wide">This Week</h3>
            <div className="flex justify-between">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                const today = new Date();
                const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
                const isToday = i === todayIdx;
                const isFuture = i > todayIdx;
                let practiced = false;
                if (lastPracticeDate && streak > 0) {
                  const last = new Date(lastPracticeDate);
                  const lastIdx = last.getDay() === 0 ? 6 : last.getDay() - 1;
                  const daysAgo = todayIdx - i + (lastIdx < todayIdx ? todayIdx - lastIdx : 0);
                  practiced = daysAgo >= 0 && daysAgo < streak && i <= lastIdx;
                }
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] text-z-gray-400 font-semibold">{day}</span>
                    <div className={`relative w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                      isToday && lastPracticeDate === today.toISOString().slice(0, 10)
                        ? 'bg-z-purple text-white shadow-md shadow-z-purple/40'
                        : isToday ? 'bg-z-purple/30 text-z-purple-light border border-z-purple/40'
                        : practiced ? 'bg-z-green/20 text-z-green'
                        : isFuture ? 'bg-transparent text-z-gray-500 border border-z-gray-500/20'
                        : 'bg-z-surface/40 text-z-gray-500'
                    }`}>
                      {practiced || (isToday && lastPracticeDate === today.toISOString().slice(0, 10)) ? '✓' : isToday ? '●' : ''}
                      {isToday && (
                        <motion.div className="absolute inset-0 rounded-xl border-2 border-z-purple-light"
                          animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

        </>
      )}

      {profileSection === 'badges' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <BadgesSection />
        </motion.div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showSetUsername && <SetUsernameModal mode="rename" onClose={() => setShowSetUsername(false)} />}
    </div>
  );
}
