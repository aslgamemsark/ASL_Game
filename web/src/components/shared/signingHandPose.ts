/**
 * Geometry and pose maths for the loading animation's signing hand (see SigningHand.tsx).
 *
 * Split out from the component because it is pure, deterministic, and worth testing without a
 * browser (tests/signingHand.test.ts) — and because exporting non-components from the component
 * file defeats React Fast Refresh, which only works for modules that export components alone.
 */

// ── Fur silhouette ─────────────────────────────────────────────────────────────────────────────
/**
 * A capsule whose outline is broken up by small outward bumps, so the edge reads as fur rather
 * than moulded plastic. Geometric rather than an feTurbulence/feDisplacementMap filter on purpose:
 * a displacement filter would have to re-run over the whole hand on every frame of every joint
 * rotation, and this component's whole job is to render smoothly during a cold start — exactly
 * when the device can least afford per-frame filter work. Bumps baked into the path cost nothing
 * at animation time and deform correctly with the joints, because they ARE the geometry rotating.
 *
 * `phase` decorrelates the bump pattern between digits so five fingers don't share one visibly
 * repeated silhouette.
 */
export function furCapsule(w: number, len: number, overhang: number, phase: number): string {
  const hw = w / 2;
  const topY = -len;
  const shoulderY = topY + hw; // where the straight sides stop and the tip's dome begins
  const amp = Math.max(1.5, w * 0.19);
  const segs = 4;
  const lerpY = (t: number) => overhang + (shoulderY - overhang) * t;
  const n = (v: number) => v.toFixed(2);

  let d = `M ${-hw} ${n(overhang)}`;
  for (let i = 0; i < segs; i++) {
    const y1 = lerpY((i + 1) / segs);
    const my = (lerpY(i / segs) + y1) / 2;
    d += ` Q ${n(-hw - amp * (0.55 + 0.45 * Math.sin(phase + i * 1.7)))} ${n(my)} ${-hw} ${n(y1)}`;
  }
  d += ` Q ${n(-hw - amp * 0.45)} ${n(topY + hw * 0.4)} ${n(-hw * 0.52)} ${n(topY + hw * 0.06)}`;
  d += ` Q 0 ${n(topY - amp * 1.05)} ${n(hw * 0.52)} ${n(topY + hw * 0.06)}`;
  d += ` Q ${n(hw + amp * 0.45)} ${n(topY + hw * 0.4)} ${hw} ${n(shoulderY)}`;
  for (let i = segs - 1; i >= 0; i--) {
    const y1 = lerpY(i / segs);
    const my = (lerpY((i + 1) / segs) + y1) / 2;
    d += ` Q ${n(hw + amp * (0.55 + 0.45 * Math.sin(phase + i * 2.3 + 1.1)))} ${n(my)} ${hw} ${n(y1)}`;
  }
  return `${d} Z`;
}

/**
 * A ring of tapered fur wisps drawn BEHIND the palm, so only their tips clear its outline. The
 * capsule bumps alone read as "slightly soft edge" at loading-spinner sizes; actual protruding
 * tufts are what make it read as fur rather than a moulded glove. Deterministic (no Math.random)
 * so the silhouette is stable across re-renders.
 */
function furHalo(cx: number, cy: number, rx: number, ry: number, count: number): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    // Two incommensurate sines -> irregular-looking tuft lengths without an RNG.
    const spike = 2.1 + 2.3 * (0.5 + 0.5 * Math.sin(i * 2.399)) * (0.6 + 0.4 * Math.sin(i * 1.11));
    const hw = (Math.PI * 2) / count / 2.1;
    const p = (a: number) => `${(cx + Math.cos(a) * rx * 0.92).toFixed(2)} ${(cy + Math.sin(a) * ry * 0.92).toFixed(2)}`;
    d += `M ${p(t - hw)} L ${(cx + Math.cos(t) * (rx + spike)).toFixed(2)} ${(cy + Math.sin(t) * (ry + spike)).toFixed(2)} L ${p(t + hw)} Z `;
  }
  return d.trim();
}

export const PALM_FUR = furHalo(61, 96, 27.5, 30, 30);

// ── Skeleton ───────────────────────────────────────────────────────────────────────────────────
export interface Digit {
  id: string;
  /** MCP joint (knuckle), in rest-pose viewBox coords. */
  x: number;
  y: number;
  prox: number;
  dist: number;
  w: number;
  phase: number;
  /** How much this digit trails the wrist during the wave — lighter digits lag more. */
  lag: number;
}

const DIGITS: Digit[] = [
  { id: 'index', x: 45, y: 71, prox: 27, dist: 20, w: 12.5, phase: 0.0, lag: 0.6 },
  { id: 'middle', x: 58.5, y: 67, prox: 30, dist: 22, w: 13, phase: 1.3, lag: 0.8 },
  { id: 'ring', x: 72, y: 70, prox: 28, dist: 20, w: 12.5, phase: 2.6, lag: 1.0 },
  { id: 'pinky', x: 84, y: 78, prox: 21, dist: 16, w: 10.5, phase: 3.9, lag: 1.3 },
];
// Low and outboard on the palm's left edge, so when it swings out it clearly separates from the
// silhouette instead of lying across the palm and reading as a smudge.
const THUMB: Digit = { id: 'thumb', x: 35, y: 103, prox: 22, dist: 17, w: 14, phase: 5.2, lag: 0.4 };
/** Render order: thumb LAST, so in ✌️ — where it folds across the palm — it paints over it. */
export const SKELETON: Digit[] = [...DIGITS, THUMB];

