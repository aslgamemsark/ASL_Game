/**
 * Landmark Loader + Validator (spec Chapter 4, adapted to the real dataset schema — see
 * landmarkTypes.ts for exactly how and why).
 *
 * Spec philosophy honored here: "Landmark JSON is READ ONLY... Load -> Transform in memory ->
 * Animate." This module never writes back to the source files. `loadClip` reshapes the raw JSON
 * into ergonomic per-side-keyed frames (pure restructuring, no numeric change); `validateClip` then
 * runs the spec's required checks adapted to what this data actually contains.
 *
 * Validation rules implemented (spec "Required Validation", with documented gaps where the spec's
 * assumed schema has a field this dataset doesn't):
 *   - Frame count > 0
 *   - Each hand has exactly 21 points (spec: "Landmark count")
 *   - No NaN / Infinity in any coordinate (spec: "No NaN/Infinity values")
 *   - handedness is "Left" or "Right" (spec: "Hands correctly labelled")
 *   - Confidence threshold: NOT APPLICABLE — this dataset carries no per-landmark confidence or
 *     visibility field at all (unlike the spec's assumed MediaPipe-direct schema). Documented here,
 *     not silently skipped.
 *   - Sequence consistency ("did the signer teleport?"): flags large frame-to-frame wrist jumps as
 *     possible tracking snaps — surfaced, not auto-rejected (spec: "flag the sequence... do not
 *     silently animate corrupted data").
 *   - Missing-hand gaps: reported (longest gap per side), not filled — gap-filling/interpolation is
 *     a later-stage concern (spec's own pipeline order: Validation -> Cleaning -> Retargeting), not
 *     part of loading.
 */
import type {
  ClipValidationReport,
  LoadedClip,
  LoadedFrame,
  RawLandmarkClip,
  Side,
  TrackingSnap,
} from './landmarkTypes.ts';

const EXPECTED_POINTS_PER_HAND = 21;
// A wrist jump larger than this fraction of image width between consecutive frames (same hand
// side) reads as a tracking snap rather than real motion. Chosen to match the equivalent constant
// already proven in this project's prior MediaPipe capture pipeline (SNAP_THRESHOLD), expressed as
// a fraction of frame width instead of shoulder-width units since this dataset has no body-frame
// normalization at load time.
const SNAP_FRACTION_OF_WIDTH = 0.25;

/** Tolerates the documented `null` pose case — null is "missing data" (valid), not malformed. */
function isFiniteOrNull(p: [number, number, number] | [number, number] | null): boolean {
  return p === null || p.every((v) => Number.isFinite(v));
}

export function loadClip(raw: RawLandmarkClip, sourcePath: string): LoadedClip {
  const frames: LoadedFrame[] = raw.frames.map((f) => {
    const hands: Partial<Record<Side, (typeof f.hands)[number]>> = {};
    for (const h of f.hands) {
      const side: Side = h.handedness === 'Left' ? 'left' : 'right';
      hands[side] = h;
    }
    return {
      t: f.t,
      width: f.width,
      height: f.height,
      hands,
      leftShoulder: f.left_shoulder,
      rightShoulder: f.right_shoulder,
      mouth: f.mouth,
    };
  });

  const dts: number[] = [];
  for (let i = 1; i < frames.length; i++) dts.push(frames[i].t - frames[i - 1].t);
  const avgDt = dts.length > 0 ? dts.reduce((a, b) => a + b, 0) / dts.length : 0;
  const estimatedFps = avgDt > 0 ? 1 / avgDt : 0;

  return { signName: raw.sign_name, sourcePath, frames, estimatedFps };
}

export function validateClip(clip: LoadedClip): ClipValidationReport {
  const malformedFrames: string[] = [];
  const notes: string[] = [
    'Confidence/visibility validation: N/A — this dataset has no per-landmark confidence field.',
  ];
  const possibleTrackingSnaps: TrackingSnap[] = [];
  const lastSeenWrist: Partial<Record<Side, [number, number]>> = {};
  const currentGap: Record<Side, number> = { left: 0, right: 0 };
  const longestGap: Record<Side, number> = { left: 0, right: 0 };
  let framesWithAnyHand = 0;
  let framesWithBothHands = 0;
  let framesWithMissingPose = 0;

  clip.frames.forEach((frame, i) => {
    const sides = Object.keys(frame.hands) as Side[];
    if (sides.length > 0) framesWithAnyHand++;
    if (sides.length === 2) framesWithBothHands++;
    if (frame.leftShoulder === null || frame.rightShoulder === null || frame.mouth === null) {
      framesWithMissingPose++;
    }

    for (const side of ['left', 'right'] as const) {
      const hand = frame.hands[side];
      if (!hand) {
        currentGap[side]++;
        longestGap[side] = Math.max(longestGap[side], currentGap[side]);
        continue;
      }
      currentGap[side] = 0;

      if (hand.points.length !== EXPECTED_POINTS_PER_HAND) {
        malformedFrames.push(`frame ${i} (${side}): expected ${EXPECTED_POINTS_PER_HAND} points, got ${hand.points.length}`);
        continue;
      }
      if (hand.handedness !== 'Left' && hand.handedness !== 'Right') {
        malformedFrames.push(`frame ${i} (${side}): invalid handedness "${hand.handedness}"`);
      }
      for (let p = 0; p < hand.points.length; p++) {
        if (!isFiniteOrNull(hand.points[p])) {
          malformedFrames.push(`frame ${i} (${side}): non-finite coordinate at point ${p}`);
        }
      }

      const wrist = hand.points[0];
      const wristXY: [number, number] = [wrist[0], wrist[1]];
      const prev = lastSeenWrist[side];
      if (prev) {
        const dx = wristXY[0] - prev[0];
        const dy = wristXY[1] - prev[1];
        const jump = Math.sqrt(dx * dx + dy * dy);
        if (jump > frame.width * SNAP_FRACTION_OF_WIDTH) {
          possibleTrackingSnaps.push({ frameIndex: i, hand: side, jumpPixels: jump });
        }
      }
      lastSeenWrist[side] = wristXY;
    }

    if (!isFiniteOrNull(frame.leftShoulder)) malformedFrames.push(`frame ${i}: non-finite left_shoulder`);
    if (!isFiniteOrNull(frame.rightShoulder)) malformedFrames.push(`frame ${i}: non-finite right_shoulder`);
    if (!isFiniteOrNull(frame.mouth)) malformedFrames.push(`frame ${i}: non-finite mouth`);
  });

  if (clip.frames.length === 0) {
    notes.push('Clip has zero frames.');
  }
  if (possibleTrackingSnaps.length > 0) {
    notes.push(`${possibleTrackingSnaps.length} possible tracking snap(s) flagged — review before using for retargeting calibration.`);
  }
  if (framesWithMissingPose > 0) {
    notes.push(`${framesWithMissingPose}/${clip.frames.length} frame(s) have null pose (left_shoulder/right_shoulder/mouth) — pose detection failed for that frame; this is valid missing data, not malformed.`);
  }

  const pass = malformedFrames.length === 0 && framesWithAnyHand > 0;

  return {
    signName: clip.signName,
    sourcePath: clip.sourcePath,
    frameCount: clip.frames.length,
    estimatedFps: clip.estimatedFps,
    framesWithAnyHand,
    framesWithBothHands,
    framesWithMissingPose,
    longestMissingHandGapFrames: longestGap,
    malformedFrames,
    possibleTrackingSnaps,
    notes,
    pass,
  };
}
