import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCamera } from '@/hooks/useCamera';
import { useRecognition, type AttemptRecord } from '@/hooks/useRecognition';
import { useSounds } from '@/hooks/useSounds';
import { useConfetti } from '@/hooks/useConfetti';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { WebcamMirror } from '@/components/shared/WebcamMirror';
import { Zippy } from '@/components/shared/Zippy';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { logAttempt } from '@/hooks/useProgressSync';
import { SIGNS } from '@/data/signs';
import { SIGNS as ENGINE_SIGNS } from '@/engine/signs/index';
import { MovementKind } from '@/engine/schema';
import { getShopItem } from '@/data/shop';
import type { VerifyResult } from '@/engine/verifier';
import type { SpeedTier } from '@/types/user';
import { track } from '@/analytics';

const TIER_CONFIG = {
  warmup: { label: 'Warm Up', icon: '🌡️', timePerSign: 15,  xpMult: 1, signsMult: 1, gradient: 'bg-gradient-teal',   glow: 'rgba(20,184,166,0.45)' },
  sprint: { label: 'Sprint',  icon: '🏃',  timePerSign: 10,  xpMult: 2, signsMult: 2, gradient: 'bg-gradient-blue',   glow: 'rgba(59,130,246,0.45)' },
  blitz:  { label: 'Blitz',   icon: '⚡',  timePerSign: 5,   xpMult: 3, signsMult: 3, gradient: 'bg-gradient-violet', glow: 'rgba(168,85,247,0.55)' },
} as const;

type GamePhase = 'tier-select' | 'countdown' | 'playing' | 'done';

interface Props {
  onExit: () => void;
}

