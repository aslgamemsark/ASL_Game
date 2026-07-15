/**
 * Train/inference feature parity: the browser's clipToSequence() MUST match ml/dataset.py
 * exactly, or the trained model degrades silently. The golden file seq_coffee_correct.json
 * was produced by ml.dataset.clip_to_sequence on the same fixture; if this test fails, the
 * TS and Python feature extractors have diverged — fix before trusting any model.
 */
import { describe, it, expect } from 'vitest';
import { frameFromDict } from '../src/engine/landmarks';
import { clipToSequence, SEQ_LEN, FEAT_DIM } from '../src/engine/sequenceFeatures';

import coffeeCorrect from './fixtures/coffee_correct.json';
import golden from './fixtures/seq_coffee_correct.json';
import leftDominantProbe from './fixtures/parity/left_dominant_probe.json';
import leftDominantGolden from './fixtures/parity/seq_left_dominant_probe.json';

function expectParity(rawFrames: unknown[], golden: { data: number[][] }) {
  const frames = rawFrames.map((fd) => frameFromDict(fd as Parameters<typeof frameFromDict>[0]));
  const seq = clipToSequence(frames);
  expect(seq).not.toBeNull();
  let maxDiff = 0;
  for (let t = 0; t < SEQ_LEN; t++) {
    for (let j = 0; j < FEAT_DIM; j++) {
      maxDiff = Math.max(maxDiff, Math.abs(seq![t][j] - golden.data[t][j]));
    }
  }
  expect(maxDiff).toBeLessThan(1e-5);
}

describe('feature parity (TS clipToSequence vs Python ml/dataset.py)', () => {
  const frames = coffeeCorrect.frames.map((fd) =>
    frameFromDict(fd as Parameters<typeof frameFromDict>[0])
  );
  const seq = clipToSequence(frames);

  it('produces a sequence', () => {
    expect(seq).not.toBeNull();
  });

  it('matches the golden shape', () => {
    expect(seq!.length).toBe(SEQ_LEN);
    expect(seq![0].length).toBe(FEAT_DIM);
    expect(golden.seq_len).toBe(SEQ_LEN);
    expect(golden.feat_dim).toBe(FEAT_DIM);
  });

  it('matches the Python output element-wise', () => {
    expectParity(coffeeCorrect.frames, golden);
  });

  // coffee_correct.json's dominant (higher-motion) hand happens to be raw-labeled "Right" —
  // so this fixture alone can't distinguish "slot by role" from "slot by raw handedness";
  // both would coincidentally agree. This probe's dominant hand is raw-labeled "Left"
  // specifically to catch that class of bug — it previously slipped through undetected when
  // ml/dataset.py was fixed to slot by role (2026-07-14) but sequenceFeatures.ts still slotted
  // by raw handedness, silently mismatching every model trained after that fix for any
  // left-handed signer (or any clip where the moving hand happens to be raw-"Left").
  it('matches Python parity even when the dominant hand is raw-labeled "Left"', () => {
    expectParity(leftDominantProbe.frames, leftDominantGolden);
  });
});
