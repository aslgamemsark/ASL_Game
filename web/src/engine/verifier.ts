import { clip, median } from './math-utils';
import { handshapeConfidence } from './handshape';
import * as mv from './movement';
import { facingConfidence } from './orientation';
import {
  type Frame, type RollingBuffer,
  handCenter, frameHand, frameShoulderWidth, normalizedDistance,
} from './landmarks';
import {
  DOMINANT, NONDOMINANT,
  Anchor, MovementKind,
  type Sign,
} from './schema';

const SMOOTH_SECONDS = 0.5;

const CHEST_OFFSET_RATIO = 0.35;
const CHEST_VBAND = 0.25;
const CHEST_VFALL = 0.12;

const CHIN_DY = 0.45;
const CHIN_DY_BAND = 0.18;
const CHIN_DY_FALL = 0.17;

const FOREHEAD_DY_MAX = 0.15;
const FOREHEAD_DY_FALL = 0.30;

const BELLY_DY = 0.90;
const BELLY_DY_BAND = 0.30;
const BELLY_DY_FALL = 0.25;

const SHOULDER_FALL = 0.30;

export interface ParamScore {
  name: string;
  score: number;
  threshold: number;
  required: boolean;
}

export function paramCleared(p: ParamScore): boolean {
  return p.score >= p.threshold;
}

export function paramPassed(p: ParamScore): boolean {
  return !p.required || paramCleared(p);
}

export interface VerifyResult {
  signName: string;
  params: ParamScore[];
  roles: Record<string, string>;
}

export function resultPassed(r: VerifyResult): boolean {
  const required = r.params.filter((p) => p.required);
  return required.length > 0 && required.every(paramPassed);
}

export function resultFailingRequired(r: VerifyResult): string[] {
  return r.params.filter((p) => p.required && !paramCleared(p)).map((p) => p.name);
}

export function resultGet(r: VerifyResult, name: string): ParamScore | undefined {
  return r.params.find((p) => p.name === name);
}

type Traj = [number, number[]][];

function trajectory(buffer: RollingBuffer, handedness: string | null): Traj {
  if (!handedness) return [];
  const out: Traj = [];
  for (const f of buffer) {
    const h = frameHand(f, handedness);
    if (h) out.push([f.t, handCenter(h)]);
  }
  return out;
}

// Frame-aligned (t, all 21 landmark points) pairs for two hands, for CONVERGE's closest-fingertip
// distance — palm centers never get very close even when fingertips touch.
function alignedPairPoints(
  buffer: RollingBuffer,
  labelA: string,
  labelB: string
): [mv.PointsTraj, mv.PointsTraj] {
  const trajA: mv.PointsTraj = [];
  const trajB: mv.PointsTraj = [];
  for (const f of buffer) {
    const ha = frameHand(f, labelA);
    const hb = frameHand(f, labelB);
    if (ha && hb) {
      trajA.push([f.t, ha.points.map((p) => [p[0], p[1]])]);
      trajB.push([f.t, hb.points.map((p) => [p[0], p[1]])]);
    }
  }
  return [trajA, trajB];
}

