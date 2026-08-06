import { useCallback, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

export function useConfetti() {
  // Tracks the in-flight bigCelebration loop's rAF handle so it can be cancelled if the calling
  // component unmounts mid-burst (e.g. a lesson-complete screen exited early) instead of the loop
  // silently continuing to fire for up to durationMs after nothing on screen needs it anymore.
  const rafRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  const burst = useCallback(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#7C3AED', '#A78BFA', '#F97316', '#FDBA74', '#14B8A6', '#5EEAD4'],
      disableForReducedMotion: true,
    });
  }, []);

  // durationMs/particleCount let a rarer, bigger moment (e.g. the first lesson ever completed)
  // ask for a longer, denser burst than a routine lesson finish, without every caller having to
  // reimplement the frame loop.
  const bigCelebration = useCallback((durationMs = 600, particleCount = 3) => {
    const end = Date.now() + durationMs;
    const frame = () => {
      confetti({
        particleCount,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#7C3AED', '#A78BFA', '#F97316'],
        disableForReducedMotion: true,
      });
      confetti({
        particleCount,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FDBA74', '#14B8A6', '#5EEAD4'],
        disableForReducedMotion: true,
      });
      rafRef.current = Date.now() < end ? requestAnimationFrame(frame) : null;
    };
    frame();
  }, []);

  return { burst, bigCelebration };
}
