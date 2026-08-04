import { describe, it, expect } from 'vitest';
import { clampProgress } from '../src/components/shared/ProgressBar';

describe('clampProgress', () => {
  it('passes through values already in range', () => {
    expect(clampProgress(0)).toBe(0);
    expect(clampProgress(0.42)).toBe(0.42);
    expect(clampProgress(1)).toBe(1);
  });

  it('clamps out-of-range values to the track', () => {
    expect(clampProgress(-0.5)).toBe(0);
    expect(clampProgress(1.7)).toBe(1);
  });

  // The reason this function exists rather than an inline Math.min/max: a caller computing
  // `done / total` on an empty collection passes NaN, which survives both comparisons and would
  // reach the DOM as `scaleX: NaN` — an invisible bar, not an empty one.
  it('treats non-finite input as empty rather than letting it reach the DOM', () => {
    expect(clampProgress(NaN)).toBe(0);
    expect(clampProgress(0 / 0)).toBe(0);
    expect(clampProgress(Infinity)).toBe(0);
    expect(clampProgress(-Infinity)).toBe(0);
  });
});
