import type { AttemptTrigger } from './outcome';

export type RecognitionCameraStatus = 'active' | 'denied' | 'error' | 'stalled' | 'idle' | 'requesting';

export interface AttemptLifecycle {
  token: number;
  status: 'idle' | 'active' | 'finalized';
  finalTrigger: AttemptTrigger | null;
}

export function createAttemptLifecycle(): AttemptLifecycle {
  return { token: 0, status: 'idle', finalTrigger: null };
}

export function beginAttempt(state: AttemptLifecycle): AttemptLifecycle {
  return { token: state.token + 1, status: 'active', finalTrigger: null };
}

export function cancelAttempt(state: AttemptLifecycle): AttemptLifecycle {
  return { token: state.token + 1, status: 'idle', finalTrigger: null };
}

export function isFinalizableBoundary(trigger: AttemptTrigger, cameraStatus: RecognitionCameraStatus): boolean {
  return trigger !== 'camera_interruption' || cameraStatus !== 'active';
}

export function finishAttempt(
  state: AttemptLifecycle,
  token: number,
  trigger: AttemptTrigger
): { state: AttemptLifecycle; accepted: boolean } {
  if (state.status !== 'active' || state.token !== token) return { state, accepted: false };
  return { state: { ...state, status: 'finalized', finalTrigger: trigger }, accepted: true };
}

export function rearmAfterVerifierDisagreement(state: AttemptLifecycle): AttemptLifecycle {
  return state.status === 'finalized' && state.finalTrigger === 'classifier_veto'
    ? beginAttempt(state)
    : state;
}

export function advanceDisputeReadiness(
  sinceMs: number | null,
  nowMs: number,
  lifecycle: AttemptLifecycle,
  verifierPassed: boolean,
  hasGoodRawEvidence: boolean
): { sinceMs: number | null; ready: boolean } {
  if (lifecycle.status !== 'active' || verifierPassed || !hasGoodRawEvidence) {
    return { sinceMs: null, ready: false };
  }
  const startedAt = sinceMs ?? nowMs;
  return { sinceMs: startedAt, ready: nowMs - startedAt >= 5000 };
}

export interface QualityAnnouncementState {
  candidate: string | null;
  sinceMs: number | null;
  announced: string | null;
}

export function createQualityAnnouncementState(): QualityAnnouncementState {
  return { candidate: null, sinceMs: null, announced: null };
}

/** Debounces issue changes and clears immediately once framing recovers. */
export function advanceQualityAnnouncement(
  state: QualityAnnouncementState,
  issue: string | null,
  nowMs: number,
  delayMs = 600
): QualityAnnouncementState {
  if (!issue) return createQualityAnnouncementState();
  if (issue !== state.candidate) return { candidate: issue, sinceMs: nowMs, announced: state.announced };
  if (state.sinceMs !== null && nowMs - state.sinceMs >= delayMs) return { ...state, announced: issue };
  return state;
}
