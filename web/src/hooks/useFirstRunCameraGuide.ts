import { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'signup-camera-guide-seen';
// How long the user must stay well-framed before we consider the guide "done" and dismiss it.
const HOLD_MS = 1200;
// Hard ceiling on how long the guide can nag, regardless of whether good framing is ever reached.
// Dismissing on framing alone made the guide's lifetime depend entirely on the framing rule being
// achievable: under the pre-2026-07-27 thresholds only 18.9% of frames from SUCCESSFUL sign
// attempts qualified, so a first-timer could be told their framing was wrong for an entire lesson
// while signing perfectly well. The thresholds are fixed, but the guide should not be able to
// outlive its usefulness again if they ever drift.
const MAX_VISIBLE_MS = 20_000;

/**
 * Shows the camera-position guide only on the user's first camera-signing session, and
 * auto-dismisses it once they've held a good frame for HOLD_MS. Returns whether the guide should
 * currently be shown; pass the live `framing.ok` from useRecognition.
 *
 * Gated by a localStorage flag (mirrors the existing `signup-camera-onboarded` privacy primer),
 * so it never nags on later visits. Wrapped in try/catch so a storage-blocked context just means
 * "don't show it" rather than throwing.
 */
export function useFirstRunCameraGuide(framingOk: boolean | undefined): boolean {
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem(SEEN_KEY) !== 'true'; } catch { return false; }
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safety dismiss: runs independently of framing so the guide always has a finite lifetime.
  useEffect(() => {
    if (!show) return;
    const ceiling = setTimeout(() => {
      try { localStorage.setItem(SEEN_KEY, 'true'); } catch { /* storage blocked */ }
      setShow(false);
    }, MAX_VISIBLE_MS);
    return () => clearTimeout(ceiling);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    if (framingOk) {
      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          try { localStorage.setItem(SEEN_KEY, 'true'); } catch { /* storage blocked */ }
          setShow(false);
        }, HOLD_MS);
      }
    } else if (timerRef.current) {
      // Fell out of a good frame before the hold completed — restart the timer next time it's good.
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [show, framingOk]);

  return show;
}
