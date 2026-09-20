import { expect, it, vi } from 'vitest';
import { useMultiplayerSignaling } from '../src/hooks/useMultiplayerSignaling';

const { handlers, pcs } = vi.hoisted(() => ({
  handlers: new Map<string, (message: unknown) => Promise<void> | void>(),
  pcs: [] as Array<{ addIceCandidate: ReturnType<typeof vi.fn> }>,
}));
vi.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useRef: (current: unknown) => ({ current }),
  useState: (value: unknown) => [value, vi.fn()],
}));
vi.mock('../src/hooks/useCamera', () => ({ useCamera: () => ({
  videoRef: { current: null }, status: 'idle', start: vi.fn(), stop: vi.fn(), getStream: () => null,
}) }));
vi.mock('../src/config/iceServers', () => ({ getIceServers: () => ({}), isUsingDefaultTurn: () => false }));
vi.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: null } }) },
  removeChannel: vi.fn(),
  channel: () => {
    const channel = {
      on: (_type: string, filter: { event: string }, fn: (message: unknown) => Promise<void>) => {
        handlers.set(filter.event, fn); return channel;
      },
      subscribe: (fn: (status: string) => void) => fn('SUBSCRIBED'),
      track: vi.fn(), send: vi.fn(), presenceState: () => ({}),
    };
    return channel;
  },
} }));

it('keeps ICE received before the first offer, but discards it when replacing an old connection', async () => {
  class PeerConnection {
    remoteDescription: unknown = null;
    addIceCandidate = vi.fn();
    constructor() { pcs.push(this); }
    close() {}
    async setRemoteDescription(description: unknown) { this.remoteDescription = description; }
    async setLocalDescription() {}
    async createAnswer() { return { type: 'answer', sdp: 'answer' }; }
  }
  vi.stubGlobal('RTCPeerConnection', PeerConnection);
  try {
    const signaling = useMultiplayerSignaling({ selfPeerId: 'self' });
    await signaling.join('mp-room-test');
    const candidate = { candidate: 'early-ice' };
    await handlers.get('webrtc-ice')!({ payload: { from: 'peer', to: 'self', candidate } });
    await handlers.get('webrtc-offer')!({ payload: { from: 'peer', to: 'self', sdp: { type: 'offer', sdp: 'first' } } });
    expect(pcs[0]!.addIceCandidate).toHaveBeenCalledWith(candidate);
    await handlers.get('webrtc-offer')!({ payload: { from: 'peer', to: 'self', sdp: { type: 'offer', sdp: 'replacement' } } });
    expect(pcs[1]!.addIceCandidate).not.toHaveBeenCalled();
    signaling.leave();
  } finally {
    vi.unstubAllGlobals();
  }
});
