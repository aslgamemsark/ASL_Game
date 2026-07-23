import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface Props {
  clipUrl: string;
  signName: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Fullscreen, uncropped (object-contain) viewer for a demo clip — Esc or backdrop-click to close.
 * Extracted from ReferenceClip.tsx (2026-07-24) so every clip surface (alphabet detail modal,
 * in-practice webcam overlay, replay comparison) gets the same enlarge affordance instead of only
 * lesson/practice/story's ReferenceClip having one.
 */
export function ClipEnlarge({ clipUrl, signName, open, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (open && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${signName.replace(/_/g, ' ')} demo, enlarged`}
        >
          <motion.div
            className="relative w-full max-w-2xl aspect-square"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={videoRef}
              src={clipUrl}
              loop
              muted
              playsInline
              className="w-full h-full object-contain rounded-2xl bg-z-card"
            />
            <button
              onClick={onClose}
              aria-label="Close enlarged view"
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-z-card border border-white/10 flex items-center justify-center text-z-gray-50 text-lg shadow-lg"
            >
              ✕
            </button>
            <div className="absolute bottom-3 left-3 right-3 bg-black/60 rounded-xl px-3 py-2">
              <p className="text-white text-sm font-bold">{signName.replace(/_/g, ' ')}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
