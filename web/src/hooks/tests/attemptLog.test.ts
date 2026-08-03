/**
 * Locks the attempt-routing policy that useAttemptLog centralises. Before that hook existed the
 * same rules were hand-copied into six pages, and they had already drifted — so these assert the
 * behaviour that was previously only implicit in which pages happened to call logAttempt.
 */
import { describe, it, expect } from 'vitest';
import { trainingSourceFor } from '@/hooks/useAttemptLog';
import type { AttemptSource } from '@/analytics/types';

const ALL_SOURCES: AttemptSource[] = ['lesson', 'practice', 'story', 'speed', 'duel', 'room'];

describe('attempt routing policy', () => {
  it('routes every solo screen to its own training-data source', () => {
    expect(trainingSourceFor('lesson')).toBe('lesson');
    expect(trainingSourceFor('practice')).toBe('practice');
    expect(trainingSourceFor('story')).toBe('story');
    expect(trainingSourceFor('speed')).toBe('speed');
  });

  // Duel/Room feed analytics only. If this ever flips, it must be a deliberate decision that also
  // updates the sign_attempts.source comment in the schema — not an accident of a new screen
  // copying a solo page's wiring.
  it('keeps multiplayer analytics-only', () => {
    expect(trainingSourceFor('duel')).toBeNull();
    expect(trainingSourceFor('room')).toBeNull();
  });

  it('has a decision recorded for every attempt source', () => {
    for (const source of ALL_SOURCES) {
      expect(trainingSourceFor(source)).not.toBeUndefined();
    }
  });
});
