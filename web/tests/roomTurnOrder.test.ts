import { describe, it, expect } from 'vitest';
import { pickNextSigner } from '../src/lib/multiplayerRooms';

/**
 * Room mode hands out turns from an order frozen at match start. Before 2026-08-03 it picked
 * positionally from that frozen list, so a player who left kept being handed turns — and every one
 * of those rounds ran the FULL turn timer against an empty video tile, once per cycle, for the rest
 * of the match. That is the "a dropped player stalls the round" limitation, and it was not a single
 * stall: it recurred.
 */
describe('pickNextSigner', () => {
  const order = ['a', 'b', 'c', 'd'];

  it('cycles through the turn order while everyone is present', () => {
    expect(pickNextSigner(order, [], 1)).toBe('a');
    expect(pickNextSigner(order, [], 2)).toBe('b');
    expect(pickNextSigner(order, [], 4)).toBe('d');
    expect(pickNextSigner(order, [], 5)).toBe('a');
  });

  it('never hands a turn to someone who has left', () => {
    const gone = ['b'];
    const picked = [1, 2, 3, 4, 5, 6, 7, 8].map((r) => pickNextSigner(order, gone, r));
    expect(picked, 'a departed player must never be selected to sign').not.toContain('b');
    expect(new Set(picked), 'the remaining players must still all get turns')
      .toEqual(new Set(['a', 'c', 'd']));
  });

  it('keeps cycling the survivors rather than leaving gaps', () => {
    // The regression this guards: skipping by filtering the RESULT would return null on a departed
    // player's slot, silently costing a round. Filtering the POOL keeps every round productive.
    const gone = ['a', 'c'];
    for (let round = 1; round <= 6; round++) {
      expect(pickNextSigner(order, gone, round)).not.toBeNull();
    }
    expect(pickNextSigner(order, gone, 1)).toBe('b');
    expect(pickNextSigner(order, gone, 2)).toBe('d');
    expect(pickNextSigner(order, gone, 3)).toBe('b');
  });

  it('returns null when fewer than two players remain, so the caller ends the match', () => {
    expect(pickNextSigner(order, ['b', 'c', 'd'], 1), 'one player alone cannot play').toBeNull();
    expect(pickNextSigner(order, ['a', 'b', 'c', 'd'], 1), 'an empty room cannot play').toBeNull();
  });

  it('handles a disconnect list naming players who were never in the order', () => {
    // Presence can report a peer that never made it into the frozen turn order (joined the channel
    // but not the match). It must not shrink the pool or shift whose turn it is.
    expect(pickNextSigner(order, ['zz'], 1)).toBe('a');
    expect(pickNextSigner(order, ['zz'], 2)).toBe('b');
  });
});
