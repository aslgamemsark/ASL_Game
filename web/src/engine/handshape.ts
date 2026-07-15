import { clip, mean, std } from './math-utils';
import type { Hand } from './landmarks';
import { WRIST, THUMB_TIP, INDEX_MCP, INDEX_TIP, MIDDLE_MCP, MIDDLE_PIP, MIDDLE_TIP, RING_MCP, RING_TIP, PINKY_MCP, PINKY_TIP } from './landmarks';

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

function thumbDist(hand: Hand, idx: number): number {
  return dist2d(xy(hand, THUMB_TIP), xy(hand, idx)) / handScale(hand);
}

// 0deg = wrist->middle-MCP points straight up the image, 90deg = sideways, 180deg = downward.
// 0deg = this finger's MCP->TIP vector points straight up the image, 90deg = sideways, 180deg =
// downward. A real recorded G measured the WRIST->MIDDLE-MCP vector (whole-palm orientation) at
// only ~10deg even with a clean sideways G, because people rotate a single extended finger at its
// own knuckle rather than rotating the whole forearm — the palm barely turns. The finger's own
// direction measured ~80deg on the same recording, which is what actually distinguishes G/H
// (sideways) and P/Q (downward) from their upright counterparts (D/L, K/V/U).
function fingerDirectionDeg(hand: Hand, tipIdx: number, mcpIdx: number): number {
  const mcp = xy(hand, mcpIdx);
  const tip = xy(hand, tipIdx);
  const v: [number, number] = [tip[0] - mcp[0], tip[1] - mcp[1]];
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  if (n < 1e-6) return 0;
  // cos(angle to "straight up") = dot(v, [0,-1]) / |v| = (v.x*0 + v.y*-1) / |v|, i.e. -v.y / |v| —
  // the v.x*0 term is algebraically always zero (confirmed: this simplification changes no
  // output), left implicit here instead of written out so the linter's dead-expression check
  // doesn't flag it. Do not "fix" the sign or reference axis without re-verifying against a real
  // recording — see the calibration note above this function.
  const cosA = -v[1] / n;
  return (Math.acos(clip(cosA, -1, 1)) * 180) / Math.PI;
}

function orientationScore(hand: Hand, tipIdx: number, mcpIdx: number, targetDeg: number, tolerance = 35): number {
  const angle = fingerDirectionDeg(hand, tipIdx, mcpIdx);
  return clip(1.0 - Math.abs(angle - targetDeg) / tolerance, 0, 1);
}

