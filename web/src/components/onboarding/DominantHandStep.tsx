import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useCamera } from '@/hooks/useCamera';
import { getSharedCapture } from '@/engine/capture';
import { WebcamMirror } from '@/components/shared/WebcamMirror';
import { Zippy } from '@/components/shared/Zippy';

interface Props {
  onConfirm: (hand: 'left' | 'right') => void;
  onSkip: () => void;
}

// Consecutive single-hand frames of the same label before we trust the detection — a couple of
// stray frames (a hand entering the frame, a momentary two-hand overlap) shouldn't decide it.
const REQUIRED_VOTES = 6;

/**
 * Onboarding step: ask the user to raise the hand they sign with and read which hand it is off the
 * live camera. The recognition engine is handedness-agnostic, so this is purely to personalize the
 * app — and because the auto-detection has a known subtlety (see the mirror note below), the final
 * value is always confirmed by the user, so it can't silently be wrong.
 */
export function DominantHandStep({ onConfirm, onSkip }: Props) {
  const { videoRef, status, start, stop } = useCamera();
  const [detected, setDetected] = useState<'left' | 'right' | null>(null);
  const [twoHands, setTwoHands] = useState(false);
  const voteRef = useRef<{ label: 'left' | 'right' | null; count: number }>({ label: null, count: 0 });

  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  // Detection loop — runs only until a hand is confidently detected, then stops.
  useEffect(() => {
    if (status !== 'active' || detected) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    void getSharedCapture().then((cap) => {
      if (cancelled) return;
      intervalId = setInterval(() => {
        const v = videoRef.current;
        if (!v || v.videoWidth === 0 || !cap.ready) return;
        let frame;
        try { frame = cap.process(v, performance.now()); } catch { return; }

        if (frame.hands.length === 0) { voteRef.current = { label: null, count: 0 }; setTwoHands(false); return; }
        if (frame.hands.length > 1) { setTwoHands(true); voteRef.current = { label: null, count: 0 }; return; }
        setTwoHands(false);

        // MediaPipe reports handedness assuming a MIRRORED (selfie-flipped) image, but getUserMedia
        // hands us the raw un-flipped frame — so its 'Left'/'Right' is the OPPOSITE of the user's
        // physical hand. Invert here. (The user confirms below, so a wrong guess is still fixable.)
        const raw = frame.hands[0].handedness;
        const physical: 'left' | 'right' = raw === 'Right' ? 'left' : 'right';

        const vote = voteRef.current;
        if (vote.label === physical) vote.count += 1;
        else voteRef.current = { label: physical, count: 1 };
        if (voteRef.current.count >= REQUIRED_VOTES) setDetected(physical);
      }, 120);
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [status, detected, videoRef]);

  const cameraFailed = status === 'denied' || status === 'error';
  const other = (h: 'left' | 'right') => (h === 'left' ? 'right' : 'left');
  const cap = (h: string) => h.charAt(0).toUpperCase() + h.slice(1);

  return (
    <motion.div
      key="hand"
      className="max-w-sm w-full text-center"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Hidden source video for MediaPipe; WebcamMirror draws the visible (flipped) preview. */}
      <video ref={videoRef} autoPlay playsInline muted style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

      <div className="flex justify-center mb-3">
        <Zippy expression="teaching" size="md" />
      </div>
      <h2 className="text-2xl font-bold mb-1">Which hand do you sign with?</h2>
      <p className="text-z-gray-400 text-sm mb-5">
        {cameraFailed
          ? 'No camera — just pick your signing hand.'
          : detected
            ? 'Great — is this right?'
            : 'Raise your dominant hand into the camera.'}
      </p>

      {!cameraFailed && (
        <div className="mb-5">
          <WebcamMirror videoRef={videoRef} />
          {!detected ? (
            <p className="text-xs text-z-gray-500 mt-2 h-4">
              {status === 'requesting' ? 'Starting camera…' : twoHands ? 'Just one hand, please 🙌' : 'Looking for your hand…'}
            </p>
          ) : (
            <motion.p
              className="flex items-center justify-center gap-1.5 text-z-green text-sm font-bold mt-2"
              initial={{ opacity: 0, y: -4, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 320 }}
            >
              <span aria-hidden>✅</span> Got it — {cap(detected)}-handed!
            </motion.p>
          )}
        </div>
      )}

      {cameraFailed || detected ? (
        <div className="flex flex-col gap-3">
          {detected && !cameraFailed && (
            <motion.button
              onClick={() => onConfirm(detected)}
              className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-primary"
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            >
              Yes — I'm {cap(detected)}-handed ✋
            </motion.button>
          )}
          {/* Manual choice: both buttons when the camera failed, or the "switch" option after a
              detection so a mis-read is one tap to fix. */}
          <div className="flex gap-3">
            <motion.button
              onClick={() => onConfirm(detected ? other(detected) : 'right')}
              className="flex-1 py-3 rounded-2xl font-bold text-sm border border-white/15 text-white"
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            >
              {detected && !cameraFailed ? `No — I'm ${cap(other(detected))}-handed` : 'Right hand'}
            </motion.button>
            {(cameraFailed || !detected) && (
              <motion.button
                onClick={() => onConfirm('left')}
                className="flex-1 py-3 rounded-2xl font-bold text-sm border border-white/15 text-white"
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              >
                Left hand
              </motion.button>
            )}
          </div>
        </div>
      ) : null}

      <button onClick={onSkip} className="text-z-gray-400 text-sm mt-4 py-2 underline">
        Skip for now
      </button>
    </motion.div>
  );
}
