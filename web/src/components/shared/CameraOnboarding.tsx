import { useDialogA11y } from '@/hooks/useDialogA11y';
import { motion } from 'framer-motion';

interface Props {
  onContinue: () => void;
  /** Lets a hesitant first-timer back out to the previous screen instead of being stuck on a
   *  one-way "Allow Camera" commit with no other exit (this screen is a fixed full-screen overlay
   *  that sits on top of the lesson header's own close button). */
  onCancel: () => void;
}

export function CameraOnboarding({ onContinue, onCancel }: Props) {
  // Escape backs out rather than continuing — this gate asks for the camera, so the dismissive
  // action is the safe one.
  const dialog = useDialogA11y({ label: 'Camera access', onClose: onCancel });

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-z-bg/95 backdrop-blur-sm flex items-center justify-center px-6 pt-[calc(1.5rem+var(--sat))] pb-[calc(1.5rem+var(--sab))]"
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
        <p className="text-sm text-z-gray-300 mb-4 leading-relaxed">
          QuickSign uses your camera to watch your hand signs and give you real-time feedback.
          Your video never leaves your device — recognition runs locally in your browser.
        </p>

        <div className="space-y-3 text-left mb-6">
          <div className="flex items-start gap-3">
            <span className="text-z-green text-lg">✓</span>
            <p className="text-sm text-z-gray-200">Your video is never uploaded or recorded — recognition runs locally in your browser</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-z-green text-lg">✓</span>
            <p className="text-sm text-z-gray-200">Optional replay stays on your device and is never uploaded</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-z-green text-lg">✓</span>
            <p className="text-sm text-z-gray-200">
              With your permission (on by default, toggle anytime in Settings → Privacy), we save
              numeric hand-landmark coordinates — never video or images — from your attempts to help
              train future recognition models
            </p>
          </div>
        </div>

        <motion.button
          onClick={onContinue}
          className="w-full py-3 rounded-2xl font-bold text-white text-base bg-gradient-primary"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          Allow Camera
        </motion.button>

        <button
          onClick={onCancel}
          className="w-full py-3 mt-2 text-sm font-semibold text-z-gray-400 hover:text-z-gray-200 transition-colors"
        >
          Not now
        </button>

        <p className="text-[11px] text-z-gray-500 mt-1">
          You can revoke camera access anytime in your browser settings. Full details in
          Settings → Privacy &amp; Terms.
        </p>
      </motion.div>
    </motion.div>
  );
}
