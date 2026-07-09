import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { PrivacyPage } from '@/pages/PrivacyPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { AdminPanel } from '@/pages/AdminPanel';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { SideNav, type SideNavScreen } from '@/components/shared/SideNav';
import { STORIES } from '@/data/stories';
import { useProgressSync } from '@/hooks/useProgressSync';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseReady } from '@/lib/supabase';
import { SetUsernameModal } from '@/components/auth/SetUsernameModal';

type Screen =
  | { type: 'home' }
  | { type: 'onboarding' }
  | { type: 'lesson'; lessonId: string }
  | { type: 'practice'; filterSignIds?: string[]; autoStart?: boolean; mixedQuiz?: boolean; bonusGoldOnPerfect?: number; heading?: string; hideReferenceClip?: boolean }
  | { type: 'story'; storyId: string }
  | { type: 'speed' }
  | { type: 'shop' }
  | { type: 'friends' }
  | { type: 'multiplayer'; autoHostRoomId?: string; autoJoinCode?: string }
  | { type: 'settings' }
  | { type: 'leaderboard' }
  | { type: 'admin' }
  | { type: 'privacy' };

// Focused-task screens suppress the side nav (matches hiding chrome during a lesson).
const SIDE_NAV_SCREENS: SideNavScreen[] = ['home', 'shop', 'friends', 'leaderboard', 'settings'];

export default function App() {
  const { syncError } = useProgressSync();
  // Warm the MediaPipe + AI-classifier caches as soon as the app opens (onboarding/home screen)
  // instead of waiting for the first lesson mount — both are module-level singletons (see
  // getSharedCapture, useClassifier's loadOnce), so this download only ever happens once and
  // whichever lesson/practice/story page mounts next picks up the already-loading/loaded result.
  useClassifier();
  useEffect(() => {
    void getSharedCapture();
  }, []);
  const { onboardingComplete } = useUserStore();
  const { user, username, needsUsernameSetup, loading: authLoading, bannedReason, isAdmin } = useAuth();
  const [screen, setScreen] = useState<Screen>(
    onboardingComplete ? { type: 'home' } : { type: 'onboarding' }
  );

  // Returning users who are already logged in skip onboarding regardless of local store state
  useEffect(() => {
    if (!authLoading && user && screen.type === 'onboarding') {
      setScreen({ type: 'home' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);
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

  // Block render until auth session is restored so returning users never see the onboarding flash.
  if (authLoading) {
    return (
      <div className="min-h-screen bg-z-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4 animate-pulse">🤟</p>
          <p className="text-z-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // A banned account is force-signed-out inside AuthContext the moment its profile is fetched
  // (client-side enforcement); RLS denies its own reads/writes server-side regardless (see
  // migration 20260707120000_admin_panel.sql). This screen is what the user actually sees instead
  // of the app — checked before onboarding/home so there's no flash of real content first.
  if (bannedReason) {
    return (
      <div className="min-h-screen bg-z-bg flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">🚫</p>
          <h1 className="text-xl font-bold mb-2">Account suspended</h1>
          <p className="text-z-gray-400 text-sm">{bannedReason}</p>
        </div>
      </div>
    );
  }

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
              : (['home', 'shop', 'friends', 'leaderboard', 'settings'].includes(screen.type)
                  ? (screen.type as SideNavScreen)
                  : null)
          }
          onHome={() => { goHome(); setHomeTab('learn'); }}
          onReview={() => { goHome(); setHomeTab('review'); }}
          onAlphabet={() => { goHome(); setHomeTab('alphabet'); }}
          onShop={() => setScreen({ type: 'shop' })}
          onFriends={() => setScreen({ type: 'friends' })}
          onLeaderboard={() => setScreen({ type: 'leaderboard' })}
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
              autoStartMixed={screen.mixedQuiz}
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
            <FriendsPage key="friends" onExit={goHome} onChallengeFriend={handleChallengeFriend} onStartMultiplayer={() => setScreen({ type: 'multiplayer' })} />
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
            <SettingsPage
              key="settings"
              onExit={goHome}
              onOpenAdmin={isAdmin ? () => setScreen({ type: 'admin' }) : undefined}
              onOpenPrivacy={() => setScreen({ type: 'privacy' })}
            />
          )}

          {screen.type === 'privacy' && (
            <PrivacyPage key="privacy" onExit={() => setScreen({ type: 'settings' })} />
          )}

          {screen.type === 'leaderboard' && (
            <LeaderboardPage key="leaderboard" onExit={goHome} />
          )}

          {/* Reachable only via the Settings entry point, which itself only renders for admins —
              this check is the same defense-in-depth belt-and-suspenders as the RPC functions
              re-checking is_admin server-side: a hidden UI path is not the real security boundary,
              but there's no reason to render the page shell for a non-admin who somehow gets here. */}
          {screen.type === 'admin' && isAdmin && (
            <AdminPanel key="admin" onExit={goHome} />
          )}
        </AnimatePresence>
      </div>

      {/* Username setup modal for Google/OAuth users */}
      {needsUsernameSetup && <SetUsernameModal onClose={() => {}} />}

      {/* Sync failure indicator — non-blocking, visible anywhere in the app. Previously a failed
          write to Supabase was completely silent, so progress could appear to vanish with zero
          explanation. */}
      <AnimatePresence>
        {syncError && (
          <motion.div
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-z-red/15 border border-z-red/40 text-z-red text-xs font-semibold px-4 py-2 rounded-full shadow-lg"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            ⚠️ Couldn't sync your progress — check your connection
          </motion.div>
        )}
      </AnimatePresence>

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
