import { describe, it, expect } from 'vitest';
import { RollingBuffer, frameFromDict } from '../src/engine/landmarks';
import { verify, resultPassed, resultGet, paramCleared } from '../src/engine/verifier';
import { SIGNS } from '../src/engine/signs/index';
import type { Sign } from '../src/engine/schema';

import coffeeCorrect from './fixtures/coffee_correct.json';
import coffeeConfusor from './fixtures/coffee_confusor.json';
import helpCorrect from './fixtures/help_correct.json';
import helpConfusor from './fixtures/help_confusor.json';
import painCorrect from './fixtures/pain_correct.json';
import painConfusor from './fixtures/pain_confusor.json';
import medicineCorrect from './fixtures/medicine_correct.json';
import medicineConfusor from './fixtures/medicine_confusor.json';
import emergencyCorrect from './fixtures/emergency_correct.json';
import emergencyConfusor from './fixtures/emergency_confusor.json';
import doctorCorrect from './fixtures/doctor_correct.json';
import doctorConfusor from './fixtures/doctor_confusor.json';
import nurseCorrect from './fixtures/nurse_correct.json';
import nurseConfusor from './fixtures/nurse_confusor.json';
import sickCorrect from './fixtures/sick_correct.json';
import feverCorrect from './fixtures/fever_correct.json';
import feverConfusor from './fixtures/fever_confusor.json';
import waterCorrect from './fixtures/water_correct.json';
import waterConfusor from './fixtures/water_confusor.json';
import breatheCorrect from './fixtures/breathe_correct.json';
import breatheConfusor from './fixtures/breathe_confusor.json';
import hospitalCorrect from './fixtures/hospital_correct.json';
import hospitalConfusor from './fixtures/hospital_confusor.json';
import dizzyCorrect from './fixtures/dizzy_correct.json';
import dizzyConfusor from './fixtures/dizzy_confusor.json';
import teacherCorrect from './fixtures/teacher_correct.json';
import teacherConfusor from './fixtures/teacher_confusor.json';
import writeCorrect from './fixtures/write_correct.json';
import writeConfusor from './fixtures/write_confusor.json';
import readCorrect from './fixtures/read_correct.json';
import readConfusor from './fixtures/read_confusor.json';
import nameCorrect from './fixtures/name_correct.json';
import nameConfusor from './fixtures/name_confusor.json';
import friendCorrect from './fixtures/friend_correct.json';
import friendConfusor from './fixtures/friend_confusor.json';

function loadBuffer(fixture: { frames: unknown[] }, windowS = 2.0): RollingBuffer {
  const buf = new RollingBuffer(windowS);
  for (const fd of fixture.frames) {
    buf.add(frameFromDict(fd as Parameters<typeof frameFromDict>[0]));
  }
  return buf;
}

// Live gameplay recognises a sign the moment a SLIDING rolling buffer yields a pass on any
// frame, not from one fixed window anchored at a recorded clip's last frame (loadBuffer above).
// A real take often has a second or two of "settling" after the actual sign motion before the
// clip ends, which a last-frame-only check can misread as a failure even though the sign was
// clearly recognised mid-clip. Used for the "must pass" checks below — see the identical helper
// + comment in the Python engine's tests/test_hospital.py.
function bestOverClip(fixture: { frames: unknown[] }, sign: Sign, windowS = 2.0) {
  const buf = new RollingBuffer(windowS);
  let best: ReturnType<typeof verify> | null = null;
  for (const fd of fixture.frames) {
    buf.add(frameFromDict(fd as Parameters<typeof frameFromDict>[0]));
    const result = verify(buf, sign);
    const m = resultGet(result, 'movement');
    const bestM = best ? resultGet(best, 'movement') : null;
    if (!best || (m && (!bestM || m.score > bestM.score))) {
      best = result;
    }
    if (resultPassed(result)) return result;
  }
  return best!;
}

interface SignTest {
  name: string;
  correct: { frames: unknown[] };
  confusor?: { frames: unknown[] };
}

const SIGN_TESTS: SignTest[] = [
  { name: 'COFFEE', correct: coffeeCorrect, confusor: coffeeConfusor },
  { name: 'HELP', correct: helpCorrect, confusor: helpConfusor },
  { name: 'PAIN', correct: painCorrect, confusor: painConfusor },
  { name: 'MEDICINE', correct: medicineCorrect, confusor: medicineConfusor },
  { name: 'EMERGENCY', correct: emergencyCorrect, confusor: emergencyConfusor },
  { name: 'DOCTOR', correct: doctorCorrect, confusor: doctorConfusor },
  { name: 'NURSE', correct: nurseCorrect, confusor: nurseConfusor },
  { name: 'SICK', correct: sickCorrect },
  { name: 'FEVER', correct: feverCorrect, confusor: feverConfusor },
  { name: 'WATER', correct: waterCorrect },
  { name: 'BREATHE', correct: breatheCorrect, confusor: breatheConfusor },
  { name: 'HOSPITAL', correct: hospitalCorrect, confusor: hospitalConfusor },
  { name: 'DIZZY', correct: dizzyCorrect, confusor: dizzyConfusor },
  { name: 'TEACHER', correct: teacherCorrect, confusor: teacherConfusor },
  { name: 'WRITE', correct: writeCorrect, confusor: writeConfusor },
  { name: 'READ', correct: readCorrect, confusor: readConfusor },
  { name: 'NAME', correct: nameCorrect, confusor: nameConfusor },
  { name: 'FRIEND', correct: friendCorrect, confusor: friendConfusor },
];

for (const st of SIGN_TESTS) {
  const sign = SIGNS[st.name];

  describe(`${st.name} correct`, () => {
    const result = bestOverClip(st.correct, sign);

    it('passes overall', () => {
      expect(resultPassed(result)).toBe(true);
    });

    if (sign.movement.required) {
      it('movement clears threshold', () => {
        const m = resultGet(result, 'movement')!;
        expect(m).toBeDefined();
        expect(paramCleared(m)).toBe(true);
      });
    }

    it('dominant handshape clears', () => {
      const dom = resultGet(result, 'handshape_dominant')!;
      expect(dom).toBeDefined();
      expect(paramCleared(dom)).toBe(true);
    });
  });

  if (st.confusor) {
    describe(`${st.name} confusor (motionless)`, () => {
      const buffer = loadBuffer(st.confusor!);
      const result = verify(buffer, sign);

      it('fails overall', () => {
        expect(resultPassed(result)).toBe(false);
      });

      if (sign.movement.required) {
        it('fails on movement specifically', () => {
          const m = resultGet(result, 'movement')!;
          expect(m).toBeDefined();
          expect(paramCleared(m)).toBe(false);
        });
      }
    });
  }
}
