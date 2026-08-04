import { useState } from 'react';
import { useDialogA11y } from '@/hooks/useDialogA11y';
import { motion } from 'framer-motion';
import type { SignDef } from '@/types/signs';
import { Button } from '@/components/shared/Button';

interface Props {
  sign: SignDef;
  onClose: () => void;
  onTryYourself: (signId: string) => void;
}

export function SignDetailModal({ sign, onClose, onTryYourself }: Props) {
  const dialog = useDialogA11y({ label: sign.name.replace(/_/g, ' '), onClose });
  const [clipFailed, setClipFailed] = useState(false);
  const hasClip = sign.clip != null && !clipFailed;
  const displayName = sign.name.replace(/_/g, ' ');

  // No AnimatePresence here — see the matching comment in LetterDetailModal.tsx for why a second
  // AnimatePresence around unconditional content deadlocks the caller's screen-level transition.
  // The caller (BasicSignsTab) already supplies the one that owns this component's lifecycle.
  return (
      <motion.div
        className="fixed inset-0 z-overlay flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          ref={dialog.ref}
          {...dialog.props}
          className="relative w-full max-w-sm max-h-[85dvh] overflow-y-auto bg-z-card border border-white/10 rounded-3xl p-5 shadow-2xl outline-none"
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
              className="w-11 h-11 -mr-2.5 -mt-2.5 flex items-center justify-center text-z-gray-400 hover:text-z-gray-50 text-2xl leading-none shrink-0"
            >
              ×
            </button>
          </div>

          {/* Reference visual */}
          {/* aspect-square + object-contain, not the previous aspect-[4/3] + object-cover: every
              clip in public/clips is a 720x720 source (measured 2026-08-05), so a 4:3 box with
              object-cover cropped ~25% of the height off the top and bottom — the avatar's head,
              since it sits at the top of frame. LetterDetailModal and ReferenceClip already use
              object-contain for the same clips; this was the one inconsistent surface. */}
          <div className="rounded-2xl overflow-hidden bg-z-bg border border-white/5 aspect-square flex items-center justify-center mb-4 relative">
            {hasClip ? (
              <video
                src={sign.clip}
                autoPlay
                loop
                muted
                playsInline
                onError={() => setClipFailed(true)}
                className="w-full h-full object-contain"
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
          <Button onClick={() => onTryYourself(sign.name)} size="sm" fullWidth>
            📷 Try Yourself
          </Button>
        </motion.div>
      </motion.div>
  );
}
