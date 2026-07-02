#!/usr/bin/env node
/**
 * Phase 3/5 CLI: retargets ONE video-landmark clip (from `tools/extract_avatar_landmarks.py`,
 * Phase 2) into ReferencePoseMetadata poses and writes them via the SAME output shape
 * `extractBakedAnimation.ts` uses — KeyframeAnimator/AnimationSource need zero changes to consume
 * this. See docs/VIDEO_RETARGET_HANDOFF.md for the full plan and guardrails.
 *
 * IMPORTANT — writes under an ISOLATED pilot sign name (`<SIGN>_VIDEO_PILOT`), NOT `<SIGN>` itself,
 * by default. Writing directly under the real sign name would silently mix these poses into the
 * SAME frameFraction-interpolated animation as any existing production poses for that sign
 * (KeyframeAnimator groups ALL poses sharing a signName) — this happened once during this pipeline's
 * own first test run: it collided with HELLO's existing Blender-baked poses, threw a duplicate-
 * frameFraction error, and broke resolveAnimationForSign for HELLO/THANK_YOU/YES in the SAME test
 * run. Pass --promote to write under the real sign name instead — only do that after Phase 5's
 * pilot review has passed and the user has given explicit go-ahead (docs/VIDEO_RETARGET_HANDOFF.md
 * guardrail #6).
 *
 * Usage:
 *   npx tsx src/avatar/tools/runVideoRetarget.ts <SIGN> <clipJsonPath> [sampleCount=24] [--promote]
 *
 * Example:
 *   npx tsx src/avatar/tools/runVideoRetarget.ts HELLO ../data/avatar_landmarks/HELLO/0022932153577568393-HELLO.json
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { loadVideoClip, validateVideoClip } from '../retarget/VideoLandmarkLoader.ts';
import {
  computeAvatarFrame, retargetArmFrame, type RetargetedArmFrame,
} from '../animation/VideoArmRetargeter.ts';
import { buildHandshape, FIST_FINGERS, H_SHAPE_CURL_FINGERS, INDEX_POINT_CURL_FINGERS } from '../animation/handshapes.ts';
import { distance } from '../calibration/math3d.ts';
import type { RawVideoClip } from '../retarget/videoLandmarkTypes.ts';
import type { ReferencePoseIndex, ReferencePoseMetadata } from '../reference/types.ts';
import type { FingerName, HandSide, Quat, Vec3 } from '../calibration/types.ts';
import type { VideoSide } from '../retarget/videoLandmarkTypes.ts';

/**
 * Static handshape overlay (docs/VIDEO_RETARGET_HANDOFF.md "handshape reality check"): these signs
 * hold ONE constant handshape through their whole motion, so a one-time pose (`handshapes.ts`)
 * applied uniformly to every sampled frame is enough to make the sign readable, without needing the
 * full per-frame finger solver (Milestone 6, not yet built). `null` = leave fingers at rest (correct
 * for HELLO's flat hand; an approximation for WANT's claw handshape, acceptable for this pilot).
 */
const SIGN_HANDSHAPE_FINGERS: Record<string, readonly FingerName[] | null> = {
  HELLO: null,
  YOU: INDEX_POINT_CURL_FINGERS,
  HOSPITAL: H_SHAPE_CURL_FINGERS,
  COFFEE: FIST_FINGERS,
  WANT: null,
};

// Which side(s) each pilot sign needs — mirrors tools/extract_avatar_landmarks.py's TWO_HANDED_SIGNS.
// 'auto' means one-handed but the dominant side is DETECTED per clip from measured wrist movement
// energy, not assumed — a real signer in ASL Citizen may be left- or right-hand-dominant, and
// hardcoding 'right' produced a confirmed wrong retarget on this project's own first test clip (a
// left-dominant HELLO signer) — see docs/VIDEO_RETARGET_HANDOFF.md for the incident.
const SIGN_SIDES: Record<string, 'auto' | VideoSide[]> = {
  HELLO: 'auto',
  YOU: 'auto',
  HOSPITAL: 'auto',
  COFFEE: ['left', 'right'],
  WANT: ['left', 'right'],
};

