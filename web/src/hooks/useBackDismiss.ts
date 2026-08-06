import { useEffect, useRef } from 'react';

// Monotonic across the whole session, not per-instance — lets nested instances (e.g. a dialog
// opened on top of a non-home screen) tell "an entry deeper than mine was popped" apart from
// "my own entry was popped" without needing a single shared stack object threaded through props.
let depthCounter = 0;

// How many pops the hook itself has queued via the cleanup below and not yet seen arrive.
//
// `history.back()` is asynchronous: the popstate it causes lands a task later, by which time a
// DIFFERENT instance may have mounted and pushed a deeper entry. That instance then sees a pop to
// an entry shallower than its own and reads it as a user Back press — which is an order violation,
// not a Back press. It broke every "close this dialog AND change screen" click in one React commit
// ("Try Yourself" on Alphabet and Basic Signs: the new screen mounted, the camera came on, then the
// stale pop dismissed it — reported 2026-08-06). Depth alone cannot distinguish the two cases,
// because the offending pop carries a perfectly valid shallower depth.
let selfQueuedPops = 0;

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
 */
export function useBackDismiss(active: boolean, onBack: () => void) {
  const myDepthRef = useRef<number | null>(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    depthCounter += 1;
    myDepthRef.current = depthCounter;
    window.history.pushState({ __backDismissDepth: myDepthRef.current }, '');

    const onPopState = (e: PopStateEvent) => {
      // Bookkeeping we caused ourselves, not the user navigating — see selfQueuedPops above.
      // Claimed before the depth check so it is consumed exactly once no matter how many
      // instances are listening.
      if (selfQueuedPops > 0) {
        selfQueuedPops -= 1;
        return;
      }
      const landedDepth = (e.state as { __backDismissDepth?: number } | null)?.__backDismissDepth ?? 0;
      if (myDepthRef.current === null || landedDepth >= myDepthRef.current) return;
      myDepthRef.current = null;
      onBackRef.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (myDepthRef.current !== null) {
        myDepthRef.current = null;
        selfQueuedPops += 1;
        window.history.back();
      }
    };
  }, [active]);
}
