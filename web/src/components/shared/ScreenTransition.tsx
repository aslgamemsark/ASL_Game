import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface ScreenTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a top-level screen so AnimatePresence in App.tsx has a motion element
 * to animate in/out. AnimatePresence can only animate a direct child that is
 * itself a motion component — a plain page-root <div> gives it nothing to
 * animate, so every screen swap was an instant hard cut. This wrapper is the
 * single place that fixes that for all screens at once.
 */
export function ScreenTransition({ children, className }: ScreenTransitionProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}