function fingerSpread(hand: Hand, tipA: number, tipB: number): number {
  return dist2d(xy(hand, tipA), xy(hand, tipB)) / handScale(hand);
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

// Letter A: fist + thumb resting alongside the index (not wrapped across like S, not fully
// splayed out like L/Y). Calibrated against a real recording (2026-07): thumb-tip-to-index-MCP
// distance measured ~0.54-0.60 hand-scale units for a natural A, clearly separated from S's
// ~0.19-0.21. thumbExtended() targets a much farther "sticking out" position (built for L/Y,
// needs d>=1.2 to score 1.0) and scored a real A at only ~0.10 — a dedicated target replaces it.
function aConfidence(hand: Hand): number {
  const fistScore = mean(allCurls(hand));
  const d = thumbDist(hand, INDEX_MCP);
  const thumbAlongside = clip(1.0 - Math.abs(d - 0.57) / 0.30, 0, 1);
  return Math.min(fistScore, thumbAlongside);
}

function indexConfidence(hand: Hand): number {
  // Both conditions are required via Math.min(), not averaged: an averaged 0.5/0.5 split let a
  // fully OPEN hand (index extended, nothing curled) score exactly 0.5 — equal to WRITE/FRIEND's
  // minConfidence threshold, so a flat palm could pass as the pinch/point handshape.
  const curls = allCurls(hand);
  const indexExtended = 1.0 - curls[0];
  const restCurled = Math.min(...curls.slice(1));
  return clip(Math.min(indexExtended, restCurled), 0, 1);
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

// Flattened-O (MORE): real recorded takes are noisy, mean curl ranged ~0.02-0.17 across attempts
// at the "same" gesture — well under claw's 0.25 floor (tuned for MEDICINE/EMERGENCY's deeper
// bent-5). The wrong-shape confusor (flat/open hand) measures curl ~0 with no observed variance,
// so this floor is set low enough to clear the WEAKEST observed real attempt, not the average one.
// Flattened-O (MORE): fingertips lightly curled toward the thumb, not the deeper curl of a claw.
// Bug found 2026-07-14 (live user testing, ported from core/handshape.py): this had no ceiling,
// only a floor — a plain fist (curl ~1.0) scored the exact same 1.0 as a real flattened-O.
// Ceiling holds full credit through the real range (up to ~0.29, and the committed
// more_confusor.json fixture's held claw-ish 0.50) and falls to 0 by curl 0.65 — clear of claw's
// ~0.71 and fist's ~1.0, both fully rejected.
function flatOConfidence(hand: Hand): number {
  const curls = allCurls(hand);
  const m = mean(curls);
  const base = clip(m / 0.05, 0, 1);
  const ceiling = clip((0.65 - m) / 0.15, 0, 1);
  const spread = std(curls);
  const penalty = clip(1.0 - Math.max(0, spread - 0.15) / 0.35, 0, 1);
  return base * ceiling * penalty;
}

// Distance bands (hand-scale units) for "thumb tip touching a fingertip".
const PINCH_NEAR = 0.35;
const PINCH_FAR = 0.9;

function pinchScore(hand: Hand, tipIdx: number): number {
  const d = thumbDist(hand, tipIdx);
  return clip((PINCH_FAR - d) / (PINCH_FAR - PINCH_NEAR), 0, 1);
}

// Letter F: thumb and index tip touch (forming a small circle); middle/ring/pinky extended.
function fConfidence(hand: Hand): number {
  const pinch = pinchScore(hand, INDEX_TIP);
  const ext = extensions(hand);
  const others = Math.min(ext.middle, ext.ring, ext.pinky);
  return Math.min(pinch, others);
}

// Letter O: all four fingertips curl in to meet the thumb, forming a rounded circle. Distinct
// from flatO's very light curl and claw's deeper, thumb-unconstrained curl — O specifically
// requires the thumb to be near the fingertips too, not just the fingers curling on their own.
function oConfidence(hand: Hand): number {
  const curls = allCurls(hand);
  const m = mean(curls);
  const curlScore = clip(1.0 - Math.abs(m - 0.5) / 0.35, 0, 1);
  const pinch = pinchScore(hand, INDEX_TIP);
  const spread = std(curls);
  const penalty = clip(1.0 - Math.max(0, spread - 0.15) / 0.35, 0, 1);
  return Math.min(curlScore, pinch) * penalty;
}

// Letter D: index extended upward; middle/ring/pinky curl in; thumb stays tucked (not held out
// to the side like L).
function dConfidence(hand: Hand): number {
  const curls = allCurls(hand);
  const indexExtended = 1.0 - curls[0];
  const restCurled = Math.min(...curls.slice(1));
  const thumbTucked = 1.0 - thumbExtended(hand);
  return Math.min(indexExtended, restCurled, thumbTucked);
}

// Letter T: closed fist with the thumb tip tucked between the index and middle knuckles
// (distinct from A's thumb resting alongside the index).
// A real recorded pair found the thumb-to-MCP-midpoint distance runs the OPPOSITE direction from
// the original assumption: a relaxed plain fist's thumb sits close to that midpoint (~0.18
// hand-scale units), while a deliberate T pushes the thumb tip farther up between the knuckles
// (~0.35-0.37). This is a band around T's real value, not a one-sided threshold — L/A/Y hold the
// thumb out to the side at ~1.25, even farther than T.
function tConfidence(hand: Hand): number {
  const fistScore = mean(allCurls(hand));
  const mcpMid: [number, number] = [
    (xy(hand, INDEX_MCP)[0] + xy(hand, MIDDLE_MCP)[0]) / 2,
    (xy(hand, INDEX_MCP)[1] + xy(hand, MIDDLE_MCP)[1]) / 2,
  ];
  const d = dist2d(xy(hand, THUMB_TIP), mcpMid) / handScale(hand);
  const thumbBetween = clip(1.0 - Math.abs(d - 0.35) / 0.14, 0, 1);
  return Math.min(fistScore, thumbBetween);
}

const PATTERNS: Record<string, Record<string, number>> = {
  point: { index: 1, middle: 0, ring: 0, pinky: 0 },
  '1': { index: 1, middle: 0, ring: 0, pinky: 0 },
  l: { thumb: 1, index: 1, middle: 0, ring: 0, pinky: 0 },
  y: { thumb: 1, index: 0, middle: 0, ring: 0, pinky: 1 },
  // strict min-based: averaged version let open hands score 0.5+
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

// Index + middle both extended together, ring + pinky curled — N/H's shared 2-finger shape.
// Bug found 2026-07-14 (live user testing, ported from core/handshape.py): a plain MIN-over-
// fingers pattern match can't tell "both fingers genuinely extended together" from "only one
// finger intentionally extended, the other incidentally reads partially extended" — real fingers
// aren't independent. Real N/H execution measures index/middle SIMILARLY extended (gap ~0.04); a
// one-finger confusor measures one dominant, one weak (gap ~0.51) — its own middle-finger score
// can even be HIGHER than a real N's, so no threshold on the MIN alone separates them. Added a
// parity term penalizing a large index/middle gap.
function twoFingerConfidence(hand: Hand): number {
  const ext = extensions(hand);
  const bothExtended = Math.min(ext.index, ext.middle);
  const restCurled = Math.min(1.0 - ext.ring, 1.0 - ext.pinky);
  const gap = Math.abs(ext.middle - ext.index);
  const parity = clip(1.0 - gap / 0.25, 0, 1);
  return Math.min(bothExtended, restCurled, parity);
}

// Letter V: index + middle extended AND held apart (spread) — a real recorded confusor found the
// plain finger-count pattern alone (used elsewhere for N/H/U) lets a JOINED 2-finger hand pass as
// V too, since extension alone doesn't check separation between the two fingertips.
function vConfidence(hand: Hand): number {
  const patternScore = matchPattern(hand, { index: 1, middle: 1, ring: 0, pinky: 0 });
  const spread = dist2d(xy(hand, INDEX_TIP), xy(hand, MIDDLE_TIP)) / handScale(hand);
  const spreadScore = clip((spread - 0.15) / (0.40 - 0.15), 0, 1);
  return Math.min(patternScore, spreadScore);
}

// High when index+middle tips are held CLOSE together (opposite of V's spread requirement).
// High when index+middle tips are held CLOSE together (opposite of V's spread requirement). A
// real recorded H (fingers deliberately held together) measured spread ~0.255 hand-scale units —
// the original 0.05-0.20 "together" band was calibrated too tight. A real plain V measured ~0.816
// on the same metric, so this band has a wide, safe gap: full credit up to ~0.15, fading by 0.6.
function togetherScore(hand: Hand): number {
  const spread = fingerSpread(hand, INDEX_TIP, MIDDLE_TIP);
  return clip((0.60 - spread) / (0.60 - 0.15), 0, 1);
}

// Letter H: index+middle extended TOGETHER (not spread like V), hand rotated sideways.
// Dispatched as "letter_h", NOT "h" — HOSPITAL/NAME already use kind="h" for their own,
// differently-calibrated 2-finger check; reusing "h" here would silently change their behavior.
function letterHConfidence(hand: Hand): number {
  const patternScore = matchPattern(hand, { index: 1, middle: 1, ring: 0, pinky: 0 });
  const together = togetherScore(hand);
  const orient = orientationScore(hand, INDEX_TIP, INDEX_MCP, 90);
  return Math.min(patternScore, together, orient);
}

// Letter U: index+middle extended TOGETHER, held upright (not rotated like H).
function uConfidence(hand: Hand): number {
  const patternScore = matchPattern(hand, { index: 1, middle: 1, ring: 0, pinky: 0 });
  const together = togetherScore(hand);
  const orient = orientationScore(hand, INDEX_TIP, INDEX_MCP, 0);
  return Math.min(patternScore, together, orient);
}

// Letter K: index+middle spread apart (like V), thumb touches the middle finger's BASE (MCP),
// not its tip — distinct from V (no thumb constraint) and F (thumb touches index tip).
// How close the thumb tip is to K/P's real touch distance from the middle-MCP. A real recorded
// pair found this runs the OPPOSITE direction from the original assumption (same mistake as T's
// thumb-position bug): a relaxed V's thumb naturally rests close to the middle-MCP already
// (~0.17 hand-scale units), so reusing the generic "touching" pinch score always saturated to
// 1.0 for a plain V. Genuine K reaches the thumb tip FARTHER out to the middle-MCP (~0.46-0.53) —
// this is a band around K's real value, not a "closer is better" pinch.
function kThumbTouch(hand: Hand): number {
  const d = thumbDist(hand, MIDDLE_MCP);
  return clip(1.0 - Math.abs(d - 0.49) / 0.20, 0, 1);
}

function kConfidence(hand: Hand): number {
  const vPattern = matchPattern(hand, { index: 1, middle: 1, ring: 0, pinky: 0 });
  const spread = fingerSpread(hand, INDEX_TIP, MIDDLE_TIP);
  const spreadScore = clip((spread - 0.15) / (0.40 - 0.15), 0, 1);
  const thumbTouch = kThumbTouch(hand);
  return Math.min(vPattern, spreadScore, thumbTouch);
}

// Letter G: index extended, thumb held out roughly parallel (like L), hand rotated sideways so
// the index points across rather than up.
function gConfidence(hand: Hand): number {
  const indexPattern = matchPattern(hand, { index: 1, middle: 0, ring: 0, pinky: 0 });
  const thumbOut = thumbExtended(hand);
  const orient = orientationScore(hand, INDEX_TIP, INDEX_MCP, 90);
  return Math.min(indexPattern, thumbOut, orient);
}

// Letter Q: same handshape as G, rotated to point downward instead of sideways.
function qConfidence(hand: Hand): number {
  const indexPattern = matchPattern(hand, { index: 1, middle: 0, ring: 0, pinky: 0 });
  const thumbOut = thumbExtended(hand);
  const orient = orientationScore(hand, INDEX_TIP, INDEX_MCP, 180);
  return Math.min(indexPattern, thumbOut, orient);
}

// When the hand points downward (P), the thumb rests near MIDDLE_PIP (~0.25), not MIDDLE_MCP
// (~0.86 away — the opposite side of the hand from where K's thumb touches).
function pThumbPos(hand: Hand): number {
  const d = thumbDist(hand, MIDDLE_PIP);
  return clip(1.0 - Math.abs(d - 0.25) / 0.18, 0, 1);
}

// Letter P: K-like V-shape with both fingers pointing downward, thumb near middle-PIP.
//
// Recalibrated 2026-07-14 to match the Python engine (core/handshape.py's p_confidence) after a
// real webcam recording found two components miscalibrated, both from pointing the hand DOWNWARD
// distorting geometry these checks were tuned against upright (same root cause as the G/H fix):
//   - middle-finger curl: fingerCurl's tip/wrist-vs-mcp/wrist RATIO reads a genuinely extended
//     middle finger as only ~0.25 "extended" when the hand points down (vs index's normal ~0.73)
//     — a real P recording measured this consistently, so P uses its own low floor (>=0.20) for
//     the middle finger instead of the shared matchPattern gate.
//   - orientation: target was 180 (straight down); a real P's own MCP->TIP angle measured 152.
function pConfidence(hand: Hand): number {
  const ext = extensions(hand);
  const indexScore = ext.index;
  const middleScore = clip(ext.middle / 0.20, 0, 1);
  const restCurled = Math.min(1.0 - ext.ring, 1.0 - ext.pinky);
  const spread = fingerSpread(hand, INDEX_TIP, MIDDLE_TIP);
  const spreadScore = clip((spread - 0.15) / (0.40 - 0.15), 0, 1);
  const thumbTouch = pThumbPos(hand);
  const orient = orientationScore(hand, MIDDLE_TIP, MIDDLE_MCP, 152);
  return Math.min(indexScore, middleScore, restCurled, spreadScore, thumbTouch, orient);
}

// Letter R: index and middle extended and CROSSED (their left-right order at the tip is swapped
// relative to their order at the knuckle), ring+pinky curled.
function rConfidence(hand: Hand): number {
  const bothExtended = Math.min(
    1.0 - fingerCurl(hand, INDEX_TIP, INDEX_MCP),
    1.0 - fingerCurl(hand, MIDDLE_TIP, MIDDLE_MCP)
  );
  const ext = extensions(hand);
  const restCurled = Math.min(1.0 - ext.ring, 1.0 - ext.pinky);
  const mcpDx = xy(hand, MIDDLE_MCP)[0] - xy(hand, INDEX_MCP)[0];
  const tipDx = xy(hand, MIDDLE_TIP)[0] - xy(hand, INDEX_TIP)[0];
  const scale = handScale(hand);
  const crossing = mcpDx !== 0 ? (-Math.sign(mcpDx) * tipDx) / scale : 0;
  const crossedScore = clip(crossing / 0.15, 0, 1);
  return Math.min(bothExtended, restCurled, crossedScore);
}

// Letter C: fingers curved together with a clear open gap to the thumb, distinguishing it from O
// (thumb pinches closed against the fingers) and fist (much more curled). Calibrated against a
// real recording (2026-07): a real C's gentle arc barely registers on the tip/wrist curl ratio
// (measured mean curl ~0.00-0.03 — it's an arc, not a knuckle fold, so the old 0.35 curl target
// was never reachable), while the thumb-to-index-fingertip gap measured a consistent ~0.60-0.75,
// which is what actually separates it from O's pinch.
function cConfidence(hand: Hand): number {
  const curls = allCurls(hand);
  const m = mean(curls);
  const curlScore = clip(1.0 - m / 0.4, 0, 1);
  const gap = thumbDist(hand, INDEX_TIP);
  const gapScore = clip(1.0 - Math.abs(gap - 0.70) / 0.35, 0, 1);
  return Math.min(curlScore, gapScore);
}

// All four fingers curled uniformly AND the thumb tip sits in E's characteristic band relative
// to the curled fingertips. "Thumb not extended to the side" alone can't tell E apart from a
// plain closed fist/S — both curl fully with the thumb tucked in; a real user test found a
// simple fist scored E at a perfect 1.0. Distance from the thumb tip to the curled index/middle
// fingertips does separate them, but not in the direction first assumed: real recorded fixtures
// show LETTER_S (a genuine fist) measures ~0.155 hand-scale units here, LETTER_E measures ~0.44
// (median across a real correct take, range 0.41-0.47), and LETTER_M/LETTER_A measure ~0.60/
// ~0.82 — E sits in a distinct middle band. Mirrors core/handshape.py::e_confidence.
function eConfidence(hand: Hand): number {
  const curls = allCurls(hand);
  const m = mean(curls);
  const curlScore = clip((m - 0.45) / 0.25, 0, 1);
  const spread = std(curls);
  const uniformity = clip(1.0 - Math.max(0, spread - 0.15) / 0.35, 0, 1);
  const tipMid: [number, number] = [
    (xy(hand, INDEX_TIP)[0] + xy(hand, MIDDLE_TIP)[0]) / 2,
    (xy(hand, INDEX_TIP)[1] + xy(hand, MIDDLE_TIP)[1]) / 2,
  ];
  const d = dist2d(xy(hand, THUMB_TIP), tipMid) / handScale(hand);
  const thumbBand = clip(1.0 - Math.abs(d - 0.44) / 0.15, 0, 1);
  return Math.min(curlScore, thumbBand) * uniformity;
}

// Letter M: closed fist with thumb tucked under index, middle, AND ring fingers (one more than N).
// Calibrated against a real recording (2026-07): the guessed 0.20 target was roughly half the
// actual measured distance (~0.40-0.44) for this specific 3-knuckle anchor, so a genuine M scored
// 0.0 on the old threshold.
function mConfidence(hand: Hand): number {
  const fistScore = mean(allCurls(hand));
  const mcpMidX = (xy(hand, INDEX_MCP)[0] + xy(hand, MIDDLE_MCP)[0] + xy(hand, RING_MCP)[0]) / 3;
  const mcpMidY = (xy(hand, INDEX_MCP)[1] + xy(hand, MIDDLE_MCP)[1] + xy(hand, RING_MCP)[1]) / 3;
  const d = dist2d(xy(hand, THUMB_TIP), [mcpMidX, mcpMidY]) / handScale(hand);
  const thumbUnder = clip(1.0 - Math.abs(d - 0.42) / 0.20, 0, 1);
  return Math.min(fistScore, thumbUnder);
}

// Letter S: closed fist with thumb wrapped across the FRONT of all fingers (not to the side like
// A, and not between knuckles like T). Scored as fist + thumb not extended.
// Dispatched as 'letter_s' NOT 's' — 's' is a plain-fist alias used by other signs without any
// thumb constraint; adding one there would silently change their behavior.
function letterSConfidence(hand: Hand): number {
  const fistScore = mean(allCurls(hand));
  const thumbIn = 1.0 - thumbExtended(hand);
  return Math.min(fistScore, thumbIn);
}

// Letter X: index finger hooked into a bent/hook shape (mid-curl), other three fingers curled.
// Distinct from 'index' (index fully extended) and fist (index fully curled). Calibrated against
// a real recording (2026-07): a real X hook only bends at one knuckle, which barely moves the
// tip/wrist ratio — measured curl ~0.04-0.12, nowhere near the guessed 0.5 (half-curl) target, so
// a genuine X previously scored 0.0.
function xConfidence(hand: Hand): number {
  const curls = allCurls(hand);
  const indexHooked = clip(1.0 - Math.abs(curls[0] - 0.08) / 0.15, 0, 1);
  const restCurled = Math.min(curls[1], curls[2], curls[3]);
  return Math.min(indexHooked, restCurled);
}

// Letter N: closed fist, thumb tucked under the index and middle fingers specifically (distinct
// from a plain fist/A/T's thumb placement). Same 2D-distance-to-knuckle-line approach as T; may
// share T's real-world ambiguity between "under" and "nearby". Dispatched as "letter_n", NOT
// "n" — NURSE already uses kind="n" for its own, differently-calibrated 2-finger check.
function letterNConfidence(hand: Hand): number {
  const fistScore = mean(allCurls(hand));
  const mcpMid: [number, number] = [
    (xy(hand, INDEX_MCP)[0] + xy(hand, MIDDLE_MCP)[0]) / 2,
    (xy(hand, INDEX_MCP)[1] + xy(hand, MIDDLE_MCP)[1]) / 2,
  ];
  const d = dist2d(xy(hand, THUMB_TIP), mcpMid) / handScale(hand);
  const thumbUnder = clip(1.0 - Math.abs(d - 0.20) / 0.12, 0, 1);
  return Math.min(fistScore, thumbUnder);
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
  flat_o: flatOConfidence,
  f: fConfidence,
  o: oConfidence,
  d: dConfidence,
  t: tConfidence,
  v: vConfidence,
  letter_h: letterHConfidence,
  n: twoFingerConfidence,   // NURSE
  h: twoFingerConfidence,   // HOSPITAL — same 2-finger shape as N
  u: uConfidence,
  k: kConfidence,
  letter_n: letterNConfidence,
  g: gConfidence,
  q: qConfidence,
  p: pConfidence,
  r: rConfidence,
  c: cConfidence,
  e: eConfidence,
  m: mConfidence,
  letter_s: letterSConfidence,
  x: xConfidence,
};

export function handshapeConfidence(hand: Hand, kind: string): number {
  const k = kind.toLowerCase();
  const fn = DISPATCH[k];
  if (fn) return fn(hand);
  const pattern = PATTERNS[k];
  if (pattern) return matchPattern(hand, pattern);
  return 0;
}
