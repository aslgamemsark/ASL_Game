/**
 * Milestone: video-driven arm + palm retargeting (docs/VIDEO_RETARGET_HANDOFF.md). Adapts
 * `ArmRetargeter.ts`'s `poseArm` to MEASURED elbow/wrist positions from real signer video instead
 * of a 2-bone IK guess — `solveElbow` is never called here (guardrail #2: measure, don't guess).
 *
 * Direction transfer principle: the video signer's world coordinates and the avatar's world
 * coordinates are UNRELATED coordinate systems (different cameras/rigs entirely) — only body-frame
 * RATIOS transfer between them, exactly like `signPaths.ts`'s authored offsets already do. So every
 * measured direction (upper-arm, forearm, palm normal) is first decomposed into the SIGNER's own
 * body-frame basis (`computeSignerBodyFrame`, mirroring `BodyFrame.ts`'s `computeBodyFrame` but built
 * from measured shoulder landmarks instead of a rest-pose rig), then re-projected into the AVATAR's
 * body-frame basis. Positions additionally scale by the ratio of avatar-shoulder-width to
 * signer-shoulder-width; directions do not (unit vectors).
 *
 * Amendment A1 (palm orientation): MediaPipe hand-world-landmarks and pose-world-landmarks share the
 * same X/Y/Z axis CONVENTION (both are outputs of the same Tasks API on the same camera frame) but
 * different ORIGINS — so a hand-world DIRECTION (not position) can be treated as being in the same
 * frame as a pose-world direction for the purpose of body-frame decomposition. The measured palm
 * normal is transferred through the signer/avatar body frames exactly like the arm directions, then
 * the hand bone's roll is solved (not guessed) to match it — this IS observable data, unlike the
 * general "never invent bone twist" case (Appendix A Rule 3 only forbids inventing twist that isn't
 * measured; here it's measured from real hand landmarks).
 */
import type { AvatarHierarchy, CalibrationProfile, HandSide, Quat, Vec3 } from '../calibration/types.ts';
import {
  add, cross, distance, dot, fromTRS, getTranslation, multiply, normalize, quatFromUnitVectors,
  quatIdentity, quatInvert, quatMultiply, rotateVec3, scale, subtract, vecLength,
} from '../calibration/math3d.ts';
import type { Mat4 } from '../calibration/math3d.ts';
import { aimLocalQuaternion } from './IKSolver.ts';
import { computeBodyFrame, type BodyFrame } from './BodyFrame.ts';
import type { LoadedVideoFrame, VideoSide } from '../retarget/videoLandmarkTypes.ts';

export interface SignerBodyFrame {
  right: Vec3;
  up: Vec3;
  forward: Vec3;
  shoulderWidth: number;
}

/**
 * Mirrors `BodyFrame.ts`'s `computeBodyFrame`, built from one video frame's measured pose-world
 * shoulder landmarks instead of a rest-pose rig. Returns null when either shoulder wasn't detected
 * that frame (never invented — caller must skip or hold the previous frame, see gap policy below).
 *
 * UP-axis convention: MediaPipe's `pose_world_landmarks` are Y-DOWN (image convention carried into
 * the 3D world coordinates), NOT the Y-up convention this engine's own rig/BodyFrame uses —
 * EMPIRICALLY VERIFIED, not assumed: with hips as the coordinate origin (y=0 by definition) real
 * extracted shoulder landmarks measured y=~-0.42 — since shoulders sit anatomically ABOVE hips,
 * negative Y must be "up" in this landmark space. (First implementation of this function assumed
 * Y-up by analogy with the avatar's own convention; the FK-readback report immediately flagged
 * elbow-above-shoulder on 100% of frames, which is what caught this — guardrail #1 working as
 * intended.) `up` is therefore `(0,-1,0)` here, not `(0,1,0)`.
 *
 * Forward-sign convention: MediaPipe's pose-world Z decreases toward the camera (documented
 * behavior of `pose_world_landmarks`), the OPPOSITE sign convention from this engine's own
 * "+z faces the avatar's front" rule (`BodyFrame.ts`) — so the flip test here is `forward.z > 0`
 * (not `< 0` as in `computeBodyFrame`). Confirm against Phase 5's visual pilot review — if a
 * retargeted arm looks front-back mirrored, flip this sign next.
 */
