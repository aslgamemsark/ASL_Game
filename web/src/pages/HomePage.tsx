import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TopBar } from '@/components/shared/TopBar';
import { StreakCard } from '@/components/home/StreakCard';
import { BottomNav, type Tab } from '@/components/home/BottomNav';
import { PracticeTab } from '@/components/home/PracticeTab';
import { ProfileTab } from '@/components/home/ProfileTab';
import { AlphabetTab } from '@/components/home/AlphabetTab';
import { DailyQuestsCard } from '@/components/home/DailyQuestsCard';
import { WorldMap } from '@/components/home/WorldMap';
import { ChestCard } from '@/components/home/ChestCard';
import { ZippyMessage } from '@/components/shared/ZippyMessage';
import { useZippyLine } from '@/hooks/useZippyLine';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';

// Session-scoped so the warm welcome-back greeting shows at most once per app open, not on every
// return to the Learn tab. Reset naturally on a full reload.
let welcomeBackShown = false;

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const then = new Date(`${dateStr}T00:00:00`).getTime();
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`).getTime();
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
  onRequireSignIn: () => void;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function HomePage({
  onStartLesson,
  onStartPractice,
  onStartStory,
  onStartSpeed,
  onOpenShop,
  onRequireSignIn,
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
                expression={showWelcomeBack ? 'sleeping' : streak > 0 ? 'proud' : 'welcome'}
                message={showWelcomeBack ? welcomeBackLine : greeting}
                size="sm"
                hideName
                className="mb-3"
              />
              <StreakCard />
              <ChestCard />
              <DailyQuestsCard />
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
                onStartStory={() => onStartStory('coffee-story')}
                onStartSpeed={onStartSpeed}
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
        <BottomNav active={tab} onChange={setTab} />
      </div>
    </div>
  );
}
