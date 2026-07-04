import { describe, it, expect } from 'vitest';
import { verify, resultPassed, resultGet } from '../src/engine/verifier';
import { RollingBuffer, type Frame, type Hand } from '../src/engine/landmarks';
import { DOMINANT, Anchor, MovementKind, createSign } from '../src/engine/schema';
import { HELLO } from '../src/engine/signs';

const OPEN_HAND: Hand = {
  handedness: 'Right',
  points: [
    [320, 300, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
    [293, 220, 0], [293, 130, 0], [0, 0, 0], [293, 130, 0],
    [311, 220, 0], [311, 130, 0], [0, 0, 0], [311, 130, 0],
    [329, 220, 0], [329, 130, 0], [0, 0, 0], [329, 130, 0],
    [347, 220, 0], [347, 130, 0], [0, 0, 0], [347, 130, 0],
  ],
};

const BROWS_UP = createSign({
  name: '_TEST_BROWS_UP',
  twoHanded: false,
  dominant: { kind: 'open', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
  nmm: { blendshape: 'browInnerUp', minScore: 0.5 },
});

function buffer(blendshapeScore: number | null): RollingBuffer {
  const buf = new RollingBuffer(2.0);
  for (let i = 0; i < 20; i++) {
    const frame: Frame = {
      t: i * 0.1, width: 640, height: 480,
      hands: [OPEN_HAND],
      leftShoulder: [260, 200], rightShoulder: [380, 200], mouth: null,
      faceBlendshapes: blendshapeScore !== null ? { browInnerUp: blendshapeScore } : null,
    };
    buf.add(frame);
  }
  return buf;
}

describe('nmm scoring', () => {
  it('high blendshape score clears threshold', () => {
    const p = resultGet(verify(buffer(0.9), BROWS_UP), 'nmm');
    expect(p).toBeDefined();
    expect(p!.score).toBeGreaterThanOrEqual(p!.threshold);
  });

  it('low blendshape score does not clear', () => {
    const p = resultGet(verify(buffer(0.1), BROWS_UP), 'nmm');
    expect(p).toBeDefined();
    expect(p!.score).toBeLessThan(p!.threshold);
  });

  it('no face data scores 0 but never gates an optional nmm', () => {
    const result = verify(buffer(null), BROWS_UP);
    const p = resultGet(result, 'nmm');
    expect(p!.score).toBe(0);
    expect(resultPassed(result)).toBe(true);
  });

  it('is fully additive: HELLO (no nmm) is unaffected', () => {
    const result = verify(new RollingBuffer(2.0), HELLO);
    expect(resultGet(result, 'nmm')).toBeUndefined();
  });
});
