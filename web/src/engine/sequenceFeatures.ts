/**
 * Browser-side feature extraction for the ML disambiguation layer.
 *
 * MUST stay byte-identical to ml/dataset.py — the model is trained on those exact features,
 * so any divergence here silently degrades accuracy. A golden parity test
 * (web/tests/feature-parity.test.ts) compares this output against the Python output for a
 * committed fixture; keep them in lockstep.
 *
 * Layout (86 dims/frame): two slots [Dominant, Nondominant] — by ROLE (whichever hand's
 * palm-center travels farther across the clip), not raw MediaPipe Right/Left handedness. This
 * MUST match ml/dataset.py's assign_roles() (and web/src/engine/verifier.ts's own
 * assignRoles(), which the rule verifier uses) exactly, or a left-handed signer's features land
 * in the opposite slot from what the model was trained on — a real bug found and fixed here
 * (2026-07-14): this file previously slotted by raw handedness while ml/dataset.py had already
 * been fixed to slot by role, silently mismatching every model trained after that fix.
 * Each slot = 21*(x,y) centered on the shoulder midpoint and scaled by shoulder width, followed
 * by a presence flag. z is dropped.
 */
import type { Frame } from './landmarks';

export const SEQ_LEN = 48;
const N_LANDMARKS = 21;
const PER_HAND = N_LANDMARKS * 2; // 42
const PER_HAND_F = PER_HAND + 1; // 43
export const FEAT_DIM = PER_HAND_F * 2; // 86
const WRIST = 0;
const MIDDLE_MCP = 9;
const INDEX_MCP = 5;
const RING_MCP = 13;
const PINKY_MCP = 17;
const PALM_POINTS = [WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP];

/** Palm-center proxy: mean of wrist + finger MCPs. Mirrors core/landmarks.py's Hand.center. */
function handCenter(points: number[][]): [number, number] {
  let sx = 0, sy = 0;
  for (const idx of PALM_POINTS) { sx += points[idx][0]; sy += points[idx][1]; }
  return [sx / PALM_POINTS.length, sy / PALM_POINTS.length];
}

