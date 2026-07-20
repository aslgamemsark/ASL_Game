import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCamera, type CameraStatus } from '@/hooks/useCamera';
import { getIceServers, isUsingDefaultTurn } from '@/config/iceServers';

/** Outcome of one peer's WebRTC ICE negotiation, reported to the caller for analytics only (the
 *  hook stays game-agnostic — the page attaches its mode/room_id). `candidateType` is the selected
 *  local candidate: 'host'/'srflx' = direct/STUN (no relay), 'relay' = went through TURN. */
export type IceResult =
  | { outcome: 'connected'; connectionTimeMs: number; candidateType: string; usedRelay: boolean; usedDefaultTurn: boolean }
  | { outcome: 'failed'; reason: string; usedDefaultTurn: boolean };

/** Inspect the negotiated ICE candidate pair to learn whether the connection went direct, via STUN,
 *  or had to relay through TURN. Best-effort: any stats hiccup degrades to 'unknown'/no-relay rather
 *  than throwing (this is telemetry, never on the connection's critical path). */
async function inspectSelectedCandidate(pc: RTCPeerConnection): Promise<{ candidateType: string; usedRelay: boolean }> {
  try {
    const stats = await pc.getStats();
    let localId: string | undefined;
    let remoteId: string | undefined;
    stats.forEach((r) => {
      const pair = r as RTCIceCandidatePairStats & { selected?: boolean; nominated?: boolean };
      if (pair.type === 'candidate-pair' && (pair.selected || (pair.state === 'succeeded' && pair.nominated))) {
        localId = pair.localCandidateId;
        remoteId = pair.remoteCandidateId;
      }
    });
    const localType = (localId ? (stats.get(localId) as { candidateType?: string } | undefined)?.candidateType : undefined) ?? 'unknown';
    const remoteType = (remoteId ? (stats.get(remoteId) as { candidateType?: string } | undefined)?.candidateType : undefined) ?? 'unknown';
    return { candidateType: localType, usedRelay: localType === 'relay' || remoteType === 'relay' };
  } catch {
    return { candidateType: 'unknown', usedRelay: false };
  }
}

export interface SignalingPeer {
  peerId: string;
  connectionState: RTCPeerConnectionState;
  stream: MediaStream | null;
}

/** Health of THIS client's own signaling channel — distinct from any peer's WebRTC
 *  connectionState. A dropped WebRTC link is symmetric (both sides observe it identically), so it
 *  can't tell you WHICH side actually lost connectivity. channelStatus can: if it's 'subscribed',
 *  my own connection is fine and a peer's dropped link means THEY disconnected; if it isn't, I'm
 *  the one who dropped. */
export type ChannelStatus = 'connecting' | 'subscribed' | 'disconnected';

export interface UseMultiplayerSignalingOpts {
  selfPeerId: string;
  /** Every broadcast event this hook doesn't own (roster/round-start/guess/etc.) — webrtc-offer/
   *  answer/ice targeted at another peer are filtered out before reaching this callback. */
  onMessage?: (event: string, payload: Record<string, unknown>, fromPeerId: string) => void;
  /** Fired once per peer connection when ICE reaches a terminal state (connected/failed), for
   *  networking analytics. The hook has no mode/room_id (it's game-agnostic) — the caller attaches
   *  those. Purely observational; never affects connection behavior. */
  onIceResult?: (result: IceResult) => void;
}

export interface MultiplayerSignaling {
  camStatus: CameraStatus;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  peers: Record<string, SignalingPeer>;
  /** This client's own signaling channel health — see ChannelStatus above. */
  channelStatus: ChannelStatus;
  /** peerIds currently present on the signaling channel (Supabase Realtime Presence), i.e. whose
   *  tab/app is actually still connected — independent of any WebRTC peer-connection state. The
   *  reliable signal for "did peer X disconnect" in Room mode, where not every pair of players has
   *  a live WebRTC link (only the active signer connects to each guesser). */
  presentPeerIds: string[];
  /** Creates + subscribes the Supabase realtime channel, e.g. `mp-room-${roomId}` — same naming
   *  scheme for Duel and Room. The room id isn't known until the caller creates/joins a room, so
   *  this takes the channel name directly rather than fixing it at hook-call time. */
  join: (channelName: string) => Promise<void>;
  startCamera: () => Promise<void>;
  /** Offerer role — creates a peer connection to `peerId` and sends it a webrtc-offer. */
  connectToPeer: (peerId: string) => Promise<void>;
  disconnectFromPeer: (peerId: string) => void;
  send: (event: string, payload?: Record<string, unknown>, to?: string) => void;
  leave: () => void;
}

