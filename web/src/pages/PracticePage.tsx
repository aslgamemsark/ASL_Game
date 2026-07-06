import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCamera } from '@/hooks/useCamera';
import { useAttemptRecorder } from '@/hooks/useAttemptRecorder';
import { useRecognition, type AttemptRecord } from '@/hooks/useRecognition';
import { useClassifier } from '@/hooks/useClassifier';
import { useSounds } from '@/hooks/useSounds';
import { useConfetti } from '@/hooks/useConfetti';
import { ParameterChecklist } from '@/components/lesson/ParameterChecklist';
import { ReferenceClip } from '@/components/lesson/ReferenceClip';
import { ReplayCompare } from '@/components/lesson/ReplayCompare';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { logSignAttempt, logVerification, logAttempt } from '@/hooks/useProgressSync';
import type { VerificationEntry } from '@/hooks/useRecognition';
import { SIGNS } from '@/data/signs';
import { SIGNS as ENGINE_SIGNS } from '@/engine/signs/index';
import { getSignsDueForReview, pickReceptiveDistractors } from '@/data/spaced-repetition';
import type { VerifyResult } from '@/engine/verifier';

type Mode = 'menu' | 'expressive' | 'receptive' | 'done';
type CardPhase = 'prompt' | 'result' | 'replay';

interface Props {
  onExit: () => void;
  filterSignIds?: string[];
  autoStartExpressive?: boolean;
  /** Extra gold awarded once, only if every sign in the session is passed on the first try. */
  bonusGoldOnPerfect?: number;
  /** Overrides the header title while in expressive/done mode (e.g. "Letter Test"). */
  heading?: string;
}

