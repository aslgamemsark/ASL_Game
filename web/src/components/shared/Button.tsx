import { motion, type HTMLMotionProps } from 'framer-motion';
import { TAP_SCALE_DEFAULT, HOVER_SCALE_DEFAULT } from '@/motion/tokens';

const SIZE_CLASSES = {
  sm: 'px-6 py-2.5 text-sm',
  md: 'px-8 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
} as const;

interface Props extends Omit<HTMLMotionProps<'button'>, 'className'> {
  size?: keyof typeof SIZE_CLASSES;
  /** Spans the width of its container. Most primary CTAs do; a handful (e.g. a dialog's inline
   *  "Continue" next to other content) stay their natural width. */
  fullWidth?: boolean;
  /** Extra classes, appended after the built-in ones so a caller can still override where it
   *  genuinely needs to (e.g. `mt-4` for its position in a stack) without fighting specificity. */
  className?: string;
}

/**
 * The app's primary call-to-action button — the gradient, radius, weight, and disabled treatment
 * every "Continue"/"Get Started"/"Try Yourself" button already shared by convention, but had to
 * hand-roll every time. 22 call sites (design-system audit, 2026-07-31) agreed on the visual
 * language and disagreed on everything else: five different paddings, four different text sizes
 * (nine more left unset, inheriting whatever size happened to be ambient), and disabled styling
 * present at only 3 of the 22. `min-h-11` guarantees the WCAG/Apple HIG 44px touch-target floor
 * regardless of size — `sm`'s padding alone doesn't reach it.
 *
 * Only the primary gradient variant exists here; a `variant` prop gets added the day a second one
 * actually ships, not speculatively ahead of that.
 */
export function Button({ size = 'md', fullWidth = false, className = '', children, ...rest }: Props) {
  return (
    <motion.button
      whileHover={{ scale: HOVER_SCALE_DEFAULT }}
      whileTap={{ scale: TAP_SCALE_DEFAULT }}
      className={`${fullWidth ? 'w-full' : ''} min-h-11 rounded-2xl font-bold text-white bg-gradient-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
