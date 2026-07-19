import { useEffect, useRef, useState } from 'react';

// Per-SESSION (sessionStorage, not localStorage): the guide shows once each time the user opens
// the app, and re-appears when they close the tab and reopen — even immediately — because
// sessionStorage is cleared on tab close. Within one session it dismisses after a good frame and
// doesn't nag again as they move between lessons. This is deliberately NOT a once-ever flag: a
// user who sits differently on a new visit (the "too close, signs won't work" report) gets the
// positioning check again every session.
const SEEN_KEY = 'quicksign-camera-guide-seen-session';
// How long the user must stay well-framed before we consider the guide "done" and dismiss it.
const HOLD_MS = 1200;

/**
 * Camera-position guide shown once per browser session until the user holds a good frame for
 * HOLD_MS. Returns whether the guide should currently be shown; pass the live `framing.ok` from
 * useRecognition. Wrapped in try/catch so a storage-blocked context just means "don't persist the
 * dismissal" rather than throwing.
 */
export function useCameraFramingGuide(framingOk: boolean | undefined): boolean {
  const [show, setShow] = useState(() => {
    try { return sessionStorage.getItem(SEEN_KEY) !== 'true'; } catch { return false; }
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!show) return;
    if (framingOk) {
      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          try { sessionStorage.setItem(SEEN_KEY, 'true'); } catch { /* storage blocked */ }
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
