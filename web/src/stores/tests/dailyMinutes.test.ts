import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import type { useUserStore as UseUserStoreType } from '@/stores/useUserStore';

// Regression coverage for the daily-minutes counter (bug fixed 2026-07-19). The mechanism:
// `dailyProgressMinutes` was only ever incremented and never reset at a calendar-day boundary, so
// it accumulated forever (a tester saw "40/10, 50/10, 60/10 min" as the days passed). The fix ties
// the counter to `dailyProgressDate`: minutes stored under a past day count as 0, so a new day
// starts the counter fresh. These tests force the day rollover deterministically by faking the
// system clock, not by hoping a real midnight passes.
//
// Same localStorage-stub constraint as mergeProgress.test.ts — zustand's persist middleware needs
// it at module import time under this repo's Node vitest environment.
let useUserStore: typeof UseUserStoreType;

beforeAll(async () => {
  const backing = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => { backing.set(k, v); },
    removeItem: (k: string) => { backing.delete(k); },
    clear: () => backing.clear(),
    key: () => null,
    length: 0,
  });
  ({ useUserStore } = await import('@/stores/useUserStore'));
});

beforeEach(() => {
  useUserStore.getState().reset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('addDailyMinutes daily reset', () => {
  it('accumulates within the same calendar day', () => {
    vi.setSystemTime(new Date('2026-07-19T09:00:00'));
    useUserStore.getState().addDailyMinutes(1.5);
    useUserStore.getState().addDailyMinutes(2);
    expect(useUserStore.getState().dailyProgressMinutes).toBe(3.5);
  });

  it('resets to the new day\'s minutes when the calendar day changes (the core bug)', () => {
    vi.setSystemTime(new Date('2026-07-19T23:00:00'));
    useUserStore.getState().addDailyMinutes(9);
    expect(useUserStore.getState().dailyProgressMinutes).toBe(9);

    // Next day: the counter must start from this call's minutes, not add to yesterday's total.
    vi.setSystemTime(new Date('2026-07-20T08:00:00'));
    useUserStore.getState().addDailyMinutes(2);
    expect(useUserStore.getState().dailyProgressMinutes).toBe(2);
    expect(useUserStore.getState().dailyProgressDate).toBe('2026-07-20');
  });

  it('does not let minutes climb unbounded across many days (the reported symptom)', () => {
    // Practice ~5 min on each of five consecutive days; the counter must never exceed one day's.
    for (let day = 19; day <= 23; day++) {
      vi.setSystemTime(new Date(`2026-07-${day}T10:00:00`));
      useUserStore.getState().addDailyMinutes(5);
      expect(useUserStore.getState().dailyProgressMinutes).toBe(5);
    }
  });
});
