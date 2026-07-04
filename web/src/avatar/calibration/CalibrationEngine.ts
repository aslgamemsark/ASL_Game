/**
 * Calibration Engine (spec Chapter 7).
 *
 * Converts the raw AvatarHierarchy (Milestone 1) into a CalibrationProfile: per-bone rest
 * directions and per-hand palm references that later retargeting math reads instead of
 * re-deriving from the GLB every frame ("calibration happens once; animation uses it forever").
 *
 * Every value here is pure analysis of the REST POSE already captured — nothing is measured from
 * landmark data and nothing is invented. See types.ts CalibrationProfile docstring for the explicit
 * scope decision on bone roll/twist (deliberately not calibrated — see notes[] at runtime too).
 */
import { cross, normalize, subtract, vecLength } from './math3d.ts';
import type { AvatarHierarchy, BoneCalibration, CalibrationProfile, HandCalibration, HandSide, Vec3 } from './types.ts';

function boneCalibration(hierarchy: AvatarHierarchy, name: string): BoneCalibration {
  const bone = hierarchy.bones[name];
  const restChildDirections: Record<string, Vec3> = {};
  const restChildLengths: Record<string, number> = {};
  for (const childName of bone.children) {
    const child = hierarchy.bones[childName];
    restChildDirections[childName] = normalize(child.localPosition);
    restChildLengths[childName] = vecLength(child.localPosition);
  }
  return { name, restChildDirections, restChildLengths };
}

const GENERATOR_VERSION = 'calibration-engine@0.1.0';

/** Cheap, dependency-free content hash (FNV-1a) — just needs to change if the source file changes. */
function hashBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function palmRestNormal(hierarchy: AvatarHierarchy, side: HandSide): Vec3 | null {
  const indexChain = hierarchy.hands[side].fingers.index;
  const pinkyChain = hierarchy.hands[side].fingers.pinky;
  if (!indexChain?.length || !pinkyChain?.length) return null;
  const index1 = hierarchy.bones[indexChain[0]];
  const pinky1 = hierarchy.bones[pinkyChain[0]];
  if (!index1 || !pinky1) return null;

  // Both index1 and pinky1 are children of the Hand bone, so their localPosition is already
  // expressed in the Hand bone's own local space — exactly what we need, no extra transform.
  const knuckleAxis = normalize(subtract(pinky1.localPosition, index1.localPosition));
  const palmForward = normalize(index1.localPosition);
  const normal = normalize(cross(knuckleAxis, palmForward));
  if (vecLength(normal) < 1e-6) return null;
  return normal;
}

export function buildCalibration(
  hierarchy: AvatarHierarchy,
  sourceBytes: ArrayBuffer
): CalibrationProfile {
  const bones: Record<string, BoneCalibration> = {};
  for (const name of Object.keys(hierarchy.bones)) {
    bones[name] = boneCalibration(hierarchy, name);
  }

  const hands: Record<HandSide, HandCalibration> = {
    left: { palmRestNormalLocal: palmRestNormal(hierarchy, 'left') },
    right: { palmRestNormalLocal: palmRestNormal(hierarchy, 'right') },
  };

  const leftArm = hierarchy.arms.left.upperArm ? hierarchy.bones[hierarchy.arms.left.upperArm] : null;
  const rightArm = hierarchy.arms.right.upperArm ? hierarchy.bones[hierarchy.arms.right.upperArm] : null;
  const shoulderWidthMeters =
    leftArm && rightArm
      ? vecLength(subtract(leftArm.worldPosition, rightArm.worldPosition))
      : 0;

  const notes: string[] = [
    'Bone roll / axis-twist is NOT calibrated. The retargeting math (M5/M6) uses minimal ' +
      '(shortest-arc) rotations from a calibrated rest direction to a measured target direction, ' +
      'which never reads or needs twist-around-own-axis. Per spec Appendix A Rule 3, that twist is ' +
      'unobservable from a single RGB camera and must not be invented. If a later milestone needs ' +
      'it, it must be added here explicitly, not assumed zero.',
  ];
  if (shoulderWidthMeters <= 0) {
    notes.push('WARNING: shoulderWidthMeters could not be computed (missing arm bones) — arm IK targets in M5 will be unscaled.');
  }
  for (const side of ['left', 'right'] as const) {
    if (!hands[side].palmRestNormalLocal) {
      notes.push(`WARNING: ${side} palm rest normal could not be computed (missing index/pinky finger chain) — M6 palm orientation will be unavailable for this hand.`);
    }
  }

  return {
    avatarVersion: hashBytes(sourceBytes),
    generatorVersion: GENERATOR_VERSION,
    generatedAt: new Date().toISOString(),
    sourceFile: hierarchy.sourceFile,
    shoulderWidthMeters,
    bones,
    hands,
    notes,
  };
}
