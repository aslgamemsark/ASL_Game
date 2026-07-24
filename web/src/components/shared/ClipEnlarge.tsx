import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

/** Open/close state for the tap-to-enlarge pattern, plus the Escape-to-close listener — shared by
 *  every clip-enlarging surface so each caller only has to wire up its own trigger (click, tap,
 *  right-click). Pair with `ClipEnlargeOverlay`. */
export function useClipEnlarge() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  return { expanded, open: () => setExpanded(true), close: () => setExpanded(false) };
}

interface ClipEnlargeOverlayProps {
  open: boolean;
  onClose: () => void;
  clipUrl: string;
  label: string;
}

/**
 * Full-viewport portal showing `clipUrl` uncropped (object-contain) over a dark backdrop, with a
 * close button and Esc/backdrop-click to dismiss. Mount once per enlargeable clip; visibility is
 * driven by `open` (pair with `useClipEnlarge`). Extracted from the lesson ReferenceClip's
 * original enlarge overlay so every clip surface (letter detail, practice webcam demo, replay
 * compare) gets the identical viewer instead of three near-duplicate implementations.
 */
export function ClipEnlargeOverlay({ open, onClose, clipUrl, label }: ClipEnlargeOverlayProps) {
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
          aria-label={`${label} demo, enlarged`}
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
              src={clipUrl}
              autoPlay
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
              <p className="text-white text-sm font-bold">{label}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
