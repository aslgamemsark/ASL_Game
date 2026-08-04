import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { TurnOverlay } from '@/components/shared/TurnOverlay';
import { ClipEnlarge } from '@/components/lesson/ClipEnlarge';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Practice mode's small reference-clip overlay (top-right), shown while "show reference" is on. */
  overlayClipUrl?: string;
  /** Sign name for the overlay clip's enlarged caption — required whenever overlayClipUrl is set. */
  overlaySignName?: string;
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
  /** The dominant-hand picker's (DominantHandCheck.tsx) left/right box pair, drawn over the feed.
   *  `active` is true the instant the user's hand geometrically enters that side (turns the box
   *  green right away — no waiting on the confirmation dwell timer). `selected` is the confirmed
   *  side, once the dwell threshold is reached — same green box, plus a checkmark badge.
   *  Deliberately geometric (which half of the MIRRORED display the hand is in), not based on
   *  MediaPipe's handedness label, which flips depending on the camera/driver and was reported
   *  backwards on real hardware (2026-07-16) — see DominantHandCheck.tsx for the full reasoning. */
  handZones?: { active: 'left' | 'right' | null; selected: 'left' | 'right' | null } | null;
  /** Override the box shape at some breakpoints (e.g. to fill a taller row alongside other panels
   *  in the desktop three-column signing layout). Defaults to `--cam-ar`, the stream's own shape.
   *
   *  Must be expressed as a class, not an inline style: an inline `aspect-ratio` would out-specify
   *  every responsive variant here, so a caller wanting a DIFFERENT shape only on desktop has to
   *  be able to leave the mobile box alone. Keep `aspect-[var(--cam-ar)]` as the unprefixed base
   *  so every breakpoint you do not name still tracks the real stream. */
  aspectClassName?: string;
}

/**
 * Mirrors the raw webcam feed onto a canvas (flipped horizontally, matching how a mirror/most
 * video-call UIs present your own camera). Was copy-pasted near-identically into LessonPage,
 * PracticePage, StoryPage, and SpeedChallengePage (as `SpeedWebcam`) — the canvas-mirroring
 * logic itself was always identical; only the optional overlay/border varied per page
 * (production audit, 2026-07-12). The camera stream and recognition loop were already correctly
 * shared via hooks (useCamera/useRecognition) — only this rendering piece was duplicated.
 */
// memo: every caller passes stable references (videoRef from useCamera, frameGuide either the
// recognition hook's own `framing` state or `null` — never a fresh literal) — see 2026-07-30
// audit note on ParameterChecklist for why this matters (zero React.memo anywhere previously).
export const WebcamMirror = memo(function WebcamMirror({ videoRef, overlayClipUrl, overlaySignName, passed, label, cosmeticBorderClasses, activeTurn, turnLabel, timerPercent, frameGuide, handZones, aspectClassName = 'aspect-[var(--cam-ar)]' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [overlayEnlarged, setOverlayEnlarged] = useState(false);
  // The container previously forced a hardcoded 16:9 box (`aspect-video`) regardless of the
  // stream's real shape. A phone held in portrait commonly delivers a portrait stream (e.g.
  // 480x640), which `object-cover` into a 16:9 box then crops top-and-bottom — exactly where the
  // signer's face and chest are, silently invalidating the frameGuide/handZones percentages below
  // (found in mobile audit, 2026-07-28). Deriving the box from the stream's actual dimensions
  // (already read every frame for the canvas draw below) means nothing is ever cropped, so those
  // percentages stay valid on any orientation. Falls back to 16:9 only before the first frame
  // lands, matching the previous default.
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const lastAspectRef = useRef<number | null>(null);

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
        if (video.videoWidth && video.videoHeight) {
          const ratio = video.videoWidth / video.videoHeight;
          if (lastAspectRef.current !== ratio) {
            lastAspectRef.current = ratio;
            setAspectRatio(ratio);
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
      style={{ '--cam-ar': String(aspectRatio ?? 16 / 9) } as CSSProperties}
      className={`relative rounded-2xl overflow-hidden bg-z-surface ${aspectClassName} ${cosmeticBorderClasses ?? ''} ${
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
          {/* Both states sit on the same plate. The success state used to be `bg-z-green/90` with
              white text — white on a light green, 1.82:1, i.e. the one message confirming the
              learner is finally framed correctly was the least readable thing on screen. Over
              video the state has to be carried by something other than the text colour, so it is
              the face-box border (green above) plus the ✓ here. */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg whitespace-nowrap bg-video-plate text-white">
            {frameGuide.ok ? `✓ ${frameGuide.message}` : frameGuide.message}
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
            // Occupancy is carried by the BOX (border + fill tint), never by the label's colour.
            // The label used to be `text-white/60` unplated over live video — 1.00:1 against a
            // bright frame, literally invisible — and `text-z-green` when occupied, 1.79:1. An
            // accent token cannot work here: it inverts with the theme and the video does not.
            const box = isOccupied ? 'border-z-green bg-z-green/10' : 'border-white/35';
            return (
              <div key={side} className="flex-1 flex items-center justify-center p-[6%]">
                <div className={`relative w-full h-[72%] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors duration-100 ${box}`}>
                  <span className="text-4xl leading-none" role="img" aria-hidden>✋</span>
                  <span className="text-3xs font-bold uppercase tracking-wide bg-video-plate text-white px-2 py-1 rounded-full">
                    {side === 'left' ? 'Left hand' : 'Right hand'}
                  </span>
                  {isSelected && (
                    // text-z-bg, not text-white: z-bg and z-green invert in OPPOSITE directions
                    // between themes (light ink on a light-green fill in dark mode, dark ink on a
                    // dark-green fill in light mode), so the pair stays high-contrast in both —
                    // 10.12:1 and 4.55:1. `bg-z-green text-white` was 1.92:1 in the dark theme.
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-z-green text-z-bg flex items-center justify-center text-xs font-bold shadow-lg">✓</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <TurnOverlay active={!!activeTurn} label={turnLabel} timerPercent={timerPercent} />
      {label && <span className="absolute bottom-1.5 left-1.5 text-3xs font-semibold bg-video-plate text-white px-1.5 py-0.5 rounded-md">{label}</span>}
      {overlayClipUrl && (
        <>
          <button
            type="button"
            onClick={() => setOverlayEnlarged(true)}
            aria-label="Enlarge reference clip"
            className="absolute top-2 right-2 w-28 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg bg-black cursor-zoom-in"
          >
            <video
              src={overlayClipUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain"
            />
          </button>
          <ClipEnlarge
            clipUrl={overlayClipUrl}
            signName={overlaySignName ?? ''}
            open={overlayEnlarged}
            onClose={() => setOverlayEnlarged(false)}
          />
        </>
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
});
