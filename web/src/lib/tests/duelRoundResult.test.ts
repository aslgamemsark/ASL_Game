import { afterEach, describe, expect, it, vi } from 'vitest';
import { acceptDuelResult, replayDuelResult, requestDuelResultWithRetry } from '../duelRoundResult';

describe('canonical duel result', () => {
  afterEach(() => vi.useRealTimers());

  it('recovers a dropped previous-round result without applying it twice', () => {
    const saved = { round: 1, signerScored: true, guesserScored: false };
    // Signer already advanced; replay is keyed by the requested round, not its current round.
    const replay = replayDuelResult(saved, 1, 'guesser', 'guesser')!;
    expect(acceptDuelResult({ ...replay }, 'signer', 'signer', 1, 0)).toEqual(saved);
    expect(acceptDuelResult({ ...replay }, 'signer', 'signer', 1, 1)).toBeNull();
    expect(replayDuelResult(saved, 2, 'guesser', 'guesser')).toBeNull();
    expect(replayDuelResult(saved, 1, 'stranger', 'guesser')).toBeNull();
    expect(replayDuelResult(null, 1, 'guesser', 'guesser')).toBeNull();
  });

  it('retries lost requests, stops on recovery, and surfaces failure after five attempts', () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const failed = vi.fn();
    const cancel = requestDuelResultWithRetry(request, failed);
    vi.advanceTimersByTime(1200);
    expect(request).toHaveBeenCalledTimes(2);
    cancel();
    vi.advanceTimersByTime(10000);
    expect(request).toHaveBeenCalledTimes(2);
    expect(failed).not.toHaveBeenCalled();
    request.mockClear();
    requestDuelResultWithRetry(request, failed);
    vi.advanceTimersByTime(20000);
    expect(request).toHaveBeenCalledTimes(5);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps both clients in agreement when recognition and a guess race', () => {
    const signed = { round: 1, signerScored: true, guesserScored: false };
    const guess = { round: 1, signerScored: false, guesserScored: true };
    for (const [first, late] of [[signed, guess], [guess, signed]]) {
      const signer = acceptDuelResult(first, 'signer', 'signer', 1, 0)!;
      const guesser = acceptDuelResult(first, 'signer', 'signer', 1, 0)!;
      expect(guesser).toEqual(signer);
      expect(acceptDuelResult(late, 'signer', 'signer', 1, signer.round)).toBeNull();
      expect(acceptDuelResult(late, 'signer', 'signer', 1, guesser.round)).toBeNull();
    }
  });

  it('rejects wrong senders, stale/future rounds and malformed score payloads', () => {
    const result = { round: 2, signerScored: false, guesserScored: false };
    expect(acceptDuelResult(result, 'guesser', 'signer', 2, 1)).toBeNull();
    expect(acceptDuelResult(result, 'stranger', 'signer', 2, 1)).toBeNull();
    expect(acceptDuelResult({ ...result, round: 1 }, 'signer', 'signer', 2, 1)).toBeNull();
    expect(acceptDuelResult({ ...result, round: 3 }, 'signer', 'signer', 2, 1)).toBeNull();
    expect(acceptDuelResult({ ...result, signerScored: 1 }, 'signer', 'signer', 2, 1)).toBeNull();
    expect(acceptDuelResult(result, 'signer', 'signer', 2, 1)).toEqual(result);
  });
});
