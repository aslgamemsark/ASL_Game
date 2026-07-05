import { motion } from 'framer-motion';

interface Props {
  onContinue: () => void;
}

export function CameraOnboarding({ onContinue }: Props) {
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-z-bg/95 backdrop-blur-sm flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="max-w-sm w-full bg-z-card border border-white/10 rounded-3xl p-6 text-center"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        <div className="text-5xl mb-4">📷</div>
        <h2 className="text-xl font-bold mb-2">Camera Access Needed</h2>
        <p className="text-sm text-z-gray-300 mb-4 leading-relaxed">
          SignUp uses your camera to watch your hand signs and give you real-time feedback.
          Your video stays on your device — nothing is sent to any server.
        </p>

        <div className="space-y-3 text-left mb-6">
          <div className="flex items-start gap-3">
            <span className="text-z-green text-lg">✓</span>
            <p className="text-sm text-z-gray-200">100% private — processed locally in your browser</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-z-green text-lg">✓</span>
            <p className="text-sm text-z-gray-200">Optional replay stays on your device and is never uploaded</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-z-green text-lg">✓</span>
            <p className="text-sm text-z-gray-200">Recognition runs on your device, not a server</p>
          </div>
        </div>

        <motion.button
          onClick={onContinue}
          className="w-full py-3 rounded-2xl font-bold text-white text-base"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          Allow Camera
        </motion.button>

        <p className="text-[11px] text-z-gray-500 mt-3">
          You can revoke camera access anytime in your browser settings
        </p>
      </motion.div>
    </motion.div>
  );
}
