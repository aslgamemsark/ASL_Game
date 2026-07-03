import { clip, mean, std } from './math-utils';
import type { Hand } from './landmarks';
import { WRIST, THUMB_TIP, INDEX_MCP, INDEX_TIP, MIDDLE_MCP, MIDDLE_TIP, RING_MCP, RING_TIP, PINKY_MCP, PINKY_TIP } from './landmarks';

type FingerPair = [number, number]; // [tip, mcp]
const FINGER_LM: Record<string, FingerPair> = {
  index: [INDEX_TIP, INDEX_MCP],
  middle: [MIDDLE_TIP, MIDDLE_MCP],
  ring: [RING_TIP, RING_MCP],
  pinky: [PINKY_TIP, PINKY_MCP],
};
const FINGERS: FingerPair[] = Object.values(FINGER_LM);

function xy(hand: Hand, idx: number): [number, number] {
  return [hand.points[idx][0], hand.points[idx][1]];
}

function dist2d(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function handScale(hand: Hand): number {
  const s = dist2d(xy(hand, MIDDLE_MCP), xy(hand, WRIST));
  return s > 1e-6 ? s : 1.0;
}

function fingerCurl(hand: Hand, tip: number, mcp: number): number {
  const tipD = dist2d(xy(hand, tip), xy(hand, WRIST));
  const mcpD = dist2d(xy(hand, mcp), xy(hand, WRIST));
  const r = tipD / Math.max(mcpD, 1e-6);
  return clip((1.6 - r) / (1.6 - 1.0), 0, 1);
}

function allCurls(hand: Hand): number[] {
  return FINGERS.map(([t, m]) => fingerCurl(hand, t, m));
}

function thumbExtended(hand: Hand): number {
  const d = dist2d(xy(hand, THUMB_TIP), xy(hand, INDEX_MCP)) / handScale(hand);
  return clip((d - 0.5) / (1.2 - 0.5), 0, 1);
}

export function extensions(hand: Hand): Record<string, number> {
  const ext: Record<string, number> = {};
  for (const [name, [tip, mcp]] of Object.entries(FINGER_LM)) {
    ext[name] = 1.0 - fingerCurl(hand, tip, mcp);
  }
  ext.thumb = thumbExtended(hand);
  return ext;
}

function fistConfidence(hand: Hand): number {
  return mean(allCurls(hand));
}

function aConfidence(hand: Hand): number {
  return Math.min(fistConfidence(hand), thumbExtended(hand));
}

function indexConfidence(hand: Hand): number {
  const curls = allCurls(hand);
  const indexExtended = 1.0 - curls[0];
  const restCurled = mean(curls.slice(1));
  return clip(indexExtended * 0.5 + restCurled * 0.5, 0, 1);
}

function openConfidence(hand: Hand): number {
  return clip(1.0 - mean(allCurls(hand)), 0, 1);
}

function clawConfidence(hand: Hand): number {
  const curls = allCurls(hand);
  const m = mean(curls);
  const base = clip((m - 0.25) / 0.35, 0, 1);
  const spread = std(curls);
  const penalty = clip(1.0 - Math.max(0, spread - 0.15) / 0.35, 0, 1);
  return base * penalty;
}

function nConfidence(hand: Hand): number {
  const c = allCurls(hand);
  return clip(mean([1.0 - c[0], 1.0 - c[1], c[2], c[3]]), 0, 1);
}

function wConfidence(hand: Hand): number {
  const c = allCurls(hand);
  return clip(mean([1.0 - c[0], 1.0 - c[1], 1.0 - c[2], c[3]]), 0, 1);
}

function middleConfidence(hand: Hand): number {
  const c = allCurls(hand);
  return clip(mean([c[0], 1.0 - c[1], c[2], c[3]]), 0, 1);
}

const PATTERNS: Record<string, Record<string, number>> = {
  point: { index: 1, middle: 0, ring: 0, pinky: 0 },
  '1': { index: 1, middle: 0, ring: 0, pinky: 0 },
  v: { index: 1, middle: 1, ring: 0, pinky: 0 },
  l: { thumb: 1, index: 1, middle: 0, ring: 0, pinky: 0 },
  y: { thumb: 1, index: 0, middle: 0, ring: 0, pinky: 1 },
  // strict min-based: averaged version let open hands score 0.5+
  n: { index: 1, middle: 1, ring: 0, pinky: 0 },
  h: { index: 1, middle: 1, ring: 0, pinky: 0 },
  u: { index: 1, middle: 1, ring: 0, pinky: 0 },
  w: { index: 1, middle: 1, ring: 1, pinky: 0 },
  middle: { index: 0, middle: 1, ring: 0, pinky: 0 },
  // thumb=0 required (unlike y) so a real Y-hand (thumb+pinky out) can't pass as i.
  i: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 1 },
};

function matchPattern(hand: Hand, pattern: Record<string, number>): number {
  const ext = extensions(hand);
  const scores = Object.entries(pattern).map(([f, target]) =>
    target === 1 ? ext[f] : 1.0 - ext[f]
  );
  return scores.length > 0 ? Math.min(...scores) : 0;
}

const DISPATCH: Record<string, (hand: Hand) => number> = {
  fist: fistConfidence,
  s: fistConfidence,
  a: aConfidence,
  index: indexConfidence,
  open: openConfidence,
  b: openConfidence,
  '5': openConfidence,
  claw: clawConfidence,
  n: nConfidence,
  w: wConfidence,
  middle: middleConfidence,
};

export function handshapeConfidence(hand: Hand, kind: string): number {
  const k = kind.toLowerCase();
  const fn = DISPATCH[k];
  if (fn) return fn(hand);
  const pattern = PATTERNS[k];
  if (pattern) return matchPattern(hand, pattern);
  return 0;
}
