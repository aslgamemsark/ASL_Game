import { describe, expect, it } from 'vitest';
import { ATTEMPT_TRIGGERS, decideAttemptBoundaryOutcome, decideRecognitionOutcome } from '../outcome';

describe('recognition outcomes', () => {
  it('names every attempt boundary that analytics must distinguish', () => {
    expect(ATTEMPT_TRIGGERS).toEqual([
      'recognition_pass',
      'classifier_veto',
      'skip',
      'timeout',
      'camera_interruption',
    ]);
  });

  it('keeps a camera interruption neutral', () => {
    expect(decideAttemptBoundaryOutcome()).toEqual({
      kind: 'NOT_SCORABLE',
      reasons: ['CAMERA_UNAVAILABLE'],
      primaryReason: 'CAMERA_UNAVAILABLE',
    });
  });

  it('only passes scorable evidence', () => {
    expect(decideRecognitionOutcome({ recognitionPassed: true, scorable: true, reasons: [] }).kind).toBe('PASS');
    expect(decideRecognitionOutcome({ recognitionPassed: true, scorable: false, reasons: ['CAMERA_UNAVAILABLE'] }).kind).toBe('NOT_SCORABLE');
  });
});
