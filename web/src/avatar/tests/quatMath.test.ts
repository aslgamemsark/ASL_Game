import { describe, expect, it } from 'vitest';
import {
  add, cross, dot, normalize, quatAngleDeg, quatFromUnitVectors, quatIdentity, quatInvert,
  quatMultiply, rotateVec3, slerp, subtract, vecLength,
} from '../calibration/math3d.ts';
import type { Quat, Vec3 } from '../calibration/types.ts';

function expectVecClose(a: Vec3, b: Vec3, precision = 6) {
  expect(a.x).toBeCloseTo(b.x, precision);
  expect(a.y).toBeCloseTo(b.y, precision);
  expect(a.z).toBeCloseTo(b.z, precision);
}

describe('quatFromUnitVectors + rotateVec3', () => {
  it('rotates `from` exactly onto `to` for generic vectors', () => {
    const from = normalize({ x: 1, y: 0.3, z: -0.5 });
    const to = normalize({ x: -0.2, y: 1, z: 0.4 });
    const q = quatFromUnitVectors(from, to);
    const rotated = rotateVec3(from, q);
    expectVecClose(rotated, to);
  });

  it('returns identity when from == to', () => {
    const v = normalize({ x: 1, y: 2, z: 3 });
    const q = quatFromUnitVectors(v, v);
    expectVecClose(q as unknown as Vec3, { x: 0, y: 0, z: 0 });
    expect(q.w).toBeCloseTo(1, 6);
  });

  it('handles the 180-degree opposite-vector case without NaN', () => {
    const v = normalize({ x: 1, y: 0, z: 0 });
    const q = quatFromUnitVectors(v, { x: -1, y: 0, z: 0 });
    expect(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w)).toBe(true);
    const rotated = rotateVec3(v, q);
    expectVecClose(rotated, { x: -1, y: 0, z: 0 });
  });

  it('preserves vector length (rotation is not a scale)', () => {
    const from = normalize({ x: 0.2, y: 0.9, z: -0.1 });
    const to = normalize({ x: 0.7, y: -0.3, z: 0.5 });
    const q = quatFromUnitVectors(from, to);
    const arbitrary: Vec3 = { x: 2, y: -1, z: 0.5 };
    const rotated = rotateVec3(arbitrary, q);
    expect(vecLength(rotated)).toBeCloseTo(vecLength(arbitrary), 6);
  });
});

describe('quatMultiply / quatInvert', () => {
  it('q * inverse(q) == identity', () => {
    const q = quatFromUnitVectors(normalize({ x: 1, y: 0, z: 0 }), normalize({ x: 0.3, y: 0.8, z: 0.2 }));
    const identity = quatMultiply(q, quatInvert(q));
    expect(identity.x).toBeCloseTo(0, 6);
    expect(identity.y).toBeCloseTo(0, 6);
    expect(identity.z).toBeCloseTo(0, 6);
    expect(Math.abs(identity.w)).toBeCloseTo(1, 6);
  });

  it('composing two rotations matches applying them in sequence', () => {
    const v: Vec3 = { x: 1, y: 0, z: 0 };
    const q1 = quatFromUnitVectors(normalize(v), normalize({ x: 0, y: 1, z: 0 }));
    const q2 = quatFromUnitVectors(normalize({ x: 0, y: 1, z: 0 }), normalize({ x: 0, y: 0, z: 1 }));
    const sequential = rotateVec3(rotateVec3(v, q1), q2);
    const composed = rotateVec3(v, quatMultiply(q2, q1));
    expectVecClose(sequential, composed);
  });

  it('quatIdentity leaves vectors unchanged', () => {
    const v: Vec3 = { x: 3, y: -2, z: 5 };
    expectVecClose(rotateVec3(v, quatIdentity()), v);
  });
});

describe('vector helpers used by trajectory/IK', () => {
  it('cross/dot/add/subtract behave as expected', () => {
    const a: Vec3 = { x: 1, y: 0, z: 0 };
    const b: Vec3 = { x: 0, y: 1, z: 0 };
    expectVecClose(cross(a, b), { x: 0, y: 0, z: 1 });
    expect(dot(a, b)).toBe(0);
    expectVecClose(add(a, b), { x: 1, y: 1, z: 0 });
    expectVecClose(subtract(a, b), { x: 1, y: -1, z: 0 });
  });
});

describe('slerp — used by KeyframeAnimator to interpolate Blender-posed rotations', () => {
  const qa = quatFromUnitVectors({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  const qb = quatFromUnitVectors({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

  it('t=0 returns a, t=1 returns b', () => {
    const at0 = slerp(qa, qb, 0);
    const at1 = slerp(qa, qb, 1);
    expect(quatAngleDeg(at0, qa)).toBeCloseTo(0, 4);
    expect(quatAngleDeg(at1, qb)).toBeCloseTo(0, 4);
  });

  it('midpoint is angularly equidistant from both endpoints', () => {
    const mid = slerp(qa, qb, 0.5);
    expect(quatAngleDeg(mid, qa)).toBeCloseTo(quatAngleDeg(mid, qb), 3);
  });

  it('output is always a unit quaternion', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const q = slerp(qa, qb, t);
      const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
      expect(len).toBeCloseTo(1, 5);
    }
  });

  it('takes the shortest path regardless of quaternion sign (double cover)', () => {
    const negB: Quat = { x: -qb.x, y: -qb.y, z: -qb.z, w: -qb.w }; // same rotation as qb, negated
    const viaB = slerp(qa, qb, 0.5);
    const viaNegB = slerp(qa, negB, 0.5);
    expect(quatAngleDeg(viaB, viaNegB)).toBeCloseTo(0, 3);
  });

  it('interpolating a rotation with itself returns that rotation at every t (nlerp fallback path)', () => {
    for (const t of [0, 0.3, 0.7, 1]) {
      expect(quatAngleDeg(slerp(qa, qa, t), qa)).toBeCloseTo(0, 4);
    }
  });
});
