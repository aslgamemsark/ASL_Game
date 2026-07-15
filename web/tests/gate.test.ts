import { describe, it, expect } from 'vitest';
import { gatePass, gateHint, type ClassifierVote } from '../src/engine/gate';

const vote = (perSign: Record<string, number>): ClassifierVote => {
  const top = Object.entries(perSign).sort((a, b) => b[1] - a[1])[0];
  return { topSign: top[0], confidence: top[1], perSign };
};

describe('gatePass (veto-only)', () => {
  it('rule failure is never rescued by the classifier', () => {
    expect(gatePass(false, vote({ COFFEE: 0.99 }), 'COFFEE')).toBe(false);
  });

  it('classifier disabled (no vote) -> rules alone (back-compat)', () => {
    expect(gatePass(true, null, 'COFFEE')).toBe(true);
  });

  it('rule pass + model agrees -> pass', () => {
    expect(gatePass(true, vote({ COFFEE: 0.9, TEA: 0.1 }), 'COFFEE')).toBe(true);
  });

  it('THE KEY CASE: rule pass but model is CONFIDENT it is a different sign -> vetoed', () => {
    expect(gatePass(true, vote({ TEA: 0.85, COFFEE: 0.1 }), 'COFFEE', 0.7)).toBe(false);
  });

  it('NEVER vetoes on uncertainty: correct sign the model is unsure about still passes', () => {
    // Model's top guess is wrong (TEA) but low-confidence -> do NOT reject the user's COFFEE.
    expect(gatePass(true, vote({ TEA: 0.45, COFFEE: 0.4 }), 'COFFEE', 0.7)).toBe(true);
  });

  it('does not veto when the model agrees, even at high confidence', () => {
    expect(gatePass(true, vote({ COFFEE: 0.95 }), 'COFFEE', 0.7)).toBe(true);
  });

  it('respects the veto threshold', () => {
    // Different top sign at 0.65 < 0.7 threshold -> no veto; at 0.75 >= 0.7 -> veto.
    expect(gatePass(true, vote({ TEA: 0.65, COFFEE: 0.2 }), 'COFFEE', 0.7)).toBe(true);
    expect(gatePass(true, vote({ TEA: 0.75, COFFEE: 0.2 }), 'COFFEE', 0.7)).toBe(false);
  });
});

describe('gateHint', () => {
  it('no hint when classifier disabled', () => {
    expect(gateHint(null, 'COFFEE')).toBeNull();
  });

  it('no hint when model agrees with the prompt', () => {
    expect(gateHint(vote({ COFFEE: 0.9 }), 'COFFEE')).toBeNull();
  });

  it('hints toward the confidently-detected different sign', () => {
    const h = gateHint(vote({ THANK_YOU: 0.8, COFFEE: 0.1 }), 'COFFEE');
    expect(h).toContain('THANK YOU');
  });

  it('uses natural-language wording for NO_SIGN instead of the raw class name', () => {
    const h = gateHint(vote({ NO_SIGN: 0.8, COFFEE: 0.1 }), 'COFFEE');
    expect(h).not.toContain('NO SIGN');
    expect(h).not.toContain('NO_SIGN');
    expect(h).toContain("didn't look like a sign");
  });
});
