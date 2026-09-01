/**
 * Static-confusor invariant — TS port of Python's tests/test_synthesis.py::test_static_confusor_is_rejected.
 *
 * The rule: a frozen (motionless) copy of any movement-required sign must FAIL verification, and
 * must fail SPECIFICALLY on the 'movement' parameter — no single-frame approval. This is the
 * synthesis-side descendant of the original single-frame COFFEE bug (a stationary hand shaped
 * roughly right must never pass a sign that requires real motion).
 *
 * The Python version synthesizes a frozen clip procedurally (core.synthesis, static=True) — no such
 * synthesis engine exists on the TS side, and this is Python-only infrastructure that was never
 * meant to ship (see AGENTS.md: Python is not what ships, the TS engine is). Ported without one:
 * for every movement-required sign with a real recorded `*_correct.json` fixture (tests/fixtures/,
 * the same corpus test-all-signs.ts already replays), find the exact frame where a real performance
 * of the sign first passes live (sliding RollingBuffer, matching actual gameplay), then build a new
 * buffer that repeats ONLY that one frame — same handshape, same location, zero displacement, zero
 * rotation, zero cycles — spaced at the fixture's own real frame interval so the RollingBuffer's
 * time-window pruning behaves exactly as it does for genuine live frames. Since a real pass just
 * happened a moment before freezing, handshape/location are already known-good, which isolates the
 * assertion to what it's actually testing: movement enforcement, not incidental shape drift.
 *
 * Every movement-required sign in SIGNS is expected to have an entry in CORRECT_FIXTURE_BY_SIGN
 * below — one with no fixture fails loudly (via it.fails) rather than silently skipping, so a new
 * movement sign can't quietly lose this coverage.
 */
import { describe, it, expect } from 'vitest';
import { RollingBuffer, frameFromDict, type Frame } from '../src/engine/landmarks';
import { verify, resultPassed, resultFailingRequired } from '../src/engine/verifier';
import { SIGNS } from '../src/engine/signs/index';
import type { Sign } from '../src/engine/schema';

interface FixturePayload {
  sign_name?: string;
  frames?: unknown[];
}

const fixtureModules = import.meta.glob<{ default: FixturePayload }>('./fixtures/*.json', { eager: true });

// One real correct-performance fixture per movement-required sign this repo has recorded. Every
// movement-required sign in SIGNS should have an entry here (enforced below) — add the fixture
// filename when a new movement sign's calibration recording lands.
const CORRECT_FIXTURE_BY_SIGN: Record<string, string> = {
  BREATHE: 'breathe_correct.json',
  COFFEE: 'coffee_correct.json',
  DIZZY: 'dizzy_correct.json',
  DOCTOR: 'doctor_correct.json',
  EMERGENCY: 'emergency_correct.json',
  FEVER: 'fever_correct.json',
  FRIEND: 'friend_correct.json',
  HELP: 'help_correct.json',
  HOSPITAL: 'hospital_correct.json',
  MEDICINE: 'medicine_correct.json',
  MORE: 'more_correct.json',
  NAME: 'name_correct.json',
  NURSE: 'nurse_correct.json',
  PAIN: 'pain_correct.json',
  PLEASE: 'please_correct.json',
  READ: 'read_correct.json',
  SICK: 'sick_correct.json',
  TEACHER: 'teacher_correct.json',
  THANK_YOU: 'thankyou_correct.json',
  WATER: 'water_correct.json',
  WRITE: 'write_correct.json',
  YOU: 'you_correct.json',
};

function loadFixture(filename: string): FixturePayload {
  const mod = fixtureModules[`./fixtures/${filename}`];
  if (!mod) throw new Error(`fixture not found: ${filename}`);
  return mod.default;
}

/** Replays a real performance live (sliding buffer, matches actual gameplay) and returns the exact
 *  frame at the moment it first clears the verifier — the same "first pass wins" semantics as
 *  test-all-signs.ts's bestOverClip, but returning the frame itself rather than the VerifyResult. */
function findFirstPassingFrame(fixture: FixturePayload, sign: Sign): Frame | null {
  const buf = new RollingBuffer(2.0);
  for (const fd of fixture.frames ?? []) {
    const frame = frameFromDict(fd as Parameters<typeof frameFromDict>[0]);
    buf.add(frame);
    if (resultPassed(verify(buf, sign))) return frame;
  }
  return null;
}

/** A frozen 2-second buffer: the same real frame's hand pose repeated at the fixture's own frame
 *  interval — genuinely zero displacement/rotation/cycles, not an artifact of coarse sampling. */
function freeze(frame: Frame, windowS = 2.0, intervalS = 1 / 28): RollingBuffer {
  const buf = new RollingBuffer(windowS);
  const count = Math.ceil(windowS / intervalS) + 1;
  for (let i = 0; i < count; i++) {
    buf.add({ ...frame, t: frame.t + i * intervalS });
  }
  return buf;
}

const movementSigns = Object.entries(SIGNS).filter(([, sign]) => sign.movement.required);

// HELP: same documented rule-based-v1 ceiling as test-all-signs.ts's KNOWN_ACCEPTED_GAPS and
// rapid-confusor.test.ts's KNOWN_UNRELIABLE_CORRECT — help_correct.json's nondominant hand drops
// out of frame in the final ~0.5s (a real characteristic of that recording), so no frame in it ever
// clears every required param at once and this invariant has nothing to freeze. See commits
// 3f25711 and 9e9a139.
const KNOWN_NEVER_PASSES_LIVE = new Set(['HELP']);

describe('static confusor is rejected (frozen copy of a movement sign must fail on movement)', () => {
  for (const [name, sign] of movementSigns) {
    const fixtureFile = CORRECT_FIXTURE_BY_SIGN[name];

    if (!fixtureFile) {
      it.fails(`${name} — no real correct-performance fixture registered for this movement sign`, () => {
        expect(fixtureFile).toBeDefined();
      });
      continue;
    }

    if (KNOWN_NEVER_PASSES_LIVE.has(name)) {
      it.todo(`${name} — known rule-based-v1 ceiling, its correct.json never reaches a live pass to freeze (commits 3f25711, 9e9a139)`);
      continue;
    }

    it(name, () => {
      const fixture = loadFixture(fixtureFile);
      const passingFrame = findFirstPassingFrame(fixture, sign);
      expect(passingFrame, `${name}'s own correct.json fixture never passed live — can't freeze a passing moment`).not.toBeNull();

      const frozenResult = verify(freeze(passingFrame!), sign);
      expect(resultPassed(frozenResult), `${name} frozen confusor leaked through (movement not enforced!)`).toBe(false);
      expect(
        resultFailingRequired(frozenResult),
        `${name} frozen confusor should fail specifically on movement: ${resultFailingRequired(frozenResult).join(', ')}`
      ).toContain('movement');
    });
  }
});
