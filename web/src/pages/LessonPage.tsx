import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/shared/Button';
import { useCamera } from '@/hooks/useCamera';
import { useAttemptRecorder } from '@/hooks/useAttemptRecorder';
import { useRecognition } from '@/hooks/useRecognition';
import { useClassifier } from '@/hooks/useClassifier';
import { useSounds } from '@/hooks/useSounds';
import { useConfetti } from '@/hooks/useConfetti';
import { CameraOnboarding } from '@/components/shared/CameraOnboarding';
import { WebcamMirror } from '@/components/shared/WebcamMirror';
import { ClassifierDevPanel } from '@/components/shared/ClassifierDevPanel';
import { Zippy } from '@/components/shared/Zippy';
import { useFirstRunCameraGuide } from '@/hooks/useFirstRunCameraGuide';
import { pickZippyLine } from '@/data/zippy';
import { LessonHeader } from '@/components/lesson/LessonHeader';
import { LiveSignCoach } from '@/components/lesson/LiveSignCoach';
import { ReferenceClip } from '@/components/lesson/ReferenceClip';
import { ReplayCompare } from '@/components/lesson/ReplayCompare';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { logVerification } from '@/hooks/useProgressSync';
import { useAttemptLog } from '@/hooks/useAttemptLog';
import type { VerificationEntry } from '@/hooks/useRecognition';
import { SIGNS } from '@/data/signs';
import { SIGNS as ENGINE_SIGNS } from '@/engine/signs/index';
import { getLessonById, getUnitIdForLesson } from '@/data/lessons';
import { getWorldIdForUnit } from '@/data/worlds';
import { getShopItem } from '@/data/shop';
import type { VerifyResult } from '@/engine/verifier';
import { track } from '@/analytics';

type Phase = 'intro' | 'signing' | 'success' | 'replay' | 'complete';

interface Props {
  lessonId: string;
  onExit: () => void;
}

