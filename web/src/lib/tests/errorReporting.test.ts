import { describe, expect, it, vi } from 'vitest';
import { reportError } from '@/lib/errorReporting';

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
});
