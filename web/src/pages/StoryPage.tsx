import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCamera } from '@/hooks/useCamera';
import { useRecognition, type AttemptRecord } from '@/hooks/useRecognition';
import { useClassifier } from '@/hooks/useClassifier';
import { useSounds } from '@/hooks/useSounds';
import { useConfetti } from '@/hooks/useConfetti';
import { ParameterChecklist } from '@/components/lesson/ParameterChecklist';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { WebcamMirror } from '@/components/shared/WebcamMirror';
import { Zippy } from '@/components/shared/Zippy';
import { pickZippyLine, type ZippyExpression } from '@/data/zippy';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { logAttempt } from '@/hooks/useProgressSync';
import { SIGNS as ENGINE_SIGNS } from '@/engine/signs/index';
import { SIGNS } from '@/data/signs';
import type { StoryScript } from '@/data/stories';
import type { VerifyResult } from '@/engine/verifier';

type Phase = 'intro' | 'dialogue' | 'fail' | 'response' | 'complete';

interface Props {
  story: StoryScript;
  onExit: () => void;
}

const MOOD_EMOJI: Record<string, string> = {
  neutral: '😊',
  happy: '😄',
  curious: '🤔',
  surprised: '😲',
};

// Zippy narrates the greetings + coffee stories. When he's the NPC we swap the emoji avatar for his
// real expression art, chosen by the line's mood. Other stories' NPCs (Dr. Reeves, Ms. Rowan) keep
// their own emoji — they aren't Zippy.
const MOOD_ZIPPY: Record<string, ZippyExpression> = {
  neutral: 'teaching',
  happy: 'thumbsup',
  curious: 'thinking',
  surprised: 'celebrating',
};


