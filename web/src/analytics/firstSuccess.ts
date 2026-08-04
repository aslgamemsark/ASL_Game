import { track } from './capture';

const FIRST_SUCCESS_KEY = 'quicksign-first-sign-success';

/**
 * Fire `first_sign_success` the first time this browser ever passes a sign, and never again.
 *
 * Owns its own once-per-user guard so callers cannot get it wrong: every surface that can produce
 * a passing attempt (lesson, practice, story, speed) calls this unconditionally on a pass, and
 * only the genuine first one is reported. Storing the flag rather than deriving it from progress
 * state is deliberate — a guest has no server-side progress to check, and guests are exactly the
 * population this metric exists to measure.
 *
 * Safe to call on every pass. No-ops when storage is unavailable rather than throwing, since a
 * blocked-storage context should cost an analytics event, not the lesson the user is in.
 */
export function trackFirstSignSuccess(args: {
  signId: string;
  msSinceLessonStart: number;
  attemptsTaken: number;
}): void {
  let alreadyRecorded: boolean;
  try {
    alreadyRecorded = localStorage.getItem(FIRST_SUCCESS_KEY) === '1';
  } catch {
    return; // storage blocked — skip rather than risk double-counting on every pass
  }
  if (alreadyRecorded) return;

  try {
    localStorage.setItem(FIRST_SUCCESS_KEY, '1');
  } catch {
    return;
  }

  track('first_sign_success', {
    sign_id: args.signId,
    ms_since_lesson_start: args.msSinceLessonStart,
    attempts_taken: args.attemptsTaken,
  });
}
