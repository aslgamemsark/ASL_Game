import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { resolveAnimationForSign } from '../animation/AnimationSource.ts';
import { quatAngleDeg } from '../calibration/math3d.ts';
import type { ReferencePoseMetadata } from '../reference/types.ts';

const YBOT_PATH = resolve(import.meta.dirname, '../../../public/models/avatar/ybot.glb');
const METADATA_DIR = resolve(import.meta.dirname, '../../../../reference_poses/metadata');

function loadYbot() {
  const raw = readFileSync(YBOT_PATH);
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const { json } = parseGlb(buffer);
  const hierarchy = buildHierarchy(json, YBOT_PATH);
  const calibration = buildCalibration(hierarchy, buffer);
  return { hierarchy, calibration };
}

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

describe('resolveAnimationForSign — priority chain (keyframe preferred, procedural IK fallback)', () => {
  it('falls back to procedural IK when zero reference poses exist for a sign that HAS a signPaths.ts entry', () => {
    const { hierarchy, calibration } = loadYbot();
    const result = resolveAnimationForSign(hierarchy, calibration, 'HELLO', []);
    expect(result.source).toBe('procedural');
    expect(result.proceduralDetail).toBeDefined();
    expect(result.frames.length).toBeGreaterThan(0);
  });

  it('falls back to procedural IK when only ONE reference pose exists (not enough to interpolate)', () => {
    const { hierarchy, calibration } = loadYbot();
    const onePose = [makePose('HELLO_only', 'HELLO', 1.0, { 'mixamorig:RightArm': { rotation: [0, 0, 0, 1], translation: [0, 0, 0] } })];
    const result = resolveAnimationForSign(hierarchy, calibration, 'HELLO', onePose);
    expect(result.source).toBe('procedural');
  });

  it('prefers keyframe-driven output when >=2 reference poses exist for a sign', () => {
    const { hierarchy, calibration } = loadYbot();
    const armBone = hierarchy.arms.right.upperArm!;
    const twoPoses = [
      makePose('HELLO_start', 'HELLO', 0.0, { [armBone]: { rotation: [0, 0, 0, 1], translation: [0, 0, 0] } }),
      makePose('HELLO_end', 'HELLO', 1.0, { [armBone]: { rotation: [0, 0.7071, 0, 0.7071], translation: [0, 0, 0] } }),
    ];
    const result = resolveAnimationForSign(hierarchy, calibration, 'HELLO', twoPoses);
    expect(result.source).toBe('keyframe');
    expect(result.proceduralDetail).toBeUndefined();
    expect(result.frames.every((f) => armBone in f)).toBe(true);
  });

  it('throws when a sign has neither reference poses nor a signPaths.ts entry (no source can produce it)', () => {
    const { hierarchy, calibration } = loadYbot();
    expect(() => resolveAnimationForSign(hierarchy, calibration, 'NOT_A_REAL_SIGN', [])).toThrow(/No animation source/);
  });

  it('a custom sourceChain can reorder/omit resolvers without touching the built-in ones', () => {
    const { hierarchy, calibration } = loadYbot();
    const alwaysDecline = () => null;
    expect(() =>
      resolveAnimationForSign(hierarchy, calibration, 'HELLO', [], { sourceChain: [alwaysDecline] })
    ).toThrow(/No animation source/);
  });
});

/**
 * Regression for the real HELLO baked-clip extraction (extractBakedAnimation.ts): pins that the
 * committed reference poses under reference_poses/metadata/ actually produce MOVING keyframe-driven
 * output, not a frozen single pose repeated every frame — the exact failure mode a bug in
 * KeyframeAnimator's interpolation could produce silently (all frames technically present, but
 * visually static). Skip-safe if this data hasn't been extracted yet (e.g. a fresh checkout before
 * `extractBakedAnimation.ts` has been run).
 */
describe('resolveAnimationForSign — real HELLO baked-clip data', () => {
  const helloPoseFiles = existsSync(METADATA_DIR)
    ? readdirSync(METADATA_DIR).filter((f) => f.startsWith('HELLO_bake') && f.endsWith('.json'))
    : [];

  if (helloPoseFiles.length < 2) {
    it('no baked HELLO reference poses committed yet — skipping (run extractBakedAnimation.ts to add them)', () => {
      expect(helloPoseFiles.length).toBeGreaterThanOrEqual(0);
    });
    return;
  }

  it('HELLO resolves to keyframe-driven output with real, non-frozen motion in RightForeArm/RightHand', () => {
    const { hierarchy, calibration } = loadYbot();
    const poses: ReferencePoseMetadata[] = readdirSync(METADATA_DIR)
      .filter((f) => f.endsWith('.json') && f !== 'index.json')
      .map((f) => JSON.parse(readFileSync(resolve(METADATA_DIR, f), 'utf-8')));

    const result = resolveAnimationForSign(hierarchy, calibration, 'HELLO', poses);
    expect(result.source).toBe('keyframe');

    const foreArmBone = hierarchy.arms.right.forearm!;
    const handBone = hierarchy.arms.right.hand!;

    let totalRangeDeg = 0;
    const first = result.frames[0][foreArmBone];
    expect(first).toBeDefined();
    for (const frame of result.frames) {
      const q = frame[foreArmBone];
      if (q) totalRangeDeg = Math.max(totalRangeDeg, quatAngleDeg(first, q));
    }
    // A real wave swings the forearm through a real angular range — a frozen/failed interpolation
    // would show ~0deg here regardless of frame count.
    expect(totalRangeDeg).toBeGreaterThan(10);

    // Frame-to-frame deltas should be smooth (bounded), not a discontinuous jump/glitch.
    for (let i = 1; i < result.frames.length; i++) {
      const a = result.frames[i - 1][handBone];
      const b = result.frames[i][handBone];
      if (a && b) expect(quatAngleDeg(a, b)).toBeLessThan(30);
    }
  });
});
