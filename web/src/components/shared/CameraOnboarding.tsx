import { useDialogA11y } from '@/hooks/useDialogA11y';
import { motion } from 'framer-motion';
import { Button } from '@/components/shared/Button';

interface Props {
  onContinue: () => void;
  /** Lets a hesitant first-timer back out to the previous screen instead of being stuck on a
   *  one-way "Allow Camera" commit with no other exit (this screen is a fixed full-screen overlay
   *  that sits on top of the lesson header's own close button). */
  onCancel: () => void;
  /** Duel/Room: your camera video streams live to your opponent over WebRTC, not just to a local
   *  recognizer — a materially different privacy fact from every solo screen (Lesson/Practice/
   *  Story/Speed), so it gets its own copy rather than silently reusing the "never leaves your
   *  device" claim that's true everywhere else. Shown independently of the solo notice's own
   *  one-time flag — a user's first camera screen ever isn't always a solo one. */
  multiplayer?: boolean;
}

export function CameraOnboarding({ onContinue, onCancel, multiplayer }: Props) {
  // Escape backs out rather than continuing — this gate asks for the camera, so the dismissive
  // action is the safe one.
  const dialog = useDialogA11y({ label: 'Camera access', onClose: onCancel });

  return (
    <motion.div
      className="fixed inset-0 z-overlay bg-z-bg/95 backdrop-blur-sm flex items-center justify-center px-6 pt-[calc(1.5rem+var(--sat))] pb-[calc(1.5rem+var(--sab))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* max-h/overflow-y-auto: the bullet list below measures ~650px tall — on an iPhone SE
          (667px viewport minus this container's p-6) it previously overflowed a fixed, centered,
          non-scrolling box, leaving the "Allow Camera" button off-screen with no way to reach it
          (mobile audit, 2026-07-28). Same overflow-first fix OnboardingFlow.tsx already applies to
          its welcome step. */}
      <motion.div
        ref={dialog.ref}
        {...dialog.props}
        className="max-w-sm w-full max-h-full overflow-y-auto bg-z-card border border-white/10 rounded-3xl p-6 text-center outline-none"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        <div className="text-5xl mb-4">📷</div>
        <h2 className="text-xl font-bold mb-2">Camera Access Needed</h2>
        {multiplayer ? (
          <p className="text-sm text-z-gray-300 mb-4 leading-relaxed">
            Your opponent needs to see you sign in real time, so your camera video streams
            directly to their device over a live peer-to-peer connection — no server records or
            stores it.
          </p>
        ) : (
          <p className="text-sm text-z-gray-300 mb-4 leading-relaxed">
            QuickSign uses your camera to watch your hand signs and give you real-time feedback.
            Your video never leaves your device — recognition runs locally in your browser.
          </p>
        )}

        <div className="space-y-3 text-left mb-6">
          {multiplayer ? (
            <>
              <div className="flex items-start gap-3">
                <span className="text-z-green text-lg">✓</span>
                <p className="text-sm text-z-gray-200">Your video is never recorded or stored — it's only ever seen live, by your opponent</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-z-green text-lg">✓</span>
                <p className="text-sm text-z-gray-200">
                  Video usually goes directly device-to-device. If a direct connection isn't
                  possible, it's relayed — still unrecorded, in transit only — through a
                  third-party relay service instead
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="text-z-green text-lg">✓</span>
                <p className="text-sm text-z-gray-200">Your video is never uploaded or recorded — recognition runs locally in your browser</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-z-green text-lg">✓</span>
                <p className="text-sm text-z-gray-200">Optional replay stays on your device and is never uploaded</p>
              </div>
            </>
          )}
          <div className="flex items-start gap-3">
            <span className="text-z-green text-lg">✓</span>
            <p className="text-sm text-z-gray-200">
              With your permission (on by default, toggle anytime in Settings → Privacy), we save
              numeric hand-landmark coordinates — never video or images — from your attempts to help
              train future recognition models
            </p>
          </div>
        </div>

        <Button onClick={onContinue} fullWidth>
          Allow Camera
        </Button>

        <button
          onClick={onCancel}
          className="w-full py-3 mt-2 text-sm font-semibold text-z-gray-400 hover:text-z-gray-200 transition-colors"
        >
          Not now
        </button>

        <p className="text-2xs text-z-gray-400 mt-1">
          You can revoke camera access anytime in your browser settings. Full details in
          Settings → Privacy &amp; Terms.
        </p>
      </motion.div>
    </motion.div>
  );
}
