import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/shared/Button';
import { useCamera } from '@/hooks/useCamera';
import { useAttemptRecorder } from '@/hooks/useAttemptRecorder';
import { useRecognition } from '@/hooks/useRecognition';
import { useClassifier } from '@/hooks/useClassifier';
import { useSounds } from '@/hooks/useSounds';
import { useConfetti } from '@/hooks/useConfetti';
import { LiveSignCoach } from '@/components/lesson/LiveSignCoach';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { WebcamMirror } from '@/components/shared/WebcamMirror';
import { ClassifierDevPanel } from '@/components/shared/ClassifierDevPanel';
import { ReferenceClip } from '@/components/lesson/ReferenceClip';
import { useFirstRunCameraGuide } from '@/hooks/useFirstRunCameraGuide';
import { ReplayCompare } from '@/components/lesson/ReplayCompare';
import { DominantHandCheck } from '@/components/shared/DominantHandCheck';
import { shouldShowHandCheck, markHandCheckDone } from '@/lib/handCheckGate';
import { Zippy } from '@/components/shared/Zippy';
import { pickZippyLine } from '@/data/zippy';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { logSignAttempt, logVerification } from '@/hooks/useProgressSync';
import { useAttemptLog } from '@/hooks/useAttemptLog';
import type { VerificationEntry } from '@/hooks/useRecognition';
import { SIGNS } from '@/data/signs';
import { SIGNS as ENGINE_SIGNS } from '@/engine/signs/index';
import { getSignsDueForReview, pickReceptiveDistractors } from '@/data/spaced-repetition';
import { getShopItem } from '@/data/shop';
import type { VerifyResult } from '@/engine/verifier';
import { track } from '@/analytics';

type Mode = 'loading' | 'menu' | 'handcheck' | 'expressive' | 'receptive' | 'mixed' | 'done';
type CardPhase = 'prompt' | 'result' | 'replay';
type QuestionType = 'expressive' | 'receptive';

interface Props {
  onExit: () => void;
  filterSignIds?: string[];
  autoStartExpressive?: boolean;
  /** Starts the existing multiple-choice practice without requesting a camera. */
  autoStartReceptive?: boolean;
  /** Auto-starts a mixed session: some questions are camera signs, others are multiple choice. */
  autoStartMixed?: boolean;
  /** Extra gold awarded once, only if every sign in the session is passed on the first try. */
  bonusGoldOnPerfect?: number;
  /** Overrides the header title while in expressive/done mode (e.g. "Letter Test"). */
  heading?: string;
}

// Practice covers review, the alphabet test, and true mixed quizzes — none map cleanly onto the
// component's internal question-type ('expressive'/'receptive'), so this reads the heading/props
// the caller already sets (see App.tsx's practice Screen variant) rather than adding a new prop.
function practiceContentType(autoStartMixed: boolean | undefined, heading: string | undefined): 'review' | 'alphabet' | 'mixed' {
  if (autoStartMixed) return 'mixed';
  const h = heading?.toLowerCase() ?? '';
  if (h.includes('alphabet') || h.includes('letter')) return 'alphabet';
  return 'review';
}