export function computeSignerBodyFrame(frame: LoadedVideoFrame): SignerBodyFrame | null {
  const ls = frame.poseWorld?.left_shoulder;
  const rs = frame.poseWorld?.right_shoulder;
  if (!ls || !rs) return null;
  const right = normalize(subtract(rs, ls));
  const up: Vec3 = { x: 0, y: -1, z: 0 };
  let forward = normalize(cross(right, up));
  if (forward.z > 0) forward = scale(forward, -1);
  const shoulderWidth = distance(rs, ls) || 0.3;
  return { right, up, forward, shoulderWidth };
}

/** Decomposes a world-space DIRECTION into a signer body-frame basis (unit-length in, body-frame-relative out). */
export function worldDirToBodyFrame(dir: Vec3, sf: SignerBodyFrame): Vec3 {
  const d = normalize(dir);
  return { x: dot(d, sf.right), y: dot(d, sf.up), z: dot(d, sf.forward) };
}

/** Re-projects a body-frame-relative direction into the AVATAR's world space (renormalized). */
export function bodyFrameDirToWorld(bf: Vec3, avatarFrame: BodyFrame): Vec3 {
  return normalize(
    add(add(scale(avatarFrame.right, bf.x), scale(avatarFrame.up, bf.y)), scale(avatarFrame.forward, bf.z))
  );
}

export interface RetargetedArmFrame {
  side: HandSide;
  upperArmLocalRotation: Quat;
  forearmLocalRotation: Quat;
  handLocalRotation: Quat; // palm-roll-solved if hand data was usable, else rest
  achievedElbowWorld: Vec3;
  achievedWristWorld: Vec3;
  achievedPalmNormalWorld: Vec3 | null;
  targetPalmNormalWorld: Vec3 | null;
  palmAngleErrorDeg: number | null; // FK-readback: how far the achieved palm ended up from target
  knuckleCentroidWorld: Vec3 | null; // for COFFEE-class contact verification (guardrail #4)
}

const VIDEO_SIDE_TO_HAND_SIDE: Record<VideoSide, HandSide> = { left: 'left', right: 'right' };

function restWorldQuaternion(hierarchy: AvatarHierarchy, boneName: string | null, cache: Map<string, Quat>): Quat {
  if (!boneName) return quatIdentity();
  const cached = cache.get(boneName);
  if (cached) return cached;
  const bone = hierarchy.bones[boneName];
  const parentQuat = restWorldQuaternion(hierarchy, bone.parent, cache);
  const world = quatMultiply(parentQuat, bone.localRotation);
  cache.set(boneName, world);
  return world;
}

/**
 * Mean world position of the 4 non-thumb MCP joints, given ARM-ONLY bone-rotation overrides (no
 * finger rotation needed — curl never moves a joint's own position, only its children's).
 *
 * MUST compose full 4x4 TRS matrices (`fromTRS`/`multiply`), never a position+rotation-only walk
 * that skips `bone.localScale` — an earlier version of this function did exactly that and produced
 * knuckle centroids ~40 METERS off, because this rig (like every Mixamo rig on this project) carries
 * its cm->m unit conversion as a non-unit ancestor scale that a scale-blind FK walk silently drops.
 * This is the SAME bug class already documented in `calibration/types.ts`'s `restChildLengths`
 * warning and fixed once in M5 — `authorSignKeyframes.ts`'s identical `knuckleCentroid` (proven, not
 * reinvented) uses this exact `fromTRS`/`multiply`/`getTranslation` pattern for the same reason.
 */
function knuckleCentroidFK(
  hierarchy: AvatarHierarchy,
  side: HandSide,
  armBones: Record<string, Quat>
): Vec3 | null {
  const fingers = hierarchy.hands[side]?.fingers ?? {};
  const mcpNames = (['index', 'middle', 'ring', 'pinky'] as const).map((f) => fingers[f]?.[0]).filter((n): n is string => !!n);
  if (mcpNames.length !== 4) return null;

  const cache = new Map<string, Mat4>();
  function worldMatrix(boneName: string): Mat4 {
    const cached = cache.get(boneName);
    if (cached) return cached;
    const bone = hierarchy.bones[boneName];
    const local = fromTRS(bone.localPosition, armBones[boneName] ?? bone.localRotation, bone.localScale);
    const world = bone.parent ? multiply(worldMatrix(bone.parent), local) : local;
    cache.set(boneName, world);
    return world;
  }

  const positions = mcpNames.map((n) => getTranslation(worldMatrix(n)));
  return scale(positions.reduce((acc, p) => add(acc, p), { x: 0, y: 0, z: 0 }), 1 / positions.length);
}

