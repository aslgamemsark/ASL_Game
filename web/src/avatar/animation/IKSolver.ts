/**
 * Analytical 2-bone IK (Law of Cosines + pole vector) — port of the proven `solveElbow`/`aimBone`
 * from the earlier working JS avatar (D:\asl-synthesis\avatar_app.js). Pure vector/quaternion math,
 * no rig mutation: callers combine this with calibration data to produce LOCAL bone quaternions.
 */
import type { Quat, Vec3 } from '../calibration/types.ts';
import {
  add, subtract, scale, dot, normalize, vecLength,
  quatMultiply, quatInvert, quatFromUnitVectors, rotateVec3,
} from '../calibration/math3d.ts';

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/**
 * Solves for the elbow's world position given shoulder S, hand target T, upper-arm/forearm bone
 * lengths l1/l2, and a `pole` point that resolves the one remaining degree of freedom (which way the
 * elbow bends). If T is out of reach, `d` is clamped to [|l1-l2|, l1+l2] so the arm fully extends or
 * folds instead of producing NaN — an unreachable target is a real condition (see verification, M8),
 * not a bug to hide, so callers should compare the ACHIEVED hand position against the target.
 */
export function solveElbow(shoulder: Vec3, target: Vec3, l1: number, l2: number, pole: Vec3): Vec3 {
  const toT = subtract(target, shoulder);
  const rawD = vecLength(toT);
  const d = clamp(rawD, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  const axis = rawD > 1e-9 ? normalize(toT) : { x: 0, y: 0, z: 1 };
  const cosAlpha = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const alpha = Math.acos(cosAlpha);

  const rel = subtract(pole, shoulder);
  let bend = subtract(rel, scale(axis, dot(rel, axis)));
  if (vecLength(bend) < 1e-4) {
    bend = add({ x: 0, y: -1, z: 0 }, scale(axis, axis.y));
  }
  bend = normalize(bend);

  return add(add(shoulder, scale(axis, l1 * Math.cos(alpha))), scale(bend, l1 * Math.sin(alpha)));
}

/**
 * The local quaternion a bone must have so that its rest-calibrated direction to `childRestDirLocal`
 * ends up pointing along `desiredWorldDir` in world space. Always computed FRESH from the bone's
 * CALIBRATED REST rotation and the current `parentWorldQuat` — never accumulated frame-to-frame, so
 * there is no drift and every frame is independently reproducible (spec: calibrate once, animate
 * forever; Appendix A Rule 3: only ever derive the minimal/shortest-arc rotation, never invent roll).
 */
export function aimLocalQuaternion(
  restLocalRotation: Quat,
  restChildDirLocal: Vec3,
  parentWorldQuat: Quat,
  desiredWorldDir: Vec3
): Quat {
  const restWorldQuat = quatMultiply(parentWorldQuat, restLocalRotation);
  const curWorldDir = normalize(rotateVec3(restChildDirLocal, restWorldQuat));
  const rot = quatFromUnitVectors(curWorldDir, normalize(desiredWorldDir));
  const newWorldQuat = quatMultiply(rot, restWorldQuat);
  return quatMultiply(quatInvert(parentWorldQuat), newWorldQuat);
}
