#!/usr/bin/env node
/**
 * Reference Pose System — extraction CLI (docs/BLENDER_WORKFLOW.md step 5).
 *
 * Usage:
 *   npx tsx src/avatar/tools/extractReferencePose.ts <poseId> <signName> <frameFraction> [glbPath]
 *
 * Example:
 *   npx tsx src/avatar/tools/extractReferencePose.ts HELLO HELLO 1.0
 *   (reads ../reference_poses/glb/HELLO.glb by default)
 *
 * Reuses buildHierarchy() (Milestone 1) to read the posed GLB — a posed export is parsed through the
 * exact same, already-validated path as the rest-pose rig. Writes the extracted JSON to BOTH
 * reference_poses/metadata/ (source of truth, repo root) and web/public/reference_poses/metadata/
 * (servable mirror the AvatarLab viewer fetches) — see docs/REFERENCE_POSE_SPEC.md for why there are
 * two copies.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { extractPoseFromHierarchy } from '../reference/ReferencePoseIO.ts';
import { SIGN_PATHS } from '../animation/signPaths.ts';
import type { ReferencePoseIndex, ReferencePoseMetadata } from '../reference/types.ts';

function log(step: string, ok: boolean, detail?: string) {
  console.log(`${step}... ${ok ? 'PASS' : 'FAIL'}${detail ? `  (${detail})` : ''}`);
}
function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const [poseId, signName, frameFractionArg, glbPathArg] = process.argv.slice(2);

if (!poseId || !signName || frameFractionArg === undefined) {
  fail(
    'Usage: extractReferencePose.ts <poseId> <signName> <frameFraction> [glbPath]\n' +
      '  poseId         e.g. "HELLO" — the filename this reference is saved under (metadata/<poseId>.json)\n' +
      '  signName       must match a key in animation/signPaths.ts SIGN_PATHS\n' +
      '  frameFraction  0..1, which point of the authored sign timeline this pose represents\n' +
      '  glbPath        optional override; defaults to reference_poses/glb/<poseId>.glb'
  );
}

if (!(signName in SIGN_PATHS)) {
  fail(`signName "${signName}" is not in animation/signPaths.ts SIGN_PATHS (${Object.keys(SIGN_PATHS).join(', ')}).`);
}

const frameFraction = Number(frameFractionArg);
if (!Number.isFinite(frameFraction) || frameFraction < 0 || frameFraction > 1) {
  fail(`frameFraction must be a number in [0,1], got "${frameFractionArg}".`);
}

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
const SOURCE_DIR = resolve(REPO_ROOT, 'reference_poses');
const PUBLIC_DIR = resolve(import.meta.dirname, '../../../public/reference_poses');

const glbPath = glbPathArg ? resolve(glbPathArg) : resolve(SOURCE_DIR, 'glb', `${poseId}.glb`);
if (!existsSync(glbPath)) {
  fail(`Posed GLB not found: ${glbPath}\nExport it from Blender first (see docs/BLENDER_WORKFLOW.md).`);
}

// The rest-pose rig this reference is assumed to match, purely for traceability (drift detection in
// compareReferencePose.ts if the shipped avatar's rig ever changes underneath old reference poses).
const REST_RIG_PATH = resolve(import.meta.dirname, '../../../public/models/avatar/ybot.glb');
const restRaw = readFileSync(REST_RIG_PATH);
const restBuffer = restRaw.buffer.slice(restRaw.byteOffset, restRaw.byteOffset + restRaw.byteLength);
const restHierarchy = buildHierarchy(parseGlb(restBuffer).json, REST_RIG_PATH);
const restCalibration = buildCalibration(restHierarchy, restBuffer);
log('Loading rest-pose rig for version stamping', true, `avatarVersion=${restCalibration.avatarVersion}`);

const posedRaw = readFileSync(glbPath);
const posedBuffer = posedRaw.buffer.slice(posedRaw.byteOffset, posedRaw.byteOffset + posedRaw.byteLength);
const posedHierarchy = buildHierarchy(parseGlb(posedBuffer).json, glbPath);
log('Loading posed GLB', true, `${posedHierarchy.totalBones} bones, ${glbPath}`);

if (posedHierarchy.totalBones !== restHierarchy.totalBones) {
  log(
    'Bone count matches rest rig',
    false,
    `posed has ${posedHierarchy.totalBones}, rest rig has ${restHierarchy.totalBones} — likely a different/re-exported rig`
  );
} else {
  log('Bone count matches rest rig', true, `${posedHierarchy.totalBones} bones`);
}

const bones = extractPoseFromHierarchy(posedHierarchy);
log('Extracting per-bone local rotation/translation', true, `${Object.keys(bones).length} bones`);

const metadata: ReferencePoseMetadata = {
  poseId,
  signName,
  frameFraction,
  sourceGlb: `glb/${poseId}.glb`,
  avatarVersion: restCalibration.avatarVersion,
  generatorVersion: 'extractReferencePose@1.0.0',
  extractedAt: new Date().toISOString(),
  bones,
};

function writeMirror(dir: string) {
  mkdirSync(resolve(dir, 'metadata'), { recursive: true });
  mkdirSync(resolve(dir, 'glb'), { recursive: true });
  writeFileSync(resolve(dir, 'metadata', `${poseId}.json`), JSON.stringify(metadata, null, 2), 'utf-8');
  writeFileSync(resolve(dir, 'glb', `${poseId}.glb`), Buffer.from(posedBuffer));

  const metadataFiles = readdirSync(resolve(dir, 'metadata')).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const index: ReferencePoseIndex = {
    poses: metadataFiles.map((f) => f.replace(/\.json$/, '')).sort(),
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(resolve(dir, 'metadata', 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  return index;
}

writeMirror(SOURCE_DIR);
log('Writing source of truth', true, resolve(SOURCE_DIR, 'metadata', `${poseId}.json`));
const index = writeMirror(PUBLIC_DIR);
log('Writing servable mirror', true, resolve(PUBLIC_DIR, 'metadata', `${poseId}.json`));
log('Updating pose index', true, `${index.poses.length} pose(s): ${index.poses.join(', ')}`);

console.log(`\nExtraction complete for "${poseId}" (sign=${signName}, frameFraction=${frameFraction}).`);
console.log(`Next: npx tsx src/avatar/tools/compareReferencePose.ts ${poseId}`);
