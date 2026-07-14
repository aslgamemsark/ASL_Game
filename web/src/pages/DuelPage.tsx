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
import { isSignerForRound } from '@/lib/duelRoles';
import type { VerifyResult } from '@/engine/verifier';
import { ReportUserModal } from '@/components/shared/ReportUserModal';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { WebcamMirror } from '@/components/shared/WebcamMirror';
import { RemotePeerVideo } from '@/components/shared/RemotePeerVideo';
import { Scoreboard } from '@/components/multiplayer/Scoreboard';
import { RoundProgressDots } from '@/components/multiplayer/RoundProgressDots';
import { RoundResultCard } from '@/components/multiplayer/RoundResultCard';

type Phase = 'lobby' | 'waiting' | 'signer' | 'guesser' | 'result' | 'done' | 'waiting-reconnect';

interface MatchState {
  roomId: string;
  opponentId: string;
  opponentUsername: string;
  /** The opponent's equipped border id (synced over signaling), so their cosmetic renders on
   *  their video the same way ours renders on ours. '' / undefined = no border. */
  opponentBorder?: string;
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
const TURN_SECONDS = 10;
const RECONNECT_SECONDS = 30;

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
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const turnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const turnEndedRef = useRef(false);
  const [reconnectLeft, setReconnectLeft] = useState(RECONNECT_SECONDS);
  const [endedByForfeit, setEndedByForfeit] = useState(false);
  const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>('lobby');
  const phaseBeforeDisconnectRef = useRef<Phase>('signer');
  const wasConnectedRef = useRef(false);
  const handleOpponentLostRef = useRef<() => void>(() => {});
  useEffect(() => { phaseRef.current = phase; }, [phase]);

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

