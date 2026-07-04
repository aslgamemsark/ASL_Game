import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
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
  | { type: 'practice'; filterSignIds?: string[]; autoStart?: boolean }
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
  const { onboardingComplete } = useUserStore();
  const [screen, setScreen] = useState<Screen>(
    onboardingComplete ? { type: 'home' } : { type: 'onboarding' }
  );
  const [homeTab, setHomeTab] = useState<Tab>('learn');

  const goHome = () => setScreen({ type: 'home' });
  const showSideNav = SIDE_NAV_SCREENS.includes(screen.type as SideNavScreen);

  return (
    <>
      {showSideNav && (
        <SideNav
          active={screen.type === 'home' && homeTab === 'profile' ? 'profile' : (screen.type as SideNavScreen)}
          onHome={() => { goHome(); setHomeTab('learn'); }}
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
