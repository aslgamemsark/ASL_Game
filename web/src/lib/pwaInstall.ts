import { track } from '@/analytics';

// The browser fires `beforeinstallprompt` (Chrome/Edge/Android) once, as early as first paint —
// well before React mounts in some cases. A module-level listener attached at import time is the
// only way to reliably capture it; a listener registered inside a component can miss the event
// entirely if it fires before that component's effect runs. Consumers (the banner, the Settings
// row) read this module's state via `subscribe`/`getSnapshot`, so the captured event survives
// regardless of which components are mounted when it arrives — unlike the previous design, where
// the event lived in `InstallPrompt`'s local state and vanished on dismiss.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const FIRST_SEEN_KEY = 'quicksign-first-seen';

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

// useSyncExternalStore (InstallPrompt.tsx, SettingsPage.tsx) requires getSnapshot() to return a
// referentially STABLE value when nothing has changed — it compares with Object.is, not deep
// equality. A getSnapshot that builds a fresh object literal on every call looks like "changed
// every render" to React, which re-subscribes every render, which calls getSnapshot again,
// forever — an infinite update loop (React error #185), caught by an actual e2e run against every
// screen behind ErrorBoundary rather than by any unit test. Caching the snapshot and only
// replacing the reference when the underlying state actually changes (i.e. inside notify()) fixes
// it structurally, the same way any useSyncExternalStore-backed store must.
let snapshot = computeSnapshot();

function computeSnapshot(): { canInstall: boolean; isIosHint: boolean; installed: boolean } {
  return {
    canInstall: !isStandalone() && !installed && deferred !== null,
    isIosHint: !isStandalone() && !installed && isIos(),
    installed: installed || isStandalone(),
  };
}

function notify(): void {
  snapshot = computeSnapshot();
  for (const fn of listeners) fn();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  // Absent from the app until now — without it, installing via the OS's own install UI (rather
  // than our button) left `deferred` stale and nothing recorded that the install happened.
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export function isStandalone(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari exposes this non-standard flag when launched from the home screen.
      (window.navigator as unknown as { standalone?: boolean }).standalone === true)
  );
}

export function isIos(): boolean {
  return typeof window !== 'undefined' && /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/** True once this browser has been seen before (i.e. not the current session's first load).
 *  Used to gate the open-app install banner to returning visitors — see InstallPrompt.tsx. */
export function isReturningVisitor(): boolean {
  try {
    const seen = localStorage.getItem(FIRST_SEEN_KEY) === '1';
    if (!seen) localStorage.setItem(FIRST_SEEN_KEY, '1');
    return seen;
  } catch {
    return false; // storage blocked — treat as first-run rather than risk showing the banner over onboarding
  }
}

export function canInstall(): boolean {
  return snapshot.canInstall;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSnapshot(): { canInstall: boolean; isIosHint: boolean; installed: boolean } {
  return snapshot;
}

/**
 * Triggers the native install prompt. No-ops (returns 'unavailable') if the browser never fired
 * `beforeinstallprompt` — always true on iOS Safari, and true elsewhere until the browser decides
 * the app is installable. Unlike the previous implementation, does NOT discard `deferred` on a
 * 'dismissed' outcome, so the same captured event can be re-offered from Settings later.
 */
export async function promptInstall(source: 'banner' | 'settings'): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  track('pwa_install_prompted', { source });
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  track('pwa_install_result', { source, outcome });
  if (outcome === 'accepted') {
    deferred = null;
  }
  notify();
  return outcome;
}
