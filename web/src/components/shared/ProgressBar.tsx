import { motion, type Transition } from 'framer-motion';
import { EASE_STANDARD, DURATION_SLOW } from '@/motion/tokens';

const SIZE_CLASSES = {
  xs: 'h-1.5',
  sm: 'h-2',
  md: 'h-2.5',
  lg: 'h-3',
} as const;

const DEFAULT_TRANSITION: Transition = { duration: DURATION_SLOW, ease: EASE_STANDARD };

interface Props {
  /** Fraction filled, 0–1. Clamped, so a caller can pass a raw ratio (including a divide-by-zero
   *  NaN from an empty denominator) without guarding first. */
  value: number;
  /** Accessible name. Required, not optional: a progressbar with no name announces as a bare
   *  percentage with nothing to say what it measures, which is why all 12 hand-rolled bars this
   *  replaces were invisible to screen readers in practice even where they had visible labels. */
  label: string;
  size?: keyof typeof SIZE_CLASSES;
  /** Tailwind classes for the filled portion. Colour is caller-owned because it is genuinely
   *  semantic here — red for a failure rate, green for a claimed quest, white on a coloured card —
   *  not drift to be consolidated into variants. */
  fillClassName?: string;
  /** Tailwind classes for the unfilled track. */
  trackClassName?: string;
  /** Overrides the entrance sweep. Pass a short duration for a bar that re-targets continuously
   *  (a countdown timer) rather than animating once on mount. */
  transition?: Transition;
  /** Layout/position only — the bar's place in its row is the caller's concern. */
  className?: string;
}

/** Exported for direct unit test — the NaN branch has a non-obvious failure mode (`scaleX: NaN`
 *  renders the bar *invisible*, not empty) and this project has no component-rendering stack to
 *  reach it through `ProgressBar` itself. */
export function clampProgress(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * A labelled progress bar.
 *
 * Replaces 12 hand-rolled bars (design-system audit, 2026-07-31) that between them used 4 heights,
 * 5 track colours, **zero** `role="progressbar"`, and animated `width` in 8 of 12 cases.
 *
 * Two things it fixes that a caller cannot get wrong once it exists: the bar reports itself to
 * assistive tech, and the fill animates on `transform` rather than `width`. `width` is a layout
 * property — animating it reflows the bar, its siblings, and its flex parent on *every frame* of
 * the transition (~48 reflows for a 0.8s entrance, and far worse for a bar that re-targets while
 * a lesson is running). `scaleX` on a fixed-width track is composite-only and visually identical.
 */
export function ProgressBar({
  value,
  label,
  size = 'sm',
  fillClassName = 'bg-gradient-primary',
  trackClassName = 'bg-z-surface',
  transition = DEFAULT_TRANSITION,
  className = '',
}: Props) {
  const clamped = clampProgress(value);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`${SIZE_CLASSES[size]} ${trackClassName} rounded-full overflow-hidden ${className}`}
    >
      <motion.div
        className={`h-full w-full rounded-full origin-left ${fillClassName}`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: clamped }}
        transition={transition}
      />
    </div>
  );
}