    const amSigner = isSignerForRound(user?.id ?? '', ms.opponentId, nextRound);
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
      const opBorder = (payload.border as string) ?? '';
      const signs = roundSignIdsRef.current;
      const firstSign = signs[0];
      const amSigner = isSignerForRound(user.id, opId, 1);
      setMatchState({ roomId: matchStateRef.current?.roomId ?? '', opponentId: opId, opponentUsername: opName, opponentBorder: opBorder, currentSign: firstSign, round: 1, myScore: 0, opponentScore: 0 });
      setPhase(amSigner ? 'signer' : 'guesser');
      if (!amSigner) buildGuessOptions(firstSign);
      void (async () => {
        await signaling.startCamera();
        await signaling.connectToPeer(opId);
        signaling.send('start', { signs, firstSign, hostId: user.id, border: equippedBorder ?? '' }, opId);
      })();
      return;
    }
    if (event === 'start') {
      if (startedRef.current || !user) return;
      startedRef.current = true;
      const hostId = payload.hostId as string;
      const signs = payload.signs as string[];
      const firstSign = payload.firstSign as string;
      const hostBorder = (payload.border as string) ?? '';
      setRoundSignIds(signs);
      const amSigner = isSignerForRound(user.id, hostId, 1);
      setMatchState((s) => ({ roomId: s?.roomId ?? '', opponentId: hostId, opponentUsername: 'Host', opponentBorder: hostBorder, currentSign: firstSign, round: 1, myScore: 0, opponentScore: 0 }));
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
    if (event === 'turn-timeout') {
      // The signer's clock ran out with no correct sign and no guess — nobody scores this round.
      if (!ms) return;
      enterResult(false, false, ms.currentSign, ms.opponentUsername);
      return;
    }
    if (event === 'bye') {
      handleOpponentLostRef.current();
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
    signaling.send('join', { username: username ?? user.email?.split('@')[0] ?? 'Player', border: equippedBorder ?? '' });
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

  // Per-turn 10s countdown for both the signer and guesser. Each client counts down locally from
  // the moment it enters the turn; the SIGNER is authoritative on expiry (it broadcasts
  // 'turn-timeout'), so the two clocks never need per-tick syncing — a little skew is invisible at
  // 10s, and the signer's broadcast ends the round on both sides. Re-armed every round.
  useEffect(() => {
    if (phase !== 'signer' && phase !== 'guesser') {
      if (turnIntervalRef.current) { clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; }
      return;
    }
    turnEndedRef.current = false;
    const startedAt = Date.now();
    setTimeLeft(TURN_SECONDS);
    turnIntervalRef.current = setInterval(() => {
      const remaining = TURN_SECONDS - (Date.now() - startedAt) / 1000;
      setTimeLeft(Math.max(0, remaining));
      if (remaining <= 0 && !turnEndedRef.current) {
        turnEndedRef.current = true;
        if (turnIntervalRef.current) { clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; }
        // Only the signer drives the timeout so the round isn't advanced twice; the guesser just
        // stops its own clock and waits for the 'turn-timeout' message.
        if (phase === 'signer') {
          const ms = matchStateRef.current;
          if (ms) {
            signaling.send('turn-timeout', {}, ms.opponentId);
            enterResult(false, false, ms.currentSign, ms.opponentUsername);
          }
        }
      }
    }, 100);
    return () => { if (turnIntervalRef.current) { clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, matchState?.round]);

  const clearReconnectTimers = useCallback(() => {
    if (reconnectIntervalRef.current) { clearInterval(reconnectIntervalRef.current); reconnectIntervalRef.current = null; }
    if (forfeitTimerRef.current) { clearTimeout(forfeitTimerRef.current); forfeitTimerRef.current = null; }
  }, []);

  useEffect(() => () => {
    recognition.stopLoop();
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    if (turnIntervalRef.current) clearInterval(turnIntervalRef.current);
    clearReconnectTimers();
  }, [clearReconnectTimers]);

  // Opponent forfeits by leaving: after RECONNECT_SECONDS with no reconnection, the staying player
  // wins outright and gets the normal win reward.
  const forfeitWin = useCallback(() => {
    clearReconnectTimers();
    setEndedByForfeit(true);
    setPhase('done');
    addSigns(200);
    addGold(10);
    sounds.levelUp();
    burst();
  }, [addGold, addSigns, burst, clearReconnectTimers, sounds]);

  // The opponent's connection came back within the window — resume where the match left off.
  // (Works for a transient WebRTC drop, where both clients still hold their match state.)
  const resumeAfterReconnect = useCallback(() => {
    clearReconnectTimers();
    setPhase(phaseBeforeDisconnectRef.current);
  }, [clearReconnectTimers]);

  // Opponent dropped mid-match (explicit 'bye' or a lost WebRTC connection). Show the waiting
  // banner + 30s countdown; arm the forfeit timer.
  const handleOpponentLost = useCallback(() => {
    const p = phaseRef.current;
    if (p !== 'signer' && p !== 'guesser' && p !== 'result') return; // only interrupt active play
    phaseBeforeDisconnectRef.current = p;
    setPhase('waiting-reconnect');
    setReconnectLeft(RECONNECT_SECONDS);
    clearReconnectTimers();
    reconnectIntervalRef.current = setInterval(() => setReconnectLeft((s) => Math.max(0, s - 1)), 1000);
    forfeitTimerRef.current = setTimeout(() => forfeitWin(), RECONNECT_SECONDS * 1000);
  }, [clearReconnectTimers, forfeitWin]);
  useEffect(() => { handleOpponentLostRef.current = handleOpponentLost; }, [handleOpponentLost]);

  const exit = () => {
    // Tell the opponent we're leaving so their client can start the reconnect/forfeit countdown
    // immediately instead of waiting for the WebRTC connection to time out.
    if (matchStateRef.current?.opponentId) signaling.send('bye', {}, matchStateRef.current.opponentId);
    recognition.stopLoop();
    clearReconnectTimers();
    signaling.leave();
    onExit();
  };

  const remoteStream = matchState ? signaling.peers[matchState.opponentId]?.stream ?? null : null;
  const remoteConnected = matchState ? signaling.peers[matchState.opponentId]?.connectionState === 'connected' : false;

  // Watch the opponent's WebRTC connection: a drop during active play starts the reconnect wait;
  // a recovery during the wait resumes the match. wasConnectedRef avoids firing on the initial
  // pre-connection state (connectionState is not 'connected' before the handshake completes).
  useEffect(() => {
    if (remoteConnected) {
      wasConnectedRef.current = true;
      if (phase === 'waiting-reconnect') resumeAfterReconnect();
    } else if (wasConnectedRef.current) {
      handleOpponentLost();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteConnected, phase]);

  const tryReconnect = () => {
    if (matchStateRef.current?.opponentId) void signaling.connectToPeer(matchStateRef.current.opponentId);
  };
  const opponentBorderClasses = matchState?.opponentBorder ? (getShopItem(matchState.opponentBorder)?.preview ?? '') : '';
  const timerPercent = (timeLeft / TURN_SECONDS) * 100;

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
                <p className="text-xs text-z-gray-400 mb-1">SIGN THIS · <span className={timeLeft <= 3 ? 'text-z-red font-bold' : ''}>{Math.ceil(timeLeft)}s</span></p>
                <p className="text-3xl font-bold text-z-purple-light">{SIGNS[matchState.currentSign]?.name.replace(/_/g, ' ') ?? matchState.currentSign}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <WebcamMirror videoRef={signaling.localVideoRef} label="You" cosmeticBorderClasses={cosmeticBorderClasses} activeTurn turnLabel="YOUR TURN" timerPercent={timerPercent} />
                <RemotePeerVideo stream={remoteStream} label={matchState.opponentUsername} connected={remoteConnected} cosmeticBorderClasses={opponentBorderClasses} />
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
                <RemotePeerVideo stream={remoteStream} label={`${matchState.opponentUsername} — signing`} connected={remoteConnected} cosmeticBorderClasses={opponentBorderClasses} activeTurn turnLabel={`${matchState.opponentUsername}'s turn`} timerPercent={timerPercent} />
                <WebcamMirror videoRef={signaling.localVideoRef} label="You" cosmeticBorderClasses={cosmeticBorderClasses} />
              </div>
              <p className="text-center font-bold">What are they signing? · <span className={timeLeft <= 3 ? 'text-z-red' : 'text-z-gray-400'}>{Math.ceil(timeLeft)}s</span></p>
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

          {phase === 'waiting-reconnect' && matchState && (
            <motion.div key="waiting-reconnect" className="flex-1 flex flex-col items-center justify-center gap-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <motion.div className="text-5xl" animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>📡</motion.div>
              <h2 className="text-xl font-bold text-center">{matchState.opponentUsername} disconnected</h2>
              <p className="text-z-gray-400 text-sm text-center">Waiting for them to reconnect…</p>
              <p className="text-4xl font-bold text-z-purple-light">{reconnectLeft}s</p>
              <p className="text-z-gray-500 text-xs text-center">If they don't come back, you win.</p>
            </motion.div>
          )}

          {phase === 'done' && matchState && (() => {
            const iWon = endedByForfeit || matchState.myScore > matchState.opponentScore;
            const draw = !endedByForfeit && matchState.myScore === matchState.opponentScore;
            return (
            <motion.div key="done" className="flex-1 flex flex-col items-center justify-center gap-5"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="text-5xl">{iWon ? '🏆' : draw ? '🤝' : '😅'}</div>
              <h2 className="text-2xl font-bold">
                {iWon ? 'You Won!' : draw ? 'Draw!' : 'You Lost'}
              </h2>
              {endedByForfeit && (
                <p className="text-z-gray-400 text-sm -mt-3">{matchState.opponentUsername} left the match</p>
              )}
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
              {iWon && (
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
            );
          })()}

        </AnimatePresence>
      </div>

      {/* Bottom-middle reconnect banner — the user's requested "option to reconnect (bottom middle
          of page)" — lets the staying player re-attempt the WebRTC handshake for a transient drop
          while the 30s forfeit countdown runs. */}
      {phase === 'waiting-reconnect' && matchState && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-z-card border border-z-purple/40 rounded-2xl px-5 py-3 shadow-xl flex items-center gap-4">
          <span className="text-sm font-semibold">Opponent left — {reconnectLeft}s</span>
          <button onClick={tryReconnect}
            className="px-3.5 py-1.5 rounded-xl bg-z-purple text-white text-xs font-bold">
            Reconnect
          </button>
          <button onClick={exit} className="text-xs text-z-gray-400 hover:text-white">Leave</button>
        </div>
      )}

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
