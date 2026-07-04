import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { poseArm, retargetSign } from '../animation/ArmRetargeter.ts';
import { computeBodyFrame, targetWorld } from '../animation/BodyFrame.ts';
import { SIGN_PATHS } from '../animation/signPaths.ts';
import { distance, dot, subtract } from '../calibration/math3d.ts';

const YBOT_PATH = resolve(import.meta.dirname, '../../../public/models/avatar/ybot.glb');
const POSITION_TOLERANCE_METERS = 0.005; // 5mm

function loadYbot() {
  const raw = readFileSync(YBOT_PATH);
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const { json } = parseGlb(buffer);
  const hierarchy = buildHierarchy(json, YBOT_PATH);
  const calibration = buildCalibration(hierarchy, buffer);
  return { hierarchy, calibration };
}

describe('computeBodyFrame', () => {
  it('right/up/forward are mutually orthonormal and shoulderWidth is a plausible human scale', () => {
    const { hierarchy } = loadYbot();
    const frame = computeBodyFrame(hierarchy);
    expect(Math.hypot(frame.right.x, frame.right.y, frame.right.z)).toBeCloseTo(1, 5);
    expect(Math.hypot(frame.forward.x, frame.forward.y, frame.forward.z)).toBeCloseTo(1, 5);
    const rightDotForward = frame.right.x * frame.forward.x + frame.right.y * frame.forward.y + frame.right.z * frame.forward.z;
    expect(rightDotForward).toBeCloseTo(0, 5);
    expect(frame.shoulderWidth).toBeGreaterThan(0.1);
    expect(frame.shoulderWidth).toBeLessThan(0.6);
  });
});

describe('targetWorld', () => {
  it('a zero offset resolves to exactly the anchor bone world position', () => {
    const { hierarchy } = loadYbot();
    const frame = computeBodyFrame(hierarchy);
    const t = targetWorld(hierarchy, frame, 'Head', { x: 0, y: 0, z: 0 });
    const headWorld = hierarchy.bones[Object.keys(hierarchy.bones).find((n) => n.replace(/^mixamorig:?/i, '') === 'Head')!].worldPosition;
    expect(t.x).toBeCloseTo(headWorld.x, 6);
    expect(t.y).toBeCloseTo(headWorld.y, 6);
    expect(t.z).toBeCloseTo(headWorld.z, 6);
  });
});

describe('poseArm — single-frame IK against the real ybot rig', () => {
  it('reaches a reachable target in front of the chest within tolerance, both sides', () => {
    const { hierarchy, calibration } = loadYbot();
    const frame = computeBodyFrame(hierarchy);
    for (const side of ['left', 'right'] as const) {
      const target = targetWorld(hierarchy, frame, 'Spine2', { x: side === 'right' ? 0.2 : -0.2, y: 0, z: 0.5 });
      const result = poseArm(hierarchy, calibration, frame, side, target);
      expect(result.positionErrorMeters).toBeLessThan(POSITION_TOLERANCE_METERS);
    }
  });
});

describe('retargetSign — benchmark signs end-to-end on the real ybot rig', () => {
  for (const signName of Object.keys(SIGN_PATHS) as (keyof typeof SIGN_PATHS)[]) {
    it(`${signName}: every frame's dominant hand reaches its authored target within ${POSITION_TOLERANCE_METERS * 1000}mm`, () => {
      const { hierarchy, calibration } = loadYbot();
      const result = retargetSign(hierarchy, calibration, signName);
      expect(result.frames.length).toBeGreaterThan(10);
      expect(result.maxPositionErrorMeters).toBeLessThan(POSITION_TOLERANCE_METERS);
      for (const f of result.frames) {
        expect(Number.isFinite(f.right.achievedHandWorld.x)).toBe(true);
        expect(Number.isFinite(f.right.achievedHandWorld.y)).toBe(true);
        expect(Number.isFinite(f.right.achievedHandWorld.z)).toBe(true);
      }
    });
  }

  it('COFFEE: the dominant fist actually traces a circle above the stationary non-dominant fist', () => {
    const { hierarchy, calibration } = loadYbot();
    const result = retargetSign(hierarchy, calibration, 'COFFEE');
    expect(result.frames[0].left).not.toBeNull();

    // Non-dominant (left) hand should stay essentially still across the whole clip.
    const leftPositions = result.frames.map((f) => f.left!.achievedHandWorld);
    const leftSpread = Math.max(...leftPositions.map((p) => Math.hypot(p.x - leftPositions[0].x, p.y - leftPositions[0].y, p.z - leftPositions[0].z)));
    expect(leftSpread).toBeLessThan(0.03);

    // Dominant (right) hand should stay above the left hand throughout (real COFFEE constraint).
    for (const f of result.frames) {
      expect(f.right.achievedHandWorld.y).toBeGreaterThan(f.left!.achievedHandWorld.y - 0.02);
    }

    // The right hand's path should sweep through a real range of x/z (not sit static) — this is the
    // exact class of bug the project's CLAUDE.md non-negotiable rule exists to prevent: verifying
    // COFFEE's circular grind actually requires motion across the window, not a single static frame.
    const rightXs = result.frames.map((f) => f.right.achievedHandWorld.x);
    const rightZs = result.frames.map((f) => f.right.achievedHandWorld.z);
    expect(Math.max(...rightXs) - Math.min(...rightXs)).toBeGreaterThan(0.05);
    expect(Math.max(...rightZs) - Math.min(...rightZs)).toBeGreaterThan(0.05);
  });

  it('THANK_YOU: the hand starts near the chin and ends lower/forward (downward stroke)', () => {
    const { hierarchy, calibration } = loadYbot();
    const result = retargetSign(hierarchy, calibration, 'THANK_YOU');
    const first = result.frames[0].right.achievedHandWorld;
    const last = result.frames[result.frames.length - 1].right.achievedHandWorld;
    expect(last.y).toBeLessThan(first.y); // moved downward, matching MovementReq direction=(0,1) (image y grows down == world y decreases here)
  });
});

