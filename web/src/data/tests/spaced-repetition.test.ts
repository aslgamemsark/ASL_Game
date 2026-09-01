import { describe, expect, it } from 'vitest';
import { getSignsDueForReview } from '../spaced-repetition';

describe('mode-aware review order', () => {
  it('uses legacy aggregate history when mode is omitted', () => {
    const now = Date.now();
    const signs = {
      HELLO: {
        attempts: 2, successes: 1, lastAttempt: 1, nextReviewAt: now - 10, interval: 1, easeFactor: 2.5,
        byMode: { receptive: { attempts: 1, successes: 1, lastAttempt: 1, nextReviewAt: now + 10_000, interval: 1, easeFactor: 2.5 } },
      },
      PLEASE: {
        attempts: 2, successes: 2, lastAttempt: 1, nextReviewAt: now + 10_000, interval: 1, easeFactor: 2.5,
        byMode: { receptive: { attempts: 1, successes: 0, lastAttempt: 1, nextReviewAt: now - 10, interval: 1, easeFactor: 2.5 } },
      },
    };

    expect(getSignsDueForReview(signs, 2)).toEqual(['HELLO', 'PLEASE']);
  });

  it('prioritizes an established expressive parameter weakness over aggregate history', () => {
    const future = Date.now() + 60_000;
    const signs = {
      HELLO: {
        attempts: 10, successes: 10, lastAttempt: 1, nextReviewAt: future, interval: 1, easeFactor: 2.5,
        byMode: { expressive: { attempts: 3, successes: 3, lastAttempt: 1, nextReviewAt: future, interval: 1, easeFactor: 2.5, parameters: { handshape: { attempts: 3, score: 0.5, lastAttempt: 1 } } } },
      },
      PLEASE: {
        attempts: 1, successes: 0, lastAttempt: 1, nextReviewAt: future, interval: 1, easeFactor: 2.5,
        byMode: { expressive: { attempts: 3, successes: 3, lastAttempt: 1, nextReviewAt: future, interval: 1, easeFactor: 2.5 } },
      },
    };

    expect(getSignsDueForReview(signs, 2, 'expressive')).toEqual(['HELLO', 'PLEASE']);
  });
});
