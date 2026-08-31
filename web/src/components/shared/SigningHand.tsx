import { useRef } from 'react';
import { motion, useAnimationFrame, useReducedMotion } from 'framer-motion';
import {
  furCapsule, PALM_FUR, SKELETON, LOOP_MS, poseAt,
  digitTransform, bendTransform, wristTransform,
} from '@/components/shared/signingHandPose';

/**
 * Zippy's furry purple hand, signing 🤟 → 👋 → ✌️ → 🤟 on a loop.
 *
 * WHY THIS IS A SKELETON, NOT A SET OF PICTURES
 * The hand has to genuinely MOVE between signs rather than crossfade between static poses. So this
 * is not three SVGs swapped on a timer, and not path morphing (which needs matched vertex counts
 * and produces liquid, boneless in-betweens). It is an articulated hand: a palm plus five fingers,
 * each with a proximal and a distal segment rotating around their real joints (MCP at the knuckle,
 * PIP mid-finger). A "pose" is therefore just a set of joint angles, and moving between two poses
 * is ordinary angle interpolation — every in-between frame is a physically coherent hand position,
 * because it is the same skeleton at a different articulation. That is what makes the transitions
 * read as one continuous hand instead of a dissolve.
 *
 * WHY THE TRANSFORMS ARE WRITTEN BY HAND INSTEAD OF ANIMATED AS CSS
 * An earlier pass drove each joint with framer-motion's `rotate`/`scaleY` and hit two problems
 * that were only visible by measuring the live DOM, not by reading the code:
 *   1. framer-motion owns `transform-origin` on anything whose transform it animates, so a
 *      `transformOrigin` passed via `style` is silently dropped. Every joint measured as
 *      `60px 76px` — the viewBox centre — so every finger pivoted about the middle of the hand
 *      rather than its own knuckle.
 *   2. SVG's `transform-box: view-box` resolves `transform-origin` against the viewBox rectangle
 *      *as expressed in that element's own local space*, so once a joint sits under a parent
 *      translate (or worse, a parent scale) the origin no longer lands where the arithmetic says.
 *      Curled fingers visibly detached from the palm.
 * SVG's own `rotate(angle, cx, cy)` has none of that ambiguity: the pivot is stated outright, in
 * the element's own coordinates. So a single rAF loop interpolates the pose and writes `transform`
 * attributes directly. It is also less work per frame than the CSS path — a handful of attribute
 * writes, no style recalculation for five separate animating elements.
 */

// ── Palette ────────────────────────────────────────────────────────────────────────────────────
// Sampled from Zippy's own art (public/zippy/*.webp) rather than the CSS purple tokens: those are
// tuned for text contrast on the app background, while these have to read as the same fur as the
// character standing next to them. Literal values, not theme tokens — Zippy's fur is the same
// purple in both themes, exactly as the character art is.
const FUR_LIGHT = '#A277D6';
const FUR_MID = '#8055B8';
const FUR_DARK = '#5B3789';
const FUR_DEEP = '#452A6B';
const PAD = '#C9AEE4';

interface Props {
  /** Rendered pixel size of the (square) hand. */
  size?: number;
  className?: string;
}

