/**
 * Reference Pose System — shared types (spec: docs/REFERENCE_POSE_SPEC.md).
 *
 * A "reference pose" is a hand-posed Blender snapshot of the avatar, exported as a GLB and reduced
 * to per-bone local rotation/translation. It is GROUND TRUTH for one specific moment of one sign —
 * never invented, never solved, just read directly off the rig a human posed. The engine's solver
 * output is compared against this numerically (angular error in degrees, positional error in
 * meters), replacing "does it look right" with a real regression oracle. This is a PERMANENT
 * subsystem, not scoped to Milestone 5 — designed to hold hundreds of poses across many signs.
 */
/** One bone's pose, read directly from the posed GLB — never derived or guessed. */
export interface ReferenceBonePose {
  rotation: [number, number, number, number]; // local quaternion (x,y,z,w)
  translation: [number, number, number]; // local translation, meters
}

/**
 * `frameFraction` is REQUIRED, not defaulted: it says which point (0..1) along the sign's authored
 * timeline (signPaths.ts) this static pose represents (e.g. 1.0 = the final/outward moment of
 * HELLO's wave). There is no way to infer this from the GLB alone — per Appendix A Rule 2 ("never
 * invent missing information"), the human who posed it must state it explicitly.
 */
export interface ReferencePoseMetadata {
  poseId: string; // e.g. "HELLO" or "HELLO_key1" for multi-keyframe signs later
  signName: string; // must match a key in animation/signPaths.ts SIGN_PATHS
  frameFraction: number; // 0..1
  sourceGlb: string; // relative path under reference_poses/glb/
  avatarVersion: string; // must match CalibrationProfile.avatarVersion for the rig this was posed on
  generatorVersion: string;
  extractedAt: string; // ISO timestamp
  notes?: string;
  bones: Record<string, ReferenceBonePose>;
}

/** Auto-maintained by extractReferencePose.ts — lets the browser viewer discover poses without a directory listing. */
export interface ReferencePoseIndex {
  poses: string[]; // poseIds, matching metadata/<poseId>.json
  updatedAt: string;
}

export interface BoneComparison {
  boneName: string;
  status: 'ok' | 'over_threshold' | 'unsolved';
  angularErrorDeg: number | null; // null when unsolved
}

export interface PositionalComparison {
  label: string; // e.g. "right wrist", "right elbow"
  errorMeters: number;
}

export interface ReferencePoseComparisonResult {
  poseId: string;
  signName: string;
  frameFraction: number;
  frameIndex: number;
  bones: BoneComparison[];
  positions: PositionalComparison[];
  pass: boolean;
  angularThresholdDeg: number;
  positionThresholdMeters: number;
}
