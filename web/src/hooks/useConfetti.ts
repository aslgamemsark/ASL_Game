import { useCallback } from 'react';
import confetti from 'canvas-confetti';

export function useConfetti() {
  const burst = useCallback(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#7C3AED', '#A78BFA', '#F97316', '#FDBA74', '#14B8A6', '#5EEAD4'],
      disableForReducedMotion: true,
    });
  }, []);

  const bigCelebration = useCallback((durationMs = 600) => {
    const end = Date.now() + durationMs;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#7C3AED', '#A78BFA', '#F97316'],
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FDBA74', '#14B8A6', '#5EEAD4'],
        disableForReducedMotion: true,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  return { burst, bigCelebration };
}
