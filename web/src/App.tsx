import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { getSharedCapture } from '@/engine/capture';
import { useClassifier } from '@/hooks/useClassifier';
import { AvatarLabPage } from '@/avatar/viewer/AvatarLabPage';
import { HomePage } from '@/pages/HomePage';
import type { Tab } from '@/components/home/BottomNav';
import { LessonPage } from '@/pages/LessonPage';
import { PracticePage } from '@/pages/PracticePage';
import { StoryPage } from '@/pages/StoryPage';
import { SpeedChallengePage } from '@/pages/SpeedChallengePage';
import { ShopPage } from '@/pages/ShopPage';
import { FriendsPage } from '@/pages/FriendsPage';
import { MultiplayerPage } from '@/pages/MultiplayerPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { SideNav, type SideNavScreen } from '@/components/shared/SideNav';
import { STORIES } from '@/data/stories';
import { useProgressSync } from '@/hooks/useProgressSync';
import { useUserStore } from '@/stores/useUserStore';

type Screen =
  | { type: 'home' }
  | { type: 'onboarding' }
  | { type: 'lesson'; lessonId: string }
  | { type: 'practice'; filterSignIds?: string[]; autoStart?: boolean; bonusGoldOnPerfect?: number; heading?: string }
  | { type: 'story'; storyId: string }
  | { type: 'speed' }
  | { type: 'shop' }
  | { type: 'friends' }
  | { type: 'multiplayer' }
  | { type: 'settings' };

// Focused-task screens suppress the side nav (matches hiding chrome during a lesson).
const SIDE_NAV_SCREENS: SideNavScreen[] = ['home', 'shop', 'friends', 'settings'];

export default function App() {
  useProgressSync();
  // Warm the MediaPipe + AI-classifier caches as soon as the app opens (onboarding/home screen)
  // instead of waiting for the first lesson mount — both are module-level singletons (see
  // getSharedCapture, useClassifier's loadOnce), so this download only ever happens once and
  // whichever lesson/practice/story page mounts next picks up the already-loading/loaded result.
  useClassifier();
  useEffect(() => {
    void getSharedCapture();
  }, []);
  const { onboardingComplete } = useUserStore();
  const [screen, setScreen] = useState<Screen>(
    onboardingComplete ? { type: 'home' } : { type: 'onboarding' }
  );
  const [homeTab, setHomeTab] = useState<Tab>('learn');

  const goHome = () => setScreen({ type: 'home' });
  const showSideNav = SIDE_NAV_SCREENS.includes(screen.type as SideNavScreen);

  // Dev-only debug environment (spec Rule 18: "debug inside AvatarLab, not inside the game").
  // Deliberately NOT wired into the Screen state machine or navigation — it's a separate tool, not
  // a game screen. Checked AFTER all hooks (Rules of Hooks) but before the game's own render tree.
  // import.meta.env.DEV is statically false in `vite build`, so bundlers dead-code-eliminate this
  // branch out of production entirely.
  if (import.meta.env.DEV && window.location.pathname === '/avatarlab') {
    return <AvatarLabPage />;
  }

  return (
    <>
      {showSideNav && (
        <SideNav
          active={
            screen.type === 'home' && homeTab !== 'learn'
              ? (homeTab as SideNavScreen)
              : (screen.type as SideNavScreen)
          }
          onHome={() => { goHome(); setHomeTab('learn'); }}
          onReview={() => { goHome(); setHomeTab('review'); }}
          onAlphabet={() => { goHome(); setHomeTab('alphabet'); }}
          onShop={() => setScreen({ type: 'shop' })}
          onFriends={() => setScreen({ type: 'friends' })}
          onSettings={() => setScreen({ type: 'settings' })}
          onProfile={() => { goHome(); setHomeTab('profile'); }}
        />
      )}
      <div className={showSideNav ? 'lg:pl-64' : ''}>
        <AnimatePresence mode="wait">
          {screen.type === 'onboarding' && (
            <OnboardingFlow key="onboarding" onComplete={goHome} />
          )}

          {screen.type === 'home' && (
            <HomePage
              key="home"
              onStartLesson={(id) => setScreen({ type: 'lesson', lessonId: id })}
              onStartPractice={(opts) => setScreen({ type: 'practice', ...opts })}
              onStartStory={(id) => setScreen({ type: 'story', storyId: id })}
              onStartSpeed={() => setScreen({ type: 'speed' })}
              onOpenShop={() => setScreen({ type: 'shop' })}
              onOpenFriends={() => setScreen({ type: 'friends' })}
              onStartMultiplayer={() => setScreen({ type: 'multiplayer' })}
              tab={homeTab}
              onTabChange={setHomeTab}
            />
          )}

          {screen.type === 'lesson' && (
            <LessonPage
              key={`lesson-${screen.lessonId}`}
              lessonId={screen.lessonId}
              onExit={goHome}
            />
          )}

          {screen.type === 'practice' && (
            <PracticePage
              key="practice"
              onExit={goHome}
              filterSignIds={screen.filterSignIds}
              autoStartExpressive={screen.autoStart}
              bonusGoldOnPerfect={screen.bonusGoldOnPerfect}
              heading={screen.heading}
            />
          )}

          {screen.type === 'story' && (() => {
            const story = STORIES.find((s) => s.id === screen.storyId);
            if (!story) return null;
            return <StoryPage key={`story-${screen.storyId}`} story={story} onExit={goHome} />;
          })()}

          {screen.type === 'speed' && (
            <SpeedChallengePage key="speed" onExit={goHome} />
          )}

          {screen.type === 'shop' && (
            <ShopPage key="shop" onExit={goHome} />
          )}

          {screen.type === 'friends' && (
            <FriendsPage key="friends" onExit={goHome} />
          )}

          {screen.type === 'multiplayer' && (
            <MultiplayerPage key="multiplayer" onExit={goHome} />
          )}

          {screen.type === 'settings' && (
            <SettingsPage key="settings" onExit={goHome} />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
