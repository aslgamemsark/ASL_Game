import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUserStore } from '@/stores/useUserStore';

// checkStreak's grace period: last practiced Mon, returning Tue/Wed/Thu keeps the streak alive
// (gap of up to 3 calendar days), Fri+ resets it (gap of 4+ days).
function setSystemDate(dateStr: string) {
  vi.setSystemTime(new Date(`${dateStr}T12:00:00.000Z`));
}

beforeEach(() => {
  vi.useRealTimers();
  useUserStore.getState().reset();
});

describe('checkStreak grace period', () => {
  it('first-ever practice starts the streak at 1', () => {
    setSystemDate('2026-01-05');
    useUserStore.getState().checkStreak();
    expect(useUserStore.getState().streak).toBe(1);
    expect(useUserStore.getState().lastPracticeDate).toBe('2026-01-05');
  });

  it('same-day practice is a no-op', () => {
    setSystemDate('2026-01-05');
    useUserStore.getState().checkStreak();
    useUserStore.getState().checkStreak();
    expect(useUserStore.getState().streak).toBe(1);
  });

  it('next-day practice increments (gap=1)', () => {
    setSystemDate('2026-01-05');
    useUserStore.getState().checkStreak();
    setSystemDate('2026-01-06');
    useUserStore.getState().checkStreak();
    expect(useUserStore.getState().streak).toBe(2);
  });

  it('one missed day still increments (gap=2)', () => {
    setSystemDate('2026-01-05'); // Mon
    useUserStore.getState().checkStreak();
    setSystemDate('2026-01-07'); // Wed
    useUserStore.getState().checkStreak();
    expect(useUserStore.getState().streak).toBe(2);
  });

  it('two missed days still increments (gap=3)', () => {
    setSystemDate('2026-01-05'); // Mon
    useUserStore.getState().checkStreak();
    setSystemDate('2026-01-08'); // Thu
    useUserStore.getState().checkStreak();
    expect(useUserStore.getState().streak).toBe(2);
  });

  it('three or more missed days resets to 1 (gap=4)', () => {
    setSystemDate('2026-01-05'); // Mon
    useUserStore.getState().checkStreak();
    setSystemDate('2026-01-06'); // Tue — build the streak to 2 first
    useUserStore.getState().checkStreak();
    setSystemDate('2026-01-10'); // Fri — gap of 4 from Tue
    useUserStore.getState().checkStreak();
    expect(useUserStore.getState().streak).toBe(1);
  });

  it('a much longer gap also resets to 1', () => {
    setSystemDate('2026-01-05');
    useUserStore.getState().checkStreak();
    setSystemDate('2026-02-01');
    useUserStore.getState().checkStreak();
    expect(useUserStore.getState().streak).toBe(1);
  });
});
