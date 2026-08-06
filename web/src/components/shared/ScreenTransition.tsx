import { motion } from 'framer-motion';
import { Suspense, type ReactNode } from 'react';
import { LoadingScreen } from '@/components/shared/LoadingScreen';

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
 *
 * The Suspense boundary belongs HERE, per screen, and must not be hoisted back
 * up around App.tsx's AnimatePresence. Every screen is a `React.lazy` chunk, so
 * entering one suspends; a boundary ABOVE AnimatePresence hides its whole
 * subtree while that chunk downloads — including the outgoing screen, mid-exit.
 * A hidden element gets no frames, so the exit animation never completes,
 * AnimatePresence never unmounts the outgoing screen, and it stays on top at
 * opacity 1 forever with the new screen stranded in flow beneath it. That is
 * the version of the bug the `position: absolute` fix above did NOT solve:
 * measured 2026-08-07, the outgoing Home was still `position: static, opacity 1`
 * 2.5s after the swap, because its exit had never started. Scoping the boundary
 * to the entering screen leaves the outgoing sibling visible and animating.
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
      <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
    </motion.div>
  );
}
