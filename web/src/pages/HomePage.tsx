import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TopBar } from '@/components/shared/TopBar';
import { StreakCard } from '@/components/home/StreakCard';
import { BottomNav, type Tab } from '@/components/home/BottomNav';
import { PracticeTab } from '@/components/home/PracticeTab';
import { ProfileTab } from '@/components/home/ProfileTab';
import { AlphabetTab } from '@/components/home/AlphabetTab';
import { BasicSignsTab } from '@/components/home/BasicSignsTab';
import { DailyQuestsCard } from '@/components/home/DailyQuestsCard';
import { WorldMap } from '@/components/home/WorldMap';
import { ChestCard } from '@/components/home/ChestCard';
import { ZippyMessage } from '@/components/shared/ZippyMessage';
import { useZippyLine } from '@/hooks/useZippyLine';
import { pickZippyLine, type ZippyExpression } from '@/data/zippy';
import { useUserStore, todayStr } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';

// Session-scoped so the warm welcome-back greeting shows at most once per app open, not on every
// return to the Learn tab. Reset naturally on a full reload.
let welcomeBackShown = false;

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const then = new Date(`${dateStr}T00:00:00`).getTime();
  const today = new Date(`${todayStr()}T00:00:00`).getTime();
  return Math.round((today - then) / 86_400_000);
}

interface Props {
  onStartLesson: (id: string) => void;
  onStartPractice: (opts?: {
    filterSignIds?: string[];
    autoStart?: boolean;
    mixedQuiz?: boolean;
    bonusGoldOnPerfect?: number;
    heading?: string;
    hideReferenceClip?: boolean;
  }) => void;
  onStartStory: (id: string) => void;
  onStartSpeed: () => void;
  onOpenShop: () => void;
  onOpenMultiplayer: () => void;
  onRequireSignIn: () => void;
  onSettings: () => void;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function HomePage({
  onStartLesson,
  onStartPractice,
  onStartStory,
  onStartSpeed,
  onOpenShop,
  onOpenMultiplayer,
  onRequireSignIn,
  onSettings,
  tab,
  onTabChange: setTab,
}: Props) {
  const { refreshDailyQuests, streak, lastPracticeDate } = useUserStore();
  const { user } = useAuth();
  const greeting = useZippyLine('homeGreeting');
  const welcomeBackLine = useZippyLine('welcomeBack');
  // Returning after a couple of days away → a one-time warm welcome-back (never counts missed
  // days, never guilts). Decided once at mount so it stays stable while the tab is open.
  const [showWelcomeBack] = useState(() => {
    if (welcomeBackShown) return false;
    if (daysSince(lastPracticeDate) >= 2) { welcomeBackShown = true; return true; }
    return false;
  });

  useEffect(() => {
    refreshDailyQuests();
  }, [refreshDailyQuests]);

  // Tap-to-cheer: poking Zippy swaps him to a happy face and gives a fresh encouraging line, so he
  // feels responsive instead of a static greeting. Clears back to the normal greeting after a beat.
  const [poke, setPoke] = useState<{ line: string; expr: ZippyExpression } | null>(null);
  const HAPPY_EXPRESSIONS: ZippyExpression[] = ['proud', 'celebrating', 'thumbsup', 'welcome', 'encouraging'];
  const pokeZippy = () => {
    setPoke({
      line: pickZippyLine('homeGreeting'),
      expr: HAPPY_EXPRESSIONS[Math.floor(Math.random() * HAPPY_EXPRESSIONS.length)],
    });
  };

  return (
    <div className="min-h-screen bg-z-bg">
      {/* Guest tapping the avatar gets the sign-in prompt; a signed-in user goes to their Me tab. */}
      <TopBar onOpenShop={onOpenShop} onOpenProfile={() => (user ? setTab('profile') : onRequireSignIn())} />

      <div className="max-w-lg mx-auto px-4 pt-4">
        <AnimatePresence mode="wait">
          {tab === 'learn' && (
            <motion.div
              key="learn"
              initial={{ opacity: 0, x: -22, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 22, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <ZippyMessage
                expression={poke?.expr ?? (showWelcomeBack ? 'sleeping' : streak > 0 ? 'proud' : 'welcome')}
                message={poke?.line ?? (showWelcomeBack ? welcomeBackLine : greeting)}
                size="sm"
                hideName
                onTap={pokeZippy}
                className="mb-3"
              />
              <StreakCard />
              <ChestCard />
              <DailyQuestsCard />
              {/* Moved here from Review (2026-07-13) — a timed game mode belongs alongside the
                  other ways to play, not mixed in with spaced-recall review content. */}
              <motion.div
                className="mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
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
              <WorldMap
                onSelectLesson={onStartLesson}
                onStartStory={onStartStory}
              />
            </motion.div>
          )}

          {tab === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 22, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -22, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <PracticeTab
                onStartPractice={() => onStartPractice()}
                onStartWeakPractice={(ids) => onStartPractice({ filterSignIds: ids, autoStart: true })}
              />
            </motion.div>
          )}

          {tab === 'alphabet' && (
            <motion.div
              key="alphabet"
              initial={{ opacity: 0, x: 22, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -22, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <AlphabetTab
                onStartLettersPractice={(ids) => onStartPractice({ filterSignIds: ids })}
                onTestMemory={(ids) =>
                  onStartPractice({
                    filterSignIds: ids,
                    mixedQuiz: true,
                    bonusGoldOnPerfect: 15,
                    heading: 'Letter Test',
                    hideReferenceClip: true,
                  })
                }
              />
            </motion.div>
          )}

          {tab === 'basicSigns' && (
            <motion.div
              key="basicSigns"
              initial={{ opacity: 0, x: 22, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -22, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <BasicSignsTab
                onStartSignsPractice={(ids) => onStartPractice({ filterSignIds: ids })}
                onTestMemory={(ids) =>
                  onStartPractice({
                    filterSignIds: ids,
                    mixedQuiz: true,
                    bonusGoldOnPerfect: 15,
                    heading: 'Basic Signs Test',
                    hideReferenceClip: true,
                  })
                }
              />
            </motion.div>
          )}

          {tab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 22, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -22, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <ProfileTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="lg:hidden">
        <BottomNav active={tab} onChange={setTab} onMultiplayer={onOpenMultiplayer} onShop={onOpenShop} onSettings={onSettings} />
      </div>
    </div>
  );
}
