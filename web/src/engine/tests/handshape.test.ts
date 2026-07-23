import { describe, it, expect } from 'vitest';
import { handshapeConfidence } from '../handshape';
import {
  WRIST, THUMB_TIP, INDEX_MCP, INDEX_TIP, MIDDLE_MCP, MIDDLE_TIP,
  RING_MCP, RING_TIP, PINKY_MCP, PINKY_TIP, type Hand,
} from '../landmarks';

// Minimal synthetic 21-point hand. Only wrist + each finger's own MCP/TIP carry real geometry —
// everything else (PIP/DIP joints, thumb) is a harmless placeholder since bConfidence/
// fiveConfidence's checks (finger extension via allCurls, adjacent-fingertip spread) never read
// them. Fingers are fully extended in every fixture below (tip/mcp distance ratio >=1.6 from
// wrist) — only the fingertips' horizontal spacing (together vs. spread) varies between fixtures.
function makeOpenHand(tipX: { index: number; middle: number; ring: number; pinky: number }): Hand {
  const points: number[][] = Array.from({ length: 21 }, () => [0, 0, 0]);
  points[WRIST] = [0, 100, 0];
  points[INDEX_MCP] = [-15, 58, 0];
  points[INDEX_TIP] = [tipX.index, -40, 0];
  points[MIDDLE_MCP] = [0, 60, 0];
  points[MIDDLE_TIP] = [tipX.middle, -40, 0];
  points[RING_MCP] = [15, 58, 0];
  points[RING_TIP] = [tipX.ring, -40, 0];
  points[PINKY_MCP] = [28, 55, 0];
  points[PINKY_TIP] = [tipX.pinky, -40, 0];
  points[THUMB_TIP] = [-40, 90, 0]; // unused by b/5 — allCurls excludes the thumb
  return { handedness: 'Right', points };
}

describe('B vs 5 handshape confusor (mechanism: adjacent-fingertip spread)', () => {
  // Regression fixture for the reported bug: B and 5 both dispatched to plain openConfidence
  // (extension only), so a spread-fingers 5 always passed for a prompted B and vice versa.
  const together = makeOpenHand({ index: -5, middle: 0, ring: 5, pinky: 8 });
  const spread = makeOpenHand({ index: -25, middle: 0, ring: 25, pinky: 45 });

  it('fingers held together scores high for b, low for 5', () => {
    expect(handshapeConfidence(together, 'b')).toBeGreaterThan(0.8);
    expect(handshapeConfidence(together, '5')).toBeLessThan(0.3);
  });

  it('fingers spread apart scores high for 5, low for b', () => {
    expect(handshapeConfidence(spread, '5')).toBeGreaterThan(0.8);
    expect(handshapeConfidence(spread, 'b')).toBeLessThan(0.3);
  });
});
