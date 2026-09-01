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

function supportsNativeVideoControls(): boolean {
  if (typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent;
  return !/AppleWebKit/.test(ua) || /(Chrome|Chromium|Edg)\//.test(ua);
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
  const [rate, setRate] = useState(1);
  const [mirrored, setMirrored] = useState(false);
  const [controlsReady, setControlsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const nativeControls = supportsNativeVideoControls();

  useEffect(() => {
    setControlsReady(false);
    setDuration(0);
    setCurrentTime(0);
    setPlaying(true);
    if (open && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [clipUrl, open]);

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
            // Bound the square by the tighter viewport dimension so every control remains visible
            // on both narrow portrait phones and short landscape screens.
            className="relative w-[min(calc(100vw-2rem),calc(100dvh-2rem),42rem)] aspect-square mx-auto"
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
              controls={controlsReady && nativeControls}
              onLoadedMetadata={(event) => {
                event.currentTarget.playbackRate = rate;
                const mediaDuration = event.currentTarget.duration;
                setDuration(Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : 0);
                setControlsReady(Number.isFinite(mediaDuration) && mediaDuration > 0);
              }}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              className={`w-full h-full object-contain rounded-2xl bg-z-card ${mirrored ? '-scale-x-100' : ''}`}
            />
            {controlsReady && !nativeControls && (
              <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2">
              <button type="button" onClick={() => { const video = videoRef.current; if (!video) return; if (video.paused) void video.play(); else video.pause(); }} aria-label={playing ? 'Pause enlarged clip' : 'Play enlarged clip'} className="min-w-11 min-h-11 rounded bg-video-plate text-white">{playing ? 'Ⅱ' : '▶'}</button>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={currentTime}
                onChange={(event) => {
                  const nextTime = Number(event.currentTarget.value);
                  setCurrentTime(nextTime);
                  if (videoRef.current) videoRef.current.currentTime = nextTime;
                }}
                aria-label="Scrub enlarged clip"
                className="min-h-11 flex-1"
              />
              </div>
            )}
            <div className="absolute top-2 left-2 flex gap-1 bg-video-plate rounded-lg p-1">
              <button type="button" onClick={() => { if (videoRef.current) { videoRef.current.currentTime = 0; void videoRef.current.play(); } }} aria-label="Restart enlarged clip" className="min-w-11 min-h-11 rounded text-white">↺</button>
              <button type="button" onClick={() => setMirrored((value) => !value)} aria-pressed={mirrored} aria-label="Mirror enlarged clip" className="min-w-11 min-h-11 rounded text-white">⇄</button>
              {[0.5, 0.75, 1].map((value) => (
                <button key={value} type="button" onClick={() => { setRate(value); if (videoRef.current?.readyState) videoRef.current.playbackRate = value; }} aria-pressed={rate === value} className="min-w-11 min-h-11 rounded text-xs text-white">{value}×</button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close enlarged view"
              className="absolute -top-3 -right-3 min-w-11 min-h-11 rounded-full bg-z-card border border-white/10 flex items-center justify-center text-z-gray-50 text-lg shadow-lg"
            >
              ✕
            </button>
            <div className="absolute bottom-12 left-3 right-3 bg-video-plate rounded-xl px-3 py-2 pointer-events-none">
              <p className="text-white text-sm font-bold">{label}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
