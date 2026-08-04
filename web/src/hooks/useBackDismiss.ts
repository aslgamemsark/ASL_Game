import { useEffect, useRef } from 'react';

// Monotonic across the whole session, not per-instance — lets nested instances (e.g. a dialog
// opened on top of a non-home screen) tell "an entry deeper than mine was popped" apart from
// "my own entry was popped" without needing a single shared stack object threaded through props.
let depthCounter = 0;

// Tracks whichever depth is CURRENTLY the top of the browser's history stack, updated on every
// push and every observed popstate — see the mechanism note on the cleanup below for why a
// cleanup must check this before consuming its own entry rather than assuming it still can.
let topDepth = 0;

/**
 * Makes the hardware/browser Back button run `onBack` while `active` is true, instead of leaving
 * the screen entirely or exiting the app — which is what happens by default once a WebView/TWA's
 * history is empty. Nothing in this app ever called `history.pushState`, so Android's Back button
 * closed the app from any screen, mid-lesson included (2026-07-30 audit).
 *
 * Pushes exactly one history entry for the duration `active` is true, and consumes it again if
 * `active` turns false through some other path (a visible exit button, Escape) — otherwise the
 * real browser history depth would drift out of sync with app state after a few open/close
 * cycles, and a later genuine Back press would silently eat a stale entry and do nothing.
 *
 * Deliberately does not touch the URL — see docs/WORKLOG.md 2026-07-30 for why a full router is
 * out of scope here. Composes correctly when nested (a dialog's instance and its parent screen's
 * instance can both be active at once): each instance only reacts when the browser lands on an
 * entry shallower than the one it itself pushed, so popping the inner (dialog) entry never also
 * triggers the outer (screen) instance.
 *
 * CONSUMING ON CLEANUP IS NOT ALWAYS SAFE, AND THE CLEANUP BELOW GUARDS FOR IT — mechanism found
 * 2026-08-05: a dialog closed via a framer-motion exit animation does not unmount (so this hook's
 * cleanup does not run) until that animation finishes, hundreds of ms after the click that
 * triggered it (measured: 576ms for SignDetailModal's spring exit). If, in that window, ANOTHER
 * useBackDismiss instance activates and pushes its own entry — e.g. App's screen-level instance,
 * because the same click that closed the dialog also navigated the screen behind it — that
 * instance's entry ends up ON TOP of the dialog's by the time the dialog's cleanup finally runs.
 * A cleanup that unconditionally called `history.back()` at that point would pop the SCREEN's
 * fresh entry instead of its own, and the resulting popstate would fire the screen instance's
 * `onBack` (e.g. `goHome`) — silently reverting the navigation the user had just triggered. This
 * is exactly what broke "Try Yourself" on the Basic Signs / Alphabets detail modals: `onTryYourself`
 * closed the modal and navigated to Practice in the same click.
 *
 * The fix: only consume via `history.back()` if this instance's entry is STILL the current top of
 * the stack at the moment cleanup actually runs. If something else has pushed on top of it since,
 * skip the pop entirely — popping now would consume the wrong entry. The cost is the same
 * documented drift as the ordinary "active turned false without ever reaching cleanup in time"
 * case above (one entry that a later genuine Back press silently absorbs with no effect); the
 * alternative is the active bug this replaces.
 */
export function useBackDismiss(active: boolean, onBack: () => void) {
  const myDepthRef = useRef<number | null>(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    depthCounter += 1;
    myDepthRef.current = depthCounter;
    topDepth = myDepthRef.current;
    window.history.pushState({ __backDismissDepth: myDepthRef.current }, '');

    const onPopState = (e: PopStateEvent) => {
      const landedDepth = (e.state as { __backDismissDepth?: number } | null)?.__backDismissDepth ?? 0;
      topDepth = landedDepth;
      if (myDepthRef.current === null || landedDepth >= myDepthRef.current) return;
      myDepthRef.current = null;
      onBackRef.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (myDepthRef.current === null) return;
      const wasTop = topDepth === myDepthRef.current;
      myDepthRef.current = null;
      if (wasTop) window.history.back();
      // else: buried under a newer entry pushed while this instance was mid-exit-animation —
      // leave history alone; see the mechanism note above.
    };
  }, [active]);
}
