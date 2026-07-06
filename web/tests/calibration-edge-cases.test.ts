import { describe, it, expect } from 'vitest';
import { RollingBuffer, frameFromDict } from '../src/engine/landmarks';
import { verify, resultPassed, resultFailingRequired } from '../src/engine/verifier';
import { TEACHER, WRITE, READ, NAME, FRIEND, MORE, LETTER_I, LETTER_W } from '../src/engine/signs/index';
import type { Sign } from '../src/engine/schema';

import teacherIdle from './fixtures/teacher_idle.json';
import teacherWrongShape from './fixtures/teacher_wrong_shape.json';
import teacherWrongLocation from './fixtures/teacher_wrong_location.json';
import teacherOneHand from './fixtures/teacher_one_hand.json';
import writeIdle from './fixtures/write_idle.json';
import writeWrongShape from './fixtures/write_wrong_shape.json';
import writeOneHand from './fixtures/write_one_hand.json';
import readIdle from './fixtures/read_idle.json';
import readWrongDirection from './fixtures/read_wrong_direction.json';
import readWrongShape from './fixtures/read_wrong_shape.json';
import readOneHand from './fixtures/read_one_hand.json';
import nameIdle from './fixtures/name_idle.json';
import nameWrongShape from './fixtures/name_wrong_shape.json';
import nameOneHand from './fixtures/name_one_hand.json';
import nameTooFar from './fixtures/name_too_far.json';
import friendIdle from './fixtures/friend_idle.json';
import friendWrongShape from './fixtures/friend_wrong_shape.json';
import friendOneHand from './fixtures/friend_one_hand.json';
import friendTooFar from './fixtures/friend_too_far.json';
import moreIdle from './fixtures/more_idle.json';
import moreWrongShape from './fixtures/more_wrong_shape.json';
import moreOneHand from './fixtures/more_one_hand.json';
import letterICorrect from './fixtures/letter_i_correct.json';
import letterIConfusorY from './fixtures/letter_i_confusor_y.json';
import letterIConfusorFist from './fixtures/letter_i_confusor_fist.json';
import letterIConfusorPoint from './fixtures/letter_i_confusor_point.json';
import letterWCorrect from './fixtures/letter_w_correct.json';
import letterWConfusorV from './fixtures/letter_w_confusor_v.json';
import letterWConfusorOpen from './fixtures/letter_w_confusor_open.json';
import letterWConfusorFist from './fixtures/letter_w_confusor_fist.json';

function loadBuffer(fixture: { frames: unknown[] }, windowS = 5.0): RollingBuffer {
  const buf = new RollingBuffer(windowS);
  for (const fd of fixture.frames) {
    buf.add(frameFromDict(fd as Parameters<typeof frameFromDict>[0]));
  }
  return buf;
}

function verifyFixture(fixture: { frames: unknown[] }, sign: Sign) {
  return verify(loadBuffer(fixture), sign);
}

// -------------------------------------------------------------------------------- idle
const IDLE_CASES: [string, unknown, Sign][] = [
  ['teacher', teacherIdle, TEACHER],
  ['write', writeIdle, WRITE],
  ['read', readIdle, READ],
  ['name', nameIdle, NAME],
  ['friend', friendIdle, FRIEND],
  ['more', moreIdle, MORE],
];

describe('idle (present, not signing) must fail on movement', () => {
  for (const [label, fixture, sign] of IDLE_CASES) {
    it(`${label} idle/jitter should not pass`, () => {
      const result = verifyFixture(fixture as { frames: unknown[] }, sign);
      expect(resultPassed(result)).toBe(false);
      expect(resultFailingRequired(result)).toContain('movement');
    });
  }
});

// -------------------------------------------------------------------------------- wrong handshape
const WRONG_SHAPE_CASES: [string, unknown, Sign][] = [
  ['teacher', teacherWrongShape, TEACHER],
  ['write', writeWrongShape, WRITE],
  ['read', readWrongShape, READ],
  ['name', nameWrongShape, NAME],
  ['friend', friendWrongShape, FRIEND],
  ['more', moreWrongShape, MORE],
];

