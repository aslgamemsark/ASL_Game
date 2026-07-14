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
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { WebcamMirror } from '@/components/shared/WebcamMirror';
import { RemotePeerVideo } from '@/components/shared/RemotePeerVideo';
import { Scoreboard } from '@/components/multiplayer/Scoreboard';
import { RoundProgressDots } from '@/components/multiplayer/RoundProgressDots';
import { RoundResultCard } from '@/components/multiplayer/RoundResultCard';

type Phase = 'lobby' | 'waitingRoom' | 'signing' | 'guessing' | 'roundResult' | 'finalResults';

interface RosterMember {
  peerId: string;
  username: string;
  joinOrder: number;
}

interface ResultData {
  correctSignName: string;
  scoreDeltas: { label: string; delta: number }[];
}

interface Props {
  onExit: () => void;
}

const ALL_SIGNS = Object.keys(SIGNS);
const MAX_PLAYERS = 4;
const ROUNDS_PER_PLAYER = 2;
const ROUND_TIMEOUT_MS = 15000;
const RESULT_HOLD_MS = 1500;

function pickSigns(n: number): string[] {
  const shuffled = [...ALL_SIGNS].sort(() => Math.random() - 0.5);
  return Array.from({ length: n }, (_, i) => shuffled[i % shuffled.length]);
}