export function SpeedChallengePage({ onExit }: Props) {
  const { addXp, addSigns, recordSign, recordSpeedResult, checkBadges, equippedBorder } = useUserStore();
  const cosmeticBorderClasses = equippedBorder ? (getShopItem(equippedBorder)?.preview ?? '') : '';
  const { user } = useAuth();
  const { videoRef, status: camStatus, start: startCam, stop: stopCam } = useCamera('speed');
  const sounds = useSounds();
  const { burst } = useConfetti();

  const [phase, setPhase] = useState<GamePhase>('tier-select');
  const [tier, setTier] = useState<SpeedTier>('warmup');
  const [queue, setQueue] = useState<string[]>([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [totalSignsEarned, setTotalSignsEarned] = useState(0);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [justPassed, setJustPassed] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const loopStartedRef = useRef<string | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const justPassedRef = useRef(justPassed);
  justPassedRef.current = justPassed;

  const currentSignId = queue[queueIdx];
  const currentSignData = currentSignId ? SIGNS[currentSignId] : null;
  const currentEngineSign = currentSignId ? ENGINE_SIGNS[currentSignId] : null;
  const config = TIER_CONFIG[tier];

  const advanceSign = useCallback(
    (correct: boolean) => {
      clearInterval(timerRef.current);
      const nextIdx = queueIdx + 1;
      if (nextIdx >= queue.length) {
        setPhase('done');
      } else {
        setQueueIdx(nextIdx);
        setTimeLeft(TIER_CONFIG[tier].timePerSign);
        setJustPassed(false);
        loopStartedRef.current = null;
      }
      if (!correct) setCombo(0);
    },
    [queueIdx, queue.length, tier]
  );

  const handlePass = useCallback(
    (_result: VerifyResult) => {
      if (phaseRef.current !== 'playing' || justPassedRef.current) return;
      setJustPassed(true);
      clearInterval(timerRef.current);
      sounds.correct();
      burst();

      if (currentSignId) {
        recordSign(currentSignId, true);
      }

      setScore((p) => p + 1);
      setCombo((prev) => {
        const newCombo = prev + 1;
        setMaxCombo((m) => Math.max(m, newCombo));
        const comboMult = newCombo >= 3 ? 1.5 : 1;
        const xpEarned = Math.round(5 * config.xpMult * comboMult);
        const signsEarned = Math.round(5 * config.signsMult * comboMult);
        addXp(xpEarned);
        addSigns(signsEarned);
        setTotalXpEarned((p) => p + xpEarned);
        setTotalSignsEarned((p) => p + signsEarned);
        return newCombo;
      });

      advanceTimerRef.current = setTimeout(() => advanceSign(true), 900);
    },
    [currentSignId, config, addXp, addSigns, recordSign, advanceSign, burst, sounds]
  );

  const handleAttempt = useCallback(
    (a: AttemptRecord) => {
      // No single world_id — Speed Challenge draws from the full sign pool across worlds.
      track('sign_attempt', {
        sign_id: a.signId,
        world_id: null,
        source: 'speed',
        rule_passed: a.rulePassed,
        ai_vetoed: a.aiVetoed,
        final_passed: a.finalPassed,
        ai_prediction: a.aiPrediction,
        ai_confidence: a.aiConfidence,
        duration_ms: a.durationMs,
        attempt_number: a.attemptNumber,
      });
      if (!user) return;
      void logAttempt({
        userId: user.id,
        signId: a.signId,
        rulePassed: a.rulePassed,
        aiPrediction: a.aiPrediction,
        aiConfidence: a.aiConfidence,
        aiVetoed: a.aiVetoed,
        finalPassed: a.finalPassed,
        source: 'speed',
        frames: a.frames,
      });
    },
    [user]
  );

  const recognition = useRecognition({ onPass: handlePass, onAttempt: handleAttempt, screen: 'speed' });

  useEffect(() => {
    recognition.init();
  }, [recognition.init]);

  // Recognition loop
  useEffect(() => {
    if (phase !== 'playing' || justPassed) {
      recognition.stopLoop();
      loopStartedRef.current = null;
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
      }
    }
  });

  // Per-sign countdown timer
  useEffect(() => {
    if (phase !== 'playing' || justPassed) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.11) {
          clearInterval(timerRef.current);
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
                source: 'speed',
                frames: recognition.getSnapshot(),
              });
            }
          }
          setCombo(0);
          loopStartedRef.current = null;
          advanceTimerRef.current = setTimeout(() => advanceSign(false), 300);
          return 0;
        }
        return +(prev - 0.1).toFixed(1);
      });
    }, 100);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, queueIdx, justPassed]);

  // Record result + badges when done
  useEffect(() => {
    if (phase === 'done') {
      recordSpeedResult(tier, score, maxCombo, totalSignsEarned);
      track('speed_session_completed', { tier, score, combo: maxCombo, signs_earned: totalSignsEarned });
      checkBadges();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(advanceTimerRef.current);
      clearInterval(countdownIntervalRef.current);
      stopCam();
      recognition.stopLoop();
    };
  }, []);

  const startGame = async (selectedTier: SpeedTier) => {
    setTier(selectedTier);
    // Blitz's 5s-per-sign budget is tight against core/schema's own movement-verification
    // requirement (a rolling window of ~1.5-2s to confirm circular/linear/repeated motion, per
    // CLAUDE.md) — a movement sign drawn into Blitz leaves little margin once reaction time is
    // subtracted. Warm Up (15s) and Sprint (10s) clear that window comfortably, so only Blitz filters.
    const allIds = Object.keys(SIGNS);
    const eligibleIds =
      selectedTier === 'blitz'
        ? allIds.filter((id) => ENGINE_SIGNS[id]?.movement.kind === MovementKind.NONE)
        : allIds;
    const shuffled = [...eligibleIds].sort(() => Math.random() - 0.5).slice(0, 10);
    setQueue(shuffled);
    setQueueIdx(0);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTotalSignsEarned(0);
    setTotalXpEarned(0);
    setJustPassed(false);
    loopStartedRef.current = null;
    setCountdown(3);
    setPhase('countdown');
    track('speed_session_started', { tier: selectedTier });
    await startCam();

    let c = 3;
    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(countdownIntervalRef.current);
        setTimeLeft(TIER_CONFIG[selectedTier].timePerSign);
        setPhase('playing');
      }
    }, 1000);
  };

  const timerPercent = config
    ? (timeLeft / TIER_CONFIG[tier].timePerSign) * 100
    : 100;

  return (
    <div className="min-h-dvh bg-z-bg flex flex-col">
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
        <h1 className="font-bold text-lg">⚡ Speed Challenge</h1>
        {phase === 'playing' && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm font-bold text-z-yellow">{score} pts</span>
            {combo >= 2 && (
              <motion.span
                key={combo}
                className="text-sm font-bold text-z-orange"
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
              >
                {combo}× combo{combo >= 3 ? ' 🔥' : ''}
              </motion.span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 pb-6 flex flex-col">
        <AnimatePresence mode="wait">

          {/* TIER SELECT */}
          {phase === 'tier-select' && (
            <motion.div
              key="tier-select"
              className="flex-1 flex flex-col justify-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center mb-2">
                <p className="text-z-gray-400 text-sm mt-1">Sign fast, earn big. Choose your speed.</p>
              </div>
              {(Object.entries(TIER_CONFIG) as [SpeedTier, (typeof TIER_CONFIG)[SpeedTier]][]).map(
                ([id, cfg]) => (
                  <motion.button
                    key={id}
                    onClick={() => startGame(id)}
                    className={`w-full rounded-2xl p-5 text-left border border-white/5 overflow-hidden relative ${cfg.gradient}`}
                    initial="rest"
                    animate="rest"
                    whileHover="hover"
                    whileTap={{ scale: 0.97 }}
                    variants={{
                      rest:  { scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' },
                      hover: { scale: 1.02, boxShadow: `0 14px 40px ${cfg.glow}`, transition: { duration: 0.25, ease: 'easeOut' } },
                    }}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                    {/* The scrim that used to be a separate div here is baked into the
                        bg-gradient-* utilities. /30 was not enough for the Warm Up tier anyway —
                        its teal put the subtitle at 3.16:1. See index.css. */}
                    <div className="relative flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white">{cfg.icon} {cfg.label}</h3>
                        <p className="text-white/80 text-sm mt-0.5">
                          {cfg.timePerSign}s per sign · {cfg.xpMult}× XP · {cfg.signsMult}× Signs 🤟
                        </p>
                      </div>
                      <span className="text-3xl">{cfg.icon}</span>
                    </div>
                  </motion.button>
                )
              )}
            </motion.div>
          )}

          {/* COUNTDOWN */}
          {phase === 'countdown' && (
            <motion.div
              key="countdown"
              className="flex-1 flex flex-col items-center justify-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={countdown}
                  className="text-9xl font-bold text-z-purple-light"
                  initial={{ scale: 1.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {countdown > 0 ? countdown : '🤟'}
                </motion.div>
              </AnimatePresence>
              <p className="text-z-gray-400 text-sm">{config.icon} {config.label} · {config.timePerSign}s per sign</p>
            </motion.div>
          )}

          {/* PLAYING */}
          {phase === 'playing' && currentSignData && (
            <motion.div
              key={`play-${queueIdx}`}
              className="flex-1 flex flex-col gap-4 pt-4"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
            >
              {/* Timer bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-z-gray-400">{queueIdx + 1} / {queue.length}</span>
                  <span className={timeLeft <= 1.5 ? 'text-z-red font-bold' : 'text-z-gray-400'}>
                    {timeLeft.toFixed(1)}s
                  </span>
                </div>
                <div className="h-2.5 bg-z-surface rounded-full overflow-hidden">
                  <motion.div
                    // Reuses the tier's own gradient class so the timer bar and the tier card that
                    // launched it are the same colour by construction, then switches to the shared
                    // urgency gradient under 40%.
                    className={`h-full rounded-full ${timerPercent > 40 ? config.gradient : 'bg-gradient-urgent'}`}
                    style={{ width: `${timerPercent}%` }}
                    transition={{ duration: 0.08 }}
                  />
                </div>
              </div>

              {/* Sign prompt */}
              <div className="text-center py-2">
                <p className="text-xs text-z-gray-400 uppercase tracking-widest mb-1">Sign this</p>
                <motion.h2
                  key={currentSignId}
                  className="text-4xl font-bold"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {currentSignData.name.replace(/_/g, ' ')}
                </motion.h2>
                {combo >= 2 && (
                  <motion.p
                    key={`combo-${combo}`}
                    className="text-sm font-bold text-z-orange mt-1"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    {combo}× combo!{combo >= 3 ? ' ×1.5 bonus 🔥' : ''}
                  </motion.p>
                )}
              </div>

              {/* Webcam */}
              <WebcamMirror videoRef={videoRef} passed={justPassed} cosmeticBorderClasses={cosmeticBorderClasses} />

              {/* Skip */}
              <div className="flex justify-end mt-auto pt-1">
                <button
                  onClick={() => {
                    clearTimeout(advanceTimerRef.current);
                    if (currentSignId) recordSign(currentSignId, false);
                    setCombo(0);
                    advanceSign(false);
                  }}
                  className="text-xs text-z-gray-400 hover:text-z-gray-50 min-h-11 px-3 rounded-lg border border-z-gray-500/30"
                >
                  Skip
                </button>
              </div>
            </motion.div>
          )}

          {/* DONE */}
          {phase === 'done' && (
            <motion.div
              key="done"
              className="flex-1 flex flex-col items-center justify-center gap-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Zippy expression={score >= 8 ? 'celebrating' : score >= 5 ? 'proud' : 'tryagain'} size="lg" />
              <div className="text-center">
                <h2 className="text-2xl font-bold">Speed Run Complete</h2>
                <p className="text-z-gray-400 text-sm mt-1">{config.icon} {config.label}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full">
                <div className="bg-z-card rounded-2xl p-4 text-center border border-white/5">
                  <p className="text-2xl font-bold text-z-yellow">{score}/{queue.length}</p>
                  <p className="text-2xs text-z-gray-400 mt-1">Score</p>
                </div>
                <div className="bg-z-card rounded-2xl p-4 text-center border border-white/5">
                  <p className="text-2xl font-bold text-z-orange">{maxCombo}×</p>
                  <p className="text-2xs text-z-gray-400 mt-1">Best combo</p>
                </div>
                <div className="bg-z-card rounded-2xl p-4 text-center border border-white/5">
                  <p className="text-xl font-bold text-z-purple-light">{totalSignsEarned}🤟</p>
                  <p className="text-2xs text-z-gray-400 mt-1">Signs earned</p>
                </div>
              </div>

              {totalXpEarned > 0 && (
                <p className="text-z-yellow text-sm font-bold">+{totalXpEarned} XP earned</p>
              )}

              <div className="flex gap-3 w-full">
                <motion.button
                  onClick={() => setPhase('tier-select')}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm border border-white/10 text-z-gray-300"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Try Again
                </motion.button>
                <motion.button
                  onClick={onExit}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm text-white bg-gradient-violet"
                                   whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Back Home
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

