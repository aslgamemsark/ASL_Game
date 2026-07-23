import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LetterDef } from '@/data/alphabet';
import { ClipEnlarge } from '@/components/lesson/ClipEnlarge';

// All 26 letters now ship a StudioGalt-archive-rendered demo clip in /public/clips
// (LETTER_<letter>.mp4) — independent of whether the letter also has a camera-recognizable
// sign definition (signId). Falls back to a static image (once uploaded) then a placeholder
// if a clip is ever missing or fails to load.
const CLIP_LETTERS = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));

interface Props {
  def: LetterDef;
  onClose: () => void;
  onTryYourself: (signId: string) => void;
}

export function LetterDetailModal({ def, onClose, onTryYourself }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const [clipFailed, setClipFailed] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const hasClip = CLIP_LETTERS.has(def.letter) && !clipFailed;
  const canPractice = def.signId != null;

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
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-z-purple) 25%, transparent), color-mix(in srgb, var(--color-z-purple-light) 35%, transparent))',
                  border: '1px solid color-mix(in srgb, var(--color-z-purple-light) 30%, transparent)',
                }}
              >
                {def.letter}
              </div>
              <div>
                <p className="text-z-gray-400 text-[10px] uppercase tracking-widest leading-none mb-1">
                  Handshape
                </p>
                <p className="font-bold text-z-gray-50 text-sm leading-none">{def.handshape}</p>
              </div>
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
          <div
            className={`rounded-2xl overflow-hidden bg-z-bg border border-white/5 aspect-[3/4] flex items-center justify-center mb-4 relative ${hasClip ? 'cursor-zoom-in' : ''}`}
            onClick={hasClip ? () => setEnlarged(true) : undefined}
          >
            {hasClip ? (
              <video
                src={`/clips/LETTER_${def.letter}.mp4`}
                autoPlay
                loop
                muted
                playsInline
                onError={() => setClipFailed(true)}
                className="w-full h-full object-contain"
              />
            ) : !imgFailed ? (
              <img
                src={`/alphabet/${def.letter}.png`}
                alt={`How to sign the letter ${def.letter} in ASL`}
                onError={() => setImgFailed(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center px-4">
                <div
                  className="text-6xl font-black mb-2"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-z-purple-light), var(--color-z-purple))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {def.letter}
                </div>
                <p className="text-z-gray-400 text-xs">Reference image coming soon</p>
              </div>
            )}
            <span className="absolute top-2 left-2 text-[9px] uppercase tracking-widest text-z-gray-300 bg-black/40 px-2 py-0.5 rounded-full">
              {hasClip ? 'Demo clip' : 'Reference'}
            </span>
            {hasClip && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white/90 text-xs pointer-events-none">
                ⤢
              </div>
            )}
          </div>

          {hasClip && (
            <ClipEnlarge
              clipUrl={`/clips/LETTER_${def.letter}.mp4`}
              signName={def.letter}
              open={enlarged}
              onClose={() => setEnlarged(false)}
            />
          )}

          {/* Description + hint */}
          <p className="text-z-gray-200 text-sm mb-2 leading-relaxed">{def.description}</p>
          <div className="flex items-start gap-2 mb-4">
            <span className="text-base flex-shrink-0">💡</span>
            <p className="text-z-yellow text-sm italic">{def.hint}</p>
          </div>

          {/* Try Yourself */}
          <motion.button
            onClick={() => canPractice && onTryYourself(def.signId!)}
            disabled={!canPractice}
            className="w-full rounded-2xl py-3 font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-primary"
            whileHover={canPractice ? { scale: 1.02 } : undefined}
            whileTap={canPractice ? { scale: 0.97 } : undefined}
          >
            {canPractice ? (
              <>📷 Try Yourself</>
            ) : (
              <>Camera practice coming soon</>
            )}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
