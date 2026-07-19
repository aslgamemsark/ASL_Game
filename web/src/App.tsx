import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getSharedCapture } from '@/engine/capture';
import { useClassifier } from '@/hooks/useClassifier';
import { HomePage } from '@/pages/HomePage';
import type { Tab } from '@/components/home/BottomNav';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';

// Lazy-loaded: HomePage/OnboardingFlow are the only screens needed for first paint. Every other
// page (plus the admin-only panel and the dev-only avatar lab) used to be a static import, so a
// first-time visitor downloaded all ~2MB of app JS — including AdminPanel — before picking a
// lesson (production audit, 2026-07-12). Splitting per-route means each only loads when its
// Screen is actually reached.
const LessonPage = lazy(() => import('@/pages/LessonPage').then((m) => ({ default: m.LessonPage })));
const PracticePage = lazy(() => import('@/pages/PracticePage').then((m) => ({ default: m.PracticePage })));
const StoryPage = lazy(() => import('@/pages/StoryPage').then((m) => ({ default: m.StoryPage })));
const SpeedChallengePage = lazy(() => import('@/pages/SpeedChallengePage').then((m) => ({ default: m.SpeedChallengePage })));
const ShopPage = lazy(() => import('@/pages/ShopPage').then((m) => ({ default: m.ShopPage })));
const FriendsPage = lazy(() => import('@/pages/FriendsPage').then((m) => ({ default: m.FriendsPage })));
const MultiplayerHubPage = lazy(() => import('@/pages/MultiplayerHubPage').then((m) => ({ default: m.MultiplayerHubPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const UserProfilePage = lazy(() => import('@/pages/UserProfilePage').then((m) => ({ default: m.UserProfilePage })));
const AdminPanel = lazy(() => import('@/pages/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const AvatarLabPage = lazy(() => import('@/avatar/viewer/AvatarLabPage').then((m) => ({ default: m.AvatarLabPage })));
const CalibrationPage = lazy(() => import('@/pages/CalibrationPage').then((m) => ({ default: m.CalibrationPage })));
import { SideNav, type SideNavScreen } from '@/components/shared/SideNav';
import { ScreenTransition } from '@/components/shared/ScreenTransition';
import { STORIES } from '@/data/stories';
import { SIGNS } from '@/data/signs';
import { useProgressSync } from '@/hooks/useProgressSync';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseReady } from '@/lib/supabase';
import { generateRoomCode } from '@/lib/multiplayerRooms';
import { SetUsernameModal } from '@/components/auth/SetUsernameModal';
import { AuthModal } from '@/components/auth/AuthModal';
import { TrainingConsentModal } from '@/components/auth/TrainingConsentModal';
import { ResetPasswordModal } from '@/components/auth/ResetPasswordModal';
import { Zippy } from '@/components/shared/Zippy';
import { CelebrationHost } from '@/components/shared/CelebrationHost';

type Screen =
  | { type: 'home' }
  | { type: 'onboarding'; startAt?: 'welcome' | 'auth' }
  | { type: 'lesson'; lessonId: string }
  | { type: 'practice'; filterSignIds?: string[]; autoStart?: boolean; mixedQuiz?: boolean; bonusGoldOnPerfect?: number; heading?: string; hideReferenceClip?: boolean }
  | { type: 'story'; storyId: string }
  | { type: 'speed' }
  | { type: 'shop' }
  | { type: 'friends' }
  | { type: 'multiplayer'; mode?: 'duel' | 'room'; autoHostRoomId?: string; autoJoinCode?: string }
  | { type: 'settings' }
  | { type: 'leaderboard' }
  | { type: 'admin' }
  | { type: 'privacy' }
  | { type: 'user-profile'; userId: string };

// Focused-task screens suppress the side nav (matches hiding chrome during a lesson).
const SIDE_NAV_SCREENS: SideNavScreen[] = ['home', 'shop', 'friends', 'leaderboard', 'settings', 'multiplayer'];

// Shared fallback while a lazy-loaded screen's chunk downloads — same visual language as the
// auth-restore spinner above so a route-split navigation doesn't look like a different app state.
function ScreenFallback() {
  return (
    <div className="min-h-screen bg-z-bg flex items-center justify-center">
      <div className="text-center">
        <Zippy expression="loading" size="lg" priority className="mb-4" />
        <p className="text-z-gray-500 text-sm">Loading…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { syncError } = useProgressSync();
  const { onboardingComplete } = useUserStore();
  const { user, username, needsUsernameSetup, needsTrainingConsent, passwordRecoveryMode, loading: authLoading, bannedReason, isAdmin } = useAuth();
  // Warm the MediaPipe + AI-classifier caches once the user has actually reached the app (past
  // onboarding, or a returning signed-in session that skips it) instead of the instant the page
  // opens — both are module-level singletons (see getSharedCapture, useClassifier's loadOnce), so
  // this download only ever happens once and whichever lesson/practice/story page mounts next
  // picks up the already-loading/loaded result. Starting this multi-MB fetch + WASM/WebGL init
  // immediately on first paint used to make the "Get Started" button feel frozen for several
  // seconds on a fresh visit (impeccable audit, 2026-07-11) — new visitors shouldn't pay that
  // cost before they've even started onboarding.
  const readyForWarmup = onboardingComplete || !!user;
  useClassifier(readyForWarmup);
  useEffect(() => {
    if (!readyForWarmup) return;
    void getSharedCapture();
  }, [readyForWarmup]);
  const [screen, setScreen] = useState<Screen>(
    onboardingComplete ? { type: 'home' } : { type: 'onboarding' }
  );

  // Returning users who are already logged in skip onboarding regardless of local store state —
  // except for one deliberate escape hatch: SettingsPage's admin-only "Replay onboarding" button
  // sets this sessionStorage flag right before reloading, specifically so a signed-in dev/admin
  // can re-walk the flow (e.g. to re-test the dominant-hand step) without having to sign out
  // first. Consumed once, so it can't accidentally stick past this one pass.
  useEffect(() => {
    if (!authLoading && user && screen.type === 'onboarding') {
      if (sessionStorage.getItem('asl-force-onboarding') === '1') {
        sessionStorage.removeItem('asl-force-onboarding');
        return;
      }
      setScreen({ type: 'home' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Route a signed-out user to the sign-in screen. On "Log out", AuthContext.signOut() resets the
  // progress store, flipping onboardingComplete back to false; without this the user would linger
  // on whatever screen they were on, now silently rendered as a guest (the reported bug). Land
  // directly on the auth step so it reads as a sign-in/sign-up page rather than replaying the
  // welcome intro. A brand-new first-run guest is unaffected: the initial screen is already
  // 'onboarding', so the `screen.type !== 'onboarding'` guard keeps them on 'welcome'.
  useEffect(() => {
    if (!authLoading && !user && !onboardingComplete && screen.type !== 'onboarding') {
      setScreen({ type: 'onboarding', startAt: 'auth' });
    }
  }, [user, onboardingComplete, authLoading, screen.type]);
  const [homeTab, setHomeTab] = useState<Tab>('learn');
  const [incomingChallenge, setIncomingChallenge] = useState<{ from: string; roomId: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const goHome = () => setScreen({ type: 'home' });

  // On finishing onboarding, drop brand-new "beginner" learners straight into the Alphabets tab
  // (learn the letters first) rather than the default Journey/learn tab. skillLevel was just set
  // by completeOnboarding() inside the flow, so reading it from the store here is current.
  const handleOnboardingComplete = useCallback(() => {
    setHomeTab(useUserStore.getState().skillLevel === 'beginner' ? 'alphabet' : 'learn');
    setScreen({ type: 'home' });
  }, []);
  const showSideNav = SIDE_NAV_SCREENS.includes(screen.type as SideNavScreen);

  // Subscribe to incoming challenge notifications while logged in
  useEffect(() => {
    if (!user || !supabaseReady) return;
    // private: true — Realtime Authorization only lets this user's own JWT subscribe to their
    // challenge topic (see migration 20260718010000), so strangers can't read incoming challenges
    // (which carry joinable room codes) off the wire. The subscribe MUST run with the JWT already
    // on the socket: the global setAuth listener in lib/supabase.ts is fire-and-forget, so await
    // the current token explicitly here first — otherwise a private subscribe races an unset token,
    // RLS sees auth.uid() = null, and challenges silently never arrive.
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      ch = supabase.channel(`challenge_${user.id}`, { config: { private: true } });
      ch.on('broadcast', { event: 'challenge' }, ({ payload }) => {
        setIncomingChallenge({ from: payload.from as string, roomId: payload.roomId as string });
      });
      ch.subscribe();
    })();
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [user?.id]);

  // Called from FriendsPage: create a room, notify the friend, navigate to multiplayer as host
  const handleChallengeFriend = useCallback(async (friendId: string, friendUsername: string) => {
    if (!user || !supabaseReady) return;
    const roomId = generateRoomCode();
    // Register the room BEFORE notifying the friend — otherwise their client could receive the
    // challenge broadcast and try to join_multiplayer_room() before this row exists, since that's
    // a separate round trip than DuelPage's own createRoom() (which also upserts this same row;
    // ignoreDuplicates makes running both harmless). Challenge rooms are always private — the
    // friend joins via the direct notification, never via search.
    await supabase.from('multiplayer_rooms').upsert(
      { code: roomId, mode: 'duel', visibility: 'private', host_id: user.id, max_participants: 2 },
      { onConflict: 'code', ignoreDuplicates: true }
    );
    // Broadcast challenge to friend's personal channel — WITHOUT subscribing first. Under Realtime
    // Authorization only the friend themselves may subscribe to (receive on) their challenge topic;
    // senders are covered by a separate friends-only INSERT policy, which supabase-js exercises by
    // routing send() on an un-joined channel through the REST broadcast endpoint. That REST call
    // only attaches the Authorization header if the socket already has the access token, so set it
    // explicitly first — otherwise the private broadcast is evaluated as anon and silently dropped.
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
    const ch = supabase.channel(`challenge_${friendId}`, { config: { private: true } });
    void ch.send({
      type: 'broadcast',
      event: 'challenge',
      payload: { from: username ?? 'Someone', roomId, fromId: user.id },
    }).finally(() => supabase.removeChannel(ch));
    // Navigate to multiplayer as the host with the pre-generated room ID
    setScreen({ type: 'multiplayer', mode: 'duel', autoHostRoomId: roomId });
    void friendUsername; // used in the notification received on the other side
  }, [user, username]);

  // Block render until auth session is restored so returning users never see the onboarding flash.
  if (authLoading) {
    return (
      <div className="min-h-screen bg-z-bg flex items-center justify-center">
        <div className="text-center">
          <Zippy expression="loading" size="lg" priority className="mb-4" />
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

  // The user followed an emailed password-reset link — force the "set new password" screen
  // exclusively (not layered as one modal among others) until they either complete it or
  // explicitly cancel/sign out, since a bare recovery session left dangling under the normal app
  // would be a confusing half-authenticated state.
  if (passwordRecoveryMode) {
    return <ResetPasswordModal />;
  }

  // Dev-only debug environment (spec Rule 18: "debug inside AvatarLab, not inside the game").
  // Deliberately NOT wired into the Screen state machine or navigation — it's a separate tool, not
  // a game screen. Checked AFTER all hooks (Rules of Hooks) but before the game's own render tree.
  // import.meta.env.DEV is statically false in `vite build`, so bundlers dead-code-eliminate this
  // branch out of production entirely.
  if (import.meta.env.DEV && window.location.pathname === '/avatarlab') {
    return (
      <Suspense fallback={<ScreenFallback />}>
        <AvatarLabPage />
      </Suspense>
    );
  }

  // Dev-only sign-recognition calibration harness (browser twin of tools/demo_verify.py
  // --calibrate) — same reasoning as /avatarlab above: a separate tool, not a game screen.
  if (import.meta.env.DEV && window.location.pathname === '/calibrate') {
    return (
      <Suspense fallback={<ScreenFallback />}>
        <CalibrationPage />
      </Suspense>
    );
  }

  // Dev-only QA tool: run every sign in the registry through the real camera + recognition
  // pipeline, one at a time, instead of a lesson-scoped subset. Deliberately reuses PracticePage
  // wholesale rather than reimplementing camera/verifier logic — CLAUDE.md is explicit that the
  // recognition engine must never be duplicated (divergent per-copy logic is exactly how the old
  // COFFEE bug shipped). Same dead-code-elimination guarantee as /avatarlab above.
  if (import.meta.env.DEV && window.location.pathname === '/test-signs') {
    return (
      <Suspense fallback={<ScreenFallback />}>
        <PracticePage
          onExit={() => { window.location.pathname = '/'; }}
          filterSignIds={Object.keys(SIGNS)}
          autoStartExpressive
          heading="Test All Signs"
        />
      </Suspense>
    );
  }

  return (
    <>
      {showSideNav && (
        <SideNav
          active={
            screen.type === 'home' && homeTab !== 'learn'
              ? (homeTab as SideNavScreen)
              : (SIDE_NAV_SCREENS.includes(screen.type as SideNavScreen)
                  ? (screen.type as SideNavScreen)
                  : null)
          }
          onHome={() => { goHome(); setHomeTab('learn'); }}
          onReview={() => { goHome(); setHomeTab('review'); }}
          onAlphabet={() => { goHome(); setHomeTab('alphabet'); }}
          onShop={() => setScreen({ type: 'shop' })}
          onFriends={() => setScreen({ type: 'friends' })}
          onMultiplayer={() => setScreen({ type: 'multiplayer' })}
          onLeaderboard={() => setScreen({ type: 'leaderboard' })}
          onSettings={() => setScreen({ type: 'settings' })}
          onProfile={() => { goHome(); setHomeTab('profile'); }}
          onSignIn={() => setShowAuth(true)}
        />
      )}
      <div className={showSideNav ? 'lg:pl-64' : ''}>
        <Suspense fallback={<ScreenFallback />}>
        <AnimatePresence mode="wait">
          {screen.type === 'onboarding' && (
            <ScreenTransition key="onboarding">
              <OnboardingFlow initialStep={screen.startAt} onComplete={handleOnboardingComplete} />
            </ScreenTransition>
          )}

          {screen.type === 'home' && (
            <ScreenTransition key="home">
              <HomePage
                onStartLesson={(id) => setScreen({ type: 'lesson', lessonId: id })}
                onStartPractice={(opts) => setScreen({ type: 'practice', ...opts })}
                onStartStory={(id) => setScreen({ type: 'story', storyId: id })}
                onStartSpeed={() => setScreen({ type: 'speed' })}
                onOpenShop={() => setScreen({ type: 'shop' })}
                onOpenMultiplayer={() => setScreen({ type: 'multiplayer' })}
                onRequireSignIn={() => setShowAuth(true)}
                onSettings={() => setScreen({ type: 'settings' })}
                tab={homeTab}
                onTabChange={setHomeTab}
              />
            </ScreenTransition>
          )}

          {screen.type === 'lesson' && (
            <ScreenTransition key={`lesson-${screen.lessonId}`}>
              <LessonPage lessonId={screen.lessonId} onExit={goHome} />
            </ScreenTransition>
          )}

          {screen.type === 'practice' && (
            <ScreenTransition key="practice">
              <PracticePage
                onExit={goHome}
                filterSignIds={screen.filterSignIds}
                autoStartExpressive={screen.autoStart}
                autoStartMixed={screen.mixedQuiz}
                bonusGoldOnPerfect={screen.bonusGoldOnPerfect}
                heading={screen.heading}
                hideReferenceClip={screen.hideReferenceClip}
              />
            </ScreenTransition>
          )}

          {screen.type === 'story' && (() => {
            const story = STORIES.find((s) => s.id === screen.storyId);
            if (!story) return null;
            return (
              <ScreenTransition key={`story-${screen.storyId}`}>
                <StoryPage story={story} onExit={goHome} />
              </ScreenTransition>
            );
          })()}

          {screen.type === 'speed' && (
            <ScreenTransition key="speed">
              <SpeedChallengePage onExit={goHome} />
            </ScreenTransition>
          )}

          {screen.type === 'shop' && (
            <ScreenTransition key="shop">
              <ShopPage onExit={goHome} />
            </ScreenTransition>
          )}

          {screen.type === 'friends' && (
            <ScreenTransition key="friends">
              <FriendsPage
                onExit={goHome}
                onChallengeFriend={handleChallengeFriend}
                onStartMultiplayer={() => setScreen({ type: 'multiplayer', mode: 'duel' })}
                onViewProfile={(id) => setScreen({ type: 'user-profile', userId: id })}
                onRequireSignIn={() => setShowAuth(true)}
              />
            </ScreenTransition>
          )}

          {screen.type === 'multiplayer' && (
            <ScreenTransition key="multiplayer">
              <MultiplayerHubPage
                onExit={goHome}
                mode={screen.mode}
                autoHostRoomId={screen.autoHostRoomId}
                autoJoinCode={screen.autoJoinCode}
                onRequireSignIn={() => setShowAuth(true)}
              />
            </ScreenTransition>
          )}

          {screen.type === 'settings' && (
            <ScreenTransition key="settings">
              <SettingsPage
                onExit={goHome}
                onOpenAdmin={isAdmin ? () => setScreen({ type: 'admin' }) : undefined}
                onOpenPrivacy={() => setScreen({ type: 'privacy' })}
              />
            </ScreenTransition>
          )}

          {screen.type === 'privacy' && (
            <ScreenTransition key="privacy">
              <PrivacyPage onExit={() => setScreen({ type: 'settings' })} />
            </ScreenTransition>
          )}

          {screen.type === 'leaderboard' && (
            <ScreenTransition key="leaderboard">
              <LeaderboardPage
                onExit={goHome}
                onViewProfile={(id) => setScreen({ type: 'user-profile', userId: id })}
              />
            </ScreenTransition>
          )}

          {screen.type === 'user-profile' && (
            // Reachable from both Leaderboard and Friends — matches every other screen's
            // "exit always goes home" convention rather than tracking an origin screen, since
            // that pattern isn't established anywhere else (the one exception, Privacy -> Settings,
            // is a single fixed parent, not a multi-origin case like this one).
            <ScreenTransition key="user-profile">
              <UserProfilePage userId={screen.userId} onExit={goHome} />
            </ScreenTransition>
          )}

          {/* Reachable only via the Settings entry point, which itself only renders for admins —
              this check is the same defense-in-depth belt-and-suspenders as the RPC functions
              re-checking is_admin server-side: a hidden UI path is not the real security boundary,
              but there's no reason to render the page shell for a non-admin who somehow gets here. */}
          {screen.type === 'admin' && isAdmin && (
            <ScreenTransition key="admin">
              <AdminPanel onExit={goHome} />
            </ScreenTransition>
          )}
        </AnimatePresence>
        </Suspense>
      </div>

      {/* Username setup modal for Google/OAuth users */}
      {needsUsernameSetup && <SetUsernameModal onClose={() => {}} />}

      {/* First-sign-in AI training-data consent — shown after username setup so they never
          stack on top of each other. */}
      {!needsUsernameSetup && needsTrainingConsent && <TrainingConsentModal />}

      {/* App-level sign-in modal — opened from the nav profile chip / top-bar avatar when a guest
          taps their profile, so the prompt is reachable from anywhere, not just the Me tab. */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {/* Level-up + badge-earned celebrations. Self-contained: watches the progress store and shows
          its own modal, with a guard against firing on the post-sign-in progress merge. */}
      <CelebrationHost />

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
                  setScreen({ type: 'multiplayer', mode: 'duel', autoJoinCode: incomingChallenge.roomId });
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