export function StoryPage({ story, onExit }: Props) {
  const { addXp, addSigns, addGold, addDailyMinutes, recordSign, completeLesson, checkBadges, awardBadge } = useUserStore();
  const { user } = useAuth();
  const { videoRef, status: camStatus, start: startCam, stop: stopCam } = useCamera();
  const sounds = useSounds();
  const { burst, bigCelebration } = useConfetti();

  const [phase, setPhase] = useState<Phase>('intro');
  const [lineIdx, setLineIdx] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [skipsUsed, setSkipsUsed] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [earnedSigns, setEarnedSigns] = useState(0);
  const [failMsg, setFailMsg] = useState('');
  const [startedAt] = useState(Date.now());

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loopStartedRef = useRef<string | null>(null);
  const isZippy = story.npcName === 'Zippy';

  const currentLine = story.lines[lineIdx];
  const currentEngineSign = currentLine ? ENGINE_SIGNS[currentLine.requiredSignId] : null;
  const currentSignData = currentLine ? SIGNS[currentLine.requiredSignId] : null;

  const handlePass = useCallback(
    (_result: VerifyResult) => {
      if (phase !== 'dialogue') return;
      setPhase('response');
      sounds.correct();
      burst();
      if (currentLine) {
        recordSign(currentLine.requiredSignId, true);
        addDailyMinutes(2);
        const xp = 10;
        const signsEarned = 15;
        addXp(xp);
        addSigns(signsEarned);
        setEarnedXp((p) => p + xp);
        setEarnedSigns((p) => p + signsEarned);
      }

      timerRef.current = setTimeout(() => {
        if (lineIdx + 1 < story.lines.length) {
          setLineIdx((p) => p + 1);
          setHintLevel(0);
          setPhase('dialogue');
        } else {
          const storyGold = Math.max(5, 20 - skipsUsed * 3 - Math.floor(hintsUsed / 2));
          addGold(storyGold);
          completeLesson(story.id);
          if (story.id === 'coffee-story') awardBadge('coffee_story');
          if (story.id === 'hospital-story') awardBadge('hospital_story');
          checkBadges();
          setPhase('complete');
          sounds.levelUp();
          bigCelebration();
        }
      }, 1800);
    },
    [phase, lineIdx, currentLine, story, recordSign, addXp, addSigns, addGold, completeLesson, skipsUsed, hintsUsed, awardBadge, checkBadges]
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
        source: 'story',
        frames: a.frames,
      });
    },
    [user]
  );

  const { classifier, logVote } = useClassifier();
  const recognition = useRecognition({ onPass: handlePass, classifier, onVote: logVote, onAttempt: handleAttempt });

  useEffect(() => { recognition.init(); }, [recognition.init]);

  useEffect(() => {
    if (phase !== 'dialogue') {
      if (loopStartedRef.current) { recognition.stopLoop(); loopStartedRef.current = null; }
      return;
    }
    if (camStatus === 'active' && (recognition.status === 'ready' || recognition.status === 'running') && currentEngineSign && videoRef.current) {
      if (loopStartedRef.current !== currentEngineSign.name) {
        recognition.stopLoop();
        recognition.startLoop(videoRef.current, currentEngineSign);
        loopStartedRef.current = currentEngineSign.name;
      }
    }
  });

  useEffect(() => {
    return () => { clearTimeout(timerRef.current); stopCam(); recognition.stopLoop(); };
  }, []);

  const handleStart = async () => {
    await startCam();
    setPhase('dialogue');
  };

  const handleHint = () => {
    setHintLevel((p) => Math.min(p + 1, 2));
    setHintsUsed((p) => p + 1);
  };

  const handleSkip = () => {
    if (!currentLine) return;
    recordSign(currentLine.requiredSignId, false);
    if (user) {
      void logAttempt({
        userId: user.id,
        signId: currentLine.requiredSignId,
        rulePassed: false,
        aiPrediction: null,
        aiConfidence: null,
        aiVetoed: false,
        finalPassed: false,
        source: 'story',
        frames: recognition.getSnapshot(),
      });
    }
    setSkipsUsed((p) => p + 1);
    setFailMsg(pickZippyLine('encourage'));
    setPhase('fail');
    timerRef.current = setTimeout(() => {
      if (lineIdx + 1 < story.lines.length) {
        setLineIdx((p) => p + 1);
        setHintLevel(0);
        setPhase('dialogue');
      } else {
        setPhase('complete');
        completeLesson(story.id);
        sounds.levelUp();
        bigCelebration();
      }
    }, 2000);
  };

  const storyGold = Math.max(5, 20 - skipsUsed * 3 - Math.floor(hintsUsed / 2));
  const timeTaken = Math.round((Date.now() - startedAt) / 1000);

  return (
    <div className="min-h-screen bg-z-bg flex flex-col">
      <video ref={videoRef} style={{ width: 0, height: 0, opacity: 0, position: 'fixed', pointerEvents: 'none' }} muted playsInline autoPlay />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton icon="close" onClick={() => { stopCam(); recognition.stopLoop(); onExit(); }} />
        <h1 className="font-bold text-lg">{story.title}</h1>
        {phase === 'dialogue' && (
          <span className="ml-auto text-sm text-z-gray-400">{lineIdx + 1}/{story.lines.length}</span>
        )}
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 pb-6 flex flex-col">
        <AnimatePresence mode="wait">

          {/* INTRO */}
          {phase === 'intro' && (
            <motion.div key="intro" className="flex-1 flex flex-col items-center justify-center gap-5"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <motion.div className="text-6xl" animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                {story.backgroundEmoji}
              </motion.div>
              <h2 className="text-2xl font-bold">{story.title}</h2>
              <p className="text-z-gray-300 text-center max-w-xs">{story.description}</p>
              <div className="flex items-center gap-3 bg-z-card rounded-2xl p-4 border border-white/5 w-full max-w-xs">
                {isZippy ? (
                  <div className="w-14 h-14 rounded-2xl bg-z-purple overflow-hidden shrink-0">
                    <Zippy expression="welcome" fit="cover" />
                  </div>
                ) : (
                  <span className="text-3xl">{story.npcEmoji}</span>
                )}
                <div>
                  <p className="font-bold">{story.npcName}</p>
                  <p className="text-xs text-z-gray-400">{story.lines.length} exchanges · 10 XP each</p>
                </div>
              </div>
              {recognition.status === 'loading' && (
                <p className="text-sm text-z-gray-400 animate-pulse">Loading camera model…</p>
              )}
              <motion.button onClick={handleStart} disabled={recognition.status === 'loading'}
                className="mt-2 px-8 py-3 rounded-2xl font-bold text-white text-lg disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-primary"
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                Start
              </motion.button>
            </motion.div>
          )}

          {/* DIALOGUE */}
          {phase === 'dialogue' && currentLine && (
            <motion.div key={`dialogue-${lineIdx}`} className="flex-1 flex flex-col gap-4 pt-4"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              {/* NPC bubble */}
              <div className="flex items-start gap-3">
                {isZippy ? (
                  <div className="w-12 h-12 rounded-2xl bg-z-purple overflow-hidden shrink-0">
                    <Zippy expression={MOOD_ZIPPY[currentLine.npcMood]} fit="cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-z-purple flex items-center justify-center text-2xl shrink-0">
                    {MOOD_EMOJI[currentLine.npcMood]}
                  </div>
                )}
                <div className="bg-z-card border border-white/5 rounded-2xl rounded-tl-md px-4 py-3 flex-1">
                  <p className="text-sm font-bold text-z-purple-glow mb-0.5">{story.npcName}</p>
                  <p className="text-sm text-z-gray-100">{currentLine.npcText}</p>
                </div>
              </div>

              {/* Sign prompt + hint */}
              <div className="bg-z-surface/50 rounded-2xl p-4 border border-z-purple/30">
                <p className="text-xs text-z-gray-400 uppercase tracking-widest mb-1">Your turn — sign</p>
                <p className="text-xl font-bold text-z-purple-glow">
                  {hintLevel >= 2
                    ? currentSignData?.name.replace(/_/g, ' ')
                    : 'Give it a try!'}
                </p>
                {/* Hint levels */}
                <AnimatePresence>
                  {hintLevel >= 0 && (
                    <motion.p key="hint0" className="text-xs text-z-gray-300 mt-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {currentLine.hint}
                    </motion.p>
                  )}
                  {hintLevel >= 1 && currentSignData && (
                    <motion.p key="hint1" className="text-xs text-z-gray-400 mt-1 italic border-t border-white/5 pt-1"
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                      {currentSignData.description}
                    </motion.p>
                  )}
                  {hintLevel >= 2 && (
                    <motion.p key="hint2" className="text-xs text-z-green font-bold mt-1 border-t border-white/5 pt-1"
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                      Answer: {currentSignData?.name.replace(/_/g, ' ')} — just try to form the shape!
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Webcam */}
              <WebcamMirror videoRef={videoRef} />

              {recognition.result && (
                <ParameterChecklist params={recognition.result.params} sign={currentEngineSign} />
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-1">
                {hintLevel < 2 && (
                  <motion.button onClick={handleHint}
                    className="flex-1 py-2 text-xs rounded-xl border border-z-purple/30 text-z-purple-light hover:border-z-purple/60 transition-colors"
                    whileTap={{ scale: 0.96 }}>
                    💡 {hintLevel === 0 ? 'Show hint' : 'More help'}
                  </motion.button>
                )}
                <motion.button onClick={handleSkip}
                  className="px-4 py-2 text-xs rounded-xl border border-white/10 text-z-gray-400 hover:text-white transition-colors"
                  whileTap={{ scale: 0.96 }}>
                  Skip
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* FAIL / SKIP RESPONSE */}
          {phase === 'fail' && currentLine && (
            <motion.div key={`fail-${lineIdx}`} className="flex-1 flex flex-col items-center justify-center gap-4"
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              {isZippy ? (
                <Zippy expression="encouraging" size="md" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-z-orange/20 border border-z-orange/30 flex items-center justify-center text-4xl">
                  😅
                </div>
              )}
              <div className="bg-z-card border border-white/5 rounded-2xl px-6 py-4 text-center max-w-xs">
                <p className="text-sm font-bold text-z-orange mb-1">{story.npcName}</p>
                <p className="text-base">{failMsg}</p>
              </div>
              <p className="text-z-gray-400 text-xs">Moving to next line…</p>
            </motion.div>
          )}

          {/* NPC RESPONSE */}
          {phase === 'response' && currentLine && (
            <motion.div key={`response-${lineIdx}`} className="flex-1 flex flex-col items-center justify-center gap-4"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              {isZippy ? (
                <Zippy expression="thumbsup" size="md" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-z-purple flex items-center justify-center text-4xl">😄</div>
              )}
              <div className="bg-z-card border border-white/5 rounded-2xl px-6 py-4 text-center max-w-xs">
                <p className="text-sm font-bold text-z-purple-glow mb-1">{story.npcName}</p>
                <p className="text-base">{currentLine.npcResponse}</p>
              </div>
              <p className="text-z-yellow font-bold">+10 XP · +15 🤟</p>
            </motion.div>
          )}

          {/* COMPLETE */}
          {phase === 'complete' && (
            <motion.div key="complete" className="flex-1 flex flex-col items-center justify-center gap-5"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {isZippy ? (
                <Zippy expression="celebrating" size="lg" />
              ) : (
                <motion.div className="text-6xl" animate={{ rotate: [0, -10, 10, -6, 0], y: [0, -8, 0] }}
                  transition={{ duration: 0.6, delay: 0.2 }}>🎬</motion.div>
              )}
              <h2 className="text-2xl font-bold">Story Complete!</h2>

              <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                <div className="bg-z-card rounded-2xl p-3 text-center border border-white/5">
                  <p className="text-xl font-bold text-z-yellow">{earnedXp}</p>
                  <p className="text-[11px] text-z-gray-400 mt-0.5">XP earned</p>
                </div>
                <div className="bg-z-card rounded-2xl p-3 text-center border border-white/5">
                  <p className="text-xl font-bold text-z-purple-light">{earnedSigns}🤟</p>
                  <p className="text-[11px] text-z-gray-400 mt-0.5">Signs</p>
                </div>
                <div className="bg-z-card rounded-2xl p-3 text-center border border-white/5">
                  <p className="text-xl font-bold text-z-yellow">{storyGold}🪙</p>
                  <p className="text-[11px] text-z-gray-400 mt-0.5">Gold</p>
                </div>
              </div>

              {/* Performance summary */}
              <div className="bg-z-card border border-white/5 rounded-2xl p-4 w-full max-w-xs">
                <div className="flex justify-between text-sm">
                  <span className="text-z-gray-400">Exchanges</span>
                  <span className="font-bold">{story.lines.length - skipsUsed}/{story.lines.length}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-z-gray-400">Hints used</span>
                  <span className={`font-bold ${hintsUsed === 0 ? 'text-z-green' : 'text-z-orange'}`}>{hintsUsed}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-z-gray-400">Time</span>
                  <span className="font-bold">{Math.floor(timeTaken / 60)}m {timeTaken % 60}s</span>
                </div>
              </div>

              <motion.button onClick={onExit}
                className="mt-2 px-8 py-3 rounded-2xl font-bold text-white bg-gradient-primary"
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                Back to Home
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