/** Measured palm normal from one hand's world landmarks (same sign convention as
 * authorSignKeyframes.ts's palm readout: side==='right' ? cross(indexDir,pinkyDir) : cross(pinkyDir,indexDir)). */
function measuredPalmNormal(worldPoints: Vec3[], side: VideoSide): Vec3 | null {
  const wrist = worldPoints[0];
  const indexMcp = worldPoints[5];
  const pinkyMcp = worldPoints[17];
  const va = subtract(indexMcp, wrist);
  const vb = subtract(pinkyMcp, wrist);
  const n = side === 'right' ? cross(va, vb) : cross(vb, va);
  if (vecLength(n) < 1e-9) return null;
  return normalize(n);
}

/** Projects `v` onto the plane perpendicular to `axis` (both must be non-degenerate), renormalized.
 * Returns null if the projection is too small to be a reliable direction (v nearly parallel to axis). */
function projectPerpendicular(v: Vec3, axis: Vec3): Vec3 | null {
  const a = normalize(axis);
  const proj = subtract(v, scale(a, dot(v, a)));
  if (vecLength(proj) < 0.05) return null; // degenerate — palm normal nearly parallel to forearm axis
  return normalize(proj);
}

/**
 * Retargets ONE side's arm for ONE video frame. Returns null if this frame lacks the elbow/wrist
 * world landmarks needed (caller applies the gap policy — hold last valid frame or skip).
 */
