import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCamera } from '@/hooks/useCamera';
import { useRecognition } from '@/hooks/useRecognition';
import { useSounds } from '@/hooks/useSounds';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { SIGNS as ENGINE_SIGNS } from '@/engine/signs/index';
import { SIGNS } from '@/data/signs';
import type { VerifyResult } from '@/engine/verifier';

type Phase = 'lobby' | 'waiting' | 'signer' | 'guesser' | 'result' | 'done';

interface MatchState {
  channel: ReturnType<typeof supabase.channel> | null;
  roomId: string;
  opponentId: string;
  opponentUsername: string;
  currentSign: string;
  round: number;
  myScore: number;
  opponentScore: number;
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
// STUN handles most home networks; the public OpenRelay TURN servers relay media when a player is
// behind a symmetric/mobile NAT that STUN alone can't punch through (the "sometimes can't see each
// other" case across different networks). Best-effort — for guaranteed relay, swap in your own TURN.
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

function pickSigns(n: number): string[] {
  const shuffled = [...ALL_SIGNS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function MultiplayerPage({ onExit, autoHostRoomId, autoJoinCode }: Props) {
  const { user, username } = useAuth();
  const { addSigns, addGold } = useUserStore();
  const sounds = useSounds();
  const { videoRef, status: camStatus, start: startCam, stop: stopCam, getStream } = useCamera();
  const recognition = useRecognition({ onPass: handleSignCorrect });

  const [phase, setPhase] = useState<Phase>('lobby');
  const [joinCode, setJoinCode] = useState('');
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const matchStateRef = useRef<MatchState | null>(null);
  const [roundSignIds, setRoundSignIds] = useState<string[]>([]);
  const roundSignIdsRef = useRef<string[]>([]);
  const [guessOptions, setGuessOptions] = useState<string[]>([]);
  const [guessResult, setGuessResult] = useState<'correct' | 'wrong' | null>(null);
  const [opponentSigned, setOpponentSigned] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [remoteConnected, setRemoteConnected] = useState(false);
  // The opponent's live MediaStream, held in state so it re-attaches whenever the remote <video>
  // element remounts (it lives in the signer/guesser branches, which swap every round).
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const loopRef = useRef<string | null>(null);

  // WebRTC peer connection for live opponent video, signaled over the same Supabase channel.
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  // Guards match init against duplicate join/start broadcasts creating a second peer connection.
  const startedRef = useRef(false);

  // Keep refs in sync so channel event callbacks always see the latest values (avoid stale closures)
  useEffect(() => { matchStateRef.current = matchState; }, [matchState]);
  useEffect(() => { roundSignIdsRef.current = roundSignIds; }, [roundSignIds]);

  useEffect(() => {
    recognition.init();
  }, [recognition.init]);

  function createPeerConnection(ch: ReturnType<typeof supabase.channel>) {
    // If one already exists (duplicate offer / re-entry), tear it down first so we never leak
    // two connections fighting over the same channel.
    pcRef.current?.close();
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ch.send({ type: 'broadcast', event: 'webrtc-ice', payload: { candidate: e.candidate.toJSON() } });
      }
    };
    pc.ontrack = (e) => {
      // Hold the stream in state — the remote <video> remounts each round (signer↔guesser), and
      // ontrack only fires once, so attaching directly to a ref here would go black after round 1.
      setRemoteStream(e.streams[0]);
      setRemoteConnected(true);
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') setRemoteConnected(true);
      else if (st === 'failed' || st === 'disconnected' || st === 'closed') setRemoteConnected(false);
    };
    const stream = getStream();
    stream?.getTracks().forEach((t) => pc.addTrack(t, stream));
    pcRef.current = pc;
    return pc;
  }

  async function flushPendingCandidates() {
    const pc = pcRef.current;
    if (!pc) return;
    const queued = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const c of queued) {
      try { await pc.addIceCandidate(c); } catch { /* stale candidate — ignore */ }
    }
  }

