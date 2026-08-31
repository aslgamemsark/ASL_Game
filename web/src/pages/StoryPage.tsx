import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/shared/Button';
import { useCamera } from '@/hooks/useCamera';
import { useRecognition } from '@/hooks/useRecognition';
import { useClassifier } from '@/hooks/useClassifier';
import { useSounds } from '@/hooks/useSounds';
import { useConfetti } from '@/hooks/useConfetti';
import { LiveSignCoach } from '@/components/lesson/LiveSignCoach';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { WebcamMirror } from '@/components/shared/WebcamMirror';
import { ClassifierDevPanel } from '@/components/shared/ClassifierDevPanel';
import { Zippy } from '@/components/shared/Zippy';
import { ReferenceClip } from '@/components/lesson/ReferenceClip';
import { pickZippyLine, type ZippyExpression } from '@/data/zippy';
import { useUserStore } from '@/stores/useUserStore';
import { useAttemptLog } from '@/hooks/useAttemptLog';
import { SIGNS as ENGINE_SIGNS } from '@/engine/signs/index';
import { SIGNS } from '@/data/signs';
import { getShopItem } from '@/data/shop';
import type { StoryScript } from '@/data/stories';
import type { VerifyResult } from '@/engine/verifier';
import { getWorldIdForStory } from '@/data/worlds';
import { track } from '@/analytics';

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
// real expression art, chosen by the line's mood. Other stories' NPCs (Dr. Zippy, Mr. Zippy) keep
// their own emoji — they aren't Zippy.
const MOOD_ZIPPY: Record<string, ZippyExpression> = {
  neutral: 'teaching',
  happy: 'thumbsup',
  curious: 'thinking',
  surprised: 'celebrating',
};