export function retargetArmFrame(
  hierarchy: AvatarHierarchy,
  calibration: CalibrationProfile,
  avatarFrame: BodyFrame,
  videoFrame: LoadedVideoFrame,
  videoSide: VideoSide
): RetargetedArmFrame | null {
  const sf = computeSignerBodyFrame(videoFrame);
  if (!sf) return null;

  const shoulderKey = videoSide === 'left' ? 'left_shoulder' : 'right_shoulder';
  const elbowKey = videoSide === 'left' ? 'left_elbow' : 'right_elbow';
  const wristKey = videoSide === 'left' ? 'left_wrist' : 'right_wrist';
  const shoulderW = videoFrame.poseWorld?.[shoulderKey];
  const elbowW = videoFrame.poseWorld?.[elbowKey];
  const wristW = videoFrame.poseWorld?.[wristKey];
  if (!shoulderW || !elbowW || !wristW) return null;

  const side: HandSide = VIDEO_SIDE_TO_HAND_SIDE[videoSide];
  const chain = hierarchy.arms[side];
  if (!chain.upperArm || !chain.forearm || !chain.hand) {
    throw new Error(`retargetArmFrame: ${side} arm chain is incomplete in this hierarchy.`);
  }
  const armBone = hierarchy.bones[chain.upperArm];
  const foreBone = hierarchy.bones[chain.forearm];
  const handBone = hierarchy.bones[chain.hand];
  const shoulderWorldAvatar = armBone.worldPosition;

  const quatCache = new Map<string, Quat>();
  const armParentQuat = restWorldQuaternion(hierarchy, armBone.parent, quatCache);

  // 1) Upper arm: aim at the measured elbow direction (no IK guess — guardrail #2).
  const upperArmDirBF = worldDirToBodyFrame(subtract(elbowW, shoulderW), sf);
  const desiredUpperArmDir = bodyFrameDirToWorld(upperArmDirBF, avatarFrame);
  const armCal = calibration.bones[chain.upperArm];
  const armRestChildDir = armCal?.restChildDirections[chain.forearm];
  if (!armRestChildDir) throw new Error(`Calibration missing restChildDirection for ${chain.upperArm} -> ${chain.forearm}.`);
  const upperArmLocalRotation = aimLocalQuaternion(armBone.localRotation, armRestChildDir, armParentQuat, desiredUpperArmDir);
  const armWorldQuat = quatMultiply(armParentQuat, upperArmLocalRotation);

  // 2) Forearm: aim at the measured wrist direction from the (now-placed) elbow.
  const forearmDirBF = worldDirToBodyFrame(subtract(wristW, elbowW), sf);
  const desiredForearmDir = bodyFrameDirToWorld(forearmDirBF, avatarFrame);
  const foreCal = calibration.bones[chain.forearm];
  const foreRestChildDir = foreCal?.restChildDirections[chain.hand];
  if (!foreRestChildDir) throw new Error(`Calibration missing restChildDirection for ${chain.forearm} -> ${chain.hand}.`);
  const forearmLocalRotation = aimLocalQuaternion(foreBone.localRotation, foreRestChildDir, armWorldQuat, desiredForearmDir);
  const foreWorldQuat = quatMultiply(armWorldQuat, forearmLocalRotation);

  // FK readback positions (guardrail #1) — elbow via calibrated real-world upper-arm length, wrist via forearm length.
  const l1 = distance(armBone.worldPosition, foreBone.worldPosition);
  const l2 = distance(foreBone.worldPosition, handBone.worldPosition);
  const achievedElbowWorld = add(shoulderWorldAvatar, scale(desiredUpperArmDir, l1));
  const achievedWristWorld = add(achievedElbowWorld, scale(desiredForearmDir, l2));

  // 3) Palm orientation (Amendment A1) — solve roll from measured hand data if usable this frame.
  let handLocalRotation = handBone.localRotation;
  let achievedPalmNormalWorld: Vec3 | null = null;
  let targetPalmNormalWorld: Vec3 | null = null;
  let palmAngleErrorDeg: number | null = null;

  const hand = videoFrame.hands[videoSide];
  const palmRestNormalLocal = calibration.hands[side]?.palmRestNormalLocal;
  if (hand?.worldPoints && palmRestNormalLocal) {
    const measuredPalm = measuredPalmNormal(hand.worldPoints, videoSide);
    if (measuredPalm) {
      const palmDirBF = worldDirToBodyFrame(measuredPalm, sf);
      targetPalmNormalWorld = bodyFrameDirToWorld(palmDirBF, avatarFrame);

      const handWorldNoRoll = quatMultiply(foreWorldQuat, handBone.localRotation);
      const achievedNoRoll = normalize(rotateVec3(palmRestNormalLocal, handWorldNoRoll));
      const forearmAxisWorld = desiredForearmDir;

      const achievedProj = projectPerpendicular(achievedNoRoll, forearmAxisWorld);
      const targetProj = projectPerpendicular(targetPalmNormalWorld, forearmAxisWorld);
      if (achievedProj && targetProj) {
        const rollQuat = quatFromUnitVectors(achievedProj, targetProj);
        const handWorldFinal = quatMultiply(rollQuat, handWorldNoRoll);
        handLocalRotation = quatMultiply(quatInvert(foreWorldQuat), handWorldFinal);
        achievedPalmNormalWorld = normalize(rotateVec3(palmRestNormalLocal, handWorldFinal));
        const cosErr = Math.min(1, Math.max(-1, dot(achievedPalmNormalWorld, targetPalmNormalWorld)));
        palmAngleErrorDeg = (Math.acos(cosErr) * 180) / Math.PI;
      } else {
        achievedPalmNormalWorld = achievedNoRoll; // degenerate roll case — leave at no-roll orientation, don't invent
      }
    }
  }

  const armOnlyBones: Record<string, Quat> = {
    [chain.upperArm]: upperArmLocalRotation,
    [chain.forearm]: forearmLocalRotation,
  };
  const knuckleCentroidWorld = knuckleCentroidFK(hierarchy, side, armOnlyBones);

  return {
    side,
    upperArmLocalRotation,
    forearmLocalRotation,
    handLocalRotation,
    achievedElbowWorld,
    achievedWristWorld,
    achievedPalmNormalWorld,
    targetPalmNormalWorld,
    palmAngleErrorDeg,
    knuckleCentroidWorld,
  };
}

/** Convenience: computes the avatar's own body frame once (cheap, pure function of the rest rig). */
export function computeAvatarFrame(hierarchy: AvatarHierarchy): BodyFrame {
  return computeBodyFrame(hierarchy);
}
