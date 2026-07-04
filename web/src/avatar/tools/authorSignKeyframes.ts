#!/usr/bin/env node
/**
 * Reference Pose System — CODE-AUTHORED keyframes (the "Claude authors a sign" experiment).
 *
 * Third way to produce reference poses, alongside extractReferencePose.ts (static Blender pose) and
 * extractBakedAnimation.ts (baked Blender clip): keyframes are authored HERE as anatomical intent
 * (wrist targets measured off the rig's own chin/chest positions, palm roll, wrist flexion), solved
 * into bone rotations by the SAME validated 2-bone IK the procedural path uses, then FK-VERIFIED
 * (wrist really lands on target, palm normal really points where intended) before anything is
 * written. Output is ordinary ReferencePoseMetadata, so KeyframeAnimator/AnimationSource consume it
 * with zero changes — and a later human-authored Blender clip for the same sign simply REPLACES
 * these files (delete + re-extract), no code involved.
 *
 * Every keyframe below is a hypothesis about how the sign looks; the human eye in AvatarLab is the
 * final judge. FK numbers printed by --verify only guarantee the pose is self-consistent and
 * anatomically plausible, not that it reads as natural ASL.
 *
 * Usage:
 *   npx tsx src/avatar/tools/authorSignKeyframes.ts THANK_YOU            (verify only, prints FK report)
 *   npx tsx src/avatar/tools/authorSignKeyframes.ts THANK_YOU --write    (verify, then write metadata)
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import type { AvatarHierarchy, HandSide, Quat, Vec3 } from '../calibration/types.ts';
import {
  add, cross, distance, dot, fromTRS, getTranslation, multiply, normalize, quatIdentity,
  quatInvert, quatMultiply, rotateVec3, scale, subtract,
} from '../calibration/math3d.ts';
import type { Mat4 } from '../calibration/math3d.ts';
import { computeBodyFrame, targetWorld } from '../animation/BodyFrame.ts';
import { poseArm } from '../animation/ArmRetargeter.ts';
import { SIGN_PATHS } from '../animation/signPaths.ts';
import type { ReferencePoseIndex, ReferencePoseMetadata } from '../reference/types.ts';

// ---------------------------------------------------------------------------------------------
// Authored sign specs. Offsets are body-frame, in shoulder-width units, anchored to a named bone
// (same convention as signPaths.ts), so they scale to any avatar. Angles are degrees.
// Sign conventions were established EMPIRICALLY from this tool's FK readout, not assumed:
//   forearmRollDeg: negative = supination for the RIGHT arm (palm normal swings toward frame.up).
//                   The LEFT arm mirrors — tune per-keyframe against the printed palm normal.
//   wristFlexDeg:   negative tilts fingertips up (about the body-frame right axis).
// ---------------------------------------------------------------------------------------------

interface ArmKeyframeSpec {
  /** Wrist target = anchor bone's rest world position + body-frame offset * shoulderWidth. Ignored
   * when `centroidRelativeToOtherHand` is set — see below. */
  anchor: string;
  offset: Vec3;
  forearmRollDeg: number;
  wristFlexDeg: number;
  /** 'fist' curls every finger joint (S-handshape); omitted/'flat' leaves fingers at rest. */
  handshape?: 'fist' | 'flat';
  /**
   * Fix for defect #3 (COFFEE's circle centered wrist-over-wrist instead of knuckles-over-knuckles):
   * when set, `offset` is instead the body-frame offset (shoulder-width units) from the OTHER
   * hand's ALREADY-SOLVED KNUCKLE CENTROID to THIS hand's desired knuckle centroid — `anchor` is
   * unused. The main authoring loop processes 'left' before 'right' each keyframe so this can be
   * set on the right (dominant) hand referencing the left. Solved via iterative refinement
   * (solveArmForCentroidTarget) since the wrist-to-centroid offset depends on hand orientation.
   */
  centroidRelativeToOtherHand?: boolean;
}

interface AuthoredKeyframe {
  frameFraction: number;
  arms: Partial<Record<HandSide, ArmKeyframeSpec>>;
  notes: string;
}

interface AuthoredSign {
  signName: string;
  poseIdPrefix: string;
  keyframes: AuthoredKeyframe[];
}

