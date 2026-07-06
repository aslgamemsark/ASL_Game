/**
 * Confusor tests for the four new fingerspelling letters D, F, O, T. Mirrors
 * tests/test_letters_dfot.py — same hand builder shape and same validated coordinates.
 */
import { describe, it, expect } from 'vitest';
import { handshapeConfidence } from '../src/engine/handshape';
import { verify, resultPassed, resultFailingRequired } from '../src/engine/verifier';
import { RollingBuffer, type Frame, type Hand } from '../src/engine/landmarks';
import { LETTER_D, LETTER_F, LETTER_O, LETTER_T } from '../src/engine/signs';

const S = 60;
const MCP: Record<string, [number, number]> = { index: [5, -0.3], middle: [9, -0.1], ring: [13, 0.1], pinky: [17, 0.3] };
const TIP: Record<string, number> = { index: 8, middle: 12, ring: 16, pinky: 20 };

function makeHand(
  center: [number, number],
  curls: Record<string, number> = {},
  thumbOffset: [number, number] = [-1.0, 0.0],
  handed: 'Left' | 'Right' = 'Right'
): Hand {
  const [cx, cy] = center;
  const pts: [number, number, number][] = Array.from({ length: 21 }, () => [0, 0, 0]);
  pts[0] = [cx, cy + 0.5 * S, 0];
  const mcpY = cy - 0.2 * S;
  const extendedY = mcpY - 0.9 * S;
  const curledY = mcpY + 0.15 * S;
  for (const [name, [mcpIdx, fx]] of Object.entries(MCP)) {
    pts[mcpIdx] = [cx + fx * S, mcpY, 0];
    const c = curls[name] ?? 0.0;
    pts[TIP[name]] = [cx + fx * S, extendedY + c * (curledY - extendedY), 0];
  }
  pts[2] = [cx - 0.3 * S, mcpY, 0];
  pts[4] = [cx + thumbOffset[0] * S, cy + thumbOffset[1] * S, 0];
  return { handedness: handed, points: pts };
}

function staticBuffer(factory: (c: [number, number]) => Hand): RollingBuffer {
  const buf = new RollingBuffer(2.0);
  for (let i = 0; i < 20; i++) {
    const frame: Frame = {
      t: i * 0.1, width: 640, height: 480,
      hands: [factory([320, 240])],
      leftShoulder: [260, 200], rightShoulder: [380, 200], mouth: null,
      faceBlendshapes: null,
    };
    buf.add(frame);
  }
  return buf;
}

describe('LETTER_D', () => {
  it('passes with index up, thumb tucked', () => {
    const d = makeHand([0, 0], { middle: 1.0, ring: 1.0, pinky: 1.0 }, [-0.25, -0.10]);
    expect(handshapeConfidence(d, 'd')).toBeGreaterThan(0.6);
    const result = verify(staticBuffer((c) => makeHand(c, { middle: 1.0, ring: 1.0, pinky: 1.0 }, [-0.25, -0.10])), LETTER_D);
    expect(resultPassed(result)).toBe(true);
  });

  it('rejects L (thumb held out to the side)', () => {
    const ell = makeHand([0, 0], { middle: 1.0, ring: 1.0, pinky: 1.0 }, [-1.0, -0.05]);
    expect(handshapeConfidence(ell, 'd')).toBeLessThan(0.6);
    const result = verify(staticBuffer((c) => makeHand(c, { middle: 1.0, ring: 1.0, pinky: 1.0 }, [-1.0, -0.05])), LETTER_D);
    expect(resultPassed(result)).toBe(false);
    expect(resultFailingRequired(result)).toContain('handshape_dominant');
  });
});

describe('LETTER_F', () => {
  it('passes with thumb+index touching, other three extended', () => {
    const f = makeHand([0, 0], { index: 0.5 }, [-0.45, -0.75]);
    expect(handshapeConfidence(f, 'f')).toBeGreaterThan(0.6);
    const result = verify(staticBuffer((c) => makeHand(c, { index: 0.5 }, [-0.45, -0.75])), LETTER_F);
    expect(resultPassed(result)).toBe(true);
  });

  it('rejects a fully open hand', () => {
    const open = makeHand([0, 0], {}, [-1.0, -0.05]);
    expect(handshapeConfidence(open, 'f')).toBeLessThan(0.6);
    const result = verify(staticBuffer((c) => makeHand(c, {}, [-1.0, -0.05])), LETTER_F);
    expect(resultPassed(result)).toBe(false);
    expect(resultFailingRequired(result)).toContain('handshape_dominant');
  });
});

describe('LETTER_O', () => {
  it('passes with all fingertips curled toward the thumb', () => {
    const o = makeHand([0, 0], { index: 0.65, middle: 0.65, ring: 0.65, pinky: 0.65 }, [-0.15, -0.6]);
    expect(handshapeConfidence(o, 'o')).toBeGreaterThan(0.6);
    const result = verify(staticBuffer((c) => makeHand(c, { index: 0.65, middle: 0.65, ring: 0.65, pinky: 0.65 }, [-0.15, -0.6])), LETTER_O);
    expect(resultPassed(result)).toBe(true);
  });

  it('rejects a flat open hand', () => {
    const open = makeHand([0, 0], {}, [-1.0, -0.05]);
    expect(handshapeConfidence(open, 'o')).toBeLessThan(0.6);
  });

  it('rejects a full fist', () => {
    const fist = makeHand([0, 0], { index: 1.0, middle: 1.0, ring: 1.0, pinky: 1.0 }, [-0.25, -0.10]);
    expect(handshapeConfidence(fist, 'o')).toBeLessThan(0.6);
  });
});

describe('LETTER_T', () => {
  it('passes with fist + thumb wedged between index/middle knuckles', () => {
    const t = makeHand([0, 0], { index: 1.0, middle: 1.0, ring: 1.0, pinky: 1.0 }, [-0.1, -0.4]);
    expect(handshapeConfidence(t, 't')).toBeGreaterThan(0.6);
    const result = verify(staticBuffer((c) => makeHand(c, { index: 1.0, middle: 1.0, ring: 1.0, pinky: 1.0 }, [-0.1, -0.4])), LETTER_T);
    expect(resultPassed(result)).toBe(true);
  });

  it('rejects A (thumb held out alongside the index)', () => {
    const a = makeHand([0, 0], { index: 1.0, middle: 1.0, ring: 1.0, pinky: 1.0 }, [-1.0, -0.10]);
    expect(handshapeConfidence(a, 't')).toBeLessThan(0.6);
    const result = verify(staticBuffer((c) => makeHand(c, { index: 1.0, middle: 1.0, ring: 1.0, pinky: 1.0 }, [-1.0, -0.10])), LETTER_T);
    expect(resultPassed(result)).toBe(false);
    expect(resultFailingRequired(result)).toContain('handshape_dominant');
  });
});