describe('correct movement/location with the wrong handshape must fail', () => {
  for (const [label, fixture, sign] of WRONG_SHAPE_CASES) {
    it(`${label} wrong-shape should not pass`, () => {
      const result = verifyFixture(fixture as { frames: unknown[] }, sign);
      expect(resultPassed(result)).toBe(false);
      expect(resultFailingRequired(result)).toContain('handshape_dominant');
    });
  }
});

// -------------------------------------------------------------------------------- one hand missing
const ONE_HAND_CASES: [string, unknown, Sign][] = [
  ['teacher', teacherOneHand, TEACHER],
  ['write', writeOneHand, WRITE],
  ['read', readOneHand, READ],
  ['name', nameOneHand, NAME],
  ['friend', friendOneHand, FRIEND],
  ['more', moreOneHand, MORE],
];

describe('two-handed sign with the nondominant hand never present must fail', () => {
  for (const [label, fixture, sign] of ONE_HAND_CASES) {
    it(`${label} with only one hand should not pass`, () => {
      const result = verifyFixture(fixture as { frames: unknown[] }, sign);
      expect(resultPassed(result)).toBe(false);
      expect(resultFailingRequired(result)).toContain('handshape_nondominant');
    });
  }
});

// -------------------------------------------------------------------------------- sign-specific

describe('sign-specific edge cases', () => {
  it('TEACHER at the chest instead of the forehead should fail on location', () => {
    const result = verifyFixture(teacherWrongLocation, TEACHER);
    expect(resultPassed(result)).toBe(false);
    expect(resultFailingRequired(result)).toContain('location');
  });

  it('READ swept upward instead of downward should fail on movement', () => {
    const result = verifyFixture(readWrongDirection, READ);
    expect(resultPassed(result)).toBe(false);
    expect(resultFailingRequired(result)).toContain('movement');
  });

  it('NAME with hands that never come close should fail on location', () => {
    const result = verifyFixture(nameTooFar, NAME);
    expect(resultPassed(result)).toBe(false);
    expect(resultFailingRequired(result)).toContain('location');
  });

  it('FRIEND with hands that never come close should fail on location', () => {
    const result = verifyFixture(friendTooFar, FRIEND);
    expect(resultPassed(result)).toBe(false);
    expect(resultFailingRequired(result)).toContain('location');
  });
});

// -------------------------------------------------------------------------------- LETTER_I / LETTER_W

describe('LETTER_I: static handshape confusion is the entire risk surface', () => {
  it('correct fixture passes', () => {
    const result = verifyFixture(letterICorrect, LETTER_I);
    expect(resultPassed(result)).toBe(true);
  });

  it('a real Y-hand (thumb extended) must not pass as I', () => {
    const result = verifyFixture(letterIConfusorY, LETTER_I);
    expect(resultPassed(result)).toBe(false);
    expect(resultFailingRequired(result)).toContain('handshape_dominant');
  });

  it('a fist must not pass as I', () => {
    const result = verifyFixture(letterIConfusorFist, LETTER_I);
    expect(resultPassed(result)).toBe(false);
    expect(resultFailingRequired(result)).toContain('handshape_dominant');
  });

  it('a pointing index finger must not pass as I', () => {
    const result = verifyFixture(letterIConfusorPoint, LETTER_I);
    expect(resultPassed(result)).toBe(false);
    expect(resultFailingRequired(result)).toContain('handshape_dominant');
  });
});

describe('LETTER_W: rejects neighboring finger-count shapes', () => {
  it('correct fixture passes', () => {
    const result = verifyFixture(letterWCorrect, LETTER_W);
    expect(resultPassed(result)).toBe(true);
  });

  for (const [label, fixture] of [
    ['V-hand (2 fingers)', letterWConfusorV],
    ['open hand (5 fingers)', letterWConfusorOpen],
    ['fist (0 fingers)', letterWConfusorFist],
  ] as [string, unknown][]) {
    it(`${label} must not pass as W`, () => {
      const result = verifyFixture(fixture as { frames: unknown[] }, LETTER_W);
      expect(resultPassed(result)).toBe(false);
      expect(resultFailingRequired(result)).toContain('handshape_dominant');
    });
  }
});
