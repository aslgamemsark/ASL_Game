import { describe, it, expect } from 'vitest';
import { EVENTS, FUTURE_EVENTS } from '@/analytics/events';

describe('event taxonomy', () => {
  it('has no duplicate event names among ACTIVE events', () => {
    const names = Object.values(EVENTS);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has no duplicate event names among FUTURE events', () => {
    const names = Object.values(FUTURE_EVENTS);
    expect(new Set(names).size).toBe(names.length);
  });

  it('ACTIVE and FUTURE event names never collide (a FUTURE event must never accidentally match a shipped one)', () => {
    const active = new Set(Object.values(EVENTS));
    const overlap = Object.values(FUTURE_EVENTS).filter((n) => active.has(n));
    expect(overlap).toEqual([]);
  });

  it('every EVENTS key maps to itself as the wire name (keeps events.ts and PostHog event names identical)', () => {
    for (const [key, value] of Object.entries(EVENTS)) {
      expect(value).toBe(key);
    }
  });
});
