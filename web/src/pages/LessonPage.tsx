import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCamera } from '@/hooks/useCamera';
import { useRecognition } from '@/hooks/useRecognition';
import { useClassifier } from '@/hooks/useClassifier';
import { useSounds } from '@/hooks/useSounds';
import { useConfetti } from '@/hooks/useConfetti';
import { CameraOnboarding } from '@/components/shared/CameraOnboarding';
import { LessonHeader } from '@/components/lesson/LessonHeader';
import { ParameterChecklist } from '@/components/lesson/ParameterChecklist';
import { ReferenceClip } from '@/components/lesson/ReferenceClip';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { logSignAttempt } from '@/hooks/useProgressSync';
import { SIGNS } from '@/data/signs';
import { SIGNS as ENGINE_SIGNS } from '@/engine/signs/index';
import { getLessonById } from '@/data/lessons';
import type { VerifyResult } from '@/engine/verifier';

type Phase = 'intro' | 'signing' | 'success' | 'complete';

interface Props {
  lessonId: string;
  onExit: () => void;
}

export function LessonPage({ lessonId, onExit }: Props) {
  const lesson = getLessonById(lessonId);
  const { addXp, addDailyMinutes, completeLesson, recordSign } = useUserStore();
  const { user } = useAuth();
  const { videoRef, status: camStatus, start: startCam, stop: stopCam } = useCamera();
  const sounds = useSounds();
  const { burst, bigCelebration } = useConfetti();
  const [phase, setPhase] = useState<Phase>('intro');
  const [promptIdx, setPromptIdx] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const signIds = lesson?.signIds ?? [];
  const currentSignId = signIds[promptIdx];
  const currentSignData = currentSignId ? SIGNS[currentSignId] : null;
  const currentEngineSign = currentSignId ? ENGINE_SIGNS[currentSignId] : null;

  const handlePass = useCallback(
    (_result: VerifyResult) => {
      if (phase !== 'signing') return;
      setPhase('success');
      sounds.correct();
      burst();
      const xp = 10;
      setEarnedXp((prev) => prev + xp);
      setCorrectCount((prev) => prev + 1);
      addXp(xp);
      addDailyMinutes(1.5);
      if (currentSignId) {
        recordSign(currentSignId, true);
        if (user) logSignAttempt(user.id, currentSignId, true);
      }

      timerRef.current = setTimeout(() => {
        if (promptIdx + 1 < signIds.length) {
          setPromptIdx((prev) => prev + 1);
          setPhase('signing');
        } else {
          setPhase('complete');
          completeLesson(lessonId);
          sounds.levelUp();
          bigCelebration();
        }
      }, 1800);
    },
    [phase, promptIdx, signIds, currentSignId, lessonId, addXp, recordSign, completeLesson]
  );

  const { classifier, logVote } = useClassifier();
  const recognition = useRecognition({ onPass: handlePass, classifier, onVote: logVote });
  const loopStartedForSign = useRef<string | null>(null);

  useEffect(() => {
    recognition.init();
  }, [recognition.init]);

  useEffect(() => {
    if (phase !== 'signing') {
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
        console.log('[SignUp] Recognition loop started for', currentEngineSign.name);
      }
    }
  });

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      stopCam();
      recognition.stopLoop();
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
    await startCam();
    setPhase('signing');
  };

  const handleOnboardingContinue = async () => {
    localStorage.setItem('signup-camera-onboarded', '1');
    setShowOnboarding(false);
    await startCam();
    setPhase('signing');
  };

  const handleSkip = () => {
    if (currentSignId) {
      recordSign(currentSignId, false);
      if (user) logSignAttempt(user.id, currentSignId, false);
    }
    loopStartedForSign.current = null;
    if (promptIdx + 1 < signIds.length) {
      setPromptIdx((prev) => prev + 1);
    } else {
      setPhase('complete');
      completeLesson(lessonId);
    }
  };

  if (!lesson) {
    return (
      <div className="min-h-screen bg-z-bg flex items-center justify-center text-z-gray-300">
        Lesson not found.
      </div>
    );
  }

  const showCamera = phase === 'signing' || phase === 'success';

  return (
    <div className="min-h-screen bg-z-bg flex flex-col">
      <AnimatePresence>
        {showOnboarding && phase === 'intro' && (
          <CameraOnboarding onContinue={handleOnboardingContinue} />
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

      <div className="flex-1 max-w-lg mx-auto w-full px-4 pb-6 flex flex-col">
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
              <div className="text-6xl mb-2">{lesson.iconEmoji}</div>
              <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>
              <p className="text-z-gray-300 text-center max-w-xs">
                {lesson.description} — {signIds.length} signs to learn
              </p>

              {recognition.status === 'loading' && (
                <p className="text-sm text-z-gray-400 animate-pulse">Loading recognition...</p>
              )}

              <motion.button
                onClick={handleStart}
                disabled={recognition.status === 'loading'}
                className="mt-4 px-8 py-3 rounded-2xl font-bold text-white text-lg disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {camStatus === 'idle' ? 'Start Signing' : 'Continue'}
              </motion.button>

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
              className="flex-1 flex flex-col gap-4"
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

              {currentSignData.clip && (
                <ReferenceClip
                  clipUrl={currentSignData.clip}
                  signName={currentSignData.name}
                />
              )}

              {/* Visible webcam mirror — reads from the hidden video element */}
              <WebcamMirror videoRef={videoRef} />

              {recognition.result && (
                <ParameterChecklist
                  params={recognition.result.params}
                  sign={currentEngineSign}
                />
              )}

              <div className="flex items-center justify-between mt-auto pt-2">
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
              <motion.div
                className="text-7xl"
                animate={{ rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6 }}
              >
                🎉
              </motion.div>
              <h2 className="text-2xl font-bold text-z-green">Correct!</h2>
              <motion.div
                className="text-lg font-bold text-z-yellow"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                +10 XP
              </motion.div>
            </motion.div>
          )}

          {/* --- COMPLETE --- */}
          {phase === 'complete' && (
            <motion.div
              key="complete"
              className="flex-1 flex flex-col items-center justify-center gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-6xl mb-2">🏆</div>
              <h1 className="text-2xl font-bold">Lesson Complete!</h1>
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

              <motion.button
                onClick={onExit}
                className="mt-6 px-8 py-3 rounded-2xl font-bold text-white text-lg"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Continue
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function WebcamMirror({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const draw = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
          ctx.restore();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef]);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-z-surface aspect-video">
      <canvas ref={canvasRef} className="w-full h-full object-cover" />
    </div>
  );
}
