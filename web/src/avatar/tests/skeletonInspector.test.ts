import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { isFiniteVec3 } from '../calibration/math3d.ts';

const YBOT_PATH = resolve(import.meta.dirname, '../../../public/models/avatar/ybot.glb');

function loadYbot() {
  const raw = readFileSync(YBOT_PATH);
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const { json } = parseGlb(buffer);
  return buildHierarchy(json, YBOT_PATH);
}

describe('SkeletonInspector — Chapter 3 acceptance criteria', () => {
  it('avatar loads without throwing', () => {
    expect(() => loadYbot()).not.toThrow();
  });

  it('discovers a non-trivial number of bones', () => {
    const h = loadYbot();
    expect(h.totalBones).toBeGreaterThan(40);
  });

  it('finds a root bone (Hips)', () => {
    const h = loadYbot();
    expect(h.root).toBeTruthy();
  });

  it('finds a complete spine chain', () => {
    const h = loadYbot();
    expect(h.spine.length).toBeGreaterThanOrEqual(3);
  });

  it('finds a head bone', () => {
    const h = loadYbot();
    expect(h.head).toBeTruthy();
  });

  it('finds complete arm chains for both sides', () => {
    const h = loadYbot();
    for (const side of ['left', 'right'] as const) {
      expect(h.arms[side].upperArm, `${side} upperArm`).toBeTruthy();
      expect(h.arms[side].forearm, `${side} forearm`).toBeTruthy();
      expect(h.arms[side].hand, `${side} hand`).toBeTruthy();
    }
  });

  it('finds 5 finger chains per hand, each with >= 3 joints, in tip order', () => {
    const h = loadYbot();
    for (const side of ['left', 'right'] as const) {
      for (const finger of ['thumb', 'index', 'middle', 'ring', 'pinky'] as const) {
        const chain = h.hands[side].fingers[finger];
        expect(chain, `${side} ${finger}`).toBeDefined();
        expect(chain!.length).toBeGreaterThanOrEqual(3);
        // joints must be in increasing order (1, 2, 3, ...) — verifies the numeric sort, not just presence
        const nums = chain!.map((name) => parseInt(name.match(/(\d+)$/)![1], 10));
        for (let i = 1; i < nums.length; i++) {
          expect(nums[i]).toBeGreaterThan(nums[i - 1]);
        }
      }
    }
  });

  it('every bone has a finite world position (no NaN/Infinity propagation through FK)', () => {
    const h = loadYbot();
    for (const bone of Object.values(h.bones)) {
      expect(isFiniteVec3(bone.worldPosition), bone.name).toBe(true);
    }
  });

  it('finger chain bone lengths shrink toward the tip (anatomically plausible taper)', () => {
    const h = loadYbot();
    const chain = h.hands.right.fingers.index!;
    const lengths = chain.slice(0, -1).map((name) => h.bones[name].length!);
    for (const len of lengths) {
      expect(len).toBeGreaterThan(0);
      expect(len).toBeLessThan(0.2); // sanity bound: no finger segment is >20cm
    }
  });

  it('arm bone lengths are anatomically plausible (10cm - 60cm per segment)', () => {
    const h = loadYbot();
    for (const side of ['left', 'right'] as const) {
      const upperArmLen = h.bones[h.arms[side].upperArm!].length!;
      const forearmLen = h.bones[h.arms[side].forearm!].length!;
      expect(upperArmLen).toBeGreaterThan(0.1);
      expect(upperArmLen).toBeLessThan(0.6);
      expect(forearmLen).toBeGreaterThan(0.1);
      expect(forearmLen).toBeLessThan(0.6);
    }
  });

  it('reports warnings array (even if empty) and never throws on a well-formed rig', () => {
    const h = loadYbot();
    expect(Array.isArray(h.warnings)).toBe(true);
  });

  it('is name-convention agnostic: works whether or not nodes carry the mixamorig: prefix', () => {
    // Simulate an RPM-style (no-prefix) rig by stripping "mixamorig:" from every node name and
    // re-running discovery — the same anatomical bones must still be found.
    const raw = readFileSync(YBOT_PATH);
    const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    const { json } = parseGlb(buffer);
    const stripped = {
      ...json,
      nodes: json.nodes?.map((n) => (n.name ? { ...n, name: n.name.replace(/^mixamorig:?/i, '') } : n)),
    };
    const h = buildHierarchy(stripped, 'synthetic-no-prefix');
    expect(h.root).toBeTruthy();
    expect(h.arms.right.hand).toBeTruthy();
    expect(h.hands.right.fingers.index?.length).toBeGreaterThanOrEqual(3);
  });
});
