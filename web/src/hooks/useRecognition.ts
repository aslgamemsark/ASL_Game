import { useRef, useState, useCallback, useEffect } from 'react';
import { Capture, getSharedCapture } from '@/engine/capture';
import { RollingBuffer, HandStabilizer, type Frame } from '@/engine/landmarks';
import { verify, type VerifyResult, resultPassed } from '@/engine/verifier';
import { gateOutcome, gateHint, type GateDecision, type ClassifierVote } from '@/engine/gate';
import { topK, type SignClassifier } from '@/engine/classifier';
import { GATE_CONFIDENCE, GATE_ENFORCED, GATE_EXCLUDED_SIGNS } from '@/config/classifier';
import { MovementKind, type Sign } from '@/engine/schema';
import { clip } from '@/engine/math-utils';
import { track, type ScreenName } from '@/analytics';
import { speakSign } from '@/lib/speak';

// Static signs (movement.kind === NONE) have no motion scorer to naturally pace a pass —
// scoreMovement returns 1 immediately for them — so without an explicit hold requirement a
// fleeting, accidentally-correct handshape could pass the instant the smoothing window clears.
// Signs WITH real movement don't need this: MovementReq.minDurationS already requires their
// trajectory to develop over time, so the short frame-debounce (PASS_THRESHOLD, below) is
// enough there to filter single-frame noise.
const STATIC_HOLD_SECONDS = 2.0;

export type RecognitionStatus = 'loading' | 'ready' | 'running' | 'error';

/** Live camera-framing feedback derived from the pose landmarks already computed each frame — used
 *  by the first-run camera-position guide. `ok` means the user is well framed (face centered, a
 *  reasonable distance, chest visible below). All thresholds are ratios of the frame, so they hold
 *  regardless of resolution. */
export interface FramingStatus {
  ok: boolean;
  message: string;
}

/**
 * Thresholds calibrated 2026-07-27 against 27,110 frames from attempts the rule verifier ACTUALLY
 * PASSED (`training_samples` where rule_passed), not from intuition. The previous set rejected
 * 81.1% of those known-good frames — it was describing a webcam headshot, not a signing space.
 *
 * Measured on known-good frames — shoulder-width median 0.409 (p05 0.289, p95 0.607), mouth
 * median 0.641, shoulder-height median 0.810 — and each old rule's false-positive rate:
 *   "Raise your camera a touch"  77.0%  ← removed outright, see below
 *   "Come a little closer"       11.8%  ← 0.32 sat above the p05 of people signing successfully
 *   "Center yourself in the box"  2.2%  ← kept as-is
 *   "Move back a little"          0.1%  ← kept as-is
 * The replacement set below passes 94% of the same frames.
 */
const FRAMING = {
  /** Below this, pose/hand landmarks genuinely start dropping out. p05 of successful frames is
   *  0.289, so 0.28 sits just under the real working range instead of inside it. */
  minShoulderWidthRatio: 0.28,
  maxShoulderWidthRatio: 0.8,
  maxCenterOffset: 0.16,
  /** Shoulders this low leave no room for chest-level signs. PLEASE is the lowest sign we teach —
   *  its hands sit BELOW the shoulder line (median +0.036 of frame height) and 2.93% of its hand
   *  points already fall off the bottom edge. Advisory only: it never blocks `ok`, because 18% of
   *  known-good frames are lower than this and those signs still passed. */
  chestRoomShoulderY: 0.92,
} as const;

/** Exported for the calibration regression test in tests/framing.test.ts — not part of the hook's
 *  public surface; consumers read `framing` off the hook's return value. */
export function computeFraming(frame: Frame): FramingStatus {
  const { leftShoulder, rightShoulder, width, height } = frame;
  // The only condition that genuinely stops recognition: no pose at all.
  if (!width || !height || !leftShoulder || !rightShoulder) {
    return { ok: false, message: 'Step into view so I can see you' };
  }
  const shoulderWidthRatio = Math.abs(leftShoulder[0] - rightShoulder[0]) / width;
  const midX = ((leftShoulder[0] + rightShoulder[0]) / 2) / width;
  const centerOffset = Math.abs(midX - 0.5);
  const shoulderYRatio = ((leftShoulder[1] + rightShoulder[1]) / 2) / height;

  if (shoulderWidthRatio > FRAMING.maxShoulderWidthRatio) return { ok: false, message: 'Move back a little' };
  if (shoulderWidthRatio < FRAMING.minShoulderWidthRatio) return { ok: false, message: 'Come a little closer' };
  if (centerOffset > FRAMING.maxCenterOffset) return { ok: false, message: 'Center yourself in the box' };

  // Deliberately ok:true — a tip, not a correction. The old rule here ("Raise your camera a touch")
  // fired on 77% of known-good frames, hit all 10 users who ever reached a camera, is unactionable
  // on a laptop whose webcam is fixed to the lid, and pushed users to frame HIGHER — which crops
  // the chest and makes exactly the chest-level signs it should protect harder to perform.
  if (shoulderYRatio > FRAMING.chestRoomShoulderY) {
    return { ok: true, message: 'Sit back a little so your chest is in view' };
  }
  return { ok: true, message: 'Perfect — hold it there ✓' };
}

