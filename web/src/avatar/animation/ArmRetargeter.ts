/**
 * Milestone 5 — Arm retargeting: Sign-schema anchor (signPaths.ts) + analytical 2-bone IK
 * (IKSolver.ts), combined via calibration data (never re-reads the raw GLB). Produces, per frame,
 * the LOCAL quaternions for the upper-arm and forearm bones plus the ACHIEVED hand world position —
 * callers (viewer, CLI verifier) compare achieved vs target directly, in meters, per the spec's
 * "acceptance tests must be real numeric assertions" rule.
 */
import type { AvatarHierarchy, CalibrationProfile, HandSide, Quat, Vec3 } from '../calibration/types.ts';
import { add, distance, normalize, quatIdentity, quatMultiply, scale, subtract } from '../calibration/math3d.ts';
import { computeBodyFrame, targetWorld, type BodyFrame } from './BodyFrame.ts';
import { aimLocalQuaternion, solveElbow } from './IKSolver.ts';
import { buildSignFrames, SIGN_PATHS } from './signPaths.ts';

export interface ArmPoseResult {
  side: HandSide;
  shoulderWorld: Vec3;
  elbowWorld: Vec3;
  achievedHandWorld: Vec3;
  targetHandWorld: Vec3;
  positionErrorMeters: number;
  upperArmLocalRotation: Quat;
  forearmLocalRotation: Quat;
}

export interface SignArmFrame {
  frameIndex: number;
  right: ArmPoseResult;
  left: ArmPoseResult | null;
}

export interface SignRetargetResult {
  signName: string;
  fps: number;
  frames: SignArmFrame[];
  maxPositionErrorMeters: number;
  meanPositionErrorMeters: number;
}

function restWorldQuaternion(hierarchy: AvatarHierarchy, boneName: string, cache: Map<string, Quat>): Quat {
  const cached = cache.get(boneName);
  if (cached) return cached;
  const bone = hierarchy.bones[boneName];
  const parentQuat = bone.parent ? restWorldQuaternion(hierarchy, bone.parent, cache) : quatIdentity();
  const world = quatMultiply(parentQuat, bone.localRotation);
  cache.set(boneName, world);
  return world;
}

/** Poses one arm's upper-arm+forearm bones to reach `targetW` via 2-bone IK. Pure function, no mutation. */
export function poseArm(
  hierarchy: AvatarHierarchy,
  calibration: CalibrationProfile,
  frame: BodyFrame,
  side: HandSide,
  targetW: Vec3,
  quatCache: Map<string, Quat> = new Map()
): ArmPoseResult {
  const chain = hierarchy.arms[side];
  if (!chain.upperArm || !chain.forearm || !chain.hand) {
    throw new Error(`poseArm: ${side} arm chain is incomplete in this hierarchy.`);
  }
  const armBone = hierarchy.bones[chain.upperArm];
  const foreBone = hierarchy.bones[chain.forearm];
  const handBone = hierarchy.bones[chain.hand];
  const shoulderWorld = armBone.worldPosition;

  const armCal = calibration.bones[chain.upperArm];
  const foreCal = calibration.bones[chain.forearm];
  // l1/l2 MUST be real-world meters (this IK operates entirely in world space). CalibrationProfile's
  // restChildLengths is deliberately LOCAL-space / pre-armature-scale (see types.ts docstring) — it
  // is only valid when re-composed through a full parent-to-root FK chain (which is what
  // CalibrationValidator does), never as a standalone scalar length. Mixamo rigs carry their overall
  // cm->m conversion as a non-joint ancestor scale (~0.01) that only M1's root-bone bake accounts
  // for; every other bone's restChildLengths is off by that same ~100x factor. The world-space rest
  // positions (hierarchy.bones[...].worldPosition), already validated bone-length-correct by M1/M2's
  // round-trip check, are the only source that is unambiguously in meters — use those directly.
  const l1 = distance(armBone.worldPosition, foreBone.worldPosition);
  const l2 = distance(foreBone.worldPosition, handBone.worldPosition);

  const pole = add(shoulderWorld, add(scale(frame.up, -1.6 * l1), scale(frame.forward, 0.7 * l1)));
  const elbowWorld = solveElbow(shoulderWorld, targetW, l1, l2, pole);

  const armParentQuat = armBone.parent ? restWorldQuaternion(hierarchy, armBone.parent, quatCache) : quatIdentity();
  const armRestChildDir = armCal?.restChildDirections[chain.forearm];
  if (!armRestChildDir) throw new Error(`Calibration missing restChildDirection for ${chain.upperArm} -> ${chain.forearm}.`);
  const desiredUpperArmDir = normalize(subtract(elbowWorld, shoulderWorld));
  const upperArmLocalRotation = aimLocalQuaternion(armBone.localRotation, armRestChildDir, armParentQuat, desiredUpperArmDir);

  const armNewWorldQuat = quatMultiply(armParentQuat, upperArmLocalRotation);
  const foreRestChildDir = foreCal?.restChildDirections[chain.hand];
  if (!foreRestChildDir) throw new Error(`Calibration missing restChildDirection for ${chain.forearm} -> ${chain.hand}.`);
  const desiredForearmDir = normalize(subtract(targetW, elbowWorld));
  const forearmLocalRotation = aimLocalQuaternion(foreBone.localRotation, foreRestChildDir, armNewWorldQuat, desiredForearmDir);

  const achievedHandWorld = add(elbowWorld, scale(desiredForearmDir, l2));
  const positionErrorMeters = distance(achievedHandWorld, targetW);

  return {
    side,
    shoulderWorld,
    elbowWorld,
    achievedHandWorld,
    targetHandWorld: targetW,
    positionErrorMeters,
    upperArmLocalRotation,
    forearmLocalRotation,
  };
}

/** Runs the full authored path for one benchmark sign through arm IK, frame by frame. */
export function retargetSign(
  hierarchy: AvatarHierarchy,
  calibration: CalibrationProfile,
  signName: keyof typeof SIGN_PATHS
): SignRetargetResult {
  const signFrames = buildSignFrames(signName);
  const frame = computeBodyFrame(hierarchy);
  const quatCache = new Map<string, Quat>(); // rest world quaternions are constant across frames

  const errors: number[] = [];
  const frames: SignArmFrame[] = [];
  for (let i = 0; i < signFrames.frameCount; i++) {
    const targetR = targetWorld(hierarchy, frame, signFrames.anchorJoint, signFrames.dom[i]);
    const right = poseArm(hierarchy, calibration, frame, 'right', targetR, quatCache);
    errors.push(right.positionErrorMeters);

    let left: ArmPoseResult | null = null;
    if (signFrames.twoHanded && signFrames.ndom) {
      const targetL = targetWorld(hierarchy, frame, signFrames.anchorJoint, signFrames.ndom[i]);
      left = poseArm(hierarchy, calibration, frame, 'left', targetL, quatCache);
      errors.push(left.positionErrorMeters);
    }

    frames.push({ frameIndex: i, right, left });
  }

  return {
    signName,
    fps: signFrames.fps,
    frames,
    maxPositionErrorMeters: Math.max(...errors),
    meanPositionErrorMeters: errors.reduce((a, b) => a + b, 0) / errors.length,
  };
}
