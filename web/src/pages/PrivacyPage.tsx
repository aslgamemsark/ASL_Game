import { motion } from 'framer-motion';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';

interface Props {
  onExit: () => void;
}

export function PrivacyPage({ onExit }: Props) {
  return (
    <div className="min-h-dvh bg-z-bg">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton onClick={onExit} />
        <h1 className="font-bold text-lg flex-1">Privacy &amp; Terms</h1>
      </div>

      <motion.div
        className="max-w-lg mx-auto px-4 pt-6 pb-nav-clear space-y-6 text-sm text-z-gray-300 leading-relaxed"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <section>
          <h2 className="font-bold text-z-gray-50 mb-2">What stays on your device</h2>
          <p>
            In Lessons, Practice, and Story, camera video is never uploaded, recorded, or sent
            to any server. Sign recognition (matching your hand shape, position, and movement
            against a sign) runs entirely locally in your browser — only numeric landmark
            coordinates ever leave your device, and only if you opt in below.
          </p>
          <p className="mt-2">
            Duel and Room modes are different: your opponent needs to see you sign in real
            time, so your camera video streams directly to their device over a live peer-to-peer
            video connection (WebRTC) — the same technology behind most video calling. No
            server records or stores this video. When a direct connection between two devices
            isn't possible (for example, both are behind restrictive networks), the video is
            relayed — still unrecorded, in transit only — through a third-party relay service
            (openrelay.metered.ca) rather than going directly device-to-device.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-z-gray-50 mb-2">What we do collect</h2>
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
            <li>
              Anonymous product-usage analytics (which screens you visit, feature usage) to help
              us improve the app — no video, images, or camera data are ever included.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-z-gray-50 mb-2">Anonymous usage analytics</h2>
          <p>
            We use PostHog to see which screens and features get used, and to record and replay
            sessions so we can see where people get stuck — never video, and never sign/landmark
            data. Anything you type (passwords, emails, usernames, chat) is masked before it's
            captured, so replays show navigation and clicks, never what you typed. Events aren't
            tied to your identity until you sign in. Turn this off anytime in Settings → Privacy.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-z-gray-50 mb-2">Who can see what</h2>
          <p>
            Your practice data is private to your account. Usernames and leaderboard stats are
            visible to other users by design. Only the two app owners can access admin tools, and
            every admin action (gold grants, bans, etc.) is logged and auditable.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-z-gray-50 mb-2">Deleting your data</h2>
          <p>
            There's no self-service delete button yet — email us at{' '}
            <a href="mailto:aslgamemsark@gmail.com" className="text-z-purple-light underline">
              aslgamemsark@gmail.com
            </a>{' '}
            and we'll remove your account and associated data.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-z-gray-50 mb-2">Contact</h2>
          <p>
            Questions, bug reports, or feedback:{' '}
            <a href="mailto:aslgamemsark@gmail.com" className="text-z-purple-light underline">
              aslgamemsark@gmail.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="font-bold text-z-gray-50 mb-2">Terms</h2>
          <p>
            QuickSign is currently in beta. Features, balance, and content may change without notice.
            The app is provided "as is," without warranty of any kind, while in beta. Don't use the
            app to harass or impersonate other users — accounts doing so may be suspended. Found a
            bug or have feedback? Use the "Report a bug" link in Settings, or email us above.
          </p>
        </section>
      </motion.div>
    </div>
  );
}