/** One joint configuration: knuckle angle, mid-joint bend, and axial foreshortening. */
export type DigitPose = { rot: number; bend: number; len: number };
/** `digits` is nested rather than flattened alongside `wrist` so it stays a clean
 *  Record<string, DigitPose> — a flat shape would need an index signature `wrist: number` breaks. */
type Pose = { wrist: number; digits: Record<string, DigitPose> };

// Degrees, clockwise-positive (SVG convention). Rest pose is every digit extended straight up, so
// `rot` is the sweep/spread at the knuckle and `bend` is the curl at the mid joint. The thumb's
// rest direction is "up" too, so its outward angle is simply a large negative `rot` — no special
// case anywhere in the transform code.
//
// CURL CONVENTION: a folded finger is mostly `len` (axial foreshortening), only lightly `bend`.
// Viewed head-on a curled finger does not sweep across the frame — it collapses toward the knuckle
// and reads as a rounded bump on the front of the palm. A short stub with a gentle bend is what
// that actually looks like; a large `bend` instead swings it out sideways like a broken finger.
const ILY: Pose = {
  wrist: -3,
  digits: {
    thumb: { rot: -72, bend: -8, len: 1 },
    index: { rot: -7, bend: 0, len: 1 },
    middle: { rot: 3, bend: 24, len: 0.3 },
    ring: { rot: 7, bend: 26, len: 0.28 },
    pinky: { rot: 13, bend: 0, len: 1 },
  },
};
const WAVE: Pose = {
  wrist: 0,
  digits: {
    thumb: { rot: -58, bend: -6, len: 1 },
    index: { rot: -13, bend: 4, len: 1 },
    middle: { rot: -1, bend: 3, len: 1 },
    ring: { rot: 11, bend: 4, len: 1 },
    pinky: { rot: 23, bend: 6, len: 1 },
  },
};
const PEACE: Pose = {
  wrist: 3,
  digits: {
    thumb: { rot: -24, bend: 30, len: 0.5 },
    index: { rot: -21, bend: 2, len: 1 },
    middle: { rot: 7, bend: 2, len: 1 },
    ring: { rot: 2, bend: 26, len: 0.28 },
    pinky: { rot: 6, bend: 28, len: 0.26 },
  },
};

/**
 * The loop. Eight keyframes: hold 🤟, travel to the open hand, sway twice (a wave is a WRIST
 * motion, so the fingers hold their spread across k2–k4 and only the wrist swings), travel to ✌️,
 * hold, and return. The last keyframe is identical to the first so the loop closes seamlessly.
 */
const TIMES = [0, 0.14, 0.3, 0.4, 0.5, 0.64, 0.8, 1];
const SEQUENCE: Pose[] = [ILY, ILY, WAVE, WAVE, WAVE, PEACE, PEACE, ILY];
const WRIST_SWAY = [0, 0, 0, 14, -12, 0, 0, 0];
/** Fingers trail the wrist's direction change slightly — the follow-through that stops the wave
 *  looking like a rigid cutout being rocked from side to side. */
const LAG = [0, 0, 0, -4, 4, 0, 0, 0];
const BOB = [0, -1.5, -3, -3, -3, -1, -1, 0];
export const LOOP_MS = 5600;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Cubic ease-in-out. Every segment uses it, so no keyframe is ever arrived at or left abruptly —
 *  velocity is zero at each pose, which is what makes the sequence read as settling into a sign
 *  rather than snapping to it. */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface Frame {
  wrist: number;
  bob: number;
  digits: Record<string, DigitPose>;
}

/** The interpolated skeleton at loop position `u` (0..1). Exported for tests. */
export function poseAt(u: number): Frame {
  let i = 0;
  while (i < TIMES.length - 2 && u > TIMES[i + 1]) i++;
  const span = TIMES[i + 1] - TIMES[i];
  const e = ease(span > 0 ? (u - TIMES[i]) / span : 0);

  const digits: Record<string, DigitPose> = {};
  for (const d of SKELETON) {
    const a = SEQUENCE[i].digits[d.id];
    const b = SEQUENCE[i + 1].digits[d.id];
    digits[d.id] = {
      rot: lerp(a.rot + LAG[i] * d.lag, b.rot + LAG[i + 1] * d.lag, e),
      bend: lerp(a.bend, b.bend, e),
      len: lerp(a.len, b.len, e),
    };
  }
  return {
    wrist: lerp(SEQUENCE[i].wrist + WRIST_SWAY[i], SEQUENCE[i + 1].wrist + WRIST_SWAY[i + 1], e),
    bob: lerp(BOB[i], BOB[i + 1], e),
    digits,
  };
}

/**
 * Transform for a whole digit: foreshorten along the finger's own axis, THEN swing at the knuckle.
 * SVG applies a transform list right-to-left, so reading backwards: move the joint to the origin,
 * scale in Y (the finger's axis, since it is still unrotated at this point), move back, then
 * rotate about the joint. Doing the scale before the rotation is what makes a curl shorten along
 * the finger instead of squashing it vertically on screen.
 */
export const digitTransform = (d: Digit, p: DigitPose) =>
  `rotate(${p.rot.toFixed(2)} ${d.x} ${d.y}) translate(${d.x} ${d.y}) scale(1 ${p.len.toFixed(3)}) translate(${-d.x} ${-d.y})`;

/** The mid joint pivots about its REST position: a child's transform is expressed in its parent's
 *  pre-transform coordinates, so the parent's scale has not been applied yet at this point. */
export const bendTransform = (d: Digit, p: DigitPose) =>
  `rotate(${p.bend.toFixed(2)} ${d.x} ${d.y - d.prox})`;

export const wristTransform = (f: Frame) =>
  `rotate(${f.wrist.toFixed(2)} 60 130) translate(0 ${f.bob.toFixed(2)})`;
