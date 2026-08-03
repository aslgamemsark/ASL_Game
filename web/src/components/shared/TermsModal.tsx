import { motion } from 'framer-motion';
import { useDialogA11y } from '@/hooks/useDialogA11y';
import { Button } from '@/components/shared/Button';

interface Props {
  onAccept: () => void;
  /** Lets the user into the app without recording acceptance — App.tsx only hides the gate for
   *  the current session, so it resurfaces on their next visit until they actually accept. */
  onAcceptLater: () => void;
}

const TLDR: { icon: string; text: string }[] = [
  { icon: '📷', text: 'Camera video stays on your device — never uploaded or recorded.' },
  { icon: '📊', text: 'We collect account info, progress, and hand-landmark data (not video).' },
  { icon: '🧪', text: "QuickSign is in beta — features and content may still change." },
  { icon: '🤝', text: "Be respectful — harassment or impersonation can get you suspended." },
  { icon: '⚙️', text: 'Data collection is opt-out anytime in Settings → Privacy.' },
];

/**
 * First-run consent gate: shown once before any part of the app is reachable (checked in App.tsx
 * against the 'asl-game-terms-accepted' localStorage flag). Leads with a scannable TL;DR — the
 * full legal text sits behind a collapsed <details> so the modal fits without a scroll wall
 * (production analytics found users bailing here, 2026-07-24).
 */
export function TermsModal({ onAccept, onAcceptLater }: Props) {
  // No `onClose`: this is a consent gate, so Escape must not dismiss it — "Accept later" is the
  // deliberate way out. Wired up even though the component currently has no call sites (the Terms
  // wall was removed from first paint in S1-T7 and this was kept for a one-line restore) so that a
  // restore brings back a dialog with focus management rather than one without.
  const dialog = useDialogA11y({ label: 'Terms and Conditions' });

  return (
    <div className="fixed inset-0 z-takeover bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <motion.div
        ref={dialog.ref}
        {...dialog.props}
        className="w-full max-w-md bg-z-card border border-z-gray-400/20 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] outline-none"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="text-center px-6 pt-6 pb-4 shrink-0">
          <p className="text-3xl mb-2">📜</p>
          <h2 className="font-bold text-lg">Terms &amp; Conditions</h2>
          <p className="text-z-gray-400 text-xs mt-1">The short version, before you continue</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
          <ul className="space-y-2.5">
            {TLDR.map((item) => (
              <li key={item.text} className="flex items-start gap-2.5 text-sm text-z-gray-200">
                <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden="true">{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>

          <details className="mt-4 rounded-xl border border-z-gray-400/15 group">
            <summary className="cursor-pointer select-none list-none px-3 py-2.5 text-xs font-semibold text-z-purple-light flex items-center justify-between">
              Read the full terms
              <span className="text-z-gray-400 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-3 text-xs text-z-gray-300 leading-relaxed border-t border-z-gray-400/10">
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

        <div className="px-6 pt-4 pb-6 shrink-0 flex flex-col gap-2">
          <Button onClick={onAccept} size="lg" fullWidth className="shadow-lg shadow-z-purple/30">
            Accept &amp; Continue
          </Button>
          <button
            onClick={onAcceptLater}
            className="w-full py-3 rounded-2xl font-semibold text-sm border border-z-gray-400/30 text-z-gray-200 hover:border-z-gray-400/50 transition-colors"
          >
            Accept later
          </button>
        </div>
      </motion.div>
    </div>
  );
}
