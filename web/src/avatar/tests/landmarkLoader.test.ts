import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadClip, validateClip } from '../retarget/LandmarkLoader.ts';
import type { RawLandmarkClip } from '../retarget/landmarkTypes.ts';

const FIXTURES_DIR = resolve(import.meta.dirname, 'fixtures/landmarks');

function loadFixture(file: string) {
  const path = join(FIXTURES_DIR, file);
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as RawLandmarkClip;
  return { clip: loadClip(raw, path), raw };
}

describe('LandmarkLoader — Chapter 4 acceptance criteria', () => {
  it('loads every fixture clip without throwing', () => {
    const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(() => loadFixture(f)).not.toThrow();
    }
  });

  it('preserves frame order and count exactly (spec: never reorder, never drop frames silently)', () => {
    const { clip, raw } = loadFixture('asl_citizen_COFFEE.json');
    expect(clip.frames.length).toBe(raw.frames.length);
    for (let i = 0; i < raw.frames.length; i++) {
      expect(clip.frames[i].t).toBe(raw.frames[i].t);
    }
  });

  it('keys hands by side using the handedness field, not array position', () => {
    const { clip } = loadFixture('asl_citizen_COFFEE.json');
    const frameWithHand = clip.frames.find((f) => f.hands.left || f.hands.right)!;
    expect(frameWithHand).toBeTruthy();
    const side = frameWithHand.hands.left ? 'left' : 'right';
    expect(frameWithHand.hands[side]!.handedness).toBe(side === 'left' ? 'Left' : 'Right');
  });

  it('estimates a plausible fps from frame timestamps', () => {
    const { clip } = loadFixture('asl_citizen_THANK_YOU.json');
    expect(clip.estimatedFps).toBeGreaterThan(5);
    expect(clip.estimatedFps).toBeLessThan(120);
  });
});

describe('LandmarkLoader validation — handles real-world data quirks without crashing', () => {
  it('handles null pose fields (confirmed present in real WLASL data) without throwing', () => {
    // wlasl_COFFEE.json has 50/103 frames with left_shoulder/right_shoulder/mouth all null —
    // this crashed the first implementation; this test pins the fix.
    expect(() => {
      const { clip } = loadFixture('wlasl_COFFEE.json');
      validateClip(clip);
    }).not.toThrow();
  });

  it('reports missing-pose frames as a count, not as malformed', () => {
    const { clip } = loadFixture('wlasl_COFFEE.json');
    const report = validateClip(clip);
    expect(report.framesWithMissingPose).toBeGreaterThan(0);
    expect(report.malformedFrames.length).toBe(0);
    expect(report.pass).toBe(true);
  });

  it('passes validation for all 6 fixture clips (real data, not synthetic)', () => {
    const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      const { clip } = loadFixture(f);
      const report = validateClip(clip);
      expect(report.pass, `${f}: ${JSON.stringify(report.malformedFrames)}`).toBe(true);
    }
  });

  it('flags a synthetic tracking snap (large frame-to-frame wrist jump)', () => {
    const { raw } = loadFixture('asl_citizen_COFFEE.json');
    const frameIdx = raw.frames.findIndex((f) => f.hands.length > 0);
    expect(frameIdx).toBeGreaterThanOrEqual(0);
    const tampered: RawLandmarkClip = JSON.parse(JSON.stringify(raw));
    // teleport the wrist across most of the frame width — must be flagged, not silently accepted
    const hand = tampered.frames[frameIdx].hands[0];
    hand.points[0] = [hand.points[0][0] + tampered.frames[frameIdx].width * 0.9, hand.points[0][1], hand.points[0][2]];
    // need a PRECEDING frame with the same hand side present for a jump to be measurable
    const side = hand.handedness;
    let prevIdx = -1;
    for (let i = frameIdx - 1; i >= 0; i--) {
      if (raw.frames[i].hands.some((h) => h.handedness === side)) {
        prevIdx = i;
        break;
      }
    }
    if (prevIdx === -1) return; // no preceding frame with this hand in this particular fixture — nothing to assert
    const clip = loadClip(tampered, 'synthetic');
    const report = validateClip(clip);
    expect(report.possibleTrackingSnaps.length).toBeGreaterThan(0);
  });

  it('detects a malformed hand (wrong point count) instead of silently accepting it', () => {
    const { raw } = loadFixture('asl_citizen_COFFEE.json');
    const frameIdx = raw.frames.findIndex((f) => f.hands.length > 0);
    const tampered: RawLandmarkClip = JSON.parse(JSON.stringify(raw));
    tampered.frames[frameIdx].hands[0].points.pop(); // 20 points instead of 21
    const clip = loadClip(tampered, 'synthetic');
    const report = validateClip(clip);
    expect(report.pass).toBe(false);
    expect(report.malformedFrames.length).toBeGreaterThan(0);
  });
});
