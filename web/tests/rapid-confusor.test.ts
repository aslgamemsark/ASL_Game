/**
 * Regression tests for the "rapid/random hand movement" confusor class — recorded 2026-07-14
 * after a report that several hospital/classroom/coffee signs could be triggered by doing
 * nothing or by moving the hands fast and randomly near the right spot. TS mirror of
 * tests/test_rapid_confusor.py in the Python engine — same fixtures, same methodology, kept in
 * sync per this project's engine-parity requirement.
 *
 * Simulates the ACTUAL live gameplay debounce: verify() runs every frame against a sliding
 * RollingBuffer(2.0) (matches useRecognition.ts's window, used for every sign) and success is
 * judged the same way useRecognition.ts judges it — PASS_THRESHOLD=6 CONSECUTIVE passing frames,
 * reset on any failure.
 *
 * Fully fixed via schema thresholds: NURSE, WRITE, LETTER_P (hard assertions). MORE was separately
 * fixed via a handshape ceiling (flatOConfidence had no upper bound, so a fist scored identical to
 * a real flattened-O — see handshape.ts) as a side effect of a live-testing bug report; that also
 * closed this confusor. DOCTOR, MEDICINE, HOSPITAL, HELP, BREATHE remain a documented rule-based-v1
 * ceiling for this confusor (rapid movement's raw displacement/amplitude/cycle-count measured AS
 * BIG OR BIGGER than the real sign's own) — see each sign's movement req comment in signs/*.py for
 * the investigation. Marked as expected failures here so an improvement shows up as a loud "this
 * expectFail no longer fails" rather than silently regressing further; the web app's trained
 * classifier gate (knownSigns includes all five) is the real backstop for those until this check
 * has more than position/cycle-count to work with.
 */
import { describe, it, expect } from 'vitest';
import { RollingBuffer, frameFromDict, type Frame } from '../src/engine/landmarks';
import { verify, resultPassed } from '../src/engine/verifier';
import { DOCTOR, NURSE, MEDICINE, HOSPITAL, HELP, BREATHE, MORE, WRITE, LETTER_P } from '../src/engine/signs/index';
import type { Sign } from '../src/engine/schema';

import doctorCorrect from './fixtures/doctor_correct.json';
import doctorIdle from './fixtures/doctor_idle.json';
import doctorRapid from './fixtures/doctor_rapid.json';
import nurseCorrect from './fixtures/nurse_correct.json';
import nurseIdle from './fixtures/nurse_idle.json';
import nurseRapid from './fixtures/nurse_rapid.json';
import medicineCorrect from './fixtures/medicine_correct.json';
import medicineIdle from './fixtures/medicine_idle.json';
import medicineRapid from './fixtures/medicine_rapid.json';
import hospitalCorrect from './fixtures/hospital_correct.json';
import hospitalIdle from './fixtures/hospital_idle.json';
import hospitalRapid from './fixtures/hospital_rapid.json';
import helpCorrect from './fixtures/help_correct.json';
import helpIdle from './fixtures/help_idle.json';
import helpRapid from './fixtures/help_rapid.json';
import breatheCorrect from './fixtures/breathe_correct.json';
import breatheIdle from './fixtures/breathe_idle.json';
import breatheRapid from './fixtures/breathe_rapid.json';
import moreCorrect from './fixtures/more_correct.json';
import moreIdleFixture from './fixtures/more_idle.json';
import moreRapid from './fixtures/more_rapid.json';
import writeCorrect from './fixtures/write_correct.json';
import writeIdleFixture from './fixtures/write_idle.json';
import writeRapid from './fixtures/write_rapid.json';
import letterPCorrect from './fixtures/letter_p_correct.json';
import letterPIdle from './fixtures/letter_p_idle.json';
import letterPRapid from './fixtures/letter_p_rapid.json';

const CONSECUTIVE_REQUIRED = 6; // matches useRecognition.ts's PASS_THRESHOLD
const LIVE_WINDOW_S = 2.0;      // matches useRecognition.ts's RollingBuffer(2.0)

type Fixture = { frames: unknown[] };

const CASES: [string, Sign, Fixture, Fixture, Fixture, boolean][] = [
  // name, sign, correct, idle, rapid, fixedForRapid
  ['DOCTOR', DOCTOR, doctorCorrect, doctorIdle, doctorRapid, false],
  ['NURSE', NURSE, nurseCorrect, nurseIdle, nurseRapid, true],
  ['MEDICINE', MEDICINE, medicineCorrect, medicineIdle, medicineRapid, false],
  ['HOSPITAL', HOSPITAL, hospitalCorrect, hospitalIdle, hospitalRapid, false],
  ['HELP', HELP, helpCorrect, helpIdle, helpRapid, false],
  ['BREATHE', BREATHE, breatheCorrect, breatheIdle, breatheRapid, false],
  ['MORE', MORE, moreCorrect, moreIdleFixture, moreRapid, true],
  ['WRITE', WRITE, writeCorrect, writeIdleFixture, writeRapid, true],
  ['LETTER_P', LETTER_P, letterPCorrect, letterPIdle, letterPRapid, true],
];

function bestConsecutivePassStreak(fixture: Fixture, sign: Sign): number {
  const buf = new RollingBuffer(LIVE_WINDOW_S);
  let streak = 0;
  let best = 0;
  for (const fd of fixture.frames) {
    const frame: Frame = frameFromDict(fd as Parameters<typeof frameFromDict>[0]);
    buf.add(frame);
    const result = verify(buf, sign);
    if (resultPassed(result)) {
      streak += 1;
      best = Math.max(best, streak);
    } else {
      streak = 0;
    }
  }
  return best;
}

describe('correct performance still triggers live (>= 6 consecutive passing frames)', () => {
  for (const [name, sign, correct] of CASES) {
    it(name, () => {
      expect(bestConsecutivePassStreak(correct, sign)).toBeGreaterThanOrEqual(CONSECUTIVE_REQUIRED);
    });
  }
});

describe('idle (doing nothing) never triggers live', () => {
  for (const [name, sign, , idle] of CASES) {
    it(name, () => {
      expect(bestConsecutivePassStreak(idle, sign)).toBeLessThan(CONSECUTIVE_REQUIRED);
    });
  }
});

describe('rapid/random movement never triggers live', () => {
  for (const [name, sign, , , rapid, fixed] of CASES) {
    const streak = bestConsecutivePassStreak(rapid, sign);
    if (fixed) {
      it(name, () => {
        expect(streak).toBeLessThan(CONSECUTIVE_REQUIRED);
      });
    } else {
      // Documented rule-based-v1 ceiling — see signs/*.py. Asserts the ceiling itself so an
      // unexpected fix shows up as a loud failure here (update `fixed` to true above), rather
      // than silently going unnoticed.
      it(`${name} (known ceiling — remove from ceiling list if this ever fails)`, () => {
        expect(streak).toBeGreaterThanOrEqual(CONSECUTIVE_REQUIRED);
      });
    }
  }
});
