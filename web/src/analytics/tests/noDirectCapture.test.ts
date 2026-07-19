import { describe, it, expect } from 'vitest';

// Self-audit, enforced mechanically rather than trusted as a one-time review: `posthog.capture(`
// must never appear outside analytics/capture.ts — that file is the ONLY sanctioned capture
// surface (see its own module docstring). A new page/hook reaching for posthog directly instead
// of the typed `track()` helper is exactly the "scattered analytics" failure mode this
// architecture exists to prevent.
//
// Reads source as raw text via Vite's import.meta.glob (not Node's `fs`) — this project's
// browser tsconfig (tsconfig.app.json) has no `node` types, so a Node-fs-based version of this
// check would fail `tsc -b` even though it runs fine under vitest's own transform.
const modules = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('analytics self-audit: no direct posthog.capture() outside capture.ts', () => {
  it('finds zero stray posthog.capture(...) call sites', () => {
    const offenders = Object.entries(modules)
      .filter(([path]) => !path.endsWith('/analytics/capture.ts') && !path.endsWith('/analytics/client.ts'))
      .filter(([, content]) => /\bposthog\.capture\(/.test(content))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
