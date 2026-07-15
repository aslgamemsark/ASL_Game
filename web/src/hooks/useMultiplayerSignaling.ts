import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCamera, type CameraStatus } from '@/hooks/useCamera';

// STUN handles most home networks; the public OpenRelay TURN servers relay media when a player is
// behind a symmetric/mobile NAT that STUN alone can't punch through. Best-effort — for guaranteed
// relay, swap in your own TURN.
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

export interface SignalingPeer {
  peerId: string;
  connectionState: RTCPeerConnectionState;
  stream: MediaStream | null;
}

export interface UseMultiplayerSignalingOpts {
  selfPeerId: string;
  /** Every broadcast event this hook doesn't own (roster/round-start/guess/etc.) — webrtc-offer/
   *  answer/ice targeted at another peer are filtered out before reaching this callback. */
  onMessage?: (event: string, payload: Record<string, unknown>, fromPeerId: string) => void;
}

export interface MultiplayerSignaling {
  camStatus: CameraStatus;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  peers: Record<string, SignalingPeer>;
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
export function useMultiplayerSignaling({ selfPeerId, onMessage }: UseMultiplayerSignalingOpts): MultiplayerSignaling {
  const { videoRef: localVideoRef, status: camStatus, start: startCamera, stop: stopCamera, getStream } = useCamera();
  const [peers, setPeers] = useState<Record<string, SignalingPeer>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

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
  }, []);

  const createPeerConnection = useCallback((peerId: string) => {
    // Tear down any prior connection under this key first (duplicate offer / re-entry / role
    // rotation in Room mode), so a stale connection never leaks.
    closePeerConnection(peerId);
    const pc = new RTCPeerConnection(ICE_SERVERS);
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
    const ch = supabase.channel(channelName);
    channelRef.current = ch;

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

    await new Promise<void>((resolve) => ch.subscribe((status) => { if (status === 'SUBSCRIBED') resolve(); }));
  }, [createPeerConnection, flushPendingCandidates, handleIceCandidate, selfPeerId, send]);

  const leave = useCallback(() => {
    Object.keys(pcsRef.current).forEach(closePeerConnection);
    setPeers({});
    stopCamera();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [closePeerConnection, stopCamera]);

  useEffect(() => () => leave(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { camStatus, localVideoRef, peers, join, startCamera, connectToPeer, disconnectFromPeer, send, leave };
}