export function SigningHand({ size = 132, className = '' }: Props) {
  // Same hook Zippy.tsx uses, so reduced-motion behaviour is consistent across the mascot and this.
  const reduce = useReducedMotion() ?? false;
  const wristRef = useRef<SVGGElement | null>(null);
  const proxRefs = useRef<Record<string, SVGGElement | null>>({});
  const distRefs = useRef<Record<string, SVGGElement | null>>({});

  // Rendered attributes come from poseAt(0) so the very first paint is already a correct 🤟 —
  // there is no frame where the hand is in its unarticulated rest pose.
  const initial = poseAt(0);

  useAnimationFrame((t) => {
    if (reduce) return;
    const f = poseAt((t % LOOP_MS) / LOOP_MS);
    wristRef.current?.setAttribute('transform', wristTransform(f));
    for (const d of SKELETON) {
      proxRefs.current[d.id]?.setAttribute('transform', digitTransform(d, f.digits[d.id]));
      distRefs.current[d.id]?.setAttribute('transform', bendTransform(d, f.digits[d.id]));
    }
  });

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* Brand glow. A blurred radial-gradient element rather than an SVG filter on the hand: it
          composites on the GPU and never re-rasterises when a joint moves, where a filter over the
          animated group would re-run every frame. Electric blue is the QuickSign accent already
          defined in index.css's `qs-border-electric` (rgba(34,211,238,…)) — kept low-opacity and
          behind the hand so purple stays dominant. */}
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 46%, rgba(34,211,238,0.34) 0%, rgba(34,211,238,0.15) 38%, rgba(34,211,238,0) 70%)',
          filter: 'blur(6px)',
        }}
        initial={false}
        animate={reduce ? { opacity: 0.55 } : { opacity: [0.42, 0.78, 0.42], scale: [0.94, 1.04, 0.94] }}
        transition={reduce ? undefined : { duration: LOOP_MS / 2000, ease: 'easeInOut', repeat: Infinity }}
      />

      <svg
        viewBox="0 0 120 152"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        className="relative"
        // A soft cyan rim, so the glow reads as light falling ON the fur rather than just a disc
        // sitting behind it.
        style={{ filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.42)) drop-shadow(0 2px 5px rgba(0,0,0,0.35))' }}
      >
        <defs>
          <linearGradient id="qs-fur-digit" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={FUR_LIGHT} />
            <stop offset="55%" stopColor={FUR_MID} />
            <stop offset="100%" stopColor={FUR_DARK} />
          </linearGradient>
          <linearGradient id="qs-fur-palm" x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor={FUR_LIGHT} />
            <stop offset="48%" stopColor={FUR_MID} />
            <stop offset="100%" stopColor={FUR_DARK} />
          </linearGradient>
          <linearGradient id="qs-fur-arm" x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0%" stopColor={FUR_MID} />
            <stop offset="100%" stopColor={FUR_DEEP} />
          </linearGradient>
        </defs>

        {/* Whole hand: gentle bob plus the wrist swing that drives the wave. Pivoting at the wrist
            (60, 130) rather than the hand's centre is what makes the wave read as a wave. */}
        {/* Forearm sits OUTSIDE the wrist group on purpose: a wave rotates the hand ON a steady
            forearm. Inside the group it swung along with the hand, which read as the whole arm
            rocking rather than a wrist waving. */}
        <path d="M 48 116 Q 44.5 132 46 152 L 74 152 Q 75.5 132 72 116 Z" fill="url(#qs-fur-arm)" />

        <g ref={wristRef} data-wrist transform={wristTransform(initial)}>
          {/* Fur wisps peeking out from behind the palm outline. */}
          <path d={PALM_FUR} fill={FUR_MID} />

          {/* Palm. Same bumped-silhouette language as the digits — alternating outward arcs, so
              the outline breaks into fur clumps instead of reading as one smooth blob. */}
          <path
            d="M 34.5 97
               Q 31 90 33 82.5
               Q 31 75 36.5 72.5
               Q 36.5 65.5 42.5 64.5
               Q 47 60 52.5 62.5
               Q 58.5 59 63.5 62.5
               Q 70.5 59.8 76.5 65
               Q 83.5 64.8 85.5 72
               Q 90.5 75.5 89 82.5
               Q 92 91.5 88.5 100
               Q 89.5 110 83.5 115.5
               Q 81.5 122.5 74 123.5
               Q 67 127.5 59.5 124.5
               Q 51 127 45 121.5
               Q 38.5 118.5 37.5 110.5
               Q 32.5 105 34.5 97 Z"
            fill="url(#qs-fur-palm)"
          />
          {/* Palm pad — pale lavender, like Zippy's own paw pads. Low opacity on purpose: it gives
              the palm a front-facing centre, it should not read as a separate light shape. */}
          <ellipse cx="61" cy="100" rx="14.5" ry="12.5" fill={PAD} opacity="0.2" />
          {/* Soft darker band under the finger row, so extended fingers look rooted in the palm
              rather than laid on top of it. */}
          <path d="M 39 76 Q 60 67 87 79 Q 62 74.5 39 76 Z" fill={FUR_DEEP} opacity="0.22" />

          {/* Thumb is rendered LAST so that in ✌️, where it folds across the palm, it paints over
              it — but it is listed first here so the four fingers stay in anatomical order above. */}
          {SKELETON.map((d) => (
            <g
              key={d.id}
              data-digit={d.id}
              ref={(el) => {
                proxRefs.current[d.id] = el;
              }}
              transform={digitTransform(d, initial.digits[d.id])}
            >
              <path d={furCapsule(d.w, d.prox, d.w * 0.55, d.phase)} fill="url(#qs-fur-digit)" transform={`translate(${d.x} ${d.y})`} />
              <g
                ref={(el) => {
                  distRefs.current[d.id] = el;
                }}
                transform={bendTransform(d, initial.digits[d.id])}
              >
                <g transform={`translate(${d.x} ${d.y - d.prox})`}>
                  <path d={furCapsule(d.w * 0.92, d.dist, d.w * 0.5, d.phase + 0.9)} fill="url(#qs-fur-digit)" />
                  {/* Paw pad on the tip — Zippy's own paws have these pale lavender pads. */}
                  <ellipse cx={0} cy={-d.dist + d.w * 0.34} rx={d.w * 0.28} ry={d.w * 0.22} fill={PAD} opacity={0.85} />
                </g>
              </g>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
