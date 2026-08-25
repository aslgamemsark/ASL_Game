import { norm2d, mean as arrMean } from './math-utils';

export const WRIST = 0;
export const THUMB_TIP = 4;
export const INDEX_MCP = 5;
export const INDEX_TIP = 8;
export const MIDDLE_MCP = 9;
export const MIDDLE_PIP = 10;
export const MIDDLE_TIP = 12;
export const RING_MCP = 13;
export const RING_TIP = 16;
export const PINKY_MCP = 17;
export const PINKY_TIP = 20;
export const FINGERTIPS = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP] as const;
export const MCPS = [INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP] as const;
export const PALM_POINTS = [WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP] as const;

export const POSE_NOSE = 0;
export const POSE_MOUTH_LEFT = 9;
export const POSE_MOUTH_RIGHT = 10;
export const POSE_LEFT_SHOULDER = 11;
export const POSE_RIGHT_SHOULDER = 12;

export interface Hand {
  handedness: string;
  points: number[][]; // (21, 3)
}

export function handWrist(h: Hand): number[] {
  return h.points[WRIST].slice(0, 2);
}

export function handCenter(h: Hand): number[] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const idx of PALM_POINTS) {
    xs.push(h.points[idx][0]);
    ys.push(h.points[idx][1]);
  }
  return [arrMean(xs), arrMean(ys)];
}

export interface Frame {
  t: number;
  width: number;
  height: number;
  hands: Hand[];
  leftShoulder: number[] | null;
  rightShoulder: number[] | null;
  mouth: number[] | null;
  // OPTIONAL, additive (facial non-manual marker support — see engine/schema.ts's NmmReq).
  // The 52 ARKit-standard blendshape scores in [0, 1], keyed by category name (e.g.
  // "browInnerUp"), only populated when Capture is constructed with wantFaceBlendshapes. null
  // when not requested or no face detected this frame.
  faceBlendshapes: Record<string, number> | null;
}

export function frameShoulderWidth(f: Frame): number | null {
  if (!f.leftShoulder || !f.rightShoulder) return null;
  const w = norm2d(f.leftShoulder, f.rightShoulder);
  return w > 1e-6 ? w : null;
}

export function frameHand(f: Frame, handedness: string): Hand | null {
  for (const h of f.hands) {
    if (h.handedness === handedness) return h;
  }
  return null;
}

export function frameHasBothHands(f: Frame): boolean {
  return f.hands.length >= 2;
}

export function frameIsComplete(f: Frame): boolean {
  return frameHasBothHands(f) && frameShoulderWidth(f) !== null;
}

export function normalizedDistance(
  p1: number[],
  p2: number[],
  shoulderWidth: number
): number {
  return norm2d(p1, p2) / shoulderWidth;
}

export function frameFromDict(d: {
  t: number;
  width: number;
  height: number;
  hands: { handedness: string; points: number[][] }[];
  left_shoulder?: number[] | null;
  right_shoulder?: number[] | null;
  mouth?: number[] | null;
  face_blendshapes?: Record<string, number> | null;
}): Frame {
  return {
    t: d.t,
    width: d.width,
    height: d.height,
    hands: d.hands.map((h) => ({ handedness: h.handedness, points: h.points })),
    leftShoulder: d.left_shoulder ?? null,
    rightShoulder: d.right_shoulder ?? null,
    mouth: d.mouth ?? null,
    faceBlendshapes: d.face_blendshapes ?? null,
  };
}

export class RollingBuffer {
  windowSeconds: number;
  private _frames: Frame[] = [];

  constructor(windowSeconds = 2.0) {
    this.windowSeconds = windowSeconds;
  }

  add(frame: Frame): void {
    this._frames.push(frame);
    const cutoff = frame.t - this.windowSeconds;
    while (this._frames.length > 0 && this._frames[0].t < cutoff) {
      this._frames.shift();
    }
  }

  clear(): void {
    this._frames = [];
  }

  get length(): number {
    return this._frames.length;
  }

  get frames(): Frame[] {
    return [...this._frames];
  }

  /** ASL-C2 hot path: frames with `endT - t <= seconds`, allocated as ONE slice. verify() calls
   *  this ~5-10x per 100ms tick; the old `frames.filter(...)` shape paid a full spread + a filter
   *  copy each call. Returns a fresh array (never the internal one) so async consumers (the ML
   *  classifier gate) can hold/mutate their snapshot freely. */
  recentFrames(seconds: number): Frame[] {
    const n = this._frames.length;
    if (n === 0) return [];
    const endT = this._frames[n - 1].t;
    let startIdx = n;
    // Frames are appended in time order, so the recent window is always a suffix — walk back
    // from the end and slice once.
    while (startIdx > 0 && endT - this._frames[startIdx - 1].t <= seconds) startIdx--;
    return this._frames.slice(startIdx);
  }

  [Symbol.iterator](): Iterator<Frame> {
    let i = 0;
    const frames = this._frames;
    return {
      next() {
        if (i < frames.length) return { value: frames[i++], done: false };
        return { value: undefined as never, done: true };
      },
    };
  }

  get start(): Frame | null {
    return this._frames.length > 0 ? this._frames[0] : null;
  }

  get end(): Frame | null {
    return this._frames.length > 0 ? this._frames[this._frames.length - 1] : null;
  }

  get duration(): number {
    if (this._frames.length < 2) return 0;
    return this._frames[this._frames.length - 1].t - this._frames[0].t;
  }
}

export class HandStabilizer {
  holdSeconds: number;
  private _last: Map<string, { t: number; hand: Hand }> = new Map();

  constructor(holdSeconds = 0.3) {
    this.holdSeconds = holdSeconds;
  }

  reset(): void {
    this._last.clear();
  }

  stabilize(frame: Frame): Frame {
    const present = new Set<string>();
    for (const h of frame.hands) {
      this._last.set(h.handedness, { t: frame.t, hand: h });
      present.add(h.handedness);
    }
    for (const [handedness, { t, hand }] of this._last) {
      if (!present.has(handedness) && frame.t - t <= this.holdSeconds) {
        frame.hands.push(hand);
      }
    }
    return frame;
  }
}
