import { useRef, useState, useCallback, useEffect } from 'react';
import { Capture, getSharedCapture } from '@/engine/capture';
import { RollingBuffer, HandStabilizer, type Frame } from '@/engine/landmarks';
import { verify, type VerifyResult, resultPassed } from '@/engine/verifier';
import { gatePass, gateHint, type GateDecision, type ClassifierVote } from '@/engine/gate';
import { topK, type SignClassifier } from '@/engine/classifier';
import { GATE_CONFIDENCE, GATE_EXCLUDED_SIGNS } from '@/config/classifier';
import { MovementKind, type Sign } from '@/engine/schema';
import { clip } from '@/engine/math-utils';
import { track, type ScreenName } from '@/analytics';

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

function computeFraming(frame: Frame): FramingStatus {
  const { leftShoulder, rightShoulder, mouth, width, height } = frame;
  if (!width || !height || !leftShoulder || !rightShoulder) {
    return { ok: false, message: 'Step into view so I can see you' };
  }
  const shoulderWidthRatio = Math.abs(leftShoulder[0] - rightShoulder[0]) / width;
  const midX = ((leftShoulder[0] + rightShoulder[0]) / 2) / width;
  const centerOffset = Math.abs(midX - 0.5);
  if (shoulderWidthRatio > 0.8) return { ok: false, message: 'Move back a little' };
  if (shoulderWidthRatio < 0.32) return { ok: false, message: 'Come a little closer' };
  if (centerOffset > 0.16) return { ok: false, message: 'Center yourself in the box' };
  // Keep the face in the upper part of the frame so the chest stays visible below it.
  if (mouth && mouth[1] / height > 0.55) return { ok: false, message: 'Raise your camera a touch' };
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

      // Require buffer to fill (~1.5s) before allowing a pass.
      // This prevents instant passes on static signs and gives
      // movement signs time to accumulate trajectory data.
      const MIN_FRAMES_BEFORE_PASS = 30;
      let passFrames = 0;
      const PASS_THRESHOLD = 6;
      const isStaticSign = sign.movement.kind === MovementKind.NONE;
      let holdStartMs: number | null = null;

      // Cap MediaPipe processing to ~28fps instead of raw display refresh rate (60-120fps on most
      // mobile screens) — halves battery/thermal load with no effect on the rolling-window
      // verifier, which windows by elapsed time, not frame count.
      const MIN_FRAME_INTERVAL_MS = 1000 / 28;
      let lastProcessMs = 0;

      const tick = () => {
        if (!runningRef.current || !signRef.current) return;

        if (video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const nowMs = performance.now();
        if (nowMs - lastProcessMs < MIN_FRAME_INTERVAL_MS) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        lastProcessMs = nowMs;

        try {
          const tsMs = performance.now();
          let frame = cap.process(video, Math.round(tsMs));
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
          setResult(vr);

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
                    const passed = gatePass(true, vote, gatedSign.name, gateConfRef.current);
                    const hint = passed ? null : gateHint(vote, gatedSign.name);
                    voteCallbackRef.current?.({
                      prompted: gatedSign.name,
                      vote,
                      decision: passed ? 'pass' : 'veto',
                      topK: vote ? topK(vote, 3) : [],
                      hint,
                    });
                    verifiedCallbackRef.current?.({
                      signName: gatedSign.name,
                      params: vr.params,
                      vote,
                      decision: passed ? 'pass' : 'veto',
                    });
                    attemptCountRef.current += 1;
                    attemptCallbackRef.current?.({
                      signId: gatedSign.name,
                      rulePassed: true,
                      aiPrediction: vote ? vote.topSign : null,
                      aiConfidence: vote ? vote.confidence : null,
                      aiVetoed: !passed,
                      finalPassed: passed,
                      frames: snapshot,
                      durationMs: Math.round(performance.now() - loopStartRef.current),
                      attemptNumber: attemptCountRef.current,
                    });
                    if (passed) {
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
              passCallbackRef.current?.(vr);
            }
          };

          // Don't allow pass until buffer has enough data
          const clearedEnough = frameCountRef.current >= MIN_FRAMES_BEFORE_PASS && resultPassed(vr);

          if (isStaticSign) {
            // Hold-to-pass: the pose must clear the verifier continuously for
            // STATIC_HOLD_SECONDS (wall-clock, not frame count, so it's consistent regardless of
            // any dip in processed framerate) before it counts as a pass.
            if (clearedEnough) {
              if (holdStartMs === null) holdStartMs = nowMs;
              const elapsedMs = nowMs - holdStartMs;
              setHoldProgress(clip(elapsedMs / (STATIC_HOLD_SECONDS * 1000), 0, 1));
              if (elapsedMs >= STATIC_HOLD_SECONDS * 1000) {
                holdStartMs = null;
                setHoldProgress(null);
                firePass();
              }
            } else {
              holdStartMs = null;
              setHoldProgress(null);
            }
          } else {
            if (clearedEnough) {
              passFrames++;
              if (passFrames >= PASS_THRESHOLD) {
                passFrames = 0;
                firePass();
              }
            } else {
              passFrames = 0;
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
