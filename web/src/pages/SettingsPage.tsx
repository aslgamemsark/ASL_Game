import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUserStore } from '@/stores/useUserStore';

interface Props {
  onExit: () => void;
  onOpenAdmin?: () => void;
}

export function SettingsPage({ onExit, onOpenAdmin }: Props) {
  const { theme, setTheme } = useTheme();
  const { user, username, signOut, isAdmin } = useAuth();
  const { vibrationEnabled, toggleVibration } = useSettingsStore();
  const { addGold, addSigns, collectTrainingData, setCollectTrainingData } = useUserStore();

  const giveTestCredits = () => {
    addGold(10000);
    addSigns(10000);
  };

  return (
    <div className="min-h-screen bg-z-bg lg:pl-64">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <button onClick={onExit} className="w-8 h-8 flex items-center justify-center text-z-gray-400 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
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
              className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${theme === 'dark' ? 'bg-z-purple' : 'bg-z-gray-500'}`}
            >
              <motion.span
                className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md"
                animate={{ x: theme === 'dark' ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </motion.div>

        {/* Accessibility */}
        <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <h2 className="font-bold text-sm mb-4 text-z-gray-300 uppercase tracking-wide">Accessibility</h2>
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
              className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${vibrationEnabled ? 'bg-z-purple' : 'bg-z-gray-500'}`}
            >
              <motion.span
                className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md"
                animate={{ x: vibrationEnabled ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
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
              className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${collectTrainingData ? 'bg-z-purple' : 'bg-z-gray-500'}`}
            >
              <motion.span
                className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md"
                animate={{ x: collectTrainingData ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </motion.div>

        {/* Account */}
        <motion.div className="bg-z-card border border-white/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <h2 className="font-bold text-sm mb-3 text-z-gray-300 uppercase tracking-wide">Account</h2>
          {user ? (
            <>
              <p className="text-sm text-z-gray-300 mb-3">Signed in as <span className="font-semibold text-white">{username ?? user.email}</span></p>
              <button onClick={signOut} className="w-full py-2.5 rounded-xl bg-z-red/15 text-z-red font-bold text-sm">
                Log out
              </button>
            </>
          ) : (
            <p className="text-sm text-z-gray-400">You're not signed in.</p>
          )}
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
    </div>
  );
}
