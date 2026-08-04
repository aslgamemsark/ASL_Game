/**
 * Tracks whether a live camera session is in progress, so work that would interrupt one can wait
 * for it to finish.
 *
 * Exists because the service worker now updates without asking (vite.config.ts's
 * `registerType: 'autoUpdate'`), and vite-plugin-pwa's default behaviour when the new worker
 * activates is an immediate `window.location.reload()`. In a camera app that is not acceptable:
 * a reload mid-lesson tears down the MediaStream and discards the attempt the learner is part-way
 * through. `InstallPrompt` routes the reload through `runWhenCameraIdle` so an update lands at a
 * session boundary instead of on top of someone signing.
 *
 * Module-level rather than React state on purpose: the reload decision runs inside a
 * service-worker event handler with no component context, and the writer (useCamera) and the
 * reader (InstallPrompt, mounted as a sibling of <App/>) sit in different trees.
 */

let cameraLive = false;
let deferred: (() => void) | null = null;

/** Called by `useCamera` as a stream starts and stops. Safe to call with an unchanged value. */
export function setCameraLive(live: boolean): void {
  cameraLive = live;
  if (!live && deferred) {
    const run = deferred;
    deferred = null; // cleared before running so a re-entrant call can't double-fire it
    run();
  }
}

/**
 * Runs `fn` immediately when no camera session is active, otherwise once the current one ends.
 *
 * Only one callback is held at a time — a second call replaces the first, which is the behaviour
 * the single caller wants (a newer service-worker activation supersedes an older pending reload).
 */
export function runWhenCameraIdle(fn: () => void): void {
  if (!cameraLive) {
    fn();
    return;
  }
  deferred = fn;
}
