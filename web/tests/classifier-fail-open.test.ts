/**
 * Regression test for the classifier fail-open fix (production audit, 2026-07-12): classify()
 * must never reject, even when the underlying TF.js inference call throws (WebGL context loss,
 * OOM, shape mismatch). A rejection used to propagate to useRecognition's .catch, which only
 * logged it and dropped an already-confirmed rule-verifier PASS silently — no hint, no retry.
 * Returning null instead lets gatePass(true, null, ...) fail open exactly like a disabled
 * classifier already does.
 */
import { describe, it, expect, vi } from 'vitest';
import { frameFromDict } from '../src/engine/landmarks';
import coffeeCorrect from './fixtures/coffee_correct.json';

vi.mock('@tensorflow/tfjs', () => ({
  loadLayersModel: vi.fn(async () => ({
    predict: () => {
      throw new Error('simulated inference failure (e.g. WebGL context loss)');
    },
  })),
  tensor: vi.fn(() => ({
    data: async () => new Float32Array(),
    dispose: () => {},
  })),
}));

describe('classifier fail-open behavior', () => {
  it('classify() resolves to null instead of rejecting when inference throws', async () => {
    const { loadClassifier } = await import('../src/engine/classifier');
    const classifier = await loadClassifier('/fake/model.json', ['HELLO', 'WANT']);
    expect(classifier.enabled).toBe(true);

    const frames = coffeeCorrect.frames.map((fd) =>
      frameFromDict(fd as Parameters<typeof frameFromDict>[0])
    );

    await expect(classifier.classify(frames)).resolves.toBeNull();
  });
});
