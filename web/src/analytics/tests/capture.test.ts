import { describe, it, expect, beforeEach, vi } from 'vitest';
import { track } from '@/analytics/capture';

// analytics is never configured under vitest (no VITE_POSTHOG_KEY, not PROD, VITE_ANALYTICS_DEV
// unset) — client.ts's initAnalytics() is never called anywhere in the test environment, so
// getPosthog() always returns null. track() must be a safe, silent no-op in that state: this is
// the guarantee every call site in the app relies on (no `if (analyticsReady) track(...)` guards
// anywhere — see the Developer Guide).
describe('track (analytics disabled/unconfigured)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not throw when called before analytics is initialized', () => {
    expect(() => track('level_up', { new_level: 5 })).not.toThrow();
  });

  it('never touches the network — no PostHog instance exists to capture through', () => {
    // If getPosthog() ever returned a real instance while unconfigured, this would need a fetch
    // spy; asserting fetch is never called is the deterministic proxy for "no capture happened".
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    track('screen_viewed', { screen: 'home', previous_screen: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
