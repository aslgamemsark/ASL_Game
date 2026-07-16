import { useState } from 'react';
import { motion } from 'framer-motion';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUserStore } from '@/stores/useUserStore';
import { LogoutConfirm } from '@/components/auth/LogoutConfirm';
import { FeedbackModal } from '@/components/shared/FeedbackModal';

interface Props {
  onExit: () => void;
  onOpenAdmin?: () => void;
  onOpenPrivacy?: () => void;
}

export function SettingsPage({ onExit, onOpenAdmin, onOpenPrivacy }: Props) {
  const { theme, setTheme } = useTheme();
  const { user, username, isAdmin } = useAuth();
  const { vibrationEnabled, toggleVibration, soundEnabled, toggleSound } = useSettingsStore();
  const { addGold, addSigns, collectTrainingData, setCollectTrainingData } = useUserStore();
  const [showLogout, setShowLogout] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

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
    <div className="min-h-screen bg-z-bg">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton onClick={onExit} />
        <h1 className="font-bold text-lg flex-1">Settings</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-5">
        {/* Appearance */}
        <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-bold text-sm mb-4 text-z-gray-300 uppercase tracking-wide">Appearance</h2>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Dark theme</span>
            <button
              role="switch"
              aria-checked={theme === 'dark'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 -m-1.5 shrink-0"
            >
              <span className={`relative block w-14 h-8 rounded-full transition-colors ${theme === 'dark' ? 'bg-z-purple' : 'bg-z-gray-500'}`}>
                <motion.span
                  className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md"
                  animate={{ x: theme === 'dark' ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </span>
            </button>
          </div>
        </motion.div>

        {/* Accessibility */}
        <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <h2 className="font-bold text-sm mb-4 text-z-gray-300 uppercase tracking-wide">Accessibility</h2>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">{soundEnabled ? '🔊' : '🔇'}</span>
              <div>
                <p className="font-semibold text-sm">Sound Effects</p>
                <p className="text-xs text-z-gray-400">Audio cues for correct/wrong, level up, streaks</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={soundEnabled}
              onClick={toggleSound}
              className="p-1.5 -m-1.5 shrink-0"
            >
              <span className={`relative block w-14 h-8 rounded-full transition-colors ${soundEnabled ? 'bg-z-purple' : 'bg-z-gray-500'}`}>
                <motion.span
                  className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md"
                  animate={{ x: soundEnabled ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </span>
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">{vibrationEnabled ? '📳' : '🔕'}</span>
              <div>
                <p className="font-semibold text-sm">Vibrations</p>
                <p className="text-xs text-z-gray-400">Haptic feedback for correct/wrong signs</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={vibrationEnabled}
              onClick={toggleVibration}
              className="p-1.5 -m-1.5 shrink-0"
            >
              <span className={`relative block w-14 h-8 rounded-full transition-colors ${vibrationEnabled ? 'bg-z-purple' : 'bg-z-gray-500'}`}>
                <motion.span
                  className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md"
                  animate={{ x: vibrationEnabled ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </span>
            </button>
          </div>
        </motion.div>

        {/* Privacy */}
        <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <h2 className="font-bold text-sm mb-4 text-z-gray-300 uppercase tracking-wide">Privacy</h2>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">Help improve the AI</p>
              <p className="text-xs text-z-gray-400 mt-0.5 leading-relaxed">
                Save hand-landmark coordinates (not video) from your attempts as future training data.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={collectTrainingData}
              onClick={() => setCollectTrainingData(!collectTrainingData)}
              className="p-1.5 -m-1.5 shrink-0"
            >
              <span className={`relative block w-14 h-8 rounded-full transition-colors ${collectTrainingData ? 'bg-z-purple' : 'bg-z-gray-500'}`}>
                <motion.span
                  className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md"
                  animate={{ x: collectTrainingData ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </span>
            </button>
          </div>
        </motion.div>

        {/* Account */}
        <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <h2 className="font-bold text-sm mb-3 text-z-gray-300 uppercase tracking-wide">Account</h2>
          {user ? (
            <>
              <p className="text-sm text-z-gray-300 mb-3">Signed in as <span className="font-semibold text-white">{username ?? user.email}</span></p>
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
            <p className="text-xs text-z-gray-500 mb-4">Owner-only tools</p>
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
      </div>

      <LogoutConfirm open={showLogout} onClose={() => setShowLogout(false)} />
      {showFeedback && <FeedbackModal page="settings" onClose={() => setShowFeedback(false)} />}
    </div>
  );
}
