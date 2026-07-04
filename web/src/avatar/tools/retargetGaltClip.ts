#!/usr/bin/env node
/**
 * Rest-to-rest retargeting for third-party baked mocap clips whose rest pose does NOT match ybot's
 * — specifically the StudioGalt archive's Mixamo-rig FBX exports (COFFEE, HELLO). Those rigs share
 * ybot's bone NAMES but not its rest pose: Galt's rig has a corrective "Locator_Root" root bone
 * (rest ~90 degrees about X) that ybot doesn't have, and Blender's glTF exporter always writes each
 * bone's animated rotation channel relative to THAT BONE'S OWN rest pose. Copying those values
 * directly onto ybot (which is what extractBakedAnimation.ts correctly does for clips authored ON
 * ybot itself, e.g. HELLO_bake) produces a whole-body ~90-degree tip-over for a rig with a different
 * rest pose. See docs/VIDEO_RETARGET_HANDOFF.md for the full diagnosis (two failed Blender-side
 * hierarchy-edit attempts before this was traced to a data-semantics mismatch, not a parenting bug).
 *
 * Fix: for every animated bone B and every sampled time t,
 *   newLocal[B](t) = inverse(ybotParentWorldRest[B]) * galtWorldOrientation[B](t)
 * where galtWorldOrientation[B](t) is computed via forward kinematics through GALT's own rest
 * hierarchy (root Locator_Root down through B) using the ANIMATED local rotations, and
 * ybotParentWorldRest[B] is the world rest orientation of B's PARENT on ybot's own skeleton. This
 * re-expresses Galt's motion in ybot's local bone space, correcting for the corrective root bone and
 * any residual rest-pose difference between the two rigs, bone by bone.
 *
 * Output uses the exact same ReferencePoseMetadata shape and pilot-isolation convention as
 * extractBakedAnimation.ts (writes under `<signName>_PILOT` unless --promote is passed).
 *
 * Usage:
 *   npx tsx src/avatar/tools/retargetGaltClip.ts <poseIdPrefix> <signName> <galtGlbPath> [sampleCount] [--promote]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { quatIdentity, quatInvert, quatMultiply } from '../calibration/math3d.ts';
import { buildRotationTracks, sampleTrackAtTime, trackTimeRange } from '../reference/GlbAnimationSampler.ts';
import type { RotationTrack } from '../reference/GlbAnimationSampler.ts';
import { SIGN_PATHS } from '../animation/signPaths.ts';
import type { AvatarHierarchy } from '../calibration/types.ts';
import type { Quat } from '../calibration/types.ts';
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
    'Usage: retargetGaltClip.ts <poseIdPrefix> <signName> <galtGlbPath> [sampleCount=24] [--promote]\n' +
      '  poseIdPrefix   e.g. "COFFEE_galt" — output files are metadata/<poseIdPrefix>_<i>.json\n' +
      '  signName       must match a key in animation/signPaths.ts SIGN_PATHS\n' +
      '  galtGlbPath    a GLB converted from a StudioGalt archive Mixamo FBX (Locator_Root intact)\n' +
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
log('Loading ybot rest-pose rig', true, `avatarVersion=${restCalibration.avatarVersion}`);

const rawGlb = readFileSync(glbPath);
const glbBuffer = rawGlb.buffer.slice(rawGlb.byteOffset, rawGlb.byteOffset + rawGlb.byteLength);
const { json: galtDoc, binChunk } = parseGlb(glbBuffer);
if (!binChunk) fail(`"${glbPath}" has no BIN chunk — cannot read keyframe data.`);
const galtHierarchy = buildHierarchy(galtDoc, glbPath);
log('Loading Galt archive rig + rest hierarchy', true, `${galtHierarchy.totalBones} bone(s), root="${galtHierarchy.root}"`);

const galtTracks = buildRotationTracks(galtDoc, binChunk!, 0);
if (galtTracks.size === 0) fail('No rotation animation channels found in this GLB — is this really a baked clip?');
const range = trackTimeRange(galtTracks);
log('Parsing Galt baked rotation tracks', true, `${galtTracks.size} animated node(s), t in [${range.min.toFixed(3)}, ${range.max.toFixed(3)}]s`);

// Only retarget bones that are real skeleton joints on BOTH rigs (share a mixamorig: name). This
// naturally excludes exporter-artifact nodes (e.g. "Locator_Root", "Armature") from the OUTPUT set —
// they still participate as ANCESTORS in the FK chain below (via galtHierarchy), just never written
// as an ybot bone pose themselves, since ybot has no such bone to write into.
const targetBones = [...galtTracks.keys()].filter((name) => restHierarchy.bones[name] && galtHierarchy.bones[name]);
const skippedBones = [...galtTracks.keys()].filter((name) => !restHierarchy.bones[name]);
if (targetBones.length === 0) fail('No animated Galt bone names match any ybot bone name — naming mismatch, cannot retarget.');
log('Matching animated bones to ybot skeleton', true, `${targetBones.length} bone(s) retargeted, ${skippedBones.length} skipped (not a ybot bone): ${skippedBones.join(', ') || 'none'}`);

// --- Galt-side FK: world orientation of a bone at time t, composed through GALT's own rest
// hierarchy using ANIMATED local rotations where available, falling back to that bone's own rest
// local rotation for any ancestor with no animation track (e.g. a static corrective root). ---
function galtLocalAtTime(name: string, t: number): Quat {
  const track: RotationTrack | undefined = galtTracks.get(name);
  if (track) return sampleTrackAtTime(track, t);
  const bone = galtHierarchy.bones[name];
  return bone ? bone.localRotation : quatIdentity();
}
function galtWorldAtTime(name: string, t: number): Quat {
  const bone = galtHierarchy.bones[name];
  if (!bone) throw new Error(`Galt bone "${name}" not found in hierarchy while computing world orientation.`);
  const local = galtLocalAtTime(name, t);
  if (!bone.parent) return local;
  return quatMultiply(galtWorldAtTime(bone.parent, t), local);
}

// --- ybot-side FK: world REST orientation of a bone, composed through ybot's own rest hierarchy.
// Only ever uses rest data — ybot itself is never animated by this tool. ---
function ybotWorldRest(name: string, hierarchy: AvatarHierarchy): Quat {
  const bone = hierarchy.bones[name];
  if (!bone) throw new Error(`ybot bone "${name}" not found in rest hierarchy.`);
  if (!bone.parent) return bone.localRotation;
  return quatMultiply(ybotWorldRest(bone.parent, hierarchy), bone.localRotation);
}
function ybotParentWorldRest(name: string, hierarchy: AvatarHierarchy): Quat {
  const bone = hierarchy.bones[name];
  if (!bone.parent) return quatIdentity();
  return ybotWorldRest(bone.parent, hierarchy);
}

// Precompute each target bone's ybot-parent rest world orientation once (rest data never changes
// across samples) — verify-by-print for the root-adjacent bones, since that's exactly where the
// original tip-over bug lived.
const parentWorldRestByBone = new Map<string, Quat>();
for (const name of targetBones) parentWorldRestByBone.set(name, ybotParentWorldRest(name, restHierarchy));
const hipsParentRest = parentWorldRestByBone.get('mixamorig:Hips');
if (hipsParentRest) {
  log('Verify: ybot Hips parent-world-rest (should be identity, ybot Hips has no joint parent)', Math.abs(hipsParentRest.w - 1) < 1e-4, `q=(${hipsParentRest.x.toFixed(4)}, ${hipsParentRest.y.toFixed(4)}, ${hipsParentRest.z.toFixed(4)}, ${hipsParentRest.w.toFixed(4)})`);
}
const galtHipsWorldAtStart = galtWorldAtTime('mixamorig:Hips', range.min);
log('Verify: Galt Hips world orientation at t=start (should include Locator_Root correction, i.e. NOT identity)', true, `q=(${galtHipsWorldAtStart.x.toFixed(4)}, ${galtHipsWorldAtStart.y.toFixed(4)}, ${galtHipsWorldAtStart.z.toFixed(4)}, ${galtHipsWorldAtStart.w.toFixed(4)})`);

function retargetedLocal(name: string, t: number): Quat {
  const galtWorld = galtWorldAtTime(name, t);
  const parentRest = parentWorldRestByBone.get(name)!;
  return quatMultiply(quatInvert(parentRest), galtWorld);
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
  const t = range.min + (range.max - range.min) * fraction;
  const poseId = `${poseIdPrefix}_${String(i).padStart(2, '0')}`;

  const bones: ReferencePoseMetadata['bones'] = {};
  for (const boneName of targetBones) {
    const quat = retargetedLocal(boneName, t);
    const restBone = restHierarchy.bones[boneName];
    bones[boneName] = {
      rotation: [quat.x, quat.y, quat.z, quat.w],
      // Translation is intentionally always ybot's own REST value, same convention as
      // extractBakedAnimation.ts / GlbAnimationSampler.ts — this engine never animates translation.
      translation: [restBone.localPosition.x, restBone.localPosition.y, restBone.localPosition.z],
    };
  }

  const metadata: ReferencePoseMetadata = {
    poseId,
    signName: outputSignName,
    frameFraction: fraction,
    sourceGlb: `glb/${sharedGlbName}`,
    avatarVersion: restCalibration.avatarVersion,
    generatorVersion: 'retargetGaltClip@1.0.0',
    extractedAt: new Date().toISOString(),
    notes: `Rest-to-rest retargeted from StudioGalt archive clip at t=${t.toFixed(4)}s of [${range.min.toFixed(4)}, ${range.max.toFixed(4)}]s.`,
    bones,
  };

  for (const dir of writeDirs) {
    mkdirSync(resolve(dir, 'metadata'), { recursive: true });
    writeFileSync(resolve(dir, 'metadata', `${poseId}.json`), JSON.stringify(metadata, null, 2), 'utf-8');
  }
  writtenIds.push(poseId);
}
log(`Sampling + retargeting clip into ${sampleCount} reference poses`, true, writtenIds.join(', '));

for (const dir of writeDirs) {
  const metadataFiles = readdirSync(resolve(dir, 'metadata')).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const index: ReferencePoseIndex = { poses: metadataFiles.map((f) => f.replace(/\.json$/, '')).sort(), updatedAt: new Date().toISOString() };
  writeFileSync(resolve(dir, 'metadata', 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
}
log('Updating pose index', true, promote ? 'source + public' : 'public only (pilot — not in the regression-tested system yet)');

console.log(`\nRetargeting complete: ${sampleCount} poses for sign "${outputSignName}" from Galt archive clip "${glbPath}".`);
if (promote) {
  console.log(`AnimationSource will now prefer keyframe-driven output for "${signName}" (>=2 poses exist).`);
} else {
  console.log(`Isolated under "${outputSignName}" — the real "${signName}" sign is UNCHANGED. Review in /avatarlab, then re-run with --promote once approved.`);
}
