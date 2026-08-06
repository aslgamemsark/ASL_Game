// Minimal, dependency-free error reporting. No crash-monitoring SDK (e.g. Sentry) is wired up —
// that requires creating a third-party account, which isn't something to do unilaterally; this
// module is the single integration point so wiring one in later is a few lines, not a hunt across
// the codebase for every place an error could originate (production audit, 2026-07-12).
//
// PostHog crash events (fatal_error / session_crashed) ARE wired here (2026-07-20) — same
// single-integration-point reasoning as the Sentry note below, and it's the analytics module's
// only sanctioned entry point for these two event names (see analytics/capture.ts).
//
// To add Sentry once you have a DSN:
//   1. npm install @sentry/react
//   2. Sentry.init({ dsn: '...' }) once, near the top of main.tsx
//   3. In reportError() below, add `Sentry.captureException(error, { extra: context });`
//      alongside the existing console.error — everything already routes through here.
import { track } from '@/analytics';

export interface ErrorContext {
  source: 'error-boundary' | 'window-error' | 'unhandled-rejection';
  componentStack?: string;
}

// Survives a reload (sessionStorage persists across reloads in the same tab, clears on tab close)
// so checkUnexpectedReload() below can tell "the last thing that happened before this fresh load
// was an uncaught error" from an ordinary navigation.
const LAST_ERROR_AT_KEY = 'quicksign_last_error_at';

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Which known, self-healing failure this is, if any — attached to `fatal_error`/`session_crashed`
 * as `error_class` so PostHog queries can filter on this directly instead of ILIKE-matching raw
 * messages (found useful 2026-08-06 while investigating "Try Yourself does nothing": both classes
 * below were hiding in `message` text, indistinguishable from one-off errors without reading each
 * row by hand).
 *
 * - 'chunk-load-failure': a tab left open across a deploy still references a JS chunk filename
 *   the CDN no longer serves once the newer build's differently-hashed file replaces it. A plain
 *   reload self-heals — it fetches the current index.html, which points at current filenames.
 * - 'wasm-crash': MediaPipe's WASM runtime throws `ASM_CONSTS[code] is not a function`, the
 *   signature of a corrupted cached response for one of its cross-origin sub-resources (the SW's
 *   CacheFirst rule for cdn.jsdelivr.net/storage.googleapis.com has no integrity check, so a
 *   single interrupted fetch gets cached as if it succeeded and keeps failing identically for up
 *   to 60 days). A plain reload does NOT self-heal this — the corrupted entry is still cached
 *   afterward — so recovery must clear that cache first.
 */
export type KnownErrorClass = 'chunk-load-failure' | 'wasm-crash' | 'other';

export function classifyError(message: string): KnownErrorClass {
  if (/Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(message)) {
    return 'chunk-load-failure';
  }
  if (/ASM_CONSTS/.test(message)) {
    return 'wasm-crash';
  }
  return 'other';
}

// Separate sessionStorage key from LAST_ERROR_AT_KEY: that one records "did we crash" for
// reporting on the NEXT load; this one gates auto-recovery on the CURRENT load so a fix that
// doesn't actually work fails visibly (falls through to the normal ErrorBoundary/Oops screen)
// instead of reload-looping forever.
const RECOVERY_ATTEMPTED_AT_KEY = 'quicksign_recovery_attempted_at';
const RECOVERY_COOLDOWN_MS = 15_000;

async function attemptRecovery(errorClass: KnownErrorClass): Promise<void> {
  // No window (e.g. this module under Node-based unit tests, which have no DOM — see this
  // file's test suite comment) means there's no page to reload; nothing to do.
  if (typeof window === 'undefined') return;

  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RECOVERY_ATTEMPTED_AT_KEY) ?? 0);
  } catch { /* storage blocked — treat as never attempted */ }
  if (Date.now() - last < RECOVERY_COOLDOWN_MS) return; // already tried recently; let it surface

  try {
    sessionStorage.setItem(RECOVERY_ATTEMPTED_AT_KEY, String(Date.now()));
  } catch { /* storage blocked — proceed anyway, worst case is one extra reload */ }

  if (errorClass === 'wasm-crash' && typeof caches !== 'undefined') {
    // Clear the corrupted entry before reloading — a plain reload alone would just re-serve it
    // from cache and crash identically.
    try {
      await caches.delete('signup-mediapipe-cdn');
    } catch { /* best-effort — still reload below even if the cache API rejects */ }
  }

  window.location.reload();
}

export function reportError(error: unknown, context: ErrorContext): void {
  // Structured, single-line-prefixed so it's easy to grep/filter in any log aggregator later,
  // without needing a schema change once real telemetry is wired up.
  console.error(`[error:${context.source}]`, error, context.componentStack ?? '');

  try {
    sessionStorage.setItem(LAST_ERROR_AT_KEY, String(Date.now()));
  } catch { /* storage blocked — the two crash events below still fire */ }

  const message = messageOf(error);
  const errorClass = classifyError(message);
  const route = typeof window !== 'undefined' ? window.location.pathname : '';
  if (context.source === 'error-boundary') {
    track('fatal_error', { message, component_stack_present: !!context.componentStack, route, error_class: errorClass });
  } else {
    track('session_crashed', { source: context.source, message, error_class: errorClass });
  }

  if (errorClass !== 'other') {
    void attemptRecovery(errorClass);
  }
}

/**
 * Call once at startup, AFTER initAnalytics() so track() isn't a no-op. If the previous load in
 * this tab ended with an uncaught error (the sentinel above), fires `unexpected_reload` with how
 * long ago that was, then clears the sentinel — an ordinary refresh never sets it, so this never
 * false-positives on a normal reload.
 */
export function checkUnexpectedReload(): void {
  try {
    const raw = sessionStorage.getItem(LAST_ERROR_AT_KEY);
    if (!raw) return;
    sessionStorage.removeItem(LAST_ERROR_AT_KEY);
    const seconds = Math.max(0, Math.round((Date.now() - Number(raw)) / 1000));
    track('unexpected_reload', { seconds_since_last_error: seconds });
  } catch { /* storage blocked — nothing to detect */ }
}

let installed = false;

/**
 * Catches errors ErrorBoundary structurally cannot: those thrown outside React's render/commit
 * cycle (event handlers, timers, promise chains without their own .catch, async effects). Call
 * once, as early as possible (main.tsx) — idempotent, so it's safe if called more than once
 * (e.g. React 19 StrictMode double-invoking effects).
 */
export function installGlobalErrorReporting(): void {
  if (installed) return;
  installed = true;

  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message, { source: 'window-error' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, { source: 'unhandled-rejection' });
  });
}