/** Sum of frame-to-frame wrist displacement (pose-world, meters) for one side across a clip —
 * convention-independent (doesn't depend on the up/forward-axis conventions this module is still
 * establishing), so safe to use for dominant-side detection before those conventions are applied. */
function wristMovementEnergy(clip: ReturnType<typeof loadVideoClip>, side: VideoSide): number {
  const key = side === 'left' ? 'left_wrist' : 'right_wrist';
  let energy = 0;
  let prev: { x: number; y: number; z: number } | null = null;
  for (const frame of clip.frames) {
    const w = frame.poseWorld?.[key];
    if (!w) continue;
    if (prev) energy += distance(prev, w);
    prev = w;
  }
  return energy;
}

function log(step: string, ok: boolean, detail?: string) {
  console.log(`${step}... ${ok ? 'PASS' : 'FAIL'}${detail ? `  (${detail})` : ''}`);
}
function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const rawArgs = process.argv.slice(2);
const promote = rawArgs.includes('--promote');
const [signArg, clipPathArg, sampleCountArg] = rawArgs.filter((a) => a !== '--promote');
if (!signArg || !clipPathArg) {
  fail(
    'Usage: runVideoRetarget.ts <SIGN> <clipJsonPath> [sampleCount=24] [--promote]\n' +
      `  SIGN must have an entry in SIGN_SIDES (${Object.keys(SIGN_SIDES).join(', ')}).`
  );
}
const sidesMode = SIGN_SIDES[signArg];
if (!sidesMode) fail(`No SIGN_SIDES entry for "${signArg}". Known: ${Object.keys(SIGN_SIDES).join(', ')}`);
const sampleCount = sampleCountArg ? Number(sampleCountArg) : 24;
const outputSignName = promote ? signArg : `${signArg}_VIDEO_PILOT`;
if (!promote) console.log(`(writing under isolated pilot sign "${outputSignName}" — pass --promote to write under "${signArg}" itself, only after Phase 5 review)\n`);

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
const SOURCE_DIR = resolve(REPO_ROOT, 'reference_poses');
const PUBLIC_DIR = resolve(import.meta.dirname, '../../../public/reference_poses');
const REST_RIG_PATH = resolve(import.meta.dirname, '../../../public/models/avatar/ybot.glb');

const clipPath = resolve(clipPathArg);
if (!existsSync(clipPath)) fail(`Clip JSON not found: ${clipPath}`);

const restRaw = readFileSync(REST_RIG_PATH);
const restBuffer = restRaw.buffer.slice(restRaw.byteOffset, restRaw.byteOffset + restRaw.byteLength);
const hierarchy = buildHierarchy(parseGlb(restBuffer).json, REST_RIG_PATH);
const calibration = buildCalibration(hierarchy, restBuffer);
const avatarFrame = computeAvatarFrame(hierarchy);
log('Loading + calibrating avatar', true, `${hierarchy.totalBones} bones, shoulderWidth=${calibration.shoulderWidthMeters.toFixed(3)}m`);

const raw = JSON.parse(readFileSync(clipPath, 'utf-8')) as RawVideoClip;
const clip = loadVideoClip(raw, clipPath);
const validation = validateVideoClip(clip);
log('Validating clip', validation.pass, `${validation.frameCount} frames, ${validation.framesWithBothElbows} with both elbows`);
if (!validation.pass) {
  console.error(validation.notes.join('\n'));
  fail('Clip failed validation — malformed frames present. Nothing written.');
}
if (validation.notes.length) console.log('  notes: ' + validation.notes.join(' | '));

