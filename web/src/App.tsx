import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseReady } from '@/lib/supabase';

type Screen =
  | { type: 'home' }
  | { type: 'onboarding' }
  | { type: 'lesson'; lessonId: string }
  | { type: 'practice'; filterSignIds?: string[]; autoStart?: boolean; bonusGoldOnPerfect?: number; heading?: string; hideReferenceClip?: boolean }
  | { type: 'story'; storyId: string }
  | { type: 'speed' }
  | { type: 'shop' }
  | { type: 'friends' }
  | { type: 'multiplayer'; autoHostRoomId?: string; autoJoinCode?: string }
  | { type: 'settings' };

// Focused-task screens suppress the side nav (matches hiding chrome during a lesson).
const SIDE_NAV_SCREENS: SideNavScreen[] = ['home', 'shop', 'friends', 'settings'];

export default function App() {
  useProgressSync();
  const { onboardingComplete } = useUserStore();
  const { user, username } = useAuth();
  const [screen, setScreen] = useState<Screen>(
    onboardingComplete ? { type: 'home' } : { type: 'onboarding' }
  );
  const [homeTab, setHomeTab] = useState<Tab>('learn');
  const [incomingChallenge, setIncomingChallenge] = useState<{ from: string; roomId: string } | null>(null);

  const goHome = () => setScreen({ type: 'home' });
  const showSideNav = SIDE_NAV_SCREENS.includes(screen.type as SideNavScreen);

  // Subscribe to incoming challenge notifications while logged in
  useEffect(() => {
    if (!user || !supabaseReady) return;
    const ch = supabase.channel(`challenge_${user.id}`);
    ch.on('broadcast', { event: 'challenge' }, ({ payload }) => {
      setIncomingChallenge({ from: payload.from as string, roomId: payload.roomId as string });
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // Called from FriendsPage: create a room, notify the friend, navigate to multiplayer as host
  const handleChallengeFriend = useCallback(async (friendId: string, friendUsername: string) => {
    if (!user || !supabaseReady) return;
    const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
    // Broadcast challenge to friend's personal channel
    const ch = supabase.channel(`challenge_${friendId}`);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({
          type: 'broadcast',
          event: 'challenge',
          payload: { from: username ?? 'Someone', roomId, fromId: user.id },
        });
        setTimeout(() => supabase.removeChannel(ch), 2000);
      }
    });
    // Navigate to multiplayer as the host with the pre-generated room ID
    setScreen({ type: 'multiplayer', autoHostRoomId: roomId });
    void friendUsername; // used in the notification received on the other side
  }, [user, username]);

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
              hideReferenceClip={screen.hideReferenceClip}
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
            <FriendsPage key="friends" onExit={goHome} onChallengeFriend={handleChallengeFriend} />
          )}

          {screen.type === 'multiplayer' && (
            <MultiplayerPage
              key="multiplayer"
              onExit={goHome}
              autoHostRoomId={screen.autoHostRoomId}
              autoJoinCode={screen.autoJoinCode}
            />
          )}

          {screen.type === 'settings' && (
            <SettingsPage key="settings" onExit={goHome} />
          )}
        </AnimatePresence>
      </div>

      {/* Incoming challenge notification — visible anywhere in the app */}
      <AnimatePresence>
        {incomingChallenge && (
          <motion.div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-z-card border border-z-purple/40 rounded-2xl px-5 py-4 shadow-2xl shadow-z-purple/20 min-w-[280px]"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          >
            <span className="text-2xl">⚔️</span>
            <div className="flex-1">
              <p className="font-bold text-sm">Challenge from <span className="text-z-purple-light">@{incomingChallenge.from}</span>!</p>
              <p className="text-xs text-z-gray-400 mt-0.5">1v1 Sign &amp; Guess</p>
            </div>
            <div className="flex gap-2">
              <motion.button
                className="text-xs px-3 py-1.5 rounded-xl font-bold bg-z-purple text-white"
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setScreen({ type: 'multiplayer', autoJoinCode: incomingChallenge.roomId });
                  setIncomingChallenge(null);
                }}
              >
                Join
              </motion.button>
              <button
                className="text-xs px-3 py-1.5 rounded-xl font-bold border border-white/15 text-z-gray-400"
                onClick={() => setIncomingChallenge(null)}
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
