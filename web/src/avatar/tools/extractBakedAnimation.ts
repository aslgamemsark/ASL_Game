#!/usr/bin/env node
/**
 * Reference Pose System — baked-animation extraction (docs/BLENDER_WORKFLOW.md "baked clip" path).
 *
 * For a GLB that carries a REAL baked animation (dozens of real keyframes, e.g. a Mixamo/Blender
 * export of the actual wave motion for HELLO — not just a start/end static pose), this samples the
 * clip at N evenly-spaced points and writes that many ReferencePoseMetadata files. This deliberately
 * reuses the EXACT SAME output shape as extractReferencePose.ts, so KeyframeAnimator/AnimationSource
 * need zero changes to consume it — "2+ poses for a sign" already means "keyframe-driven", whether
 * those poses came from 3 hand-exported snapshots or 24 samples of one baked clip.
 *
 * IMPORTANT — writes under an ISOLATED pilot sign name (`<signName>_PILOT`), NOT `signName` itself,
 * by default. Writing directly under the real sign name would silently mix these poses into the
 * SAME frameFraction-interpolated animation as any existing production poses for that sign
 * (KeyframeAnimator groups ALL poses sharing a signName) — this exact collision happened once this
 * project (see docs/VIDEO_RETARGET_HANDOFF.md bug #4): it broke resolveAnimationForSign for
 * multiple signs in the same `vitest run`. Pass --promote to write under the real sign name instead
 * — only do that after a human has reviewed the pilot output in /avatarlab and approved it.
 *
 * Usage:
 *   npx tsx src/avatar/tools/extractBakedAnimation.ts <poseIdPrefix> <signName> <glbPath> [sampleCount] [--promote]
 *
 * Example:
 *   npx tsx src/avatar/tools/extractBakedAnimation.ts HELLO_bake HELLO reference_poses/blender/hello_complete.glb 24 --promote
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { buildRotationTracks, sampleAllBonesAtFraction, trackTimeRange } from '../reference/GlbAnimationSampler.ts';
import { SIGN_PATHS } from '../animation/signPaths.ts';
import type { ReferencePoseIndex, ReferencePoseMetadata } from '../reference/types.ts';

function log(step: string, ok: boolean, detail?: string) {
  console.log(`${step}... ${ok ? 'PASS' : 'FAIL'}${detail ? `  (${detail})` : ''}`);
}
function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const rawArgs = process.argv.slice(2);
const promote = rawArgs.includes('--promote');
const [poseIdPrefix, signName, glbPathArg, sampleCountArg] = rawArgs.filter((a) => a !== '--promote');
if (!poseIdPrefix || !signName || !glbPathArg) {
  fail(
    'Usage: extractBakedAnimation.ts <poseIdPrefix> <signName> <glbPath> [sampleCount=24] [--promote]\n' +
      '  poseIdPrefix   e.g. "HELLO_bake" — output files are metadata/<poseIdPrefix>_<i>.json\n' +
      '  signName       must match a key in animation/signPaths.ts SIGN_PATHS\n' +
      '  glbPath        a GLB containing a BAKED animation (real keyframes), not just a static pose\n' +
      '  --promote      write under the real signName + to both dirs (default: isolated pilot review only)'
  );
}
if (!(signName in SIGN_PATHS)) {
  fail(`signName "${signName}" is not in animation/signPaths.ts SIGN_PATHS (${Object.keys(SIGN_PATHS).join(', ')}).`);
}
const sampleCount = sampleCountArg ? Number(sampleCountArg) : 24;
if (!Number.isFinite(sampleCount) || sampleCount < 2) fail(`sampleCount must be a number >= 2, got "${sampleCountArg}".`);
const outputSignName = promote ? signName : `${signName}_PILOT`;
if (!promote) console.log(`(writing under isolated pilot sign "${outputSignName}" — pass --promote to write under "${signName}" itself, only after review)\n`);

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
const SOURCE_DIR = resolve(REPO_ROOT, 'reference_poses');
const PUBLIC_DIR = resolve(import.meta.dirname, '../../../public/reference_poses');
const REST_RIG_PATH = resolve(import.meta.dirname, '../../../public/models/avatar/ybot.glb');

const glbPath = resolve(glbPathArg);
if (!existsSync(glbPath)) fail(`GLB not found: ${glbPath}`);

const restRaw = readFileSync(REST_RIG_PATH);
const restBuffer = restRaw.buffer.slice(restRaw.byteOffset, restRaw.byteOffset + restRaw.byteLength);
const restHierarchy = buildHierarchy(parseGlb(restBuffer).json, REST_RIG_PATH);
const restCalibration = buildCalibration(restHierarchy, restBuffer);
log('Loading rest-pose rig for version stamping', true, `avatarVersion=${restCalibration.avatarVersion}`);

const rawGlb = readFileSync(glbPath);
const glbBuffer = rawGlb.buffer.slice(rawGlb.byteOffset, rawGlb.byteOffset + rawGlb.byteLength);
const { json: animDoc, binChunk } = parseGlb(glbBuffer);
if (!binChunk) fail(`"${glbPath}" has no BIN chunk — cannot read keyframe data.`);
log('Loading baked-animation GLB', true, glbPath);

const rawTracks = buildRotationTracks(animDoc, binChunk!, 0);
if (rawTracks.size === 0) fail('No rotation animation channels found in this GLB — is this really a baked clip, not a static pose?');
const range = trackTimeRange(rawTracks);
log('Parsing baked rotation tracks', true, `${rawTracks.size} animated bone(s), t in [${range.min.toFixed(3)}, ${range.max.toFixed(3)}]s`);

// Some exporters (confirmed: Blender's glTF exporter on a GLB re-exported from a third-party FBX
// import, e.g. the StudioGalt archive) bake a static, always-identity rotation track for a node
// that isn't a real bone on this rig (an "Armature" object-transform track, or a root/locator bone
// left over from the source rig) — harmless exporter noise, not real animation data. Drop ONLY
// unknown-bone tracks that are identity at every sampled time (never invent — a track with any
// real, non-identity rotation on an unrecognized bone still fails loudly below, same as before).
const IDENTITY_EPS = 1e-3;
function isIdentityTrack(track: { rotations: { x: number; y: number; z: number; w: number }[] }): boolean {
  return track.rotations.every((q) => Math.abs(q.x) < IDENTITY_EPS && Math.abs(q.y) < IDENTITY_EPS && Math.abs(q.z) < IDENTITY_EPS && Math.abs(q.w - 1) < IDENTITY_EPS);
}
const tracks = new Map(rawTracks);
const droppedIdentityBones: string[] = [];
for (const [name, track] of rawTracks) {
  if (!restHierarchy.bones[name] && isIdentityTrack(track)) {
    tracks.delete(name);
    droppedIdentityBones.push(name);
  }
}
if (droppedIdentityBones.length > 0) {
  log('Dropping exporter-artifact tracks', true, `${droppedIdentityBones.length} unknown bone(s) with all-identity rotation, not real motion: ${droppedIdentityBones.join(', ')}`);
}

// Every REMAINING animated bone must exist on the rest rig too (same rig, mixamorig: names) — fail
// loudly if not (this is the real guardrail: an unknown bone with actual motion is never silently
// dropped, only never-moving exporter artifacts are).
const unknownBones = [...tracks.keys()].filter((name) => !restHierarchy.bones[name]);
if (unknownBones.length > 0) {
  fail(`${unknownBones.length} animated bone(s) not found on the rest rig (${REST_RIG_PATH}): ${unknownBones.slice(0, 5).join(', ')}${unknownBones.length > 5 ? '...' : ''}`);
}

// Pilot mode (default) writes ONLY to PUBLIC_DIR (browser-servable — so /avatarlab can show it for
// review) and skips SOURCE_DIR (the repo-root reference_poses/ that referencePoseRegression.test.ts
// scans and holds to production thresholds). --promote writes to both, as before this change.
const writeDirs = promote ? [SOURCE_DIR, PUBLIC_DIR] : [PUBLIC_DIR];

const sharedGlbName = `${poseIdPrefix}_source.glb`;
for (const dir of writeDirs) {
  mkdirSync(resolve(dir, 'glb'), { recursive: true });
  writeFileSync(resolve(dir, 'glb', sharedGlbName), Buffer.from(glbBuffer));
}

const writtenIds: string[] = [];
for (let i = 0; i < sampleCount; i++) {
  const fraction = i / (sampleCount - 1);
  const sampled = sampleAllBonesAtFraction(tracks, range, fraction);
  const poseId = `${poseIdPrefix}_${String(i).padStart(2, '0')}`;

  const bones: ReferencePoseMetadata['bones'] = {};
  for (const [boneName, quat] of sampled) {
    // Translation is intentionally always the REST value — see GlbAnimationSampler.ts docstring:
    // this engine never animates bone translation, only rotation.
    const restBone = restHierarchy.bones[boneName];
    bones[boneName] = {
      rotation: [quat.x, quat.y, quat.z, quat.w],
      translation: [restBone.localPosition.x, restBone.localPosition.y, restBone.localPosition.z],
    };
  }

  const metadata: ReferencePoseMetadata = {
    poseId,
    signName: outputSignName,
    frameFraction: fraction,
    sourceGlb: `glb/${sharedGlbName}`,
    avatarVersion: restCalibration.avatarVersion,
    generatorVersion: 'extractBakedAnimation@1.0.0',
    extractedAt: new Date().toISOString(),
    notes: `Sampled from baked clip at t=${(range.min + (range.max - range.min) * fraction).toFixed(4)}s of [${range.min.toFixed(4)}, ${range.max.toFixed(4)}]s.`,
    bones,
  };

  for (const dir of writeDirs) {
    mkdirSync(resolve(dir, 'metadata'), { recursive: true });
    writeFileSync(resolve(dir, 'metadata', `${poseId}.json`), JSON.stringify(metadata, null, 2), 'utf-8');
  }
  writtenIds.push(poseId);
}
log(`Sampling clip into ${sampleCount} reference poses`, true, writtenIds.join(', '));

for (const dir of writeDirs) {
  const metadataFiles = readdirSync(resolve(dir, 'metadata')).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const index: ReferencePoseIndex = { poses: metadataFiles.map((f) => f.replace(/\.json$/, '')).sort(), updatedAt: new Date().toISOString() };
  writeFileSync(resolve(dir, 'metadata', 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
}
log('Updating pose index', true, promote ? 'source + public' : 'public only (pilot — not in the regression-tested system yet)');

console.log(`\nExtraction complete: ${sampleCount} poses for sign "${outputSignName}" from baked clip "${glbPath}".`);
if (promote) {
  console.log(`AnimationSource will now prefer keyframe-driven output for "${signName}" (>=2 poses exist).`);
} else {
  console.log(`Isolated under "${outputSignName}" — the real "${signName}" sign is UNCHANGED. Review in /avatarlab, then re-run with --promote once approved.`);
}
