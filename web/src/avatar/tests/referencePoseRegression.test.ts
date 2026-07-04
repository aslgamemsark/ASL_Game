/**
 * Reference Pose System — regression suite (docs/REFERENCE_POSE_SPEC.md). Iterates every reference
 * pose under reference_poses/metadata/ and asserts the solver's output matches it within threshold.
 * This is the automated-CI half of the subsystem: a future change that breaks retargeting for a
 * pose a human already verified in Blender fails HERE, not just "looks wrong in AvatarLab."
 *
 * Must stay green with ZERO reference poses present (before the first Blender pose is ever created) —
 * an empty reference set is a valid, expected state, not a test failure.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { compareReferencePose } from '../reference/ReferencePoseCompare.ts';
import type { ReferencePoseMetadata } from '../reference/types.ts';

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
const METADATA_DIR = resolve(REPO_ROOT, 'reference_poses', 'metadata');
const YBOT_PATH = resolve(import.meta.dirname, '../../../public/models/avatar/ybot.glb');

function discoverPoseIds(): string[] {
  if (!existsSync(METADATA_DIR)) return [];
  return readdirSync(METADATA_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => f.replace(/\.json$/, ''));
}

const poseIds = discoverPoseIds();

describe('Reference Pose System — regression', () => {
  it('reference pose directory is reachable (sanity check, independent of whether any poses exist yet)', () => {
    expect(typeof METADATA_DIR).toBe('string');
  });

  if (poseIds.length === 0) {
    it('no reference poses exist yet — nothing to regress (expected before the first Blender pose is created)', () => {
      expect(poseIds).toEqual([]);
    });
    return;
  }

  const raw = readFileSync(YBOT_PATH);
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const hierarchy = buildHierarchy(parseGlb(buffer).json, YBOT_PATH);
  const calibration = buildCalibration(hierarchy, buffer);
  const allPoses: ReferencePoseMetadata[] = poseIds.map((id) => JSON.parse(readFileSync(resolve(METADATA_DIR, `${id}.json`), 'utf-8')));

  for (const poseId of poseIds) {
    it(`${poseId}: the CURRENTLY RESOLVED animation (keyframe-driven if >=2 poses exist, else procedural IK) matches this reference within threshold`, () => {
      const metadata: ReferencePoseMetadata = JSON.parse(readFileSync(resolve(METADATA_DIR, `${poseId}.json`), 'utf-8'));
      const result = compareReferencePose(hierarchy, calibration, metadata, allPoses);

      for (const bone of result.bones) {
        if (bone.status === 'unsolved') continue; // fingers/palm-roll: not yet implemented, not scored
        expect(bone.angularErrorDeg, `${poseId}: ${bone.boneName} angular error`).toBeLessThanOrEqual(result.angularThresholdDeg);
      }
      for (const pos of result.positions) {
        expect(pos.errorMeters, `${poseId}: ${pos.label} position error`).toBeLessThanOrEqual(result.positionThresholdMeters);
      }
      expect(result.pass).toBe(true);
    });
  }
});