function pathLength(traj: Traj): number {
  if (traj.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < traj.length; i++) {
    const dx = traj[i][1][0] - traj[i - 1][1][0];
    const dy = traj[i][1][1] - traj[i - 1][1][1];
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

export function assignRoles(buffer: RollingBuffer): Record<string, string> {
  const labels: string[] = [];
  for (const f of buffer) {
    for (const h of f.hands) {
      if (!labels.includes(h.handedness)) labels.push(h.handedness);
    }
  }
  if (labels.length === 0) return {};
  if (labels.length === 1) return { [DOMINANT]: labels[0] };
  labels.sort((a, b) => pathLength(trajectory(buffer, b)) - pathLength(trajectory(buffer, a)));
  return { [DOMINANT]: labels[0], [NONDOMINANT]: labels[1] };
}

function recent(buffer: RollingBuffer, seconds: number): Frame[] {
  const frames = buffer.frames;
  if (frames.length === 0) return [];
  const endT = frames[frames.length - 1].t;
  return frames.filter((f) => endT - f.t <= seconds);
}

function latestShoulderWidth(buffer: RollingBuffer): number | null {
  const frames = buffer.frames;
  for (let i = frames.length - 1; i >= 0; i--) {
    const sw = frameShoulderWidth(frames[i]);
    if (sw) return sw;
  }
  return null;
}

function scoreHandshape(buffer: RollingBuffer, handedness: string | null, kind: string): number {
  if (!handedness) return 0;
  const vals: number[] = [];
  for (const f of recent(buffer, SMOOTH_SECONDS)) {
    const h = frameHand(f, handedness);
    if (h) vals.push(handshapeConfidence(h, kind));
  }
  return vals.length > 0 ? median(vals) : 0;
}

function bestFitRoles(
  buffer: RollingBuffer,
  sign: Sign,
  roles: Record<string, string>
): Record<string, string> {
  if (!sign.twoHanded || !sign.nondominant) return roles;
  if (sign.dominant.kind === sign.nondominant.kind) return roles;
  const dl = roles[DOMINANT];
  const nl = roles[NONDOMINANT];
  if (!dl || !nl) return roles;
  const dk = sign.dominant.kind;
  const nk = sign.nondominant.kind;
  const current = Math.min(scoreHandshape(buffer, dl, dk), scoreHandshape(buffer, nl, nk));
  const swapped = Math.min(scoreHandshape(buffer, nl, dk), scoreHandshape(buffer, dl, nk));
  if (swapped > current) return { [DOMINANT]: nl, [NONDOMINANT]: dl };
  return roles;
}

function bandScore(d: number, lo: number, hi: number): number {
  if (lo <= d && d <= hi) return 1;
  const span = Math.max(hi - lo, hi, 1e-6);
  if (d < lo) return clip(1 - (lo - d) / span, 0, 1);
  return clip(1 - (d - hi) / span, 0, 1);
}

function verticalScore(
  vertical: 'above' | 'below' | null | undefined,
  actingC: number[],
  otherC: number[],
  shoulderWidth: number
): number {
  if (!vertical) return 1;
  const dy = (otherC[1] - actingC[1]) / Math.max(shoulderWidth, 1e-6);
  const ramp = 0.33;
  if (vertical === 'above') return dy >= 0 ? 1 : clip(1 + dy / ramp, 0, 1);
  if (vertical === 'below') return dy <= 0 ? 1 : clip(1 - dy / ramp, 0, 1);
  return 1;
}

function scoreChinReach(
  buffer: RollingBuffer,
  actingLabel: string,
  shoulderWidth: number,
  loc: Sign['location']
): number {
  let best = 0;
  for (const f of buffer) {
    const h = frameHand(f, actingLabel);
    if (!h || !f.mouth) continue;
    const c = handCenter(h);
    const dx = Math.abs(c[0] - f.mouth[0]) / shoulderWidth;
    const dy = (c[1] - f.mouth[1]) / shoulderWidth;
    const vert = 1 - Math.max(0, Math.abs(dy - CHIN_DY) - CHIN_DY_BAND) / CHIN_DY_FALL;
    const horiz = 1 - Math.max(0, dx - loc.maxDistRatio) / 0.35;
    best = Math.max(best, Math.min(vert, horiz));
  }
  return clip(best, 0, 1);
}

function scoreLocation(
  buffer: RollingBuffer,
  sign: Sign,
  roles: Record<string, string>,
  shoulderWidth: number | null
): number {
  if (!shoulderWidth) return 0;
  const loc = sign.location;
  const actingLabel = roles[loc.actingHand];
  if (!actingLabel) return 0;

  if (loc.anchor === Anchor.CHIN) {
    return scoreChinReach(buffer, actingLabel, shoulderWidth, loc);
  }

  const vals: number[] = [];
  for (const f of recent(buffer, SMOOTH_SECONDS)) {
    const acting = frameHand(f, actingLabel);
    if (!acting) continue;
    const ac = handCenter(acting);

    if (loc.anchor === Anchor.OTHER_HAND) {
      const otherRole = loc.actingHand === DOMINANT ? NONDOMINANT : DOMINANT;
      const otherLabel = roles[otherRole];
      const other = otherLabel ? frameHand(f, otherLabel) : null;
      if (!other) continue;
      const oc = handCenter(other);
      let d: number;
      if (loc.useClosestApproach) {
        let minD = Infinity;
        for (const ap of acting.points) {
          for (const op of other.points) {
            const dx = ap[0] - op[0], dy = ap[1] - op[1];
            minD = Math.min(minD, Math.sqrt(dx * dx + dy * dy));
          }
        }
        d = minD / shoulderWidth;
      } else {
        d = normalizedDistance(ac, oc, shoulderWidth);
      }
      const distScore = bandScore(d, loc.minDistRatio, loc.maxDistRatio);
      const vScore = verticalScore(loc.vertical, ac, oc, shoulderWidth);
      let score = Math.min(distScore, vScore);
      if (loc.below === 'mouth' && f.mouth) {
        const dy = (ac[1] - f.mouth[1]) / shoulderWidth;
        score *= clip((dy + 0.1) / 0.3, 0, 1);
      }
      vals.push(score);
    } else if (loc.anchor === Anchor.CHEST) {
      if (!f.leftShoulder || !f.rightShoulder) continue;
      const mid = [(f.leftShoulder[0] + f.rightShoulder[0]) / 2, (f.leftShoulder[1] + f.rightShoulder[1]) / 2];
      const dx = Math.abs(ac[0] - mid[0]) / shoulderWidth;
      const dy = (ac[1] - mid[1]) / shoulderWidth;
      const v = 1 - Math.max(0, Math.abs(dy - CHEST_OFFSET_RATIO) - CHEST_VBAND) / CHEST_VFALL;
      const h = 1 - Math.max(0, dx - loc.maxDistRatio) / 0.35;
      vals.push(clip(Math.min(v, h), 0, 1));
    } else if (loc.anchor === Anchor.FOREHEAD) {
      if (!f.mouth) continue;
      const dx = Math.abs(ac[0] - f.mouth[0]) / shoulderWidth;
      const dy = (ac[1] - f.mouth[1]) / shoulderWidth;
      const v = 1 - Math.max(0, dy - FOREHEAD_DY_MAX) / FOREHEAD_DY_FALL;
      const h = 1 - Math.max(0, dx - loc.maxDistRatio) / 0.4;
      vals.push(clip(Math.min(v, h), 0, 1));
    } else if (loc.anchor === Anchor.BELLY) {
      if (!f.leftShoulder || !f.rightShoulder) continue;
      const mid = [(f.leftShoulder[0] + f.rightShoulder[0]) / 2, (f.leftShoulder[1] + f.rightShoulder[1]) / 2];
      const dx = Math.abs(ac[0] - mid[0]) / shoulderWidth;
      const dy = (ac[1] - mid[1]) / shoulderWidth;
      const v = 1 - Math.max(0, Math.abs(dy - BELLY_DY) - BELLY_DY_BAND) / BELLY_DY_FALL;
      const h = 1 - Math.max(0, dx - loc.maxDistRatio) / 0.4;
      vals.push(clip(Math.min(v, h), 0, 1));
    } else if (loc.anchor === Anchor.SHOULDER) {
      if (!f.leftShoulder || !f.rightShoulder) continue;
      const dL = normalizedDistance(ac, f.leftShoulder, shoulderWidth);
      const dR = normalizedDistance(ac, f.rightShoulder, shoulderWidth);
      const d = Math.min(dL, dR);
      vals.push(clip(1 - Math.max(0, d - loc.maxDistRatio) / SHOULDER_FALL, 0, 1));
    } else {
      // NEUTRAL_SPACE
      if (!f.leftShoulder || !f.rightShoulder) continue;
      const mid = [(f.leftShoulder[0] + f.rightShoulder[0]) / 2, (f.leftShoulder[1] + f.rightShoulder[1]) / 2];
      const d = normalizedDistance(ac, mid, shoulderWidth);
      const distScore = bandScore(d, 0, loc.maxDistRatio);
      const below = ac[1] > mid[1];
      vals.push(below ? distScore : distScore * 0.5);
    }
  }

  return vals.length > 0 ? median(vals) : 0;
}

function scoreMovement(
  buffer: RollingBuffer,
  sign: Sign,
  roles: Record<string, string>,
  shoulderWidth: number | null
): number {
  const req = sign.movement;
  if (req.kind === MovementKind.NONE) return 1;
  const actorLabel = roles[req.actor];
  const actorTraj = trajectory(buffer, actorLabel ?? null);
  if (!shoulderWidth || actorTraj.length === 0) return 0;

  if (req.kind === MovementKind.CONVERGE) {
    const ndomLabel = roles[NONDOMINANT];
    if (!ndomLabel) return 0;
    const [trajA, trajB] = alignedPairPoints(buffer, actorLabel!, ndomLabel);
    return mv.convergeConfidence(trajA, trajB, shoulderWidth, req);
  }
  return mv.movementConfidence(actorTraj, shoulderWidth, req);
}

function scoreOrientation(
  buffer: RollingBuffer,
  sign: Sign,
  roles: Record<string, string>
): number {
  const o = sign.orientation;
  if (!o) return 0;
  const label = roles[o.hand];
  if (!label) return 0;
  const vals: number[] = [];
  for (const f of recent(buffer, SMOOTH_SECONDS)) {
    const h = frameHand(f, label);
    if (h) vals.push(facingConfidence(h, o.facing));
  }
  return vals.length > 0 ? median(vals) : 0;
}

/**
 * Score a facial blendshape held over the recent window (median-smoothed), same convention as
 * every other scorer here: frames with no data are excluded, and an empty window scores 0. Every
 * current NMM requirement is `required: false`, so a 0 here (e.g. face capture wasn't enabled
 * this session) never gates `resultPassed` — it only affects a graded/coaching score.
 */
// Signs with no nondominant handshape requirement are defined as one-handed — a fluent signer
// doesn't hold up an idle second hand while producing them. Without this check, a sign like
// PLEASE or THANK_YOU passed even with the other hand held up in frame doing nothing, because
// every other scorer here only checks the hand(s) a sign's definition actually references and
// silently ignores whatever else MediaPipe detects (production bug report, 2026-07-14).
const EXTRA_HAND_TOLERANCE = 0.8;

function scoreNoExtraHand(buffer: RollingBuffer, roles: Record<string, string>): number {
  const domLabel = roles[DOMINANT] ?? null;
  const frames = recent(buffer, SMOOTH_SECONDS);
  if (!domLabel || frames.length === 0) return 1; // nothing to judge yet — don't false-fail
  let extraCount = 0;
  for (const f of frames) {
    if (f.hands.some((h) => h.handedness !== domLabel)) extraCount++;
  }
  return clip(1 - extraCount / frames.length, 0, 1);
}

function scoreNmm(buffer: RollingBuffer, sign: Sign): number {
  const n = sign.nmm;
  if (!n) return 0;
  const vals: number[] = [];
  for (const f of recent(buffer, SMOOTH_SECONDS)) {
    if (f.faceBlendshapes) {
      const raw = f.faceBlendshapes[n.blendshape] ?? 0;
      vals.push(clip(raw / Math.max(n.minScore, 1e-6), 0, 1));
    }
  }
  return vals.length > 0 ? median(vals) : 0;
}

export function verify(buffer: RollingBuffer, sign: Sign): VerifyResult {
  const roles = bestFitRoles(buffer, sign, assignRoles(buffer));
  const sw = latestShoulderWidth(buffer);
  const params: ParamScore[] = [];

  const dom = sign.dominant;
  params.push({
    name: 'handshape_dominant',
    score: scoreHandshape(buffer, roles[DOMINANT] ?? null, dom.kind),
    threshold: dom.minConfidence,
    required: dom.required,
  });

  if (sign.nondominant) {
    const nd = sign.nondominant;
    params.push({
      name: 'handshape_nondominant',
      score: scoreHandshape(buffer, roles[NONDOMINANT] ?? null, nd.kind),
      threshold: nd.minConfidence,
      required: nd.required,
    });
  } else {
    params.push({
      name: 'no_extra_hand',
      score: scoreNoExtraHand(buffer, roles),
      threshold: EXTRA_HAND_TOLERANCE,
      required: true,
    });
  }

  params.push({
    name: 'location',
    score: scoreLocation(buffer, sign, roles, sw),
    threshold: sign.location.minConfidence,
    required: sign.location.required,
  });

  params.push({
    name: 'movement',
    score: scoreMovement(buffer, sign, roles, sw),
    threshold: sign.movement.minConfidence,
    required: sign.movement.required,
  });

  if (sign.orientation) {
    params.push({
      name: 'orientation',
      score: scoreOrientation(buffer, sign, roles),
      threshold: sign.orientation.minConfidence,
      required: sign.orientation.required,
    });
  }

  if (sign.nmm) {
    params.push({
      name: 'nmm',
      score: scoreNmm(buffer, sign),
      threshold: sign.nmm.minConfidence,
      required: sign.nmm.required,
    });
  }

  return { signName: sign.name, params, roles };
}
