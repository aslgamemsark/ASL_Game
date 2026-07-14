import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRecognition } from '@/hooks/useRecognition';
import { useSounds } from '@/hooks/useSounds';
import { useConfetti } from '@/hooks/useConfetti';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiplayerSignaling } from '@/hooks/useMultiplayerSignaling';
import { SIGNS as ENGINE_SIGNS } from '@/engine/signs/index';
import { SIGNS } from '@/data/signs';
import { getShopItem } from '@/data/shop';
import type { VerifyResult } from '@/engine/verifier';
import { ReportUserModal } from '@/components/shared/ReportUserModal';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { WebcamMirror } from '@/components/shared/WebcamMirror';
import { RemotePeerVideo } from '@/components/shared/RemotePeerVideo';
import { Scoreboard } from '@/components/multiplayer/Scoreboard';
import { RoundProgressDots } from '@/components/multiplayer/RoundProgressDots';
import { RoundResultCard } from '@/components/multiplayer/RoundResultCard';

type Phase = 'lobby' | 'waiting' | 'signer' | 'guesser' | 'result' | 'done';

interface MatchState {
  roomId: string;
  opponentId: string;
  opponentUsername: string;
  currentSign: string;
  round: number;
  myScore: number;
  opponentScore: number;
}

interface ResultData {
  correctSignName: string;
  scoreDeltas: { label: string; delta: number }[];
}

interface Props {
  onExit: () => void;
  /** When set, auto-creates a room with this ID and waits for the opponent (challenger flow). */
  autoHostRoomId?: string;
  /** When set, auto-joins this room code (challenged-player flow). */
  autoJoinCode?: string;
}

const ALL_SIGNS = Object.keys(SIGNS);
const ROUNDS = 5;
const RESULT_HOLD_MS = 1500;