export function StoryPage({
  story, onExit }: Props) {
  const { addXp, addSigns, addGold, addDailyMinutes, recordSign, completeLesson, checkBadges, awardBadge, equippedBorder } = useUserStore();
  const cosmeticBorderClasses = equippedBorder ? (getShopItem(equippedBorder)?.preview ?? '') : '';
  const { videoRef, status: camStatus, start: startCam, stop: stopCam } = useCamera('story');
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
  const worldId = getWorldIdForStory(story.id);
  const isZippy = story.npcName === 'Zippy';
  const npcCostume = story.npcCostume;

  const currentLine = story.lines[lineIdx];
  const currentEngineSign = currentLine ? ENGINE_SIGNS[currentLine.requiredSignId] : null;
  const currentSignData = currentLine ? SIGNS[currentLine.requiredSignId] : null;

  const handlePass = useCallback(
    (result: VerifyResult) => {
      if (phase !== 'dialogue') return;
      setPhase('response');
      sounds.correct();
      burst();
      if (currentLine) {
        recordSign({ signId: currentLine.requiredSignId, mode: 'expressive', correct: true, params: Object.fromEntries(result.params.filter((param) => param.required).map((param) => [param.name, { score: param.score, threshold: param.threshold }])) });
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
          track('story_completed', { story_id: story.id, world_id: worldId, duration_ms: Date.now() - startedAt, hints_used: hintsUsed, skips_used: skipsUsed });
          if (story.id === 'coffee-story') awardBadge('coffee_story');
          if (story.id === 'hospital-story') awardBadge('hospital_story');
          checkBadges();
          setPhase('complete');
          sounds.levelUp();
          bigCelebration();
        }
      }, 1800);
    },
    [phase, lineIdx, currentLine, story, recordSign, addXp, addSigns, addGold, completeLesson, skipsUsed, hintsUsed, awardBadge, checkBadges, worldId, startedAt]
  );

  const attemptLog = useAttemptLog({ source: 'story', worldId });

  const { classifier, status: classifierStatus, logVote, lastVote } = useClassifier();
  const recognition = useRecognition({ onPass: handlePass, classifier, onVote: logVote, onAttempt: attemptLog.recordAttempt, screen: 'story' });

  useEffect(() => { recognition.init(); }, [recognition.init]);

  useEffect(() => {
    if (phase !== 'dialogue' || camStatus !== 'active') {
      // camStatus !== 'active' also stops: a track dying mid-story (unplugged, iOS mute
      // escalation — see useCamera) must not leave MediaPipe burning CPU against a dead video.
      // Resuming dialogue re-arms once the camera reports active again.
      if (loopStartedRef.current) {
        recognition.finalizeAttempt('camera_interruption', camStatus);
        recognition.stopLoop();
        loopStartedRef.current = null;
      }
      return;
    }
    if ((recognition.status === 'ready' || recognition.status === 'running') && currentEngineSign && videoRef.current) {
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
    track('story_started', { story_id: story.id, world_id: worldId });
    await startCam();
    setPhase('dialogue');
  };

  const handleHint = () => {
    const nextLevel = Math.min(hintLevel + 1, 2);
    track('hint_used', { screen: 'story', sign_id: currentLine?.requiredSignId ?? '', hint_level: nextLevel });
    setHintLevel(nextLevel);
    setHintsUsed((p) => p + 1);
  };

  const handleSkip = () => {
    if (!currentLine) return;
    const attempt = recognition.finalizeAttempt('skip', camStatus);
    if (attempt?.outcome !== 'NOT_SCORABLE') recordSign({ signId: currentLine.requiredSignId, mode: 'expressive', correct: false, params: attempt?.verifier ? Object.fromEntries(attempt.verifier.params.filter((param) => param.required).map((param) => [param.name, { score: param.score, threshold: param.threshold }])) : undefined });
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
        track('story_completed', { story_id: story.id, world_id: worldId, duration_ms: Date.now() - startedAt, hints_used: hintsUsed, skips_used: skipsUsed + 1 });
        sounds.levelUp();
        bigCelebration();
      }
    }, 2000);
  };

  const storyGold = Math.max(5, 20 - skipsUsed * 3 - Math.floor(hintsUsed / 2));
  const timeTaken = Math.round((Date.now() - startedAt) / 1000);

  return (
    <div className="min-h-dvh bg-z-bg flex flex-col">
      <video ref={videoRef} style={{ width: 0, height: 0, opacity: 0, position: 'fixed', pointerEvents: 'none' }} muted playsInline autoPlay />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton icon="close" onClick={() => { stopCam(); recognition.stopLoop(); onExit(); }} />
        <h1 className="font-bold text-lg">{story.title}</h1>
        {phase === 'dialogue' && (
          <span className="ml-auto text-sm text-z-gray-400">{lineIdx + 1}/{story.lines.length}</span>
        )}
      </div>

      <div className={`flex-1 mx-auto w-full px-4 pb-6 flex flex-col ${phase === 'dialogue' ? 'max-w-lg lg:max-w-6xl' : 'max-w-lg'}`}>
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
                ) : npcCostume ? (
                  <div className="w-14 h-14 rounded-2xl bg-z-purple overflow-hidden shrink-0">
                    <Zippy expression={npcCostume} fit="cover" />
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
              <Button onClick={handleStart} disabled={recognition.status === 'loading'} size="lg" className="mt-2">
                Start
              </Button>
            </motion.div>
          )}

          {/* DIALOGUE */}
          {phase === 'dialogue' && currentLine && (
            <motion.div key={`dialogue-${lineIdx}`} className="flex-1 flex flex-col gap-4 pt-4"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              {/* NPC bubble — full-body standing character, not just a cropped headshot avatar.
                  A costume (barista/doctor/teacher) always wins over the generic mood art below:
                  it's who the player is actually talking to in this scene. */}
              <div className="flex items-start gap-3">
                {npcCostume ? (
                  <Zippy expression={npcCostume} size="md" className="shrink-0" />
                ) : isZippy ? (
                  <Zippy expression={MOOD_ZIPPY[currentLine.npcMood]} size="md" className="shrink-0" />
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

              {/* Sign prompt + text hint */}
              <div className="bg-z-surface/50 rounded-2xl p-4 border border-z-purple/30">
                {/* What the player's character says back, in plain English — turns the exchange
                    into a real conversation instead of a bare vocabulary word. */}
                <p className="text-sm text-z-gray-200 italic mb-2">"{currentLine.userLine}"</p>
                <p className="text-xs text-z-gray-400 uppercase tracking-widest mb-1">Sign</p>
                <p className="text-xl font-bold text-z-purple-glow">
                  {currentSignData?.name.replace(/_/g, ' ')}
                </p>
                {/* Level-1 hint — starts hidden; nothing shows until the player explicitly asks.
                    Level-2 (the clip) moved into the camera grid below, alongside the webcam. */}
                <AnimatePresence>
                  {hintLevel >= 1 && (
                    <motion.p key="hint1" className="text-xs text-z-gray-300 mt-2 border-t border-white/5 pt-2"
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                      {currentLine.hint}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile: stacked (hint clip once asked for, camera, stats). Desktop (lg+): same
                  three-column camera setup as Lesson/Practice — clip left (once the level-2 hint
                  is revealed), webcam center, stats right. */}
              <div
                className={`flex flex-col gap-4 lg:grid lg:gap-6 lg:items-start ${
                  hintLevel >= 2 ? 'lg:grid-cols-[320px_1fr_340px]' : 'lg:grid-cols-[1fr_340px]'
                }`}
              >
                <AnimatePresence>
                  {hintLevel >= 2 && (
                    <motion.div key="hint2" className="lg:order-1"
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                      <ReferenceClip
                        clipUrl={currentSignData?.clip}
                        signName={currentSignData?.name ?? currentLine.requiredSignId}
                        compact
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="lg:order-2">
                  <WebcamMirror
                    videoRef={videoRef}
                    cosmeticBorderClasses={cosmeticBorderClasses}
                    aspectClassName="aspect-[var(--cam-ar)] lg:aspect-[4/3]"
                  />
                </div>

                <div className="lg:order-3">
                  {/* Isolated 10 Hz subscriber — see LiveSignCoach/LessonPage notes. */}
                  <LiveSignCoach
                    subscribe={recognition.subscribeResult}
                    getSnapshot={recognition.getResultSnapshot}
                    sign={currentEngineSign}
                    subscribeHoldProgress={recognition.subscribeHoldProgress}
                    getHoldProgressSnapshot={recognition.getHoldProgressSnapshot}
                    fillHeight
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-1">
                {hintLevel < 2 && (
                  <motion.button onClick={handleHint}
                    className="flex-1 py-2 text-xs rounded-xl border border-z-purple/30 text-z-purple-light hover:border-z-purple/60 transition-colors"
                    whileTap={{ scale: 0.96 }}>
                    {hintLevel === 0 ? '💡 Hint' : '🎥 More hint'}
                  </motion.button>
                )}
                <motion.button onClick={handleSkip}
                  className="px-4 py-2 text-xs rounded-xl border border-z-gray-400/30 text-z-gray-400 hover:text-z-gray-50 transition-colors"
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
                <Zippy expression="tryagain" size="md" />
              ) : npcCostume ? (
                <Zippy expression={npcCostume} size="md" />
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
              ) : npcCostume ? (
                <Zippy expression={npcCostume} size="md" />
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
              ) : npcCostume ? (
                <Zippy expression={npcCostume} size="lg" />
              ) : (
                <motion.div className="text-6xl" animate={{ rotate: [0, -10, 10, -6, 0], y: [0, -8, 0] }}
                  transition={{ duration: 0.6, delay: 0.2 }}>🎬</motion.div>
              )}
              <h2 className="text-2xl font-bold">Story Complete!</h2>

              <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                <div className="bg-z-card rounded-2xl p-3 text-center border border-white/5">
                  <p className="text-xl font-bold text-z-yellow">{earnedXp}</p>
                  <p className="text-2xs text-z-gray-400 mt-0.5">XP earned</p>
                </div>
                <div className="bg-z-card rounded-2xl p-3 text-center border border-white/5">
                  <p className="text-xl font-bold text-z-purple-light">{earnedSigns}🤟</p>
                  <p className="text-2xs text-z-gray-400 mt-0.5">Signs</p>
                </div>
                <div className="bg-z-card rounded-2xl p-3 text-center border border-white/5">
                  <p className="text-xl font-bold text-z-yellow">{storyGold}🪙</p>
                  <p className="text-2xs text-z-gray-400 mt-0.5">Gold</p>
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

              <Button onClick={onExit} className="mt-2">
                Back to Home
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
      <ClassifierDevPanel status={classifierStatus} lastVote={lastVote} subscribe={recognition.subscribeResult} getSnapshot={recognition.getResultSnapshot} />
    </div>
  );
}
