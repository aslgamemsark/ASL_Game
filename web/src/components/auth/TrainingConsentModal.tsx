import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

// Shown once per account per device, right after first sign-in, so "Help improve the AI" is an
// explicit choice instead of a silently-defaulted-on toggle. The choice is always changeable
// afterward from Settings -> Privacy.
export function TrainingConsentModal() {
  const { dismissTrainingConsent } = useAuth();

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <motion.div
          className="relative w-full max-w-sm bg-z-card border border-white/10 rounded-3xl p-6 shadow-2xl"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className="text-center mb-5">
            <p className="text-3xl mb-2">🧠</p>
            <h2 className="font-bold text-lg">Help improve the AI?</h2>
            <p className="text-z-gray-400 text-sm mt-1.5 leading-relaxed">
              We can save hand-landmark coordinates (not video) from your sign attempts to train
              future recognition models. You can turn this off anytime in Settings.
            </p>
          </div>

          <motion.button
            onClick={() => dismissTrainingConsent(true)}
            className="w-full py-2.5 rounded-xl bg-z-purple text-white font-bold text-sm mb-2"
            whileTap={{ scale: 0.97 }}
          >
            Yes, keep it on
          </motion.button>
          <button
            onClick={() => dismissTrainingConsent(false)}
            className="w-full py-2 text-xs text-z-gray-500 hover:text-z-gray-300 transition-colors"
          >
            No thanks, turn it off
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
