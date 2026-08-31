import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { useUserStore as UseUserStoreType } from '@/stores/useUserStore';

// mergeProgress has ~15 different per-field merge strategies (max-wins for gold/xp/signs,
// "only overwrite if remote is truthy" for equipped items, union for arrays, newer-by-timestamp
// for per-id maps) — exactly the kind of dense logic that silently regresses when a new synced
// field is added without its own merge rule (production audit, 2026-07-12). No prior test
// coverage existed for any of it.
//
// The store module needs `localStorage` (zustand's persist middleware) at creation time, which
// doesn't exist under this repo's Node-based vitest environment (no jsdom/happy-dom — see the H3/
// H7 commits for the same constraint) — stub a minimal in-memory one before importing it.
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
});

describe('mergeProgress', () => {
  it('keeps training-data collection off until the learner explicitly opts in', () => {
    expect(useUserStore.getState().collectTrainingData).toBe(false);
  });

  it('keeps the higher of local/remote for xp, level, and streak (never regresses on a lower remote)', () => {
    useUserStore.setState({ xp: 500, level: 6, streak: 10 });
    useUserStore.getState().mergeProgress({ xp: 100, level: 2, streak: 3 });
    const s = useUserStore.getState();
    expect(s.xp).toBe(500);
    expect(s.level).toBe(6);
    expect(s.streak).toBe(10);
  });

  it('takes the higher remote value when it actually is higher', () => {
    useUserStore.setState({ xp: 100 });
    useUserStore.getState().mergeProgress({ xp: 900 });
    expect(useUserStore.getState().xp).toBe(900);
  });

  it('takes the max of local/remote gold rather than blindly trusting remote (preserves an offline admin grant, but never lets a stale remote undo local spending below the real balance)', () => {
    useUserStore.setState({ gold: 50 });
    useUserStore.getState().mergeProgress({ gold: 10 });
    expect(useUserStore.getState().gold).toBe(50);

    useUserStore.setState({ gold: 50 });
    useUserStore.getState().mergeProgress({ gold: 500 });
    expect(useUserStore.getState().gold).toBe(500);
  });

  it('unions completedLessons instead of one side clobbering the other', () => {
    useUserStore.setState({ completedLessons: ['l1', 'l2'] });
    useUserStore.getState().mergeProgress({ completedLessons: ['l2', 'l3'] });
    expect(useUserStore.getState().completedLessons.sort()).toEqual(['l1', 'l2', 'l3']);
  });

  it('keeps the equipped border/avatar/badge when remote is null instead of wiping it (the exact bug the inline comment documents)', () => {
    useUserStore.setState({ equippedBorder: 'gold_border', equippedAvatar: 'wizard', activeBadge: 'streak_7' });
    useUserStore.getState().mergeProgress({ equippedBorder: null, equippedAvatar: null, activeBadge: null });
    const s = useUserStore.getState();
    expect(s.equippedBorder).toBe('gold_border');
    expect(s.equippedAvatar).toBe('wizard');
    expect(s.activeBadge).toBe('streak_7');
  });

  it('still applies a real remote equipped value over local (e.g. an admin-set cosmetic from another device)', () => {
    useUserStore.setState({ equippedBorder: 'gold_border' });
    useUserStore.getState().mergeProgress({ equippedBorder: 'legendary_border' });
    expect(useUserStore.getState().equippedBorder).toBe('legendary_border');
  });

  it('keeps the per-sign accuracy entry with the more recent lastAttempt, not blindly the remote one', () => {
    useUserStore.setState({
      signAccuracy: {
        HELLO: { attempts: 5, successes: 4, lastAttempt: 1000, nextReviewAt: 2000, interval: 1, easeFactor: 2.5 },
      },
    });
    useUserStore.getState().mergeProgress({
      signAccuracy: {
        HELLO: { attempts: 1, successes: 1, lastAttempt: 500, nextReviewAt: 900, interval: 1, easeFactor: 2.5 },
      },
    });
    expect(useUserStore.getState().signAccuracy.HELLO.lastAttempt).toBe(1000);

    useUserStore.getState().mergeProgress({
      signAccuracy: {
        HELLO: { attempts: 9, successes: 9, lastAttempt: 5000, nextReviewAt: 6000, interval: 2, easeFactor: 2.6 },
      },
    });
    expect(useUserStore.getState().signAccuracy.HELLO.lastAttempt).toBe(5000);
  });

  it('dedupes pendingChests by id, keeping local chests and only adding genuinely new remote ones', () => {
    useUserStore.setState({
      pendingChests: [{ id: 'c1', worldId: 'coffee', readyAt: 100 }],
    });
    useUserStore.getState().mergeProgress({
      pendingChests: [
        { id: 'c1', worldId: 'coffee', readyAt: 999 }, // same id as local — local copy wins (kept as-is)
        { id: 'c2', worldId: 'hospital', readyAt: 200 },
      ],
    });
    const chests = useUserStore.getState().pendingChests;
    expect(chests.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
    expect(chests.find((c) => c.id === 'c1')?.readyAt).toBe(100);
  });

  it('leaves a field untouched entirely when remote does not include it', () => {
    useUserStore.setState({ xp: 250, gold: 75 });
    useUserStore.getState().mergeProgress({});
    const s = useUserStore.getState();
    expect(s.xp).toBe(250);
    expect(s.gold).toBe(75);
  });
});
