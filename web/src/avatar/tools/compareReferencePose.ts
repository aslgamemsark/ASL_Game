#!/usr/bin/env node
/**
 * Reference Pose System — comparison CLI.
 *
 * Usage:
 *   npx tsx src/avatar/tools/compareReferencePose.ts [poseId]
 *   (omit poseId to compare every reference pose found in reference_poses/metadata/)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { compareReferencePose } from '../reference/ReferencePoseCompare.ts';
import type { ReferencePoseMetadata } from '../reference/types.ts';

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
const METADATA_DIR = resolve(REPO_ROOT, 'reference_poses', 'metadata');
const REST_RIG_PATH = resolve(import.meta.dirname, '../../../public/models/avatar/ybot.glb');

const requestedPoseId = process.argv[2];

function loadRestRig() {
  const raw = readFileSync(REST_RIG_PATH);
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const hierarchy = buildHierarchy(parseGlb(buffer).json, REST_RIG_PATH);
  const calibration = buildCalibration(hierarchy, buffer);
  return { hierarchy, calibration };
}

function poseIdsToCompare(): string[] {
  if (requestedPoseId) return [requestedPoseId];
  if (!existsSync(METADATA_DIR)) return [];
  return readdirSync(METADATA_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => f.replace(/\.json$/, ''));
}

const ids = poseIdsToCompare();
if (ids.length === 0) {
  console.log('No reference poses found under reference_poses/metadata/.');
  console.log('Create one first — see docs/BLENDER_WORKFLOW.md.');
  process.exit(0);
}

const { hierarchy, calibration } = loadRestRig();
const allPoses: ReferencePoseMetadata[] = existsSync(METADATA_DIR)
  ? readdirSync(METADATA_DIR)
      .filter((f) => f.endsWith('.json') && f !== 'index.json')
      .map((f) => JSON.parse(readFileSync(resolve(METADATA_DIR, f), 'utf-8')))
  : [];
let overallPass = true;

for (const poseId of ids) {
  const metadataPath = resolve(METADATA_DIR, `${poseId}.json`);
  if (!existsSync(metadataPath)) {
    console.log(`\n${poseId}: FAIL (no metadata file at ${metadataPath})`);
    overallPass = false;
    continue;
  }
  const metadata: ReferencePoseMetadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));

  console.log(`\n=== ${poseId} (sign=${metadata.signName}, frameFraction=${metadata.frameFraction}) ===`);
  if (metadata.avatarVersion !== calibration.avatarVersion) {
    console.log(
      `  WARNING: avatarVersion mismatch — this reference was posed against avatarVersion=${metadata.avatarVersion}, ` +
        `current rig is ${calibration.avatarVersion}. The rig may have changed since this pose was created.`
    );
  }

  const result = compareReferencePose(hierarchy, calibration, metadata, allPoses);

  const solvedBones = result.bones.filter((b) => b.status !== 'unsolved');
  const unsolvedBones = result.bones.filter((b) => b.status === 'unsolved');
  const nameWidth = Math.max(...result.bones.map((b) => b.boneName.replace(/^mixamorig:?/i, '').length), 10);
  for (const b of solvedBones) {
    const label = b.boneName.replace(/^mixamorig:?/i, '');
    const dots = '.'.repeat(Math.max(2, nameWidth - label.length + 4));
    const mark = b.status === 'ok' ? '' : '  <-- OVER THRESHOLD';
    console.log(`  ${label} ${dots} ${b.angularErrorDeg!.toFixed(1)}deg${mark}`);
  }
  if (unsolvedBones.length > 0) {
    console.log(`  (${unsolvedBones.length} bone(s) not yet solved by the engine — not scored: fingers/palm-roll are M6+)`);
  }
  for (const p of result.positions) {
    const mark = p.errorMeters <= result.positionThresholdMeters ? '' : '  <-- OVER THRESHOLD';
    console.log(`  ${p.label} position error: ${(p.errorMeters * 1000).toFixed(1)}mm${mark}`);
  }
  console.log(`  ${poseId}: ${result.pass ? 'PASS' : 'FAIL'}`);
  overallPass &&= result.pass;
}

console.log(`\nOverall: ${overallPass ? 'PASS' : 'FAIL'}`);
process.exit(overallPass ? 0 : 1);
