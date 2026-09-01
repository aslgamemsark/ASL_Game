import { describe, expect, it } from 'vitest';
import {
  beginAttempt,
  cancelAttempt,
  createAttemptLifecycle,
  advanceDisputeReadiness,
  advanceQualityAnnouncement,
  createQualityAnnouncementState,
  finishAttempt,
  isFinalizableBoundary,
  rearmAfterVerifierDisagreement,
} from '../attemptLifecycle';

describe('recognition attempt lifecycle', () => {
  it('accepts a pass once and rejects a following camera interruption', () => {
    const active = beginAttempt(createAttemptLifecycle());
    const pass = finishAttempt(active, active.token, 'recognition_pass');
    const interruption = finishAttempt(pass.state, active.token, 'camera_interruption');

    expect(pass.accepted).toBe(true);
    expect(interruption.accepted).toBe(false);
    expect(interruption.state.finalTrigger).toBe('recognition_pass');
  });

  it('accepts one camera interruption for an active attempt', () => {
    const active = beginAttempt(createAttemptLifecycle());
    const first = finishAttempt(active, active.token, 'camera_interruption');
    const duplicate = finishAttempt(first.state, active.token, 'camera_interruption');

    expect(first.accepted).toBe(true);
    expect(duplicate.accepted).toBe(false);
  });

  it('rejects a camera interruption boundary while the camera is active', () => {
    expect(isFinalizableBoundary('camera_interruption', 'active')).toBe(false);
    expect(isFinalizableBoundary('camera_interruption', 'stalled')).toBe(true);
    expect(isFinalizableBoundary('recognition_pass', 'active')).toBe(true);
  });

  it('rejects an asynchronous result from an attempt that was reset', () => {
    const first = beginAttempt(createAttemptLifecycle());
    const retry = beginAttempt(first);

    expect(finishAttempt(retry, first.token, 'recognition_pass').accepted).toBe(false);
    expect(finishAttempt(retry, retry.token, 'recognition_pass').accepted).toBe(true);
  });

  it('cancels an attempt without recording an outcome and invalidates its token', () => {
    const active = beginAttempt(createAttemptLifecycle());
    const cancelled = cancelAttempt(active);

    expect(cancelled.status).toBe('idle');
    expect(cancelled.finalTrigger).toBe(null);
    expect(finishAttempt(cancelled, active.token, 'recognition_pass').accepted).toBe(false);
  });

  it('rearms only a classifier veto after verifier disagreement', () => {
    const active = beginAttempt(createAttemptLifecycle());
    const veto = finishAttempt(active, active.token, 'classifier_veto').state;
    const pass = finishAttempt(active, active.token, 'recognition_pass').state;

    expect(rearmAfterVerifierDisagreement(veto).status).toBe('active');
    expect(rearmAfterVerifierDisagreement(pass).status).toBe('finalized');
  });

  it('offers dispute only after five seconds of continuous active disagreement and raw evidence', () => {
    const active = beginAttempt(createAttemptLifecycle());
    const started = advanceDisputeReadiness(null, 1000, active, false, true);
    const early = advanceDisputeReadiness(started.sinceMs, 5999, active, false, true);
    const ready = advanceDisputeReadiness(started.sinceMs, 6000, active, false, true);

    expect(started).toEqual({ sinceMs: 1000, ready: false });
    expect(early.ready).toBe(false);
    expect(ready.ready).toBe(true);
  });

  it('clears dispute readiness when verification passes or raw evidence drops', () => {
    const active = beginAttempt(createAttemptLifecycle());

    expect(advanceDisputeReadiness(1000, 7000, active, true, true)).toEqual({ sinceMs: null, ready: false });
    expect(advanceDisputeReadiness(1000, 7000, active, false, false)).toEqual({ sinceMs: null, ready: false });
  });

  it('announces only a stable quality issue and clears after recovery', () => {
    const first = advanceQualityAnnouncement(createQualityAnnouncementState(), 'Move back', 1000);
    const changed = advanceQualityAnnouncement(first, 'Center yourself', 1500);
    const early = advanceQualityAnnouncement(changed, 'Center yourself', 2099);
    const announced = advanceQualityAnnouncement(early, 'Center yourself', 2100);

    expect(first.announced).toBeNull();
    expect(changed.announced).toBeNull();
    expect(early.announced).toBeNull();
    expect(announced.announced).toBe('Center yourself');
    expect(advanceQualityAnnouncement(announced, null, 2200)).toEqual(createQualityAnnouncementState());
  });
});