/**
 * COFFEE's circling dominant fist: the RIGHT hand's KNUCKLE CENTROID (not wrist — defect #3 fix)
 * traces a horizontal circle directly above the LEFT hand's (stationary) knuckle centroid.
 */
function coffeeCircleKf(fraction: number, angleDeg: number): AuthoredKeyframe {
  const a = (angleDeg * Math.PI) / 180;
  const r = 0.16; // circle radius, shoulder-width units, measured around the left knuckle centroid
  return {
    frameFraction: fraction,
    arms: {
      left: {
        anchor: 'Spine2',
        offset: { x: -0.06, y: -0.62, z: 0.78 },
        forearmRollDeg: 20, // bottom fist rolled so the palm faces the signer's right (thumb up)
        wristFlexDeg: 0,
        handshape: 'fist',
      },
      right: {
        anchor: '', // unused — centroidRelativeToOtherHand below overrides targeting
        // Offset is from the LEFT hand's knuckle centroid: raised ~0.35SW, circling radius r.
        offset: { x: r * Math.cos(a), y: 0.35, z: r * Math.sin(a) },
        forearmRollDeg: 35, // grinding fist angled palm-down-left, like gripping a crank knob
        wristFlexDeg: 20, // knuckles angled slightly down over the bottom fist
        handshape: 'fist',
        centroidRelativeToOtherHand: true,
      },
    },
    notes: `Dominant fist's knuckles circling over the stationary non-dominant fist's knuckles (${angleDeg}deg around the circle).`,
  };
}

const AUTHORED_SIGNS: Record<string, AuthoredSign> = {
  // THANK_YOU: flat dominant hand, fingertips at the chin, palm toward the face; the hand arcs
  // forward and down toward the listener, finishing in front of the chest, palm up.
  THANK_YOU: {
    signName: 'THANK_YOU',
    poseIdPrefix: 'THANKYOU_auth',
    keyframes: [
      {
        frameFraction: 0.0,
        arms: {
          right: { anchor: 'Head', offset: { x: 0.12, y: -0.45, z: 0.36 }, forearmRollDeg: -70, wristFlexDeg: -15 },
        },
        notes: 'Fingertips at chin, palm toward face.',
      },
      {
        frameFraction: 0.2,
        arms: {
          right: { anchor: 'Head', offset: { x: 0.12, y: -0.45, z: 0.36 }, forearmRollDeg: -70, wristFlexDeg: -15 },
        },
        notes: 'Brief hold at the chin before the outward arc.',
      },
      {
        frameFraction: 0.6,
        arms: {
          right: { anchor: 'Head', offset: { x: 0.16, y: -0.75, z: 0.75 }, forearmRollDeg: -40, wristFlexDeg: 0 },
        },
        notes: 'Mid-arc: hand moving forward and down, palm rotating up.',
      },
      {
        frameFraction: 1.0,
        arms: {
          right: { anchor: 'Head', offset: { x: 0.24, y: -1.0, z: 1.12 }, forearmRollDeg: -110, wristFlexDeg: 0 },
        },
        notes: 'Arm extended toward the listener, palm up — offering the thanks.',
      },
    ],
  },

  // COFFEE: non-dominant S-hand (left fist) stationary at lower-chest height; dominant S-hand
  // (right fist) rests just above it and grinds in a horizontal circle — like cranking a coffee
  // mill. One full circle across the clip (start angle = end angle, so looping playback is smooth).
  COFFEE: {
    signName: 'COFFEE',
    poseIdPrefix: 'COFFEE_auth',
    keyframes: [
      coffeeCircleKf(0.0, 0),
      coffeeCircleKf(0.2, 72),
      coffeeCircleKf(0.4, 144),
      coffeeCircleKf(0.6, 216),
      coffeeCircleKf(0.8, 288),
      coffeeCircleKf(1.0, 360),
    ],
  },

  // YES: dominant S-hand held in front of the shoulder, "nodding" at the wrist (flex down, back up,
  // down again) — the arm itself barely moves; the motion is all wrist flexion.
  YES: {
    signName: 'YES',
    poseIdPrefix: 'YES_auth',
    keyframes: [
      {
        frameFraction: 0.0,
        arms: {
          right: { anchor: 'RightArm', offset: { x: 0.05, y: -0.45, z: 0.85 }, forearmRollDeg: -20, wristFlexDeg: -20, handshape: 'fist' },
        },
        notes: 'Fist up in front of the shoulder, wrist neutral-extended.',
      },
      {
        frameFraction: 0.25,
        arms: {
          right: { anchor: 'RightArm', offset: { x: 0.05, y: -0.48, z: 0.85 }, forearmRollDeg: -20, wristFlexDeg: 40, handshape: 'fist' },
        },
        notes: 'First nod: wrist flexed down.',
      },
      {
        frameFraction: 0.5,
        arms: {
          right: { anchor: 'RightArm', offset: { x: 0.05, y: -0.45, z: 0.85 }, forearmRollDeg: -20, wristFlexDeg: -20, handshape: 'fist' },
        },
        notes: 'Back up between nods.',
      },
      {
        frameFraction: 0.75,
        arms: {
          right: { anchor: 'RightArm', offset: { x: 0.05, y: -0.48, z: 0.85 }, forearmRollDeg: -20, wristFlexDeg: 40, handshape: 'fist' },
        },
        notes: 'Second nod: wrist flexed down.',
      },
      {
        frameFraction: 1.0,
        arms: {
          right: { anchor: 'RightArm', offset: { x: 0.05, y: -0.45, z: 0.85 }, forearmRollDeg: -20, wristFlexDeg: -20, handshape: 'fist' },
        },
        notes: 'Wrist back up — sign complete.',
      },
    ],
  },
};