/** Decision for one verification event, for telemetry — see onVerified below. */
export type VerificationDecision = 'pass' | 'veto' | 'no-classifier';

export interface VerificationEntry {
  signName: string;
  params: VerifyResult['params'];
  vote: ClassifierVote | null;
  decision: VerificationDecision;
}

/**
 * One persisted attempt — fired whenever the rule verifier clears its pass threshold (whether
 * or not the AI gate then vetoes it), so analytics/training-data capture sees every real
 * attempt, not just final successes.
 */
export interface AttemptRecord {
  signId: string;
  rulePassed: boolean;
  aiPrediction: string | null;
  aiConfidence: number | null;
  aiVetoed: boolean;
  finalPassed: boolean;
  frames: Frame[];
  /** Ms since this sign's recognition loop started — how long the user was trying this sign. */
  durationMs: number;
  /** 1-indexed count of attempts at this sign since the loop last (re)started for it. */
  attemptNumber: number;
}

interface UseRecognitionOpts {
  onPass?: (result: VerifyResult) => void;
  /** Optional ML disambiguation layer. When absent/disabled, rules alone decide (today's behavior). */
  classifier?: SignClassifier | null;
  /** Additive coaching hint when the model confidently sees a different sign. */
  onHint?: (msg: string | null) => void;
  /** Fired for every gate decision (vote + top-k + pass/veto) — for debug logging/overlays. */
  onVote?: (decision: GateDecision) => void;
  /**
   * Fired for every rule-pass event (both PASS and VETO — never for an ordinary rule-fail,
   * since that's every other frame and not worth logging), carrying the full per-parameter
   * score breakdown plus the classifier's vote when available. Intended for telemetry (see
   * useProgressSync.logVerification) to find real "the rule passed something questionable"
   * cases from actual play, not just a manual calibration session.
   */
  onVerified?: (entry: VerificationEntry) => void;
  /** Fired for every recognized attempt (rule-pass, with or without AI gating) — for analytics/training-data capture. */
  onAttempt?: (attempt: AttemptRecord) => void;
  /** Min model probability for the prompted sign to allow a pass. */
  gateConfidence?: number;
  /** Which screen mounted this loop — labels the sign_attempt/framing_check analytics events
   *  (see analytics/types.ts). Every caller should pass its own screen name; recognition itself
   *  stays screen-agnostic otherwise. */
  screen?: ScreenName;
}

