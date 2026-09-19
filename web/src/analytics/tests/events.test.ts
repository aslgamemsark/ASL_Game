import { describe, it, expect } from 'vitest';
import { EVENTS } from '@/analytics/events';

describe('event taxonomy', () => {
  it('has no duplicate event names among ACTIVE events', () => {
    const names = Object.values(EVENTS);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every EVENTS key maps to itself as the wire name (keeps events.ts and PostHog event names identical)', () => {
    for (const [key, value] of Object.entries(EVENTS)) {
      expect(value).toBe(key);
    }
  });
});
