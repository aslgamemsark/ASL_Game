/**
 * Static fingerspelling letters: handshape discrimination + full-pose pass/fail. Mirrors
 * tests/test_vocabulary.py's TestHandshapeDiscrimination / TestStaticLetters.
 */
import { describe, it, expect } from 'vitest';
import { handshapeConfidence } from '../src/engine/handshape';
import { verify, resultPassed, resultFailingRequired } from '../src/engine/verifier';
import { RollingBuffer, type Frame, type Hand } from '../src/engine/landmarks';
import { LETTER_I, LETTER_W, LETTER_V } from '../src/engine/signs';

const S = 60;
const MCP: Record<string, [number, number]> = { index: [5, -0.3], middle: [9, -0.1], ring: [13, 0.1], pinky: [17, 0.3] };
const TIP: Record<string, number> = { index: 8, middle: 12, ring: 16, pinky: 20 };

function makeHand(
  center: [number, number],
  extended: string[] = [],
  thumbOut = false,
  handed: 'Left' | 'Right' = 'Right',
  spread = 1.0
): Hand {
  const [cx, cy] = center;
  const pts: [number, number, number][] = Array.from({ length: 21 }, () => [0, 0, 0]);
  pts[0] = [cx, cy + 0.5 * S, 0];
  const mcpY = cy - 0.2 * S;
  for (const [name, [mcpIdx, fx]] of Object.entries(MCP)) {
    pts[mcpIdx] = [cx + fx * S, mcpY, 0];
    const tipIdx = TIP[name];
    const tipFx = (name === 'index' || name === 'middle') ? fx * spread : fx;
    pts[tipIdx] = extended.includes(name) ? [cx + tipFx * S, mcpY - 0.9 * S, 0] : [cx + fx * S, mcpY + 0.15 * S, 0];
  }
  pts[2] = [cx - 0.3 * S, mcpY, 0];
  pts[4] = thumbOut ? [cx - 1.0 * S, mcpY, 0] : [cx - 0.25 * S, mcpY + 0.1 * S, 0];
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

describe('letter handshape discrimination', () => {
  it('w: three fingers passes, real V (2 fingers) does not', () => {
    const w = makeHand([0, 0], ['index', 'middle', 'ring']);
    expect(handshapeConfidence(w, 'w')).toBeGreaterThan(0.6);
    expect(handshapeConfidence(w, 'v')).toBeLessThan(0.6); // V needs ring curled
  });

  it('v: rejects a joined 2-finger hand (real U shape) — spread must be checked, not just extension', () => {
    const joined = makeHand([0, 0], ['index', 'middle'], false, 'Right', 0.3);
    expect(handshapeConfidence(joined, 'v')).toBeLessThan(0.6);
  });

  it('i: pinky-only with thumb tucked passes; Y (thumb+pinky) does not', () => {
    const i = makeHand([0, 0], ['pinky'], false);
    const y = makeHand([0, 0], ['pinky'], true);
    expect(handshapeConfidence(i, 'i')).toBeGreaterThan(0.6);
    expect(handshapeConfidence(y, 'i')).toBeLessThan(0.6);
  });
});

describe('static letters pass with their own handshape', () => {
  it('LETTER_W passes on a 3-finger hand', () => {
    const result = verify(staticBuffer((c) => makeHand(c, ['index', 'middle', 'ring'])), LETTER_W);
    expect(resultPassed(result)).toBe(true);
  });

  it('LETTER_I passes on a pinky-only, thumb-tucked hand', () => {
    const result = verify(staticBuffer((c) => makeHand(c, ['pinky'], false)), LETTER_I);
    expect(resultPassed(result)).toBe(true);
  });

  it('LETTER_I rejects a Y handshape (thumb+pinky out)', () => {
    const result = verify(staticBuffer((c) => makeHand(c, ['pinky'], true)), LETTER_I);
    expect(resultPassed(result)).toBe(false);
    expect(resultFailingRequired(result)).toContain('handshape_dominant');
  });

  it('LETTER_V is unaffected (still passes on 2-finger, fails on 3-finger)', () => {
    const pass = verify(staticBuffer((c) => makeHand(c, ['index', 'middle'], false, 'Right', 1.5)), LETTER_V);
    expect(resultPassed(pass)).toBe(true);
  });
});
