/**
 * Static handshape library — reusable finger-curl poses, calibration-only (no per-frame video data
 * needed since these signs hold one constant handshape for their whole motion). This is the
 * "handshape reality check" bridge from docs/VIDEO_RETARGET_HANDOFF.md: video-driven retargeting
 * (VideoArmRetargeter.ts) measures arm position + palm orientation from real signer video, but
 * fingers stay at rest (Milestone 6, the full per-frame finger solver, isn't built yet) — so a sign
 * like YOU or COFFEE is unreadable without SOME handshape. A one-time static pose applied on top of
 * the video-derived arm is enough for signs whose handshape doesn't change during the motion, and is
 * reusable across signs (one fist pose serves COFFEE, YES, WORK, ...).
 *
 * `buildHandshape` is the SAME curl algorithm as `authorSignKeyframes.ts`'s `buildFist` (ported here
 * verbatim, generalized to curl an arbitrary SUBSET of fingers instead of always all five) — do not
 * reimplement this a third time. Both of `authorSignKeyframes.ts`'s confirmed-fixed defects apply
 * here too and are already fixed in this shared version:
 *   1. Curl DIRECTION is chosen by which side of the palm plane the fingertip lands on
 *      (dot(tip-mcp, palmNormal) < 0 = correct), never by tip-to-wrist distance (that metric is
 *      nearly symmetric between a correct curl and a backward hyperextension).
 *   2. Every requested finger is enumerated by name and FAILS LOUDLY if its chain is missing —
 *      never silently skipped.
 */
import type { AvatarHierarchy, FingerName, HandSide, Quat, Vec3 } from '../calibration/types.ts';
import {
  cross, distance, dot, fromTRS, getTranslation, multiply, normalize, quatInvert, quatMultiply,
  rotateVec3, subtract,
} from '../calibration/math3d.ts';
import type { Mat4 } from '../calibration/math3d.ts';

function axisAngleQuat(axis: Vec3, deg: number): Quat {
  const a = normalize(axis);
  const half = (deg * Math.PI) / 360;
  const s = Math.sin(half);
  return { x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(half) };
}

function restWorldQuat(hierarchy: AvatarHierarchy, boneName: string | null): Quat {
  if (!boneName) return { x: 0, y: 0, z: 0, w: 1 };
  const bone = hierarchy.bones[boneName];
  return quatMultiply(restWorldQuat(hierarchy, bone.parent), bone.localRotation);
}

function worldMatrixWithOverrides(
  hierarchy: AvatarHierarchy,
  boneName: string,
  overrides: Record<string, Quat>,
  cache: Map<string, Mat4>
): Mat4 {
  const cached = cache.get(boneName);
  if (cached) return cached;
  const bone = hierarchy.bones[boneName];
  const local = fromTRS(bone.localPosition, overrides[boneName] ?? bone.localRotation, bone.localScale);
  const world = bone.parent ? multiply(worldMatrixWithOverrides(hierarchy, bone.parent, overrides, cache), local) : local;
  cache.set(boneName, world);
  return world;
}

// 70/95/60 measured as near-optimal on this rig (authorSignKeyframes.ts): pushing higher
// (85/105/75) increased middle tip->wrist from 91mm to 101mm — overcurl.
const CURL_DEG = { finger: [70, 95, 60], thumb: [70, 75, 45] };

/**
 * Curls `fingersToCurl` on one hand into their bent position; any finger NOT in that list is left
 * untouched (no bone override — stays at rest/straight, which is what an extended index or H
 * handshape needs). Throws if a requested finger's chain is missing (fail loudly, guardrail #3).
 */
