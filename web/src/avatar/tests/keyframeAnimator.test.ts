import { describe, expect, it } from 'vitest';
import { buildKeyframeAnimation, groupKeyframesBySign, interpolateBoneRotation } from '../animation/KeyframeAnimator.ts';
import { quatAngleDeg, quatFromUnitVectors } from '../calibration/math3d.ts';
import type { ReferencePoseMetadata } from '../reference/types.ts';

const REST: [number, number, number, number] = [0, 0, 0, 1];
const QUARTER_TURN_Y = quatFromUnitVectors({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
const HALF_TURN_Y = quatFromUnitVectors({ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 });

function makePose(poseId: string, signName: string, frameFraction: number, bones: ReferencePoseMetadata['bones']): ReferencePoseMetadata {
  return {
    poseId,
    signName,
    frameFraction,
    sourceGlb: `glb/${poseId}.glb`,
    avatarVersion: 'test',
    generatorVersion: 'test',
    extractedAt: new Date().toISOString(),
    bones,
  };
}

describe('groupKeyframesBySign', () => {
  it('groups by signName and sorts by frameFraction ascending', () => {
    const poses = [
      makePose('HELLO_end', 'HELLO', 1.0, {}),
      makePose('HELLO_start', 'HELLO', 0.0, {}),
      makePose('HELLO_mid', 'HELLO', 0.5, {}),
      makePose('COFFEE_start', 'COFFEE', 0.0, {}),
    ];
    const grouped = groupKeyframesBySign(poses);
    expect(grouped.get('HELLO')!.map((p) => p.poseId)).toEqual(['HELLO_start', 'HELLO_mid', 'HELLO_end']);
    expect(grouped.get('COFFEE')!.map((p) => p.poseId)).toEqual(['COFFEE_start']);
  });

  it('throws on two poses at the same frameFraction for the same sign (ambiguous)', () => {
    const poses = [makePose('A', 'HELLO', 0.5, {}), makePose('B', 'HELLO', 0.5, {})];
    expect(() => groupKeyframesBySign(poses)).toThrow(/ambiguous/i);
  });
});

describe('interpolateBoneRotation', () => {
  const kfs = [
    makePose('start', 'HELLO', 0.0, { 'mixamorig:RightArm': { rotation: REST, translation: [0, 0, 0] } }),
    makePose('end', 'HELLO', 1.0, { 'mixamorig:RightArm': { rotation: [QUARTER_TURN_Y.x, QUARTER_TURN_Y.y, QUARTER_TURN_Y.z, QUARTER_TURN_Y.w], translation: [0, 0, 0] } }),
  ];

  it('returns exactly the keyframe rotation at its own frameFraction', () => {
    const at0 = interpolateBoneRotation(kfs, 'mixamorig:RightArm', 0.0)!;
    expect(quatAngleDeg(at0, { x: 0, y: 0, z: 0, w: 1 })).toBeCloseTo(0, 4);
    const at1 = interpolateBoneRotation(kfs, 'mixamorig:RightArm', 1.0)!;
    expect(quatAngleDeg(at1, QUARTER_TURN_Y)).toBeCloseTo(0, 4);
  });

  it('interpolates smoothly between two keyframes (halfway is not equal to either endpoint)', () => {
    const mid = interpolateBoneRotation(kfs, 'mixamorig:RightArm', 0.5)!;
    expect(quatAngleDeg(mid, { x: 0, y: 0, z: 0, w: 1 })).toBeGreaterThan(1);
    expect(quatAngleDeg(mid, QUARTER_TURN_Y)).toBeGreaterThan(1);
  });

  it('clamps outside [0,1] to the nearest keyframe', () => {
    const before = interpolateBoneRotation(kfs, 'mixamorig:RightArm', -0.5)!;
    expect(quatAngleDeg(before, { x: 0, y: 0, z: 0, w: 1 })).toBeCloseTo(0, 4);
    const after = interpolateBoneRotation(kfs, 'mixamorig:RightArm', 1.5)!;
    expect(quatAngleDeg(after, QUARTER_TURN_Y)).toBeCloseTo(0, 4);
  });

  it('returns null (never invents) for a bone missing from the bracketing keyframes', () => {
    expect(interpolateBoneRotation(kfs, 'mixamorig:LeftArm', 0.5)).toBeNull();
  });

  it('returns null for an empty keyframe list', () => {
    expect(interpolateBoneRotation([], 'mixamorig:RightArm', 0.5)).toBeNull();
  });
});

describe('buildKeyframeAnimation', () => {
  const kfs = [
    makePose('start', 'HELLO', 0.0, {
      'mixamorig:RightArm': { rotation: REST, translation: [0, 0, 0] },
      'mixamorig:RightForeArm': { rotation: REST, translation: [0, 0, 0] },
    }),
    makePose('mid', 'HELLO', 0.5, {
      'mixamorig:RightArm': { rotation: [QUARTER_TURN_Y.x, QUARTER_TURN_Y.y, QUARTER_TURN_Y.z, QUARTER_TURN_Y.w], translation: [0, 0, 0] },
      // RightForeArm intentionally omitted at this keyframe
    }),
    makePose('end', 'HELLO', 1.0, {
      'mixamorig:RightArm': { rotation: [HALF_TURN_Y.x, HALF_TURN_Y.y, HALF_TURN_Y.z, HALF_TURN_Y.w], translation: [0, 0, 0] },
      'mixamorig:RightForeArm': { rotation: REST, translation: [0, 0, 0] },
    }),
  ];

  it('produces exactly frameCount frames', () => {
    const frames = buildKeyframeAnimation(kfs, 20);
    expect(frames.length).toBe(20);
  });

  it('covers the union of bones across all keyframes', () => {
    const frames = buildKeyframeAnimation(kfs, 10);
    const allKeys = new Set(frames.flatMap((f) => Object.keys(f)));
    expect(allKeys.has('mixamorig:RightArm')).toBe(true);
    expect(allKeys.has('mixamorig:RightForeArm')).toBe(true);
  });

  it('omits a bone from a frame whose bracket is missing it, rather than inventing a value', () => {
    const frames = buildKeyframeAnimation(kfs, 11); // t values include exactly 0.5 (frame index 5)
    const midFrame = frames[5];
    expect(midFrame['mixamorig:RightForeArm']).toBeUndefined();
    expect(midFrame['mixamorig:RightArm']).toBeDefined();
  });

  it('throws when given fewer than 2 keyframes', () => {
    expect(() => buildKeyframeAnimation([kfs[0]], 10)).toThrow(/>=2/);
  });
});
