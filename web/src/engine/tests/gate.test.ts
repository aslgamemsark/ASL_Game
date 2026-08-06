import { describe, it, expect } from 'vitest';
import { gateOutcome, gatePass, gateHint, type ClassifierVote } from '../gate';
import { GATE_ENFORCED } from '@/config/classifier';

/**
 * Mechanism regression tests for the AI disambiguation gate.
 *
 * The production defect these lock down (2026-07-27): the classifier rejected 170 of 240 correct
 * HELLO attempts that the rule verifier had already passed, because on live webcam input the model
 * is CONFIDENTLY wrong (it called a correct HELLO "HOSPITAL" @ 0.938, "NO_SIGN" @ 0.872) rather
 * than merely uncertain. These tests assert the shadow-mode contract directly — a confident wrong
 * vote must not be able to fail a learner while enforcement is off — rather than re-checking any
 * particular sign's pass rate.
 */

/** A confidently-wrong vote of the shape actually observed in production for HELLO. */
function confidentlyWrongVote(wrongSign = 'HOSPITAL', confidence = 0.938): ClassifierVote {
  return { topSign: wrongSign, confidence, perSign: { [wrongSign]: confidence, HELLO: 1 - confidence } };
}

describe('gateOutcome — shadow mode (enforcement off)', () => {
  it('lets a rule-pass through despite a confidently-wrong veto', () => {
    const { passed, modelVetoed } = gateOutcome(true, confidentlyWrongVote(), 'HELLO', 0.7, false);
    expect(passed).toBe(true);
    expect(modelVetoed).toBe(true); // still recorded, for veto-precision measurement
  });

  it('records the veto even at the maximum confidence seen in production (0.967)', () => {
    const { passed, modelVetoed } = gateOutcome(
      true, confidentlyWrongVote('HOSPITAL', 0.967), 'HELLO', 0.7, false
    );
    expect(passed).toBe(true);
    expect(modelVetoed).toBe(true);
  });

  it('never turns a rule FAILURE into a pass — rules stay authoritative', () => {
    const agreeing: ClassifierVote = { topSign: 'HELLO', confidence: 0.99, perSign: { HELLO: 0.99 } };
    const { passed, modelVetoed } = gateOutcome(false, agreeing, 'HELLO', 0.7, false);
    expect(passed).toBe(false);
    expect(modelVetoed).toBe(false); // a rule failure is not a veto
  });
});

describe('gateOutcome — enforcement on (re-enable path)', () => {
  it('rejects a rule-pass on a confident wrong vote', () => {
    const { passed, modelVetoed } = gateOutcome(true, confidentlyWrongVote(), 'HELLO', 0.7, true);
    expect(passed).toBe(false);
    expect(modelVetoed).toBe(true);
  });

  it('passes when the model agrees', () => {
    const agreeing: ClassifierVote = { topSign: 'HELLO', confidence: 0.9, perSign: { HELLO: 0.9 } };
    expect(gateOutcome(true, agreeing, 'HELLO', 0.7, true)).toEqual({ passed: true, modelVetoed: false });
  });

  it('does not veto on low-confidence disagreement', () => {
    const unsure: ClassifierVote = { topSign: 'HOSPITAL', confidence: 0.55, perSign: { HOSPITAL: 0.55 } };
    expect(gateOutcome(true, unsure, 'HELLO', 0.7, true)).toEqual({ passed: true, modelVetoed: false });
  });

  it('passes when the classifier produced no vote at all', () => {
    expect(gateOutcome(true, null, 'HELLO', 0.7, true)).toEqual({ passed: true, modelVetoed: false });
  });
});

describe('gatePass — unchanged model-opinion primitive', () => {
  it('still reports the raw model opinion, independent of enforcement', () => {
    expect(gatePass(true, confidentlyWrongVote(), 'HELLO', 0.7)).toBe(false);
  });
});

describe('gatePass — NO_SIGN is never a veto (mechanism fix, 2026-08-04)', () => {
  // 108 of 124 production vetoes in a 30-day PostHog sample were NO_SIGN — the model claiming
  // no sign happened at all, about attempts the rule verifier had already cleared on every
  // required parameter. NO_SIGN is an absence class, not a competing named sign; asserting
  // otherwise is the category error this fix removes, at any confidence and with enforcement on.
  it('never vetoes on NO_SIGN, even at the highest confidence observed in production (0.926)', () => {
    expect(gatePass(true, confidentlyWrongVote('NO_SIGN', 0.926), 'HELLO', 0.7)).toBe(true);
  });

  it('does not veto on NO_SIGN with enforcement ON', () => {
    const { passed, modelVetoed } = gateOutcome(
      true, confidentlyWrongVote('NO_SIGN', 0.899), 'HELLO', 0.7, true
    );
    expect(passed).toBe(true);
    expect(modelVetoed).toBe(false);
  });

  it('still vetoes a genuine wrong-sign vote at the SAME confidence NO_SIGN no longer does', () => {
    // Proves the fix is scoped to NO_SIGN specifically, not a blanket loosening of the gate.
    const { passed, modelVetoed } = gateOutcome(
      true, confidentlyWrongVote('HOSPITAL', 0.899), 'HELLO', 0.7, true
    );
    expect(passed).toBe(false);
    expect(modelVetoed).toBe(true);
  });

  it('still lets NO_SIGN drive the additive coaching hint — only the veto is removed', () => {
    expect(gateHint(confidentlyWrongVote('NO_SIGN', 0.9), 'HELLO')).toBe(
      "That didn't look like a sign at all — check the reference."
    );
  });
});

describe('shipped configuration', () => {
  it('has enforcement OFF — flipping this on must be a deliberate, evidence-backed change', () => {
    // Guards against an accidental re-enable. When the three criteria documented on
    // GATE_ENFORCED are met, update this expectation in the same commit as the flip.
    expect(GATE_ENFORCED).toBe(false);
  });

  it('defaults to shadow mode when `enforced` is omitted', () => {
    expect(gateOutcome(true, confidentlyWrongVote(), 'HELLO').passed).toBe(true);
  });
});
