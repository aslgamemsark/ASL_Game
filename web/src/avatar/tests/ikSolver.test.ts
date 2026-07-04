import { describe, expect, it } from 'vitest';
import { aimLocalQuaternion, solveElbow } from '../animation/IKSolver.ts';
import { distance, normalize, quatIdentity, rotateVec3 } from '../calibration/math3d.ts';
import type { Vec3 } from '../calibration/types.ts';

describe('solveElbow', () => {
  it('produces an elbow exactly l1 from the shoulder and l2 from a reachable target', () => {
    const shoulder: Vec3 = { x: 0, y: 1.4, z: 0 };
    const l1 = 0.28;
    const l2 = 0.25;
    const target: Vec3 = { x: 0.2, y: 1.2, z: 0.3 }; // within reach (dist < l1+l2)
    const pole: Vec3 = { x: 0, y: 0, z: 1 };
    const elbow = solveElbow(shoulder, target, l1, l2, pole);
    expect(distance(shoulder, elbow)).toBeCloseTo(l1, 5);
    expect(distance(elbow, target)).toBeCloseTo(l2, 5);
  });

  it('fully extends (elbow on the shoulder-target line) when the target is at max reach', () => {
    const shoulder: Vec3 = { x: 0, y: 0, z: 0 };
    const l1 = 0.3, l2 = 0.3;
    const dir = normalize({ x: 1, y: 0.2, z: 0.5 });
    const target: Vec3 = { x: dir.x * (l1 + l2), y: dir.y * (l1 + l2), z: dir.z * (l1 + l2) };
    const elbow = solveElbow(shoulder, target, l1, l2, { x: 0, y: -1, z: 0 });
    // elbow should lie almost exactly on the shoulder->target ray at distance l1
    const expectedElbow = { x: dir.x * l1, y: dir.y * l1, z: dir.z * l1 };
    expect(distance(elbow, expectedElbow)).toBeLessThan(1e-2);
  });

  it('clamps gracefully (no NaN) for an unreachable target far beyond l1+l2', () => {
    const shoulder: Vec3 = { x: 0, y: 0, z: 0 };
    const l1 = 0.3, l2 = 0.3;
    const target: Vec3 = { x: 5, y: 0, z: 0 };
    const elbow = solveElbow(shoulder, target, l1, l2, { x: 0, y: -1, z: 0 });
    expect(Number.isFinite(elbow.x) && Number.isFinite(elbow.y) && Number.isFinite(elbow.z)).toBe(true);
    expect(distance(shoulder, elbow)).toBeCloseTo(l1, 5);
  });

  it('bends toward the pole side, not away from it', () => {
    const shoulder: Vec3 = { x: 0, y: 0, z: 0 };
    const l1 = 0.3, l2 = 0.3;
    const target: Vec3 = { x: 0, y: 0, z: 0.5 }; // straight ahead, bent-elbow case
    const poleDown: Vec3 = { x: 0, y: -1, z: 0.25 };
    const elbow = solveElbow(shoulder, target, l1, l2, poleDown);
    expect(elbow.y).toBeLessThan(0); // elbow should droop toward the pole (downward)
  });
});

describe('aimLocalQuaternion', () => {
  it('the resulting world direction exactly matches the desired direction', () => {
    const restLocalRotation = quatIdentity();
    const restChildDirLocal: Vec3 = normalize({ x: 0, y: -1, z: 0 }); // rest: child hangs straight down
    const parentWorldQuat = quatIdentity();
    const desiredWorldDir: Vec3 = normalize({ x: 0.5, y: 0.2, z: 0.8 });

    const localQuat = aimLocalQuaternion(restLocalRotation, restChildDirLocal, parentWorldQuat, desiredWorldDir);
    // world quat = parentWorldQuat * localQuat (identity parent here)
    const achievedWorldDir = rotateVec3(restChildDirLocal, localQuat);
    expect(achievedWorldDir.x).toBeCloseTo(desiredWorldDir.x, 5);
    expect(achievedWorldDir.y).toBeCloseTo(desiredWorldDir.y, 5);
    expect(achievedWorldDir.z).toBeCloseTo(desiredWorldDir.z, 5);
  });

  it('is deterministic and independent of any prior frame state (always derived fresh from rest)', () => {
    const restLocalRotation = quatIdentity();
    const restChildDirLocal: Vec3 = { x: 1, y: 0, z: 0 };
    const parentWorldQuat = quatIdentity();
    const desiredWorldDir: Vec3 = normalize({ x: 0, y: 1, z: 0 });

    const q1 = aimLocalQuaternion(restLocalRotation, restChildDirLocal, parentWorldQuat, desiredWorldDir);
    const q2 = aimLocalQuaternion(restLocalRotation, restChildDirLocal, parentWorldQuat, desiredWorldDir);
    expect(q1).toEqual(q2);
  });
});
