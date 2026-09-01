import { useRef, useState, useCallback, useEffect } from 'react';
import { Capture, getSharedCapture } from '@/engine/capture';
import { RollingBuffer, HandStabilizer, type Frame } from '@/engine/landmarks';
import { verify, type VerifyResult, resultPassed } from '@/engine/verifier';
import { VisionPacer } from '@/engine/visionPacer';
import { gateOutcome, gateHint, type GateDecision, type ClassifierVote } from '@/engine/gate';
import { topK, type SignClassifier } from '@/engine/classifier';
import { GATE_CONFIDENCE, GATE_ENFORCED, GATE_EXCLUDED_SIGNS, isClassifierDebugEnabled } from '@/config/classifier';
import { MovementKind, type Sign } from '@/engine/schema';
import { clip } from '@/engine/math-utils';
import { track, type ScreenName } from '@/analytics';
import { speakSign } from '@/lib/speak';
import { decideAttemptBoundaryOutcome, decideRecognitionOutcome, type AttemptTrigger, type RecognitionOutcomeKind, type RecognitionReason } from '@/lib/recognition/outcome';
import { measureRecognitionEvidence, type RecognitionEvidence } from '@/lib/recognition/evidence';
import { advanceDisputeReadiness, advanceQualityAnnouncement, beginAttempt, cancelAttempt, createAttemptLifecycle, createQualityAnnouncementState, finishAttempt, isFinalizableBoundary, rearmAfterVerifierDisagreement, type RecognitionCameraStatus } from '@/lib/recognition/attemptLifecycle';
import { createExternalStore, type ExternalStore } from './externalStore';

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
 * One explicit attempt boundary: pass, veto, skip, timeout, or real camera interruption.
 * Persistence policy is applied later by useAttemptLog; unscorable records remain analytics-only.
 */
export interface AttemptRecord {
  signId: string;
  rulePassed: boolean;
  aiPrediction: string | null;
  aiConfidence: number | null;
  aiVetoed: boolean;
  finalPassed: boolean;
  trigger: AttemptTrigger;
  outcome: RecognitionOutcomeKind;
  reasons: readonly RecognitionReason[];
  verifier: VerifyResult | null;
  quality: RecognitionEvidence;
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
  // Raw capture evidence stays separate from the verifier buffer: HandStabilizer may add a
  // remembered hand, which helps verification but must never make a missing hand look observed.
  const rawBufferRef = useRef(new RollingBuffer(2.0));
  const stabilizerRef = useRef(new HandStabilizer(0.3));
  const rafRef = useRef<number>(0);
  const signRef = useRef<Sign | null>(null);
  const runningRef = useRef(false);
  const [status, setStatus] = useState<RecognitionStatus>('loading');
  /**
   * External stores for the two 10 Hz signals — the live verify() result and the static-hold
   * progress — consumed via useSyncExternalStore inside small isolated subscribers (LiveSignCoach,
   * ClassifierDevPanel, /calibrate panels). ASL-A1 (round-4 F1+F2): `result` used to ALSO be
   * React state here and holdProgress still was, so every publish re-rendered the owning page's
   * whole tree ~10×/s during signing. The dual channel is gone: these stores are the ONLY
   * React-visible path for either signal, and this hook holds zero page-visible state for them.
   *
   * getSnapshot returns a STABLE null or the last published value (useSyncExternalStore requires
   * referential stability between updates — verify() never repeats a reference, so each publish
   * is genuinely new data).
   */
  const resultStoreRef = useRef<ExternalStore<VerifyResult | null> | null>(null);
  const holdStoreRef = useRef<ExternalStore<number | null> | null>(null);
  if (!resultStoreRef.current || !holdStoreRef.current) {
    resultStoreRef.current = createExternalStore<VerifyResult | null>(null);
    holdStoreRef.current = createExternalStore<number | null>(null);
  }
  const publishResult = useCallback((vr: VerifyResult | null) => {
    // Non-null assertion is safe: the lazy init above ran before any callback can exist.
    resultStoreRef.current!.publish(vr);
  }, []);
  const publishHold = useCallback((progress: number | null) => {
    holdStoreRef.current!.publish(progress);
  }, []);
  // Framing feedback for the camera-position guide. Deduped by message (see the tick loop) so it
  // doesn't setState on every one of the ~28 frames/sec — only when the guidance actually changes.
  const [framing, setFraming] = useState<FramingStatus | null>(null);
  const [qualityAnnouncement, setQualityAnnouncement] = useState<string | null>(null);
  const qualityAnnouncementRef = useRef(createQualityAnnouncementState());
  const [disputeReady, setDisputeReady] = useState(false);
  const disputeReadyRef = useRef(false);
  const framingMsgRef = useRef<string | null>(null);
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
  const lastResultRef = useRef<VerifyResult | null>(null);
  const goodEvidenceSinceRef = useRef<number | null>(null);
  const screenRef = useRef<ScreenName | undefined>(opts?.screen);
  screenRef.current = opts?.screen;
  // When the loop (re)started, and how many attempts have fired since — reset alongside the other
  // per-sign state in startLoop/setSign so sign_attempt's duration_ms/attempt_number are always
  // relative to the CURRENT sign, not a previous one in the same session.
  const loopStartRef = useRef(0);
  const attemptCountRef = useRef(0);
  const lifecycleRef = useRef(createAttemptLifecycle());

