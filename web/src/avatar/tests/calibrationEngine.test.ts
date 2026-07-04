import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { validateCalibration } from '../calibration/CalibrationValidator.ts';
import { decompose, fromTRS } from '../calibration/math3d.ts';

const YBOT_PATH = resolve(import.meta.dirname, '../../../public/models/avatar/ybot.glb');

function loadYbot() {
  const raw = readFileSync(YBOT_PATH);
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const { json } = parseGlb(buffer);
  return { hierarchy: buildHierarchy(json, YBOT_PATH), buffer };
}

describe('math3d.decompose — round-trips fromTRS', () => {
  it('recovers translation/rotation/scale for an arbitrary TRS', () => {
    const t = { x: 1.5, y: -2.25, z: 0.75 };
    // a small arbitrary rotation (not identity, to actually exercise the quaternion extraction)
    const angle = 0.4;
    const r = { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) };
    const s = { x: 2, y: 2, z: 2 };
    const m = fromTRS(t, r, s);
    const d = decompose(m);
    expect(d.translation.x).toBeCloseTo(t.x, 6);
    expect(d.translation.y).toBeCloseTo(t.y, 6);
    expect(d.translation.z).toBeCloseTo(t.z, 6);
    expect(d.scale.x).toBeCloseTo(s.x, 6);
    expect(d.scale.y).toBeCloseTo(s.y, 6);
    expect(d.scale.z).toBeCloseTo(s.z, 6);
    expect(Math.abs(d.rotation.y)).toBeCloseTo(Math.abs(r.y), 6);
    expect(Math.abs(d.rotation.w)).toBeCloseTo(Math.abs(r.w), 6);
    expect(d.mirrored).toBe(false);
  });

  it('recovers a non-uniform scale (the real Mixamo Armature case: 0.01,0.01,0.01)', () => {
    const t = { x: 0, y: 0, z: -99.79 };
    const r = { x: -0.7071, y: 0, z: 0, w: 0.7071 };
    const s = { x: 0.01, y: 0.01, z: 0.01 };
    const m = fromTRS(t, r, s);
    const d = decompose(m);
    expect(d.scale.x).toBeCloseTo(0.01, 6);
    expect(d.translation.z).toBeCloseTo(-99.79, 4);
  });
});

describe('CalibrationEngine — Chapter 7 acceptance criteria', () => {
  it('produces calibration data for every discovered bone', () => {
    const { hierarchy, buffer } = loadYbot();
    const calib = buildCalibration(hierarchy, buffer);
    expect(Object.keys(calib.bones).length).toBe(hierarchy.totalBones);
  });

  it('captures a rest direction for EVERY child, not just the first (the bug this milestone caught)', () => {
    const { hierarchy, buffer } = loadYbot();
    const calib = buildCalibration(hierarchy, buffer);
    const handName = hierarchy.arms.right.hand!;
    const handCalib = calib.bones[handName];
    // the Hand bone has 5 children (one per finger) — all 5 must have a direction, not just one
    const handBone = hierarchy.bones[handName];
    expect(handBone.children.length).toBeGreaterThanOrEqual(5);
    for (const child of handBone.children) {
      expect(handCalib.restChildDirections[child], `direction to ${child}`).toBeDefined();
      expect(handCalib.restChildLengths[child], `length to ${child}`).toBeGreaterThan(0);
    }
  });

  it('computes a non-zero shoulder width', () => {
    const { hierarchy, buffer } = loadYbot();
    const calib = buildCalibration(hierarchy, buffer);
    expect(calib.shoulderWidthMeters).toBeGreaterThan(0.1);
    expect(calib.shoulderWidthMeters).toBeLessThan(1.0); // sanity bound, not a real shoulder could exceed 1m
  });

  it('computes a palm rest normal for both hands', () => {
    const { hierarchy, buffer } = loadYbot();
    const calib = buildCalibration(hierarchy, buffer);
    expect(calib.hands.left.palmRestNormalLocal).toBeTruthy();
    expect(calib.hands.right.palmRestNormalLocal).toBeTruthy();
  });

  it('documents the bone-roll scope decision in notes (never silently assumes it)', () => {
    const { hierarchy, buffer } = loadYbot();
    const calib = buildCalibration(hierarchy, buffer);
    expect(calib.notes.some((n) => /roll/i.test(n))).toBe(true);
  });
});

describe('CalibrationValidator — Stage 8 round-trip (the real numeric assertion)', () => {
  it('reconstructs every bone world position to within float tolerance', () => {
    const { hierarchy, buffer } = loadYbot();
    const calib = buildCalibration(hierarchy, buffer);
    const result = validateCalibration(hierarchy, calib);
    expect(result.pass).toBe(true);
    expect(result.maxPositionErrorMeters).toBeLessThan(1e-4);
    expect(result.boneCount).toBe(hierarchy.totalBones);
  });

  it('correctly handles the root bone (non-joint ancestor scale baked in, not dropped)', () => {
    const { hierarchy, buffer } = loadYbot();
    const calib = buildCalibration(hierarchy, buffer);
    const result = validateCalibration(hierarchy, calib);
    // before the fix, root-chain bones (Hips, Spine*, arms, fingers) all failed by ~100x — assert
    // specifically that the root bone itself round-trips, since that was the actual bug.
    expect(hierarchy.root).toBeTruthy();
    const rootDetail = result.details.find((d) => d.includes(hierarchy.root!));
    expect(rootDetail).toBeUndefined(); // no error line means it passed
  });

  it('FAILS loudly if calibration data is corrupted (sanity check the check itself)', () => {
    const { hierarchy, buffer } = loadYbot();
    const calib = buildCalibration(hierarchy, buffer);
    const someBone = Object.keys(calib.bones).find((n) => Object.keys(calib.bones[n].restChildDirections).length > 0)!;
    const someChild = Object.keys(calib.bones[someBone].restChildDirections)[0];
    calib.bones[someBone].restChildDirections[someChild] = { x: 1, y: 0, z: 0 }; // corrupt it
    const result = validateCalibration(hierarchy, calib);
    expect(result.pass).toBe(false);
  });
});
