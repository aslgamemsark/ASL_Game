/**
 * Confidence-gates live coaching tips so a single noisy frame can't fire a specific — and
 * possibly wrong — corrective instruction. Per-parameter scores are noisy frame-to-frame; a
 * hint should only show once a parameter is CLEARLY and CONSISTENTLY below threshold, not the
 * instant it dips under it. Clearing (the positive case) stays immediate — there's no harm in
 * rewarding a correct hold right away.
 */

export const CONFIDENT_FAIL_MARGIN = 0.15;
export const SUSTAIN_FRAMES = 5;

export type GateStatus = 'cleared' | 'confident-fail' | 'neutral';

export interface GateState {
  status: GateStatus;
  failStreak: number;
}

export function initGateState(): GateState {
  return { status: 'neutral', failStreak: 0 };
}

/**
 * Advance one parameter's gate state by one frame's score.
 * - score clears its threshold -> 'cleared' immediately, streak resets.
 * - not required -> stays 'neutral' (never worth a confident-fail tip).
 * - required and clearly below threshold (by CONFIDENT_FAIL_MARGIN) for SUSTAIN_FRAMES
 *   consecutive frames -> 'confident-fail' (safe to show a specific corrective hint).
 * - anything else (below threshold but ambiguous, or a fail streak that hasn't sustained yet)
 *   -> 'neutral' — a "still working on it" state with no specific instruction.
 */
export function advanceGateState(
  prev: GateState,
  score: number,
  threshold: number,
  required: boolean
): GateState {
  if (score >= threshold) {
    return { status: 'cleared', failStreak: 0 };
  }
  if (!required) {
    return { status: 'neutral', failStreak: 0 };
  }
  const confidentlyFailing = score <= threshold - CONFIDENT_FAIL_MARGIN;
  const failStreak = confidentlyFailing ? prev.failStreak + 1 : 0;
  const status: GateStatus = failStreak >= SUSTAIN_FRAMES ? 'confident-fail' : 'neutral';
  return { status, failStreak };
}