  async function handleIceCandidate(candidate: RTCIceCandidateInit) {
    const pc = pcRef.current;
    if (pc?.remoteDescription) {
      try { await pc.addIceCandidate(candidate); } catch { /* stale candidate — ignore */ }
    } else {
      pendingCandidatesRef.current.push(candidate);
    }
  }

  function handleSignCorrect(_r: VerifyResult) {
    if (phase !== 'signer' || !matchState) return;
    sounds.correct();
    const ch = matchState.channel;
    if (ch) ch.send({ type: 'broadcast', event: 'signed', payload: { signId: matchState.currentSign } });
    advanceRound(true, false);
  }

  function advanceRound(iSigned: boolean, opponentSigned: boolean) {
    const ms = matchStateRef.current;
    if (!ms) return;
    const nextRound = ms.round + 1;
    const myNewScore = ms.myScore + (iSigned ? 1 : 0);
    const opNewScore = ms.opponentScore + (opponentSigned ? 1 : 0);

    if (nextRound > ROUNDS) {
      setMatchState((s) => s ? { ...s, myScore: myNewScore, opponentScore: opNewScore } : s);
      setPhase('done');
      if (myNewScore > opNewScore) {
        addSigns(200);
        addGold(10);
        sounds.levelUp();
      }
      return;
    }

    const nextSign = roundSignIdsRef.current[nextRound - 1] ?? ALL_SIGNS[0];
    setMatchState((s) => s ? { ...s, round: nextRound, myScore: myNewScore, opponentScore: opNewScore, currentSign: nextSign } : s);
    setOpponentSigned(false);
    setGuessResult(null);

    // Alternate roles each round
    const amSigner = nextRound % 2 === ((user?.id ?? '') < ms.opponentId ? 1 : 0);
    setPhase(amSigner ? 'signer' : 'guesser');
    if (!amSigner) buildGuessOptions(nextSign);
  }

  function buildGuessOptions(signId: string) {
    const distractors = ALL_SIGNS.filter((s) => s !== signId).sort(() => Math.random() - 0.5).slice(0, 3);
    const opts = [signId, ...distractors].sort(() => Math.random() - 0.5);
    setGuessOptions(opts);
  }

