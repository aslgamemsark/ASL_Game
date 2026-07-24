import { motion } from 'framer-motion';

interface Props {
  onAccept: () => void;
  /** Lets the user into the app without recording acceptance — App.tsx only hides the gate for
   *  the current session, so it resurfaces on their next visit until they actually accept. */
  onAcceptLater: () => void;
}

/**
 * First-run consent gate: shown once before any part of the app is reachable (checked in App.tsx
 * against the 'asl-game-terms-accepted' localStorage flag).
 */
export function TermsModal({ onAccept, onAcceptLater }: Props) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Terms and Conditions"
        className="w-full max-w-md bg-z-card border border-z-gray-400/20 rounded-3xl shadow-2xl flex flex-col max-h-[85vh]"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="text-center px-6 pt-6 pb-4 shrink-0">
          <p className="text-3xl mb-2">📜</p>
          <h2 className="font-bold text-lg">Terms &amp; Conditions</h2>
          <p className="text-z-gray-400 text-xs mt-1">Please review before you continue</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 text-sm text-z-gray-300 leading-relaxed border-y border-z-gray-400/10 py-4">
          <ul className="space-y-2.5 mb-1">
            <li className="flex gap-2.5">
              <span className="shrink-0">📷</span>
              <span>Camera video never leaves your device — sign recognition runs locally in your browser.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0">📊</span>
              <span>We collect account info, progress (XP/streaks/badges), and numeric hand-landmark data (never video).</span>
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0">🚧</span>
              <span>QuickSign is in beta — features and content may change, provided "as is."</span>
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0">🤝</span>
              <span>Be respectful — no harassment or impersonation. Usernames and stats are visible to others.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0">⚙️</span>
              <span>Landmark collection and analytics can be turned off anytime in Settings → Privacy.</span>
            </li>
          </ul>

          <details className="mt-3 group">
            <summary className="cursor-pointer text-xs font-semibold text-z-purple-light hover:text-z-purple-light/80 select-none list-none flex items-center gap-1">
              <span className="inline-block transition-transform group-open:rotate-90">▸</span>
              Read the full terms
            </summary>
            <div className="mt-3 space-y-4 text-xs">
              <section>
                <h3 className="font-bold text-z-gray-50 mb-1">What stays on your device</h3>
                <p>
                  Camera video is never uploaded, recorded, or sent to any server. Sign recognition
                  runs entirely locally in your browser.
                </p>
              </section>
              <section>
                <h3 className="font-bold text-z-gray-50 mb-1">What we collect</h3>
                <p>
                  Account info (email, username), progress data (XP, streaks, badges), and numeric
                  hand-landmark coordinates (never video) used to improve recognition models. All of
                  this is covered in full in our Privacy Policy, reachable anytime from Settings.
                </p>
              </section>
              <section>
                <h3 className="font-bold text-z-gray-50 mb-1">Beta software</h3>
                <p>
                  QuickSign is currently in beta. Features, balance, and content may change without
                  notice. The app is provided "as is," without warranty of any kind, while in beta.
                </p>
              </section>
              <section>
                <h3 className="font-bold text-z-gray-50 mb-1">Community conduct</h3>
                <p>
                  Don't use the app to harass or impersonate other users — accounts doing so may be
                  suspended. Usernames and leaderboard stats are visible to other users by design.
                </p>
              </section>
              <section>
                <h3 className="font-bold text-z-gray-50 mb-1">Your data, your choice</h3>
                <p>
                  Landmark data collection and anonymous usage analytics can both be turned off
                  anytime in Settings → Privacy, without losing access to the app.
                </p>
              </section>
            </div>
          </details>
        </div>

        <div className="px-6 pt-4 pb-6 shrink-0">
          <motion.button
            onClick={onAccept}
            className="w-full py-4 rounded-2xl font-bold text-base bg-gradient-primary text-white shadow-lg shadow-z-purple/30"
            whileTap={{ scale: 0.97 }}
          >
            Accept &amp; Continue
          </motion.button>
          <button
            onClick={onAcceptLater}
            className="w-full mt-2 py-3 rounded-2xl text-sm font-semibold text-z-gray-300 bg-white/5 hover:bg-white/10 transition-colors"
          >
            Accept later
          </button>
        </div>
      </motion.div>
    </div>
  );
}