export function useRecognition(opts?: UseRecognitionOpts) {
  const captureRef = useRef<Capture | null>(null);
  const bufferRef = useRef(new RollingBuffer(2.0));
  const stabilizerRef = useRef(new HandStabilizer(0.3));
  const rafRef = useRef<number>(0);
  const signRef = useRef<Sign | null>(null);
  const runningRef = useRef(false);
  const [status, setStatus] = useState<RecognitionStatus>('loading');
  const [result, setResult] = useState<VerifyResult | null>(null);
  // Framing feedback for the camera-position guide. Deduped by message (see the tick loop) so it
  // doesn't setState on every one of the ~28 frames/sec — only when the guidance actually changes.
  const [framing, setFraming] = useState<FramingStatus | null>(null);
  const framingMsgRef = useRef<string | null>(null);
  // 0..1 while a static (no-movement) sign's pose is being held toward STATIC_HOLD_SECONDS; null
  // when not currently holding or when the current sign has real movement (that case is paced by
  // the movement scorer itself, not a hold timer — see the constant's comment above).
  const [holdProgress, setHoldProgress] = useState<number | null>(null);
  const passCallbackRef = useRef(opts?.onPass);
  passCallbackRef.current = opts?.onPass;
  const hintCallbackRef = useRef(opts?.onHint);
  hintCallbackRef.current = opts?.onHint;
  const voteCallbackRef = useRef(opts?.onVote);
  voteCallbackRef.current = opts?.onVote;
  const verifiedCallbackRef = useRef(opts?.onVerified);
  verifiedCallbackRef.current = opts?.onVerified;
  const attemptCallbackRef = useRef(opts?.onAttempt);
  attemptCallbackRef.current = opts?.onAttempt;
  const classifierRef = useRef<SignClassifier | null | undefined>(opts?.classifier);
  classifierRef.current = opts?.classifier;
  // Veto threshold: the classifier only overrides a rule-pass when it's at least this confident
  // the user signed a DIFFERENT sign. Defaults to the config value (GATE_CONFIDENCE, 0.7) so a
  // low-confidence guess can't reject a correct sign — previously hardcoded 0.5, which let a
  // ~53% guess wrongly veto correct attempts.
  const gateConfRef = useRef(opts?.gateConfidence ?? GATE_CONFIDENCE);
  gateConfRef.current = opts?.gateConfidence ?? GATE_CONFIDENCE;
  const gatingRef = useRef(false);
  const frameCountRef = useRef(0);
  const screenRef = useRef<ScreenName | undefined>(opts?.screen);
  screenRef.current = opts?.screen;
  // When the loop (re)started, and how many attempts have fired since — reset alongside the other
  // per-sign state in startLoop/setSign so sign_attempt's duration_ms/attempt_number are always
  // relative to the CURRENT sign, not a previous one in the same session.
  const loopStartRef = useRef(0);
  const attemptCountRef = useRef(0);

  const init = useCallback(async () => {
    if (captureRef.current?.ready) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      const cap = await getSharedCapture();
      captureRef.current = cap;
      if (import.meta.env.DEV) console.log('[QuickSign] MediaPipe initialized');
      setStatus('ready');
    } catch (e) {
      console.error('[QuickSign] MediaPipe init failed:', e);
      setStatus('error');
    }
  }, []);

  const startLoop = useCallback(
    (video: HTMLVideoElement, sign: Sign) => {
      // Always stop previous loop first
      cancelAnimationFrame(rafRef.current);
      runningRef.current = false;

      signRef.current = sign;
      bufferRef.current.clear();
      stabilizerRef.current.reset();
      setResult(null);
      setHoldProgress(null);
      frameCountRef.current = 0;
      loopStartRef.current = performance.now();
      attemptCountRef.current = 0;

      const cap = captureRef.current;
      if (!cap?.ready) {
        // DEV-gated to match the other diagnostics in this file (lines below) — this is an
        // expected transient state during camera warm-up, not a production-worthy console warning.
        if (import.meta.env.DEV) console.warn('[QuickSign] Capture not ready, cannot start loop');
        return;
      }

      runningRef.current = true;
      setStatus('running');
      if (import.meta.env.DEV) console.log('[QuickSign] Loop started for', sign.name);

      // Let the rolling buffer fill before allowing a pass — prevents instant passes on static
      // signs and gives movement signs time to accumulate trajectory data — then require the
      // verifier to stay cleared briefly so a single fluke frame can't pass.
      //
      // Both gates are expressed in TIME, not frame counts (changed 2026-08-18). The processing
      // rate is adaptive now (see the governor below), and a frame-count gate silently scales with
      // it — 30 frames is 1.07s at 28fps but 2.5s at 12fps, i.e. it would have made signs hardest
      // to pass on exactly the slow devices that trigger the backoff. These values are the old
      // frame counts converted at the original fixed 28fps, so the feel is unchanged on any device
      // that never backs off.
      const MIN_MS_BEFORE_PASS = 1070; // was 30 frames @ 28fps
      const PASS_DEBOUNCE_MS = 215;    // was 6 frames @ 28fps
      let passStreakStartMs: number | null = null;
      const isStaticSign = sign.movement.kind === MovementKind.NONE;
      let holdStartMs: number | null = null;
      // Grace window (added 2026-08-31, launch-readiness audit): a hold in progress used to reset
      // to zero on the very next frame that didn't clear the verifier — a blink, a hand
      // momentarily leaving frame, or a single misread landmark could discard up to 1.9s of a real
      // 2s hold. That is a plausible silent activation killer for a first-timer who has never held
      // a static handshape steady for a camera before. Tolerating a brief gap (frames keep failing
      // for up to HOLD_GRACE_MS) without resetting holdStartMs means the elapsed-time math still
      // includes that gap once clearing resumes — mildly generous, but the 2s floor itself is
      // untouched, so this cannot turn a fleeting, accidentally-correct handshape into a pass; it
      // only protects an already-in-progress genuine hold from one bad frame.
      const HOLD_GRACE_MS = 300;
      let holdGraceDeadlineMs: number | null = null;

      // Pose runs at a FRACTION of the hand rate (2026-08-18). PoseLandmarker is a second full
      // model inference on top of HandLandmarker every processed frame, and it is only read for
      // shoulder width (scale normalization), shoulder centre (framing) and mouth position (CHIN-
      // anchored signs) — all properties of where the signer's BODY is, which changes on the
      // order of seconds, not the ~36ms the hands do. Running it every 3rd frame removes roughly
      // a third of total inference cost for no measurable loss: the values are carried forward on
      // the frames in between, so every frame still has a complete pose for the verifier.
      //
      // Worst case a carried-forward shoulder is ~107ms stale (3 frames at 28fps); a real
      // orientation change also resets frame dimensions, and this self-corrects on the next pose
      // frame. DominantHandCheck already skipPose's unconditionally for the same reasoning.
      const POSE_EVERY_N = 3;
      let processedCount = 0;
      let lastPose: Pick<Frame, 'leftShoulder' | 'rightShoulder' | 'mouth'> | null = null;

      // Cap MediaPipe processing to ~28fps instead of raw display refresh rate (60-120fps on most
      // mobile screens) — halves battery/thermal load with no effect on the rolling-window
      // verifier, which windows by elapsed time, not frame count.
      //
      // Adaptive: if actual per-tick MediaPipe inference time (hand + pose landmarkers) keeps
      // eating most of that 28fps budget, the device genuinely can't sustain this rate — every
      // tick then blocks the main thread for close to (or longer than) the gap between ticks,
      // which is what "laggy/unusable" looks like from the inside, since input handling and the
      // rest of the page's rendering starve too. Backing the target off toward TARGET_FPS_MIN
      // trades recognition temporal resolution for a main thread that actually keeps up. Never
      // recovers back up mid-session — deliberately simple, since a struggling device doesn't get
      // faster mid-lesson and oscillating the target would cost more than it buys.
      const TARGET_FPS_MAX = 28;
      const TARGET_FPS_MIN = 12;
      let frameIntervalMs = 1000 / TARGET_FPS_MAX;
      let avgProcessMs = 0;
      let lastProcessMs = 0;
      // DEV-only pipeline telemetry: inference cost against the frame budget it has to fit inside
      // is the pair of numbers that actually diagnoses a "laggy camera" report. Throttled to one
      // line per 5s so it can be left running while playing; compiled out of production builds.
      let lastPerfLogMs = 0;

      // Throttle the REACT STATE publish of the per-frame verify() result to 10Hz — a continuous
      // score stream (not a discrete message like `framing` above, which dedupes by equality
      // instead) has no single "did it change" boundary, so the fix here is rate, not equality.
      // 10Hz is not arbitrary: ParameterChecklist's hold-progress bar already animates with a
      // 100ms linear transition, so a new target arrives right as the previous one finishes —
      // smooth, continuous motion with no dead time. Found 2026-07-30: `setResult` was firing on
      // every processed frame (28/sec) with a brand-new object every time (verify() never returns
      // the same reference twice), forcing every page that reads `result` — and everything below
      // it in the tree, since there is no React.memo anywhere in this codebase — to re-render the
      // whole screen 28 times a second for the full duration of every lesson/practice/story/speed/
      // multiplayer round. The synchronous pass/fail logic below (`resultPassed(vr)`, `firePass()`)
      // still reads the FRESH untouched `vr` every tick — only the React-visible publish is paced.
      const RESULT_UPDATE_INTERVAL_MS = 1000 / 10;
      let lastResultUpdateMs = 0;
      // Same throttle, tracked independently — holdProgress and result are two separate signals
      // that happen to update in the same tick, not one derived from the other.
      let lastHoldUpdateMs = 0;

      const tick = () => {
        if (!runningRef.current || !signRef.current) return;

        if (video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const nowMs = performance.now();
        if (nowMs - lastProcessMs < frameIntervalMs) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        lastProcessMs = nowMs;

        try {
          const tsMs = performance.now();
          const wantPose = processedCount % POSE_EVERY_N === 0;
          processedCount++;
          let frame = cap.process(video, Math.round(tsMs), { skipPose: !wantPose });
          if (wantPose) {
            // Only cache a pose we actually got — a frame where the body wasn't detected must not
            // wipe the last good one, or the carried-forward frames would lose it too.
            if (frame.leftShoulder && frame.rightShoulder) {
              lastPose = {
                leftShoulder: frame.leftShoulder,
                rightShoulder: frame.rightShoulder,
                mouth: frame.mouth,
              };
            }
          } else if (lastPose) {
            frame.leftShoulder = lastPose.leftShoulder;
            frame.rightShoulder = lastPose.rightShoulder;
            frame.mouth = lastPose.mouth;
          }
          const processDurationMs = performance.now() - tsMs;
          avgProcessMs = avgProcessMs === 0 ? processDurationMs : avgProcessMs * 0.9 + processDurationMs * 0.1;
          if (avgProcessMs > frameIntervalMs * 0.8 && frameIntervalMs < 1000 / TARGET_FPS_MIN) {
            frameIntervalMs = Math.min(frameIntervalMs * 1.15, 1000 / TARGET_FPS_MIN);
          }
          if (import.meta.env.DEV && nowMs - lastPerfLogMs > 5000) {
            lastPerfLogMs = nowMs;
            console.log(
              `[QuickSign] inference ~${avgProcessMs.toFixed(1)}ms/frame · budget ${frameIntervalMs.toFixed(0)}ms ` +
              `(${(1000 / frameIntervalMs).toFixed(0)}fps target) · pose every ${POSE_EVERY_N}`
            );
          }
          frame = stabilizerRef.current.stabilize(frame);
          bufferRef.current.add(frame);
          frameCountRef.current++;

          // Update framing guidance only when the message changes, to avoid 28 setStates/sec. The
          // same dedup boundary doubles as the analytics sample point — one framing_check per
          // actual guidance change, never per frame.
          const f = computeFraming(frame);
          if (f.message !== framingMsgRef.current) {
            framingMsgRef.current = f.message;
            setFraming(f);
            if (screenRef.current) {
              track('framing_check', { ok: f.ok, reason: f.ok ? null : f.message, screen: screenRef.current });
            }
          }

          const vr = verify(bufferRef.current, signRef.current);
          if (nowMs - lastResultUpdateMs >= RESULT_UPDATE_INTERVAL_MS) {
            lastResultUpdateMs = nowMs;
            setResult(vr);
          }

          // Log first few frames for debugging
          if (import.meta.env.DEV && frameCountRef.current <= 3) {
            const hands = frame.hands.length;
            const sw = frame.leftShoulder && frame.rightShoulder ? 'yes' : 'no';
            console.log(`[QuickSign] Frame ${frameCountRef.current}: hands=${hands} shoulders=${sw} w=${frame.width}`);
          }

          // Fires one pass event: gates through the ML classifier when available, otherwise
          // passes on rules alone. Shared by both the static-hold path and the movement
          // frame-debounce path below — the two differ only in WHEN this gets called.
          const firePass = () => {
            const cls = classifierRef.current;
            if (cls?.enabled && cls.knownSigns.has(sign.name) && !GATE_EXCLUDED_SIGNS.has(sign.name)) {
              // Gate the rule-pass through the ML classifier (single inference at pass time).
              if (!gatingRef.current) {
                gatingRef.current = true;
                const snapshot = bufferRef.current.frames;
                const gatedSign = signRef.current;
                cls.classify(snapshot)
                  .then((vote) => {
                    if (!gatedSign) return;
                    const { passed, modelVetoed } = gateOutcome(true, vote, gatedSign.name, gateConfRef.current);
                    // Suppressed whenever the learner passed — a "that looked more like X" note
                    // next to a success is contradictory, and in shadow mode every attempt the
                    // model disliked still passes.
                    const hint = passed ? null : gateHint(vote, gatedSign.name);
                    voteCallbackRef.current?.({
                      prompted: gatedSign.name,
                      vote,
                      decision: modelVetoed ? 'veto' : 'pass',
                      enforced: GATE_ENFORCED,
                      topK: vote ? topK(vote, 3) : [],
                      hint,
                    });
                    verifiedCallbackRef.current?.({
                      signName: gatedSign.name,
                      params: vr.params,
                      vote,
                      decision: modelVetoed ? 'veto' : 'pass',
                    });
                    attemptCountRef.current += 1;
                    attemptCallbackRef.current?.({
                      signId: gatedSign.name,
                      rulePassed: true,
                      aiPrediction: vote ? vote.topSign : null,
                      aiConfidence: vote ? vote.confidence : null,
                      // The model's opinion, NOT the learner's result — these diverge in shadow
                      // mode and that divergence is exactly the veto-precision measurement.
                      aiVetoed: modelVetoed,
                      finalPassed: passed,
                      frames: snapshot,
                      durationMs: Math.round(performance.now() - loopStartRef.current),
                      attemptNumber: attemptCountRef.current,
                    });
                    if (passed) {
                      speakSign(gatedSign.name);
                      passCallbackRef.current?.(vr);
                      hintCallbackRef.current?.(null);
                    } else {
                      hintCallbackRef.current?.(hint);
                    }
                  })
                  .catch((e) => console.error('[QuickSign] gate error:', e))
                  .finally(() => { gatingRef.current = false; });
              }
            } else {
              if (import.meta.env.DEV) console.log('[QuickSign] PASS:', sign.name, vr.params.map(p => `${p.name}=${p.score.toFixed(2)}`).join(' '));
              verifiedCallbackRef.current?.({
                signName: sign.name,
                params: vr.params,
                vote: null,
                decision: 'no-classifier',
              });
              attemptCountRef.current += 1;
              attemptCallbackRef.current?.({
                signId: sign.name,
                rulePassed: true,
                aiPrediction: null,
                aiConfidence: null,
                aiVetoed: false,
                finalPassed: true,
                frames: bufferRef.current.frames,
                durationMs: Math.round(performance.now() - loopStartRef.current),
                attemptNumber: attemptCountRef.current,
              });
              speakSign(sign.name);
              passCallbackRef.current?.(vr);
            }
          };

          // Don't allow pass until the buffer has had time to fill
          const clearedEnough = nowMs - loopStartRef.current >= MIN_MS_BEFORE_PASS && resultPassed(vr);

          if (isStaticSign) {
            // Hold-to-pass: the pose must clear the verifier continuously for
            // STATIC_HOLD_SECONDS (wall-clock, not frame count, so it's consistent regardless of
            // any dip in processed framerate) before it counts as a pass.
            if (clearedEnough) {
              holdGraceDeadlineMs = null;
              if (holdStartMs === null) holdStartMs = nowMs;
              const elapsedMs = nowMs - holdStartMs;
              if (nowMs - lastHoldUpdateMs >= RESULT_UPDATE_INTERVAL_MS) {
                lastHoldUpdateMs = nowMs;
                setHoldProgress(clip(elapsedMs / (STATIC_HOLD_SECONDS * 1000), 0, 1));
              }
              if (elapsedMs >= STATIC_HOLD_SECONDS * 1000) {
                holdStartMs = null;
                setHoldProgress(null);
                firePass();
              }
            } else if (holdStartMs !== null) {
              // Mid-hold and this frame didn't clear — within the grace window, so hold onto
              // progress instead of discarding it (see HOLD_GRACE_MS above).
              if (holdGraceDeadlineMs === null) holdGraceDeadlineMs = nowMs + HOLD_GRACE_MS;
              if (nowMs > holdGraceDeadlineMs) {
                holdStartMs = null;
                holdGraceDeadlineMs = null;
                setHoldProgress(null);
              }
            } else {
              setHoldProgress(null);
            }
          } else {
            if (clearedEnough) {
              if (passStreakStartMs === null) passStreakStartMs = nowMs;
              if (nowMs - passStreakStartMs >= PASS_DEBOUNCE_MS) {
                passStreakStartMs = null;
                firePass();
              }
            } else {
              passStreakStartMs = null;
            }
          }
        } catch (e) {
          console.error('[QuickSign] Tick error:', e);
        }

        if (runningRef.current) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    []
  );

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    signRef.current = null;
    setStatus((s) => (s === 'running' ? 'ready' : s));
  }, []);

  const getSnapshot = useCallback((): Frame[] => bufferRef.current.frames, []);

  const setSign = useCallback((sign: Sign) => {
    signRef.current = sign;
    bufferRef.current.clear();
    stabilizerRef.current.reset();
    frameCountRef.current = 0;
    loopStartRef.current = performance.now();
    attemptCountRef.current = 0;
    setResult(null);
    setHoldProgress(null);
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      // Capture is a shared, app-wide singleton now (see getSharedCapture) — don't close it here,
      // that would break every other mounted page still using it.
    };
  }, []);

  return { status, result, framing, holdProgress, init, startLoop, stopLoop, setSign, getSnapshot };
}
