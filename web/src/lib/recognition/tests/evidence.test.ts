import { describe, expect, it } from 'vitest';
import { COFFEE } from '@/engine/signs';
import type { Frame } from '@/engine/landmarks';
import { measureRecognitionEvidence } from '../evidence';

const frame = (t: number, hands = 2, x = 50): Frame => ({
  t, width: 100, height: 100,
  hands: Array.from({ length: hands }, (_, index) => ({ handedness: index ? 'Left' : 'Right', points: Array.from({ length: 21 }, () => [x, 50, 0]) })),
  leftShoulder: [25, 40], rightShoulder: [75, 40], mouth: null, faceBlendshapes: null,
});

describe('raw recognition evidence', () => {
  it('counts observed hands before stabilization can replace one', () => {
    const evidence = measureRecognitionEvidence([frame(0), frame(0.1, 1)], COFFEE);
    expect(evidence.requiredHandCoverage).toBe(0.5);
  });

  it('keeps clipping and timing as normalized evidence', () => {
    const evidence = measureRecognitionEvidence([frame(0), frame(0.5, 2, 1)], COFFEE);
    expect(evidence.clippedFrameRatio).toBe(0.5);
    expect(evidence.durationSeconds).toBe(0.5);
    expect(evidence.maxFrameGapSeconds).toBe(0.5);
    expect(evidence.poseCoverage).toBe(1);
  });
});
