/**
 * Reference Pose System — pure data logic (no file I/O, no DOM/Node dependency — runs identically in
 * the browser AvatarLab viewer and in Node CLI tools, matching the calibration/ module convention).
 */
import type { AvatarHierarchy } from '../calibration/types.ts';
import type { ReferenceBonePose } from './types.ts';

/**
 * Reads every bone's CURRENT local rotation/translation straight off a posed AvatarHierarchy (built
 * from a posed GLB via the same buildHierarchy() used by Milestone 1 — no separate parsing path, so
 * a posed export is read exactly as reliably as the rest-pose one). Nothing here is derived —
 * it's a direct field copy, which is the whole point of a ground-truth reference.
 */
export function extractPoseFromHierarchy(hierarchy: AvatarHierarchy): Record<string, ReferenceBonePose> {
  const bones: Record<string, ReferenceBonePose> = {};
  for (const [name, bone] of Object.entries(hierarchy.bones)) {
    bones[name] = {
      rotation: [bone.localRotation.x, bone.localRotation.y, bone.localRotation.z, bone.localRotation.w],
      translation: [bone.localPosition.x, bone.localPosition.y, bone.localPosition.z],
    };
  }
  return bones;
}
