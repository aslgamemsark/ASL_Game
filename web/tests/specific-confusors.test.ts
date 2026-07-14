/**
 * Regression tests for specific confusors found via live user testing on 2026-07-14. TS mirror
 * of tests/test_specific_confusors.py in the Python engine — same fixtures, same methodology.
 * See that file's docstring for the full root-cause writeups (NURSE two-finger parity fix,
 * shared with HOSPITAL; DOCTOR clap and MEDICINE wrong-hand remain documented open gaps).
 */
import { describe, it, expect } from 'vitest';
import { RollingBuffer, frameFromDict, type Frame } from '../src/engine/landmarks';
import { verify, resultPassed } from '../src/engine/verifier';
import { NURSE, HOSPITAL, DOCTOR, MEDICINE } from '../src/engine/signs/index';
import type { Sign } from '../src/engine/schema';

import nurseCorrect from './fixtures/nurse_correct.json';
import nurseMiddleOnly from './fixtures/nurse_middle_only.json';
import nurseClap from './fixtures/nurse_clap.json';
import hospitalCorrect from './fixtures/hospital_correct.json';
import doctorClap from './fixtures/doctor_clap.json';
import medicineWrongHand from './fixtures/medicine_wrong_hand.json';

const CONSECUTIVE_REQUIRED = 6;
const LIVE_WINDOW_S = 2.0;

function bestConsecutivePassStreak(fixture: { frames: unknown[] }, sign: Sign): number {
  const buf = new RollingBuffer(LIVE_WINDOW_S);
  let streak = 0;
  let best = 0;
  for (const fd of fixture.frames) {
    const frame: Frame = frameFromDict(fd as Parameters<typeof frameFromDict>[0]);
    buf.add(frame);
    if (resultPassed(verify(buf, sign))) {
      streak += 1;
      best = Math.max(best, streak);
    } else {
      streak = 0;
    }
  }
  return best;
}

describe('NURSE two-finger parity fix', () => {
  it('correct still triggers', () => {
    expect(bestConsecutivePassStreak(nurseCorrect, NURSE)).toBeGreaterThanOrEqual(CONSECUTIVE_REQUIRED);
  });
  it('rejects a plain middle-finger tap', () => {
    expect(bestConsecutivePassStreak(nurseMiddleOnly, NURSE)).toBeLessThan(CONSECUTIVE_REQUIRED);
  });
  it('rejects clapping', () => {
    expect(bestConsecutivePassStreak(nurseClap, NURSE)).toBeLessThan(CONSECUTIVE_REQUIRED);
  });
});

describe('HOSPITAL shares the two-finger parity fix', () => {
  it('correct still triggers', () => {
    expect(bestConsecutivePassStreak(hospitalCorrect, HOSPITAL)).toBeGreaterThanOrEqual(CONSECUTIVE_REQUIRED);
  });
});

describe('documented open gaps (expected to still fail today)', () => {
  it('DOCTOR still accepts clapping (known gap — see signs/doctor.py)', () => {
    expect(bestConsecutivePassStreak(doctorClap, DOCTOR)).toBeGreaterThanOrEqual(CONSECUTIVE_REQUIRED);
  });
  it('MEDICINE still accepts the wrong hand moving (known gap — see signs/medicine.py)', () => {
    expect(bestConsecutivePassStreak(medicineWrongHand, MEDICINE)).toBeGreaterThanOrEqual(CONSECUTIVE_REQUIRED);
  });
});
