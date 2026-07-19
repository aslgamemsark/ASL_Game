import { describe, it, expect } from 'vitest';
import { computeFraming } from '@/engine/framing';
import type { Frame } from '@/engine/landmarks';

// Framing guides camera POSITION from pose landmarks already computed each frame (zero extra cost).
// It's the fix for the "my friend sits too close, signs won't recognize" reports: when the user is
// too close, shoulders clip the frame and shoulder-width normalization (which every spatial
// threshold depends on) breaks. computeFraming is a pure function, so each condition is tested
// directly with a synthetic frame rather than a live camera.

// Build a frame with shoulders spanning `shoulderRatio` of the width, centered at `midXRatio`,
// and the mouth at `mouthYRatio` of the height. 640x480 is representative but the logic is
// resolution-independent (everything is a ratio).
function frameWith(opts: { shoulderRatio: number; midXRatio?: number; mouthYRatio?: number }): Frame {
  const width = 640;
  const height = 480;
  const midX = (opts.midXRatio ?? 0.5) * width;
  const half = (opts.shoulderRatio * width) / 2;
  const mouthY = (opts.mouthYRatio ?? 0.3) * height;
  return {
    t: 0,
    width,
    height,
    hands: [],
    leftShoulder: [midX + half, height * 0.5],
    rightShoulder: [midX - half, height * 0.5],
    mouth: [midX, mouthY],
    faceBlendshapes: null,
  };
}

describe('computeFraming', () => {
  it('accepts a well-positioned user (centered, mid distance, face high)', () => {
    expect(computeFraming(frameWith({ shoulderRatio: 0.5 })).ok).toBe(true);
  });

  it('tells a too-close user to move back (shoulders fill the frame)', () => {
    const r = computeFraming(frameWith({ shoulderRatio: 0.9 }));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/back/i);
  });

  it('tells a too-far user to come closer', () => {
    const r = computeFraming(frameWith({ shoulderRatio: 0.25 }));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/closer/i);
  });

  it('tells an off-center user to center themselves', () => {
    const r = computeFraming(frameWith({ shoulderRatio: 0.5, midXRatio: 0.75 }));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/center/i);
  });

  it('tells a user whose face is too low to raise the camera (chest not visible)', () => {
    const r = computeFraming(frameWith({ shoulderRatio: 0.5, mouthYRatio: 0.7 }));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/raise/i);
  });

  it('asks a user with no detected pose to step into view', () => {
    const empty: Frame = {
      t: 0, width: 640, height: 480, hands: [],
      leftShoulder: null, rightShoulder: null, mouth: null, faceBlendshapes: null,
    };
    const r = computeFraming(empty);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/step into view/i);
  });

  it('does not require the mouth landmark to pass (face detection can lag pose)', () => {
    const f = frameWith({ shoulderRatio: 0.5 });
    f.mouth = null;
    expect(computeFraming(f).ok).toBe(true);
  });

  // A hand is 21 landmarks; represent it here as a small cluster of points around a center.
  function handAt(cxRatio: number, cyRatio: number, width = 640, height = 480) {
    const cx = cxRatio * width;
    const cy = cyRatio * height;
    const points = [
      [cx, cy, 0], [cx - 12, cy - 12, 0], [cx + 12, cy - 12, 0], [cx - 12, cy + 12, 0], [cx + 12, cy + 12, 0],
    ];
    return { handedness: 'Right', points };
  }

  it('warns when a raised hand runs off a side edge (would drop the sign)', () => {
    const f = frameWith({ shoulderRatio: 0.5 });
    f.hands = [handAt(0.01, 0.4)]; // hand hugging the left edge
    const r = computeFraming(f);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/hands in the frame/i);
  });

  it('warns when a raised hand runs off the top edge', () => {
    const f = frameWith({ shoulderRatio: 0.5 });
    f.hands = [handAt(0.5, 0.01)];
    expect(computeFraming(f).ok).toBe(false);
  });

  it('passes when both hands are well inside the frame', () => {
    const f = frameWith({ shoulderRatio: 0.5 });
    f.hands = [handAt(0.35, 0.45), handAt(0.65, 0.45)];
    expect(computeFraming(f).ok).toBe(true);
  });

  it('does NOT nag about hands resting at the bottom edge (only sides/top count)', () => {
    const f = frameWith({ shoulderRatio: 0.5 });
    f.hands = [handAt(0.5, 0.99)]; // hand hanging off the bottom at rest
    expect(computeFraming(f).ok).toBe(true);
  });
});
