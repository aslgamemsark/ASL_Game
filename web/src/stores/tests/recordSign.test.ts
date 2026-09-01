import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { useUserStore as UseUserStoreType } from '@/stores/useUserStore';

let useUserStore: typeof UseUserStoreType;

beforeAll(async () => {
  const backing = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => { backing.set(key, value); },
    removeItem: (key: string) => { backing.delete(key); },
    clear: () => backing.clear(),
    key: () => null,
    length: 0,
  });
  ({ useUserStore } = await import('@/stores/useUserStore'));
});

beforeEach(() => {
  useUserStore.getState().reset();
});

describe('recordSign mode tracking', () => {
  it('keeps the legacy aggregate while separately recording receptive evidence', () => {
    useUserStore.getState().recordSign({ signId: 'HELLO', mode: 'receptive', correct: true });

    const stats = useUserStore.getState().signAccuracy.HELLO;
    expect(stats).toMatchObject({ attempts: 1, successes: 1 });
    expect(stats.byMode?.receptive).toMatchObject({ attempts: 1, successes: 1 });
    expect(stats.byMode?.expressive).toBeUndefined();
  });

  it('records expressive parameter evidence without changing it for receptive attempts', () => {
    useUserStore.getState().recordSign({
      signId: 'HELLO',
      mode: 'expressive',
      correct: true,
      params: { handshape: { score: 0.8, threshold: 0.8 } },
    });
    useUserStore.getState().recordSign({ signId: 'HELLO', mode: 'receptive', correct: false });

    const stats = useUserStore.getState().signAccuracy.HELLO;
    expect(stats.byMode?.expressive?.parameters?.handshape).toMatchObject({
      attempts: 1,
      score: 1,
      evidenceSchemaVersion: 1,
      recognitionVersion: 'rules-v1',
    });
    expect(stats.byMode?.receptive).toMatchObject({ attempts: 1, successes: 0 });
  });

  it('records an expressive miss without inventing a parameter observation', () => {
    useUserStore.getState().recordSign({ signId: 'HELLO', mode: 'expressive', correct: false, params: undefined });

    const expressive = useUserStore.getState().signAccuracy.HELLO.byMode?.expressive;
    expect(expressive).toMatchObject({ attempts: 1, successes: 0 });
    expect(expressive?.parameters).toBeUndefined();
  });

  it('continues to support legacy positional calls without fabricating a mode history', () => {
    useUserStore.getState().recordSign('HELLO', true);

    const stats = useUserStore.getState().signAccuracy.HELLO;
    expect(stats).toMatchObject({ attempts: 1, successes: 1 });
    expect(stats.byMode).toBeUndefined();
  });

  it('keeps existing mode history when a legacy caller records the aggregate', () => {
    useUserStore.getState().recordSign({ signId: 'HELLO', mode: 'expressive', correct: true });
    useUserStore.getState().recordSign('HELLO', false);

    expect(useUserStore.getState().signAccuracy.HELLO.byMode?.expressive).toMatchObject({ attempts: 1, successes: 1 });
  });

  it('does not lose newer local mode evidence when a legacy remote aggregate wins the sync merge', () => {
    useUserStore.getState().recordSign({ signId: 'HELLO', mode: 'expressive', correct: true });
    useUserStore.getState().mergeProgress({
      signAccuracy: {
        HELLO: { attempts: 9, successes: 9, lastAttempt: Date.now() + 1, nextReviewAt: 0, interval: 1, easeFactor: 2.5 },
      },
    });

    expect(useUserStore.getState().signAccuracy.HELLO.byMode?.expressive).toMatchObject({ attempts: 1, successes: 1 });
  });
});
