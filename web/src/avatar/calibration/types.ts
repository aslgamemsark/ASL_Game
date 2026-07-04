/** Shared types for the Avatar Engine's calibration/discovery layer. */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** One bone's full rest-pose description, as discovered from the GLB — Spec Ch.3 "Required Information". */
export interface BoneInfo {
  name: string;
  nodeIndex: number;
  parent: string | null;
  children: string[];
  /** Local (parent-relative) rest transform, taken directly from the glTF node. */
  localPosition: Vec3;
  localRotation: Quat;
  localScale: Vec3;
  /** World-space rest position, computed via forward kinematics from the root. */
  worldPosition: Vec3;
  /** Distance from this bone to its primary child (first child in the skin joint list), if any. */
  length: number | null;
}

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
export type HandSide = 'left' | 'right';

/** A finger's bone chain, ordered root-to-tip. 3-4 entries depending on whether a tip bone exists. */
export type FingerChain = string[];

export interface HandChains {
  hand: string | null;
  fingers: Partial<Record<FingerName, FingerChain>>;
}

export interface ArmChain {
  shoulder: string | null;
  upperArm: string | null;
  forearm: string | null;
  hand: string | null;
}

export interface AvatarHierarchy {
  /** Source file this was discovered from, for traceability (spec Ch.2 "Versioning"). */
  sourceFile: string;
  generatedAt: string;
  totalNodes: number;
  totalBones: number;
  /** All discovered bones, keyed by name. */
  bones: Record<string, BoneInfo>;
  /** Root bone name (the skeleton's top-level ancestor, e.g. Hips). */
  root: string | null;
  arms: Record<HandSide, ArmChain>;
  hands: Record<HandSide, HandChains>;
  spine: string[];
  head: string | null;
  /** Names that look bone-like but didn't match any known anatomical pattern — surfaced, not hidden. */
  unclassified: string[];
  warnings: string[];
}

/**
 * One bone's calibration data. Keyed PER CHILD, not a single "primary child" — a bone like Hand has
 * 5 children (one per finger) and each needs its own rest direction; collapsing to "first child
 * only" silently loses data for every other finger. (This is exactly the kind of bug the spec's
 * Stage-8 round-trip validation exists to catch — see CalibrationValidator.ts.)
 */
export interface BoneCalibration {
  name: string;
  /**
   * Unit direction from this bone to EACH child, expressed in THIS bone's own local space, keyed by
   * child bone name. Exactly `normalize(child.localPosition)` per child — glTF already expresses a
   * child's translation relative to its parent, so this is read directly from the rest pose, never
   * invented. Empty for leaf bones (fingertips), which have no children.
   */
  restChildDirections: Record<string, Vec3>;
  /**
   * Local-space (parent-relative, PRE-ARMATURE-SCALE) distance to each child — pairs with the
   * direction above for round-trip reconstruction (CalibrationValidator composes it back through a
   * full parent-to-root FK chain, which is what reintroduces any ancestor scale correctly).
   *
   * DO NOT use this as a world-space/meters length (e.g. for 2-bone IK segment lengths, or any other
   * world-space math). On a Mixamo rig the whole skeleton's cm->m conversion lives in a non-joint
   * "Armature" ancestor scale (commonly 0.01) that only gets baked into the ROOT bone's own local
   * fields (see SkeletonInspector's "parentIsJoint" bake) — every other bone's restChildLengths is
   * still expressed in that PRE-scale unit system and will be off by ~1/scale (~100x for a 0.01
   * armature). This was the exact root cause of a real M5 bug: the arm IK read this field directly
   * as meters, producing an elbow ~100x too far from the shoulder while the hand still landed exactly
   * on target (the hand-position formula is a self-consistent identity that doesn't care how wrong
   * the elbow is) — 0.00mm "PASS" on a visibly broken pose. For real-world lengths, use
   * `distance(hierarchy.bones[a].worldPosition, hierarchy.bones[b].worldPosition)` instead — the
   * world positions are already correctly scaled and validated by M1/M2's round-trip check.
   */
  restChildLengths: Record<string, number>;
}

export interface HandCalibration {
  /**
   * The palm normal direction at rest, expressed in the Hand bone's own local space. Computed from
   * index1/pinky1 rest positions (knuckle line) crossed with the index1 direction (palm-forward) —
   * see spec Ch.5/6 "Palm Orientation: construct a plane from Wrist, Index MCP, Pinky MCP." Used by
   * the Finger Solver (M6) to know how much to roll the Hand bone so the palm faces a measured
   * target direction.
   */
  palmRestNormalLocal: Vec3 | null;
  /** Distance between the wrist-side shoulder/arm bones — the scale unit M5's arm IK targets use. */
}

/**
 * Calibration is performed ONCE per avatar and is pure analysis of the rest pose already captured
 * in AvatarHierarchy — spec Ch.7: "calibration happens once; animation uses it forever." Every
 * field here is DERIVED from data already in the GLB (Appendix A Rule 2: "never invent missing
 * information") — nothing is guessed.
 *
 * Deliberately NOT included (see `notes` for why): per-bone "roll offset" / axis-twist correction.
 * The retargeting approach this engine uses (minimal/shortest-arc rotation from a calibrated rest
 * direction to a measured target direction) never needs to know a bone's twist around its own
 * length axis — and that twist is exactly the "unobservable from a single RGB camera" rotation
 * Appendix A Rule 3 says must never be invented. If a future milestone's math needs it, it should
 * be added here explicitly and documented, not silently assumed to be zero.
 */
export interface CalibrationProfile {
  avatarVersion: string; // content hash of the source GLB bytes, for traceability (spec Ch.2 Versioning)
  generatorVersion: string;
  generatedAt: string;
  sourceFile: string;
  shoulderWidthMeters: number;
  bones: Record<string, BoneCalibration>;
  hands: Record<HandSide, HandCalibration>;
  notes: string[];
}

export interface CalibrationValidation {
  pass: boolean;
  maxPositionErrorMeters: number;
  boneCount: number;
  details: string[];
}
