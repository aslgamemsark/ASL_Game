/**
 * Types for the REAL landmark dataset schema (asl_landmarks_for_friend.zip — ASL Citizen + WLASL).
 *
 * This intentionally does NOT match the schema the spec's prose assumes (full 33-point pose with
 * z, per-landmark confidence/visibility). The actual data has:
 *   - 21-point hand landmarks (x,y,z) — good quality, see RawHandLandmarks.
 *   - Only 3 pose points (left_shoulder, right_shoulder, mouth), 2D only, NO elbow, NO z.
 *   - No per-landmark confidence/visibility field at all.
 * Every downstream module (Loader, Validator, M5 arm retargeting, M6 finger solver) is written
 * against THIS actual shape, not the spec's hypothetical one — see the plan's "Critical
 * data-quality finding" section for why (no elbow => can't do spec Ch.5's literal arm retargeting;
 * hand data is good enough for palm/finger work, which is what M6 actually uses it for).
 */

export type Side = 'left' | 'right';

/** A single hand's 21 MediaPipe landmarks, in source PIXEL space (x,y in [0,width]/[0,height], z relative-depth). */
export interface RawHandLandmarks {
  handedness: 'Left' | 'Right';
  points: [number, number, number][]; // length 21, MediaPipe hand topology (wrist=0, thumb=1-4, index=5-8, middle=9-12, ring=13-16, pinky=17-20)
}

export interface RawLandmarkFrame {
  t: number;
  width: number;
  height: number;
  hands: RawHandLandmarks[]; // 0, 1, or 2 entries
  /**
   * Pose extraction can fail for a whole frame (motion blur, signer briefly out of frame, etc) —
   * roughly half the frames in some WLASL clips have null pose points (confirmed empirically while
   * building this loader, not assumed). Always null-check before use.
   */
  left_shoulder: [number, number] | null;
  right_shoulder: [number, number] | null;
  mouth: [number, number] | null;
}

export interface RawLandmarkClip {
  sign_name: string;
  frames: RawLandmarkFrame[];
}

/** One validated, typed frame — same data as Raw, just reshaped for ergonomic access by hand side. */
export interface LoadedFrame {
  t: number;
  width: number;
  height: number;
  hands: Partial<Record<Side, RawHandLandmarks>>;
  leftShoulder: [number, number] | null;
  rightShoulder: [number, number] | null;
  mouth: [number, number] | null;
}

export interface LoadedClip {
  signName: string;
  sourcePath: string;
  frames: LoadedFrame[];
  estimatedFps: number;
}

export interface TrackingSnap {
  frameIndex: number;
  hand: Side;
  jumpPixels: number;
}

export interface ClipValidationReport {
  signName: string;
  sourcePath: string;
  frameCount: number;
  estimatedFps: number;
  framesWithAnyHand: number;
  framesWithBothHands: number;
  framesWithMissingPose: number;
  longestMissingHandGapFrames: Record<Side, number>;
  malformedFrames: string[];
  possibleTrackingSnaps: TrackingSnap[];
  notes: string[];
  /** True only if there are zero malformed frames and at least one frame with at least one hand. */
  pass: boolean;
}