export function buildHandshape(
  hierarchy: AvatarHierarchy,
  side: HandSide,
  fingersToCurl: readonly FingerName[]
): Record<string, Quat> {
  const hand = hierarchy.hands[side];
  const wristName = hierarchy.arms[side].hand;
  if (!hand || !wristName) throw new Error(`buildHandshape: no ${side} hand/finger chains discovered on this rig.`);
  const fingers = hand.fingers;
  const idx = fingers['index']?.[0];
  const pky = fingers['pinky']?.[0];
  if (!idx || !pky) throw new Error(`buildHandshape: ${side} hand is missing index/pinky chains — cannot derive a curl axis.`);

  const wristRest = hierarchy.bones[wristName].worldPosition;
  const idxRest = hierarchy.bones[idx].worldPosition;
  const pkyRest = hierarchy.bones[pky].worldPosition;
  const transverseAxisW = normalize(subtract(pkyRest, idxRest));
  const va = subtract(idxRest, wristRest);
  const vb = subtract(pkyRest, wristRest);
  const palmNormalW = normalize(side === 'right' ? cross(va, vb) : cross(vb, va));

  const result: Record<string, Quat> = {};
  const missing = fingersToCurl.filter((f) => !fingers[f] || fingers[f]!.length === 0);
  if (missing.length > 0) throw new Error(`buildHandshape: ${side} hand missing chain(s) for: ${missing.join(', ')}.`);

  for (const fingerName of fingersToCurl) {
    const chain = fingers[fingerName]!;
    const isThumb = fingerName === 'thumb';
    const angles = isThumb ? CURL_DEG.thumb : CURL_DEG.finger;
    const mcpBone = chain[0];
    const tipBone = chain[chain.length - 1];
    const mcpRest = hierarchy.bones[mcpBone].worldPosition;
    const tipRestForAxis = hierarchy.bones[tipBone].worldPosition;
    const thumbDirRest = normalize(subtract(tipRestForAxis, mcpRest));
    const axisW = isThumb ? normalize(cross(thumbDirRest, palmNormalW)) : transverseAxisW;

    let best: { rotations: Record<string, Quat>; sideOfPalm: number } | null = null;
    for (const sign of [1, -1]) {
      const rotations: Record<string, Quat> = {};
      for (let j = 0; j < Math.min(angles.length, chain.length); j++) {
        const boneName = chain[j];
        const bone = hierarchy.bones[boneName];
        const axisL = rotateVec3(axisW, quatInvert(restWorldQuat(hierarchy, boneName)));
        rotations[boneName] = quatMultiply(bone.localRotation, axisAngleQuat(axisL, sign * angles[j]));
      }
      const tip = getTranslation(worldMatrixWithOverrides(hierarchy, tipBone, rotations, new Map()));
      const sideOfPalm = dot(subtract(tip, mcpRest), palmNormalW);
      if (!best || sideOfPalm < best.sideOfPalm) best = { rotations, sideOfPalm };
    }
    Object.assign(result, best!.rotations);
  }

  return result;
}

/** Convenience presets for the pilot's 5 signs (docs/VIDEO_RETARGET_HANDOFF.md "handshape reality check"). */
export const FIST_FINGERS: readonly FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
export const INDEX_POINT_CURL_FINGERS: readonly FingerName[] = ['thumb', 'middle', 'ring', 'pinky']; // index left straight
export const H_SHAPE_CURL_FINGERS: readonly FingerName[] = ['thumb', 'ring', 'pinky']; // index+middle left straight, together

/** Distance-based sanity check reused by callers' FK reports (mirrors authorSignKeyframes.ts's fist report). */
export function fingertipToMcpMm(
  hierarchy: AvatarHierarchy,
  boneOverrides: Record<string, Quat>,
  finger: FingerName,
  side: HandSide
): number | null {
  const chain = hierarchy.hands[side]?.fingers[finger];
  if (!chain || chain.length === 0) return null;
  const cache = new Map<string, Mat4>();
  const mcpPos = getTranslation(worldMatrixWithOverrides(hierarchy, chain[0], boneOverrides, cache));
  const tipPos = getTranslation(worldMatrixWithOverrides(hierarchy, chain[chain.length - 1], boneOverrides, cache));
  return distance(mcpPos, tipPos) * 1000;
}
