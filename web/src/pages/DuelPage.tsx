import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/shared/Button';
import { useRecognition, type AttemptRecord } from '@/hooks/useRecognition';
import { useSounds } from '@/hooks/useSounds';
import { useConfetti } from '@/hooks/useConfetti';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiplayerSignaling } from '@/hooks/useMultiplayerSignaling';
import { supabase } from '@/lib/supabase';
import { generateRoomCode, joinErrorMessage, filterSignPool, pickSignsFrom, DEFAULT_DUEL_RULES, DUEL_ROUNDS_OPTIONS, type RoomRules } from '@/lib/multiplayerRooms';
import { RoomRulesPanel } from '@/components/multiplayer/RoomRulesPanel';
import { RoomVisibilityToggle } from '@/components/multiplayer/RoomVisibilityToggle';
import { RoomJoinByCode } from '@/components/multiplayer/RoomJoinByCode';
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
import { track } from '@/analytics';

type Phase = 'lobby' | 'waiting' | 'signer' | 'guesser' | 'result' | 'done' | 'waiting-reconnect';
type Visibility = 'public' | 'private';

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
// Fallback round count / turn length when a client has no synced rules yet (e.g. a guesser before
// the host's 'start' arrives). The host's chosen RoomRules override these, and the actual round
// count is derived from the synced signs array length so both clients always agree.
const ROUNDS = DEFAULT_DUEL_RULES.rounds;
const RESULT_HOLD_MS = 1500;
const TURN_SECONDS = DEFAULT_DUEL_RULES.turnSeconds;
const RECONNECT_SECONDS = 30;
// Safety net: if the guesser's 'video-ready' (or the signer's synced 'turn-start' reply) never
// arrives — a dropped broadcast, a camera that never loads — start the timer anyway after this
// long, rather than letting a lost message stall a round forever.
const TURN_ARM_FALLBACK_MS = 5000;
// The guest re-announces its arrival until the host replies, because a broadcast sent before the
// host finished subscribing is lost with no replay (see joinRoom). ~1.2s x 10 covers a cold-start
// camera prompt on the host's side; past that the host genuinely isn't there and the guest is told
// so rather than waiting forever.
const JOIN_ANNOUNCE_INTERVAL_MS = 1200;
const JOIN_ANNOUNCE_ATTEMPTS = 10;

