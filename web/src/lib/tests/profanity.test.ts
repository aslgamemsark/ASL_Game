import { describe, it, expect } from 'vitest';
import { isInappropriate } from '@/lib/profanity';

describe('isInappropriate', () => {
  it('blocks the underscore-separator bypass found live on the leaderboard', () => {
    expect(isInappropriate('n_i_g_g_a')).toBe(true);
    expect(isInappropriate('N_I_G_G_A')).toBe(true);
  });

  it('blocks stretched-letter spellings', () => {
    expect(isInappropriate('niggga')).toBe(true);
    expect(isInappropriate('fuuuck')).toBe(true);
  });

  it('blocks separators combined with leet substitution', () => {
    expect(isInappropriate('n_1_g_g_4')).toBe(true);
  });

  it('still blocks the plain and leet forms it always caught', () => {
    expect(isInappropriate('nigger')).toBe(true);
    expect(isInappropriate('fuck')).toBe(true);
    expect(isInappropriate('sh1t')).toBe(true);
  });

  it('allows ordinary usernames', () => {
    expect(isInappropriate('ARKhan7')).toBe(false);
    expect(isInappropriate('cool_kid_99')).toBe(false);
    expect(isInappropriate('player_one')).toBe(false);
    expect(isInappropriate('committee')).toBe(false);
  });

  it('does not false-positive on names/words that collapse to a short common substring', () => {
    // A naive "collapse any doubled letter" pass turns "coon" (2 o's) into "con", which then
    // substring-matches all of these — a real bug found while merging this filter, not
    // hypothetical: verify it stays fixed.
    expect(isInappropriate('connor')).toBe(false);
    expect(isInappropriate('control')).toBe(false);
    expect(isInappropriate('iconic')).toBe(false);
    expect(isInappropriate('economics')).toBe(false);
  });
});
