/**
 * Loader + validator for the NEW video-retarget landmark schema (videoLandmarkTypes.ts). Mirrors
 * `LandmarkLoader.ts`'s pattern (load -> reshape -> validate, read-only, never writes back) but for
 * the richer world-landmark schema `tools/extract_avatar_landmarks.py` produces.
 */
import type {
  LoadedVideoClip,
  LoadedVideoFrame,
  LoadedVideoHand,
  RawVideoClip,
  RawVideoPoseWorld,
  Vec3World,
  VideoClipValidationReport,
  VideoSide,
  VideoTrackingSnap,
} from './videoLandmarkTypes.ts';

const EXPECTED_POINTS_PER_HAND = 21;
// Mirrors LandmarkLoader.ts's SNAP_FRACTION_OF_WIDTH — same constant, same reasoning, applied to
// this schema's pixel-space hand points.
const SNAP_FRACTION_OF_WIDTH = 0.25;

function toVec3(p: [number, number, number]): Vec3World {
  return { x: p[0], y: p[1], z: p[2] };
}

function isFiniteVec3(v: Vec3World): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

export function loadVideoClip(raw: RawVideoClip, sourcePath: string): LoadedVideoClip {
  const frames: LoadedVideoFrame[] = raw.frames.map((f) => {
    const hands: Partial<Record<VideoSide, LoadedVideoHand>> = {};
    for (const h of f.hands) {
      const side: VideoSide = h.handedness === 'Left' ? 'left' : 'right';
      hands[side] = {
        side,
        points: h.points.map(toVec3),
        worldPoints: h.world_points ? h.world_points.map(toVec3) : null,
      };
    }
    let poseWorld: LoadedVideoFrame['poseWorld'] = null;
    if (f.pose_world) {
      poseWorld = {};
      for (const [key, val] of Object.entries(f.pose_world) as [keyof RawVideoPoseWorld, [number, number, number]][]) {
        poseWorld[key] = toVec3(val);
      }
    }
    return { t: f.t, width: f.width, height: f.height, hands, poseWorld };
  });

  const dts: number[] = [];
  for (let i = 1; i < frames.length; i++) dts.push(frames[i].t - frames[i - 1].t);
  const avgDt = dts.length > 0 ? dts.reduce((a, b) => a + b, 0) / dts.length : 0;
  const estimatedFps = avgDt > 0 ? 1 / avgDt : 0;

  return { signName: raw.sign_name, sourcePath, frames, estimatedFps };
}

export function validateVideoClip(clip: LoadedVideoClip): VideoClipValidationReport {
  const malformedFrames: string[] = [];
  const notes: string[] = [];
  const possibleTrackingSnaps: VideoTrackingSnap[] = [];
  const lastSeenWrist: Partial<Record<VideoSide, Vec3World>> = {};
  let framesWithAnyHand = 0;
  let framesWithBothHands = 0;
  let framesWithBothElbows = 0;

  clip.frames.forEach((frame, i) => {
    const sides = Object.keys(frame.hands) as VideoSide[];
    if (sides.length > 0) framesWithAnyHand++;
    if (sides.length === 2) framesWithBothHands++;
    if (frame.poseWorld?.left_elbow && frame.poseWorld?.right_elbow) framesWithBothElbows++;

    for (const side of sides) {
      const hand = frame.hands[side]!;
      if (hand.points.length !== EXPECTED_POINTS_PER_HAND) {
        malformedFrames.push(`frame ${i} (${side}): expected ${EXPECTED_POINTS_PER_HAND} points, got ${hand.points.length}`);
        continue;
      }
      for (const p of hand.points) {
        if (!isFiniteVec3(p)) malformedFrames.push(`frame ${i} (${side}): non-finite pixel coordinate`);
      }
      if (hand.worldPoints) {
        if (hand.worldPoints.length !== EXPECTED_POINTS_PER_HAND) {
          malformedFrames.push(`frame ${i} (${side}): expected ${EXPECTED_POINTS_PER_HAND} world points, got ${hand.worldPoints.length}`);
        }
        for (const p of hand.worldPoints) {
          if (!isFiniteVec3(p)) malformedFrames.push(`frame ${i} (${side}): non-finite world coordinate`);
        }
      }

      const wrist = hand.points[0];
      const prev = lastSeenWrist[side];
      if (prev) {
        const dx = wrist.x - prev.x;
        const dy = wrist.y - prev.y;
        const jump = Math.sqrt(dx * dx + dy * dy);
        if (jump > frame.width * SNAP_FRACTION_OF_WIDTH) {
          possibleTrackingSnaps.push({ frameIndex: i, hand: side, jumpPixels: jump });
        }
      }
      lastSeenWrist[side] = wrist;
    }

    if (frame.poseWorld) {
      for (const [key, v] of Object.entries(frame.poseWorld)) {
        if (v && !isFiniteVec3(v as Vec3World)) malformedFrames.push(`frame ${i}: non-finite pose_world.${key}`);
      }
    }
  });

  if (clip.frames.length === 0) notes.push('Clip has zero frames.');
  if (possibleTrackingSnaps.length > 0) {
    notes.push(`${possibleTrackingSnaps.length} possible tracking snap(s) flagged — review before retargeting.`);
  }
  if (framesWithBothElbows < clip.frames.length) {
    notes.push(`${clip.frames.length - framesWithBothElbows}/${clip.frames.length} frame(s) missing at least one elbow world landmark.`);
  }

  const pass = malformedFrames.length === 0 && framesWithBothElbows > 0;

  return {
    signName: clip.signName,
    sourcePath: clip.sourcePath,
    frameCount: clip.frames.length,
    estimatedFps: clip.estimatedFps,
    framesWithAnyHand,
    framesWithBothHands,
    framesWithBothElbows,
    malformedFrames,
    possibleTrackingSnaps,
    notes,
    pass,
  };
}
