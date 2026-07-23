import { describe, it, expect } from 'vitest';
import { handshapeConfidence } from '../handshape';
import {
  WRIST, THUMB_TIP, INDEX_MCP, INDEX_TIP, MIDDLE_MCP, MIDDLE_TIP,
  RING_MCP, RING_TIP, PINKY_MCP, PINKY_TIP, type Hand,
} from '../landmarks';

// Minimal synthetic 21-point hand, fingers fully extended (tip/mcp distance ratio >=1.6 from
// wrist) in a fixed "open hand" layout — only THUMB_TIP position varies between fixtures, since
// bConfidence/fiveConfidence discriminate B from 5 by thumb-tip-to-index-MCP distance (see
// handshape.ts's THUMB_TUCKED_LOW/HIGH comment — a real B/5 confusor recording found adjacent-
// finger spread doesn't reliably separate the two shapes, but thumb position does).
function makeOpenHand(thumbTip: [number, number]): Hand {
  const points: number[][] = Array.from({ length: 21 }, () => [0, 0, 0]);
  points[WRIST] = [0, 100, 0];
  points[INDEX_MCP] = [-15, 58, 0];
  points[INDEX_TIP] = [-15, -40, 0];
  points[MIDDLE_MCP] = [0, 60, 0];
  points[MIDDLE_TIP] = [0, -40, 0];
  points[RING_MCP] = [15, 58, 0];
  points[RING_TIP] = [15, -40, 0];
  points[PINKY_MCP] = [28, 55, 0];
  points[PINKY_TIP] = [28, -40, 0];
  points[THUMB_TIP] = [thumbTip[0], thumbTip[1], 0];
  return { handedness: 'Right', points };
}

describe('B vs 5 handshape confusor (mechanism: thumb-tip-to-index-MCP distance)', () => {
  // Regression fixture for the reported bug: B and 5 both dispatched to plain openConfidence
  // (extension only), so a thumb-extended 5 always passed for a prompted B and vice versa. Values
  // chosen well clear of THUMB_TUCKED_LOW/HIGH (0.25/0.29 hand-scale units) on either side —
  // handScale here is 40 (WRIST to MIDDLE_MCP), so tucked=6 units away (ratio 0.15) and
  // extended=18 units away (ratio 0.45).
  const tucked = makeOpenHand([-9, 58]);   // INDEX_MCP + (6, 0) -> ratio 0.15
  const extended = makeOpenHand([3, 58]);  // INDEX_MCP + (18, 0) -> ratio 0.45

  it('thumb tucked near index-MCP scores high for b, low for 5', () => {
    expect(handshapeConfidence(tucked, 'b')).toBeGreaterThan(0.8);
    expect(handshapeConfidence(tucked, '5')).toBeLessThan(0.3);
  });

  it('thumb extended away from index-MCP scores high for 5, low for b', () => {
    expect(handshapeConfidence(extended, '5')).toBeGreaterThan(0.8);
    expect(handshapeConfidence(extended, 'b')).toBeLessThan(0.3);
  });
});
