import { describe, it, expect } from 'vitest';
import { RollingBuffer, frameFromDict } from '../src/engine/landmarks';
import { verify, resultPassed, resultFailingRequired } from '../src/engine/verifier';
import { LETTER_A, LETTER_C, LETTER_E, LETTER_M, LETTER_S, LETTER_X } from '../src/engine/signs/index';
import type { Sign } from '../src/engine/schema';

import letterACorrect from './fixtures/letter_a_correct.json';
import letterCCorrect from './fixtures/letter_c_correct.json';
import letterECorrect from './fixtures/letter_e_correct.json';
import letterMCorrect from './fixtures/letter_m_correct.json';
import letterSCorrect from './fixtures/letter_s_correct.json';
import letterXCorrect from './fixtures/letter_x_correct.json';

// Regression tests for LETTER_A/C/E/M/S/X, calibrated against real recordings (2026-07).
// Handshapes A, C, M, and X previously used guessed thresholds that never matched a real hand
// (measured confidence 0.00-0.15 against a genuine performance) — see handshape.ts for the
// recalibrated per-letter geometry. These fixtures are the actual recordings that exposed the
// bug; keeping them as a regression test means a future threshold tweak can't silently
// reintroduce it.

function loadBuffer(fixture: { frames: unknown[] }, windowS = 5.0): RollingBuffer {
  const buf = new RollingBuffer(windowS);
  for (const fd of fixture.frames) {
    buf.add(frameFromDict(fd as Parameters<typeof frameFromDict>[0]));
  }
  return buf;
}

const CASES: [string, Sign, { frames: unknown[] }][] = [
  ['LETTER_A', LETTER_A, letterACorrect],
  ['LETTER_C', LETTER_C, letterCCorrect],
  ['LETTER_E', LETTER_E, letterECorrect],
  ['LETTER_M', LETTER_M, letterMCorrect],
  ['LETTER_S', LETTER_S, letterSCorrect],
  ['LETTER_X', LETTER_X, letterXCorrect],
];

describe('recalibrated fingerspelling letters (real recordings)', () => {
  for (const [name, sign, fixture] of CASES) {
    it(`${name} real recording passes`, () => {
      const result = verify(loadBuffer(fixture), sign);
      expect(resultPassed(result), `${name} failing=${JSON.stringify(resultFailingRequired(result))}`).toBe(true);
    });
  }
});
