import { describe, it, expect } from 'vitest';
import { hintFor, coachAnnouncement } from '../ParameterChecklist';
import { SIGNS } from '@/engine/signs';
import type { ParamScore } from '@/engine/verifier';

const PARAM_NAMES = ['handshape_dominant', 'handshape_nondominant', 'location', 'movement', 'orientation', 'nmm'] as const;

function fakeParam(name: string): ParamScore {
  return { name, score: 0, threshold: 0.6, required: true };
}

describe('hintFor', () => {
  it('gives every applicable parameter of every real sign a coaching hint', () => {
    const missing: string[] = [];
    for (const sign of Object.values(SIGNS)) {
      for (const name of PARAM_NAMES) {
        if (name === 'handshape_nondominant' && !sign.nondominant) continue;
        if (name === 'orientation' && !sign.orientation) continue;
        if (name === 'nmm' && !sign.nmm) continue;
        if (!hintFor(fakeParam(name), sign)) missing.push(`${sign.name}.${name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('falls back to a generic movement hint when no sign is known', () => {
    expect(hintFor(fakeParam('movement'))).toBe('Keep moving!');
  });

  it('returns null for an unrecognized parameter name', () => {
    expect(hintFor(fakeParam('mystery'))).toBeNull();
  });
});

/**
 * The Sign Coach's spoken output. Everything the checklist communicates visually — which parameter
 * missed, and how to fix it — is carried by colour and position, so before this there was nothing
 * for a screen reader to read. This is the logic behind the `role="status"` region; the DOM wiring
 * is trivial, the decision of WHAT to say (and when to stay quiet) is not.
 */
describe('coachAnnouncement', () => {
  const sign = SIGNS.HELLO;
  const entry = (name: string, status: 'cleared' | 'confident-fail' | 'neutral') => ({
    param: fakeParam(name),
    status,
  });

  it('says nothing while every parameter is still neutral', () => {
    // 'neutral' is "still working on it". Announcing it would interrupt a screen reader on every
    // frame of a sign attempt with no actionable information.
    expect(coachAnnouncement([entry('movement', 'neutral'), entry('location', 'neutral')], sign)).toBe('');
  });

  it('says nothing when everything has cleared', () => {
    expect(coachAnnouncement([entry('movement', 'cleared'), entry('location', 'cleared')], sign)).toBe('');
  });

  it('speaks the hint for a parameter that has confidently failed', () => {
    expect(coachAnnouncement([entry('location', 'confident-fail')], sign))
      .toBe(hintFor(fakeParam('location'), sign));
  });

  it('speaks one correction at a time, in the sign\'s own parameter order', () => {
    // Read aloud, three simultaneous instructions is noise — and the next one announces itself as
    // soon as the first clears. Order follows the parameter list so it does not jump around as
    // scores wobble frame to frame.
    const said = coachAnnouncement(
      [entry('location', 'confident-fail'), entry('movement', 'confident-fail')],
      sign
    );
    expect(said).toBe(hintFor(fakeParam('location'), sign));
    expect(said).not.toBe(hintFor(fakeParam('movement'), sign));
  });

  it('ignores cleared parameters when picking what to say', () => {
    expect(coachAnnouncement([entry('location', 'cleared'), entry('movement', 'confident-fail')], sign))
      .toBe(hintFor(fakeParam('movement'), sign));
  });

  it('stays silent rather than announcing an empty string for a parameter with no hint', () => {
    // hintFor returns null for an unknown parameter; that must become silence, not a blank
    // announcement that some screen readers still chirp for.
    expect(coachAnnouncement([entry('mystery', 'confident-fail')], sign)).toBe('');
  });
});
