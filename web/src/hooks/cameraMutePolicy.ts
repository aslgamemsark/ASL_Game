/**
 * Pure decision policy for useCamera's stall escalation (ASL-A7).
 *
 * Extracted from scheduleStallCheck so the iOS mute gap is unit-testable:
 * the old inline check escalated only when `readyState < 2`, which never fires
 * for the iOS backgrounding case — a muted track with an attached, data-holding
 * element. Policy now: a MUTED track escalates regardless of readyState
 * (muted means no new frames will arrive); without a track we defer to the
 * original readyState signal; unmuted + live data is healthy.
 */
export function shouldEscalateToStalled(opts: {
  /** Current mute state of the video track. null when there is no track. */
  trackMuted: boolean | null;
  /** HTMLMediaElement.readyState of the attached video element. */
  readyState: number;
}): boolean {
  if (opts.trackMuted === true) return true;
  return opts.readyState < 2;
}