let sides: VideoSide[];
if (sidesMode === 'auto') {
  const leftEnergy = wristMovementEnergy(clip, 'left');
  const rightEnergy = wristMovementEnergy(clip, 'right');
  const dominant: VideoSide = leftEnergy >= rightEnergy ? 'left' : 'right';
  sides = [dominant];
  log('Detecting dominant side (measured, not assumed)', true, `left=${leftEnergy.toFixed(3)}m right=${rightEnergy.toFixed(3)}m -> using ${dominant}`);
} else {
  sides = sidesMode;
}

// --- retarget every frame, per required side, with a simple hold-last-valid gap policy (Phase 4 lite) ---
interface FrameResult {
  frameIndex: number;
  bySide: Partial<Record<HandSide, RetargetedArmFrame>>;
}

const results: FrameResult[] = [];
const lastValid: Partial<Record<VideoSide, RetargetedArmFrame>> = {};
let heldCount = 0;
let droppedLeadingCount = 0;

for (let i = 0; i < clip.frames.length; i++) {
  const frame = clip.frames[i];
  const bySide: Partial<Record<HandSide, RetargetedArmFrame>> = {};
  let anySideValid = false;

  for (const vSide of sides) {
    const solved = retargetArmFrame(hierarchy, calibration, avatarFrame, frame, vSide);
    if (solved) {
      lastValid[vSide] = solved;
      bySide[solved.side] = solved;
      anySideValid = true;
    } else if (lastValid[vSide]) {
      bySide[lastValid[vSide]!.side] = lastValid[vSide]!;
      heldCount++;
      anySideValid = true;
    }
    // else: no valid data yet for this side at this frame — leave unset (never invent).
  }

  if (!anySideValid) {
    droppedLeadingCount++;
    continue; // leading gap before any side has data — drop, don't invent
  }
  results.push({ frameIndex: i, bySide });
}

if (results.length < 2) fail(`Only ${results.length} usable frame(s) after gap handling — need at least 2 to sample an animation.`);
log('Retargeting frames', true, `${results.length} usable (${heldCount} held-from-gap, ${droppedLeadingCount} dropped-leading)`);

// --- Amendment A2 (movement-energy trim): drop leading/trailing frames where the dominant side's
// wrist barely moves relative to its own average position (signer at rest before/after signing). ---
const primarySide: HandSide = sides.includes('right') ? 'right' : 'left';
const wristPositions: (Vec3 | null)[] = results.map((r) => r.bySide[primarySide]?.achievedWristWorld ?? null);
const validWrists = wristPositions.filter((p): p is Vec3 => p !== null);
const meanWrist = validWrists.reduce((acc, p) => ({ x: acc.x + p.x / validWrists.length, y: acc.y + p.y / validWrists.length, z: acc.z + p.z / validWrists.length }), { x: 0, y: 0, z: 0 });
const REST_DISTANCE_THRESHOLD_M = 0.03; // 3cm from the clip's mean wrist position counts as "at rest"

let trimStart = 0;
while (trimStart < wristPositions.length) {
  const p = wristPositions[trimStart];
  if (p && distance(p, meanWrist) > REST_DISTANCE_THRESHOLD_M) break;
  trimStart++;
}
let trimEnd = wristPositions.length - 1;
while (trimEnd > trimStart) {
  const p = wristPositions[trimEnd];
  if (p && distance(p, meanWrist) > REST_DISTANCE_THRESHOLD_M) break;
  trimEnd--;
}
if (trimEnd - trimStart < 1) { trimStart = 0; trimEnd = wristPositions.length - 1; } // trim collapsed everything — keep full clip rather than emit nothing
const trimmed = results.slice(trimStart, trimEnd + 1);
log('Trimming rest frames (Amendment A2)', true, `kept frames [${trimStart}..${trimEnd}] of ${results.length} (${trimmed.length} remain)`);

if (trimmed.length < 2) fail('Fewer than 2 frames remain after trimming. Nothing written.');

