import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { ModalShell } from '@/components/shared/ModalShell';

// Shown once per account per device, right after first sign-in, so "Help improve the AI" is an
// explicit choice instead of a silently-defaulted-on toggle. The choice is always changeable
// afterward from Settings -> Privacy.
export function TrainingConsentModal() {
  const { dismissTrainingConsent } = useAuth();

  return (
    // Escape defaults to the more privacy-preserving choice (training data off) rather than
    // silently leaving the default-on setting in place — an Escape that did nothing, or one that
    // silently kept collection on, would both be worse than an explicit "no" for a consent prompt.
    <ModalShell onClose={() => dismissTrainingConsent(false)} ariaLabel="Help improve the AI?">
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
            className="w-full py-3 text-xs text-z-gray-400 hover:text-z-gray-300 transition-colors"
          >
            No thanks, turn it off
          </button>
    </ModalShell>
  );
}
