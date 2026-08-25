/**
 * Regression tests for the ASL-A1 extraction (round-4 finding F1+F2): the recognition hook's
 * 10 Hz signals (verify() result, static-hold progress) must reach their rendered subscribers
 * through THIS store — never through page-level React state — so the owning page tree renders
 * zero times per publish. These pin the store mechanism itself (notification, snapshot
 * stability, unsubscribe hygiene) that LiveSignCoach/ClassifierDevPanel/the calibration harness
 * rely on via useSyncExternalStore.
 */
import { describe, it, expect, vi } from 'vitest';
import { createExternalStore } from '../externalStore';

describe('createExternalStore', () => {
  it('notifies subscribers on publish and serves the fresh snapshot', () => {
    const store = createExternalStore<{ n: number } | null>(null);
    const seen: ({ n: number } | null)[] = [];
    store.subscribe(() => seen.push(store.getSnapshot()));

    expect(store.getSnapshot()).toBeNull();
    const v1 = { n: 1 };
    store.publish(v1);

    expect(seen).toEqual([v1]);
    expect(store.getSnapshot()).toBe(v1);
  });

  it('keeps the snapshot referentially stable between publishes (Object.is contract)', () => {
    const store = createExternalStore<number | null>(null);
    const snapA = store.getSnapshot();
    const snapB = store.getSnapshot();
    expect(snapA).toBe(snapB); // no publish ⇒ same reference ⇒ no spurious re-render

    store.publish(0.5);
    expect(store.getSnapshot()).toBe(0.5);
    store.publish(0.5); // same primitive again: still a legit publish, snapshot stays equal
    expect(store.getSnapshot()).toBe(0.5);
  });

  it('stops notifying after unsubscribe and isolates independent subscribers', () => {
    const store = createExternalStore<string>('init');
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = store.subscribe(a);
    store.subscribe(b);

    store.publish('x');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubA();
    unsubA(); // double-unsubscribe must be safe
    store.publish('y');

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('isolates a throwing subscriber: snapshot intact, other listeners still notified', () => {
    // Mirrors the in-loop reality: a listener crash mid-publish must not starve sibling
    // subscribers (e.g. checklist stops updating because the dev panel threw) nor lose data.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createExternalStore<number>(0);
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    store.subscribe(bad);
    store.subscribe(good);

    store.publish(7);

    expect(store.getSnapshot()).toBe(7);
    expect(good).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalled(); // swallowed but LOUD — never silent
    errSpy.mockRestore();
  });
});
