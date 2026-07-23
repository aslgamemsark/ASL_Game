import { useEffect, useRef, useState, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { getSharedCapture } from '@/engine/capture';
import { handCenter } from '@/engine/landmarks';
import { WebcamMirror } from '@/components/shared/WebcamMirror';
import { Zippy } from '@/components/shared/Zippy';

interface Props {
  /** An already-active camera stream — the host page owns starting/stopping it and only mounts
   *  this component once camera status is 'active', so unlike this component's original home in
   *  onboarding (DominantHandStep), there's no "camera failed" case to handle here. */
  videoRef: RefObject<HTMLVideoElement | null>;
  onConfirm: (hand: 'left' | 'right') => void;
  onSkip: () => void;
}

// This is a position check, not a shape classifier — unlike the sign-recognition confusor
// thresholds elsewhere in this app (LETTER_E, DOCTOR, etc.), there's no ambiguous handshape here
// to get wrong, only a transient "hand swinging past a box on its way up" risk, which is both
// rare and one tap to correct via the switch option below. That asymmetry is why this dwell is
// intentionally much lighter than a shape-confusor debounce — reported as still feeling slow at
// REQUIRED_VOTES=3 (2026-07-16), so this fires on the very first frame in a box.
const REQUIRED_VOTES = 1;
// Fraction of the (mirrored) frame width each side's box claims, with a neutral gap between them
// so a hand near dead-center doesn't flicker between sides.
const ZONE_SPLIT = 0.46;
// Once a side is settled, auto-confirm after this brief "Got it" flash instead of waiting for a
// manual tap — placing the hand in a box IS the selection now, per the geometric approach above,
// so a second confirm step just adds latency without adding safety. Still gives a moment to tap
// the switch option below if it read wrong.
const AUTO_CONFIRM_MS = 300;
// How often the detection loop samples a frame. Tightened alongside the above for a snappier
// feel; MediaPipe's own per-frame processing time is the real floor on slower hardware, but this
// at least stops the poll cadence itself from adding to the wait.
const POLL_MS = 80;

type Zone = 'none' | 'multi' | 'neutral' | 'left' | 'right';

/**
 * One-time dominant-hand check: ask the user to place the hand they sign with into an on-screen
 * box (a left box and a right box, drawn over the mirrored camera feed) and read off which one.
 *
 * Moved out of onboarding (2026-07-23, formerly DominantHandStep) — asking for camera access
 * before a brand-new user had even seen the app made some people bail at the permission prompt.
 * Shown instead the first time a real practice session's camera actually turns on (see
 * PracticePage + lib/handCheckGate.ts's shouldShowHandCheck), reusing that page's already-active
 * stream rather than opening a second one.
 *
 * This is deliberately geometric — WHICH HALF OF THE MIRRORED DISPLAY the hand is in — rather than
 * reading MediaPipe's `handedness` label. That label assumes the input image is mirrored before
 * being fed to the model (a selfie-camera assumption); getUserMedia hands us the raw, un-flipped
 * frame, so in theory the label should always be inverted from the physical hand. In practice this
 * is NOT a stable assumption to hardcode: some webcam drivers already mirror the stream themselves
 * before it reaches the browser, so "invert the label" is only sometimes correct — confirmed on
 * real hardware (2026-07-16), where raising the physical right hand read as "left-handed". The
 * box-placement approach sidesteps the whole question: WebcamMirror always mirrors for display
 * (`ctx.scale(-1,1)`), so a box drawn on the right side of that mirrored view is exactly where a
 * user's real right hand lands when they look at their own reflection and raise it — true
 * regardless of whatever the camera/driver did upstream.
 */
export function DominantHandCheck({ videoRef, onConfirm, onSkip }: Props) {
  const [detected, setDetected] = useState<'left' | 'right' | null>(null);
  const [zone, setZone] = useState<Zone>('none');
  const voteRef = useRef<{ side: 'left' | 'right' | null; count: number }>({ side: null, count: 0 });

  // Detection loop — runs only until a side is confidently settled, then stops.
  useEffect(() => {
    if (detected) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    void getSharedCapture().then((cap) => {
      if (cancelled) return;
      intervalId = setInterval(() => {
        const v = videoRef.current;
        if (!v || v.videoWidth === 0 || !cap.ready) return;
        let frame;
        // skipPose: this screen only ever reads frame.hands — pose inference is a real, separate
        // per-frame model cost that has no payoff here (see capture.ts's process() doc).
        try { frame = cap.process(v, performance.now(), { skipPose: true }); } catch { return; }

        if (frame.hands.length === 0) { voteRef.current = { side: null, count: 0 }; setZone('none'); return; }
        if (frame.hands.length > 1) { voteRef.current = { side: null, count: 0 }; setZone('multi'); return; }

        // capture.ts stores landmark points in raw (un-mirrored) video pixel coords — mirror the
        // x-coordinate here to match what the user actually sees on screen (WebcamMirror always
        // flips for display), so "which box is my hand in" matches their own eyes.
        const [rawX] = handCenter(frame.hands[0]);
        const mirroredFrac = 1 - rawX / frame.width;
        const side: 'left' | 'right' | null =
          mirroredFrac < ZONE_SPLIT ? 'left' : mirroredFrac > 1 - ZONE_SPLIT ? 'right' : null;

        setZone(side ?? 'neutral');

        if (!side) { voteRef.current = { side: null, count: 0 }; return; }
        const vote = voteRef.current;
        if (vote.side === side) vote.count += 1;
        else voteRef.current = { side, count: 1 };
        if (voteRef.current.count >= REQUIRED_VOTES) setDetected(side);
      }, POLL_MS);
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [detected, videoRef]);

  // Auto-confirm shortly after a side settles — see AUTO_CONFIRM_MS above. Cleared on unmount, so
  // tapping the manual "switch" option below (which itself calls onConfirm and moves the parent
  // on) can't also fire this and double-confirm.
  useEffect(() => {
    if (!detected) return;
    const t = setTimeout(() => onConfirm(detected), AUTO_CONFIRM_MS);
    return () => clearTimeout(t);
  }, [detected, onConfirm]);

  const other = (h: 'left' | 'right') => (h === 'left' ? 'right' : 'left');
  const cap = (h: string) => h.charAt(0).toUpperCase() + h.slice(1);

  const hint =
    zone === 'multi' ? 'Just one hand, please 🙌'
    : zone === 'none' ? 'Raise the hand you sign with'
    : zone === 'neutral' ? 'Move it into a box, left or right'
    : 'Hold it there…';

  return (
    <motion.div
      key="hand-check"
      className="flex-1 flex flex-col items-center justify-center max-w-sm w-full mx-auto text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="flex justify-center mb-3">
        <Zippy expression="teaching" size="md" />
      </div>
      <h2 className="text-2xl font-bold mb-1">Which hand do you sign with?</h2>
      <p className="text-z-gray-400 text-sm mb-5">
        {detected ? "Locking that in — tap below if it's wrong." : 'Place it in the matching box below.'}
      </p>

      <div className="mb-5 w-full">
        <WebcamMirror
          videoRef={videoRef}
          handZones={{ active: zone === 'left' || zone === 'right' ? zone : null, selected: detected }}
        />
        {!detected && <p className="text-xs text-z-gray-500 mt-2 h-4">{hint}</p>}
      </div>

      {detected && (
        <div className="flex flex-col gap-3 w-full">
          <motion.p
            className="flex items-center justify-center gap-1.5 text-z-green text-sm font-bold"
            initial={{ opacity: 0, y: -4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 320 }}
          >
            <span aria-hidden>✅</span> Got it — {cap(detected)}-handed!
          </motion.p>
          <button
            onClick={() => onConfirm(other(detected))}
            className="py-3 rounded-2xl font-bold text-sm border border-z-gray-400/30 text-z-gray-50"
          >
            No — I'm {cap(other(detected))}-handed
          </button>
        </div>
      )}

      <button onClick={onSkip} className="text-z-gray-400 text-sm mt-4 py-2 underline">
        Skip for now
      </button>
    </motion.div>
  );
}
