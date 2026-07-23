import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipEnlarge } from './ClipEnlarge';

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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [clipUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [clipUrl, failed]);

  const showPlaceholder = !clipUrl || failed;
  const openEnlarged = showPlaceholder ? undefined : () => setExpanded(true);

  return (
    <>
      <motion.div
        className={`relative rounded-2xl overflow-hidden bg-z-card ${
          compact ? 'w-28 h-28 mx-auto' : 'aspect-square'
        } ${showPlaceholder ? '' : 'cursor-zoom-in'}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={openEnlarged}
        onContextMenu={
          showPlaceholder
            ? undefined
            : (e) => {
                e.preventDefault();
                setExpanded(true);
              }
        }
      >
        {showPlaceholder ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-4">
            <span className={compact ? 'text-xl' : 'text-3xl'} aria-hidden="true">🎬</span>
            {!compact && <p className="text-z-gray-300 text-sm font-bold">Demo coming soon</p>}
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={clipUrl}
              loop
              muted
              playsInline
              onError={() => setFailed(true)}
              className="w-full h-full object-contain"
            />
            {/* Discoverability hint for the click/right-click-to-enlarge affordance below. */}
            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white/90 text-xs pointer-events-none">
              ⤢
            </div>
          </>
        )}
        {!compact && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
            <p className="text-white text-sm font-bold">{signName.replace(/_/g, ' ')}</p>
            <p className="text-white/70 text-xs">{showPlaceholder ? 'No demo video yet — follow the hint below' : 'Watch and follow along — tap to enlarge'}</p>
          </div>
        )}
      </motion.div>

      {compact && !showPlaceholder && (
        <p className="text-center text-z-gray-300 text-xs mt-1">Too small to see? Tap to enlarge ⤢</p>
      )}

      {!showPlaceholder && (
        <ClipEnlarge
          clipUrl={clipUrl!}
          signName={signName}
          open={expanded}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
}
