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
 *
 * `exit` switches to `position: absolute` (App.tsx's wrapping div is `relative`
 * for this): App.tsx's AnimatePresence isn't mode="wait", so the entering
 * screen mounts immediately alongside the exiting one rather than waiting for
 * it to finish — normal document flow would then stack the new screen BELOW
 * the old one (both are ordinary block-level divs) until the exit's 0.2s
 * elapses, which is exactly what "camera opens but I still see the Alphabet
 * screen" (2026-08-06) was: the new screen was there, just pushed under the
 * old one. Pulling the exiting screen out of flow the instant it starts
 * exiting lets the entering screen occupy the layout position immediately.
 */
export function ScreenTransition({ children, className }: ScreenTransitionProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, position: 'absolute', inset: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}
