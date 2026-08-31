import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useClipEnlarge, ClipEnlargeOverlay } from '@/components/shared/ClipEnlarge';

interface Props {
  clipUrl?: string;
  signName: string;
  /**
   * Smaller fixed-size rendering for screens where the reference clip shares space with the
   * live webcam mirror + coaching checklist (e.g. the active signing view) — at full
   * aspect-square width those three stacked easily exceed one phone screen, pushing the
   * checklist below the fold where it's easy to miss entirely. The receptive quiz view (the
   * clip alone, no webcam/checklist below it) keeps the default full size.
   */
  compact?: boolean;
}

export function ReferenceClip({ clipUrl, signName, compact }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [rate, setRate] = useState(1);
  const [mirrored, setMirrored] = useState(false);
  const { expanded, open, close } = useClipEnlarge();

  useEffect(() => {
    setFailed(false);
  }, [clipUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [clipUrl, failed]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  const showPlaceholder = !clipUrl || failed;
  const displayName = signName.replace(/_/g, ' ');

  return (
    <>
      <motion.div
        className={`relative rounded-2xl overflow-hidden bg-z-card ${
          compact ? 'w-28 h-28 mx-auto lg:w-full lg:h-auto lg:aspect-square lg:mx-0' : 'aspect-square'
        }`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        {showPlaceholder ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-4">
            <span className={compact ? 'text-xl lg:text-3xl' : 'text-3xl'} aria-hidden="true">🎬</span>
            <p className={`text-z-gray-300 text-sm font-bold ${compact ? 'hidden lg:block' : ''}`}>Demo coming soon</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={clipUrl}
              loop
              muted
              playsInline
              controls
              onError={() => setFailed(true)}
              className="w-full h-full object-contain"
              style={{ transform: mirrored ? 'scaleX(-1)' : undefined }}
            />
            <div className="absolute top-2 right-2 flex gap-1">
              <button type="button" onClick={() => { if (videoRef.current) { videoRef.current.currentTime = 0; void videoRef.current.play(); } }} aria-label="Restart reference clip" className="min-w-11 min-h-11 rounded-full bg-video-plate text-white">↺</button>
              <button type="button" onClick={() => setMirrored((value) => !value)} aria-pressed={mirrored} aria-label="Mirror reference clip" className="min-w-11 min-h-11 rounded-full bg-video-plate text-white">⇄</button>
              <button type="button" onClick={open} aria-label="Enlarge reference clip" className="min-w-11 min-h-11 rounded-full bg-video-plate text-white">⤢</button>
            </div>
            <div className="absolute top-14 right-2 flex gap-1 bg-video-plate rounded-lg p-1">
              {[0.5, 0.75, 1].map((value) => <button key={value} type="button" onClick={() => setRate(value)} aria-pressed={rate === value} className="min-w-11 min-h-11 text-xs text-white rounded">{value}×</button>)}
            </div>
          </>
        )}
        {/* The caption used to be a single `from-black/60 to-transparent` fade with the text
            inside it. On a `to-t` gradient the transparent end is at the TOP — which is exactly
            where the sign name sits — so the most important label on the surface had the least
            backing behind it: 1.41:1 against a bright frame. A fade is decoration, not a plate.
            Split in two: the fade is now a text-free lead-in strip that keeps the soft edge, and
            the text sits on a real plate underneath it.

            Hidden below `lg` in the compact (desktop three-column) variant, where the clip is a
            thumbnail alongside the webcam and the sign name is already the page heading. */}
        <div className={`absolute bottom-0 left-0 right-0 ${compact ? 'hidden lg:block' : ''}`}>
          <div className="h-6 bg-gradient-to-t from-black/62 to-transparent" aria-hidden="true" />
          <div className="bg-video-plate p-3">
            <p className="text-white text-sm font-bold">{displayName}</p>
            <p className="text-white/85 text-xs">{showPlaceholder ? 'No demo video yet — follow the hint below' : 'Use the controls to review the sign'}</p>
          </div>
        </div>
      </motion.div>

      {compact && !showPlaceholder && (
        <p className="text-center text-z-gray-300 text-xs mt-1 lg:hidden">Use ⤢ to enlarge</p>
      )}

      {!showPlaceholder && clipUrl && (
        <ClipEnlargeOverlay open={expanded} onClose={close} clipUrl={clipUrl} label={displayName} />
      )}
    </>
  );
}