export function PracticePage({
 onExit, filterSignIds, autoStartExpressive, autoStartReceptive, autoStartMixed, bonusGoldOnPerfect, heading }: Props) {
  const { signAccuracy, recordSign, addXp, addGold, recordPracticeSession, equippedBorder, setDominantHand } = useUserStore();
  const cosmeticBorderClasses = equippedBorder ? (getShopItem(equippedBorder)?.preview ?? '') : '';
  const { user } = useAuth();
  const { videoRef, status: camStatus, start: startCam, stop: stopCam, getStream } = useCamera('practice');
  const recorder = useAttemptRecorder();
  const [replayEnabled, setReplayEnabled] = useState(
    () => localStorage.getItem('signup-replay-enabled') === '1'
  );
  const [passResult, setPassResult] = useState<VerifyResult | null>(null);
  const sounds = useSounds();
  const { burst, bigCelebration } = useConfetti();
  // Auto-start flows begin in 'loading' (not 'menu') so the mode-choice menu never flashes
  // on screen for a frame before the auto-start effect below replaces it.
  const [mode, setMode] = useState<Mode>(() => (autoStartExpressive || autoStartReceptive || autoStartMixed) ? 'loading' : 'menu');
  // Always shown by default (including "Test from Memory" quiz sessions) — quizzing a learner on
  // a handshape they've never been shown a video of is a bad first experience, not a genuine
  // memory test. "Sign Quiz" on the menu below still lets a user opt into hiding it deliberately.
  const [showClip, setShowClip] = useState(true);
  const [queue, setQueue] = useState<string[]>([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [itemTypes, setItemTypes] = useState<QuestionType[]>([]);
  const [cardPhase, setCardPhase] = useState<CardPhase>('prompt');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [goldAwarded, setGoldAwarded] = useState(0);
  // Same gap as LessonPage's skip: silently advancing gave the "coach, don't judge" moment zero
  // acknowledgment. A brief non-blocking toast (ShopPage's pattern) closes it without a full
  // phase transition.
  const [skipMsg, setSkipMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loopStartedRef = useRef<string | null>(null);
  const goldAwardedRef = useRef(false);
  const sessionCompletedTrackedRef = useRef(false);
  // Which mode to enter once the one-time hand check (if shown) resolves — see startExpressive/
  // startMixed below.
  const pendingModeRef = useRef<'expressive' | 'mixed' | null>(null);

  const currentSignId = queue[queueIdx];
  const currentSignData = currentSignId ? SIGNS[currentSignId] : null;
  const currentEngineSign = currentSignId ? ENGINE_SIGNS[currentSignId] : null;
  const allSignIds = Object.keys(SIGNS);
  const currentType: QuestionType | null =
    mode === 'expressive' ? 'expressive'
    : mode === 'receptive' ? 'receptive'
    : mode === 'mixed' ? (itemTypes[queueIdx] ?? 'expressive')
    : null;

  const advanceQueue = useCallback(() => {
    if (queueIdx + 1 < queue.length) {
      setQueueIdx((p) => p + 1);
      setCardPhase('prompt');
    } else {
      setMode('done');
    }
  }, [queueIdx, queue.length]);

  const handlePass = useCallback(
    (result: VerifyResult) => {
      if (currentType !== 'expressive' || cardPhase !== 'prompt') return;
      setCardPhase('result');
      setPassResult(result);
      if (replayEnabled) recorder.stop();
      sounds.correct();
      burst();
      if (currentSignId) {
        recordSign({ signId: currentSignId, mode: 'expressive', correct: true, params: Object.fromEntries(result.params.filter((param) => param.required).map((param) => [param.name, { score: param.score, threshold: param.threshold }])) });
      }
      addXp(5);
      setSessionXp((p) => p + 5);
      setSessionCorrect((p) => p + 1);

      // When replay is on, don't race a hidden auto-advance timer against the "Watch replay"
      // button — that gave people ~1.5s to notice and tap it before the app moved on without
      // asking. Show both choices explicitly instead and wait for a real tap either way.
      if (!replayEnabled) {
        timerRef.current = setTimeout(advanceQueue, 1500);
      }
    },
    [currentType, cardPhase, currentSignId, replayEnabled, recorder, recordSign, addXp, advanceQueue]
  );

  const handleVerified = useCallback(
    (entry: VerificationEntry) => {
      if (user) logVerification(user.id, entry);
    },
    [user]
  );

  // No worldId — Practice deliberately mixes signs across worlds for review.
  const attemptLog = useAttemptLog({ source: 'practice' });

  const { classifier, status: classifierStatus, logVote, lastVote } = useClassifier();
  const recognition = useRecognition({
    onPass: handlePass,
    classifier,
    onVote: logVote,
    onVerified: handleVerified,
    onAttempt: attemptLog.recordAttempt,
    screen: 'practice',
  });
  // startExpressive() below moves past 'menu' into 'expressive' regardless of whether startCam()
  // actually succeeded (a denied/errored/stalled camera isn't a reason to strand the user on the
  // mode-picker) — which means this view is the only place a failure ever becomes visible. Without
  // this check the camera simply never appeared and nothing explained why (matches LessonPage's
  // identically-named guard).
  const cameraUnavailable =
    camStatus === 'denied' || camStatus === 'error' || camStatus === 'stalled' || recognition.status === 'error';
  // First-run only: overlay a camera-framing guide until the user is well positioned.
  const showCamGuide = useFirstRunCameraGuide(recognition.framing?.ok);

  useEffect(() => {
    recognition.init();
  }, [recognition.init]);

  // Start recognition loop for expressive questions (plain expressive mode, or a
  // camera-type question within a mixed session)
  useEffect(() => {
    if (currentType !== 'expressive' || cardPhase !== 'prompt' || cameraUnavailable) {
      // cameraUnavailable also stops: a track dying mid-session (unplugged, iOS mute
      // escalation) must not leave MediaPipe burning CPU on a dead video — same fix as
      // LessonPage. Recovery re-arms via "Try again" → camStatus 'active'.
      if (loopStartedRef.current) {
        recognition.finalizeAttempt('camera_interruption', camStatus);
        recognition.stopLoop();
        loopStartedRef.current = null;
      }
      return;
    }
    if (
      camStatus === 'active' &&
      (recognition.status === 'ready' || recognition.status === 'running') &&
      currentEngineSign &&
      videoRef.current
    ) {
      if (loopStartedRef.current !== currentEngineSign.name) {
        recognition.stopLoop();
        recognition.startLoop(videoRef.current, currentEngineSign);
        loopStartedRef.current = currentEngineSign.name;
        setPassResult(null);
        if (replayEnabled) {
          const stream = getStream();
          if (stream) recorder.start(stream);
        }
      }
    }
  });

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      stopCam();
      recognition.stopLoop();
      recorder.discard();
    };
  }, []);

  // Auto-start for weak signs / letters mode / alphabet "Test from Memory"
  useEffect(() => {
    if (autoStartMixed) {
      startMixed();
    } else if (autoStartExpressive) {
      startExpressive();
    } else if (autoStartReceptive) {
      startReceptive();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startReceptive = () => {
    const pool = filterSignIds ?? (() => {
      const due = getSignsDueForReview(signAccuracy, 8, 'receptive');
      return due.length > 0 ? due : allSignIds.slice(0, 6);
    })();
    recordPracticeSession();
    setQueue([...pool].sort(() => Math.random() - 0.5));
    setQueueIdx(0);
    setCardPhase('prompt');
    setSelectedAnswer(null);
    setSessionXp(0);
    setSessionCorrect(0);
    sessionCompletedTrackedRef.current = false;
    track('practice_session_started', { content_type: 'review', question_count: pool.length });
    setMode('receptive');
  };

  const startExpressive = async () => {
    const pool = filterSignIds ?? (() => {
      const due = getSignsDueForReview(signAccuracy, 8, 'expressive');
      return due.length > 0 ? due : allSignIds.slice(0, 6);
    })();
    recordPracticeSession();
    setQueue([...pool].sort(() => Math.random() - 0.5));
    setQueueIdx(0);
    setCardPhase('prompt');
    setSessionXp(0);
    setSessionCorrect(0);
    setGoldAwarded(0);
    goldAwardedRef.current = false;
    sessionCompletedTrackedRef.current = false;
    loopStartedRef.current = null;
    track('practice_session_started', { content_type: practiceContentType(autoStartMixed, heading), question_count: pool.length });
    const camResult = await startCam();
    if (camResult === 'active' && shouldShowHandCheck()) {
      pendingModeRef.current = 'expressive';
      setMode('handcheck');
    } else {
      setMode('expressive');
    }
  };

  // Mixed session: every question is randomly either a camera sign or a multiple-choice
  // pick, so the same "test yourself" round exercises both recall and recognition.
  const startMixed = async () => {
    const pool = filterSignIds ?? allSignIds;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    recordPracticeSession();
    setQueue(shuffled);
    setItemTypes(shuffled.map((): QuestionType => (Math.random() < 0.5 ? 'expressive' : 'receptive')));
    setQueueIdx(0);
    setCardPhase('prompt');
    setSelectedAnswer(null);
    setSessionXp(0);
    setSessionCorrect(0);
    setGoldAwarded(0);
    goldAwardedRef.current = false;
    sessionCompletedTrackedRef.current = false;
    loopStartedRef.current = null;
    track('practice_session_started', { content_type: 'mixed', question_count: shuffled.length });
    const camResult = await startCam();
    if (camResult === 'active' && shouldShowHandCheck()) {
      pendingModeRef.current = 'mixed';
      setMode('handcheck');
    } else {
      setMode('mixed');
    }
  };

  // Perfect run (every sign passed, none skipped) earns a one-time gold bonus on top of the
  // per-sign XP — only wired up for modes that pass bonusGoldOnPerfect (e.g. the alphabet memory test).
  useEffect(() => {
    if (
      mode === 'done' &&
      bonusGoldOnPerfect &&
      queue.length > 0 &&
      sessionCorrect === queue.length &&
      !goldAwardedRef.current
    ) {
      goldAwardedRef.current = true;
      addGold(bonusGoldOnPerfect);
      setGoldAwarded(bonusGoldOnPerfect);
      bigCelebration();
      sounds.levelUp();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode !== 'done' || sessionCompletedTrackedRef.current) return;
    sessionCompletedTrackedRef.current = true;
    track('practice_session_completed', {
      content_type: practiceContentType(autoStartMixed, heading),
      correct: sessionCorrect,
      total: queue.length,
      xp_earned: sessionXp,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleReceptiveAnswer = (answerId: string) => {
    if (cardPhase !== 'prompt') return;
    setSelectedAnswer(answerId);
    setCardPhase('result');
    const correct = answerId === currentSignId;
    if (correct) { sounds.correct(); burst(); } else { sounds.wrong(); }
    if (currentSignId) {
      recordSign({ signId: currentSignId, mode: 'receptive', correct });
      if (user) logSignAttempt(user.id, currentSignId, correct);
    }
    if (correct) {
      addXp(5);
      setSessionXp((p) => p + 5);
      setSessionCorrect((p) => p + 1);
    }
    timerRef.current = setTimeout(() => {
      if (queueIdx + 1 < queue.length) {
        setQueueIdx((p) => p + 1);
        setCardPhase('prompt');
        setSelectedAnswer(null);
      } else {
        setMode('done');
      }
    }, 1500);
  };

  // Build the multiple-choice options once per question and hold them in state — computing
  // the shuffle inline in JSX re-ran on every render (including the result re-render after
  // an answer is picked), which visibly reshuffled the options right after selection.
  useEffect(() => {
    if (currentType === 'receptive' && currentSignId) {
      // Prefer distractors from the same filtered pool (e.g. other letters) so choices stay
      // in-category; only fall back to the full sign list if that pool is too small.
      const pool = filterSignIds && filterSignIds.length >= 4 ? filterSignIds : allSignIds;
      const options = [currentSignId, ...pickReceptiveDistractors(currentSignId, pool, 3)];
      setQuizOptions(options.sort(() => Math.random() - 0.5));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentType, currentSignId]);

  const handleSkipExpressive = () => {
    setSkipMsg(pickZippyLine('encourage'));
    setTimeout(() => setSkipMsg(null), 2000);
    if (currentSignId) {
      const attempt = recognition.finalizeAttempt('skip', camStatus);
      if (attempt?.outcome !== 'NOT_SCORABLE') recordSign({ signId: currentSignId, mode: 'expressive', correct: false, params: attempt?.verifier ? Object.fromEntries(attempt.verifier.params.filter((param) => param.required).map((param) => [param.name, { score: param.score, threshold: param.threshold }])) : undefined });
    }
    recorder.discard();
    loopStartedRef.current = null;
    if (queueIdx + 1 < queue.length) {
      setQueueIdx((p) => p + 1);
      setCardPhase('prompt');
    } else {
      setMode('done');
    }
  };

  return (
    <div className="min-h-dvh bg-z-bg flex flex-col">
      <p className="sr-only" role="status" aria-live="polite">{recognition.qualityAnnouncement ?? ''}</p>
      {/* Hidden video for MediaPipe */}
      <video
        ref={videoRef}
        style={{ width: 0, height: 0, opacity: 0, position: 'fixed', pointerEvents: 'none' }}
        muted
        playsInline
        autoPlay
      />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton onClick={() => { stopCam(); recognition.stopLoop(); onExit(); }} />
        <h1 className="font-bold text-lg">
          {mode === 'loading'
            ? (heading ?? '')
            : mode === 'menu'
              ? 'Review'
              : mode === 'handcheck'
                ? 'Quick Setup'
                : mode === 'mixed'
                  ? (heading ?? 'Test Yourself')
                  : mode === 'expressive'
                    ? (heading ?? (showClip ? 'Sign It' : 'Sign Quiz'))
                    : mode === 'receptive'
                      ? 'Sign Quiz'
                      : (heading ?? 'Done')}
        </h1>
        {mode !== 'menu' && mode !== 'done' && mode !== 'loading' && mode !== 'handcheck' && (
          <span className="ml-auto text-sm text-z-gray-400">{queueIdx + 1}/{queue.length}</span>
        )}
      </div>

      <div
        className={`flex-1 mx-auto w-full px-4 pb-6 flex flex-col ${
          currentType === 'expressive' && cardPhase === 'prompt' ? 'max-w-lg lg:max-w-6xl' : 'max-w-lg'
        }`}
      >
        <AnimatePresence mode="wait">
          {/* --- LOADING (bridges the gap between mount and auto-start completing) --- */}
          {mode === 'loading' && (
            <motion.div
              key="loading"
              className="flex-1 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="text-4xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                ⚙️
              </motion.div>
            </motion.div>
          )}

          {/* --- MENU --- */}
          {mode === 'menu' && (
            <motion.div
              key="menu"
              className="flex-1 flex flex-col items-center justify-center gap-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Zippy expression="ready" size="md" float />
              <h2 className="text-2xl font-bold mb-2">Choose a mode</h2>

              <motion.button
                onClick={() => { setShowClip(true); startExpressive(); }}
                disabled={recognition.status === 'loading'}
                className="w-full rounded-2xl p-5 text-left border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-primary"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Sign It</h3>
                    <p className="text-white text-sm mt-1">Camera + demo clip to follow along</p>
                  </div>
                  <span className="text-3xl">🤟</span>
                </div>
              </motion.button>

              <motion.button
                onClick={() => { setShowClip(false); startExpressive(); }}
                disabled={recognition.status === 'loading'}
                className="w-full rounded-2xl p-5 text-left bg-z-card border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Sign Quiz</h3>
                    <p className="text-z-gray-300 text-sm mt-1">Camera only — from memory, no clip</p>
                  </div>
                  <span className="text-3xl">🧠</span>
                </div>
              </motion.button>

              {recorder.supported && (
                <label className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-z-card border border-white/5 cursor-pointer">
                  <span className="text-sm text-z-gray-200">
                    Record my attempts for replay
                    <span className="block text-2xs text-z-gray-400">Stays on your device, never uploaded</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={replayEnabled}
                    onChange={(e) => {
                      setReplayEnabled(e.target.checked);
                      localStorage.setItem('signup-replay-enabled', e.target.checked ? '1' : '0');
                    }}
                    className="w-5 h-5 accent-z-purple-light"
                  />
                </label>
              )}
            </motion.div>
          )}

          {/* --- HAND CHECK (one-time, first real camera session — see lib/handCheckGate.ts) --- */}
          {mode === 'handcheck' && (
            <DominantHandCheck
              videoRef={videoRef}
              onConfirm={(hand) => {
                track('dominant_hand_selected', { hand, skipped: false });
                setDominantHand(hand);
                markHandCheckDone();
                setMode(pendingModeRef.current ?? 'expressive');
                pendingModeRef.current = null;
              }}
              onSkip={() => {
                track('dominant_hand_selected', { hand: 'right', skipped: true });
                markHandCheckDone();
                setMode(pendingModeRef.current ?? 'expressive');
                pendingModeRef.current = null;
              }}
            />
          )}

          {/* --- EXPRESSIVE --- */}
          {currentType === 'expressive' && currentSignData && (
            <motion.div
              key={`exp-${queueIdx}`}
              className="flex-1 flex flex-col gap-4 pt-4"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
            >
              {cardPhase === 'prompt' ? (
                <>
                  <div className="text-center py-2">
                    <p className="text-sm text-z-gray-400 mb-1 uppercase tracking-widest">Sign this</p>
                    <h2 className="text-3xl font-bold">{currentSignData.name.replace(/_/g, ' ')}</h2>
                    <p className="text-sm text-z-gray-300 mt-2">{currentSignData.description}</p>
                  </div>

                  {/* Mobile: stacked (clip when shown, camera, stats). Desktop (lg+): reference
                      clip left, webcam center, stats right — same three-column layout as
                      LessonPage, so the "camera setup" reads identically everywhere it appears.
                      Sign Quiz mode (showClip false) deliberately hides the clip column — that's
                      the point of quizzing from memory — so the grid drops to two columns. */}
                  <div
                    className={`flex flex-col gap-4 lg:grid lg:gap-6 lg:items-start ${
                      showClip && currentSignData.clip ? 'lg:grid-cols-[320px_1fr_340px]' : 'lg:grid-cols-[1fr_340px]'
                    }`}
                  >
                    {showClip && currentSignData.clip && (
                      <div className="lg:order-1">
                        <ReferenceClip clipUrl={currentSignData.clip} signName={currentSignData.name} compact />
                      </div>
                    )}

                    <div className="lg:order-2">
                      {cameraUnavailable ? (
                        <div className="rounded-2xl border border-z-red/30 bg-z-red/10 p-4 text-center">
                          <p className="text-sm font-bold text-z-red">
                            {camStatus === 'denied'
                              ? 'Camera access denied'
                              : camStatus === 'stalled'
                                ? "Camera feed isn't showing"
                                : 'Camera unavailable'}
                          </p>
                          <p className="text-xs text-z-gray-300 mt-1">
                            {camStatus === 'denied'
                              ? 'Live coaching needs your camera. Allow camera access in your browser settings, then try again.'
                              : camStatus === 'stalled'
                                ? "Your camera is on but no picture is coming through. Try again, or check that no other app is using it."
                                : 'Something went wrong starting the camera. Try again, or check that no other app is using it.'}
                          </p>
                          {/* stopCam() before startCam() forces a fresh getUserMedia() call instead
                              of reattaching the same (possibly dead) stream — required for the
                              'stalled' case, harmless for the others since stop() on an idle camera
                              is a no-op. */}
                          <button
                            onClick={() => { stopCam(); startCam(); }}
                            className="mt-3 text-xs font-bold text-z-gray-50 bg-z-red/40 hover:bg-z-red/50 px-4 py-2 rounded-lg"
                          >
                            Try again
                          </button>
                          <button
                            onClick={() => { stopCam(); setCardPhase('prompt'); setMode('receptive'); }}
                            className="mt-2 text-xs font-bold text-z-gray-100 underline underline-offset-4 min-h-11 px-3"
                          >
                            Practice without camera
                          </button>
                        </div>
                      ) : (
                        <WebcamMirror
                          videoRef={videoRef}
                          cosmeticBorderClasses={cosmeticBorderClasses}
                          frameGuide={showCamGuide ? recognition.framing : null}
                          aspectClassName="aspect-[var(--cam-ar)] lg:aspect-[4/3]"
                        />
                      )}
                    </div>

                    <div className="lg:order-3">
                      {!cameraUnavailable && (
                        /* Isolated 10 Hz subscriber — see LiveSignCoach/LessonPage notes. */
                        <LiveSignCoach
                          subscribe={recognition.subscribeResult}
                          getSnapshot={recognition.getResultSnapshot}
                          sign={currentEngineSign}
                          subscribeHoldProgress={recognition.subscribeHoldProgress}
                          getHoldProgressSnapshot={recognition.getHoldProgressSnapshot}
                          fillHeight
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end mt-auto pt-2">
                    {recognition.disputeReady && <button onClick={recognition.disputeAttempt} className="text-xs text-z-gray-300 underline underline-offset-4 min-h-11 px-2">Recognition seems wrong</button>}
                    <button
                      onClick={handleSkipExpressive}
                      className="text-xs text-z-gray-400 hover:text-z-gray-200 px-3 py-1.5 rounded-lg border border-z-gray-500/30"
                    >
                      Skip
                    </button>
                  </div>
                </>
              ) : cardPhase === 'replay' && recorder.replayUrl ? (
                <ReplayCompare
                  attemptUrl={recorder.replayUrl}
                  clipUrl={showClip ? currentSignData.clip : undefined}
                  signName={currentSignData.name}
                  hint={currentSignData.hint}
                  params={passResult?.params}
                  sign={currentEngineSign}
                  onContinue={() => {
                    recorder.discard();
                    advanceQueue();
                  }}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Zippy expression="thumbsup" size="md" />
                  <h2 className="text-xl font-bold text-z-green">{pickZippyLine('success')}</h2>
                  <p className="text-z-yellow font-bold">+5 XP</p>
                  {replayEnabled && (
                    <div className="flex flex-col items-center gap-2 mt-2">
                      <button
                        onClick={() => setCardPhase('replay')}
                        disabled={!recorder.replayUrl}
                        className="text-xs text-z-purple-light hover:text-z-gray-50 px-3 py-1.5 rounded-lg border border-z-purple-light/40 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {recorder.replayUrl ? '▶ Watch replay' : 'Preparing replay…'}
                      </button>
                      <button
                        onClick={() => { recorder.discard(); advanceQueue(); }}
                        className="text-xs text-z-gray-300 hover:text-z-gray-50 px-3 py-1.5 rounded-lg border border-z-gray-500/30"
                      >
                        Next word →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* --- RECEPTIVE --- */}
          {currentType === 'receptive' && currentSignData && (
            <motion.div
              key={`rec-${queueIdx}`}
              className="flex-1 flex flex-col gap-5 pt-4"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
            >
              <div className="text-center">
                <p className="text-sm text-z-gray-400 mb-2 uppercase tracking-widest">What sign is this?</p>
              </div>

              {currentSignData.clip && (
                <ReferenceClip clipUrl={currentSignData.clip} signName={cardPhase === 'result' ? currentSignData.name : '???'} />
              )}

              <div className="grid grid-cols-2 gap-3 mt-2">
                {quizOptions.map((id) => {
                  const isCorrect = id === currentSignId;
                  const isSelected = id === selectedAnswer;
                  const showResult = cardPhase === 'result';

                  return (
                    <motion.button
                      key={id}
                      onClick={() => handleReceptiveAnswer(id)}
                      disabled={cardPhase === 'result'}
                      className={`p-4 rounded-2xl font-bold text-sm border-2 transition-all ${
                        showResult
                          ? isCorrect
                            ? 'bg-z-green/20 border-z-green text-z-green'
                            : isSelected
                              ? 'bg-z-red/20 border-z-red text-z-red'
                              : 'bg-z-surface/30 border-z-gray-500/20 text-z-gray-400'
                          : 'bg-z-card border-z-gray-500/20 text-z-gray-50 hover:border-z-purple-light'
                      }`}
                      whileHover={cardPhase === 'prompt' ? { scale: 1.03 } : undefined}
                      whileTap={cardPhase === 'prompt' ? { scale: 0.97 } : undefined}
                    >
                      {SIGNS[id]?.name.replace(/_/g, ' ') ?? id}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* --- DONE --- */}
          {mode === 'done' && (
            <motion.div
              key="done"
              className="flex-1 flex flex-col items-center justify-center gap-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Zippy expression={goldAwarded > 0 ? 'celebrating' : 'proud'} size="lg" />
              <h2 className="text-2xl font-bold">
                {goldAwarded > 0 ? 'Perfect!' : 'Session Complete'}
              </h2>
              <div className="flex gap-8 text-center">
                <div>
                  <p className="text-2xl font-bold text-z-yellow">{sessionXp}</p>
                  <p className="text-xs text-z-gray-400">XP earned</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-z-green">{sessionCorrect}/{queue.length}</p>
                  <p className="text-xs text-z-gray-400">correct</p>
                </div>
                {goldAwarded > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-z-orange-bright">+{goldAwarded}</p>
                    <p className="text-xs text-z-gray-400">gold</p>
                  </div>
                )}
              </div>
              {bonusGoldOnPerfect != null && goldAwarded === 0 && (
                <p className="text-z-gray-400 text-xs -mt-2">
                  Pass every letter without skipping to earn {bonusGoldOnPerfect} gold 🪙
                </p>
              )}
              <Button onClick={onExit} className="mt-4">
                Back to Home
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Always-mounted announcer, separate from the toast's own AnimatePresence-gated div — see
          DESIGN.md "Status messages": a live region must already be in the DOM before its text
          appears, or a screen reader may miss it. */}
      <p className="sr-only" role="status" aria-live="polite">{skipMsg ?? ''}</p>
      <AnimatePresence>
        {skipMsg && (
          <motion.div
            className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-z-card border border-white/10 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl z-overlay flex items-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="w-8 h-8 rounded-xl bg-z-purple overflow-hidden shrink-0">
              <Zippy expression="encouraging" fit="cover" />
            </div>
            {skipMsg}
          </motion.div>
        )}
      </AnimatePresence>
      <ClassifierDevPanel status={classifierStatus} lastVote={lastVote} subscribe={recognition.subscribeResult} getSnapshot={recognition.getResultSnapshot} />
    </div>
  );
}