export function RoomPage({ onExit }: Props) {
  const { user, username } = useAuth();
  const { addSigns, addGold, equippedBorder } = useUserStore();
  const cosmeticBorderClasses = equippedBorder ? (getShopItem(equippedBorder)?.preview ?? '') : '';
  const sounds = useSounds();
  const { burst } = useConfetti();
  const recognition = useRecognition({ onPass: handleSignCorrect });

  const [phase, setPhase] = useState<Phase>('lobby');
  const [joinCode, setJoinCode] = useState('');
  const [roomId, setRoomId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [signerPeerId, setSignerPeerId] = useState<string | null>(null);
  const [currentSignId, setCurrentSignId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [guessOptions, setGuessOptions] = useState<string[]>([]);
  const [myGuess, setMyGuess] = useState<string | null>(null);
  const [resultData, setResultData] = useState<ResultData | null>(null);

  const rosterRef = useRef<RosterMember[]>([]);
  const turnOrderRef = useRef<string[]>([]);
  const signsRef = useRef<string[]>([]);
  const totalRoundsRef = useRef(0);
  const roundRef = useRef(0);
  const currentSignIdRef = useRef<string | null>(null);
  const signerPeerIdRef = useRef<string | null>(null);
  const scoresRef = useRef<Record<string, number>>({});
  const isHostRef = useRef(false);
  const guessesThisRoundRef = useRef<Record<string, string>>({});
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signingConnectionsRef = useRef<string[]>([]);
  const loopRef = useRef<string | null>(null);

  useEffect(() => { rosterRef.current = roster; }, [roster]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);

  useEffect(() => {
    recognition.init();
  }, [recognition.init]);

  const buildGuessOptions = useCallback((signId: string) => {
    const distractors = ALL_SIGNS.filter((s) => s !== signId).sort(() => Math.random() - 0.5).slice(0, 3);
    setGuessOptions([signId, ...distractors].sort(() => Math.random() - 0.5));
  }, []);

  const usernameFor = useCallback((peerId: string) => {
    if (peerId === user?.id) return 'You';
    return rosterRef.current.find((m) => m.peerId === peerId)?.username ?? 'Player';
  }, [user?.id]);

  // Begins a round locally — called directly by the host (whose own broadcasts never loop back
  // to itself) and via the 'round-start' message handler for everyone else.
  const beginRound = useCallback((roundNum: number, signer: string, signId: string) => {
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    guessesThisRoundRef.current = {};

    // I was signing last round and no longer am — tear down the outbound connections I opened.
    if (signingConnectionsRef.current.length > 0 && signerPeerIdRef.current !== signer) {
      signingConnectionsRef.current.forEach((peerId) => signaling.disconnectFromPeer(peerId));
      signingConnectionsRef.current = [];
    }

    roundRef.current = roundNum;
    signerPeerIdRef.current = signer;
    currentSignIdRef.current = signId;
    setRound(roundNum);
    setSignerPeerId(signer);
    setCurrentSignId(signId);
    setMyGuess(null);
    setResultData(null);

    const amSigner = signer === user?.id;
    setPhase(amSigner ? 'signing' : 'guessing');
    if (amSigner) {
      const others = rosterRef.current.map((m) => m.peerId).filter((id) => id !== user?.id);
      signingConnectionsRef.current = others;
      others.forEach((peerId) => void signaling.connectToPeer(peerId));
    } else {
      buildGuessOptions(signId);
    }

    if (isHostRef.current) {
      roundTimerRef.current = setTimeout(() => endRound(), ROUND_TIMEOUT_MS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildGuessOptions, user?.id]);

  const applyRoundEnd = useCallback((roundNum: number, scoreDeltas: Record<string, number>) => {
    setScores((prev) => {
      const next = { ...prev };
      for (const [pid, delta] of Object.entries(scoreDeltas)) next[pid] = (next[pid] ?? 0) + delta;
      return next;
    });
    setResultData({
      correctSignName: SIGNS[currentSignIdRef.current ?? '']?.name ?? currentSignIdRef.current ?? '',
      scoreDeltas: rosterRef.current.map((m) => ({ label: usernameFor(m.peerId), delta: scoreDeltas[m.peerId] ?? 0 })),
    });
    setPhase('roundResult');

    if (isHostRef.current) {
      resultTimerRef.current = setTimeout(() => {
        const nextRound = roundNum + 1;
        if (nextRound > totalRoundsRef.current) {
          const finalScores = { ...scoresRef.current };
          for (const [pid, delta] of Object.entries(scoreDeltas)) finalScores[pid] = (finalScores[pid] ?? 0) + delta;
          signaling.send('game-over', { finalScores });
          applyGameOver();
          return;
        }
        const order = turnOrderRef.current;
        const nextSigner = order[(nextRound - 1) % order.length];
        const nextSignId = signsRef.current[nextRound - 1];
        signaling.send('round-start', { round: nextRound, signerPeerId: nextSigner, signId: nextSignId, startedAt: Date.now() });
        beginRound(nextRound, nextSigner, nextSignId);
      }, RESULT_HOLD_MS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beginRound, usernameFor]);

  const applyGameOver = useCallback(() => {
    setPhase('finalResults');
    const myScore = scoresRef.current[user?.id ?? ''] ?? 0;
    const best = Math.max(0, ...Object.values(scoresRef.current));
    if (myScore > 0 && myScore >= best) {
      addSigns(150);
      addGold(8);
      sounds.levelUp();
      burst();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const endRound = useCallback(() => {
    if (roundTimerRef.current) { clearTimeout(roundTimerRef.current); roundTimerRef.current = null; }
    const signId = currentSignIdRef.current;
    const deltas: Record<string, number> = {};
    for (const [pid, guessedSignId] of Object.entries(guessesThisRoundRef.current)) {
      if (guessedSignId === signId) deltas[pid] = 1;
    }
    signaling.send('round-end', { round: roundRef.current, scoreDeltas: deltas });
    applyRoundEnd(roundRef.current, deltas);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyRoundEnd]);

  function handleSignCorrect(_r: VerifyResult) {
    // Signing correctly doesn't auto-score in Room mode (guessers earn the points) — it's purely
    // the cue that recognition is working; scoring is entirely guess-driven, tallied by the host.
    sounds.correct();
  }

  const handleMessage = useCallback((event: string, payload: Record<string, unknown>, fromPeerId: string) => {
    if (event === 'roster-join') {
      if (!isHostRef.current) return;
      const already = rosterRef.current.some((m) => m.peerId === fromPeerId);
      if (already || rosterRef.current.length >= MAX_PLAYERS) return;
      const next = [...rosterRef.current, { peerId: fromPeerId, username: (payload.username as string) ?? 'Player', joinOrder: rosterRef.current.length }];
      setRoster(next);
      signaling.send('roster', { members: next });
      return;
    }
    if (event === 'roster') {
      setRoster(payload.members as RosterMember[]);
      return;
    }
    if (event === 'game-start') {
      const signs = payload.signs as string[];
      const turnOrder = payload.turnOrder as string[];
      signsRef.current = signs;
      turnOrderRef.current = turnOrder;
      totalRoundsRef.current = signs.length;
      setTotalRounds(signs.length);
      return;
    }
    if (event === 'round-start') {
      beginRound(payload.round as number, payload.signerPeerId as string, payload.signId as string);
      return;
    }
    if (event === 'guess') {
      if (!isHostRef.current) return;
      if (payload.round !== roundRef.current) return;
      if (guessesThisRoundRef.current[fromPeerId]) return;
      guessesThisRoundRef.current[fromPeerId] = payload.signId as string;
      const nonSignerCount = rosterRef.current.length - 1;
      if (Object.keys(guessesThisRoundRef.current).length >= nonSignerCount) endRound();
      return;
    }
    if (event === 'round-end') {
      applyRoundEnd(payload.round as number, payload.scoreDeltas as Record<string, number>);
      return;
    }
    if (event === 'game-over') {
      applyGameOver();
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyGameOver, applyRoundEnd, beginRound, endRound]);

  const signaling = useMultiplayerSignaling({ selfPeerId: user?.id ?? '', onMessage: handleMessage });

  const createRoom = async () => {
    if (!user) return;
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    isHostRef.current = true;
    setRoomId(code);
    const me = { peerId: user.id, username: username ?? 'Host', joinOrder: 0 };
    setRoster([me]);
    rosterRef.current = [me];
    setStatusMsg(`Room code: ${code} — share with up to 3 friends!`);
    setPhase('waitingRoom');
    await signaling.join(`mp-room-${code}`);
    await signaling.startCamera();
  };

  const joinRoom = async () => {
    if (!user || !joinCode.trim()) return;
    const code = joinCode.trim().toUpperCase();
    isHostRef.current = false;
    setRoomId(code);
    setStatusMsg('Joining room…');
    setPhase('waitingRoom');
    await signaling.join(`mp-room-${code}`);
    await signaling.startCamera();
    signaling.send('roster-join', { username: username ?? user.email?.split('@')[0] ?? 'Player' });
    setStatusMsg('Connected! Waiting for host to start…');
  };

  const startGame = () => {
    const order = rosterRef.current.map((m) => m.peerId);
    const signs = pickSigns(order.length * ROUNDS_PER_PLAYER);
    turnOrderRef.current = order;
    signsRef.current = signs;
    totalRoundsRef.current = signs.length;
    setTotalRounds(signs.length);
    signaling.send('game-start', { signs, turnOrder: order });
    signaling.send('round-start', { round: 1, signerPeerId: order[0], signId: signs[0], startedAt: Date.now() });
    beginRound(1, order[0], signs[0]);
  };

  const handleGuess = (signId: string) => {
    if (myGuess || !currentSignId) return;
    setMyGuess(signId);
    if (signId === currentSignId) sounds.correct(); else sounds.wrong();
    if (isHostRef.current) {
      guessesThisRoundRef.current[user?.id ?? ''] = signId;
      const nonSignerCount = rosterRef.current.length - 1;
      if (Object.keys(guessesThisRoundRef.current).length >= nonSignerCount) endRound();
    } else {
      signaling.send('guess', { round, signId });
    }
  };

  useEffect(() => {
    if (phase !== 'signing') { if (loopRef.current) { recognition.stopLoop(); loopRef.current = null; } return; }
    if (signaling.camStatus === 'active' && currentSignId && signaling.localVideoRef.current) {
      const engineSign = ENGINE_SIGNS[currentSignId];
      if (engineSign && loopRef.current !== engineSign.name) {
        recognition.stopLoop();
        recognition.startLoop(signaling.localVideoRef.current, engineSign);
        loopRef.current = engineSign.name;
      }
    }
  });

  useEffect(() => () => {
    recognition.stopLoop();
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
  }, []);

  const exit = () => { recognition.stopLoop(); signaling.leave(); onExit(); };

  const scoreboardEntries = roster.map((m) => ({ label: usernameFor(m.peerId), score: scores[m.peerId] ?? 0, isYou: m.peerId === user?.id }));

  return (
    <div className="min-h-screen bg-z-bg flex flex-col">
      <video ref={signaling.localVideoRef} style={{ width: 0, height: 0, opacity: 0, position: 'fixed', pointerEvents: 'none' }} muted playsInline autoPlay />

      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton icon="close" onClick={exit} />
        <h1 className="font-bold text-lg">👥 Group Room</h1>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 pb-6 flex flex-col">
        <AnimatePresence mode="wait">

          {phase === 'lobby' && (
            <motion.div key="lobby" className="flex-1 flex flex-col items-center justify-center gap-6"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-6xl">👥</div>
              <div className="text-center">
                <h2 className="text-2xl font-bold">Group Sign & Guess</h2>
                <p className="text-z-gray-300 text-sm mt-1">Up to 4 players — one signs, everyone else guesses.</p>
              </div>
              <motion.button onClick={() => void createRoom()}
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
                  <motion.button onClick={() => void joinRoom()} disabled={!joinCode.trim()}
                    className="px-4 py-2.5 bg-z-purple rounded-2xl text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    whileTap={{ scale: 0.96 }}>
                    Join
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {phase === 'waitingRoom' && (
            <motion.div key="waitingRoom" className="flex-1 flex flex-col items-center justify-center gap-5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="font-bold text-lg text-center">{statusMsg || 'Waiting…'}</p>
              {roomId && (
                <div className="bg-z-card border border-white/10 rounded-2xl px-8 py-4 text-center">
                  <p className="text-xs text-z-gray-400 mb-1">Room Code</p>
                  <p className="text-3xl font-bold tracking-widest text-z-purple-light">{roomId}</p>
                </div>
              )}
              <div className="w-full max-w-xs bg-z-card border border-white/8 rounded-2xl p-4">
                <p className="text-xs text-z-gray-400 uppercase tracking-widest mb-2">Players ({roster.length}/{MAX_PLAYERS})</p>
                <div className="flex flex-col gap-1.5">
                  {roster.map((m) => (
                    <p key={m.peerId} className="text-sm font-semibold">{m.peerId === user?.id ? 'You' : m.username}</p>
                  ))}
                </div>
              </div>
              {isHostRef.current && (
                <motion.button onClick={startGame} disabled={roster.length < 2}
                  className="px-8 py-3 rounded-2xl font-bold text-white bg-gradient-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  whileTap={{ scale: 0.97 }}>
                  Start Game
                </motion.button>
              )}
            </motion.div>
          )}

          {phase === 'signing' && currentSignId && (
            <motion.div key="signing" className="flex-1 flex flex-col gap-4 pt-4"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center justify-between">
                <RoundProgressDots total={totalRounds} current={round} />
                <Scoreboard entries={scoreboardEntries} />
              </div>
              <div className="bg-z-card border border-z-purple/30 rounded-2xl p-4 text-center">
                <p className="text-xs text-z-gray-400 mb-1">SIGN THIS</p>
                <p className="text-3xl font-bold text-z-purple-light">{SIGNS[currentSignId]?.name.replace(/_/g, ' ') ?? currentSignId}</p>
              </div>
              <WebcamMirror videoRef={signaling.localVideoRef} label="You" cosmeticBorderClasses={cosmeticBorderClasses} />
              <p className="text-center text-z-gray-400 text-sm">Sign it — everyone else guesses!</p>
            </motion.div>
          )}

          {phase === 'guessing' && currentSignId && (
            <motion.div key="guessing" className="flex-1 flex flex-col gap-4 pt-4"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center justify-between">
                <RoundProgressDots total={totalRounds} current={round} />
                <Scoreboard entries={scoreboardEntries} />
              </div>
              <RemotePeerVideo
                stream={signerPeerId ? signaling.peers[signerPeerId]?.stream ?? null : null}
                label={`${usernameFor(signerPeerId ?? '')} — signing`}
                connected={signerPeerId ? signaling.peers[signerPeerId]?.connectionState === 'connected' : false}
              />
              <p className="text-center font-bold">What are they signing?</p>
              <div className="grid grid-cols-2 gap-3">
                {guessOptions.map((s) => (
                  <motion.button key={s} onClick={() => handleGuess(s)}
                    disabled={!!myGuess}
                    className={`py-4 rounded-2xl font-bold text-sm border transition-colors ${
                      myGuess
                        ? s === currentSignId
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

          {phase === 'roundResult' && resultData && (
            <motion.div key="roundResult" className="flex-1 flex flex-col items-center justify-center gap-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Scoreboard entries={scoreboardEntries} />
              <RoundResultCard correctSignName={resultData.correctSignName} scoreDeltas={resultData.scoreDeltas} />
            </motion.div>
          )}

          {phase === 'finalResults' && (
            <motion.div key="finalResults" className="flex-1 flex flex-col items-center justify-center gap-5"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="text-5xl">🏆</div>
              <h2 className="text-2xl font-bold">Game Over!</h2>
              <div className="bg-z-card border border-white/8 rounded-2xl p-5 w-full max-w-xs flex flex-col gap-2">
                {[...roster].sort((a, b) => (scores[b.peerId] ?? 0) - (scores[a.peerId] ?? 0)).map((m) => (
                  <div key={m.peerId} className="flex justify-between items-center">
                    <p className="text-sm font-semibold">{usernameFor(m.peerId)}</p>
                    <p className="text-lg font-bold text-z-purple-light">{scores[m.peerId] ?? 0}</p>
                  </div>
                ))}
              </div>
              <motion.button onClick={exit}
                className="px-8 py-3 rounded-2xl font-bold text-white bg-gradient-primary"
                whileTap={{ scale: 0.97 }}>
                Back to Home
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