function pickSigns(n: number): string[] {
  const shuffled = [...ALL_SIGNS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function DuelPage({ onExit, autoHostRoomId, autoJoinCode }: Props) {
  const { user, username } = useAuth();
  const { addSigns, addGold, equippedBorder } = useUserStore();
  const cosmeticBorderClasses = equippedBorder ? (getShopItem(equippedBorder)?.preview ?? '') : '';
  const sounds = useSounds();
  const { burst } = useConfetti();
  const recognition = useRecognition({ onPass: handleSignCorrect });

  const [phase, setPhase] = useState<Phase>('lobby');
  const [reportOpen, setReportOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const matchStateRef = useRef<MatchState | null>(null);
  const [roundSignIds, setRoundSignIds] = useState<string[]>([]);
  const roundSignIdsRef = useRef<string[]>([]);
  const [guessOptions, setGuessOptions] = useState<string[]>([]);
  const [guessResult, setGuessResult] = useState<'correct' | 'wrong' | null>(null);
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [opponentSigned, setOpponentSigned] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const loopRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { matchStateRef.current = matchState; }, [matchState]);
  useEffect(() => { roundSignIdsRef.current = roundSignIds; }, [roundSignIds]);

  useEffect(() => {
    recognition.init();
  }, [recognition.init]);

  const buildGuessOptions = useCallback((signId: string) => {
    const distractors = ALL_SIGNS.filter((s) => s !== signId).sort(() => Math.random() - 0.5).slice(0, 3);
    const opts = [signId, ...distractors].sort(() => Math.random() - 0.5);
    setGuessOptions(opts);
  }, []);

  const advanceRound = useCallback((iScored: boolean, opponentScored: boolean) => {
    const ms = matchStateRef.current;
    if (!ms) return;
    const nextRound = ms.round + 1;
    const myNewScore = ms.myScore + (iScored ? 1 : 0);
    const opNewScore = ms.opponentScore + (opponentScored ? 1 : 0);

    if (nextRound > ROUNDS) {
      setMatchState((s) => s ? { ...s, myScore: myNewScore, opponentScore: opNewScore } : s);
      setPhase('done');
      if (myNewScore > opNewScore) {
        addSigns(200);
        addGold(10);
        sounds.levelUp();
        burst();
      }
      return;
    }

    const nextSign = roundSignIdsRef.current[nextRound - 1] ?? ALL_SIGNS[0];
    setMatchState((s) => s ? { ...s, round: nextRound, myScore: myNewScore, opponentScore: opNewScore, currentSign: nextSign } : s);
    setOpponentSigned(false);
    setGuessResult(null);
    setResultData(null);

    const amSigner = nextRound % 2 === ((user?.id ?? '') < ms.opponentId ? 1 : 0);
    setPhase(amSigner ? 'signer' : 'guesser');
    if (!amSigner) buildGuessOptions(nextSign);
  }, [addGold, addSigns, buildGuessOptions, burst, sounds, user?.id]);

  const enterResult = useCallback((iScored: boolean, opponentScored: boolean, signId: string, opponentUsername: string) => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    setResultData({
      correctSignName: SIGNS[signId]?.name ?? signId,
      scoreDeltas: [
        { label: 'You', delta: iScored ? 1 : 0 },
        { label: opponentUsername, delta: opponentScored ? 1 : 0 },
      ],
    });
    setPhase('result');
    resultTimerRef.current = setTimeout(() => advanceRound(iScored, opponentScored), RESULT_HOLD_MS);
  }, [advanceRound]);

  function handleSignCorrect(_r: VerifyResult) {
    const ms = matchStateRef.current;
    if (phase !== 'signer' || !ms) return;
    sounds.correct();
    signaling.send('signed', { signId: ms.currentSign }, ms.opponentId);
    enterResult(true, false, ms.currentSign, ms.opponentUsername);
  }

  const handleMessage = useCallback((event: string, payload: Record<string, unknown>, fromPeerId: string) => {
    const ms = matchStateRef.current;
    if (event === 'join') {
      if (startedRef.current || !user) return;
      startedRef.current = true;
      const opId = fromPeerId;
      const opName = (payload.username as string) ?? 'Opponent';
      const signs = roundSignIdsRef.current;
      const firstSign = signs[0];
      const amSigner = user.id < opId;
      setMatchState({ roomId: matchStateRef.current?.roomId ?? '', opponentId: opId, opponentUsername: opName, currentSign: firstSign, round: 1, myScore: 0, opponentScore: 0 });
      setPhase(amSigner ? 'signer' : 'guesser');
      if (!amSigner) buildGuessOptions(firstSign);
      void (async () => {
        await signaling.startCamera();
        await signaling.connectToPeer(opId);
        signaling.send('start', { signs, firstSign, hostId: user.id }, opId);
      })();
      return;
    }
    if (event === 'start') {
      if (startedRef.current || !user) return;
      startedRef.current = true;
      const hostId = payload.hostId as string;
      const signs = payload.signs as string[];
      const firstSign = payload.firstSign as string;
      setRoundSignIds(signs);
      const amSigner = user.id > hostId;
      setMatchState((s) => ({ roomId: s?.roomId ?? '', opponentId: hostId, opponentUsername: 'Host', currentSign: firstSign, round: 1, myScore: 0, opponentScore: 0 }));
      setPhase(amSigner ? 'signer' : 'guesser');
      if (!amSigner) buildGuessOptions(firstSign);
      return;
    }
    if (event === 'signed') {
      if (!ms) return;
      setOpponentSigned(true);
      enterResult(false, true, ms.currentSign, ms.opponentUsername);
      return;
    }
    if (event === 'guess') {
      if (!ms) return;
      const correct = payload.signId === ms.currentSign;
      enterResult(false, correct, ms.currentSign, ms.opponentUsername);
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildGuessOptions, enterResult, user]);

  const signaling = useMultiplayerSignaling({ selfPeerId: user?.id ?? '', onMessage: handleMessage });

  useEffect(() => {
    if (autoHostRoomId) void createRoom(autoHostRoomId);
    else if (autoJoinCode) void joinRoom(autoJoinCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = async (overrideRoomId?: string) => {
    if (!user) return;
    const roomId = overrideRoomId ?? Math.random().toString(36).slice(2, 8).toUpperCase();
    const signs = pickSigns(ROUNDS);
    setRoundSignIds(signs);
    setMatchState((s) => ({ ...(s ?? { opponentId: '', opponentUsername: '', currentSign: '', round: 1, myScore: 0, opponentScore: 0 }), roomId }));
    setStatusMsg(`Room code: ${roomId} — Share with a friend!`);
    setPhase('waiting');
    await signaling.join(`mp-room-${roomId}`);
  };

  const joinRoom = async (overrideCode?: string) => {
    if (!user) return;
    const code = overrideCode ?? joinCode;
    if (!code.trim()) return;
    const roomId = code.trim().toUpperCase();
    setPhase('waiting');
    setStatusMsg('Joining room…');
    setMatchState((s) => ({ ...(s ?? { opponentId: '', opponentUsername: '', currentSign: '', round: 1, myScore: 0, opponentScore: 0 }), roomId }));
    await signaling.join(`mp-room-${roomId}`);
    await signaling.startCamera();
    signaling.send('join', { username: username ?? user.email?.split('@')[0] ?? 'Player' });
    setStatusMsg('Connected! Waiting for host…');
  };

  const handleGuess = (signId: string) => {
    if (!matchState || guessResult) return;
    const correct = signId === matchState.currentSign;
    setGuessResult(correct ? 'correct' : 'wrong');
    if (correct) sounds.correct(); else sounds.wrong();
    signaling.send('guess', { signId }, matchState.opponentId);
    setTimeout(() => enterResult(correct, opponentSigned, matchState.currentSign, matchState.opponentUsername), 400);
  };

  useEffect(() => {
    if (phase !== 'signer') { if (loopRef.current) { recognition.stopLoop(); loopRef.current = null; } return; }
    if (signaling.camStatus === 'active' && matchState?.currentSign && signaling.localVideoRef.current) {
      const engineSign = ENGINE_SIGNS[matchState.currentSign];
      if (engineSign && loopRef.current !== engineSign.name) {
        recognition.stopLoop();
        recognition.startLoop(signaling.localVideoRef.current, engineSign);
        loopRef.current = engineSign.name;
      }
    }
  });

  useEffect(() => () => { recognition.stopLoop(); if (resultTimerRef.current) clearTimeout(resultTimerRef.current); }, []);

  const exit = () => { recognition.stopLoop(); signaling.leave(); onExit(); };

  const remoteStream = matchState ? signaling.peers[matchState.opponentId]?.stream ?? null : null;
  const remoteConnected = matchState ? signaling.peers[matchState.opponentId]?.connectionState === 'connected' : false;

  return (
    <div className="min-h-screen bg-z-bg flex flex-col">
      <video ref={signaling.localVideoRef} style={{ width: 0, height: 0, opacity: 0, position: 'fixed', pointerEvents: 'none' }} muted playsInline autoPlay />

      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton icon="close" onClick={exit} />
        <h1 className="font-bold text-lg">⚔️ 1v1 Duel</h1>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 pb-6 flex flex-col">
        <AnimatePresence mode="wait">

          {phase === 'lobby' && (
            <motion.div key="lobby" className="flex-1 flex flex-col items-center justify-center gap-6"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-6xl">🤟</div>
              <div className="text-center">
                <h2 className="text-2xl font-bold">Sign & Guess</h2>
                <p className="text-z-gray-300 text-sm mt-1">Sign it, your friend guesses it.</p>
              </div>
              <motion.button onClick={() => createRoom()}
                className="w-full max-w-xs py-3 rounded-2xl font-bold text-white bg-gradient-primary"
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                Create Room
              </motion.button>
              <div className="w-full max-w-xs">
                <p className="text-center text-z-gray-400 text-sm mb-2">— or join with a code —</p>
                <div className="flex gap-2">
                  <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="XXXXXX"
                    className="flex-1 bg-z-card border border-white/10 rounded-2xl px-4 py-2.5 text-sm uppercase tracking-widest font-bold text-center focus:outline-none focus:border-z-purple/60" />
                  <motion.button onClick={() => joinRoom()} disabled={!joinCode.trim()}
                    className="px-4 py-2.5 bg-z-purple rounded-2xl text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    whileTap={{ scale: 0.96 }}>
                    Join
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {phase === 'waiting' && (
            <motion.div key="waiting" className="flex-1 flex flex-col items-center justify-center gap-5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <motion.div className="text-5xl" animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>⚙️</motion.div>
              <p className="font-bold text-lg text-center">{statusMsg || 'Waiting…'}</p>
              {matchState?.roomId && (
                <div className="bg-z-card border border-white/10 rounded-2xl px-8 py-4 text-center">
                  <p className="text-xs text-z-gray-400 mb-1">Room Code</p>
                  <p className="text-3xl font-bold tracking-widest text-z-purple-light">{matchState.roomId}</p>
                </div>
              )}
            </motion.div>
          )}

          {phase === 'signer' && matchState && (
            <motion.div key="signer" className="flex-1 flex flex-col gap-4 pt-4"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center justify-between">
                <RoundProgressDots total={ROUNDS} current={matchState.round} />
                <Scoreboard entries={[{ label: 'You', score: matchState.myScore, isYou: true }, { label: matchState.opponentUsername, score: matchState.opponentScore, isYou: false }]} />
              </div>
              <div className="bg-z-card border border-z-purple/30 rounded-2xl p-4 text-center">
                <p className="text-xs text-z-gray-400 mb-1">SIGN THIS</p>
                <p className="text-3xl font-bold text-z-purple-light">{SIGNS[matchState.currentSign]?.name.replace(/_/g, ' ') ?? matchState.currentSign}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <WebcamMirror videoRef={signaling.localVideoRef} label="You" cosmeticBorderClasses={cosmeticBorderClasses} />
                <RemotePeerVideo stream={remoteStream} label={matchState.opponentUsername} connected={remoteConnected} />
              </div>
              {signaling.camStatus === 'denied' && (
                <p className="text-center text-xs text-z-red">Camera access denied — your opponent won't see your video.</p>
              )}
              <p className="text-center text-z-gray-400 text-sm">Sign it — your friend guesses!</p>
            </motion.div>
          )}

          {phase === 'guesser' && matchState && (
            <motion.div key="guesser" className="flex-1 flex flex-col gap-5 pt-4"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center justify-between">
                <RoundProgressDots total={ROUNDS} current={matchState.round} />
                <Scoreboard entries={[{ label: 'You', score: matchState.myScore, isYou: true }, { label: matchState.opponentUsername, score: matchState.opponentScore, isYou: false }]} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RemotePeerVideo stream={remoteStream} label={`${matchState.opponentUsername} — signing`} connected={remoteConnected} />
                <WebcamMirror videoRef={signaling.localVideoRef} label="You" cosmeticBorderClasses={cosmeticBorderClasses} />
              </div>
              <p className="text-center font-bold">What are they signing?</p>
              <div className="grid grid-cols-2 gap-3">
                {guessOptions.map((s) => (
                  <motion.button key={s} onClick={() => handleGuess(s)}
                    disabled={!!guessResult}
                    className={`py-4 rounded-2xl font-bold text-sm border transition-colors ${
                      guessResult
                        ? s === matchState.currentSign
                          ? 'bg-z-green/20 border-z-green text-z-green'
                          : 'border-white/8 text-z-gray-400'
                        : 'bg-z-card border-white/10 hover:border-z-purple/40 text-white'
                    }`}
                    whileTap={{ scale: 0.97 }}>
                    {SIGNS[s]?.name.replace(/_/g, ' ') ?? s}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'result' && matchState && resultData && (
            <motion.div key="result" className="flex-1 flex flex-col items-center justify-center gap-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Scoreboard entries={[{ label: 'You', score: matchState.myScore, isYou: true }, { label: matchState.opponentUsername, score: matchState.opponentScore, isYou: false }]} />
              <RoundResultCard correctSignName={resultData.correctSignName} scoreDeltas={resultData.scoreDeltas} />
            </motion.div>
          )}

          {phase === 'done' && matchState && (
            <motion.div key="done" className="flex-1 flex flex-col items-center justify-center gap-5"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="text-5xl">{matchState.myScore > matchState.opponentScore ? '🏆' : matchState.myScore === matchState.opponentScore ? '🤝' : '😅'}</div>
              <h2 className="text-2xl font-bold">
                {matchState.myScore > matchState.opponentScore ? 'You Won!' : matchState.myScore === matchState.opponentScore ? 'Draw!' : 'You Lost'}
              </h2>
              <div className="bg-z-card border border-white/8 rounded-2xl p-5 w-full max-w-xs">
                <div className="flex justify-between items-center">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-z-purple-light">{matchState.myScore}</p>
                    <p className="text-xs text-z-gray-400 mt-0.5">You</p>
                  </div>
                  <span className="text-z-gray-500 font-bold">vs</span>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-z-gray-200">{matchState.opponentScore}</p>
                    <p className="text-xs text-z-gray-400 mt-0.5">{matchState.opponentUsername}</p>
                  </div>
                </div>
              </div>
              {matchState.myScore > matchState.opponentScore && (
                <p className="text-z-yellow font-bold">+200 🤟 Signs · +10 🪙 Gold</p>
              )}
              <motion.button onClick={exit}
                className="px-8 py-3 rounded-2xl font-bold text-white bg-gradient-primary"
                whileTap={{ scale: 0.97 }}>
                Back to Home
              </motion.button>
              <button onClick={() => setReportOpen(true)}
                className="text-xs text-z-gray-500 hover:text-z-red transition-colors">
                🚩 Report {matchState.opponentUsername}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {user && reportOpen && matchState && (
        <ReportUserModal
          reporterId={user.id}
          reportedId={matchState.opponentId}
          reportedUsername={matchState.opponentUsername}
          context="multiplayer"
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
