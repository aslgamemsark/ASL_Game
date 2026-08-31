import { describe, expect, it } from 'vitest';
import { decideAttemptBoundaryOutcome, decideRecognitionOutcome } from '../outcome';

describe('recognition outcomes', () => {
  it('keeps a camera interruption neutral', () => {
    expect(decideAttemptBoundaryOutcome('camera_interruption')).toEqual({
      kind: 'NOT_SCORABLE',
      reasons: ['CAMERA_UNAVAILABLE'],
    });
  });

  it('only passes scorable evidence', () => {
    expect(decideRecognitionOutcome({ recognitionPassed: true, scorable: true, reasons: [] }).kind).toBe('PASS');
    expect(decideRecognitionOutcome({ recognitionPassed: true, scorable: false, reasons: ['CAMERA_UNAVAILABLE'] }).kind).toBe('NOT_SCORABLE');
  });
});
