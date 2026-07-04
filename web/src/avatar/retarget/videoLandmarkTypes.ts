/**
 * Types for the NEW video-retarget landmark schema, produced by
 * `tools/extract_avatar_landmarks.py` (docs/VIDEO_RETARGET_HANDOFF.md, Phase 2). Deliberately
 * SEPARATE from `retarget/landmarkTypes.ts`, which documents the OLD `asl_landmarks_for_friend.zip`
 * dataset (2D-only, 3-point pose, no elbow) that M3's tests are pinned against — do not merge these.
 *
 * This schema has what the old one didn't: MediaPipe WORLD landmarks (metric 3D, hip-centered for
 * pose / hand-centered for hands), including elbows and wrists, from `core.landmarks.Frame`'s
 * additive `pose_world` / `Hand.world_points` fields (`core/landmarks.py`, `core/capture.py`).
 */

export type VideoSide = 'left' | 'right';

/** METERS, right-handed, same X/Y/Z axis CONVENTION for pose and hand world landmarks (both are
 * MediaPipe Tasks outputs on the same camera frame) — but DIFFERENT ORIGINS (pose is hip-centered,
 * hand is roughly hand-centered). Never mix a pose-world position with a hand-world position
 * directly; only DIRECTIONS (differences of two points from the SAME landmarker) are safe to share
 * between the two without an origin correction — see VideoArmRetargeter.ts. */
export interface Vec3World {
  x: number;
  y: number;
  z: number;
}

export interface RawVideoHand {
  handedness: 'Left' | 'Right';
  points: [number, number, number][]; // length 21, pixel-space x,y + MediaPipe relative z
  world_points?: [number, number, number][]; // length 21, METERS, hand-world-landmark space (optional — absent if undetected that frame)
}

export interface RawVideoPoseWorld {
  left_shoulder?: [number, number, number];
  right_shoulder?: [number, number, number];
  left_elbow?: [number, number, number];
  right_elbow?: [number, number, number];
  left_wrist?: [number, number, number];
  right_wrist?: [number, number, number];
  left_hip?: [number, number, number];
  right_hip?: [number, number, number];
}

export interface RawVideoFrame {
  t: number;
  width: number;
  height: number;
  hands: RawVideoHand[];
  left_shoulder: [number, number] | null;
  right_shoulder: [number, number] | null;
  mouth: [number, number] | null;
  pose_world?: RawVideoPoseWorld; // absent entirely if pose wasn't detected this frame
}

export interface RawVideoClip {
  sign_name: string;
  frames: RawVideoFrame[];
}

/** One validated, typed frame — reshaped for ergonomic access, same numeric data as Raw. */
export interface LoadedVideoHand {
  side: VideoSide;
  points: Vec3World[]; // length 21, pixel-space (x,y) + relative z
  worldPoints: Vec3World[] | null; // length 21, meters, hand-world-landmark space, or null
}

export interface LoadedVideoFrame {
  t: number;
  width: number;
  height: number;
  hands: Partial<Record<VideoSide, LoadedVideoHand>>;
  poseWorld: Partial<Record<keyof RawVideoPoseWorld, Vec3World>> | null;
}

export interface LoadedVideoClip {
  signName: string;
  sourcePath: string;
  frames: LoadedVideoFrame[];
  estimatedFps: number;
}

export interface VideoTrackingSnap {
  frameIndex: number;
  hand: VideoSide;
  jumpPixels: number;
}

export interface VideoClipValidationReport {
  signName: string;
  sourcePath: string;
  frameCount: number;
  estimatedFps: number;
  framesWithAnyHand: number;
  framesWithBothHands: number;
  framesWithBothElbows: number;
  malformedFrames: string[];
  possibleTrackingSnaps: VideoTrackingSnap[];
  notes: string[];
  /** True only if zero malformed frames, at least one frame with an elbow, and no malformed data. */
  pass: boolean;
}
