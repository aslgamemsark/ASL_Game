/**
 * Reference Pose System — comparison logic (pure, dependency-free: shared by the CLI tool, the
 * Vitest regression suite, and the AvatarLab viewer). This is the numeric oracle the whole subsystem
 * exists for: "does the CURRENTLY RESOLVED animation match a human-posed ground truth?", expressed
 * in degrees and meters, not "does it look right."
 *
 * Compares against whatever `resolveAnimationForSign` actually resolves to for this sign — NOT
 * hardcoded to the procedural IK path. This matters once a sign has 2+ reference poses: at that
 * point AnimationSource prefers keyframe-driven output (the poses ARE the animation, not just a
 * check on it), so comparing against the now-abandoned procedural guess would be comparing against
 * the wrong thing and fail for reasons that have nothing to do with a real regression — exactly what
 * happened when 24 real HELLO keyframes were first added and this function still forced a
 * procedural-only comparison, producing a ~65deg "error" that was actually just "the human ground
 * truth doesn't match my earlier guess," not a bug.
 *
 * Thresholds are deliberately generous today (M5/M6 only solve arm position — fingers/palm-roll are
 * M6+ and correctly report as "unsolved", never a false pass) and are expected to tighten as more of
 * the solver is built. See docs/REFERENCE_POSE_SPEC.md for the current values and rationale.
 */
import type { AvatarHierarchy, CalibrationProfile, Quat, Vec3 } from '../calibration/types.ts';
import { distance, fromTRS, getTranslation, multiply, quatAngleDeg } from '../calibration/math3d.ts';
import type { Mat4 } from '../calibration/math3d.ts';
import { resolveAnimationForSign } from '../animation/AnimationSource.ts';
import type { BoneComparison, PositionalComparison, ReferencePoseComparisonResult, ReferencePoseMetadata } from './types.ts';

export const ANGULAR_THRESHOLD_DEG = 15;
// A hand-posed Blender reference and a procedurally-authored/interpolated target will never match to
// millimeter precision, so this is deliberately loose (3cm) — it exists to catch gross errors (the
// class of bug fixed in M5: a 100x-too-large elbow), not to demand pixel-perfect agreement.
export const POSITION_THRESHOLD_METERS = 0.03;

function worldMatrixWithOverrides(
  hierarchy: AvatarHierarchy,
  boneName: string,
  overrides: Record<string, { rotation: Quat; translation?: Vec3 }>,
  cache: Map<string, Mat4>
): Mat4 {
  const cached = cache.get(boneName);
  if (cached) return cached;
  const bone = hierarchy.bones[boneName];
  const override = overrides[boneName];
  const local = fromTRS(override?.translation ?? bone.localPosition, override?.rotation ?? bone.localRotation, bone.localScale);
  const world = bone.parent ? multiply(worldMatrixWithOverrides(hierarchy, bone.parent, overrides, cache), local) : local;
  cache.set(boneName, world);
  return world;
}

function metadataOverrides(metadata: ReferencePoseMetadata): Record<string, { rotation: Quat; translation: Vec3 }> {
  const overrides: Record<string, { rotation: Quat; translation: Vec3 }> = {};
  for (const [name, pose] of Object.entries(metadata.bones)) {
    overrides[name] = {
      rotation: { x: pose.rotation[0], y: pose.rotation[1], z: pose.rotation[2], w: pose.rotation[3] },
      translation: { x: pose.translation[0], y: pose.translation[1], z: pose.translation[2] },
    };
  }
  return overrides;
}

function framePosition(hierarchy: AvatarHierarchy, frameBones: Record<string, Quat>, boneName: string): Vec3 {
  const overrides: Record<string, { rotation: Quat }> = {};
  for (const [name, rotation] of Object.entries(frameBones)) overrides[name] = { rotation };
  return getTranslation(worldMatrixWithOverrides(hierarchy, boneName, overrides, new Map()));
}

export function compareReferencePose(
  hierarchy: AvatarHierarchy,
  calibration: CalibrationProfile,
  metadata: ReferencePoseMetadata,
  availablePoses: ReferencePoseMetadata[]
): ReferencePoseComparisonResult {
  const resolved = resolveAnimationForSign(hierarchy, calibration, metadata.signName, availablePoses);
  const frameIndex = Math.round(metadata.frameFraction * (resolved.frameCount - 1));
  const solvedFrame = resolved.frames[frameIndex];

  const bones: BoneComparison[] = Object.entries(metadata.bones).map(([boneName, pose]) => {
    const solved = solvedFrame[boneName];
    if (!solved) return { boneName, status: 'unsolved', angularErrorDeg: null };
    const refQuat: Quat = { x: pose.rotation[0], y: pose.rotation[1], z: pose.rotation[2], w: pose.rotation[3] };
    const angularErrorDeg = quatAngleDeg(refQuat, solved);
    return { boneName, status: angularErrorDeg <= ANGULAR_THRESHOLD_DEG ? 'ok' : 'over_threshold', angularErrorDeg };
  });

  const referenceOverrides = metadataOverrides(metadata);
  const positions: PositionalComparison[] = [];
  const positionTargets: [string, string | null][] = [
    ['right wrist', hierarchy.arms.right.hand],
    ['right elbow', hierarchy.arms.right.forearm],
    ['left wrist', hierarchy.arms.left.hand],
    ['left elbow', hierarchy.arms.left.forearm],
  ];
  for (const [label, boneName] of positionTargets) {
    if (!boneName) continue;
    const refWorld = getTranslation(worldMatrixWithOverrides(hierarchy, boneName, referenceOverrides, new Map()));
    const solvedWorld = framePosition(hierarchy, solvedFrame, boneName);
    positions.push({ label, errorMeters: distance(refWorld, solvedWorld) });
  }

  const pass = bones.every((b) => b.status !== 'over_threshold') && positions.every((p) => p.errorMeters <= POSITION_THRESHOLD_METERS);

  return {
    poseId: metadata.poseId,
    signName: metadata.signName,
    frameFraction: metadata.frameFraction,
    frameIndex,
    bones,
    positions,
    pass,
    angularThresholdDeg: ANGULAR_THRESHOLD_DEG,
    positionThresholdMeters: POSITION_THRESHOLD_METERS,
  };
}
