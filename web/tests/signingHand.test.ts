/**
 * Pose maths for the loading animation (components/shared/SigningHand.tsx).
 *
 * Worth testing despite being "just an animation": the geometry is pure, deterministic functions,
 * and the two bugs found while building it were both invisible in code review and only showed up
 * by measuring the rendered DOM — a joint pivoting about the wrong point looks like a plausible
 * hand until you notice the fingers are hinged to the middle of the palm. These lock the parts
 * that can regress silently.
 */
import { describe, it, expect } from 'vitest';
import {
  poseAt,
  digitTransform,
  bendTransform,
  wristTransform,
  SKELETON,
  type DigitPose,
} from '@/components/shared/signingHandPose';

const byId = (id: string) => SKELETON.find((d) => d.id === id)!;
const EXTENDED = 1;

describe('SigningHand pose sequence', () => {
  it('closes the loop seamlessly — the last keyframe equals the first', () => {
    // If these ever diverge the animation visibly snaps once per cycle, which is exactly the
    // "hard cut" the design brief rules out. Compared numerically rather than by deep equality:
    // the two paths through the interpolator differ by ~1e-17 of floating-point dust, which is
    // not a seam anyone can see and not worth encoding as an exact-match requirement.
    const a = poseAt(0);
    const b = poseAt(1);
    expect(b.wrist).toBeCloseTo(a.wrist, 10);
    expect(b.bob).toBeCloseTo(a.bob, 10);
    for (const d of SKELETON) {
      expect(b.digits[d.id].rot).toBeCloseTo(a.digits[d.id].rot, 10);
      expect(b.digits[d.id].bend).toBeCloseTo(a.digits[d.id].bend, 10);
      expect(b.digits[d.id].len).toBeCloseTo(a.digits[d.id].len, 10);
    }
  });

  it('starts on ILY: index and pinky extended, middle and ring folded', () => {
    const p = poseAt(0).digits;
    expect(p.index.len).toBe(EXTENDED);
    expect(p.pinky.len).toBe(EXTENDED);
    expect(p.middle.len).toBeLessThan(0.4);
    expect(p.ring.len).toBeLessThan(0.4);
  });

  it('reaches a fully open hand mid-loop', () => {
    const p = poseAt(0.3).digits;
    for (const d of SKELETON) expect(p[d.id].len).toBe(EXTENDED);
  });

  it('reaches a V: index and middle extended, ring and pinky folded', () => {
    const p = poseAt(0.7).digits;
    expect(p.index.len).toBe(EXTENDED);
    expect(p.middle.len).toBe(EXTENDED);
    expect(p.ring.len).toBeLessThan(0.4);
    expect(p.pinky.len).toBeLessThan(0.4);
  });

  it('never snaps: no joint jumps more than a few degrees between adjacent frames', () => {
    // The whole premise is continuous articulation rather than swapped poses, so a discontinuity
    // anywhere in the cycle is a real defect, not a cosmetic one.
    const STEPS = 400;
    let worst = 0;
    let prev = poseAt(0);
    for (let i = 1; i <= STEPS; i++) {
      const cur = poseAt(i / STEPS);
      worst = Math.max(worst, Math.abs(cur.wrist - prev.wrist));
      for (const d of SKELETON) {
        const a = prev.digits[d.id];
        const b = cur.digits[d.id];
        worst = Math.max(worst, Math.abs(b.rot - a.rot), Math.abs(b.bend - a.bend));
      }
      prev = cur;
    }
    expect(worst).toBeLessThan(4);
  });

  it('produces finite numbers across the whole cycle', () => {
    for (let i = 0; i <= 100; i++) {
      const f = poseAt(i / 100);
      expect(Number.isFinite(f.wrist)).toBe(true);
      expect(Number.isFinite(f.bob)).toBe(true);
      for (const d of SKELETON) {
        const p = f.digits[d.id];
        expect(Number.isFinite(p.rot) && Number.isFinite(p.bend) && Number.isFinite(p.len)).toBe(true);
      }
    }
  });
});

describe('SigningHand joint pivots', () => {
  const pose: DigitPose = { rot: 20, bend: 30, len: 0.5 };

  // REGRESSION: every joint was previously pivoting about the viewBox centre (60, 76) because
  // framer-motion overwrites `transform-origin`, so fingers hinged from the middle of the palm.
  // These assert each joint names its OWN pivot explicitly.
  it('rotates a digit about its own knuckle', () => {
    const d = byId('index');
    expect(digitTransform(d, pose)).toContain(`rotate(20.00 ${d.x} ${d.y})`);
  });

  it('rotates the mid joint about the far end of the proximal segment', () => {
    const d = byId('middle');
    expect(bendTransform(d, pose)).toBe(`rotate(30.00 ${d.x} ${d.y - d.prox})`);
  });

  it('foreshortens before rotating, so a curl shortens along the finger rather than squashing it', () => {
    // SVG applies a transform list right-to-left, so `scale` must appear AFTER `rotate` in the
    // string to be applied BEFORE it.
    const t = digitTransform(byId('index'), pose);
    expect(t.indexOf('rotate(')).toBeLessThan(t.indexOf('scale('));
    expect(t).toContain('scale(1 0.500)');
  });

  it('swings the whole hand about the wrist, not its centre', () => {
    expect(wristTransform({ wrist: 5, bob: -2, digits: {} })).toContain('rotate(5.00 60 130)');
  });
});