export function LessonPage({ lessonId, onExit }: Props) {
  const lesson = getLessonById(lessonId);
  const { addXp, addDailyMinutes, completeLesson, recordSign, equippedBorder, firstLessonCelebrated, markFirstLessonCelebrated } = useUserStore();
  const cosmeticBorderClasses = equippedBorder ? (getShopItem(equippedBorder)?.preview ?? '') : '';
  const { user } = useAuth();
  const { videoRef, status: camStatus, start: startCam, stop: stopCam, getStream } = useCamera('lesson');
  const recorder = useAttemptRecorder();
  const [replayEnabled] = useState(
    () => localStorage.getItem('signup-replay-enabled') === '1'
  );
  const [passResult, setPassResult] = useState<VerifyResult | null>(null);
  const sounds = useSounds();
  const { burst, bigCelebration } = useConfetti();
  const [phase, setPhase] = useState<Phase>('intro');
  const [promptIdx, setPromptIdx] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [successMsg, setSuccessMsg] = useState('Nice work!');
  const [completeMsg, setCompleteMsg] = useState('');
  const [isFirstLessonComplete, setIsFirstLessonComplete] = useState(false);
  // Mirrors correctCount so the ratio can be read the instant phase flips to 'complete' — the
  // setTimeout in handlePass fires advancePrompt with whatever closure it captured, and waiting on
  // the correctCount *state* there would risk reading a value from before the final increment.
  const correctCountRef = useRef(0);
  // A skip previously advanced with zero acknowledgment — the one moment "coach, don't judge"
  // matters most had the coach saying nothing at all. A brief, non-blocking toast (same pattern
  // as ShopPage's) closes that gap without turning Skip into a full phase transition.
  const [skipMsg, setSkipMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const signIds = lesson?.signIds ?? [];
  const currentSignId = signIds[promptIdx];
  const currentSignData = currentSignId ? SIGNS[currentSignId] : null;
  const currentEngineSign = currentSignId ? ENGINE_SIGNS[currentSignId] : null;
  const worldId = getWorldIdForUnit(getUnitIdForLesson(lessonId) ?? '');
  const lessonStartedAtRef = useRef(Date.now());

  // Never shames the low end of the range — just calmer instead of celebratory.
  const pickCompleteMessage = useCallback(() => {
    const ratio = signIds.length > 0 ? correctCountRef.current / signIds.length : 1;
    return ratio >= 1 ? pickZippyLine('lessonCompletePerfect')
      : ratio >= 0.5 ? pickZippyLine('lessonComplete')
      : pickZippyLine('lessonCompleteEncourage');
  }, [signIds.length]);

  // AMPLIFIED_CELEBRATION_* tune the one-time first-lesson-ever moment (longer, denser confetti
  // than a routine lesson finish) — named constants rather than inline magic numbers so the "how
  // much bigger" decision lives in one place.
  const AMPLIFIED_CELEBRATION_DURATION_MS = 1400;
  const AMPLIFIED_CELEBRATION_PARTICLE_COUNT = 6;

  const finishLesson = useCallback(() => {
    const isFirstEver = !firstLessonCelebrated;
    setIsFirstLessonComplete(isFirstEver);
    setCompleteMsg(isFirstEver ? pickZippyLine('firstLessonComplete') : pickCompleteMessage());
    setPhase('complete');
    completeLesson(lessonId);
    track('lesson_completed', {
      lesson_id: lessonId,
      world_id: worldId,
      duration_ms: Date.now() - lessonStartedAtRef.current,
      hints_used: 0, // Lesson has no hint mechanic today (unlike Practice) — 0 is accurate, not a placeholder.
      xp_earned: earnedXp,
    });
    sounds.levelUp();
    if (isFirstEver) {
      bigCelebration(AMPLIFIED_CELEBRATION_DURATION_MS, AMPLIFIED_CELEBRATION_PARTICLE_COUNT);
      markFirstLessonCelebrated();
    } else {
      bigCelebration();
    }
  }, [pickCompleteMessage, completeLesson, lessonId, worldId, earnedXp, sounds, bigCelebration, firstLessonCelebrated, markFirstLessonCelebrated]);

  const advancePrompt = useCallback(() => {
    if (promptIdx + 1 < signIds.length) {
      setPromptIdx((prev) => prev + 1);
      setPhase('signing');
    } else {
      finishLesson();
    }
  }, [promptIdx, signIds.length, finishLesson]);

  const handlePass = useCallback(
    (result: VerifyResult) => {
      if (phase !== 'signing') return;
      setPhase('success');
      setPassResult(result);
      setSuccessMsg(pickZippyLine('success'));
      if (replayEnabled) recorder.stop();
      sounds.correct();
      burst();
      const xp = 10;
      setEarnedXp((prev) => prev + xp);
      setCorrectCount((prev) => prev + 1);
      correctCountRef.current += 1;
      addXp(xp);
      addDailyMinutes(1.5);
      if (currentSignId) {
        recordSign(currentSignId, true);
      }

      // Same reasoning as PracticePage: don't race a hidden auto-advance timer against the
      // "Watch replay" button when replay is on — give an explicit choice instead.
      if (!replayEnabled) {
        timerRef.current = setTimeout(advancePrompt, 1200);
      }
    },
    [phase, currentSignId, addXp, addDailyMinutes, recordSign, replayEnabled, recorder, advancePrompt]
  );

  const handleVerified = useCallback(
    (entry: VerificationEntry) => {
      if (user) logVerification(user.id, entry);
    },
    [user]
  );

  const attemptLog = useAttemptLog({ source: 'lesson', worldId });

  const { classifier, status: classifierStatus, logVote, lastVote } = useClassifier();
  const recognition = useRecognition({
    onPass: handlePass,
    classifier,
    onVote: logVote,
    onVerified: handleVerified,
    onAttempt: attemptLog.recordAttempt,
    screen: 'lesson',
  });
  // One name for "there is no usable picture", because two hand-written copies of this condition
  // had already drifted: the checklist's guard was still missing 'stalled', so a stalled camera
  // showed the recovery card AND a live coaching panel scoring a frozen frame.
  const cameraUnavailable =
    camStatus === 'denied' || camStatus === 'error' || camStatus === 'stalled' || recognition.status === 'error';

  // First-run only: overlay a camera-framing guide until the user is well positioned.
  const showCamGuide = useFirstRunCameraGuide(recognition.framing?.ok);
  const loopStartedForSign = useRef<string | null>(null);

  useEffect(() => {
    recognition.init();
  }, [recognition.init]);

  useEffect(() => {
    if (phase !== 'signing' || cameraUnavailable) {
      // Also stop on cameraUnavailable: a track that dies mid-lesson (unplugged, OS revocation,
      // iOS mute escalation — see useCamera) leaves the loop running against a dead video,
      // burning MediaPipe CPU producing garbage verify() scores for the recovery card to sit
      // next to. "Try again" restarts the camera; once camStatus is 'active' again this effect
      // re-arms the loop.
      if (loopStartedForSign.current) {
        recognition.stopLoop();
        loopStartedForSign.current = null;
      }
      return;
    }

    if (
      camStatus === 'active' &&
      (recognition.status === 'ready' || recognition.status === 'running') &&
      currentEngineSign &&
      videoRef.current
    ) {
      if (loopStartedForSign.current !== currentEngineSign.name) {
        recognition.stopLoop();
        recognition.startLoop(videoRef.current, currentEngineSign);
        loopStartedForSign.current = currentEngineSign.name;
        if (import.meta.env.DEV) console.log('[QuickSign] Recognition loop started for', currentEngineSign.name);
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

  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('signup-camera-onboarded');
  });

  const handleStart = async () => {
    if (showOnboarding) {
      setShowOnboarding(true);
      return;
    }
    lessonStartedAtRef.current = Date.now();
    track('lesson_started', { lesson_id: lessonId, world_id: worldId });
    await startCam();
    setPhase('signing');
  };

  const handleOnboardingContinue = async () => {
    localStorage.setItem('signup-camera-onboarded', '1');
    setShowOnboarding(false);
    lessonStartedAtRef.current = Date.now();
    track('lesson_started', { lesson_id: lessonId, world_id: worldId });
    await startCam();
    setPhase('signing');
  };

  const handleSkip = () => {
    setSkipMsg(pickZippyLine('encourage'));
    setTimeout(() => setSkipMsg(null), 2000);
    if (currentSignId) {
      const attempt = recognition.finalizeAttempt('skip');
      if (attempt?.outcome !== 'NOT_SCORABLE') recordSign(currentSignId, false);
    }
    recorder.discard();
    loopStartedForSign.current = null;
    if (promptIdx + 1 < signIds.length) {
      setPromptIdx((prev) => prev + 1);
    } else {
      setCompleteMsg(pickCompleteMessage());
      setPhase('complete');
      completeLesson(lessonId);
    }
  };

  if (!lesson) {
    return (
      <div className="min-h-dvh bg-z-bg flex items-center justify-center overflow-y-auto text-z-gray-300">
        Lesson not found.
      </div>
    );
  }

  const showCamera = phase === 'signing' || phase === 'success';

  // What the always-mounted announcer below says for the current phase — '' for every phase that
  // isn't a milestone (matches the text a sighted learner already sees on screen).
  const phaseAnnouncement =
    phase === 'success' ? `${successMsg} +10 XP`
    : phase === 'complete' ? `${isFirstLessonComplete ? 'Your First Lesson!' : 'Lesson Complete!'} ${completeMsg} ${earnedXp} XP earned, ${correctCount} of ${signIds.length} correct`
    : '';

  return (
    <div className="min-h-dvh bg-z-bg flex flex-col">
      {/* Always mounted, separate from the phase panels' own AnimatePresence — see DESIGN.md
          "Status messages": a live region must already be in the DOM before its text appears. */}
      <p className="sr-only" role="status" aria-live="polite">{phaseAnnouncement}</p>
      <AnimatePresence>
        {showOnboarding && phase === 'intro' && (
          <CameraOnboarding onContinue={handleOnboardingContinue} onCancel={onExit} />
        )}
      </AnimatePresence>

      <LessonHeader
        lessonTitle={lesson.title}
        current={promptIdx + (phase === 'success' || phase === 'complete' ? 1 : 0)}
        total={signIds.length}
        onClose={onExit}
      />

      {/* Video element always in DOM — hidden when not signing */}
      <video
        ref={videoRef}
        className="fixed top-0 left-0"
        style={{
          width: showCamera ? 0 : 0,
          height: showCamera ? 0 : 0,
          opacity: 0,
          position: 'fixed',
          pointerEvents: 'none',
        }}
        muted
        playsInline
        autoPlay
      />

      <div className={`flex-1 mx-auto w-full px-4 pb-6 flex flex-col ${phase === 'signing' ? 'max-w-lg lg:max-w-6xl' : 'max-w-lg'}`}>
        <AnimatePresence mode="wait">
          {/* --- INTRO --- */}
          {phase === 'intro' && (
            <motion.div
              key="intro"
              className="flex-1 flex flex-col items-center justify-center gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Zippy holds the ASL book to introduce the topic; while the camera/model warms up
                  he switches to the binoculars "looking for your hands" pose. */}
              <Zippy expression={recognition.status === 'loading' ? 'looking' : 'reading'} size="lg" float />
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <span className="text-3xl">{lesson.iconEmoji}</span>
                {lesson.title}
              </h1>
              <p className="text-z-gray-300 text-center max-w-xs">
                {lesson.description} — {signIds.length} signs to learn
              </p>

              {recognition.status === 'loading' && (
                <p className="text-sm text-z-gray-400 animate-pulse">
                  {pickZippyLine('cameraLoading')}
                </p>
              )}

              <Button
                onClick={handleStart}
                disabled={recognition.status === 'loading'}
                size="lg"
                className="mt-4"
              >
                {camStatus === 'idle' ? 'Start Signing' : 'Continue'}
              </Button>

              {camStatus === 'denied' && (
                <p className="text-z-red text-sm text-center max-w-xs">
                  Camera access denied. Please allow camera access in your browser settings.
                </p>
              )}
            </motion.div>
          )}

          {/* --- SIGNING --- */}
          {phase === 'signing' && currentSignData && (
            <motion.div
              key={`signing-${promptIdx}`}
              className="flex-1 flex flex-col gap-4 lg:justify-center"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
            >
              <div className="text-center py-2">
                <h2 className="text-xl font-bold tracking-tight">
                  Sign: {currentSignData.name.replace(/_/g, ' ')}
                </h2>
                <p className="text-sm text-z-gray-300 mt-1">{currentSignData.description}</p>
              </div>

              {/* Mobile: stacked (clip, camera, checklist) in source order. Desktop (lg+): three
                  columns side by side — reference clip enlarged on the left, webcam center, live
                  coaching checklist on the right — so everything is glanceable without scrolling. */}
              <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[320px_1fr_340px] lg:gap-6 lg:items-start">
                <div className="lg:order-1">
                  {currentSignData.clip ? (
                    <ReferenceClip
                      clipUrl={currentSignData.clip}
                      signName={currentSignData.name}
                      compact
                    />
                  ) : currentSignData.howTo ? (
                    <div className="rounded-2xl border border-z-gray-500/20 bg-z-card p-3 text-center lg:aspect-square lg:flex lg:flex-col lg:items-center lg:justify-center">
                      <p className="text-z-gray-300 text-xs font-bold uppercase tracking-widest mb-1">No video yet — how to sign it</p>
                      <p className="text-z-gray-100 text-sm leading-snug">{currentSignData.howTo}</p>
                    </div>
                  ) : null}
                </div>

                <div className="lg:order-2">
                  {cameraUnavailable ? (
                    <div className="rounded-2xl border border-z-red/30 bg-z-red/10 p-4 text-center">
                      <p className="text-sm font-bold text-z-red">
                        {camStatus === 'denied'
                          ? 'Camera access denied'
                          : camStatus === 'error'
                            ? 'Camera unavailable'
                            : camStatus === 'stalled'
                              ? "Camera feed isn't showing"
                              : "Couldn't load the recognizer"}
                      </p>
                      <p className="text-xs text-z-gray-300 mt-1">
                        {camStatus === 'denied'
                          ? 'Live coaching needs your camera. Allow camera access in your browser settings, then try again.'
                          : camStatus === 'error'
                            ? 'Something went wrong starting the camera. Try again, or check that no other app is using it.'
                            : camStatus === 'stalled'
                              ? "Your camera is on but no picture is coming through. Try again, or check that no other app is using it."
                              : "We couldn't load the sign recognizer — usually a network hiccup. Check your connection and try again."}
                      </p>
                      {/* Retry both paths: recognition.init() re-attempts the MediaPipe load (now that a
                          failed init no longer caches its rejection — see getSharedCapture). stopCam()
                          before startCam() forces a fresh getUserMedia() call instead of reattaching the
                          same (possibly dead) stream — required for the 'stalled' case, harmless for the
                          others since stop() on an already-idle camera is a no-op. */}
                      <button
                        onClick={() => { recognition.init(); stopCam(); startCam(); }}
                        className="mt-3 text-xs font-bold text-z-gray-50 bg-z-red/40 hover:bg-z-red/50 px-4 py-2 rounded-lg"
                      >
                        Try again
                      </button>
                    </div>
                  ) : (
                    /* Visible webcam mirror — reads from the hidden video element. Slightly
                       taller than the stream's own shape (4:3) on desktop to fill the middle
                       column better, short of stretching to match the clip/checklist columns. */
                    <WebcamMirror videoRef={videoRef} cosmeticBorderClasses={cosmeticBorderClasses} frameGuide={showCamGuide ? recognition.framing : null} aspectClassName="aspect-[var(--cam-ar)] lg:aspect-[4/3]" />
                  )}
                </div>

                <div className="lg:order-3">
                  {!cameraUnavailable && (
                    /* Isolated 10 Hz subscriber: only this subtree re-renders on each live
                       result publish — the rest of the page no longer re-renders 10×/s during
                       the signing phase (see LiveSignCoach's header comment). */
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

              {/* mt-auto pins this to the bottom of the full-height mobile layout. On desktop the
                  parent motion.div now centers its content vertically (lg:justify-center above)
                  instead, so mt-auto must be killed there — otherwise the auto margin would still
                  greedily eat the remaining space and pin this row to the bottom regardless. */}
              <div className="flex items-center justify-between mt-auto lg:mt-0 pt-2 lg:pt-6">
                <p className="text-xs text-z-gray-400 italic max-w-[60%]">
                  {currentSignData.hint}
                </p>
                <button
                  onClick={handleSkip}
                  className="text-xs text-z-gray-400 hover:text-z-gray-200 transition-colors px-3 py-1.5 rounded-lg border border-z-gray-500/30"
                >
                  Skip
                </button>
              </div>
            </motion.div>
          )}

          {/* --- SUCCESS --- */}
          {phase === 'success' && (
            <motion.div
              key="success"
              className="flex-1 flex flex-col items-center justify-center gap-4"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Zippy expression="thumbsup" size="lg" />
              <h2 className="text-2xl font-bold text-z-green">{successMsg}</h2>
              <motion.div
                className="text-lg font-bold text-z-yellow"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                +10 XP
              </motion.div>
              {replayEnabled && (
                <div className="flex flex-col items-center gap-2 mt-2">
                  <button
                    onClick={() => setPhase('replay')}
                    disabled={!recorder.replayUrl}
                    className="text-xs text-z-purple-light hover:text-z-gray-50 px-3 py-1.5 rounded-lg border border-z-purple-light/40 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {recorder.replayUrl ? '▶ Watch replay' : 'Preparing replay…'}
                  </button>
                  <button
                    onClick={() => { recorder.discard(); advancePrompt(); }}
                    className="text-xs text-z-gray-300 hover:text-z-gray-50 px-3 py-1.5 rounded-lg border border-z-gray-500/30"
                  >
                    Next word →
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* --- REPLAY --- */}
          {phase === 'replay' && recorder.replayUrl && currentSignData && (
            <ReplayCompare
              attemptUrl={recorder.replayUrl}
              clipUrl={currentSignData.clip}
              signName={currentSignData.name}
              hint={currentSignData.hint}
              params={passResult?.params}
              sign={currentEngineSign}
              onContinue={() => {
                recorder.discard();
                advancePrompt();
              }}
            />
          )}

          {/* --- COMPLETE --- */}
          {phase === 'complete' && (
            <motion.div
              key="complete"
              className="flex-1 flex flex-col items-center justify-center gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Zippy expression={isFirstLessonComplete || correctCount / (signIds.length || 1) >= 0.5 ? 'celebrating' : 'proud'} size="lg" />
              <h1 className="text-2xl font-bold">{isFirstLessonComplete ? 'Your First Lesson! 🎉' : 'Lesson Complete!'}</h1>
              <p className="text-z-gray-300 text-center max-w-xs -mt-2">{completeMsg}</p>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-z-yellow">{earnedXp}</p>
                  <p className="text-xs text-z-gray-400">XP earned</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-z-green">{correctCount}/{signIds.length}</p>
                  <p className="text-xs text-z-gray-400">correct</p>
                </div>
              </div>

              <Button onClick={onExit} size="lg" className="mt-6">
                Continue
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
