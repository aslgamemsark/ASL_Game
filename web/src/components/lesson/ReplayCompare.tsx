import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ParameterChecklist } from '@/components/lesson/ParameterChecklist';
import type { ParamScore } from '@/engine/verifier';
import type { Sign } from '@/engine/schema';

interface Props {
  /** Object URL of the learner's just-recorded attempt (in-memory only, never uploaded). */
  attemptUrl: string;
  /** Reference demo clip, when this sign has one — shown side by side with the attempt. */
  clipUrl?: string;
  signName: string;
  hint?: string;
  /** Final verifier scores from the passing attempt — recap shown when there's no reference clip. */
  params?: ParamScore[] | null;
  sign?: Sign | null;
  onContinue: () => void;
}

/**
 * Post-pass self-review: replay the learner's own attempt, beside the reference demo when one
 * exists. The attempt video is mirrored (scaleX(-1)) so it matches what the learner saw in the
 * live webcam mirror while signing. Slow-mo toggle drives playbackRate on both videos so the
 * comparison stays in step.
 */
export function ReplayCompare({ attemptUrl, clipUrl, signName, hint, params, sign, onContinue }: Props) {
  const attemptRef = useRef<HTMLVideoElement>(null);
  const referenceRef = useRef<HTMLVideoElement>(null);
  const [slowMo, setSlowMo] = useState(false);

  useEffect(() => {
    const rate = slowMo ? 0.5 : 1;
    if (attemptRef.current) attemptRef.current.playbackRate = rate;
    if (referenceRef.current) referenceRef.current.playbackRate = rate;
  }, [slowMo]);

  const sideBySide = Boolean(clipUrl);

  return (
    <motion.div
      className="flex-1 flex flex-col gap-4 pt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-center">
        <p className="text-sm text-z-gray-400 uppercase tracking-widest">Your replay</p>
        <h2 className="text-2xl font-bold mt-1">{signName.replace(/_/g, ' ')}</h2>
      </div>

      <div className={sideBySide ? 'grid grid-cols-2 gap-3' : ''}>
        <div className="relative rounded-2xl overflow-hidden bg-z-surface aspect-[4/3]">
          <video
            ref={attemptRef}
            src={attemptUrl}
            loop
            muted
            playsInline
            autoPlay
            className="w-full h-full object-contain"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
            <p className="text-white text-xs font-bold">You</p>
          </div>
        </div>

        {sideBySide && (
          <div className="relative rounded-2xl overflow-hidden bg-z-surface aspect-[4/3]">
            <video
              ref={referenceRef}
              src={clipUrl}
              loop
              muted
              playsInline
              autoPlay
              className="w-full h-full object-contain"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
              <p className="text-white text-xs font-bold">Reference</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-z-gray-500">
          Replay stays on your device and is deleted when you continue.
        </p>
        <button
          onClick={() => setSlowMo((s) => !s)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            slowMo
              ? 'border-z-purple-light text-z-purple-light'
              : 'border-z-gray-500/30 text-z-gray-400 hover:text-z-gray-200'
          }`}
          aria-pressed={slowMo}
        >
          🐢 Slow-mo {slowMo ? 'on' : 'off'}
        </button>
      </div>

      {!sideBySide && (
        <>
          {hint && (
            <p className="text-sm text-z-gray-300 text-center italic">{hint}</p>
          )}
          {params && params.length > 0 && (
            <ParameterChecklist params={params} sign={sign} />
          )}
        </>
      )}

      <motion.button
        onClick={onContinue}
        className="mt-auto w-full py-3 rounded-2xl font-bold text-white text-base"
        style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
      >
        Continue
      </motion.button>
    </motion.div>
  );
}
