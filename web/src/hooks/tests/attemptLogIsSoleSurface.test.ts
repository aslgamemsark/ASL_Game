import { describe, it, expect } from 'vitest';

// Regression guard on the MECHANISM, not on one screen.
//
// `sign_attempt` and `first_sign_success` were originally hand-written per signing screen. Six
// copies drifted, and the drift was invisible: `first_sign_success` was present in Lesson and
// Practice and silently absent from Story, Speed and multiplayer, so the activation metric
// under-counted every guest whose first pass happened outside a lesson — with nothing failing.
// Consolidating into useAttemptLog fixed it once; this test is what stops the seventh screen
// re-introducing its own copy, since a hand-rolled copy is a passing build either way.
//
// Reads source as raw text via Vite's import.meta.glob rather than Node's `fs`, for the same
// reason as analytics/tests/noDirectCapture.test.ts: the browser tsconfig has no `node` types.
const modules = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const SOLE_SURFACE = '/src/hooks/useAttemptLog.ts';

describe('useAttemptLog is the only place attempts are reported', () => {
  it("emits 'sign_attempt' from nowhere else", () => {
    const offenders = Object.entries(modules)
      .filter(([path]) => path !== SOLE_SURFACE)
      .filter(([, content]) => /track\(\s*['"]sign_attempt['"]/.test(content))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('calls trackFirstSignSuccess from nowhere else', () => {
    const offenders = Object.entries(modules)
      .filter(([path]) => path !== SOLE_SURFACE && !path.endsWith('/analytics/firstSuccess.ts') && !path.endsWith('/analytics/index.ts'))
      .filter(([, content]) => /trackFirstSignSuccess\(/.test(content))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
