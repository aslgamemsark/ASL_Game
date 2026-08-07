import { useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { Toggle } from '@/components/shared/Toggle';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUserStore } from '@/stores/useUserStore';
import { LogoutConfirm } from '@/components/auth/LogoutConfirm';
import { FeedbackModal } from '@/components/shared/FeedbackModal';
import { isAnalyticsOptedOut, setAnalyticsOptOut } from '@/analytics';
import { getSnapshot, isIos, promptInstall, subscribe } from '@/lib/pwaInstall';

interface Props {
  onExit: () => void;
  onOpenAdmin?: () => void;
  onOpenPrivacy?: () => void;
}

export function SettingsPage({ onExit, onOpenAdmin, onOpenPrivacy }: Props) {
  const { theme, setTheme } = useTheme();
  const { user, username, isAdmin } = useAuth();
  const { vibrationEnabled, toggleVibration, soundEnabled, toggleSound, speechEnabled, toggleSpeech } = useSettingsStore();
  const { addGold, addSigns, collectTrainingData, setCollectTrainingData } = useUserStore();
  const [showLogout, setShowLogout] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  // Analytics opt-out (separate from the AI-training-data toggle above — this governs anonymous
  // PRODUCT USAGE events, not landmark data). Read once at mount; the toggle below writes through
  // setAnalyticsOptOut immediately, so there's no "opted out" state this component can miss.
  const [analyticsOptedOut, setAnalyticsOptedOutState] = useState(() => isAnalyticsOptedOut());
  const { canInstall: installAvailable, installed } = useSyncExternalStore(subscribe, getSnapshot);

  const giveTestCredits = () => {
    addGold(10000);
    addSigns(10000);
  };

  // Signed-in users skip onboarding on every load (App.tsx) so a real returning user is never
  // stuck redoing it — which also makes it impossible for a signed-in admin to re-test the flow
  // without a full sign-out. This flips onboardingComplete back to false and sets a one-shot
  // sessionStorage flag that App.tsx's skip-effect checks and consumes, letting this one reload
  // through to onboarding while staying signed in.
  const replayOnboarding = () => {
    sessionStorage.setItem('asl-force-onboarding', '1');
    useUserStore.setState({ onboardingComplete: false });
    window.location.reload();
  };

  return (
    <div className="min-h-dvh bg-z-bg">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton onClick={onExit} />
        <h1 className="font-bold text-lg flex-1">Settings</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 pb-nav-clear space-y-5">
        {/* Appearance */}
        <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-bold text-sm mb-4 text-z-gray-300 uppercase tracking-wide">Appearance</h2>
          <Toggle
            label="Dark theme"
            checked={theme === 'dark'}
            onChange={(next) => setTheme(next ? 'dark' : 'light')}
          />
        </motion.div>

        {/* App — install offer. Always available here regardless of the open-app banner's
            returning-visitor gate (InstallPrompt.tsx), so a first-run user who wants to install
            immediately isn't forced to wait for a second session. */}
        <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
          <h2 className="font-bold text-sm mb-4 text-z-gray-300 uppercase tracking-wide">App</h2>
          {installed ? (
            <p className="text-sm text-z-gray-400">✓ Installed</p>
          ) : installAvailable ? (
            <button
              onClick={() => void promptInstall('settings')}
              className="w-full py-2.5 rounded-xl bg-z-purple/15 text-z-purple-light font-bold text-sm"
            >
              📲 Install QuickSign
            </button>
          ) : isIos() ? (
            <p className="text-sm text-z-gray-400">
              Tap <span className="inline-block align-middle">⬆️</span> Share, then "Add to Home Screen" to install.
            </p>
          ) : (
            <p className="text-sm text-z-gray-400">Install isn't available in this browser yet.</p>
          )}
        </motion.div>

        {/* Accessibility */}
        <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <h2 className="font-bold text-sm mb-4 text-z-gray-300 uppercase tracking-wide">Accessibility</h2>
          <Toggle
            label="Sound Effects"
            description="Audio cues for correct/wrong, level up, streaks"
            icon={soundEnabled ? '🔊' : '🔇'}
            checked={soundEnabled}
            onChange={toggleSound}
            className="mb-4"
          />
          <Toggle
            label="Vibrations"
            description="Haptic feedback for correct/wrong signs"
            icon={vibrationEnabled ? '📳' : '🔕'}
            checked={vibrationEnabled}
            onChange={toggleVibration}
            className="mb-4"
          />
          <Toggle
            label="Speak sign names"
            description="Says the word out loud when you sign it correctly"
            icon={speechEnabled ? '🗣️' : '🤐'}
            checked={speechEnabled}
            onChange={toggleSpeech}
          />
        </motion.div>

        {/* Privacy */}
        <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <h2 className="font-bold text-sm mb-4 text-z-gray-300 uppercase tracking-wide">Privacy</h2>
          <Toggle
            label="Help improve the AI"
            description="Save hand-landmark coordinates (not video) from your attempts as future training data."
            checked={collectTrainingData}
            onChange={setCollectTrainingData}
          />

          {/* Separate from the toggle above: this governs anonymous PRODUCT USAGE analytics
              (PostHog — which screens/features get used, never video, never landmarks), not
              training data. On by default (anonymous until sign-in, no session replay); this is
              the one switch that turns it off entirely. */}
          {/* `checked` is opt-IN while the stored flag is opt-OUT, so the two are inverted here. */}
          <Toggle
            label="Anonymous usage analytics"
            description="Helps us see which features get used and where people get stuck — never your video, never sign data."
            checked={!analyticsOptedOut}
            onChange={(optedIn) => {
              setAnalyticsOptedOutState(!optedIn);
              setAnalyticsOptOut(!optedIn);
            }}
            className="mt-4 pt-4 border-t border-white/5"
          />
        </motion.div>

        {/* Account */}
        <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <h2 className="font-bold text-sm mb-3 text-z-gray-300 uppercase tracking-wide">Account</h2>
          {user ? (
            <>
              <p className="text-sm text-z-gray-300 mb-3">Signed in as <span className="font-semibold text-z-gray-50">{username ?? user.email}</span></p>
              <button onClick={() => setShowLogout(true)} className="w-full py-2.5 rounded-xl bg-z-red/15 text-z-red font-bold text-sm">
                Log out
              </button>
            </>
          ) : (
            <p className="text-sm text-z-gray-400">You're not signed in.</p>
          )}
        </motion.div>

        {/* Support */}
        <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="font-bold text-sm mb-4 text-z-gray-300 uppercase tracking-wide">Support</h2>
          <div className="space-y-2">
            <button
              onClick={() => setShowFeedback(true)}
              className="w-full py-2.5 rounded-xl bg-z-purple/15 text-z-purple-light font-bold text-sm"
            >
              💬 Send feedback / report a problem
            </button>
            {onOpenPrivacy && (
              <button
                onClick={onOpenPrivacy}
                className="w-full py-2.5 rounded-xl bg-white/5 text-z-gray-300 font-bold text-sm"
              >
                Privacy &amp; Terms
              </button>
            )}
          </div>
        </motion.div>

        {/* Admin/dev tools — only visible to profiles.is_admin (see AuthContext.isAdmin) */}
        {isAdmin && (
          <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <h2 className="font-bold text-sm mb-1 text-z-gray-300 uppercase tracking-wide">Admin</h2>
            <p className="text-xs text-z-gray-400 mb-4">Owner-only tools</p>
            <div className="space-y-2">
              <button
                onClick={giveTestCredits}
                className="w-full py-2.5 rounded-xl bg-z-yellow/15 text-z-yellow font-bold text-sm"
              >
                🪙 Add 10,000 Gold &amp; 🤟 10,000 Signs (local test)
              </button>
              <button
                onClick={replayOnboarding}
                className="w-full py-2.5 rounded-xl bg-z-purple/15 text-z-purple-light font-bold text-sm"
              >
                🔄 Replay onboarding (dev)
              </button>
              {onOpenAdmin && (
                <button
                  onClick={onOpenAdmin}
                  className="w-full py-2.5 rounded-xl bg-z-purple/15 text-z-purple-light font-bold text-sm"
                >
                  🛠 Open Admin Panel
                </button>
              )}
            </div>
          </motion.div>
        )}

        <p className="text-center text-xs text-z-gray-600 pt-2">QuickSign v{__APP_VERSION__}</p>
      </div>

      <LogoutConfirm open={showLogout} onClose={() => setShowLogout(false)} />
      {showFeedback && <FeedbackModal page="settings" onClose={() => setShowFeedback(false)} />}
    </div>
  );
}
