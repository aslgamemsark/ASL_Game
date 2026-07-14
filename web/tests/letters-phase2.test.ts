/**
 * Confusor tests for Phase 2 fingerspelling letters: G, H, K, N, P, Q, R, U. Mirrors
 * tests/test_letters_phase2.py — same hand builder shape and same validated coordinates.
 */
import { describe, it, expect } from 'vitest';
import { handshapeConfidence } from '../src/engine/handshape';
import { verify, resultPassed, resultFailingRequired } from '../src/engine/verifier';
import { RollingBuffer, type Frame, type Hand } from '../src/engine/landmarks';
import {
  LETTER_G, LETTER_H, LETTER_K, LETTER_N, LETTER_P, LETTER_Q, LETTER_R, LETTER_U,
} from '../src/engine/signs';

const S = 60;
const MCP: Record<string, [number, number]> = { index: [5, -0.3], middle: [9, -0.1], ring: [13, 0.1], pinky: [17, 0.3] };
const TIP: Record<string, number> = { index: 8, middle: 12, ring: 16, pinky: 20 };
const PIP: Record<string, number> = { middle: 10 }; // needed for _p_thumb_pos (checks MIDDLE_PIP)
const WRIST = 0;
const THUMB_TIP = 4;

function makeHand(
  center: [number, number],
  curls: Record<string, number> = {},
  thumbOffset: [number, number] = [-1.0, 0.0],
  rotateDeg = 0,
  handed: 'Left' | 'Right' = 'Right',
  spreadMult = 1.0
): Hand {
  const [cx, cy] = center;
  const pts: [number, number, number][] = Array.from({ length: 21 }, () => [0, 0, 0]);
  pts[WRIST] = [cx, cy + 0.5 * S, 0];
  const mcpY = cy - 0.2 * S;
  const extendedY = mcpY - 0.9 * S;
  const curledY = mcpY + 0.15 * S;
  for (const [name, [mcpIdx, fx]] of Object.entries(MCP)) {
    pts[mcpIdx] = [cx + fx * S, mcpY, 0];
    const c = curls[name] ?? 0.0;
    const tipFx = (name === 'index' || name === 'middle') ? fx * spreadMult : fx;
    const tipY = extendedY + c * (curledY - extendedY);
    pts[TIP[name]] = [cx + tipFx * S, tipY, 0];
    if (name in PIP) {
      const pipX = (pts[mcpIdx][0] + (cx + tipFx * S)) / 2;
      const pipY = (pts[mcpIdx][1] + tipY) / 2;
      pts[PIP[name]] = [pipX, pipY, 0];
    }
  }
  pts[2] = [cx - 0.3 * S, mcpY, 0];
  pts[THUMB_TIP] = [cx + thumbOffset[0] * S, cy + thumbOffset[1] * S, 0];

  if (rotateDeg) {
    const [ox, oy] = pts[WRIST];
    const rad = (rotateDeg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    for (const p of pts) {
      const dx = p[0] - ox, dy = p[1] - oy;
      p[0] = ox + dx * cos - dy * sin;
      p[1] = oy + dx * sin + dy * cos;
    }
  }
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

describe('LETTER_G / LETTER_Q (orientation)', () => {
  it('G passes sideways, rejects upright (that would be L)', () => {
    const g = makeHand([0, 0], { middle: 1.0, ring: 1.0, pinky: 1.0 }, [-1.0, -0.05], 90);
    expect(handshapeConfidence(g, 'g')).toBeGreaterThan(0.6);
    const upright = makeHand([0, 0], { middle: 1.0, ring: 1.0, pinky: 1.0 }, [-1.0, -0.05], 0);
    expect(handshapeConfidence(upright, 'g')).toBeLessThan(0.6);

    const result = verify(staticBuffer((c) => makeHand(c, { middle: 1.0, ring: 1.0, pinky: 1.0 }, [-1.0, -0.05], 90)), LETTER_G);
    expect(resultPassed(result)).toBe(true);
  });

  it('Q passes downward, rejects sideways (that would be G)', () => {
    const q = makeHand([0, 0], { middle: 1.0, ring: 1.0, pinky: 1.0 }, [-1.0, -0.05], 180);
    expect(handshapeConfidence(q, 'q')).toBeGreaterThan(0.6);
    const gOrientation = makeHand([0, 0], { middle: 1.0, ring: 1.0, pinky: 1.0 }, [-1.0, -0.05], 90);
    expect(handshapeConfidence(gOrientation, 'q')).toBeLessThan(0.6);
  });
});

describe('LETTER_H / LETTER_U (together + orientation)', () => {
  it('H passes sideways, rejects upright (that would be U orientation)', () => {
    const h = makeHand([0, 0], { ring: 1.0, pinky: 1.0 }, [-0.25, -0.10], 74.2, 'Right', 0.15);
    expect(handshapeConfidence(h, 'letter_h')).toBeGreaterThan(0.6);
    const upright = makeHand([0, 0], { ring: 1.0, pinky: 1.0 }, [-0.25, -0.10], -15.8, 'Right', 0.15);
    expect(handshapeConfidence(upright, 'letter_h')).toBeLessThan(0.6);

    const result = verify(staticBuffer((c) => makeHand(c, { ring: 1.0, pinky: 1.0 }, [-0.25, -0.10], 74.2, 'Right', 0.15)), LETTER_H);
    expect(resultPassed(result)).toBe(true);
  });

  it('U passes upright + together, rejects spread (that would be V)', () => {
    const u = makeHand([0, 0], { ring: 1.0, pinky: 1.0 }, [-0.25, -0.10], -15.8, 'Right', 0.15);
    expect(handshapeConfidence(u, 'u')).toBeGreaterThan(0.6);
    const v = makeHand([0, 0], { ring: 1.0, pinky: 1.0 }, [-0.25, -0.10], 0, 'Right', 1.5);
    expect(handshapeConfidence(v, 'u')).toBeLessThan(0.6);

    const result = verify(staticBuffer((c) => makeHand(c, { ring: 1.0, pinky: 1.0 }, [-0.25, -0.10], -15.8, 'Right', 0.15)), LETTER_U);
    expect(resultPassed(result)).toBe(true);
    const rejected = verify(staticBuffer((c) => makeHand(c, { ring: 1.0, pinky: 1.0 }, [-0.25, -0.10], 0, 'Right', 1.5)), LETTER_U);
    expect(resultPassed(rejected)).toBe(false);
    expect(resultFailingRequired(rejected)).toContain('handshape_dominant');
  });
});

describe('LETTER_K / LETTER_P (spread + thumb-touch + orientation)', () => {
  it('K passes with spread + thumb touching middle base, rejects plain V', () => {
    const k = makeHand([0, 0], { ring: 1.0, pinky: 1.0 }, [-0.15, -0.55], 0, 'Right', 1.5);
    expect(handshapeConfidence(k, 'k')).toBeGreaterThan(0.6);
    const v = makeHand([0, 0], { ring: 1.0, pinky: 1.0 }, [-1.0, -0.05], 0, 'Right', 1.5);
    expect(handshapeConfidence(v, 'k')).toBeLessThan(0.6);

    const result = verify(staticBuffer((c) => makeHand(c, { ring: 1.0, pinky: 1.0 }, [-0.15, -0.55], 0, 'Right', 1.5)), LETTER_K);
    expect(resultPassed(result)).toBe(true);
  });

  it('P passes downward, rejects upright (that would be K)', () => {
    // thumb lands near MIDDLE_PIP after rotation; upright fails orientation check. 157.71deg (not
    // a plain 180) matches the Python engine's recalibrated P — a real recording measured the
    // middle finger's own MCP->TIP angle at ~152deg, not a mathematically perfect straight-down
    // 180deg (see handshape.ts's pConfidence()).
    const p = makeHand([0, 0], { ring: 1.0, pinky: 1.0 }, [-0.30, -0.65], 157.71, 'Right', 1.5);
    expect(handshapeConfidence(p, 'p')).toBeGreaterThan(0.6);
    const kOrientation = makeHand([0, 0], { ring: 1.0, pinky: 1.0 }, [-0.30, -0.65], 0, 'Right', 1.5);
    expect(handshapeConfidence(kOrientation, 'p')).toBeLessThan(0.6);
  });
});

describe('LETTER_R (crossed fingers)', () => {
  it('passes when index/middle tips are crossed, rejects an uncrossed V', () => {
    const crossed = makeHand([0, 0], { ring: 1.0, pinky: 1.0 }, [-1.0, -0.05]);
    const tmp = crossed.points[8][0];
    crossed.points[8][0] = crossed.points[12][0];
    crossed.points[12][0] = tmp;
    expect(handshapeConfidence(crossed, 'r')).toBeGreaterThan(0.6);

    const v = makeHand([0, 0], { ring: 1.0, pinky: 1.0 }, [-1.0, -0.05]);
    expect(handshapeConfidence(v, 'r')).toBeLessThan(0.6);

    const result = verify(staticBuffer((c) => {
      const h = makeHand(c, { ring: 1.0, pinky: 1.0 }, [-1.0, -0.05]);
      const t = h.points[8][0];
      h.points[8][0] = h.points[12][0];
      h.points[12][0] = t;
      return h;
    }), LETTER_R);
    expect(resultPassed(result)).toBe(true);
  });
});

describe('LETTER_N (fist, thumb depth)', () => {
  it('passes with thumb tucked under, rejects A (thumb alongside)', () => {
    const n = makeHand([0, 0], { index: 1.0, middle: 1.0, ring: 1.0, pinky: 1.0 }, [-0.08, -0.30]);
    expect(handshapeConfidence(n, 'letter_n')).toBeGreaterThan(0.6);
    const a = makeHand([0, 0], { index: 1.0, middle: 1.0, ring: 1.0, pinky: 1.0 }, [-1.0, -0.10]);
    expect(handshapeConfidence(a, 'letter_n')).toBeLessThan(0.6);
  });
});
