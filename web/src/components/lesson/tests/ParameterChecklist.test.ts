import { describe, it, expect } from 'vitest';
import { hintFor } from '../ParameterChecklist';
import { SIGNS } from '@/engine/signs';
import type { ParamScore } from '@/engine/verifier';

const PARAM_NAMES = ['handshape_dominant', 'handshape_nondominant', 'location', 'movement', 'orientation'] as const;

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
