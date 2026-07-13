import { motion } from 'framer-motion';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';

interface Props {
  onExit: () => void;
}

export function PrivacyPage({ onExit }: Props) {
  return (
    <div className="min-h-screen bg-z-bg lg:pl-64">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton onClick={onExit} />
        <h1 className="font-bold text-lg flex-1">Privacy &amp; Terms</h1>
      </div>

      <motion.div
        className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-6 text-sm text-z-gray-300 leading-relaxed"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <section>
          <h2 className="font-bold text-white mb-2">What stays on your device</h2>
          <p>
            Camera video is never uploaded, recorded, or sent to any server. Sign recognition
            (matching your hand shape, position, and movement against a sign) runs entirely
            locally in your browser.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-white mb-2">What we do collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account info: email and the username you choose.</li>
            <li>
              Progress data: XP, streaks, gold, completed lessons, badges, and similar — needed to
              sync your progress across devices and power leaderboards.
            </li>
            <li>
              Numeric hand-landmark coordinates (never video or images) from your practice
              attempts — used to improve future recognition models. This is on by default and can
              be turned off anytime in Settings → Privacy.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-white mb-2">Who can see what</h2>
          <p>
            Your practice data is private to your account. Usernames and leaderboard stats are
            visible to other users by design. Only the two app owners can access admin tools, and
            every admin action (gold grants, bans, etc.) is logged and auditable.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-white mb-2">Terms</h2>
          <p>
            Segno is currently in beta. Features, balance, and content may change without notice.
            Don't use the app to harass or impersonate other users — accounts doing so may be
            suspended. Found a bug or have feedback? Use the "Report a bug" link in Settings.
          </p>
        </section>
      </motion.div>
    </div>
  );
}
