import type { Frame } from './landmarks';

/**
 * Live camera-framing feedback derived from the pose landmarks already computed each frame — so
 * this adds ZERO extra inference cost; it's pure geometry over data the recognition loop already
 * has. Drives the pre-session camera-position guide (see useCameraFramingGuide).
 *
 * `ok` means the user is well framed: both shoulders visible, a reasonable distance (not so close
 * the shoulders clip out of frame — which would break the shoulder-width normalization every
 * spatial threshold depends on — and not so far that hand detail degrades), roughly centered, and
 * the face high enough that the chest stays visible below.
 */
export interface FramingStatus {
  ok: boolean;
  message: string;
}

// Thresholds as ratios of the video frame, so they hold at any resolution/distance-to-camera.
// These guide camera POSITION only — they are not sign-verification thresholds. They are a
// declared tuning knob: adjust against real recordings (see the classroom-signs calibration
// workflow), not by guessing.
const MAX_SHOULDER_WIDTH_RATIO = 0.8; // above this, too close — shoulders begin to clip the frame
const MIN_SHOULDER_WIDTH_RATIO = 0.32; // below this, too far — hand detail becomes unreliable
const MAX_CENTER_OFFSET_RATIO = 0.16; // how far the shoulder midpoint may sit from horizontal center
const MAX_MOUTH_Y_RATIO = 0.55; // face must stay in the upper part so the chest is visible below it

/**
 * Evaluate one frame's camera framing. Pure function of the frame's pose landmarks — same input
 * always yields the same status, so it is unit-tested directly with synthetic frames.
 */
export function computeFraming(frame: Frame): FramingStatus {
  const { leftShoulder, rightShoulder, mouth, width, height } = frame;
  if (!width || !height || !leftShoulder || !rightShoulder) {
    return { ok: false, message: 'Step into view so I can see you' };
  }
  const shoulderWidthRatio = Math.abs(leftShoulder[0] - rightShoulder[0]) / width;
  const midX = (leftShoulder[0] + rightShoulder[0]) / 2 / width;
  const centerOffset = Math.abs(midX - 0.5);
  if (shoulderWidthRatio > MAX_SHOULDER_WIDTH_RATIO) return { ok: false, message: 'Move back a little' };
  if (shoulderWidthRatio < MIN_SHOULDER_WIDTH_RATIO) return { ok: false, message: 'Come a little closer' };
  if (centerOffset > MAX_CENTER_OFFSET_RATIO) return { ok: false, message: 'Center yourself in the box' };
  // Keep the face in the upper part of the frame so the chest stays visible below it.
  if (mouth && mouth[1] / height > MAX_MOUTH_Y_RATIO) return { ok: false, message: 'Raise your camera a touch' };
  return { ok: true, message: 'Perfect — hold it there ✓' };
}
