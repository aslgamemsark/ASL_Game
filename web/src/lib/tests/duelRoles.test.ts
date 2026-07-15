import { describe, it, expect } from 'vitest';
import { isSignerForRound } from '../duelRoles';

describe('isSignerForRound', () => {
  const a = 'aaaa'; // smaller id
  const b = 'zzzz'; // larger id

  it('assigns exactly one signer per round (complementary roles) — the bug this replaces', () => {
    // The original bug: both clients computed the same boolean, so both signed at once. For any
    // round, the two players must get opposite results regardless of who is host/joiner.
    for (let round = 1; round <= 6; round++) {
      expect(isSignerForRound(a, b, round)).toBe(!isSignerForRound(b, a, round));
    }
  });

  it('the smaller id signs on odd rounds', () => {
    expect(isSignerForRound(a, b, 1)).toBe(true);
    expect(isSignerForRound(b, a, 1)).toBe(false);
    expect(isSignerForRound(a, b, 3)).toBe(true);
    expect(isSignerForRound(a, b, 5)).toBe(true);
  });

  it('the larger id signs on even rounds (roles alternate)', () => {
    expect(isSignerForRound(b, a, 2)).toBe(true);
    expect(isSignerForRound(a, b, 2)).toBe(false);
    expect(isSignerForRound(b, a, 4)).toBe(true);
  });

  it('works the same regardless of which side is passed as "me" (host or joiner)', () => {
    // Host perspective (me=a, opponent=b) and joiner perspective (me=b, opponent=a) must agree on
    // who signs — this is exactly the host/joiner mismatch that caused the original bug.
    for (let round = 1; round <= 6; round++) {
      const aSignsFromAsView = isSignerForRound(a, b, round);
      const aSignsFromBsView = !isSignerForRound(b, a, round);
      expect(aSignsFromAsView).toBe(aSignsFromBsView);
    }
  });
});
