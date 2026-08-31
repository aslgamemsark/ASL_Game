import { describe, expect, it } from 'vitest';
import {
  decideRecognitionOutcome,
  type RecognitionReason,
} from './outcome';

describe('recognition outcome domain', () => {
  it('returns PASS only for a passed, scorable recognition result', () => {
    expect(decideRecognitionOutcome({ recognitionPassed: true, scorable: true, reasons: [] })).toEqual({
      kind: 'PASS',
      reasons: [],
    });
  });

  it('returns NEEDS_CORRECTION only when evidence is scorable but the sign did not pass', () => {
    expect(decideRecognitionOutcome({ recognitionPassed: false, scorable: true, reasons: [] })).toEqual({
      kind: 'NEEDS_CORRECTION',
      reasons: [],
    });
  });

  it('makes environmental evidence NOT_SCORABLE even when the verifier would otherwise fail', () => {
    const reasons: RecognitionReason[] = ['MISSING_REQUIRED_HAND', 'TRACKING_UNSTABLE'];

    expect(decideRecognitionOutcome({ recognitionPassed: false, scorable: false, reasons })).toEqual({
      kind: 'NOT_SCORABLE',
      reasons,
    });
  });

  it('keeps NOT_SCORABLE free of progress, life, score, or penalty semantics', () => {
    const outcome = decideRecognitionOutcome({
      recognitionPassed: true,
      scorable: false,
      reasons: ['CAMERA_STALLED'],
    });

    expect(outcome.kind).toBe('NOT_SCORABLE');
    expect(Object.keys(outcome)).toEqual(['kind', 'reasons']);
    expect(JSON.stringify(outcome)).not.toMatch(/progress|life|score|penalt/i);
  });
});
