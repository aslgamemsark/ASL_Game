/**
 * Unit tests for the two-hand role-assignment pipeline: assignRoles (verifier.ts, exported) picks
 * DOMINANT/NONDOMINANT purely from which hand moved more across the buffer — a deliberate choice
 * (see MEDICINE's KNOWN_ACCEPTED_GAPS entry in test-all-signs.ts: "role assignment is entirely
 * motion-based") — and bestFitRoles (private) then corrects that guess using actual handshape
 * evidence whenever a sign's two hands need genuinely different shapes.
 *
 * assignRoles needs no realistic hand geometry to test — it only sums palm-center displacement, so
 * synthetic coordinates are trustworthy here (this is pure motion math, not a claim that a crafted
 * frame represents any real recognized sign — the failure mode "synthetic-fixture false-confidence"
 * applies to handshape/pass claims, not to this).
 *
 * bestFitRoles is NOT exported (verify() is the module's real public contract, matching this
 * project's existing convention — see verifier-nmm.test.ts testing NMM scoring through verify()
 * rather than reaching into private helpers) and its correction depends on actual handshape
 * confidence, which synthetic hand geometry cannot be trusted to approximate (the exact trap
 * new-sign's anti-bug gate exists to prevent). Tested instead through verify() against HELP's real
 * recorded correct.json (fist-dominant, open-nondominant — genuinely different shapes, the only
 * case bestFitRoles ever acts on) with its two hands' labels swapped: real, already-validated
 * landmark data, only the wire-format handedness tag changed.
 */
import { describe, it, expect } from 'vitest';
import { RollingBuffer, frameFromDict, type Frame, type Hand } from '../src/engine/landmarks';
import { assignRoles, verify, resultGet } from '../src/engine/verifier';
import { DOMINANT, NONDOMINANT } from '../src/engine/schema';
import { HELP } from '../src/engine/signs/index';
import helpCorrectFixture from './fixtures/help_correct.json';

function handAt(handedness: string, x: number, y: number): Hand {
  // Palm points (indices 0,5,9,13,17) all coincide at (x,y) — handCenter is their mean, so this is
  // an exact, unambiguous position for path-length math. The other 16 points are unused by
  // assignRoles (handCenter only reads PALM_POINTS) — zeroed, matching this file's own OPEN_HAND
  // convention in verifier-nmm.test.ts for indices no test here reads.
  const points: number[][] = Array.from({ length: 21 }, () => [0, 0, 0]);
  for (const i of [0, 5, 9, 13, 17]) points[i] = [x, y, 0];
  return { handedness, points };
}

function buildBuffer(frames: { t: number; hands: Hand[] }[]): RollingBuffer {
  const buf = new RollingBuffer(2.0);
  for (const f of frames) {
    buf.add({ t: f.t, width: 640, height: 480, hands: f.hands, leftShoulder: null, rightShoulder: null, mouth: null, faceBlendshapes: null });
  }
  return buf;
}

describe('assignRoles', () => {
  it('returns {} for an empty buffer', () => {
    expect(assignRoles(new RollingBuffer(2.0))).toEqual({});
  });

  it('a single hand is always DOMINANT', () => {
    const buf = buildBuffer([
      { t: 0, hands: [handAt('Right', 100, 100)] },
      { t: 0.1, hands: [handAt('Right', 150, 100)] },
    ]);
    expect(assignRoles(buf)).toEqual({ [DOMINANT]: 'Right' });
  });

  it('the hand that moved more is DOMINANT, the still hand NONDOMINANT', () => {
    const buf = buildBuffer([
      { t: 0, hands: [handAt('Left', 200, 200), handAt('Right', 100, 100)] },
      { t: 0.1, hands: [handAt('Left', 200, 200), handAt('Right', 250, 100)] },
      { t: 0.2, hands: [handAt('Left', 200, 200), handAt('Right', 100, 200)] },
    ]);
    // Right travels 150 + sqrt(150^2+100^2) ≈ 330px; Left travels 0px.
    expect(assignRoles(buf)).toEqual({ [DOMINANT]: 'Right', [NONDOMINANT]: 'Left' });
  });

  it('is not hardcoded to either label — reversing which hand moves flips the result', () => {
    const buf = buildBuffer([
      { t: 0, hands: [handAt('Left', 100, 100), handAt('Right', 200, 200)] },
      { t: 0.1, hands: [handAt('Left', 250, 100), handAt('Right', 200, 200)] },
      { t: 0.2, hands: [handAt('Left', 100, 200), handAt('Right', 200, 200)] },
    ]);
    expect(assignRoles(buf)).toEqual({ [DOMINANT]: 'Left', [NONDOMINANT]: 'Right' });
  });
});

describe('bestFitRoles (tested through verify(), matching this file\'s own private-helper convention)', () => {
  function loadHelpFrames(swapLabels: boolean): Frame[] {
    return helpCorrectFixture.frames.map((fd) => {
      const frame = frameFromDict(fd as Parameters<typeof frameFromDict>[0]);
      if (!swapLabels) return frame;
      return { ...frame, hands: frame.hands.map((h) => ({ ...h, handedness: h.handedness === 'Left' ? 'Right' : 'Left' })) };
    });
  }

  // HELP: dominant=fist, nondominant=open — genuinely different required shapes, the only
  // condition bestFitRoles ever corrects under (see its own early-return for same-kind hands).
  // Replays incrementally through a real sliding buffer, matching test-all-signs.ts's bestOverClip
  // — HELP's own documented rule-based ceiling (KNOWN_ACCEPTED_GAPS) means the LAST frame isn't
  // guaranteed to have the best fit, only that some frame during the clip does.
  function bestHandshapeScores(frames: Frame[]) {
    const buf = new RollingBuffer(2.0);
    let bestDom = 0, bestNon = 0;
    for (const frame of frames) {
      buf.add(frame);
      const result = verify(buf, HELP);
      const dom = resultGet(result, 'handshape_dominant');
      const non = resultGet(result, 'handshape_nondominant');
      if (dom) bestDom = Math.max(bestDom, dom.score);
      if (non) bestNon = Math.max(bestNon, non.score);
    }
    return { bestDom, bestNon };
  }

  it('real recording: both handshapes clear their threshold at some point in the clip', () => {
    const { bestDom, bestNon } = bestHandshapeScores(loadHelpFrames(false));
    // Thresholds from HELP's own definition (engine/signs/index.ts): dominant 0.5, nondominant 0.45.
    expect(bestDom).toBeGreaterThanOrEqual(0.5);
    expect(bestNon).toBeGreaterThanOrEqual(0.45);
  });

  it('with hand labels swapped: role correction still finds both handshapes clearing — ' +
    'proves the match is shape-driven, not dependent on which physical hand happened to carry ' +
    'which wire-format label', () => {
    const { bestDom, bestNon } = bestHandshapeScores(loadHelpFrames(true));
    expect(bestDom).toBeGreaterThanOrEqual(0.5);
    expect(bestNon).toBeGreaterThanOrEqual(0.45);
  });
});