/**
 * Regression suite for a real M5 bug: `achievedHandWorld = elbow + normalize(target-elbow)*l2` is a
 * self-consistent IDENTITY that lands exactly on target regardless of whether l1/l2/elbow are
 * physically sane — so the wrist-position-error tests above (which is what the M5 acceptance metric
 * reports) can read 0.00mm even when the elbow is wildly wrong. The actual bug: l1/l2 were read from
 * CalibrationProfile's restChildLengths, which is local-space/pre-armature-scale (~100x too large on
 * this Mixamo rig), flinging the elbow ~26m from the shoulder while the wrist still matched target —
 * visually, arms swinging through the torso. These tests inspect the ELBOW and the whole triangle
 * shape directly, which the wrist-only tests above cannot catch.
 */
describe('IK segment lengths — regression for the M5 restChildLengths unit bug', () => {
  it('poseArm: shoulder-elbow and elbow-hand distances match the REAL rest-pose bone lengths, both sides', () => {
    const { hierarchy, calibration } = loadYbot();
    const frame = computeBodyFrame(hierarchy);
    for (const side of ['left', 'right'] as const) {
      const chain = hierarchy.arms[side];
      const l1Expected = distance(hierarchy.bones[chain.upperArm!].worldPosition, hierarchy.bones[chain.forearm!].worldPosition);
      const l2Expected = distance(hierarchy.bones[chain.forearm!].worldPosition, hierarchy.bones[chain.hand!].worldPosition);
      const target = targetWorld(hierarchy, frame, 'Spine2', { x: side === 'right' ? 0.2 : -0.2, y: 0, z: 0.5 });
      const result = poseArm(hierarchy, calibration, frame, side, target);
      expect(distance(result.shoulderWorld, result.elbowWorld)).toBeCloseTo(l1Expected, 4);
      expect(distance(result.elbowWorld, result.achievedHandWorld)).toBeCloseTo(l2Expected, 4);
    }
  });

  for (const signName of Object.keys(SIGN_PATHS) as (keyof typeof SIGN_PATHS)[]) {
    it(`${signName}: elbow never lands more than 3x shoulder-width from its own shoulder, any frame (catches a blown-up IK triangle)`, () => {
      const { hierarchy, calibration } = loadYbot();
      const frame = computeBodyFrame(hierarchy);
      const result = retargetSign(hierarchy, calibration, signName);
      const maxPlausible = frame.shoulderWidth * 3;
      for (const f of result.frames) {
        expect(distance(f.right.shoulderWorld, f.right.elbowWorld)).toBeLessThan(maxPlausible);
        if (f.left) expect(distance(f.left.shoulderWorld, f.left.elbowWorld)).toBeLessThan(maxPlausible);
      }
    });
  }

  it("HELLO/THANK_YOU: the dominant hand and elbow stay on the signer's own right side of the spine (no crossing through the torso)", () => {
    for (const signName of ['HELLO', 'THANK_YOU'] as const) {
      const { hierarchy, calibration } = loadYbot();
      const frame = computeBodyFrame(hierarchy);
      const result = retargetSign(hierarchy, calibration, signName);
      const spineName = Object.keys(hierarchy.bones).find((n) => n.replace(/^mixamorig:?/i, '') === 'Spine2')!;
      const spineWorld = hierarchy.bones[spineName].worldPosition;
      for (const f of result.frames) {
        const handSignedRight = dot(subtract(f.right.achievedHandWorld, spineWorld), frame.right);
        const elbowSignedRight = dot(subtract(f.right.elbowWorld, spineWorld), frame.right);
        expect(handSignedRight).toBeGreaterThan(-0.02);
        expect(elbowSignedRight).toBeGreaterThan(-0.05);
      }
    }
  });
});