// --- FK-readback sanity report (guardrail #1) ---
let elbowAboveShoulderCount = 0;
const palmErrors: number[] = [];
const knuckleDistances: number[] = [];
for (const r of trimmed) {
  for (const side of Object.keys(r.bySide) as HandSide[]) {
    const f = r.bySide[side]!;
    const armBone = hierarchy.bones[hierarchy.arms[side].upperArm!];
    if (f.achievedElbowWorld.y > armBone.worldPosition.y + 0.02) elbowAboveShoulderCount++;
    if (f.palmAngleErrorDeg !== null) palmErrors.push(f.palmAngleErrorDeg);
  }
  if (r.bySide.left?.knuckleCentroidWorld && r.bySide.right?.knuckleCentroidWorld) {
    knuckleDistances.push(distance(r.bySide.left.knuckleCentroidWorld, r.bySide.right.knuckleCentroidWorld));
  }
}
console.log(`\nFK-readback report:`);
console.log(`  elbow-above-shoulder (suspect) frames: ${elbowAboveShoulderCount}/${trimmed.length * sides.length}`);
if (palmErrors.length) {
  const mean = palmErrors.reduce((a, b) => a + b, 0) / palmErrors.length;
  console.log(`  palm angle error: mean=${mean.toFixed(1)}deg max=${Math.max(...palmErrors).toFixed(1)}deg (n=${palmErrors.length})`);
} else {
  console.log(`  palm angle error: no frames had usable hand-world data to solve roll against — hand stays at rest orientation.`);
}
if (knuckleDistances.length) {
  const mean = knuckleDistances.reduce((a, b) => a + b, 0) / knuckleDistances.length;
  console.log(`  two-handed knuckle-centroid distance: mean=${(mean * 100).toFixed(1)}cm min=${(Math.min(...knuckleDistances) * 100).toFixed(1)}cm max=${(Math.max(...knuckleDistances) * 100).toFixed(1)}cm (guardrail #4 — COFFEE-class contact check)`);
}

// --- static handshape overlay, computed ONCE per side actually used (constant across all frames) ---
const handshapeFingers = SIGN_HANDSHAPE_FINGERS[signArg];
if (handshapeFingers === undefined) fail(`No SIGN_HANDSHAPE_FINGERS entry for "${signArg}" — add one (or null for flat/rest) before running the pilot.`);
const handshapeBonesBySide: Partial<Record<HandSide, Record<string, Quat>>> = {};
if (handshapeFingers) {
  const usedSides = new Set<HandSide>();
  for (const r of trimmed) for (const side of Object.keys(r.bySide) as HandSide[]) usedSides.add(side);
  for (const side of usedSides) handshapeBonesBySide[side] = buildHandshape(hierarchy, side, handshapeFingers);
  log('Applying static handshape overlay', true, `${handshapeFingers.join('+')} curled, on: ${[...usedSides].join(', ')}`);
} else {
  log('Applying static handshape overlay', true, 'none — fingers stay at rest (flat hand)');
}

// --- sample `sampleCount` evenly-spaced reference poses across the trimmed range ---
// Pilot mode (default, no --promote) writes ONLY to PUBLIC_DIR (browser-servable — so /avatarlab
// can show it for Phase 5 visual review) and deliberately SKIPS SOURCE_DIR (the repo-root
// reference_poses/metadata/ that referencePoseRegression.test.ts scans and holds to PRODUCTION
// thresholds calibrated for Blender ground truth, 15deg/3cm) — pilot output failed several of
// those on its first real run (real video has more per-frame noise than hand-posed keyframes) and
// is not yet "in the system" per docs/REFERENCE_POSE_SPEC.md's acceptance criteria (no archived
// .blend source, not reviewed). --promote writes to both, exactly like extractBakedAnimation.ts.
const writeDirs = promote ? [SOURCE_DIR, PUBLIC_DIR] : [PUBLIC_DIR];
for (const dir of writeDirs) mkdirSync(resolve(dir, 'metadata'), { recursive: true });

