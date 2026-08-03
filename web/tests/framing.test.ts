import { describe, it, expect } from 'vitest';
import { computeFraming } from '@/hooks/useRecognition';
import type { Frame } from '@/engine/landmarks';

/**
 * Calibration regression tests for the camera-framing guide.
 *
 * The defect (2026-07-27): the framing rule described a webcam headshot, not an ASL signing space.
 * Measured against 27,110 frames from attempts the rule verifier ACTUALLY PASSED, it rejected
 * 81.1% of them — telling people who were signing correctly that their camera was wrong. The
 * mouth-height rule alone accounted for 77.0% and fired for all 10 users who ever reached a camera,
 * while instructing them to "raise your camera", which is impossible on a laptop and crops the
 * chest that chest-level signs need.
 *
 * These tests pin the geometry to that measured distribution rather than to intuition, so a future
 * threshold change has to argue with real numbers. Values below are the measured percentiles.
 */

/** A frame at the given geometry; only the fields computeFraming reads are populated. */
function frameAt(opts: {
  shoulderWidthRatio: number;
  shoulderYRatio?: number;
  centerOffset?: number;
  mouthYRatio?: number;
}): Frame {
  const width = 640;
  const height = 480;
  const { shoulderWidthRatio, shoulderYRatio = 0.81, centerOffset = 0, mouthYRatio = 0.641 } = opts;
  const halfW = (shoulderWidthRatio * width) / 2;
  const midX = (0.5 + centerOffset) * width;
  const shoulderY = shoulderYRatio * height;
  return {
    hands: [],
    mouth: [midX, mouthYRatio * height],
    width,
    height,
    leftShoulder: [midX + halfW, shoulderY],
    rightShoulder: [midX - halfW, shoulderY],
  } as unknown as Frame;
}

describe('computeFraming — calibrated to real successful-attempt geometry', () => {
  it('accepts the MEDIAN successful signer (shoulder-width 0.409, mouth 0.641, shoulders 0.810)', () => {
    // Under the old rule this exact frame failed: mouth 0.641 > 0.55 -> "Raise your camera a touch".
    expect(computeFraming(frameAt({ shoulderWidthRatio: 0.409 })).ok).toBe(true);
  });

  it('accepts the p05 and p95 of successful shoulder widths (0.289 / 0.607)', () => {
    expect(computeFraming(frameAt({ shoulderWidthRatio: 0.289 })).ok).toBe(true);
    expect(computeFraming(frameAt({ shoulderWidthRatio: 0.607 })).ok).toBe(true);
  });

  it('no longer rejects a low mouth position at any height — the rule is gone', () => {
    for (const mouthYRatio of [0.55, 0.7, 0.9, 1.0]) {
      const result = computeFraming(frameAt({ shoulderWidthRatio: 0.409, mouthYRatio }));
      expect(result.ok, `mouth at ${mouthYRatio} should not fail framing`).toBe(true);
      expect(result.message).not.toMatch(/raise your camera/i);
    }
  });

  it('still rejects genuinely unusable framing', () => {
    expect(computeFraming(frameAt({ shoulderWidthRatio: 0.2 })).message).toMatch(/closer/i);
    expect(computeFraming(frameAt({ shoulderWidthRatio: 0.9 })).message).toMatch(/back/i);
    expect(computeFraming(frameAt({ shoulderWidthRatio: 0.409, centerOffset: 0.25 })).message).toMatch(/center/i);
  });

  it('reports no pose as the one genuinely blocking condition', () => {
    const blank = { hands: [], width: 640, height: 480 } as unknown as Frame;
    expect(computeFraming(blank)).toEqual({ ok: false, message: 'Step into view so I can see you' });
  });

  it('gives the chest-room tip WITHOUT failing framing — it is advice, not a gate', () => {
    // 18% of known-good frames sit below this line and their signs still passed, so blocking here
    // would recreate the false-positive problem this calibration removed.
    const result = computeFraming(frameAt({ shoulderWidthRatio: 0.409, shoulderYRatio: 0.95 }));
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/chest/i);
  });

  it('accepts >=90% of a sample spanning the real successful-geometry distribution', () => {
    // Guards the headline number: the old rule passed 18.9% of known-good frames.
    const widths = [0.289, 0.32, 0.36, 0.409, 0.45, 0.5, 0.55, 0.607];
    const mouths = [0.5, 0.6, 0.641, 0.7, 0.8];
    const samples = widths.flatMap((w) => mouths.map((m) => frameAt({ shoulderWidthRatio: w, mouthYRatio: m })));
    const passed = samples.filter((f) => computeFraming(f).ok).length;
    expect(passed / samples.length).toBeGreaterThanOrEqual(0.9);
  });
});
