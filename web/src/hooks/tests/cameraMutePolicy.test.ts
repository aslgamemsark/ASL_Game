/**
 * ASL-A7 acceptance test (RED-first): the iOS mute gap.
 *
 * On iOS Safari, backgrounding mutes the video track while the attached <video>
 * keeps readyState ≥ 2. useCamera's scheduleStallCheck only escalates when
 * readyState < 2 — so the exact case its own onmute comment claims to cover
 * never fires, and the user sees a frozen mirror with no error and no retry.
 *
 * The fix extracts the decision into a pure predicate: a stall check that fires
 * while the track is muted must escalate EVEN IF the element reports ready data,
 * because muted means "no new frames will arrive."
 */
import { describe, it, expect } from 'vitest';
import { shouldEscalateToStalled } from '@/hooks/cameraMutePolicy';

describe('camera mute → stalled escalation policy', () => {
  it('escalates when the track is muted even with ready data (iOS background case)', () => {
    expect(shouldEscalateToStalled({ trackMuted: true, readyState: 4 })).toBe(true);
  });

  it('escalates when the element never produced data (original dead-feed case)', () => {
    expect(shouldEscalateToStalled({ trackMuted: false, readyState: 0 })).toBe(true);
    expect(shouldEscalateToStalled({ trackMuted: false, readyState: 1 })).toBe(true);
  });

  it('stays active when unmuted with live data', () => {
    expect(shouldEscalateToStalled({ trackMuted: false, readyState: 4 })).toBe(false);
  });

  it('treats null track as not-stalled (no stream to judge)', () => {
    expect(shouldEscalateToStalled({ trackMuted: null, readyState: 4 })).toBe(false);
  });
});