export function PracticePage({ onExit, filterSignIds, autoStartExpressive, bonusGoldOnPerfect, heading }: Props) {
  const { signAccuracy, recordSign, addXp, addGold, recordPracticeSession } = useUserStore();
  const { user } = useAuth();
  const { videoRef, status: camStatus, start: startCam, stop: stopCam, getStream } = useCamera();
  const recorder = useAttemptRecorder();
  const [replayEnabled, setReplayEnabled] = useState(
    () => localStorage.getItem('signup-replay-enabled') === '1'
  );
  const [passResult, setPassResult] = useState<VerifyResult | null>(null);
  const sounds = useSounds();
  const { burst, bigCelebration } = useConfetti();
  const [mode, setMode] = useState<Mode>('menu');
  const [queue, setQueue] = useState<string[]>([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [cardPhase, setCardPhase] = useState<CardPhase>('prompt');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [distractors, setDistractors] = useState<string[]>([]);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [goldAwarded, setGoldAwarded] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loopStartedRef = useRef<string | null>(null);
  const goldAwardedRef = useRef(false);

  const currentSignId = queue[queueIdx];
  const currentSignData = currentSignId ? SIGNS[currentSignId] : null;
  const currentEngineSign = currentSignId ? ENGINE_SIGNS[currentSignId] : null;
  const allSignIds = Object.keys(SIGNS);

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
      if (mode !== 'expressive' || cardPhase !== 'prompt') return;
      setCardPhase('result');
      setPassResult(result);
      if (replayEnabled) recorder.stop();
      sounds.correct();
      burst();
      if (currentSignId) {
        recordSign(currentSignId, true);
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
    [mode, cardPhase, currentSignId, replayEnabled, recorder, recordSign, addXp, advanceQueue]
  );

  const handleVerified = useCallback(
    (entry: VerificationEntry) => {
      if (user) logVerification(user.id, entry);
    },
    [user]
  );

  const handleAttempt = useCallback(
    (a: AttemptRecord) => {
      if (!user) return;
      void logAttempt({
        userId: user.id,
        signId: a.signId,
        rulePassed: a.rulePassed,
        aiPrediction: a.aiPrediction,
        aiConfidence: a.aiConfidence,
        aiVetoed: a.aiVetoed,
        finalPassed: a.finalPassed,
        source: 'practice',
        frames: a.frames,
      });
    },
    [user]
  );

  const { classifier, logVote } = useClassifier();
  const recognition = useRecognition({
    onPass: handlePass,
    classifier,
    onVote: logVote,
    onVerified: handleVerified,
    onAttempt: handleAttempt,
  });

  useEffect(() => {
    recognition.init();
  }, [recognition.init]);

  // Start recognition loop for expressive mode
  useEffect(() => {
    if (mode !== 'expressive' || cardPhase !== 'prompt') {
      if (loopStartedRef.current) {
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

  // Auto-start for weak signs / letters mode
  useEffect(() => {
    if (autoStartExpressive) {
      startExpressive();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startExpressive = async () => {
    const pool = filterSignIds ?? (() => {
      const due = getSignsDueForReview(signAccuracy, 8);
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
    loopStartedRef.current = null;
    await startCam();
    setMode('expressive');
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

  const startReceptive = () => {
    const pool = filterSignIds ?? allSignIds;
    const signs = pool
      .filter((id) => SIGNS[id]?.clip)
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);
    setQueue(signs);
    setQueueIdx(0);
    setCardPhase('prompt');
    setSelectedAnswer(null);
    setSessionXp(0);
    setSessionCorrect(0);
    setMode('receptive');
  };

  const handleReceptiveAnswer = (answerId: string) => {
    if (cardPhase !== 'prompt') return;
    setSelectedAnswer(answerId);
    setCardPhase('result');
    const correct = answerId === currentSignId;
    if (correct) { sounds.correct(); burst(); } else { sounds.wrong(); }
    if (currentSignId) {
      recordSign(currentSignId, correct);
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

  // Generate distractors when receptive question changes
  useEffect(() => {
    if (mode === 'receptive' && currentSignId) {
      setDistractors(pickReceptiveDistractors(currentSignId, allSignIds, 3));
    }
  }, [mode, currentSignId]);

  const handleSkipExpressive = () => {
    if (currentSignId) {
      recordSign(currentSignId, false);
      if (user) {
        void logAttempt({
          userId: user.id,
          signId: currentSignId,
          rulePassed: false,
          aiPrediction: null,
          aiConfidence: null,
          aiVetoed: false,
          finalPassed: false,
          source: 'practice',
          frames: recognition.getSnapshot(),
        });
      }
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
    <div className="min-h-screen bg-z-bg flex flex-col">
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
        <button
          onClick={() => { stopCam(); recognition.stopLoop(); onExit(); }}
          className="w-8 h-8 flex items-center justify-center text-z-gray-400 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-bold text-lg">
          {mode === 'menu'
            ? 'Review'
            : mode === 'expressive'
              ? (heading ?? 'Sign It')
              : mode === 'receptive'
                ? 'Sign Quiz'
                : (heading ?? 'Done')}
        </h1>
        {mode !== 'menu' && mode !== 'done' && (
          <span className="ml-auto text-sm text-z-gray-400">{queueIdx + 1}/{queue.length}</span>
        )}
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 pb-6 flex flex-col">
        <AnimatePresence mode="wait">
          {/* --- MENU --- */}
          {mode === 'menu' && (
            <motion.div
              key="menu"
              className="flex-1 flex flex-col items-center justify-center gap-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h2 className="text-2xl font-bold mb-2">Choose a mode</h2>

              <motion.button
                onClick={startExpressive}
                disabled={recognition.status === 'loading'}
                className="w-full rounded-2xl p-5 text-left border border-white/5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7B2FBE, #A855F7)' }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Sign It</h3>
                    <p className="text-purple-200 text-sm mt-1">See a word, sign it to the camera</p>
                  </div>
                  <span className="text-3xl">🤟</span>
                </div>
              </motion.button>

              <motion.button
                onClick={startReceptive}
                className="w-full rounded-2xl p-5 text-left bg-z-card border border-white/5"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Sign Quiz</h3>
                    <p className="text-z-gray-300 text-sm mt-1">Watch a clip, pick the right word</p>
                  </div>
                  <span className="text-3xl">🧠</span>
                </div>
              </motion.button>

              {recorder.supported && (
                <label className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-z-card border border-white/5 cursor-pointer">
                  <span className="text-sm text-z-gray-200">
                    Record my attempts for replay
                    <span className="block text-[11px] text-z-gray-500">Stays on your device, never uploaded</span>
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

          {/* --- EXPRESSIVE --- */}
          {mode === 'expressive' && currentSignData && (
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

                  {currentSignData.clip && (
                    <ReferenceClip clipUrl={currentSignData.clip} signName={currentSignData.name} compact />
                  )}

                  <WebcamMirror videoRef={videoRef} />

                  {recognition.result && (
                    <ParameterChecklist
                      params={recognition.result.params}
                      sign={currentEngineSign}
                    />
                  )}

                  <div className="flex justify-end mt-auto pt-2">
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
                  clipUrl={currentSignData.clip}
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
                  <motion.div
                    className="text-6xl"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.4 }}
                  >
                    ✅
                  </motion.div>
                  <h2 className="text-xl font-bold text-z-green">Nice!</h2>
                  <p className="text-z-yellow font-bold">+5 XP</p>
                  {replayEnabled && (
                    <div className="flex flex-col items-center gap-2 mt-2">
                      <button
                        onClick={() => setCardPhase('replay')}
                        disabled={!recorder.replayUrl}
                        className="text-xs text-z-purple-light hover:text-white px-3 py-1.5 rounded-lg border border-z-purple-light/40 disabled:opacity-40"
                      >
                        {recorder.replayUrl ? '▶ Watch replay' : 'Preparing replay…'}
                      </button>
                      <button
                        onClick={() => { recorder.discard(); advanceQueue(); }}
                        className="text-xs text-z-gray-300 hover:text-white px-3 py-1.5 rounded-lg border border-z-gray-500/30"
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
          {mode === 'receptive' && currentSignData && (
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
                {[currentSignId, ...distractors]
                  .sort(() => Math.random() - 0.5)
                  .map((id) => {
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
                            : 'bg-z-card border-z-gray-500/20 text-white hover:border-z-purple-light'
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
              <div className="text-5xl mb-2">{goldAwarded > 0 ? '🏆' : '🎯'}</div>
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
                <p className="text-z-gray-500 text-xs -mt-2">
                  Pass every letter without skipping to earn {bonusGoldOnPerfect} gold 🪙
                </p>
              )}
              <motion.button
                onClick={onExit}
                className="mt-4 px-8 py-3 rounded-2xl font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #7B2FBE, #A855F7)' }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Back to Home
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
