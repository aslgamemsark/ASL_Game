import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { TurnOverlay } from '@/components/shared/TurnOverlay';

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
}

/**
 * Mirrors the raw webcam feed onto a canvas (flipped horizontally, matching how a mirror/most
 * video-call UIs present your own camera). Was copy-pasted near-identically into LessonPage,
 * PracticePage, StoryPage, and SpeedChallengePage (as `SpeedWebcam`) — the canvas-mirroring
 * logic itself was always identical; only the optional overlay/border varied per page
 * (production audit, 2026-07-12). The camera stream and recognition loop were already correctly
 * shared via hooks (useCamera/useRecognition) — only this rendering piece was duplicated.
 */
export function WebcamMirror({ videoRef, overlayClipUrl, passed, label, cosmeticBorderClasses, activeTurn, turnLabel, timerPercent, frameGuide }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

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
