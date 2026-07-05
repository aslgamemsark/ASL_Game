import { describe, it, expect } from 'vitest';
import { advanceGateState, initGateState, SUSTAIN_FRAMES, CONFIDENT_FAIL_MARGIN } from '../coachingGate';

function feed(scores: number[], threshold: number, required = true) {
  let state = initGateState();
  for (const score of scores) {
    state = advanceGateState(state, score, threshold, required);
  }
  return state;
}

describe('advanceGateState', () => {
  it('clears immediately once score meets threshold', () => {
    const state = feed([0.1, 0.65], 0.6);
    expect(state.status).toBe('cleared');
  });

  it('stays neutral for a score just below threshold (ambiguous band), even sustained', () => {
    const justBelow = 0.6 - CONFIDENT_FAIL_MARGIN + 0.01;
    const state = feed(Array(SUSTAIN_FRAMES + 5).fill(justBelow), 0.6);
    expect(state.status).toBe('neutral');
  });

  it('stays neutral for a single confidently-low frame (not yet sustained)', () => {
    const wellBelow = 0.6 - CONFIDENT_FAIL_MARGIN - 0.1;
    const state = feed([wellBelow], 0.6);
    expect(state.status).toBe('neutral');
  });

  it('fires confident-fail only after a sustained run of clearly-low scores', () => {
    const wellBelow = 0.6 - CONFIDENT_FAIL_MARGIN - 0.1;
    const almostSustained = feed(Array(SUSTAIN_FRAMES - 1).fill(wellBelow), 0.6);
    expect(almostSustained.status).toBe('neutral');

    const sustained = feed(Array(SUSTAIN_FRAMES).fill(wellBelow), 0.6);
    expect(sustained.status).toBe('confident-fail');
  });

  it('resets the fail streak on a single good frame, preventing a stale confident-fail', () => {
    const wellBelow = 0.6 - CONFIDENT_FAIL_MARGIN - 0.1;
    let state = initGateState();
    for (let i = 0; i < SUSTAIN_FRAMES - 1; i++) {
      state = advanceGateState(state, wellBelow, 0.6, true);
    }
    // one ambiguous frame in the middle of the run resets the streak
    state = advanceGateState(state, 0.55, 0.6, true);
    expect(state.status).toBe('neutral');
    expect(state.failStreak).toBe(0);
  });

  it('never confident-fails a non-required parameter', () => {
    const wellBelow = 0.6 - CONFIDENT_FAIL_MARGIN - 0.2;
    const state = feed(Array(SUSTAIN_FRAMES + 10).fill(wellBelow), 0.6, false);
    expect(state.status).toBe('neutral');
  });
});
