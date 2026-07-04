/**
 * Keyframe-driven animation — the PREFERRED animation source once 2+ human-posed Blender references
 * exist for a sign (see docs/BLENDER_WORKFLOW.md, docs/REFERENCE_POSE_SPEC.md). A single reference
 * pose is still verification-only (compared against the procedural IK path); 2+ poses for the same
 * sign, at different `frameFraction`s, are SLERPed directly into a real per-frame animation —
 * bypassing signPaths.ts's guessed body-frame offsets and the 2-bone IK solver entirely for whatever
 * bones the keyframes cover, since a human already posed the correct joint angles.
 *
 * Pure logic, no I/O — reference poses are passed in already loaded (by a CLI tool or a browser
 * fetch), matching the calibration/ and animation/ module convention.
 */
import type { Quat } from '../calibration/types.ts';
import { slerp } from '../calibration/math3d.ts';
import type { ReferencePoseMetadata } from '../reference/types.ts';

/** Groups reference poses by sign and sorts each group by frameFraction ascending. */
export function groupKeyframesBySign(poses: ReferencePoseMetadata[]): Map<string, ReferencePoseMetadata[]> {
  const bySign = new Map<string, ReferencePoseMetadata[]>();
  for (const pose of poses) {
    const list = bySign.get(pose.signName) ?? [];
    list.push(pose);
    bySign.set(pose.signName, list);
  }
  for (const [signName, list] of bySign) {
    list.sort((a, b) => a.frameFraction - b.frameFraction);
    const fractions = list.map((p) => p.frameFraction);
    const duplicate = fractions.find((f, i) => fractions.indexOf(f) !== i);
    if (duplicate !== undefined) {
      throw new Error(
        `Sign "${signName}" has two reference poses at the same frameFraction=${duplicate} — ambiguous, ` +
          `cannot interpolate. Give each keyframe a distinct frameFraction.`
      );
    }
  }
  return bySign;
}

function quatFromTuple(t: [number, number, number, number]): Quat {
  return { x: t[0], y: t[1], z: t[2], w: t[3] };
}

/**
 * Interpolated rotation for one bone at normalized time `t` (0..1), given keyframes already sorted
 * by frameFraction. Returns `null` — never an invented/guessed rotation — when the bone isn't
 * captured by the keyframe(s) that bracket `t` (Appendix A Rule 2: never invent missing information).
 */
export function interpolateBoneRotation(sortedKeyframes: ReferencePoseMetadata[], boneName: string, t: number): Quat | null {
  if (sortedKeyframes.length === 0) return null;
  const tc = Math.min(1, Math.max(0, t));

  if (tc <= sortedKeyframes[0].frameFraction) {
    const pose = sortedKeyframes[0].bones[boneName];
    return pose ? quatFromTuple(pose.rotation) : null;
  }
  const last = sortedKeyframes[sortedKeyframes.length - 1];
  if (tc >= last.frameFraction) {
    const pose = last.bones[boneName];
    return pose ? quatFromTuple(pose.rotation) : null;
  }

  for (let i = 0; i < sortedKeyframes.length - 1; i++) {
    const kA = sortedKeyframes[i];
    const kB = sortedKeyframes[i + 1];
    if (tc < kA.frameFraction || tc > kB.frameFraction) continue;
    const poseA = kA.bones[boneName];
    const poseB = kB.bones[boneName];
    if (!poseA || !poseB) return null; // can't interpolate a bone only one side of the bracket captured
    const span = kB.frameFraction - kA.frameFraction;
    const localT = span <= 1e-9 ? 0 : (tc - kA.frameFraction) / span;
    return slerp(quatFromTuple(poseA.rotation), quatFromTuple(poseB.rotation), localT);
  }
  return null; // unreachable given the clamps above, but never silently fall through
}

/**
 * Builds a full per-frame animation for one sign's keyframes. `frameCount` is a sampling resolution
 * choice (not derived from the keyframes themselves, which carry no duration) — callers pick it.
 * Each frame includes every bone captured by ANY of the keyframes; a bone missing from the specific
 * bracket for a given frame is simply omitted from that frame's map (never invented) rather than
 * defaulting to identity/rest, so a caller applying this animation leaves that bone untouched.
 */
export function buildKeyframeAnimation(sortedKeyframes: ReferencePoseMetadata[], frameCount: number): Record<string, Quat>[] {
  if (sortedKeyframes.length < 2) {
    throw new Error(`buildKeyframeAnimation needs >=2 keyframes to interpolate between; got ${sortedKeyframes.length}.`);
  }
  const boneNames = new Set<string>();
  for (const kf of sortedKeyframes) for (const name of Object.keys(kf.bones)) boneNames.add(name);

  const frames: Record<string, Quat>[] = [];
  const n = Math.max(frameCount, 2);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const frame: Record<string, Quat> = {};
    for (const boneName of boneNames) {
      const q = interpolateBoneRotation(sortedKeyframes, boneName, t);
      if (q) frame[boneName] = q;
    }
    frames.push(frame);
  }
  return frames;
}