  // Auto-host or auto-join when launched from a challenge
  useEffect(() => {
    if (autoHostRoomId) createRoom(autoHostRoomId);
    else if (autoJoinCode) joinRoom(autoJoinCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = async (overrideRoomId?: string) => {
    if (!user) return;
    const roomId = overrideRoomId ?? Math.random().toString(36).slice(2, 8).toUpperCase();
    const signs = pickSigns(ROUNDS);
    setRoundSignIds(signs);
    setStatusMsg(`Room code: ${roomId} — Share with a friend!`);
    setPhase('waiting');

    const ch = supabase.channel(`mp-room-${roomId}`);
    ch.on('broadcast', { event: 'join' }, async ({ payload }) => {
      if (startedRef.current) return; // ignore duplicate joins
      startedRef.current = true;
      const opId = payload.userId as string;
      const opName = payload.username as string;
      const firstSign = signs[0];
      const amSigner = user.id < opId;
      setMatchState({
        channel: ch,
        roomId,
        opponentId: opId,
        opponentUsername: opName,
        currentSign: firstSign,
        round: 1,
        myScore: 0,
        opponentScore: 0,
      });
      setPhase(amSigner ? 'signer' : 'guesser');
      if (!amSigner) buildGuessOptions(firstSign);

      // Host initiates the WebRTC offer once both players are present.
      await startCam();
      const pc = createPeerConnection(ch);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ch.send({ type: 'broadcast', event: 'webrtc-offer', payload: { sdp: { type: offer.type, sdp: offer.sdp } } });
      ch.send({ type: 'broadcast', event: 'start', payload: { signs, firstSign, hostId: user.id } });
    });
    ch.on('broadcast', { event: 'signed' }, () => {
      setOpponentSigned(true);
      advanceRound(false, true);
    });
    ch.on('broadcast', { event: 'guess' }, ({ payload }) => {
      const correct = payload.signId === matchStateRef.current?.currentSign;
      advanceRound(correct, false);
    });
    ch.on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
      await flushPendingCandidates();
    });
    ch.on('broadcast', { event: 'webrtc-ice' }, ({ payload }) => {
      void handleIceCandidate(payload.candidate as RTCIceCandidateInit);
    });
    ch.subscribe();
  };

  const joinRoom = async (overrideCode?: string) => {
    if (!user) return;
    const code = overrideCode ?? joinCode;
    if (!code.trim()) return;
    const roomId = code.trim().toUpperCase();
    setPhase('waiting');
    setStatusMsg('Joining room…');

    const ch = supabase.channel(`mp-room-${roomId}`);
    ch.on('broadcast', { event: 'start' }, async ({ payload }) => {
      if (startedRef.current) return; // ignore duplicate starts
      startedRef.current = true;
      const hostId = payload.hostId as string;
      const signs = payload.signs as string[];
      const firstSign = payload.firstSign as string;
      setRoundSignIds(signs);
      const amSigner = (user.id ?? '') > hostId;
      setMatchState({
        channel: ch,
        roomId,
        opponentId: hostId,
        opponentUsername: 'Host',
        currentSign: firstSign,
        round: 1,
        myScore: 0,
        opponentScore: 0,
      });
      setPhase(amSigner ? 'signer' : 'guesser');
      if (!amSigner) buildGuessOptions(firstSign);
      await startCam();
    });
    ch.on('broadcast', { event: 'signed' }, () => {
      setOpponentSigned(true);
      advanceRound(false, true);
    });
    ch.on('broadcast', { event: 'guess' }, ({ payload }) => {
      const correct = payload.signId === matchStateRef.current?.currentSign;
      advanceRound(correct, false);
    });
    ch.on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
      if (!getStream()) await startCam();
      const pc = createPeerConnection(ch);
      await pc.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
      await flushPendingCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ch.send({ type: 'broadcast', event: 'webrtc-answer', payload: { sdp: { type: answer.type, sdp: answer.sdp } } });
    });
    ch.on('broadcast', { event: 'webrtc-ice' }, ({ payload }) => {
      void handleIceCandidate(payload.candidate as RTCIceCandidateInit);
    });
    ch.subscribe(async () => {
      await ch.send({ type: 'broadcast', event: 'join', payload: { userId: user.id, username: username ?? user.email?.split('@')[0] ?? 'Player' } });
      setStatusMsg('Connected! Waiting for host…');
    });
  };

  const handleGuess = (signId: string) => {
    if (!matchState || guessResult) return;
    const correct = signId === matchState.currentSign;
    setGuessResult(correct ? 'correct' : 'wrong');
    if (correct) sounds.correct(); else sounds.wrong();
    matchState.channel?.send({ type: 'broadcast', event: 'guess', payload: { signId } });
    setTimeout(() => advanceRound(correct, opponentSigned), 1500);
  };

  useEffect(() => {
    if (phase !== 'signer') { if (loopRef.current) { recognition.stopLoop(); loopRef.current = null; } return; }
    if (camStatus === 'active' && matchState?.currentSign && videoRef.current) {
      const engineSign = ENGINE_SIGNS[matchState.currentSign];
      if (engineSign && loopRef.current !== engineSign.name) {
        recognition.stopLoop();
        recognition.startLoop(videoRef.current, engineSign);
        loopRef.current = engineSign.name;
      }
    }
  });

  useEffect(() => () => { stopCam(); recognition.stopLoop(); pcRef.current?.close(); }, []);

  const exit = () => { stopCam(); recognition.stopLoop(); pcRef.current?.close(); onExit(); };

  return (
    <div className="min-h-screen bg-z-bg flex flex-col">
      <video ref={videoRef} style={{ width: 0, height: 0, opacity: 0, position: 'fixed', pointerEvents: 'none' }} muted playsInline autoPlay />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <button onClick={exit}
          className="w-8 h-8 flex items-center justify-center text-z-gray-400 hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <h1 className="font-bold text-lg">1v1 Multiplayer</h1>
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
                className="w-full max-w-xs py-3 rounded-2xl font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#A78BFA)' }}
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
                    className="px-4 py-2.5 bg-z-purple rounded-2xl text-sm font-bold text-white disabled:opacity-40"
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
                <span className="text-xs text-z-gray-400 uppercase tracking-widest">Round {matchState.round}/{ROUNDS}</span>
                <span className="text-sm font-bold">You {matchState.myScore} · {matchState.opponentScore} {matchState.opponentUsername}</span>
              </div>
              <div className="bg-z-card border border-z-purple/30 rounded-2xl p-4 text-center">
                <p className="text-xs text-z-gray-400 mb-1">SIGN THIS</p>
                <p className="text-3xl font-bold text-z-purple-light">{SIGNS[matchState.currentSign]?.name.replace(/_/g, ' ') ?? matchState.currentSign}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <WebcamMirror videoRef={videoRef} label="You" />
                <RemoteVideo stream={remoteStream} label={matchState.opponentUsername} connected={remoteConnected} />
              </div>
              {camStatus === 'denied' && (
                <p className="text-center text-xs text-z-red">Camera access denied — your opponent won't see your video.</p>
              )}
              <p className="text-center text-z-gray-400 text-sm">Sign it — your friend guesses!</p>
            </motion.div>
          )}

          {phase === 'guesser' && matchState && (
            <motion.div key="guesser" className="flex-1 flex flex-col gap-5 pt-4"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-z-gray-400 uppercase tracking-widest">Round {matchState.round}/{ROUNDS}</span>
                <span className="text-sm font-bold">You {matchState.myScore} · {matchState.opponentScore} {matchState.opponentUsername}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RemoteVideo stream={remoteStream} label={`${matchState.opponentUsername} — signing`} connected={remoteConnected} />
                <WebcamMirror videoRef={videoRef} label="You" />
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
                          : guessResult === 'wrong' && s !== matchState.currentSign
                            ? 'border-white/8 text-z-gray-400'
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
                className="px-8 py-3 rounded-2xl font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#A78BFA)' }}
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

function WebcamMirror({ videoRef, label }: { videoRef: React.RefObject<HTMLVideoElement | null>; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  useEffect(() => {
    const draw = () => {
      const v = videoRef.current, c = canvasRef.current;
      if (v && c && v.readyState >= 2) {
        const ctx = c.getContext('2d');
        if (ctx) { c.width = v.videoWidth; c.height = v.videoHeight; ctx.save(); ctx.scale(-1, 1); ctx.drawImage(v, -c.width, 0, c.width, c.height); ctx.restore(); }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef]);
  return (
    <div className="relative rounded-2xl overflow-hidden bg-z-surface aspect-video">
      <canvas ref={canvasRef} className="w-full h-full object-cover" />
      {label && <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded-md">{label}</span>}
    </div>
  );
}

function RemoteVideo({ stream, label, connected }: { stream: MediaStream | null; label: string; connected: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  // Attach on every mount + whenever the stream changes. This element remounts each round as the
  // signer/guesser branches swap, so re-attaching here (not once in ontrack) keeps video flowing.
  useEffect(() => {
    const v = ref.current;
    if (v && stream && v.srcObject !== stream) {
      v.srcObject = stream;
      v.play().catch(() => {});
    }
  }, [stream]);
  return (
    <div className="relative rounded-2xl overflow-hidden bg-z-surface aspect-video">
      <video ref={ref} autoPlay playsInline muted className="w-full h-full object-cover" />
      {!(connected && stream) && (
        <div className="absolute inset-0 flex items-center justify-center bg-z-surface/90">
          <p className="text-xs text-z-gray-400">Connecting…</p>
        </div>
      )}
      <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded-md">{label}</span>
    </div>
  );
}