export function DuelPage({ onExit, autoHostRoomId, autoJoinCode }: Props) {
  const { user, username } = useAuth();
  const { addSigns, addGold, equippedBorder } = useUserStore();
  const cosmeticBorderClasses = equippedBorder ? (getShopItem(equippedBorder)?.preview ?? '') : '';
  const sounds = useSounds();
  const { burst } = useConfetti();
  const recognition = useRecognition({ onPass: handleSignCorrect, onAttempt: handleDuelAttempt, screen: 'multiplayer' });

  const [phase, setPhase] = useState<Phase>('lobby');
  const [reportOpen, setReportOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [searching, setSearching] = useState(false);
  // Host-chosen rules (lobby only). turnSecondsRef holds the ACTIVE per-turn length for both host
  // and guesser — set from `rules` on the host at createRoom, and from the synced 'start' payload
  // on the guesser — so the countdown honors the host's choice on both sides.
  const [rules, setRules] = useState<RoomRules>(DEFAULT_DUEL_RULES);
  const turnSecondsRef = useRef<number>(DEFAULT_DUEL_RULES.turnSeconds);
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
  // Whether THIS client created the room (createRoom) vs joined one (joinRoom) — used on exit to
  // decide whether to delete the room registry row outright (host) or just decrement the
  // participant count via leave_multiplayer_room (guest), matching RoomPage's isHostRef.
  const isHostRef = useRef(false);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [turnArmed, setTurnArmed] = useState(false);
  const turnStartedAtRef = useRef(0);
  const turnArmedThisRoundRef = useRef(false);
  const videoReadySentRef = useRef(false);
  const turnArmFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const turnEndedRef = useRef(false);
  const [reconnectLeft, setReconnectLeft] = useState(RECONNECT_SECONDS);
  const [endedByForfeit, setEndedByForfeit] = useState(false);
  const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Repeats the guest's 'join' announcement until the host answers — see joinRoom for why one
  // broadcast was not enough.
  const joinAnnounceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>('lobby');
  const phaseBeforeDisconnectRef = useRef<Phase>('signer');
  const wasPresentRef = useRef(false);
  const handleOpponentLostRef = useRef<() => void>(() => {});
  // Analytics-only state: when the match's first round actually started (for finished's
  // duration_ms) and whether multiplayer_match_started already fired (guards against re-firing on
  // a reconnect, which restores 'signer'/'guesser' without starting a NEW match).
  const matchStartedAtRef = useRef(0);
  const matchStartTrackedRef = useRef(false);
  const disconnectedAtRef = useRef(0);
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
    // Derived from the synced signs array (both clients hold the same one), so a host who chose a
    // non-default round count doesn't desync against the other player's ROUNDS constant.
    const totalRounds = roundSignIdsRef.current.length || ROUNDS;

    if (nextRound > totalRounds) {
      setMatchState((s) => s ? { ...s, myScore: myNewScore, opponentScore: opNewScore } : s);
      setPhase('done');
      track('multiplayer_match_finished', {
        mode: 'duel',
        room_id: ms.roomId,
        player_count: 2,
        duration_ms: Date.now() - matchStartedAtRef.current,
        won: myNewScore > opNewScore,
        forfeited: false,
      });
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

  // Analytics-only — Duel doesn't feed the Supabase landmark-training pipeline (logAttempt) the
  // way solo screens do; that's a deliberate scope limit for this pass, not an oversight (see the
  // Analytics Coverage Report). No single world_id: any sign in the pool can come up.
  function handleDuelAttempt(a: AttemptRecord) {
    track('sign_attempt', {
      sign_id: a.signId,
      world_id: null,
      source: 'duel',
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
    const ms = matchStateRef.current;
    if (phase !== 'signer' || !ms) return;
    sounds.correct();
    signaling.send('signed', { signId: ms.currentSign }, ms.opponentId);
    enterResult(true, false, ms.currentSign, ms.opponentUsername);
  }

  const clearJoinAnnounce = useCallback(() => {
    if (joinAnnounceRef.current) { clearInterval(joinAnnounceRef.current); joinAnnounceRef.current = null; }
  }, []);

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
      matchStartedAtRef.current = Date.now();
      matchStartTrackedRef.current = true;
      track('multiplayer_match_started', { mode: 'duel', room_id: matchStateRef.current?.roomId ?? '', player_count: 2 });
      // Close the room to newcomers the moment the match starts — RoomPage has always done this
      // and Duel never did, so a duel in progress still advertised status='waiting'. Harmless
      // while the room reads as full, but the instant a player's leave decremented the count the
      // room became findable again and a stranger could walk into a match already under way.
      // Host-only by construction: this branch runs on the host, and the rooms_update_own policy
      // restricts the write to host_id = auth.uid() regardless.
      const startedRoomId = matchStateRef.current?.roomId;
      if (startedRoomId) {
        void supabase.from('multiplayer_rooms').update({ status: 'in_progress' }).eq('code', startedRoomId);
      }
      if (!amSigner) buildGuessOptions(firstSign);
      void (async () => {
        await signaling.startCamera();
        await signaling.connectToPeer(opId);
        signaling.send('start', { signs, firstSign, hostId: user.id, border: equippedBorder ?? '', turnSeconds: turnSecondsRef.current }, opId);
      })();
      return;
    }
    if (event === 'start') {
      if (startedRef.current || !user) return;
      startedRef.current = true;
      // The host answered — stop re-announcing immediately rather than waiting for the interval's
      // next tick to notice, so no redundant 'join' goes out after the match has begun.
      clearJoinAnnounce();
      const hostId = payload.hostId as string;
      const signs = payload.signs as string[];
      const firstSign = payload.firstSign as string;
      const hostBorder = (payload.border as string) ?? '';
      turnSecondsRef.current = (payload.turnSeconds as number) ?? TURN_SECONDS;
      setRoundSignIds(signs);
      const amSigner = isSignerForRound(user.id, hostId, 1);
      setMatchState((s) => ({ roomId: s?.roomId ?? '', opponentId: hostId, opponentUsername: 'Host', opponentBorder: hostBorder, currentSign: firstSign, round: 1, myScore: 0, opponentScore: 0 }));
      setPhase(amSigner ? 'signer' : 'guesser');
      if (!amSigner) buildGuessOptions(firstSign);
      matchStartedAtRef.current = Date.now();
      matchStartTrackedRef.current = true;
      track('multiplayer_match_started', { mode: 'duel', room_id: matchStateRef.current?.roomId ?? '', player_count: 2 });
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
    if (event === 'video-ready') {
      // The guesser can now actually SEE our video (not just "WebRTC connected") — only meaningful
      // to us while we're the signer waiting to arm this round's timer.
      if (phaseRef.current === 'signer' && !turnArmedThisRoundRef.current) armTurnTimerRef.current();
      return;
    }
    if (event === 'turn-start') {
      // The signer confirmed the guesser can see them and stamped a synced start time — both
      // clients now count down from the identical instant instead of each guessing independently.
      if (!turnArmedThisRoundRef.current) armTurnTimerRef.current(payload.startedAt as number);
      return;
    }
    if (event === 'bye') {
      handleOpponentLostRef.current();
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildGuessOptions, clearJoinAnnounce, enterResult, user]);

  const signaling = useMultiplayerSignaling({ selfPeerId: user?.id ?? '', onMessage: handleMessage });

  useEffect(() => {
    if (autoHostRoomId) void createRoom(autoHostRoomId);
    else if (autoJoinCode) void joinRoom(autoJoinCode, 'challenge');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = async (overrideRoomId?: string) => {
    if (!user) return;
    setCodeError('');
    const roomId = overrideRoomId ?? generateRoomCode();
    // Upsert + ignoreDuplicates: the challenge-friend flow (App.tsx) already registers this exact
    // code before DuelPage even mounts, so a plain insert would fail on the unique constraint.
    const { error } = await supabase.from('multiplayer_rooms').upsert(
      { code: roomId, mode: 'duel', visibility, host_id: user.id, max_participants: 2 },
      { onConflict: 'code', ignoreDuplicates: true }
    );
    if (error) { setCodeError('Could not create a room — please try again.'); return; }
    isHostRef.current = true;
    turnSecondsRef.current = rules.turnSeconds;
    const signs = pickSignsFrom(filterSignPool(ALL_SIGNS, rules.signSet), rules.rounds);
    setRoundSignIds(signs);
    setMatchState((s) => ({ ...(s ?? { opponentId: '', opponentUsername: '', currentSign: '', round: 1, myScore: 0, opponentScore: 0 }), roomId }));
    setStatusMsg(`Room code: ${roomId} — Share with a friend!`);
    setPhase('waiting');
    track('multiplayer_room_created', { mode: 'duel', room_id: roomId, visibility, rounds: rules.rounds, turn_seconds: rules.turnSeconds });
    await signaling.join(`mp-room-${roomId}`);
    // Start the camera immediately, same as the joiner — previously the host only requested it
    // once the opponent's 'join' message arrived, so getUserMedia (permission prompt + warmup)
    // didn't even START until someone else showed up. That's the real source of "camera takes too
    // long": there's no artificial delay, just a late request.
    await signaling.startCamera();
  };

  const joinRoom = async (overrideCode?: string, via: 'code' | 'search' | 'challenge' = 'code') => {
    if (!user) return;
    const code = (overrideCode ?? joinCode).trim().toUpperCase();
    if (!code) return;
    setCodeError('');
    // Validate the code against the room registry BEFORE joining the realtime channel — a
    // mistyped/nonexistent code used to subscribe to an empty channel and wait forever with no
    // feedback. join_multiplayer_room atomically checks existence/status/capacity and claims a
    // slot in one round trip.
    const { error } = await supabase.rpc('join_multiplayer_room', { p_code: code });
    if (error) { setCodeError(joinErrorMessage(error.message)); return; }
    isHostRef.current = false;
    const roomId = code;
    setPhase('waiting');
    setStatusMsg('Joining room…');
    track('multiplayer_room_joined', { mode: 'duel', room_id: roomId, via });
    setMatchState((s) => ({ ...(s ?? { opponentId: '', opponentUsername: '', currentSign: '', round: 1, myScore: 0, opponentScore: 0 }), roomId }));
    await signaling.join(`mp-room-${roomId}`);
    await signaling.startCamera();

    // Announce arrival, then KEEP announcing until the host answers with 'start'.
    //
    // A single broadcast assumed the host was already subscribed when it arrived, and nothing
    // enforced that. Via "Search for a Match" the guest can find and join a room within
    // milliseconds of the host's INSERT — while the host is still inside its own
    // `signaling.join()` + `startCamera()` (a camera permission prompt and warmup, seconds on a
    // cold start). Realtime broadcast has no replay: a message sent before the host subscribes is
    // simply gone, and both players then sit on "Waiting…" forever with no error and no recovery.
    //
    // Re-sending is safe by construction rather than by luck: the host's handler returns early on
    // `startedRef.current`, so every join after the first is a no-op. Bounded per livelock.md —
    // it gives up after JOIN_ANNOUNCE_ATTEMPTS and tells the user, instead of retrying forever.
    const announce = () => signaling.send('join', {
      username: username ?? user.email?.split('@')[0] ?? 'Player',
      border: equippedBorder ?? '',
    });
    announce();
    setStatusMsg('Connected! Waiting for host…');

    let attempts = 0;
    joinAnnounceRef.current = setInterval(() => {
      // startedRef flips the moment the host's 'start' lands — the real "we're in" signal.
      if (startedRef.current) { clearJoinAnnounce(); return; }
      attempts += 1;
      if (attempts >= JOIN_ANNOUNCE_ATTEMPTS) {
        clearJoinAnnounce();
        setStatusMsg("Couldn't reach the host — they may have left. Try another room.");
        return;
      }
      announce();
    }, JOIN_ANNOUNCE_INTERVAL_MS);
  };

  const searchForMatch = async () => {
    if (!user || searching) return;
    setCodeError('');
    setSearching(true);
    const { data, error } = await supabase.rpc('find_public_room', { p_mode: 'duel' });
    setSearching(false);
    // find_public_room returns a bare composite row (not setof), so a "no match" result can come
    // back as PostgREST's all-null composite object rather than a JS null — `!data` alone misses
    // that case and used to fall through to joinRoom(undefined).
    const code = (data as { code?: string } | null)?.code;
    if (error || !code) { setCodeError('No open duels right now — try creating one!'); return; }
    await joinRoom(code, 'search');
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

  const armTurnTimerRef = useRef<(startedAt?: number) => void>(() => {});

  // Arms the shared turn clock — called once the guesser has actually confirmed they can see the
  // signer's video ('video-ready' -> signer stamps startedAt and replies 'turn-start' -> both
  // clients arm off that identical instant), or by the fallback timeout if that handshake never
  // completes. Idempotent per round via turnArmedThisRoundRef.
  const armTurnTimer = useCallback((startedAt?: number) => {
    if (turnArmedThisRoundRef.current) return;
    turnArmedThisRoundRef.current = true;
    if (turnArmFallbackRef.current) { clearTimeout(turnArmFallbackRef.current); turnArmFallbackRef.current = null; }
    const at = startedAt ?? Date.now();
    turnStartedAtRef.current = at;
    setTurnArmed(true);
    // I'm the signer confirming video-ready — stamp + tell the guesser so both clocks agree.
    if (startedAt === undefined && phaseRef.current === 'signer') {
      const ms = matchStateRef.current;
      if (ms) signaling.send('turn-start', { startedAt: at }, ms.opponentId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { armTurnTimerRef.current = armTurnTimer; }, [armTurnTimer]);

  const handleVideoReady = useCallback(() => {
    // I'm the guesser and can now actually see the signer — tell them so they can arm the clock.
    // Sent once per round (a stream reattach on remount can otherwise re-fire this).
    if (videoReadySentRef.current || phaseRef.current !== 'guesser') return;
    videoReadySentRef.current = true;
    const ms = matchStateRef.current;
    if (ms) signaling.send('video-ready', {}, ms.opponentId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-turn 15s countdown for both the signer and guesser, synced to a shared startedAt (armed by
  // armTurnTimer above) rather than each client's own Date.now() at phase-entry — so the clock
  // only starts once the guesser can actually SEE the signer's camera, not merely once WebRTC
  // reports 'connected'. The SIGNER is authoritative on expiry (it broadcasts 'turn-timeout'), so
  // the two clocks never need per-tick syncing beyond that shared start. Re-armed every round.
  useEffect(() => {
    if (phase !== 'signer' && phase !== 'guesser') {
      if (turnIntervalRef.current) { clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; }
      if (turnArmFallbackRef.current) { clearTimeout(turnArmFallbackRef.current); turnArmFallbackRef.current = null; }
      return;
    }
    turnEndedRef.current = false;
    turnArmedThisRoundRef.current = false;
    videoReadySentRef.current = false;
    setTurnArmed(false);
    setTimeLeft(turnSecondsRef.current);
    // Safety net: arm anyway after TURN_ARM_FALLBACK_MS if the video-ready/turn-start handshake
    // never completes (dropped message, camera denied), so a round can't stall forever.
    turnArmFallbackRef.current = setTimeout(() => armTurnTimerRef.current(), TURN_ARM_FALLBACK_MS);
    turnIntervalRef.current = setInterval(() => {
      if (!turnArmedThisRoundRef.current) return;
      const remaining = turnSecondsRef.current - (Date.now() - turnStartedAtRef.current) / 1000;
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
    return () => {
      if (turnIntervalRef.current) { clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; }
      if (turnArmFallbackRef.current) { clearTimeout(turnArmFallbackRef.current); turnArmFallbackRef.current = null; }
    };
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
    clearJoinAnnounce();
    clearReconnectTimers();
  }, [clearReconnectTimers, clearJoinAnnounce]);

  // Opponent forfeits by leaving: after RECONNECT_SECONDS with no reconnection, the staying player
  // wins outright and gets the normal win reward. Unchanged from before — only WHO sees which
  // message during the wait changes, not this countdown/forfeit mechanic itself.
  const forfeitWin = useCallback(() => {
    clearReconnectTimers();
    setEndedByForfeit(true);
    setPhase('done');
    track('multiplayer_match_finished', {
      mode: 'duel',
      room_id: matchStateRef.current?.roomId ?? '',
      player_count: 2,
      duration_ms: Date.now() - matchStartedAtRef.current,
      won: true,
      forfeited: true,
    });
    addSigns(200);
    addGold(10);
    sounds.levelUp();
    burst();
  }, [addGold, addSigns, burst, clearReconnectTimers, sounds]);

  // The opponent's presence came back within the window — resume where the match left off, and
  // re-attempt the WebRTC handshake (presence recovering doesn't by itself repair a peer
  // connection that failed — that needs a fresh offer/answer).
  const resumeAfterReconnect = useCallback(() => {
    clearReconnectTimers();
    setPhase(phaseBeforeDisconnectRef.current);
    track('multiplayer_reconnected', { mode: 'duel', room_id: matchStateRef.current?.roomId ?? '', downtime_ms: Date.now() - disconnectedAtRef.current });
    const opponentId = matchStateRef.current?.opponentId;
    if (opponentId) void signaling.connectToPeer(opponentId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearReconnectTimers]);

  // Opponent dropped mid-match (explicit 'bye' or their presence left the signaling channel).
  // Show the waiting banner + 30s countdown; arm the forfeit timer. This fires identically for
  // both players today, but the RENDER below differentiates via `channelStatus`: only the player
  // whose OWN channel actually dropped sees a "you're disconnected" call-to-action — the other
  // sees a passive "opponent disconnected" notice, since reconnecting is meaningless for them.
  const handleOpponentLost = useCallback(() => {
    const p = phaseRef.current;
    if (p !== 'signer' && p !== 'guesser' && p !== 'result') return; // only interrupt active play
    phaseBeforeDisconnectRef.current = p;
    setPhase('waiting-reconnect');
    setReconnectLeft(RECONNECT_SECONDS);
    clearReconnectTimers();
    disconnectedAtRef.current = Date.now();
    track('multiplayer_connection_lost', { mode: 'duel', room_id: matchStateRef.current?.roomId ?? '' });
    reconnectIntervalRef.current = setInterval(() => setReconnectLeft((s) => Math.max(0, s - 1)), 1000);
    forfeitTimerRef.current = setTimeout(() => forfeitWin(), RECONNECT_SECONDS * 1000);
  }, [clearReconnectTimers, forfeitWin]);
  useEffect(() => { handleOpponentLostRef.current = handleOpponentLost; }, [handleOpponentLost]);

  const exit = () => {
    // Tell the opponent we're leaving so their client can start the reconnect/forfeit countdown
    // immediately instead of waiting for presence to time out.
    if (matchStateRef.current?.opponentId) signaling.send('bye', {}, matchStateRef.current.opponentId);
    recognition.stopLoop();
    clearReconnectTimers();
    const roomId = matchStateRef.current?.roomId;
    const activePhases: Phase[] = ['signer', 'guesser', 'result', 'waiting-reconnect'];
    if (activePhases.includes(phaseRef.current)) {
      track('multiplayer_match_abandoned', { mode: 'duel', room_id: roomId ?? '', at_round: matchStateRef.current?.round ?? 0 });
    } else if (roomId) {
      track('multiplayer_room_left', { mode: 'duel', room_id: roomId });
    }
    if (roomId) {
      // Host exiting ends the match for good — delete the room outright rather than just
      // decrementing the count (previously this called leave_multiplayer_room unconditionally,
      // even for the host, so a duel's host leaving never cleaned up the room at all).
      if (isHostRef.current) void supabase.from('multiplayer_rooms').delete().eq('code', roomId);
      else void supabase.rpc('leave_multiplayer_room', { p_code: roomId });
    }
    signaling.leave();
    onExit();
  };

  const remoteStream = matchState ? signaling.peers[matchState.opponentId]?.stream ?? null : null;
  const remoteConnected = matchState ? signaling.peers[matchState.opponentId]?.connectionState === 'connected' : false;
  const opponentPresent = matchState ? signaling.presentPeerIds.includes(matchState.opponentId) : false;
  // Whether it's THIS client's own signaling connection that's down — see ChannelStatus's
  // docstring. Drives which half of the reconnect UI renders below.
  const iAmDisconnected = signaling.channelStatus === 'disconnected';

  // Watch the opponent's PRESENCE (not raw WebRTC connectionState, which is symmetric and can't
  // say WHO dropped): a drop during active play starts the reconnect wait; a recovery during the
  // wait resumes the match. wasPresentRef avoids firing on the initial pre-join state.
  useEffect(() => {
    if (opponentPresent) {
      wasPresentRef.current = true;
      if (phase === 'waiting-reconnect') resumeAfterReconnect();
    } else if (wasPresentRef.current) {
      handleOpponentLost();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentPresent, phase]);

  const opponentBorderClasses = matchState?.opponentBorder ? (getShopItem(matchState.opponentBorder)?.preview ?? '') : '';
  const totalRounds = roundSignIds.length || ROUNDS;
  const timerPercent = turnArmed ? (timeLeft / turnSecondsRef.current) * 100 : 100;

  return (
    <div className="min-h-dvh bg-z-bg flex flex-col">
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

              <div className="w-full max-w-xs flex flex-col gap-2">
                <RoomRulesPanel rules={rules} onChange={setRules} roundsOptions={DUEL_ROUNDS_OPTIONS} />
                <RoomVisibilityToggle visibility={visibility} onChange={setVisibility} />
                <Button onClick={() => createRoom()} fullWidth>
                  Create Room
                </Button>
              </div>

              <motion.button onClick={() => void searchForMatch()} disabled={searching}
                className="w-full max-w-xs py-3 rounded-2xl font-bold text-sm bg-z-card border border-white/10 hover:border-z-purple/40 disabled:opacity-50"
                whileTap={{ scale: 0.97 }}>
                {searching ? 'Searching…' : '🔍 Search for a Match'}
              </motion.button>
              {codeError && <p className="text-center text-z-red text-xs -mt-3">{codeError}</p>}

              <RoomJoinByCode
                id="duel-join-code"
                value={joinCode}
                onChange={(v) => { setJoinCode(v); setCodeError(''); }}
                onJoin={() => joinRoom()}
              />
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
                <RoundProgressDots total={totalRounds} current={matchState.round} />
                <Scoreboard entries={[{ label: 'You', score: matchState.myScore, isYou: true }, { label: matchState.opponentUsername, score: matchState.opponentScore, isYou: false }]} />
              </div>
              <div className="bg-z-card border border-z-purple/30 rounded-2xl p-4 text-center">
                <p className="text-xs text-z-gray-400 mb-1">
                  SIGN THIS · {turnArmed ? <span className={timeLeft <= 3 ? 'text-z-red font-bold' : ''}>{Math.ceil(timeLeft)}s</span> : <span className="text-z-gray-400">waiting for {matchState.opponentUsername}'s camera…</span>}
                </p>
                <p className="text-3xl font-bold text-z-purple-light">{SIGNS[matchState.currentSign]?.name.replace(/_/g, ' ') ?? matchState.currentSign}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                <RoundProgressDots total={totalRounds} current={matchState.round} />
                <Scoreboard entries={[{ label: 'You', score: matchState.myScore, isYou: true }, { label: matchState.opponentUsername, score: matchState.opponentScore, isYou: false }]} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <RemotePeerVideo stream={remoteStream} label={`${matchState.opponentUsername} — signing`} connected={remoteConnected} cosmeticBorderClasses={opponentBorderClasses} activeTurn turnLabel={`${matchState.opponentUsername}'s turn`} timerPercent={timerPercent} onVideoReady={handleVideoReady} />
                <WebcamMirror videoRef={signaling.localVideoRef} label="You" cosmeticBorderClasses={cosmeticBorderClasses} />
              </div>
              <p className="text-center font-bold">
                What are they signing? · {turnArmed ? <span className={timeLeft <= 3 ? 'text-z-red' : 'text-z-gray-400'}>{Math.ceil(timeLeft)}s</span> : <span className="text-z-gray-400 font-normal text-sm">connecting…</span>}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {guessOptions.map((s) => (
                  <motion.button key={s} onClick={() => handleGuess(s)}
                    disabled={!!guessResult}
                    className={`py-4 rounded-2xl font-bold text-sm border transition-colors ${
                      guessResult
                        ? s === matchState.currentSign
                          ? 'bg-z-green/20 border-z-green text-z-green'
                          : 'border-white/8 text-z-gray-400'
                        : 'bg-z-card border-z-gray-400/30 hover:border-z-purple/40 text-z-gray-50'
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
              {iAmDisconnected ? (
                <>
                  <h2 className="text-xl font-bold text-center">You've been disconnected</h2>
                  <p className="text-z-gray-400 text-sm text-center">Reconnecting automatically…</p>
                  <p className="text-4xl font-bold text-z-purple-light">{reconnectLeft}s</p>
                  <p className="text-z-gray-400 text-xs text-center">If reconnecting fails, use the button below.</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-center">{matchState.opponentUsername} disconnected</h2>
                  <p className="text-z-gray-400 text-sm text-center">Waiting for them to reconnect — the match is still on.</p>
                  <p className="text-4xl font-bold text-z-purple-light">{reconnectLeft}s</p>
                  <p className="text-z-gray-400 text-xs text-center">If they don't come back, you win.</p>
                </>
              )}
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
                  <span className="text-z-gray-400 font-bold">vs</span>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-z-gray-200">{matchState.opponentScore}</p>
                    <p className="text-xs text-z-gray-400 mt-0.5">{matchState.opponentUsername}</p>
                  </div>
                </div>
              </div>
              {iWon && (
                <p className="text-z-yellow font-bold">+200 🤟 Signs · +10 🪙 Gold</p>
              )}
              <Button onClick={exit}>
                Back to Home
              </Button>
              <button onClick={() => setReportOpen(true)}
                className="text-xs text-z-gray-400 hover:text-z-red transition-colors">
                🚩 Report {matchState.opponentUsername}
              </button>
            </motion.div>
            );
          })()}

        </AnimatePresence>
      </div>

      {/* Bottom-middle reconnect banner. Split by WHO actually disconnected (see channelStatus/
          presence above): the player whose own connection dropped gets a manual retry (auto-
          reconnect usually handles it, but the button covers the case where it doesn't); the
          player who stayed just gets an informational notice — clicking "reconnect" themselves
          wouldn't do anything, since their own link was never the problem. Once the dropped
          player's presence actually returns, resumeAfterReconnect() re-attempts the WebRTC
          handshake automatically from the staying player's side. */}
      {phase === 'waiting-reconnect' && matchState && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-overlay bg-z-card border border-z-purple/40 rounded-2xl px-5 py-3 shadow-xl flex items-center gap-4">
          {iAmDisconnected ? (
            <>
              <span className="text-sm font-semibold">You're disconnected — {reconnectLeft}s</span>
              <button onClick={() => void signaling.join(`mp-room-${matchState.roomId}`)}
                className="px-3.5 py-1.5 rounded-xl bg-z-purple text-white text-xs font-bold">
                Retry
              </button>
            </>
          ) : (
            <span className="text-sm font-semibold">{matchState.opponentUsername} disconnected — {reconnectLeft}s</span>
          )}
          <button onClick={exit} className="text-xs text-z-gray-400 hover:text-z-gray-50 min-h-11 px-2 -mx-2">Leave</button>
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