/**
 * Shared low-level plumbing for both Duel (1 peer) and Room (up to 3 peers) modes: Supabase
 * channel signaling, per-peer RTCPeerConnection creation with ICE queueing, and camera start/stop.
 * Game-flow state (rounds, scores, roles, sign selection, phase machine) is owned by the caller,
 * not this hook.
 */
export function useMultiplayerSignaling({ selfPeerId, onMessage, onIceResult }: UseMultiplayerSignalingOpts): MultiplayerSignaling {
  const { videoRef: localVideoRef, status: camStatus, start: startCamera, stop: stopCamera, getStream } = useCamera('multiplayer');
  const [peers, setPeers] = useState<Record<string, SignalingPeer>>({});
  const [channelStatus, setChannelStatus] = useState<ChannelStatus>('connecting');
  const [presentPeerIds, setPresentPeerIds] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  const onIceResultRef = useRef(onIceResult);
  useEffect(() => { onIceResultRef.current = onIceResult; }, [onIceResult]);
  // One ICE result per peer connection — guards against onconnectionstatechange firing 'connected'
  // or 'failed' more than once (e.g. connected -> disconnected -> connected) double-counting.
  const iceReportedRef = useRef<Record<string, boolean>>({});

  const send = useCallback((event: string, payload: Record<string, unknown> = {}, to?: string) => {
    channelRef.current?.send({
      type: 'broadcast',
      event,
      payload: { ...payload, from: selfPeerId, ...(to ? { to } : {}) },
    });
  }, [selfPeerId]);

  const updatePeer = useCallback((peerId: string, patch: Partial<SignalingPeer>) => {
    setPeers((prev) => {
      const existing: SignalingPeer = prev[peerId] ?? { peerId, connectionState: 'new', stream: null };
      return { ...prev, [peerId]: { ...existing, ...patch, peerId } };
    });
  }, []);

  const closePeerConnection = useCallback((peerId: string) => {
    pcsRef.current[peerId]?.close();
    delete pcsRef.current[peerId];
    delete pendingCandidatesRef.current[peerId];
    delete iceReportedRef.current[peerId];
  }, []);

  const createPeerConnection = useCallback((peerId: string) => {
    // Tear down any prior connection under this key first (duplicate offer / re-entry / role
    // rotation in Room mode), so a stale connection never leaks.
    closePeerConnection(peerId);
    const pc = new RTCPeerConnection(getIceServers());
    iceReportedRef.current[peerId] = false;
    const startedAt = performance.now();
    pc.onicecandidate = (e) => {
      if (e.candidate) send('webrtc-ice', { candidate: e.candidate.toJSON() }, peerId);
    };
    pc.ontrack = (e) => {
      // Held in state, not attached directly here — the consuming <video> may remount as
      // rounds/roles swap, and ontrack only fires once.
      updatePeer(peerId, { stream: e.streams[0] });
    };
    pc.onconnectionstatechange = () => {
      updatePeer(peerId, { connectionState: pc.connectionState });
      // Report the first terminal ICE outcome to the caller for networking analytics (see
      // onIceResult). Once-per-connection so a later flap doesn't double-count.
      const state = pc.connectionState;
      if ((state === 'connected' || state === 'failed') && !iceReportedRef.current[peerId]) {
        iceReportedRef.current[peerId] = true;
        const usedDefaultTurn = isUsingDefaultTurn();
        if (state === 'connected') {
          const connectionTimeMs = Math.round(performance.now() - startedAt);
          void inspectSelectedCandidate(pc).then(({ candidateType, usedRelay }) => {
            onIceResultRef.current?.({ outcome: 'connected', connectionTimeMs, candidateType, usedRelay, usedDefaultTurn });
          });
        } else {
          onIceResultRef.current?.({ outcome: 'failed', reason: 'ice-connection-failed', usedDefaultTurn });
        }
      }
    };
    const stream = getStream();
    stream?.getTracks().forEach((t) => pc.addTrack(t, stream));
    pcsRef.current[peerId] = pc;
    pendingCandidatesRef.current[peerId] = [];
    return pc;
  }, [closePeerConnection, getStream, send, updatePeer]);

  const flushPendingCandidates = useCallback(async (peerId: string) => {
    const pc = pcsRef.current[peerId];
    if (!pc) return;
    const queued = pendingCandidatesRef.current[peerId] ?? [];
    pendingCandidatesRef.current[peerId] = [];
    for (const c of queued) {
      try { await pc.addIceCandidate(c); } catch { /* stale candidate — ignore */ }
    }
  }, []);

  const handleIceCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => {
    const pc = pcsRef.current[peerId];
    if (pc?.remoteDescription) {
      try { await pc.addIceCandidate(candidate); } catch { /* stale candidate — ignore */ }
    } else {
      (pendingCandidatesRef.current[peerId] ??= []).push(candidate);
    }
  }, []);

  const connectToPeer = useCallback(async (peerId: string) => {
    const pc = createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send('webrtc-offer', { sdp: { type: offer.type, sdp: offer.sdp } }, peerId);
  }, [createPeerConnection, send]);

  const disconnectFromPeer = useCallback((peerId: string) => {
    closePeerConnection(peerId);
    setPeers((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, [closePeerConnection]);

  const join = useCallback(async (channelName: string) => {
    // private: true engages Realtime Authorization — the server checks RLS on realtime.messages
    // (room membership via multiplayer_room_members) before allowing join or send, so a stranger
    // holding the publishable key can no longer subscribe to a room's WebRTC signaling. See
    // migration 20260718010000_realtime_authorization.sql.
    //
    // Belt-and-suspenders on top of the global auth listener in lib/supabase.ts: explicitly hand
    // the Realtime socket the CURRENT access token right before subscribing, so a private join can
    // never race a not-yet-synced token (which would fail RLS with auth.uid() = null and hang).
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) await supabase.realtime.setAuth(session.access_token);

    // Drop any prior channel first — a retry (e.g. the reconnect button) calls join() again without
    // leave(), which would otherwise orphan the old channel with a live subscription + presence.
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }

    const ch = supabase.channel(channelName, { config: { presence: { key: selfPeerId }, private: true } });
    channelRef.current = ch;

    // Presence tracks channel MEMBERSHIP (whose tab/socket is actually connected), independent of
    // any WebRTC peer-connection state — a symmetric WebRTC drop can't tell you which side
    // actually disconnected, but presence 'leave' names the exact peerId whose channel dropped.
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ peerId: string }>();
      setPresentPeerIds(Object.keys(state));
    });

    ch.on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
      const fromId = payload.from as string;
      if (payload.to && payload.to !== selfPeerId) return;
      const pc = createPeerConnection(fromId);
      await pc.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
      await flushPendingCandidates(fromId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send('webrtc-answer', { sdp: { type: answer.type, sdp: answer.sdp } }, fromId);
    });
    ch.on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
      const fromId = payload.from as string;
      if (payload.to && payload.to !== selfPeerId) return;
      const pc = pcsRef.current[fromId];
      if (!pc) return;
      await pc.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
      await flushPendingCandidates(fromId);
    });
    ch.on('broadcast', { event: 'webrtc-ice' }, ({ payload }) => {
      const fromId = payload.from as string;
      if (payload.to && payload.to !== selfPeerId) return;
      void handleIceCandidate(fromId, payload.candidate as RTCIceCandidateInit);
    });
    ch.on('broadcast', { event: '*' }, ({ event, payload }) => {
      if (['webrtc-offer', 'webrtc-answer', 'webrtc-ice'].includes(event)) return;
      if (payload.to && payload.to !== selfPeerId) return;
      onMessageRef.current?.(event, payload, payload.from as string);
    });

    // Settle the initial-join promise exactly once. Resolving on terminal states too (not just
    // SUBSCRIBED) is what stops a denied/failed subscribe from hanging the caller forever on
    // "Joining room…" — the app's ChannelStatus UI then reflects 'disconnected' and offers retry,
    // instead of an infinite spinner. Later reconnect cycles re-enter this callback but `settled`
    // keeps them from re-settling the promise; the re-track below still runs on every SUBSCRIBED.
    let settled = false;
    await new Promise<void>((resolve) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChannelStatus('subscribed');
          void ch.track({ peerId: selfPeerId });
          if (!settled) { settled = true; resolve(); }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setChannelStatus('disconnected');
          if (!settled) { settled = true; resolve(); }
        }
      });
    });
  }, [createPeerConnection, flushPendingCandidates, handleIceCandidate, selfPeerId, send]);

  const leave = useCallback(() => {
    Object.keys(pcsRef.current).forEach(closePeerConnection);
    setPeers({});
    setPresentPeerIds([]);
    setChannelStatus('connecting');
    stopCamera();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [closePeerConnection, stopCamera]);

  useEffect(() => () => leave(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { camStatus, localVideoRef, peers, channelStatus, presentPeerIds, join, startCamera, connectToPeer, disconnectFromPeer, send, leave };
}
