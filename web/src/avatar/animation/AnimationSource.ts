/**
 * AnimationSource — an ORDERED PRIORITY CHAIN of animation resolvers for a sign, not a two-way
 * switch. Each resolver either produces an animation or declines (returns null), so the next one in
 * the chain is tried:
 *
 *   KeyframeAnimator (preferred — >=2 human-posed Blender references exist for this sign)
 *   -> ProceduralIK   (fallback — signPaths.ts body-frame offsets + 2-bone IK)
 *
 * A future MotionCapture source is added the same way: write one more resolver function and append
 * it to the chain — KeyframeAnimator and ProceduralIK never change.
 */
import type { AvatarHierarchy, CalibrationProfile, Quat } from '../calibration/types.ts';
import { buildKeyframeAnimation, groupKeyframesBySign } from './KeyframeAnimator.ts';
import { retargetSign, type SignRetargetResult } from './ArmRetargeter.ts';
import { SIGN_PATHS } from './signPaths.ts';
import type { ReferencePoseMetadata } from '../reference/types.ts';

/** Sampling resolution for a keyframe-only sign (no signPaths.ts entry to borrow an fps/duration from). */
const DEFAULT_KEYFRAME_FRAME_COUNT = 30;
const DEFAULT_KEYFRAME_FPS = 30;

export interface AnimationSourceResult {
  signName: string;
  source: 'keyframe' | 'procedural';
  fps: number;
  frameCount: number;
  /** Per frame: bone name -> local rotation. Only bones this source actually computed are present —
   *  a bone absent from a frame should be left at whatever pose it already has (never invented). */
  frames: Record<string, Quat>[];
  /** Only set when source === 'procedural' — the full IK solve (elbow/shoulder/error), used by
   *  debug viewers that visualize the IK triangle. Keyframe-driven output has no such detail: there's
   *  no target to solve for, the human already posed the joint angles. */
  proceduralDetail?: SignRetargetResult;
}

interface ResolveContext {
  hierarchy: AvatarHierarchy;
  calibration: CalibrationProfile;
  signName: string;
  availablePoses: ReferencePoseMetadata[];
  frameCount?: number;
}

export type AnimationResolver = (ctx: ResolveContext) => AnimationSourceResult | null;

export const keyframeResolver: AnimationResolver = (ctx) => {
  const grouped = groupKeyframesBySign(ctx.availablePoses).get(ctx.signName);
  if (!grouped || grouped.length < 2) return null; // 0 or 1 pose: not enough to interpolate, decline
  const frameCount = ctx.frameCount ?? DEFAULT_KEYFRAME_FRAME_COUNT;
  const frames = buildKeyframeAnimation(grouped, frameCount);
  return { signName: ctx.signName, source: 'keyframe', fps: DEFAULT_KEYFRAME_FPS, frameCount, frames };
};

export const proceduralIKResolver: AnimationResolver = (ctx) => {
  if (!(ctx.signName in SIGN_PATHS)) return null; // no authored body-frame path either — decline
  const result = retargetSign(ctx.hierarchy, ctx.calibration, ctx.signName as keyof typeof SIGN_PATHS);
  const chainR = ctx.hierarchy.arms.right;
  const chainL = ctx.hierarchy.arms.left;
  const frames: Record<string, Quat>[] = result.frames.map((f) => {
    const bones: Record<string, Quat> = {};
    if (chainR.upperArm) bones[chainR.upperArm] = f.right.upperArmLocalRotation;
    if (chainR.forearm) bones[chainR.forearm] = f.right.forearmLocalRotation;
    if (f.left) {
      if (chainL.upperArm) bones[chainL.upperArm] = f.left.upperArmLocalRotation;
      if (chainL.forearm) bones[chainL.forearm] = f.left.forearmLocalRotation;
    }
    return bones;
  });
  return { signName: ctx.signName, source: 'procedural', fps: result.fps, frameCount: frames.length, frames, proceduralDetail: result };
};

/** The chain, in priority order. Exported so a future MotionCapture resolver can be appended without touching this file's callers. */
export const DEFAULT_ANIMATION_SOURCE_CHAIN: AnimationResolver[] = [keyframeResolver, proceduralIKResolver];

export function resolveAnimationForSign(
  hierarchy: AvatarHierarchy,
  calibration: CalibrationProfile,
  signName: string,
  availablePoses: ReferencePoseMetadata[],
  options?: { frameCount?: number; sourceChain?: AnimationResolver[] }
): AnimationSourceResult {
  const ctx: ResolveContext = { hierarchy, calibration, signName, availablePoses, frameCount: options?.frameCount };
  for (const resolver of options?.sourceChain ?? DEFAULT_ANIMATION_SOURCE_CHAIN) {
    const result = resolver(ctx);
    if (result) return result;
  }
  throw new Error(`No animation source available for sign "${signName}" — no keyframe poses and no procedural (signPaths.ts) entry.`);
}
