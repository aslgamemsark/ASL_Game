// Minimal, dependency-free error reporting. No crash-monitoring SDK (e.g. Sentry) is wired up —
// that requires creating a third-party account, which isn't something to do unilaterally; this
// module is the single integration point so wiring one in later is a few lines, not a hunt across
// the codebase for every place an error could originate (production audit, 2026-07-12).
//
// To add Sentry once you have a DSN:
//   1. npm install @sentry/react
//   2. Sentry.init({ dsn: '...' }) once, near the top of main.tsx
//   3. In reportError() below, add `Sentry.captureException(error, { extra: context });`
//      alongside the existing console.error — everything already routes through here.
export interface ErrorContext {
  source: 'error-boundary' | 'window-error' | 'unhandled-rejection';
  componentStack?: string;
}

export function reportError(error: unknown, context: ErrorContext): void {
  // Structured, single-line-prefixed so it's easy to grep/filter in any log aggregator later,
  // without needing a schema change once real telemetry is wired up.
  console.error(`[error:${context.source}]`, error, context.componentStack ?? '');
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
