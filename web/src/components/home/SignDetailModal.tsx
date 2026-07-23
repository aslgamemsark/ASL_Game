import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SignDef } from '@/types/signs';

interface Props {
  sign: SignDef;
  onClose: () => void;
  onTryYourself: (signId: string) => void;
}

export function SignDetailModal({ sign, onClose, onTryYourself }: Props) {
  const [clipFailed, setClipFailed] = useState(false);
  const hasClip = sign.clip != null && !clipFailed;
  const displayName = sign.name.replace(/_/g, ' ');

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          className="relative w-full max-w-sm bg-z-card border border-white/10 rounded-3xl p-5 shadow-2xl"
          initial={{ y: 40, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-z-purple) 25%, transparent), color-mix(in srgb, var(--color-z-purple-light) 35%, transparent))',
                  border: '1px solid color-mix(in srgb, var(--color-z-purple-light) 30%, transparent)',
                }}
              >
                🤟
              </div>
              <p className="font-bold text-z-gray-50 text-lg leading-none">{displayName}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-z-gray-400 hover:text-z-gray-50 text-2xl leading-none -mt-1"
            >
              ×
            </button>
          </div>

          {/* Reference visual */}
          <div className="rounded-2xl overflow-hidden bg-z-bg border border-white/5 aspect-[4/3] flex items-center justify-center mb-4 relative">
            {hasClip ? (
              <video
                src={sign.clip}
                autoPlay
                loop
                muted
                playsInline
                onError={() => setClipFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center px-4">
                <p className="text-3xl mb-2">🤟</p>
                <p className="text-z-gray-300 text-xs leading-relaxed">{sign.howTo ?? sign.description}</p>
              </div>
            )}
            <span className="absolute top-2 left-2 text-[9px] uppercase tracking-widest text-z-gray-300 bg-black/40 px-2 py-0.5 rounded-full">
              {hasClip ? 'Demo clip' : 'Reference'}
            </span>
          </div>

          {/* Description + hint */}
          <p className="text-z-gray-200 text-sm mb-2 leading-relaxed">{sign.description}</p>
          <div className="flex items-start gap-2 mb-4">
            <span className="text-base flex-shrink-0">💡</span>
            <p className="text-z-yellow text-sm italic">{sign.hint}</p>
          </div>

          {/* Try Yourself */}
          <motion.button
            onClick={() => onTryYourself(sign.name)}
            className="w-full rounded-2xl py-3 font-bold text-white text-sm flex items-center justify-center gap-2 bg-gradient-primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            📷 Try Yourself
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
