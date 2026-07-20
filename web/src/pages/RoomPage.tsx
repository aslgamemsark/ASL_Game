import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRecognition, type AttemptRecord } from '@/hooks/useRecognition';
import { useSounds } from '@/hooks/useSounds';
import { useConfetti } from '@/hooks/useConfetti';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiplayerSignaling, type IceResult } from '@/hooks/useMultiplayerSignaling';
import { supabase } from '@/lib/supabase';
import { generateRoomCode, joinErrorMessage, filterSignPool, pickSignsFrom, DEFAULT_ROOM_RULES, ROOM_ROUNDS_OPTIONS, type RoomRules } from '@/lib/multiplayerRooms';
import { RoomRulesPanel } from '@/components/multiplayer/RoomRulesPanel';
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
import { track } from '@/analytics';

type Phase = 'lobby' | 'waitingRoom' | 'signing' | 'guessing' | 'roundResult' | 'finalResults';
type Visibility = 'public' | 'private';

interface RosterMember {
  peerId: string;
  username: string;
  joinOrder: number;
  /** Equipped border id, synced so each player's cosmetic shows on their video for everyone. */
  border?: string;
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
// Fallback turn length when a client has no synced rules yet (guessers before 'game-start'). The
// host's chosen RoomRules override this; totalRounds is derived from the synced signs array length
// so every client agrees regardless of the host's rounds-per-player choice.
const TURN_SECONDS = DEFAULT_ROOM_RULES.turnSeconds;
const RESULT_HOLD_MS = 1500;
// Safety net: if not every guesser confirms they can see the signer's video within this long
// (dropped message, a camera that never loads), start the round timer anyway rather than
// stalling the whole room on one stuck connection.
const TURN_ARM_FALLBACK_MS = 5000;

export function RoomPage({ onExit }: Props) {
  const { user, username } = useAuth();
  const { addSigns, addGold, equippedBorder } = useUserStore();
  const cosmeticBorderClasses = equippedBorder ? (getShopItem(equippedBorder)?.preview ?? '') : '';
  const sounds = useSounds();
  const { burst } = useConfetti();
  const recognition = useRecognition({ onPass: handleSignCorrect, onAttempt: handleRoomAttempt, screen: 'multiplayer' });

  const [phase, setPhase] = useState<Phase>('lobby');
  const [joinCode, setJoinCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [searching, setSearching] = useState(false);
  // Host-chosen rules (lobby only). turnSecondsRef holds the ACTIVE per-turn length for host and
  // guessers — set from `rules` on the host at startGame, and from the synced 'game-start' payload
  // on everyone else — so the countdown + the host's round timeout honor the host's choice.
  const [rules, setRules] = useState<RoomRules>(DEFAULT_ROOM_RULES);
  const turnSecondsRef = useRef<number>(DEFAULT_ROOM_RULES.turnSeconds);
  const [roomId, setRoomId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [disconnectedPeerIds, setDisconnectedPeerIds] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [signerPeerId, setSignerPeerId] = useState<string | null>(null);
  const [currentSignId, setCurrentSignId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [guessOptions, setGuessOptions] = useState<string[]>([]);
  const [myGuess, setMyGuess] = useState<string | null>(null);
  const [resultData, setResultData] = useState<ResultData | null>(null);

  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [turnArmed, setTurnArmed] = useState(false);
  const turnStartedAtRef = useRef<number>(0);
  const turnArmedThisRoundRef = useRef(false);
  const videoReadySentRef = useRef(false);
  const roundReadyRef = useRef<Set<string>>(new Set());
  const turnArmFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const disconnectedPeerIdsRef = useRef<string[]>([]);
  const wasPresentRef = useRef<Set<string>>(new Set());
  const matchStartedAtRef = useRef(0);
  const armTurnTimerRef = useRef<(startedAt?: number) => void>(() => {});

  useEffect(() => { rosterRef.current = roster; }, [roster]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  useEffect(() => { disconnectedPeerIdsRef.current = disconnectedPeerIds; }, [disconnectedPeerIds]);

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
  // to itself) and via the 'round-start' message handler for everyone else. Does NOT start the
  // turn clock itself — that's armed separately (see armTurnTimer below) once enough guessers
  // have confirmed they can actually SEE the signer's video, not merely that a round exists.
  const beginRound = useCallback((roundNum: number, signer: string, signId: string) => {
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    if (turnArmFallbackRef.current) clearTimeout(turnArmFallbackRef.current);
    guessesThisRoundRef.current = {};
    roundReadyRef.current = new Set();
    turnArmedThisRoundRef.current = false;
    videoReadySentRef.current = false;
    setTurnArmed(false);
    setTimeLeft(turnSecondsRef.current);

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

    // Safety net: if not every guesser's 'video-ready' arrives (dropped message, denied camera),
    // the host arms anyway after TURN_ARM_FALLBACK_MS rather than stalling the round forever.
    if (isHostRef.current) {
      turnArmFallbackRef.current = setTimeout(() => armTurnTimerRef.current(), TURN_ARM_FALLBACK_MS);
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
        signaling.send('round-start', { round: nextRound, signerPeerId: nextSigner, signId: nextSignId });
        beginRound(nextRound, nextSigner, nextSignId);
      }, RESULT_HOLD_MS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beginRound, usernameFor]);

  const applyGameOver = useCallback(() => {
    setPhase('finalResults');
    const myScore = scoresRef.current[user?.id ?? ''] ?? 0;
    const best = Math.max(0, ...Object.values(scoresRef.current));
    const won = myScore > 0 && myScore >= best;
    track('multiplayer_match_finished', {
      mode: 'room',
      room_id: roomId,
      player_count: rosterRef.current.length,
      duration_ms: Date.now() - matchStartedAtRef.current,
      won,
      forfeited: false,
    });
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

  // Arms the shared turn clock — called once every guesser has confirmed they can actually see
  // the signer's video ('video-ready' -> host counts readiness -> broadcasts 'round-timer-start'
  // with a synced instant), or by the fallback timeout if that handshake doesn't fully complete.
  // Idempotent per round via turnArmedThisRoundRef.
  const armTurnTimer = useCallback((startedAt?: number) => {
    if (turnArmedThisRoundRef.current) return;
    turnArmedThisRoundRef.current = true;
    if (turnArmFallbackRef.current) { clearTimeout(turnArmFallbackRef.current); turnArmFallbackRef.current = null; }
    const at = startedAt ?? Date.now();
    turnStartedAtRef.current = at;
    setTurnArmed(true);
    if (isHostRef.current) {
      signaling.send('round-timer-start', { round: roundRef.current, startedAt: at });
      roundTimerRef.current = setTimeout(() => endRound(), turnSecondsRef.current * 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endRound]);
  useEffect(() => { armTurnTimerRef.current = armTurnTimer; }, [armTurnTimer]);

  // Guesser side: fires once this player's view of the signer's video actually shows a frame —
  // the real "I can see them" signal, not just WebRTC reaching 'connected'. Sent once per round.
  const handleVideoReady = useCallback(() => {
    if (videoReadySentRef.current || phase !== 'guessing') return;
    videoReadySentRef.current = true;
    signaling.send('video-ready', { round: roundRef.current });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Analytics-only, same scope limit and reasoning as DuelPage's equivalent handler.
  function handleRoomAttempt(a: AttemptRecord) {
    track('sign_attempt', {
      sign_id: a.signId,
      world_id: null,
      source: 'room',
      rule_passed: a.rulePassed,
      ai_vetoed: a.aiVetoed,
      final_passed: a.finalPassed,
      ai_prediction: a.aiPrediction,
      ai_confidence: a.aiConfidence,
      duration_ms: a.durationMs,
      attempt_number: a.attemptNumber,
    });
  }

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
      const next = [...rosterRef.current, { peerId: fromPeerId, username: (payload.username as string) ?? 'Player', joinOrder: rosterRef.current.length, border: (payload.border as string) ?? '' }];
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
      turnSecondsRef.current = (payload.turnSeconds as number) ?? TURN_SECONDS;
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
    if (event === 'video-ready') {
      // Only the host tracks readiness and decides when to arm the shared clock. Disconnected
      // players are excluded — they'll never send this, and would otherwise stall every round.
      if (!isHostRef.current || payload.round !== roundRef.current) return;
      roundReadyRef.current.add(fromPeerId);
      const activeGuessers = rosterRef.current.filter((m) => m.peerId !== signerPeerIdRef.current && !disconnectedPeerIdsRef.current.includes(m.peerId));
      if (roundReadyRef.current.size >= activeGuessers.length) armTurnTimerRef.current();
      return;
    }
    if (event === 'round-timer-start') {
      if (payload.round === roundRef.current) armTurnTimerRef.current(payload.startedAt as number);
      return;
    }
    if (event === 'guess') {
      if (!isHostRef.current) return;
      if (payload.round !== roundRef.current) return;
      if (guessesThisRoundRef.current[fromPeerId]) return;
      guessesThisRoundRef.current[fromPeerId] = payload.signId as string;
      const activeGuesserCount = rosterRef.current.filter((m) => m.peerId !== signerPeerIdRef.current && !disconnectedPeerIdsRef.current.includes(m.peerId)).length;
      if (Object.keys(guessesThisRoundRef.current).length >= activeGuesserCount) endRound();
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

  // Networking telemetry — see multiplayer_ice_* in analytics/types.ts (answers "do we need paid
  // TURN?"). roomId (the room code) is captured per-connection; connections happen after join sets it.
  const handleIceResult = useCallback((r: IceResult) => {
    if (r.outcome === 'connected') {
      track('multiplayer_ice_connected', {
        mode: 'room', room_id: roomId, connection_time_ms: r.connectionTimeMs,
        candidate_type: r.candidateType, used_relay: r.usedRelay, used_default_turn: r.usedDefaultTurn,
      });
    } else {
      track('multiplayer_ice_failed', { mode: 'room', room_id: roomId, reason: r.reason, used_default_turn: r.usedDefaultTurn });
    }
  }, [roomId]);

  const signaling = useMultiplayerSignaling({ selfPeerId: user?.id ?? '', onMessage: handleMessage, onIceResult: handleIceResult });

  // Presence-based disconnect detection: a WebRTC connectionState drop isn't reliable here since
  // not every pair of players has a live peer connection (only the current signer connects to
  // each guesser) — presence tracks channel MEMBERSHIP instead, which every player has regardless
  // of who's currently signing. On a drop: mark them disconnected (excluded from round-ending
  // guess counts above, so the round doesn't stall waiting for a guess that'll never come) and
  // show a passive notice — nobody else's phase or timer changes. On their return: clear the flag
  // and re-attempt the WebRTC link if the current signer needs one to them.
  useEffect(() => {
    const present = new Set(signaling.presentPeerIds);
    const known = rosterRef.current.map((m) => m.peerId);
    const nowDisconnected = known.filter((id) => id !== user?.id && !present.has(id));
    setDisconnectedPeerIds((prev) => {
      const changed = prev.length !== nowDisconnected.length || prev.some((id) => !nowDisconnected.includes(id));
      return changed ? nowDisconnected : prev;
    });
    for (const id of known) {
      if (present.has(id) && !wasPresentRef.current.has(id) && signerPeerIdRef.current === user?.id && id !== user?.id) {
        // A guesser we're signing to came back — re-offer so their video resumes.
        void signaling.connectToPeer(id);
      }
    }
    wasPresentRef.current = present;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signaling.presentPeerIds, roster]);

  const createRoom = async () => {
    if (!user) return;
    setCodeError('');
    const code = generateRoomCode();
    const { error } = await supabase.from('multiplayer_rooms').insert({
      code, mode: 'room', visibility, host_id: user.id, max_participants: MAX_PLAYERS,
    });
    if (error) { setCodeError('Could not create a room — please try again.'); return; }
    isHostRef.current = true;
    setRoomId(code);
    const me = { peerId: user.id, username: username ?? 'Host', joinOrder: 0, border: equippedBorder ?? '' };
    setRoster([me]);
    rosterRef.current = [me];
    setStatusMsg(`Room code: ${code} — share with up to 3 friends!`);
    setPhase('waitingRoom');
    track('multiplayer_room_created', { mode: 'room', room_id: code, visibility, rounds: rules.rounds, turn_seconds: rules.turnSeconds });
    await signaling.join(`mp-room-${code}`);
    await signaling.startCamera();
  };

  const joinRoom = async (overrideCode?: string, via: 'code' | 'search' = 'code') => {
    if (!user) return;
    const code = (overrideCode ?? joinCode).trim().toUpperCase();
    if (!code) return;
    setCodeError('');
    const { error } = await supabase.rpc('join_multiplayer_room', { p_code: code });
    if (error) { setCodeError(joinErrorMessage(error.message)); return; }
    isHostRef.current = false;
    setRoomId(code);
    setStatusMsg('Joining room…');
    setPhase('waitingRoom');
    track('multiplayer_room_joined', { mode: 'room', room_id: code, via });
    await signaling.join(`mp-room-${code}`);
    await signaling.startCamera();
    signaling.send('roster-join', { username: username ?? user.email?.split('@')[0] ?? 'Player', border: equippedBorder ?? '' });
    setStatusMsg('Connected! Waiting for host to start…');
  };

  const searchForMatch = async () => {
    if (!user || searching) return;
    setCodeError('');
    setSearching(true);
    const { data, error } = await supabase.rpc('find_public_room', { p_mode: 'room' });
    setSearching(false);
    // find_public_room returns a bare composite row (not setof), so a "no match" result can come
    // back as PostgREST's all-null composite object rather than a JS null — `!data` alone misses
    // that case and used to fall through to joinRoom(undefined).
    const code = (data as { code?: string } | null)?.code;
    if (error || !code) { setCodeError('No open rooms right now — try creating one!'); return; }
    await joinRoom(code, 'search');
  };

  const startGame = () => {
    const order = rosterRef.current.map((m) => m.peerId);
    turnSecondsRef.current = rules.turnSeconds;
    const signs = pickSignsFrom(filterSignPool(ALL_SIGNS, rules.signSet), order.length * rules.rounds);
    turnOrderRef.current = order;
    signsRef.current = signs;
    totalRoundsRef.current = signs.length;
    setTotalRounds(signs.length);
    matchStartedAtRef.current = Date.now();
    track('multiplayer_match_started', { mode: 'room', room_id: roomId, player_count: order.length });
    if (roomId) void supabase.from('multiplayer_rooms').update({ status: 'in_progress' }).eq('code', roomId);
    signaling.send('game-start', { signs, turnOrder: order, turnSeconds: rules.turnSeconds });
    signaling.send('round-start', { round: 1, signerPeerId: order[0], signId: signs[0] });
    beginRound(1, order[0], signs[0]);
  };

  const handleGuess = (signId: string) => {
    if (myGuess || !currentSignId) return;
    setMyGuess(signId);
    if (signId === currentSignId) sounds.correct(); else sounds.wrong();
    if (isHostRef.current) {
      guessesThisRoundRef.current[user?.id ?? ''] = signId;
      const activeGuesserCount = rosterRef.current.filter((m) => m.peerId !== signerPeerIdRef.current && !disconnectedPeerIdsRef.current.includes(m.peerId)).length;
      if (Object.keys(guessesThisRoundRef.current).length >= activeGuesserCount) endRound();
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

  // Visual per-turn countdown (the host's roundTimerRef is what actually ends the round; this just
  // drives the shared 15s bar off the synced turnStartedAt — set once armTurnTimer fires, not the
  // instant the round begins — so every screen reads the same, and only once video is visible).
  useEffect(() => {
    if (phase !== 'signing' && phase !== 'guessing') {
      if (turnIntervalRef.current) { clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; }
      return;
    }
    turnIntervalRef.current = setInterval(() => {
      if (!turnArmedThisRoundRef.current) return;
      const remaining = turnSecondsRef.current - (Date.now() - turnStartedAtRef.current) / 1000;
      setTimeLeft(Math.max(0, remaining));
    }, 100);
    return () => { if (turnIntervalRef.current) { clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; } };
  }, [phase, round]);

  useEffect(() => () => {
    recognition.stopLoop();
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    if (turnIntervalRef.current) clearInterval(turnIntervalRef.current);
    if (turnArmFallbackRef.current) clearTimeout(turnArmFallbackRef.current);
  }, []);

  const exit = () => {
    recognition.stopLoop();
    const activePhases: Phase[] = ['signing', 'guessing', 'roundResult'];
    if (activePhases.includes(phase)) {
      track('multiplayer_match_abandoned', { mode: 'room', room_id: roomId, at_round: round });
    } else if (roomId) {
      track('multiplayer_room_left', { mode: 'room', room_id: roomId });
    }
    if (roomId) {
      // Host exiting ends the game for good — delete the room outright instead of leaving a
      // permanent 'closed' row with no further purpose (rows were never actually cleaned up).
      if (isHostRef.current) void supabase.from('multiplayer_rooms').delete().eq('code', roomId);
      else void supabase.rpc('leave_multiplayer_room', { p_code: roomId });
    }
    signaling.leave();
    onExit();
  };

  const scoreboardEntries = roster.map((m) => ({
    label: usernameFor(m.peerId) + (disconnectedPeerIds.includes(m.peerId) ? ' (disconnected)' : ''),
    score: scores[m.peerId] ?? 0, isYou: m.peerId === user?.id,
  }));
  const timerPercent = turnArmed ? (timeLeft / turnSecondsRef.current) * 100 : 100;

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
              <div className="w-full max-w-xs flex flex-col gap-2">
                <RoomRulesPanel rules={rules} onChange={setRules} roundsOptions={ROOM_ROUNDS_OPTIONS} roundsLabel="Rounds each" />
                <div className="flex bg-z-card border border-white/10 rounded-2xl p-1">
                  <button onClick={() => setVisibility('private')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${visibility === 'private' ? 'bg-z-purple text-white' : 'text-z-gray-400'}`}>
                    🔒 Private
                  </button>
                  <button onClick={() => setVisibility('public')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${visibility === 'public' ? 'bg-z-purple text-white' : 'text-z-gray-400'}`}>
                    🌐 Public
                  </button>
                </div>
                <motion.button onClick={() => void createRoom()}
                  className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-primary"
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  Create Room
                </motion.button>
              </div>

              <motion.button onClick={() => void searchForMatch()} disabled={searching}
                className="w-full max-w-xs py-3 rounded-2xl font-bold text-sm bg-z-card border border-white/10 hover:border-z-purple/40 disabled:opacity-50"
                whileTap={{ scale: 0.97 }}>
                {searching ? 'Searching…' : '🔍 Search for a Room'}
              </motion.button>
              {codeError && <p className="text-center text-z-red text-xs -mt-3">{codeError}</p>}

              <div className="w-full max-w-xs">
                <p className="text-center text-z-gray-400 text-sm mb-2">— or join with a code —</p>
                <div className="flex gap-2">
                  <input value={joinCode} onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setCodeError(''); }}
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
                    <p key={m.peerId} className="text-sm font-semibold flex items-center gap-1.5">
                      {m.peerId === user?.id ? 'You' : m.username}
                      {disconnectedPeerIds.includes(m.peerId) && <span className="text-xs font-normal text-z-red">disconnected</span>}
                    </p>
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
                <p className="text-xs text-z-gray-400 mb-1">
                  SIGN THIS · {turnArmed ? <span className={timeLeft <= 3 ? 'text-z-red font-bold' : ''}>{Math.ceil(timeLeft)}s</span> : <span className="text-z-gray-500">waiting for everyone's camera…</span>}
                </p>
                <p className="text-3xl font-bold text-z-purple-light">{SIGNS[currentSignId]?.name.replace(/_/g, ' ') ?? currentSignId}</p>
              </div>
              <WebcamMirror videoRef={signaling.localVideoRef} label="You" cosmeticBorderClasses={cosmeticBorderClasses} activeTurn turnLabel="YOUR TURN" timerPercent={timerPercent} />
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
                cosmeticBorderClasses={(() => {
                  const b = roster.find((m) => m.peerId === signerPeerId)?.border;
                  return b ? (getShopItem(b)?.preview ?? '') : '';
                })()}
                activeTurn
                turnLabel={`${usernameFor(signerPeerId ?? '')}'s turn`}
                timerPercent={timerPercent}
                onVideoReady={handleVideoReady}
              />
              <p className="text-center font-bold">
                {turnArmed ? 'What are they signing?' : <span className="text-z-gray-500 font-normal text-sm">connecting…</span>}
              </p>
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

      {/* Channel-drop recovery: if this client's own Realtime channel disconnects while in a room,
          surface an explicit Retry (re-subscribe) alongside the always-available Leave. Without
          this, a dropped channel left the player in a room that silently couldn't receive events
          with no in-context way back other than the header close button — satisfies the launch
          requirement that every failure offers Retry + Leave/Return Home. */}
      {roomId && signaling.channelStatus === 'disconnected' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-z-card border border-z-red/40 rounded-2xl px-5 py-3 shadow-xl flex items-center gap-4">
          <span className="text-sm font-semibold text-z-red">Connection lost</span>
          <button
            onClick={() => void signaling.join(`mp-room-${roomId}`)}
            className="px-3.5 py-1.5 rounded-xl bg-z-purple text-white text-xs font-bold"
          >
            Retry
          </button>
          <button onClick={exit} className="text-xs text-z-gray-400 hover:text-white">Leave</button>
        </div>
      )}
    </div>
  );
}