/** Total path length of a hand's palm-center across frames where it's present. */
function pathLength(centers: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < centers.length; i++) {
    const dx = centers[i][0] - centers[i - 1][0];
    const dy = centers[i][1] - centers[i - 1][1];
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/**
 * Map "Dominant"/"Nondominant" to detected MediaPipe handedness labels by relative motion —
 * same heuristic as ml/dataset.py's assign_roles() and engine/verifier.ts's assignRoles()
 * (whichever hand's palm-center travels farther across the clip is dominant).
 */
function assignRoles(frames: Frame[]): Record<string, string> {
  const labels: string[] = [];
  for (const f of frames) {
    for (const h of f.hands) {
      if (!labels.includes(h.handedness)) labels.push(h.handedness);
    }
  }
  if (labels.length === 0) return {};
  if (labels.length === 1) return { Dominant: labels[0] };

  const centersByLabel = new Map<string, [number, number][]>(labels.map((l) => [l, []]));
  for (const f of frames) {
    for (const h of f.hands) {
      centersByLabel.get(h.handedness)!.push(handCenter(h.points));
    }
  }
  labels.sort((a, b) => pathLength(centersByLabel.get(b)!) - pathLength(centersByLabel.get(a)!));
  return { Dominant: labels[0], Nondominant: labels[1] };
}

/** numpy-style median: average of the two middle values for even-length input. */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Per-clip normalization constants (mid_xy, scale) from median shoulder geometry. */
function clipNorm(frames: Frame[]): { mid: [number, number]; scale: number } {
  const midX: number[] = [];
  const midY: number[] = [];
  const widths: number[] = [];
  for (const f of frames) {
    const ls = f.leftShoulder;
    const rs = f.rightShoulder;
    if (ls && rs) {
      const dx = ls[0] - rs[0];
      const dy = ls[1] - rs[1];
      const w = Math.sqrt(dx * dx + dy * dy);
      if (w > 1e-6) {
        midX.push((ls[0] + rs[0]) / 2);
        midY.push((ls[1] + rs[1]) / 2);
        widths.push(w);
      }
    }
  }
  if (widths.length) {
    return { mid: [median(midX), median(midY)], scale: median(widths) };
  }

  // Fallback: no pose anywhere. Center on median wrist, scale by median hand span / 0.3.
  const wx: number[] = [];
  const wy: number[] = [];
  const spans: number[] = [];
  for (const f of frames) {
    for (const h of f.hands) {
      const wr = h.points[WRIST];
      const mm = h.points[MIDDLE_MCP];
      wx.push(wr[0]);
      wy.push(wr[1]);
      const dx = wr[0] - mm[0];
      const dy = wr[1] - mm[1];
      spans.push(Math.sqrt(dx * dx + dy * dy));
    }
  }
  if (spans.length) {
    return { mid: [median(wx), median(wy)], scale: Math.max(median(spans) / 0.3, 1e-6) };
  }
  return { mid: [0, 0], scale: 1 };
}

const ROLE_SLOTS = ['Dominant', 'Nondominant'] as const;

function frameFeatures(
  f: Frame,
  mid: [number, number],
  scale: number,
  roles: Record<string, string>
): number[] {
  const out = new Array(FEAT_DIM).fill(0);
  const byHand = new Map<string, Frame['hands'][number]>();
  for (const h of f.hands) byHand.set(h.handedness, h);
  for (let slot = 0; slot < ROLE_SLOTS.length; slot++) {
    const label = roles[ROLE_SLOTS[slot]];
    const h = label ? byHand.get(label) : undefined;
    const base = slot * PER_HAND_F;
    if (h) {
      for (let i = 0; i < N_LANDMARKS; i++) {
        out[base + i * 2] = (h.points[i][0] - mid[0]) / scale;
        out[base + i * 2 + 1] = (h.points[i][1] - mid[1]) / scale;
      }
      out[base + PER_HAND] = 1;
    }
  }
  return out;
}

/** Linearly resample a (N, FEAT_DIM) sequence to (SEQ_LEN, FEAT_DIM). */
function resampleTime(feats: number[][], seqLen: number): number[][] {
  const n = feats.length;
  if (n === seqLen) return feats;
  const out: number[][] = [];
  for (let i = 0; i < seqLen; i++) {
    const src = n === 1 ? 0 : (i * (n - 1)) / (seqLen - 1);
    const lo = Math.floor(src);
    const hi = Math.min(lo + 1, n - 1);
    const frac = src - lo;
    const row = new Array(FEAT_DIM);
    for (let j = 0; j < FEAT_DIM; j++) {
      row[j] = feats[lo][j] * (1 - frac) + feats[hi][j] * frac;
    }
    out.push(row);
  }
  return out;
}

/**
 * Frame sequence -> (SEQ_LEN, FEAT_DIM) features, or null if empty / no hands.
 *
 * Trims leading/trailing no-hand frames first (must match ml/dataset.py) so the fixed-length
 * window concentrates on the actual sign, not rest-pose frames at the edges.
 */
export function clipToSequence(frames: Frame[], seqLen: number = SEQ_LEN): number[][] | null {
  if (!frames.length) return null;
  let i0 = 0;
  let i1 = frames.length - 1;
  while (i0 <= i1 && frames[i0].hands.length === 0) i0++;
  while (i1 >= i0 && frames[i1].hands.length === 0) i1--;
  if (i0 > i1) return null;
  const active = frames.slice(i0, i1 + 1);
  const { mid, scale } = clipNorm(active);
  const roles = assignRoles(active);
  const feats = active.map((f) => frameFeatures(f, mid, scale, roles));
  return resampleTime(feats, seqLen);
}
