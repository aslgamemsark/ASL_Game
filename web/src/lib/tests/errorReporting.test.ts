import { describe, expect, it, vi } from 'vitest';
import { reportError, classifyError } from '@/lib/errorReporting';

// installGlobalErrorReporting() itself needs `window` (addEventListener/dispatchEvent), which
// this repo's vitest config runs under Node, not jsdom/happy-dom (no DOM testing infra exists
// here yet — see ModalShell's verification notes in the H3 commit for the same constraint).
// Verified live in a running dev server instead: window 'error' and 'unhandledrejection'
// listeners both fire reportError with the right source, and a second install() call doesn't
// double-register listeners.
describe('reportError', () => {
  it('logs the error with its source context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError(new Error('boom'), { source: 'error-boundary', componentStack: 'at X' });
    expect(spy).toHaveBeenCalledWith('[error:error-boundary]', expect.any(Error), 'at X');
    spy.mockRestore();
  });

  it('defaults the component-stack suffix to empty when omitted', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError('window boom', { source: 'window-error' });
    expect(spy).toHaveBeenCalledWith('[error:window-error]', 'window boom', '');
    spy.mockRestore();
  });

  // attemptRecovery() itself needs `window`/`caches`/`sessionStorage`, unavailable under this
  // repo's Node-based vitest environment (see the file header comment) — but reportError must
  // not throw when it calls into that path with no window present, which these two exercise
  // implicitly: classifyError('other') deliberately never reaches attemptRecovery.
  it('does not throw when a known-recoverable message is reported with no window present', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => reportError(new Error('ASM_CONSTS[123] is not a function'), { source: 'unhandled-rejection' })).not.toThrow();
    spy.mockRestore();
  });
});

// classifyError is the mechanism that decides which crashes get auto-recovered — see
// KnownErrorClass in errorReporting.ts for what each class means. These lock the exact message
// shapes actually observed in production (PostHog, 2026-08-06), not synthetic approximations.
describe('classifyError', () => {
  it('recognizes a stale-chunk-after-redeploy failure', () => {
    expect(classifyError('Failed to fetch dynamically imported module: https://aslgame.vercel.app/assets/PracticePage-CrQMMtYY.js')).toBe('chunk-load-failure');
  });

  it('recognizes the Firefox-style dynamic import wording too', () => {
    expect(classifyError('error loading dynamically imported module: https://aslgame.vercel.app/assets/ShopPage-CeFZ9qVn.js')).toBe('chunk-load-failure');
  });

  it('recognizes the MediaPipe WASM cache-corruption signature', () => {
    expect(classifyError('ASM_CONSTS[code] is not a function')).toBe('wasm-crash');
  });

  it('classifies anything else as other, not a known-recoverable class', () => {
    expect(classifyError('Cannot read properties of undefined')).toBe('other');
    expect(classifyError('Network request failed')).toBe('other');
  });
});
