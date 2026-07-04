/**
 * Body-relative coordinate frame derived from the avatar's OWN rest pose (never hardcoded), so
 * authored body-frame offsets (signPaths.ts) map onto ANY avatar's actual proportions. Mirrors the
 * proven `bodyFrame()`/`targetWorld()` helpers from the earlier working JS avatar (D:\asl-synthesis).
 */
import type { AvatarHierarchy, Vec3 } from '../calibration/types.ts';
import { cross, distance, normalize, subtract, add, scale } from '../calibration/math3d.ts';

export interface BodyFrame {
  right: Vec3;
  up: Vec3;
  forward: Vec3;
  shoulderWidth: number;
}

/** Finds a bone by name ignoring an optional "mixamorig:" prefix — hierarchy.bones keys keep it. */
export function findBoneName(hierarchy: AvatarHierarchy, strippedOrFull: string): string {
  if (hierarchy.bones[strippedOrFull]) return strippedOrFull;
  const match = Object.keys(hierarchy.bones).find((n) => n.replace(/^mixamorig:?/i, '') === strippedOrFull);
  if (!match) throw new Error(`No bone found matching "${strippedOrFull}" in hierarchy.`);
  return match;
}

export function computeBodyFrame(hierarchy: AvatarHierarchy): BodyFrame {
  const rightArmName = hierarchy.arms.right.upperArm;
  const leftArmName = hierarchy.arms.left.upperArm;
  if (!rightArmName || !leftArmName) {
    throw new Error('computeBodyFrame requires both left and right upper-arm bones to be discovered.');
  }
  const sR = hierarchy.bones[rightArmName].worldPosition;
  const sL = hierarchy.bones[leftArmName].worldPosition;
  const right = normalize(subtract(sR, sL));
  const up: Vec3 = { x: 0, y: 1, z: 0 };
  let forward = normalize(cross(right, up));
  if (forward.z < 0) forward = scale(forward, -1); // convention: +z faces the camera/front
  const shoulderWidth = distance(sR, sL) || 0.3;
  return { right, up, forward, shoulderWidth };
}

/** World position of `anchorJoint` (rest) offset by a body-frame vector, scaled by shoulder width. */
export function targetWorld(hierarchy: AvatarHierarchy, frame: BodyFrame, anchorJointName: string, offset: Vec3): Vec3 {
  const boneName = findBoneName(hierarchy, anchorJointName);
  const ref = hierarchy.bones[boneName].worldPosition;
  return add(
    add(ref, scale(frame.right, offset.x * frame.shoulderWidth)),
    add(scale(frame.up, offset.y * frame.shoulderWidth), scale(frame.forward, offset.z * frame.shoulderWidth))
  );
}
