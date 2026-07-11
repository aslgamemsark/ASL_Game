import { useRef, useState, useCallback, useEffect } from 'react';
import { Capture, getSharedCapture } from '@/engine/capture';
import { RollingBuffer, HandStabilizer, type Frame } from '@/engine/landmarks';
import { verify, type VerifyResult, resultPassed } from '@/engine/verifier';
import { gatePass, gateHint, type GateDecision, type ClassifierVote } from '@/engine/gate';
import { topK, type SignClassifier } from '@/engine/classifier';
import { GATE_CONFIDENCE, GATE_EXCLUDED_SIGNS } from '@/config/classifier';
import type { Sign } from '@/engine/schema';

export type RecognitionStatus = 'loading' | 'ready' | 'running' | 'error';

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

  const init = useCallback(async () => {
    if (captureRef.current?.ready) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      const cap = await getSharedCapture();
      captureRef.current = cap;
      if (import.meta.env.DEV) console.log('[SignUp] MediaPipe initialized');
      setStatus('ready');
    } catch (e) {
      console.error('[SignUp] MediaPipe init failed:', e);
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
      frameCountRef.current = 0;

      const cap = captureRef.current;
      if (!cap?.ready) {
        console.warn('[SignUp] Capture not ready, cannot start loop');
        return;
      }

      runningRef.current = true;
      setStatus('running');
      if (import.meta.env.DEV) console.log('[SignUp] Loop started for', sign.name);

      // Require buffer to fill (~1.5s) before allowing a pass.
      // This prevents instant passes on static signs and gives
      // movement signs time to accumulate trajectory data.
      const MIN_FRAMES_BEFORE_PASS = 30;
      let passFrames = 0;
      const PASS_THRESHOLD = 6;

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

          const vr = verify(bufferRef.current, signRef.current);
          setResult(vr);

          // Log first few frames for debugging
          if (import.meta.env.DEV && frameCountRef.current <= 3) {
            const hands = frame.hands.length;
            const sw = frame.leftShoulder && frame.rightShoulder ? 'yes' : 'no';
            console.log(`[SignUp] Frame ${frameCountRef.current}: hands=${hands} shoulders=${sw} w=${frame.width}`);
          }

          // Don't allow pass until buffer has enough data
          if (frameCountRef.current >= MIN_FRAMES_BEFORE_PASS && resultPassed(vr)) {
            passFrames++;
            if (passFrames >= PASS_THRESHOLD) {
              passFrames = 0;
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
                      attemptCallbackRef.current?.({
                        signId: gatedSign.name,
                        rulePassed: true,
                        aiPrediction: vote ? vote.topSign : null,
                        aiConfidence: vote ? vote.confidence : null,
                        aiVetoed: !passed,
                        finalPassed: passed,
                        frames: snapshot,
                      });
                      if (passed) {
                        passCallbackRef.current?.(vr);
                        hintCallbackRef.current?.(null);
                      } else {
                        hintCallbackRef.current?.(hint);
                      }
                    })
                    .catch((e) => console.error('[SignUp] gate error:', e))
                    .finally(() => { gatingRef.current = false; });
                }
              } else {
                if (import.meta.env.DEV) console.log('[SignUp] PASS:', sign.name, vr.params.map(p => `${p.name}=${p.score.toFixed(2)}`).join(' '));
                verifiedCallbackRef.current?.({
                  signName: sign.name,
                  params: vr.params,
                  vote: null,
                  decision: 'no-classifier',
                });
                attemptCallbackRef.current?.({
                  signId: sign.name,
                  rulePassed: true,
                  aiPrediction: null,
                  aiConfidence: null,
                  aiVetoed: false,
                  finalPassed: true,
                  frames: bufferRef.current.frames,
                });
                passCallbackRef.current?.(vr);
              }
            }
          } else {
            passFrames = 0;
          }
        } catch (e) {
          console.error('[SignUp] Tick error:', e);
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
    setResult(null);
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      // Capture is a shared, app-wide singleton now (see getSharedCapture) — don't close it here,
      // that would break every other mounted page still using it.
    };
  }, []);

  return { status, result, init, startLoop, stopLoop, setSign, getSnapshot };
}
