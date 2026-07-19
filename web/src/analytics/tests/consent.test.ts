import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isAnalyticsOptedOut, setAnalyticsOptedOut } from '@/analytics/consent';

// Same localStorage-stub constraint as stores/tests/*.test.ts — this repo's Node-based vitest
// environment has no jsdom/happy-dom, so `localStorage` doesn't exist as a global by default.
let backing = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => { backing.set(k, v); },
  removeItem: (k: string) => { backing.delete(k); },
  clear: () => backing.clear(),
  key: () => null,
  length: 0,
});

describe('analytics consent (opt-out)', () => {
  beforeEach(() => {
    backing = new Map<string, string>();
  });

  it('defaults to NOT opted out (capture is on by default)', () => {
    expect(isAnalyticsOptedOut()).toBe(false);
  });

  it('persists an opt-out choice', () => {
    setAnalyticsOptedOut(true);
    expect(isAnalyticsOptedOut()).toBe(true);
  });

  it('persists opting back in', () => {
    setAnalyticsOptedOut(true);
    setAnalyticsOptedOut(false);
    expect(isAnalyticsOptedOut()).toBe(false);
  });

  it('fails closed (treated as not-opted-out) if localStorage is unreadable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage blocked'); },
      setItem: () => { throw new Error('storage blocked'); },
      removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
    });
    expect(() => isAnalyticsOptedOut()).not.toThrow();
    expect(isAnalyticsOptedOut()).toBe(false);
  });
});
