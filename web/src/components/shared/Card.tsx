import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

const PADDING_CLASSES = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const;

interface Props {
  children: ReactNode;
  padding?: keyof typeof PADDING_CLASSES;
  /** Stagger delay (seconds) for the entrance fade — the same `delay: i * N` pattern every list of
   *  cards already hand-writes. */
  delay?: number;
  className?: string;
}

/**
 * The app's standard content card: `bg-z-card`, a hairline border, `rounded-2xl`, and a fade-up
 * entrance. ~30 call sites (design-system audit, 2026-07-31) already agree on this exact shell —
 * unlike Button/ProgressBar, this one wasn't drifting, so it's offered here for new call sites to
 * reach for rather than retyping the same four classes, not migrated wholesale: there is no bug or
 * accessibility gap in the 30 existing sites to justify the size of that diff.
 */
export function Card({ children, padding = 'md', delay = 0, className = '' }: Props) {
  return (
    <motion.div
      className={`bg-z-card border border-white/5 rounded-2xl ${PADDING_CLASSES[padding]} ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}
