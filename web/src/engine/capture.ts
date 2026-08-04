import {
  HandLandmarker,
  PoseLandmarker,
  FaceLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import type { Frame, Hand } from './landmarks';
import {
  POSE_LEFT_SHOULDER,
  POSE_RIGHT_SHOULDER,
  POSE_MOUTH_LEFT,
  POSE_MOUTH_RIGHT,
} from './landmarks';

// Pinned to the exact @mediapipe/tasks-vision version in package.json (was `@latest` — unpinned on
// the camera critical path, found 2026-07-30: a CDN tag can change under the app at any time with
// no warning, and the JS API wrapper (npm) and the WASM binary it drives (CDN) must be the same
// version — a silent mismatch is exactly the kind of thing that produces confusing, hard-to-repro
// recognition bugs. Bump this string whenever package.json's @mediapipe/tasks-vision version bumps.
//
// Exported solely so tests/mediapipeVersion.test.ts can assert it still equals the INSTALLED
// version. package.json carries a caret range (^0.10.35), so a routine `npm install` can resolve
// the JS wrapper to a newer patch while this string keeps pointing the WASM binary at the old one —
// reintroducing the exact skew the pin was added to prevent, silently. "Remember to bump this
// string" is not a mechanism; the test is.
export const MEDIAPIPE_WASM_VERSION = '0.10.35';

export class Capture {
  private hand: HandLandmarker | null = null;
  private pose: PoseLandmarker | null = null;
  private face: FaceLandmarker | null = null;
  private lastTsMs = -1;
  private _ready = false;
  private _logged = false;
  // OPTIONAL, additive, default OFF (facial non-manual marker support — see engine/schema.ts's
  // NmmReq). No current sign requires this, so no existing caller pays the extra model download
  // or per-frame face-detection cost unless it opts in.
  private readonly wantFaceBlendshapes: boolean;

  constructor(options: { wantFaceBlendshapes?: boolean } = {}) {
    this.wantFaceBlendshapes = options.wantFaceBlendshapes ?? false;
  }

  get ready(): boolean {
    return this._ready;
  }

  async init(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_WASM_VERSION}/wasm`
    );

    // Devices without WebGL (older Android/tablets) throw when asked for a GPU delegate — retry
    // once on CPU rather than failing the whole app for those users.
    const withDelegateFallback = async <T>(
      label: string,
      create: (delegate: 'GPU' | 'CPU') => Promise<T>
    ): Promise<T> => {
      try {
        return await create('GPU');
      } catch (err) {
        console.warn(`[QuickSign] ${label}: GPU delegate failed, falling back to CPU`, err);
        return await create('CPU');
      }
    };

    this.hand = await withDelegateFallback('HandLandmarker', (delegate) =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate,
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      })
    );

    this.pose = await withDelegateFallback('PoseLandmarker', (delegate) =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate,
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      })
    );

    if (this.wantFaceBlendshapes) {
      this.face = await withDelegateFallback('FaceLandmarker', (delegate) =>
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate,
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
        })
      );
    }

    this._ready = true;
  }

  /**
   * `skipPose`: PoseLandmarker inference is a real per-frame cost (a full second model run,
   * separate from and in addition to HandLandmarker) that every caller paid unconditionally even
   * when they never read `leftShoulder`/`rightShoulder`/`mouth` — e.g. DominantHandCheck, which
   * only ever looks at `frame.hands`. That's wasted latency on every poll tick, not just a UI
   * debounce value to tune (found while diagnosing reported "still feels slow" on real hardware,
   * 2026-07-16). The sign-verification path (useRecognition.ts) still needs pose for shoulder-
   * width normalization and must NOT pass this.
   */
  process(video: HTMLVideoElement, timestampMs: number, opts?: { skipPose?: boolean }): Frame {
    if (!this.hand || !this.pose) {
      throw new Error('Capture not initialized — call init() first');
    }

    if (timestampMs <= this.lastTsMs) {
      timestampMs = this.lastTsMs + 1;
    }
    this.lastTsMs = timestampMs;

    const w = video.videoWidth;
    const h = video.videoHeight;

    if (w === 0 || h === 0) {
      return {
        t: timestampMs / 1000, width: 0, height: 0,
        hands: [], leftShoulder: null, rightShoulder: null, mouth: null, faceBlendshapes: null,
      };
    }

    const handRes = this.hand.detectForVideo(video, timestampMs);
    const poseRes = opts?.skipPose ? null : this.pose.detectForVideo(video, timestampMs);
    const faceRes = this.face ? this.face.detectForVideo(video, timestampMs) : null;

    if (!this._logged) {
      if (import.meta.env.DEV) {
        console.log('[QuickSign] MediaPipe first result — hands:', handRes.landmarks?.length ?? 0,
          'pose:', poseRes?.landmarks?.length ?? 0, 'video:', w, 'x', h);
      }
      this._logged = true;
    }

    const frame: Frame = {
      t: timestampMs / 1000,
      width: w,
      height: h,
      hands: [],
      leftShoulder: null,
      rightShoulder: null,
      mouth: null,
      faceBlendshapes: null,
    };

    if (handRes.landmarks && handRes.handedness) {
      for (let i = 0; i < handRes.landmarks.length; i++) {
        const lms = handRes.landmarks[i];
        const label = handRes.handedness[i][0].categoryName;
        const points: number[][] = lms.map((lm) => [lm.x * w, lm.y * h, lm.z]);
        frame.hands.push({ handedness: label, points } as Hand);
      }
    }

    if (poseRes && poseRes.landmarks && poseRes.landmarks.length > 0) {
      const pose = poseRes.landmarks[0];
      const ls = pose[POSE_LEFT_SHOULDER];
      const rs = pose[POSE_RIGHT_SHOULDER];
      frame.leftShoulder = [ls.x * w, ls.y * h];
      frame.rightShoulder = [rs.x * w, rs.y * h];
      const ml = pose[POSE_MOUTH_LEFT];
      const mr = pose[POSE_MOUTH_RIGHT];
      frame.mouth = [(ml.x + mr.x) * 0.5 * w, (ml.y + mr.y) * 0.5 * h];
    }

    if (faceRes && faceRes.faceBlendshapes && faceRes.faceBlendshapes.length > 0) {
      const categories = faceRes.faceBlendshapes[0].categories;
      const shapes: Record<string, number> = {};
      for (const c of categories) shapes[c.categoryName] = c.score;
      frame.faceBlendshapes = shapes;
    }

    return frame;
  }

  close(): void {
    this.hand?.close();
    this.pose?.close();
    this.face?.close();
    this.hand = null;
    this.pose = null;
    this.face = null;
    this._ready = false;
  }
}

let sharedCapture: Capture | null = null;
let sharedCaptureInit: Promise<Capture> | null = null;

/**
 * Module-level singleton so the MediaPipe WASM runtime + hand/pose models download and
 * initialize ONCE per app session. Previously every lesson/practice/story page created its own
 * Capture and closed it on unmount, so re-entering a lesson re-did the full CDN fetch + model
 * init every time. Callers can also fire this early (e.g. on app mount) so the download overlaps
 * with onboarding/home-screen browsing instead of blocking "Start Signing".
 */
export function getSharedCapture(): Promise<Capture> {
  if (!sharedCaptureInit) {
    sharedCapture = new Capture();
    sharedCaptureInit = sharedCapture.init().then(() => sharedCapture!);
  }
  return sharedCaptureInit;
}
