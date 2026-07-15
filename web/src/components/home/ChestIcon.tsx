import { useEffect, useRef } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';

interface ChestIconProps {
  /** Pixel size of the square icon. */
  size?: number;
  /** True once the cooldown has elapsed and the chest can be opened. */
  ready: boolean;
  /** 0..1 cooldown progress; ignored once `ready`. Drives the ring around the chest. */
  progress: number;
  /** True for the duration of the open flourish (shake -> lid pop -> golden flash). */
  opening: boolean;
  /** Fires once the open flourish has finished playing (or immediately, under reduced motion). */
  onOpenComplete?: () => void;
  className?: string;
}

const RING_RADIUS = 27;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * The chest graphic: a two-piece SVG (lid + body) so the lid can swing open on its own hinge,
 * plus a ring that fills as the cooldown counts down and a golden flash/ray burst on open. All
 * motion is imperative (useAnimationControls), gated on the *transition* into `ready`/`opening`
 * rather than the boolean itself — ChestCard's parent re-renders every second while the cooldown
 * ticks, and a declarative `animate` prop keyed off a still-true boolean would replay the
 * announcement bounce every second forever. `useReducedMotion` is checked explicitly (not left to
 * MotionConfig alone) because `onOpenComplete` gates a real UI transition — the reward reveal —
 * and a motion-sensitive user must reach it immediately, not after an unskippable flourish.
 */
export function ChestIcon({
  size = 48,
  ready,
  progress,
  opening,
  onOpenComplete,
  className,
}: ChestIconProps) {
  const reduceMotion = useReducedMotion();
  const bodyControls = useAnimationControls();
  const lidControls = useAnimationControls();
  const flashControls = useAnimationControls();
  const raysControls = useAnimationControls();
  const wasReady = useRef(ready);

  // Announce "ready" with a few bounded bounces, once, on the false->true edge — never a
  // standing loop (a chest can sit ready for hours; it shouldn't bounce the whole time).
  useEffect(() => {
    if (ready && !wasReady.current && !opening && !reduceMotion) {
      const bounce = { y: [0, -3, 0, -3, 0, -2, 0] };
      const transition = { duration: 1.1, ease: 'easeInOut' as const };
      void bodyControls.start({ ...bounce, transition });
      void lidControls.start({ ...bounce, transition });
    }
    wasReady.current = ready;
  }, [ready, opening, reduceMotion, bodyControls, lidControls]);

  // The open flourish: shake, then the lid pops on its hinge while a golden flash + rays burst
  // behind it. Sequenced imperatively so `onOpenComplete` fires exactly once, after the last
  // stage resolves — the caller (ChestCard) uses it to swap in the reward reveal.
  useEffect(() => {
    if (!opening) return;
    if (reduceMotion) {
      onOpenComplete?.();
      return;
    }
    let cancelled = false;
    (async () => {
      const shake = { rotate: [0, -4, 4, -4, 4, 0], transition: { duration: 0.26, ease: 'easeInOut' as const } };
      await Promise.all([bodyControls.start(shake), lidControls.start(shake)]);
      if (cancelled) return;
      await Promise.all([
        lidControls.start({ rotate: -38, y: -8, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }),
        bodyControls.start({ scale: [1, 1.06, 1], transition: { duration: 0.4, ease: 'easeOut' } }),
        flashControls.start({
          opacity: [0, 0.95, 0],
          scale: [0.2, 1.6, 2.4],
          transition: { duration: 0.55, ease: 'easeOut' },
        }),
        raysControls.start({
          opacity: [0, 1, 0],
          scale: [0.4, 1.3, 0.85],
          transition: { duration: 0.5, ease: 'easeOut' },
        }),
      ]);
      if (cancelled) return;
      onOpenComplete?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [opening, reduceMotion, bodyControls, lidControls, flashControls, raysControls, onOpenComplete]);

  const dashOffset = RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <div className={`relative shrink-0 ${className ?? ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} className="overflow-visible">
        <defs>
          <linearGradient id="chest-body-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-z-purple)" />
            <stop offset="100%" stopColor="var(--color-z-purple-deep)" />
          </linearGradient>
          <linearGradient id="chest-lid-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-z-purple-light)" />
            <stop offset="100%" stopColor="var(--color-z-purple)" />
          </linearGradient>
          <radialGradient id="chest-flash-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF7ED" />
            <stop offset="35%" stopColor="var(--color-z-orange-bright)" />
            <stop offset="100%" stopColor="var(--color-z-orange)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Cooldown ring — hidden once ready; the glow + bounce take over as the attention cue. */}
        {!ready && (
          <>
            <circle cx="32" cy="34" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
            <motion.circle
              cx="32"
              cy="34"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-z-orange)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              transform="rotate(-90 32 34)"
              initial={false}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </>
        )}

        {/* Golden flash + rays — mounted only during the open flourish. */}
        {opening && !reduceMotion && (
          <>
            <motion.circle
              cx="32"
              cy="34"
              r="20"
              fill="url(#chest-flash-fill)"
              initial={{ opacity: 0, scale: 0.2 }}
              animate={flashControls}
              style={{ transformOrigin: '32px 34px' }}
            />
            <motion.g initial={{ opacity: 0, scale: 0.4 }} animate={raysControls} style={{ transformOrigin: '32px 34px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <rect
                  key={i}
                  x="31"
                  y="8"
                  width="2"
                  height="9"
                  rx="1"
                  fill="var(--color-z-orange-bright)"
                  transform={`rotate(${i * 45} 32 34)`}
                />
              ))}
            </motion.g>
          </>
        )}

        {/* Body */}
        <motion.g animate={bodyControls} style={{ transformOrigin: '32px 46px' }}>
          <rect x="12" y="34" width="40" height="22" rx="5" fill="url(#chest-body-fill)" />
          <rect x="12" y="44" width="40" height="5" fill="var(--color-z-orange)" />
          <rect x="29" y="34" width="6" height="22" fill="var(--color-z-orange)" />
          <circle cx="32" cy="46.5" r="4" fill="var(--color-z-orange-bright)" stroke="var(--color-z-purple-deep)" strokeWidth="1.5" />
        </motion.g>

        {/* Lid — its own group, hinged at the back-top, so it can swing open independently. */}
        <motion.g animate={lidControls} style={{ transformOrigin: '32px 34px' }}>
          <path d="M12 34 Q12 16 32 16 Q52 16 52 34 Z" fill="url(#chest-lid-fill)" />
          <rect x="12" y="29" width="40" height="5" fill="var(--color-z-orange)" />
          <rect x="29" y="16" width="6" height="18" fill="var(--color-z-orange)" />
        </motion.g>
      </svg>

      {/* Static ready glow — a cue, not another standing animation loop. */}
      {ready && !opening && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: '0 0 14px 2px var(--color-z-orange-bright)', opacity: 0.35 }}
        />
      )}
    </div>
  );
}