  const claimAttempt = useCallback((trigger: AttemptTrigger, token = lifecycleRef.current.token) => {
    const result = finishAttempt(lifecycleRef.current, token, trigger);
    lifecycleRef.current = result.state;
    return result.accepted;
  }, []);

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
      lifecycleRef.current = cancelAttempt(lifecycleRef.current);

      signRef.current = sign;
      bufferRef.current.clear();
      rawBufferRef.current.clear();
      stabilizerRef.current.reset();
      publishResult(null);
      publishHold(null);
      frameCountRef.current = 0;
      lastResultRef.current = null;
      goodEvidenceSinceRef.current = null;
      qualityAnnouncementRef.current = createQualityAnnouncementState();
      setQualityAnnouncement(null);
      disputeReadyRef.current = false;
      setDisputeReady(false);
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
      lifecycleRef.current = beginAttempt(lifecycleRef.current);
      setStatus('running');
      if (import.meta.env.DEV) console.log('[QuickSign] Loop started for', sign.name);

      // Require the loop to have run ~1.07s of wall-clock before allowing a pass.
      // This prevents instant passes on static signs and gives movement signs
      // time to accumulate trajectory data.
      // ASL-A4 (round 4): this was MIN_FRAMES_BEFORE_PASS = 30 — a frame count
      // that silently stretched to 1.5s when VisionPacer dropped slow devices to
      // 20fps, penalising exactly the phones the low tier exists to help. The
      // static-sign hold below already used wall-clock for the same reason; both
      // gates are now clock-based so behaviour is framerate-independent. Threshold
      // VALUES are unchanged at base tier (30 frames @ 28fps ≈ 1.07s) per the
      // CLAUDE.md non-negotiable: no threshold retuning without real-device data.
      const BASE_TIER_MS_PER_FRAME = 1000 / 28;
      const MIN_MS_BEFORE_PASS = 30 * BASE_TIER_MS_PER_FRAME;
      const PASS_DEBOUNCE_MS = 6 * BASE_TIER_MS_PER_FRAME;
      let passStreakStartMs: number | null = null;
      const isStaticSign = sign.movement.kind === MovementKind.NONE;
      let holdStartMs: number | null = null;

      // Pose changes much more slowly than hands. Sample it every third processed frame and carry
      // the last detected pose forward for framing and shoulder-width normalization.
      const POSE_EVERY_N = 3;
      let processedCount = 0;
      let lastPose: Pick<Frame, 'leftShoulder' | 'rightShoulder' | 'mouth'> | null = null;

