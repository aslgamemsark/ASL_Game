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

  it('three or more missed days resets to 1 (gap=4) when no protection card is held', () => {
    useUserStore.setState({ streakFreezes: 0 }); // isolate the pure reset path
    setSystemDate('2026-01-05'); // Mon
    useUserStore.getState().checkStreak();
    setSystemDate('2026-01-06'); // Tue — build the streak to 2 first
    useUserStore.getState().checkStreak();
    setSystemDate('2026-01-10'); // Fri — gap of 4 from Tue
    useUserStore.getState().checkStreak();
    expect(useUserStore.getState().streak).toBe(1);
  });

  it('a much longer gap also resets to 1 when no protection card is held', () => {
    useUserStore.setState({ streakFreezes: 0 });
    setSystemDate('2026-01-05');
    useUserStore.getState().checkStreak();
    setSystemDate('2026-02-01');
    useUserStore.getState().checkStreak();
    expect(useUserStore.getState().streak).toBe(1);
  });
});

describe('streak protection card', () => {
  it('consumes a protection card to save the streak on a 4+ day gap', () => {
    useUserStore.setState({ streakFreezes: 1 });
    setSystemDate('2026-01-05'); // Mon — streak 1
    useUserStore.getState().checkStreak();
    setSystemDate('2026-01-06'); // Tue — streak 2
    useUserStore.getState().checkStreak();
    setSystemDate('2026-01-10'); // Fri — gap of 4, would reset, but a freeze saves it
    useUserStore.getState().checkStreak();
    expect(useUserStore.getState().streak).toBe(3);       // preserved, not reset to 1
    expect(useUserStore.getState().streakFreezes).toBe(0); // one card consumed
  });

  it('only consumes a card when the gap actually exceeds the grace window', () => {
    useUserStore.setState({ streakFreezes: 2 });
    setSystemDate('2026-01-05');
    useUserStore.getState().checkStreak();
    setSystemDate('2026-01-07'); // gap of 2 — within grace, no card needed
    useUserStore.getState().checkStreak();
    expect(useUserStore.getState().streak).toBe(2);
    expect(useUserStore.getState().streakFreezes).toBe(2); // untouched
  });
});

describe('recurring 7-day streak reward', () => {
  it('grants a protection card and a chest each time the streak hits a multiple of 7', () => {
    useUserStore.setState({ streakFreezes: 0, pendingChests: [] });
    // Practice every day for 7 straight days.
    for (let d = 5; d <= 11; d++) {
      setSystemDate(`2026-01-${String(d).padStart(2, '0')}`);
      useUserStore.getState().checkStreak();
    }
    const s = useUserStore.getState();
    expect(s.streak).toBe(7);
    expect(s.streakFreezes).toBe(1);        // reward card granted at day 7
    expect(s.pendingChests.length).toBe(1); // reward chest granted at day 7
  });

  it('does not grant the 7-day reward on non-multiples of 7', () => {
    useUserStore.setState({ streakFreezes: 0, pendingChests: [] });
    for (let d = 5; d <= 9; d++) { // 5 days → streak 5
      setSystemDate(`2026-01-${String(d).padStart(2, '0')}`);
      useUserStore.getState().checkStreak();
    }
    const s = useUserStore.getState();
    expect(s.streak).toBe(5);
    expect(s.streakFreezes).toBe(0);
    expect(s.pendingChests.length).toBe(0);
  });
});