const poseIdPrefix = promote ? `${signArg}_video` : `${signArg}_VIDEO_PILOT`;
const writtenIds: string[] = [];
for (let i = 0; i < sampleCount; i++) {
  const fraction = sampleCount === 1 ? 0 : i / (sampleCount - 1);
  const srcIndex = Math.round(fraction * (trimmed.length - 1));
  const r = trimmed[srcIndex];
  const poseId = `${poseIdPrefix}_${String(i).padStart(2, '0')}`;

  const bones: ReferencePoseMetadata['bones'] = {};
  for (const side of Object.keys(r.bySide) as HandSide[]) {
    const f = r.bySide[side]!;
    const chain = hierarchy.arms[side];
    const armBone = hierarchy.bones[chain.upperArm!];
    const foreBone = hierarchy.bones[chain.forearm!];
    const handBone = hierarchy.bones[chain.hand!];
    bones[chain.upperArm!] = { rotation: [f.upperArmLocalRotation.x, f.upperArmLocalRotation.y, f.upperArmLocalRotation.z, f.upperArmLocalRotation.w], translation: [armBone.localPosition.x, armBone.localPosition.y, armBone.localPosition.z] };
    bones[chain.forearm!] = { rotation: [f.forearmLocalRotation.x, f.forearmLocalRotation.y, f.forearmLocalRotation.z, f.forearmLocalRotation.w], translation: [foreBone.localPosition.x, foreBone.localPosition.y, foreBone.localPosition.z] };
    bones[chain.hand!] = { rotation: [f.handLocalRotation.x, f.handLocalRotation.y, f.handLocalRotation.z, f.handLocalRotation.w], translation: [handBone.localPosition.x, handBone.localPosition.y, handBone.localPosition.z] };

    const handshapeOverrides = handshapeBonesBySide[side];
    if (handshapeOverrides) {
      for (const [boneName, rotation] of Object.entries(handshapeOverrides)) {
        const restBone = hierarchy.bones[boneName];
        bones[boneName] = { rotation: [rotation.x, rotation.y, rotation.z, rotation.w], translation: [restBone.localPosition.x, restBone.localPosition.y, restBone.localPosition.z] };
      }
    }
  }

  const metadata: ReferencePoseMetadata = {
    poseId,
    signName: outputSignName,
    frameFraction: fraction,
    sourceGlb: '', // no GLB — video-derived, not Blender
    avatarVersion: calibration.avatarVersion,
    generatorVersion: 'runVideoRetarget@1.0.0',
    extractedAt: new Date().toISOString(),
    notes: `VIDEO-DERIVED (ASL Citizen clip: ${clipPath}, source frame ${r.frameIndex}/${clip.frames.length}). Arms + palm orientation measured from real signer video. Handshape: ${handshapeFingers ? `static overlay (${handshapeFingers.join('+')} curled), constant across the whole sign` : 'rest/flat (no override)'} — full per-frame finger solving is Milestone 6, not yet built.`,
    bones,
  };
  for (const dir of writeDirs) {
    writeFileSync(resolve(dir, 'metadata', `${poseId}.json`), JSON.stringify(metadata, null, 2), 'utf-8');
  }
  writtenIds.push(poseId);
}
log(`Sampling into ${sampleCount} reference poses`, true, `${writtenIds[0]}..${writtenIds[writtenIds.length - 1]}`);

for (const dir of writeDirs) {
  const metadataFiles = readdirSync(resolve(dir, 'metadata')).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const index: ReferencePoseIndex = { poses: metadataFiles.map((f) => f.replace(/\.json$/, '')).sort(), updatedAt: new Date().toISOString() };
  writeFileSync(resolve(dir, 'metadata', 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
}
log('Updating pose index', true, promote ? 'source + public' : 'public only (pilot — not in the regression-tested system yet)');

console.log(`\nExtraction complete: ${sampleCount} poses for sign "${outputSignName}" from video clip.`);
if (promote) {
  console.log(`AnimationSource will now prefer keyframe-driven output for "${signArg}" (>=2 poses exist).`);
} else {
  console.log(`Isolated under "${outputSignName}" — the real "${signArg}" sign is UNCHANGED. Review in /avatarlab, then re-run with --promote once approved.`);
}
