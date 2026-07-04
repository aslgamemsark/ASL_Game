/**
 * Geometric sanity checks for Milestone 5, expressed numerically instead of by eyeballing a
 * screenshot: torso non-penetration, elbow bend direction, upper-arm non-overlap, wrist-target
 * accuracy, and shoulder immobility — for all 3 benchmark signs, every frame.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { retargetSign } from '../animation/ArmRetargeter.ts';
import { computeBodyFrame } from '../animation/BodyFrame.ts';
import { SIGN_PATHS } from '../animation/signPaths.ts';
import { distance, dot, subtract } from '../calibration/math3d.ts';
import type { Vec3 } from '../calibration/types.ts';

const YBOT_PATH = resolve(import.meta.dirname, '../../../public/models/avatar/ybot.glb');

function loadYbot() {
  const raw = readFileSync(YBOT_PATH);
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const { json } = parseGlb(buffer);
  const hierarchy = buildHierarchy(json, YBOT_PATH);
  const calibration = buildCalibration(hierarchy, buffer);
  return { hierarchy, calibration };
}

const SIGN_NAMES = Object.keys(SIGN_PATHS) as (keyof typeof SIGN_PATHS)[];

describe('Milestone 5 geometric sanity — no torso penetration, no elbow inversion, no arm overlap', () => {
  const { hierarchy, calibration } = loadYbot();
  const frame = computeBodyFrame(hierarchy);

  const hipsName = Object.keys(hierarchy.bones).find((n) => n.replace(/^mixamorig:?/i, '') === 'Hips')!;
  const neckOrHeadName =
    Object.keys(hierarchy.bones).find((n) => n.replace(/^mixamorig:?/i, '') === 'Head') ??
    Object.keys(hierarchy.bones).find((n) => n.replace(/^mixamorig:?/i, '') === 'Neck')!;
  const hipsWorld = hierarchy.bones[hipsName].worldPosition;
  const shoulderLineWorld = hierarchy.bones[neckOrHeadName].worldPosition;

  /** Horizontal (right/forward-plane) distance from a point to the spine centerline at that point's height. */
  function radialDistanceFromSpine(p: Vec3): number {
    const t = shoulderLineWorld.y === hipsWorld.y ? 0 : (p.y - hipsWorld.y) / (shoulderLineWorld.y - hipsWorld.y);
    const tClamped = Math.min(1, Math.max(0, t));
    const spineAtHeight: Vec3 = {
      x: hipsWorld.x + (shoulderLineWorld.x - hipsWorld.x) * tClamped,
      y: p.y,
      z: hipsWorld.z + (shoulderLineWorld.z - hipsWorld.z) * tClamped,
    };
    const offset = subtract(p, spineAtHeight);
    const right = dot(offset, frame.right);
    const forward = dot(offset, frame.forward);
    return Math.hypot(right, forward);
  }

  const TORSO_CLEARANCE_METERS = frame.shoulderWidth * 0.3; // human torso half-width+depth estimate
  const withinTorsoHeightBand = (p: Vec3) => p.y >= hipsWorld.y - 0.05 && p.y <= shoulderLineWorld.y + 0.05;

  for (const signName of SIGN_NAMES) {
    describe(signName, () => {
      const result = retargetSign(hierarchy, calibration, signName);

      it('no arm penetration into torso (wrist/elbow clear the torso cylinder whenever inside its height band)', () => {
        for (const f of result.frames) {
          for (const pose of [f.right, f.left].filter((p): p is NonNullable<typeof p> => p !== null)) {
            for (const point of [pose.elbowWorld, pose.achievedHandWorld]) {
              if (!withinTorsoHeightBand(point)) continue;
              expect(radialDistanceFromSpine(point)).toBeGreaterThanOrEqual(TORSO_CLEARANCE_METERS);
            }
          }
        }
      });

      it('no elbow inversion (elbow stays at or below shoulder height — these signs never require an overhead reach)', () => {
        for (const f of result.frames) {
          for (const pose of [f.right, f.left].filter((p): p is NonNullable<typeof p> => p !== null)) {
            expect(pose.elbowWorld.y).toBeLessThanOrEqual(pose.shoulderWorld.y + 0.05);
          }
        }
      });

      it('wrists reach their intended targets (from the existing M5 acceptance metric)', () => {
        for (const f of result.frames) {
          expect(f.right.positionErrorMeters).toBeLessThan(0.005);
          if (f.left) expect(f.left.positionErrorMeters).toBeLessThan(0.005);
        }
      });

      it('shoulders remain anatomically fixed (the rig never translates the shoulder root)', () => {
        const restRightShoulder = hierarchy.bones[hierarchy.arms.right.upperArm!].worldPosition;
        for (const f of result.frames) {
          expect(distance(f.right.shoulderWorld, restRightShoulder)).toBeLessThan(1e-9);
          if (f.left) {
            const restLeftShoulder = hierarchy.bones[hierarchy.arms.left.upperArm!].worldPosition;
            expect(distance(f.left.shoulderWorld, restLeftShoulder)).toBeLessThan(1e-9);
          }
        }
      });

      if (signName === 'COFFEE') {
        it('no overlapping upper arms (right and left elbows/shoulders stay clear of each other)', () => {
          const MIN_LIMB_CLEARANCE = 0.03;
          for (const f of result.frames) {
            expect(f.left).not.toBeNull();
            expect(distance(f.right.elbowWorld, f.left!.elbowWorld)).toBeGreaterThan(MIN_LIMB_CLEARANCE);
            expect(distance(f.right.elbowWorld, f.left!.shoulderWorld)).toBeGreaterThan(MIN_LIMB_CLEARANCE);
            expect(distance(f.left!.elbowWorld, f.right.shoulderWorld)).toBeGreaterThan(MIN_LIMB_CLEARANCE);
          }
        });
      }
    });
  }
});
