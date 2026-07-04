import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  clipUrl?: string;
  signName: string;
}

export function ReferenceClip({ clipUrl, signName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [clipUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [clipUrl, failed]);

  const showPlaceholder = !clipUrl || failed;

  return (
    <motion.div
      className="relative rounded-2xl overflow-hidden bg-duo-surface aspect-video"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {showPlaceholder ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-4">
          <span className="text-3xl" aria-hidden="true">🎬</span>
          <p className="text-duo-text-secondary text-sm font-bold">Demo coming soon</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={clipUrl}
          loop
          muted
          playsInline
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
        <p className="text-white text-sm font-bold">{signName.replace(/_/g, ' ')}</p>
        <p className="text-white/70 text-xs">{showPlaceholder ? 'No demo video yet — follow the hint below' : 'Watch and follow along'}</p>
      </div>
    </motion.div>
  );
}