      // Adaptive vision pacing. Historically a fixed ~28fps cap; since the shipping-readiness
      // v2 round, VisionPacer measures real per-frame inference cost and drops to 20fps when a
      // device demonstrably can't sustain base (see engine/visionPacer.ts for the full policy —
      // one-way per loop session, warmup-gated, latest-frame/no-backlog by construction).
      const pacer = new VisionPacer();
      // Observability for profiling sessions: exposes the live pacer so
      // `window.__qsVisionPacer.tier / .framesProcessed / .medianCost` can be watched while
      // playing. DEV builds always expose it; production/preview builds expose it only when
      // classifier debugging is opted into (?debug=1 or the localStorage flag — see
      // config/classifier.ts), so perf-probe.mjs can measure against `vite preview` (the
      // classifier only loads there) without shipping a always-on global. Zero cost when off.
      if (import.meta.env.DEV || isClassifierDebugEnabled()) {
        (window as unknown as { __qsVisionPacer?: VisionPacer }).__qsVisionPacer = pacer;
      }

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
        if (!pacer.shouldProcess(nowMs)) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        try {
          const t0 = performance.now();
          const tsMs = performance.now();
          const wantPose = processedCount % POSE_EVERY_N === 0;
          processedCount++;
          let frame = cap.process(video, Math.round(tsMs), { skipPose: !wantPose });
          pacer.markProcessed(tsMs);
          if (wantPose) {
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
          // Copy raw hands before HandStabilizer can add remembered hands. Carried pose is
          // intentional because pose inference is skipped on two out of three frames.
          rawBufferRef.current.add({
            ...frame,
            hands: frame.hands.map((hand) => ({ ...hand, points: hand.points.map((point) => [...point]) })),
            leftShoulder: frame.leftShoulder && [...frame.leftShoulder],
            rightShoulder: frame.rightShoulder && [...frame.rightShoulder],
            mouth: frame.mouth && [...frame.mouth],
          });
          frame = stabilizerRef.current.stabilize(frame);
          bufferRef.current.add(frame);
          pacer.recordCost(performance.now() - t0);
          frameCountRef.current++;

          // Update framing guidance only when the message changes, to avoid 28 setStates/sec. The
          // same dedup boundary doubles as the analytics sample point — one framing_check per
          // actual guidance change, never per frame.
          const f = computeFraming(frame);
          const nextAnnouncement = advanceQualityAnnouncement(
            qualityAnnouncementRef.current,
            f.ok ? null : f.message,
            nowMs
          );
          if (nextAnnouncement.announced !== qualityAnnouncementRef.current.announced) {
            setQualityAnnouncement(nextAnnouncement.announced);
          }
          qualityAnnouncementRef.current = nextAnnouncement;
          if (f.message !== framingMsgRef.current) {
            framingMsgRef.current = f.message;
            setFraming(f);
            if (screenRef.current) {
              track('framing_check', { ok: f.ok, reason: f.ok ? null : f.message, screen: screenRef.current });
            }
          }

          const vr = verify(bufferRef.current, signRef.current);
          lastResultRef.current = vr;
          const rawFrame = rawBufferRef.current.end;
          const hasRequiredRawHands = !!rawFrame && rawFrame.hands.length >= (sign.twoHanded ? 2 : 1);
          const hasGoodRawEvidence = !!rawFrame && hasRequiredRawHands && computeFraming(rawFrame).ok;
          const dispute = advanceDisputeReadiness(
            goodEvidenceSinceRef.current,
            nowMs,
            lifecycleRef.current,
            resultPassed(vr),
            hasGoodRawEvidence
          );
          goodEvidenceSinceRef.current = dispute.sinceMs;
          if (dispute.ready !== disputeReadyRef.current) {
            disputeReadyRef.current = dispute.ready;
            setDisputeReady(dispute.ready);
          }
          if (nowMs - lastResultUpdateMs >= RESULT_UPDATE_INTERVAL_MS) {
            lastResultUpdateMs = nowMs;
            // Dual publish: React state for legacy consumers + external store for the isolated
            // live-checklist subscription (see resultStoreRef above).
            publishResult(vr);
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
            if (lifecycleRef.current.status !== 'active') return;
            const attemptToken = lifecycleRef.current.token;
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
                    const trigger = passed ? 'recognition_pass' : 'classifier_veto';
                    if (!claimAttempt(trigger, attemptToken)) return;
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
                      trigger,
                      outcome: decideRecognitionOutcome({ recognitionPassed: passed, scorable: true, reasons: [] }).kind,
                      reasons: [],
                      verifier: vr,
                      quality: measureRecognitionEvidence(rawBufferRef.current.frames, gatedSign),
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
              if (!claimAttempt('recognition_pass', attemptToken)) return;
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
                trigger: 'recognition_pass',
                outcome: 'PASS',
                reasons: [],
                verifier: vr,
                quality: measureRecognitionEvidence(rawBufferRef.current.frames, sign),
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
          if (!clearedEnough) {
            lifecycleRef.current = rearmAfterVerifierDisagreement(lifecycleRef.current);
          }

          if (isStaticSign) {
            // Hold-to-pass: the pose must clear the verifier continuously for
            // STATIC_HOLD_SECONDS (wall-clock, not frame count, so it's consistent regardless of
            // any dip in processed framerate) before it counts as a pass.
            if (clearedEnough) {
              if (holdStartMs === null) holdStartMs = nowMs;
              const elapsedMs = nowMs - holdStartMs;
              if (nowMs - lastHoldUpdateMs >= RESULT_UPDATE_INTERVAL_MS) {
                lastHoldUpdateMs = nowMs;
                publishHold(clip(elapsedMs / (STATIC_HOLD_SECONDS * 1000), 0, 1));
              }
              if (elapsedMs >= STATIC_HOLD_SECONDS * 1000) {
                holdStartMs = null;
                publishHold(null);
                firePass();
              }
            } else {
              holdStartMs = null;
              publishHold(null);
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
    [claimAttempt, publishResult, publishHold]
  );

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setStatus((s) => (s === 'running' ? 'ready' : s));
  }, []);

  const getSnapshot = useCallback((): Frame[] => bufferRef.current.frames, []);

  const finalizeAttempt = useCallback((trigger: AttemptTrigger, cameraStatus: RecognitionCameraStatus = 'active'): AttemptRecord | null => {
    const sign = signRef.current;
    if (!sign || !isFinalizableBoundary(trigger, cameraStatus) || !claimAttempt(trigger)) return null;
    const cameraReason: RecognitionReason | null = cameraStatus === 'stalled'
      ? 'CAMERA_STALLED'
      : cameraStatus === 'active'
        ? null
        : 'CAMERA_UNAVAILABLE';
    const outcome = trigger === 'camera_interruption' || cameraReason
      ? decideAttemptBoundaryOutcome(cameraReason ?? 'CAMERA_UNAVAILABLE')
      : decideRecognitionOutcome({ recognitionPassed: false, scorable: true, reasons: [] });
    attemptCountRef.current += 1;
    const attempt: AttemptRecord = {
      signId: sign.name,
      rulePassed: false,
      aiPrediction: null,
      aiConfidence: null,
      aiVetoed: false,
      finalPassed: false,
      trigger,
      outcome: outcome.kind,
      reasons: outcome.reasons,
      verifier: lastResultRef.current,
      quality: measureRecognitionEvidence(rawBufferRef.current.frames, sign),
      frames: bufferRef.current.frames,
      durationMs: Math.round(performance.now() - loopStartRef.current),
      attemptNumber: attemptCountRef.current,
    };
    attemptCallbackRef.current?.(attempt);
    return attempt;
  }, [claimAttempt]);

  const disputeAttempt = useCallback(() => {
    const sign = signRef.current;
    if (!sign || !disputeReadyRef.current || !screenRef.current) return false;
    const result = lastResultRef.current;
    const required = result?.params.filter((param) => param.required) ?? [];
    const quality = measureRecognitionEvidence(rawBufferRef.current.frames, sign);
    track('recognition_disputed', {
      sign_id: sign.name,
      screen: screenRef.current,
      verifier_passed: false,
      sustained_disagreement_ms: 5000,
      lowest_parameter: required.reduce<(typeof required)[number] | null>((lowest, param) => (
        !lowest || param.score < lowest.score ? param : lowest
      ), null)?.name ?? null,
      lowest_parameter_score: required.length ? Math.min(...required.map((param) => param.score)) : null,
      raw_hand_coverage: quality.requiredHandCoverage,
      raw_pose_coverage: quality.poseCoverage,
      raw_clipped_frame_ratio: quality.clippedFrameRatio,
    });
    bufferRef.current.clear();
    rawBufferRef.current.clear();
    stabilizerRef.current.reset();
    lastResultRef.current = null;
    lifecycleRef.current = beginAttempt(lifecycleRef.current);
    loopStartRef.current = performance.now();
    goodEvidenceSinceRef.current = null;
    disputeReadyRef.current = false;
    setDisputeReady(false);
    publishResult(null);
    publishHold(null);
    hintCallbackRef.current?.(null);
    return true;
  }, [publishHold, publishResult]);

  /**
   * Subscribe to the 10 Hz live result WITHOUT re-rendering this hook's owner. Intended for
   * `useSyncExternalStore` inside a small isolated component (LiveSignCoach) so the page tree
   * stops re-rendering at 10 Hz — see resultStoreRef above for why this store exists.
   * Stable identities: safe as effect deps.
   */
  const subscribeResult = useCallback((listener: () => void) => {
    return resultStoreRef.current!.subscribe(listener);
  }, []);
  const getResultSnapshot = useCallback(() => resultStoreRef.current!.getSnapshot(), []);

  /** Hold-progress store accessors — same contract as the result pair above. */
  const subscribeHoldProgress = useCallback((listener: () => void) => {
    return holdStoreRef.current!.subscribe(listener);
  }, []);
  const getHoldProgressSnapshot = useCallback(() => holdStoreRef.current!.getSnapshot(), []);

  const setSign = useCallback((sign: Sign) => {
    signRef.current = sign;
    bufferRef.current.clear();
    rawBufferRef.current.clear();
    stabilizerRef.current.reset();
    frameCountRef.current = 0;
    lastResultRef.current = null;
    goodEvidenceSinceRef.current = null;
    disputeReadyRef.current = false;
    setDisputeReady(false);
    loopStartRef.current = performance.now();
    attemptCountRef.current = 0;
    lifecycleRef.current = runningRef.current
      ? beginAttempt(lifecycleRef.current)
      : cancelAttempt(lifecycleRef.current);
    publishResult(null);
    publishHold(null);
  }, [publishResult, publishHold]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      // Capture is a shared, app-wide singleton now (see getSharedCapture) — don't close it here,
      // that would break every other mounted page still using it.
    };
  }, []);

  return { status, framing, qualityAnnouncement, disputeReady, disputeAttempt, init, startLoop, stopLoop, setSign, getSnapshot, finalizeAttempt, subscribeResult, getResultSnapshot, subscribeHoldProgress, getHoldProgressSnapshot };
}
