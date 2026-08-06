import { useEffect, useRef, useState } from 'react';
import { useDialogA11y } from '@/hooks/useDialogA11y';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

/** Open/close state for the tap-to-enlarge pattern — shared by every clip-enlarging surface so
 *  each caller only has to wire up its own trigger (click, tap, right-click). Pair with
 *  `ClipEnlargeOverlay`, which owns the actual dialog behavior (focus trap, Escape, hardware
 *  Back, scroll lock — see useDialogA11y). */
export function useClipEnlarge() {
  const [expanded, setExpanded] = useState(false);
  return { expanded, open: () => setExpanded(true), close: () => setExpanded(false) };
}

interface ClipEnlargeOverlayProps {
  open: boolean;
  onClose: () => void;
  clipUrl: string;
  label: string;
}

/**
 * Fullscreen, uncropped (object-contain) viewer for a demo clip. Extracted from ReferenceClip.tsx
 * (2026-07-24) so every clip surface (alphabet detail modal, in-practice webcam overlay, replay
 * comparison) gets the identical viewer instead of near-duplicate implementations.
 *
 * Dialog behavior (focus trap, Escape, hardware Back, body scroll lock, iOS keyboard inset) comes
 * from useDialogA11y, not hand-rolled here — an Escape-only version of this component briefly
 * existed and let a keyboard user tab out of the enlarged clip into the page behind it.
 */
export function ClipEnlargeOverlay({ open, onClose, clipUrl, label }: ClipEnlargeOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (open && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [open]);

  const dialog = useDialogA11y({ label: `${label} demo, enlarged`, onClose, active: open });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-takeover bg-black/85 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          ref={dialog.ref}
          {...dialog.props}
        >
          <motion.div
            // Sized off height as well as width: at max-w-2xl (672px) wide, the square was exactly
            // at the edge of a 375x667 phone rotated to landscape (667px viewport minus p-4) and
            // overflowed on anything shorter (mobile audit, 2026-07-28). `h-full` + `max-h-[...]`
            // bounds it by whichever dimension is actually tighter.
            className="relative w-auto h-full max-w-2xl max-h-[calc(100dvh-2rem)] aspect-square mx-auto"
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
            <div className="absolute bottom-3 left-3 right-3 bg-video-plate rounded-xl px-3 py-2">
              <p className="text-white text-sm font-bold">{label}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
