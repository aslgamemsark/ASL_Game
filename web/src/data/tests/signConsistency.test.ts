import { describe, expect, it } from 'vitest';
import { SIGNS } from '@/data/signs';
import { SIGNS as ENGINE_SIGNS } from '@/engine/signs/index';

const KNOWN_ENGINE_ONLY = ['RED', 'YELLOW', 'WIN', 'TEAM'] as const;

describe('sign registry consistency', () => {
  it('keeps display requirements aligned with recognition', () => {
    const drift: string[] = [];
    for (const [id, sign] of Object.entries(SIGNS)) {
      const engine = ENGINE_SIGNS[id];
      if (!engine) {
        drift.push(`${id} has no engine definition`);
        continue;
      }
      for (const field of ['dominant', 'location', 'movement'] as const) {
        if (sign[field].required !== engine[field].required) drift.push(`${id}.${field}.required`);
      }
    }
    expect(drift).toEqual([]);
    expect(Object.keys(ENGINE_SIGNS).filter((id) => !SIGNS[id]).sort()).toEqual([...KNOWN_ENGINE_ONLY].sort());
  });
});