// ---------------------------------------------------------------------------------------------

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function axisAngleQuat(axis: Vec3, deg: number): Quat {
  const a = normalize(axis);
  const half = (deg * Math.PI) / 360;
  const s = Math.sin(half);
  return { x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(half) };
}

function restWorldQuat(hierarchy: AvatarHierarchy, boneName: string | null): Quat {
  if (!boneName) return quatIdentity();
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

const [signArg, writeFlag] = process.argv.slice(2);
if (!signArg) fail(`Usage: authorSignKeyframes.ts <signName> [--write]\nAuthored signs: ${Object.keys(AUTHORED_SIGNS).join(', ')}`);
const spec = AUTHORED_SIGNS[signArg];
if (!spec) fail(`No authored keyframes for "${signArg}". Available: ${Object.keys(AUTHORED_SIGNS).join(', ')}`);
if (!(spec.signName in SIGN_PATHS)) {
  // Not fatal: keyframe-driven signs don't need a procedural path — AnimationSource's keyframe
  // resolver works for any sign with >=2 poses. The sign just won't have an IK fallback.
  console.log(`note: "${spec.signName}" has no SIGN_PATHS entry — keyframes will be its ONLY animation source.\n`);
}
const doWrite = writeFlag === '--write';

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
const SOURCE_DIR = resolve(REPO_ROOT, 'reference_poses');
const PUBLIC_DIR = resolve(import.meta.dirname, '../../../public/reference_poses');
const REST_RIG_PATH = resolve(import.meta.dirname, '../../../public/models/avatar/ybot.glb');

const raw = readFileSync(REST_RIG_PATH);
const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
const hierarchy = buildHierarchy(parseGlb(buffer).json, REST_RIG_PATH);
const calibration = buildCalibration(hierarchy, buffer);
const frame = computeBodyFrame(hierarchy);

console.log(`Authoring "${spec.signName}" (${spec.keyframes.length} keyframes) on ${hierarchy.sourceFile}`);
console.log(`Body frame: right=(${frame.right.x.toFixed(2)},${frame.right.y.toFixed(2)},${frame.right.z.toFixed(2)}) shoulderWidth=${frame.shoulderWidth.toFixed(3)}m\n`);

interface BuiltKeyframe {
  kf: AuthoredKeyframe;
  bones: ReferencePoseMetadata['bones'];
}

/** Mean world position of the 4 non-thumb MCP joints. Independent of finger CURL (a bone's own
 * rotation never affects its own translation, only its children's), so this can be measured from
 * an arm-only override map (no finger rotations needed) — used both to author and to verify
 * two-handed alignment (fix for defect #3: wrist-to-wrist alignment ignored knuckle offset). */
function knuckleCentroid(side: HandSide, armOnlyBones: Record<string, Quat>, cache: Map<string, Mat4>): Vec3 {
  const fingers = hierarchy.hands[side]?.fingers ?? {};
  const mcpNames = (['index', 'middle', 'ring', 'pinky'] as const).map((f) => fingers[f]?.[0]).filter((n): n is string => !!n);
  if (mcpNames.length !== 4) fail(`${side} hand: expected 4 non-thumb MCP joints, found ${mcpNames.length}.`);
  const positions = mcpNames.map((n) => getTranslation(worldMatrixWithOverrides(hierarchy, n, armOnlyBones, cache)));
  return scale(
    positions.reduce((acc, p) => add(acc, p), { x: 0, y: 0, z: 0 }),
    1 / positions.length
  );
}

/** Solves one arm to an EXPLICIT world-space wrist target (core IK+roll+flex, factored out so
 * COFFEE's centroid-targeting can iterate on the wrist target without re-deriving anchor/offset). */
function solveArmForWristTarget(
  side: HandSide,
  targetW: Vec3,
  forearmRollDeg: number,
  wristFlexDeg: number,
  handshape: 'fist' | 'flat' | undefined
): { bones: Record<string, Quat>; wristFk: Vec3; wristErr: number; elbowY: number; shoulderY: number } {
  const chain = hierarchy.arms[side];
  if (!chain.upperArm || !chain.forearm || !chain.hand) fail(`${side} arm chain incomplete.`);
  const armName = chain.upperArm;
  const foreName = chain.forearm;
  const handName = chain.hand;

  const pose = poseArm(hierarchy, calibration, frame, side, targetW);

  const armParentWorld = restWorldQuat(hierarchy, hierarchy.bones[armName].parent);
  const armWorld = quatMultiply(armParentWorld, pose.upperArmLocalRotation);
  const forearmAxisWorld = normalize(subtract(pose.achievedHandWorld, pose.elbowWorld));

  const rollQuat = axisAngleQuat(forearmAxisWorld, -forearmRollDeg);
  const foreWorld0 = quatMultiply(armWorld, pose.forearmLocalRotation);
  const foreWorld = quatMultiply(rollQuat, foreWorld0);
  const foreLocal = quatMultiply(quatInvert(armWorld), foreWorld);

  const flexQuat = axisAngleQuat(frame.right, -wristFlexDeg);
  const handWorld0 = quatMultiply(foreWorld, hierarchy.bones[handName].localRotation);
  const handWorld = quatMultiply(flexQuat, handWorld0);
  const handLocal = quatMultiply(quatInvert(foreWorld), handWorld);

  const bones: Record<string, Quat> = {
    [armName]: pose.upperArmLocalRotation,
    [foreName]: foreLocal,
    [handName]: handLocal,
  };
  const cache = new Map<string, Mat4>();
  const wristFk = getTranslation(worldMatrixWithOverrides(hierarchy, handName, bones, cache));
  if (handshape === 'fist') Object.assign(bones, buildFist(side));

  return { bones, wristFk, wristErr: distance(wristFk, targetW), elbowY: pose.elbowWorld.y, shoulderY: hierarchy.bones[armName].worldPosition.y };
}

/** Iterates the wrist target so the hand's KNUCKLE CENTROID (not the wrist) lands on
 * `desiredCentroidW` — fix for defect #3. Converges in <=3 iterations since the wrist->centroid
 * offset only drifts slightly as the forearm's solved direction shifts with the target. */
function solveArmForCentroidTarget(
  side: HandSide,
  desiredCentroidW: Vec3,
  forearmRollDeg: number,
  wristFlexDeg: number,
  handshape: 'fist' | 'flat' | undefined
): ReturnType<typeof solveArmForWristTarget> & { centroidW: Vec3; centroidErrMm: number } {
  let guessTarget = desiredCentroidW;
  let result = solveArmForWristTarget(side, guessTarget, forearmRollDeg, wristFlexDeg, handshape);
  let centroidW = knuckleCentroid(side, result.bones, new Map());
  for (let i = 0; i < 4; i++) {
    const err = subtract(desiredCentroidW, centroidW);
    if (vecLen(err) < 0.0005) break;
    guessTarget = add(guessTarget, err);
    result = solveArmForWristTarget(side, guessTarget, forearmRollDeg, wristFlexDeg, handshape);
    centroidW = knuckleCentroid(side, result.bones, new Map());
  }
  return { ...result, centroidW, centroidErrMm: distance(centroidW, desiredCentroidW) * 1000 };
}

function vecLen(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/** Builds the FK report string shared by both authoring paths (wrist target / centroid target). */
function reportFor(side: HandSide, solved: { bones: Record<string, Quat>; wristFk: Vec3; wristErr: number; elbowY: number; shoulderY: number }, handshape: 'fist' | 'flat' | undefined): { report: string; sane: boolean } {
  const cache = new Map<string, Mat4>();
  const { bones, wristFk, wristErr, elbowY, shoulderY } = solved;

  const fingers = hierarchy.hands[side]?.fingers ?? {};
  const indexMcp = fingers['index']?.[0];
  const pinkyMcp = fingers['pinky']?.[0];
  const middleMcp = fingers['middle']?.[0];
  let palmReport = 'palm: (finger bones not discovered)';
  let palmN: Vec3 | null = null;
  if (indexMcp && pinkyMcp && middleMcp) {
    const iPos = getTranslation(worldMatrixWithOverrides(hierarchy, indexMcp, bones, cache));
    const pPos = getTranslation(worldMatrixWithOverrides(hierarchy, pinkyMcp, bones, cache));
    const mPos = getTranslation(worldMatrixWithOverrides(hierarchy, middleMcp, bones, cache));
    const va = subtract(iPos, wristFk);
    const vb = subtract(pPos, wristFk);
    palmN = normalize(side === 'right' ? cross(va, vb) : cross(vb, va));
    const fingerDir = normalize(subtract(mPos, wristFk));
    palmReport =
      `palm up=${dot(palmN, frame.up).toFixed(2)} fwd=${dot(palmN, frame.forward).toFixed(2)} rt=${dot(palmN, frame.right).toFixed(2)} | ` +
      `fingers up=${dot(fingerDir, frame.up).toFixed(2)} fwd=${dot(fingerDir, frame.forward).toFixed(2)}`;
  }

  // Defect #2 fix: enumerate EVERY finger by name (not just middle) and FAIL LOUDLY if any of the
  // 5 expected chains is missing or didn't actually curl (tip did not move toward the palm side).
  let fistLines = '';
  let fistSane = true;
  if (handshape === 'fist') {
    const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;
    const chains = fingerNames.map((n) => hierarchy.hands[side]?.fingers[n]);
    const missing = fingerNames.filter((_, i) => !chains[i] || chains[i]!.length === 0);
    if (missing.length > 0) fail(`${side} hand: fist requested but chain(s) missing for: ${missing.join(', ')}.`);
    const rows: string[] = [];
    for (let i = 0; i < fingerNames.length; i++) {
      const chain = chains[i]!;
      const mcp = chain[0];
      const tip = chain[chain.length - 1];
      const mcpPos = getTranslation(worldMatrixWithOverrides(hierarchy, mcp, bones, cache));
      const tipPos = getTranslation(worldMatrixWithOverrides(hierarchy, tip, bones, cache));
      const tipToMcp = distance(tipPos, mcpPos) * 1000;
      const sideOfPalm = palmN ? dot(subtract(tipPos, mcpPos), palmN) : NaN;
      const curled = palmN ? sideOfPalm < 0 : tipToMcp < 60; // fallback if palm normal unavailable
      fistSane &&= curled;
      rows.push(`${fingerNames[i].padEnd(6)} tip->mcp=${tipToMcp.toFixed(0)}mm palmSide=${sideOfPalm.toFixed(3)} ${curled ? 'curled' : 'NOT-CURLED'}`);
    }
    fistLines = '\n        ' + rows.join('\n        ');
  }

  const sane = wristErr < 0.02 && elbowY < shoulderY + 0.02 && fistSane;
  const report =
    `${side.padEnd(5)} wrist err=${(wristErr * 1000).toFixed(1)}mm  elbow y=${elbowY.toFixed(3)} (shoulder ${shoulderY.toFixed(3)})  ${sane ? 'OK' : 'SUSPECT'}\n` +
    `        wrist=(${wristFk.x.toFixed(3)}, ${wristFk.y.toFixed(3)}, ${wristFk.z.toFixed(3)})  ${palmReport}${fistLines}`;
  return { report, sane };
}

/**
 * Local rotations that curl one hand into an S-handshape (fist).
 *
 * Defect #1 fix: direction is no longer chosen by tip-to-wrist distance (hyperextending a finger
 * backward shortens that distance almost as much as a correct curl does — that's exactly how some
 * fingers ended up bent the wrong way). Direction is now chosen by which sign brings the fingertip
 * to the PALM side of the palm plane: dot(tip - mcp, palmNormal) < 0. Tip-to-mcp distance is still
 * reported as a tightness metric, just never used to pick direction.
 *
 * Defect #1 (thumb specifically): the thumb's CMC/MCP joint does not hinge about the same
 * index-pinky transverse axis as the other four fingers (that axis barely moves it — anatomically
 * the thumb opposes across the palm, not alongside it). It gets its own curl axis: the palm normal
 * itself, which sweeps the thumb across the front of the fist toward the index finger, verified by
 * requiring the thumb tip get closer to the index MCP than the flat-rest thumb tip is.
 */
const fistCache = new Map<HandSide, Record<string, Quat>>();
function buildFist(side: HandSide): Record<string, Quat> {
  const cached = fistCache.get(side);
  if (cached) return cached;

  const hand = hierarchy.hands[side];
  const wristName = hierarchy.arms[side].hand;
  if (!hand || !wristName) fail(`No ${side} hand/finger chains discovered on this rig.`);
  const fingers = hand.fingers;
  const idx = fingers['index']?.[0];
  const pky = fingers['pinky']?.[0];
  if (!idx || !pky) fail(`${side} hand is missing index/pinky chains — cannot derive a curl axis.`);

  const wristRest = hierarchy.bones[wristName].worldPosition;
  const idxRest = hierarchy.bones[idx].worldPosition;
  const pkyRest = hierarchy.bones[pky].worldPosition;
  // Transverse axis (index MCP -> pinky MCP): curl axis for the 4 non-thumb fingers.
  const transverseAxisW = normalize(subtract(pkyRest, idxRest));
  // Palm normal at rest, same side convention as reportFor/buildArm's palm readout.
  const va = subtract(idxRest, wristRest);
  const vb = subtract(pkyRest, wristRest);
  const palmNormalW = normalize(side === 'right' ? cross(va, vb) : cross(vb, va));

  // 70/95/60 measured as near-optimal on this rig: pushing higher (85/105/75) INCREASED middle
  // tip->wrist from 91mm to 101mm — overcurl, fingers spiraling past the palm.
  const CURL_DEG = { finger: [70, 95, 60], thumb: [70, 75, 45] };
  const result: Record<string, Quat> = {};

  for (const [fingerName, chain] of Object.entries(fingers)) {
    if (!chain || chain.length === 0) continue;
    const isThumb = fingerName.toLowerCase().includes('thumb');
    const angles = isThumb ? CURL_DEG.thumb : CURL_DEG.finger;
    const mcpBone = chain[0];
    const tipBone = chain[chain.length - 1];
    const mcpRest = hierarchy.bones[mcpBone].worldPosition;
    // Rotating about palmNormalW itself would be a DEGENERATE test: dot(v, axis) is invariant
    // under rotation about that same axis, so the palm-side direction test could never distinguish
    // the two candidate signs (this was the actual bug — the thumb barely moved because its curl
    // axis and its success metric were the same vector). The thumb's own rest bone direction is
    // NOT parallel to the other fingers (its geometry opposes across the palm), so give it its own
    // axis, perpendicular to palmNormalW by construction, guaranteeing the test is non-degenerate.
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
      // Correct curl (finger and thumb alike) moves the tip to the PALM side of the palm plane
      // passing through this finger's own MCP — never judged by raw distance (see docstring above).
      const sideOfPalm = dot(subtract(tip, mcpRest), palmNormalW);
      if (!best || sideOfPalm < best.sideOfPalm) best = { rotations, sideOfPalm };
    }
    Object.assign(result, best!.rotations);
  }

  fistCache.set(side, result);
  return result;
}

const built: BuiltKeyframe[] = [];
let allSane = true;

for (const kf of spec.keyframes) {
  const bones: ReferencePoseMetadata['bones'] = {};
  const centroids: Partial<Record<HandSide, Vec3>> = {};
  console.log(`kf t=${kf.frameFraction.toFixed(2)}  ${kf.notes}`);
  // 'left' before 'right': centroidRelativeToOtherHand (COFFEE's dominant hand) needs the other
  // side's knuckle centroid already solved this same keyframe.
  for (const side of ['left', 'right'] as HandSide[]) {
    const armSpec = kf.arms[side];
    if (!armSpec) continue;
    const otherSide: HandSide = side === 'right' ? 'left' : 'right';

    let solved: ReturnType<typeof solveArmForWristTarget>;
    let centroidLine = '';
    if (armSpec.centroidRelativeToOtherHand) {
      const otherCentroid = centroids[otherSide];
      if (!otherCentroid) fail(`${side}: centroidRelativeToOtherHand requires "${otherSide}" to be authored first in the same keyframe.`);
      const desiredCentroid = add(
        otherCentroid,
        add(
          scale(frame.right, armSpec.offset.x * frame.shoulderWidth),
          add(scale(frame.up, armSpec.offset.y * frame.shoulderWidth), scale(frame.forward, armSpec.offset.z * frame.shoulderWidth))
        )
      );
      const centroidSolved = solveArmForCentroidTarget(side, desiredCentroid, armSpec.forearmRollDeg, armSpec.wristFlexDeg, armSpec.handshape);
      solved = centroidSolved;
      centroidLine = `\n        knuckle centroid err vs target: ${centroidSolved.centroidErrMm.toFixed(1)}mm`;
    } else {
      const targetW = targetWorld(hierarchy, frame, armSpec.anchor, armSpec.offset);
      solved = solveArmForWristTarget(side, targetW, armSpec.forearmRollDeg, armSpec.wristFlexDeg, armSpec.handshape);
    }

    centroids[side] = knuckleCentroid(side, solved.bones, new Map());
    const { report, sane } = reportFor(side, solved, armSpec.handshape);
    allSane &&= sane;
    console.log(`  ${report}${centroidLine}`);
    for (const [name, rotation] of Object.entries(solved.bones)) {
      const rest = hierarchy.bones[name];
      bones[name] = {
        rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
        translation: [rest.localPosition.x, rest.localPosition.y, rest.localPosition.z],
      };
    }
  }
  built.push({ kf, bones });
}

if (!allSane) fail('One or more keyframes failed FK sanity (wrist off-target or elbow above shoulder). Nothing written.');

if (!doWrite) {
  console.log('\nVerify-only run — pass --write to persist these keyframes as reference poses.');
  process.exit(0);
}

const writtenIds: string[] = [];
for (let i = 0; i < built.length; i++) {
  const { kf, bones } = built[i];
  const poseId = `${spec.poseIdPrefix}_${String(i).padStart(2, '0')}`;
  const metadata: ReferencePoseMetadata = {
    poseId,
    signName: spec.signName,
    frameFraction: kf.frameFraction,
    sourceGlb: '', // no GLB — authored in code; the spec above is the source of truth
    avatarVersion: calibration.avatarVersion,
    generatorVersion: 'authorSignKeyframes@1.1.0',
    extractedAt: new Date().toISOString(),
    notes: `CODE-AUTHORED (experiment: model-authored keyframes, no Blender source). ${kf.notes}`,
    bones,
  };
  for (const dir of [SOURCE_DIR, PUBLIC_DIR]) {
    mkdirSync(resolve(dir, 'metadata'), { recursive: true });
    writeFileSync(resolve(dir, 'metadata', `${poseId}.json`), JSON.stringify(metadata, null, 2), 'utf-8');
  }
  writtenIds.push(poseId);
}

for (const dir of [SOURCE_DIR, PUBLIC_DIR]) {
  const files = readdirSync(resolve(dir, 'metadata')).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const index: ReferencePoseIndex = { poses: files.map((f) => f.replace(/\.json$/, '')).sort(), updatedAt: new Date().toISOString() };
  writeFileSync(resolve(dir, 'metadata', 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
}

console.log(`\nWrote ${writtenIds.length} poses: ${writtenIds.join(', ')}`);
console.log(`AnimationSource will now prefer keyframe-driven output for "${spec.signName}".`);
