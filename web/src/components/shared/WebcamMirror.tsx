import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { TurnOverlay } from '@/components/shared/TurnOverlay';

// Standard MediaPipe 21-landmark hand topology (thumb, four fingers, palm base) — used to draw the
// bones between landmark dots for the live hand-tracking overlay.
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],          // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],          // index
  [5, 9], [9, 10], [10, 11], [11, 12],     // middle
  [9, 13], [13, 14], [14, 15], [15, 16],   // ring
  [13, 17], [17, 18], [18, 19], [19, 20],  // pinky
  [0, 17],                                  // palm base
];

/**
 * Draw both hands' landmark skeletons onto the (already video-painted) canvas. Points arrive in
 * video-pixel space; the visible feed is mirrored, so X is flipped here to match. Brand-purple
 * dots + bones instead of raw MediaPipe red, so it reads as part of QuickSign.
 */
function drawHandSkeleton(ctx: CanvasRenderingContext2D, canvasWidth: number, hands: { points: number[][] }[]) {
  const mirrorX = (x: number) => canvasWidth - x;
  const boneWidth = Math.max(2, canvasWidth * 0.006);
  const dotRadius = Math.max(3, canvasWidth * 0.008);
  for (const hand of hands) {
    const pts = hand.points;
    if (!pts || pts.length < 21) continue;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = boneWidth;
    ctx.strokeStyle = 'rgba(196,181,253,0.85)'; // z-purple-glow
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(mirrorX(pts[a][0]), pts[a][1]);
      ctx.lineTo(mirrorX(pts[b][0]), pts[b][1]);
      ctx.stroke();
    }
    ctx.fillStyle = '#A78BFA'; // z-purple-light
    ctx.shadowColor = 'rgba(167,139,250,0.9)';
    ctx.shadowBlur = dotRadius * 1.5;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(mirrorX(p[0]), p[1], dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Practice mode's small reference-clip overlay (top-right), shown while "show reference" is on. */
  overlayClipUrl?: string;
  /** Speed Challenge's just-passed state — green border + checkmark flash. Omit entirely (not
   *  `false`) on pages that never use this, e.g. Lesson/Practice/Story — passing `false` still
   *  reserves a transparent 2px border to avoid a layout shift the instant it flips to green,
   *  matching the original SpeedChallengePage behavior; those other pages never had a border at
   *  all, so they must not gain one now. */
  passed?: boolean;
  /** Caption chip, bottom-left (e.g. "You"). Omit for no label. */
  label?: string;
  /** Pre-resolved Tailwind classes for the caller's equipped shop border cosmetic (the caller
   *  resolves getShopItem(equippedBorder)?.preview — this component stays ignorant of shop.ts).
   *  Paints via ring/shadow utilities, a different layer than the `passed` border above, so both
   *  can be present at once with no precedence conflict. */
  cosmeticBorderClasses?: string;
  /** Multiplayer turn indicator: when true this is the active signer's feed — draws a colored
   *  outline (a third layer, distinct from the cosmetic ring and the `passed` border), an optional
   *  label chip, and a depleting turn timer bar. */
  activeTurn?: boolean;
  /** Label chip shown top-center while activeTurn (e.g. "YOUR TURN"). */
  turnLabel?: string;
  /** 0-100 remaining fraction of the turn timer; drives the depleting top bar when activeTurn. */
  timerPercent?: number;
  /** First-run camera-position guide: draws a face-target box + a coaching caption over the feed.
   *  Pass null/undefined to hide it. `ok` turns the box green and the caption into a success chip. */
  frameGuide?: { ok: boolean; message: string } | null;
  /** Onboarding's dominant-hand picker: draws a left/right box pair over the feed. `active` is
   *  true the instant the user's hand geometrically enters that side (turns the box green right
   *  away — no waiting on the confirmation dwell timer). `selected` is the confirmed side, once
   *  the dwell threshold is reached — same green box, plus a checkmark badge. Deliberately
   *  geometric (which half of the MIRRORED display the hand is in), not based on MediaPipe's
   *  handedness label, which flips depending on the camera/driver and was reported backwards on
   *  real hardware (2026-07-16) — see DominantHandStep.tsx for the full reasoning. */
  handZones?: { active: 'left' | 'right' | null; selected: 'left' | 'right' | null } | null;
  /** Live hand landmarks to draw as a skeleton overlay (from useRecognition's handsRef). A ref so
   *  the canvas loop reads the latest frame without re-rendering. */
  landmarksRef?: React.RefObject<{ points: number[][] }[] | null>;
  /** When true, draws the hand skeleton from `landmarksRef`. Used by the camera-position guide so
   *  the user can see both hands being tracked while framing, then it's off during signing. */
  showLandmarks?: boolean;
}

/**
 * Mirrors the raw webcam feed onto a canvas (flipped horizontally, matching how a mirror/most
 * video-call UIs present your own camera). Was copy-pasted near-identically into LessonPage,
 * PracticePage, StoryPage, and SpeedChallengePage (as `SpeedWebcam`) — the canvas-mirroring
 * logic itself was always identical; only the optional overlay/border varied per page
 * (production audit, 2026-07-12). The camera stream and recognition loop were already correctly
 * shared via hooks (useCamera/useRecognition) — only this rendering piece was duplicated.
 */
export function WebcamMirror({ videoRef, overlayClipUrl, passed, label, cosmeticBorderClasses, activeTurn, turnLabel, timerPercent, frameGuide, handZones, landmarksRef, showLandmarks }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  // The RAF loop below is long-lived; mirror the latest overlay props into refs so it always reads
  // current values without being torn down and recreated each render.
  const showLandmarksRef = useRef(showLandmarks);
  showLandmarksRef.current = showLandmarks;
  const landmarksSourceRef = useRef(landmarksRef);
  landmarksSourceRef.current = landmarksRef;

  useEffect(() => {
    const draw = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
          ctx.restore();
          const hands = landmarksSourceRef.current?.current;
          if (showLandmarksRef.current && hands && hands.length > 0) {
            drawHandSkeleton(ctx, canvas.width, hands);
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef]);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-z-surface aspect-video ${cosmeticBorderClasses ?? ''} ${
        activeTurn ? 'outline outline-2 outline-z-purple-light' : ''
      } ${
        passed === undefined ? '' : `border-2 transition-colors duration-200 ${passed ? 'border-z-green' : 'border-transparent'}`
      }`}
    >
      <canvas ref={canvasRef} className="w-full h-full object-cover" />
      {frameGuide && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center">
          {/* Face-target box in the upper-center — sized/positioned so the chest stays visible
              below it, matching how signs are framed. Green once the user is well positioned. */}
          <div
            className={`mt-[6%] rounded-[45%] border-2 border-dashed transition-colors duration-300 ${frameGuide.ok ? 'border-z-green' : 'border-white/85'}`}
            style={{ width: '42%', height: '58%', boxShadow: '0 0 0 9999px rgba(0,0,0,0.18)' }}
          />
          <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg whitespace-nowrap ${frameGuide.ok ? 'bg-z-green/90 text-white' : 'bg-black/75 text-white'}`}>
            {frameGuide.message}
          </div>
        </div>
      )}
      {handZones && (
        <div className="absolute inset-0 pointer-events-none flex">
          {(['left', 'right'] as const).map((side) => {
            const isSelected = handZones.selected === side;
            // Turns green the instant a hand geometrically enters this side — not gated on the
            // dwell timer that decides when to lock in the final answer, so the box responds to
            // the hand's actual position immediately instead of lagging behind it.
            const isOccupied = isSelected || handZones.active === side;
            const tone = isOccupied ? 'border-z-green bg-z-green/10 text-z-green' : 'border-white/35 text-white/60';
            return (
              <div key={side} className="flex-1 flex items-center justify-center p-[6%]">
                <div className={`relative w-full h-[72%] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors duration-100 ${tone}`}>
                  <span className="text-4xl leading-none" role="img" aria-hidden>✋</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    {side === 'left' ? 'Left hand' : 'Right hand'}
                  </span>
                  {isSelected && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-z-green text-white flex items-center justify-center text-xs shadow-lg">✓</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <TurnOverlay active={!!activeTurn} label={turnLabel} timerPercent={timerPercent} />
      {label && <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded-md">{label}</span>}
      {overlayClipUrl && (
        <div className="absolute top-2 right-2 w-28 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg bg-black">
          <video
            src={overlayClipUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      )}
      {passed && (
        <motion.div
          className="absolute inset-0 bg-z-green/20 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="text-5xl">✅</span>
        </motion.div>
      )}
    </div>
  );
}
