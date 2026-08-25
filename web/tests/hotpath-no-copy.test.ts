// ASL-C2 regression tests — hot-path allocation contract for RollingBuffer + verifier helpers.
//
// verify() calls recent() ~5-10x per 100ms tick. The old shape paid TWO full-buffer array
// allocations per recent() call (the `frames` getter spread + a `.filter()` on top), plus another
// full copy inside latestShoulderWidth(). This suite pins the fix:
//   1. buffer.recentFrames(seconds) — ONE slice, allocated in landmarks.ts, no filter copy;
//   2. the returned slice is a snapshot: mutating it must never touch the buffer's internal
//      frames (callers like the classifier gate hand these to async code);
//   3. verifier's public surface (verify/assignRoles/latestShoulderWidth) stays read-only —
//      verifying must not mutate the buffer it scores.
import { describe, it, expect } from 'vitest';
import { RollingBuffer, type Frame, type Hand } from '../src/engine/landmarks';
import { verify, assignRoles } from '../src/engine/verifier';
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

function frameAt(t: number): Frame {
  return {
    t,
    width: 640, height: 480,
    hands: [OPEN_HAND],
    leftShoulder: [260, 200], rightShoulder: [380, 200], mouth: null,
    faceBlendshapes: null,
  };
}

function bufferWithTimes(times: number[]): RollingBuffer {
  const buf = new RollingBuffer(2.0);
  for (const t of times) buf.add(frameAt(t));
  return buf;
}

describe('RollingBuffer.recentFrames (ASL-C2)', () => {
  it('returns only frames within `seconds` of the newest timestamp', () => {
    // 30 frames at 100ms spacing; window keeps ~2s of them, recent(0.5) should keep ~6.
    const times = Array.from({ length: 30 }, (_, i) => i * 0.1);
    const buf = bufferWithTimes(times);
    const endT = times[times.length - 1];
    const got = buf.recentFrames(0.5);
    expect(got.length).toBeGreaterThan(0);
    for (const f of got) {
      expect(endT - f.t, `frame t=${f.t} must be within 0.5s of ${endT}`).toBeLessThanOrEqual(0.5);
    }
    // Newest frame is always included; oldest included frame is just inside the window.
    expect(got[got.length - 1].t).toBeCloseTo(endT, 5);
  });

  it('returns [] for an empty buffer and everything for a huge window', () => {
    expect(new RollingBuffer().recentFrames(0.5)).toEqual([]);
    const buf = bufferWithTimes([0.0, 0.1, 0.2]);
    expect(buf.recentFrames(60).length).toBe(3);
  });

  it('slice is a snapshot: the ARRAY is fresh, callers can hold/mutate their own copy', () => {
    const buf = bufferWithTimes([0.0, 0.1, 0.2, 0.3]);
    const before = buf.length;
    const s1 = buf.recentFrames(60);
    const s2 = buf.recentFrames(60);
    expect(s1).not.toBe(s2, 'each call returns its own array');
    s1.pop();
    s1.push(frameAt(42));
    expect(buf.length, 'mutating the snapshot must not shrink/grow the buffer').toBe(before);
    expect(buf.end!.t).toBe(0.3);
    // Element CONTRACT: slices share Frame objects with the buffer (shallow, same as the
    // `frames` getter) — frames are immutable records across the engine; deep-copying 21-point
    // hands at 10 Hz would reintroduce exactly the allocation churn ASL-C2 removes.
    expect(s2[s2.length - 1].t).toBe(0.3);
  });

  it('recentFrames matches the old two-copy semantics exactly (frames.filter)', () => {
    const times = Array.from({ length: 25 }, (_, i) => i * 0.08);
    const buf = bufferWithTimes(times);
    const legacy = buf.frames.filter((f) => {
      const all = buf.frames;
      const endT = all[all.length - 1].t;
      return endT - f.t <= 0.4;
    });
    expect(buf.recentFrames(0.4).map((f) => f.t)).toEqual(legacy.map((f) => f.t));
  });
});

describe('verifier is read-only over its buffer (ASL-C2)', () => {
  it('verify + assignRoles leave length and contents intact (covers latestShoulderWidth internally)', () => {
    const times = Array.from({ length: 20 }, (_, i) => i * 0.05);
    const buf = bufferWithTimes(times);
    const lenBefore = buf.length;
    const firstBefore = buf.start!.t;

    assignRoles(buf);
    verify(buf, HELLO); // runs latestShoulderWidth + every recent() scorer internally

    expect(buf.length).toBe(lenBefore);
    expect(buf.start!.t).toBe(firstBefore);
    expect([...buf].map((f) => f.t)).toEqual(times.slice(-lenBefore));
  });
});
