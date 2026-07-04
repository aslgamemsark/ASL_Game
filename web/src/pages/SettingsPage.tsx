import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  onExit: () => void;
}

export function SettingsPage({ onExit }: Props) {
  const { theme, setTheme } = useTheme();
  const { user, username, signOut } = useAuth();

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

      <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <motion.div
          className="bg-z-card border border-white/5 rounded-2xl p-5 mb-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="font-bold text-sm mb-4 text-z-gray-300 uppercase tracking-wide">Appearance</h2>
          <div className="flex items-center gap-3">
            <button
              role="switch"
              aria-checked={theme === 'dark'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${
                theme === 'dark' ? 'bg-z-purple' : 'bg-z-gray-500'
              }`}
            >
              <motion.span
                className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md"
                animate={{ x: theme === 'dark' ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
            <span className="text-sm font-semibold">Dark theme</span>
          </div>
        </motion.div>

        <motion.div
          className="bg-z-card border border-white/5 rounded-2xl p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h2 className="font-bold text-sm mb-3 text-z-gray-300 uppercase tracking-wide">Account</h2>
          {user ? (
            <>
              <p className="text-sm text-z-gray-300 mb-3">Signed in as <span className="font-semibold text-white">{username ?? user.email}</span></p>
              <button
                onClick={signOut}
                className="w-full py-2.5 rounded-xl bg-z-red/15 text-z-red font-bold text-sm"
              >
                Log out
              </button>
            </>
          ) : (
            <p className="text-sm text-z-gray-400">You're not signed in.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
