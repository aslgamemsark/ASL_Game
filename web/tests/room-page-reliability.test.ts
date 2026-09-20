import { beforeEach, afterEach, expect, it, vi } from 'vitest';
// Persistent hook slots exercise the real page handlers without adding a DOM dependency.
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as (() => void)[], cleanups: [] as (() => void)[], message: null as any, send: vi.fn(), addGold: vi.fn(), addSigns: vi.fn(), present: ['host', 'guest'], user: 'host', leave: vi.fn() }));
vi.mock('react', () => ({
  useState: (initial: any) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = initial; return [h.slots[i], (v: any) => { h.slots[i] = typeof v === 'function' ? v(h.slots[i]) : v; }]; },
  useRef: (initial: any) => h.slots[h.cursor++] ??= { current: initial },
  useCallback: (fn: any) => fn,
  useEffect: (fn: any, deps?: any[]) => { const i = h.cursor++; const old = h.slots[i]; if (!deps || !old || deps.some((d, j) => !Object.is(d, old[j]))) { h.slots[i] = deps; h.effects.push(() => { h.cleanups[i]?.(); h.cleanups[i] = fn(); }); } },
}));
vi.mock('framer-motion', () => ({ motion: { div: 'div', button: 'button' }, AnimatePresence: 'div' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: h.user }, username: h.user }) }));
vi.mock('@/stores/useUserStore', () => ({ useUserStore: () => ({ addGold: h.addGold, addSigns: h.addSigns }) }));
vi.mock('@/hooks/useRecognition', () => ({ useRecognition: () => ({ init: vi.fn(), stopLoop: vi.fn(), startLoop: vi.fn() }) }));
vi.mock('@/hooks/useAttemptLog', () => ({ useAttemptLog: () => ({ recordAttempt: vi.fn() }) }));
vi.mock('@/hooks/useSounds', () => ({ useSounds: () => ({ correct: vi.fn(), wrong: vi.fn(), levelUp: vi.fn() }) }));
vi.mock('@/hooks/useConfetti', () => ({ useConfetti: () => ({ burst: vi.fn() }) }));
vi.mock('@/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/joinMultiplayerRoom', () => ({ joinMultiplayerRoom: async () => null }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ insert: async () => ({}), update: () => ({ eq: async () => ({}) }), select: () => ({ eq: () => ({ single: async () => ({ data: { host_id: 'host' } }) }) }) }), rpc: vi.fn() } }));
vi.mock('@/hooks/useMultiplayerSignaling', () => ({ useMultiplayerSignaling: (options: any) => { h.message = options.onMessage; return { send: h.send, join: async () => {}, startCamera: async () => {}, leave: h.leave, presentPeerIds: h.present, channelStatus: 'subscribed', peers: {}, localVideoRef: { current: null }, connectToPeer: vi.fn(), disconnectFromPeer: vi.fn(), camStatus: 'idle' }; } }));
vi.mock('@/components/multiplayer/MultiplayerLobby', () => ({ MultiplayerLobby: 'lobby' }));
vi.mock('@/components/shared/Button', () => ({ Button: 'button' }));
vi.mock('@/components/shared/HeaderBackButton', () => ({ HeaderBackButton: 'back' }));
vi.mock('@/components/shared/WebcamMirror', () => ({ WebcamMirror: 'camera' }));
vi.mock('@/components/shared/RemotePeerVideo', () => ({ RemotePeerVideo: 'remote' }));
vi.mock('@/components/multiplayer/Scoreboard', () => ({ Scoreboard: 'scores' }));
vi.mock('@/components/multiplayer/RoundProgressDots', () => ({ RoundProgressDots: 'rounds' }));
vi.mock('@/components/multiplayer/RoundResultCard', () => ({ RoundResultCard: 'result' }));
import { RoomPage } from '../src/pages/RoomPage';
import { SIGNS } from '../src/data/signs';
const sign = Object.keys(SIGNS)[0];
function render() { h.cursor = 0; const tree = RoomPage({ onExit: vi.fn() }); h.effects.splice(0).forEach(fn => fn()); return tree; }
function nodes(v: any): any[] { return !v || typeof v !== 'object' ? [] : Array.isArray(v) ? v.flatMap(nodes) : [v, ...nodes(v.props?.children)]; }
function get(type: string) { return nodes(render()).find(n => n.type === type); }
function message(event: string, payload: any, from = 'host') { h.message(event, payload, from); }
async function joinGuest() {
  h.user = 'guest'; get('lobby').props.onJoinCodeChange('ABC123'); get('lobby').props.onJoin(); for (let i = 0; i < 8; i++) await Promise.resolve(); render();
  message('roster', { members: [{ peerId: 'host', username: 'Host', joinOrder: 0 }, { peerId: 'guest', username: 'Guest', joinOrder: 1 }] });
  message('game-start', { signs: [sign, sign], turnOrder: ['host', 'guest'], turnSeconds: 15 });
  message('round-start', { round: 1, signerPeerId: 'host', signId: sign }); render();
}
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); h.slots = []; h.cursor = 0; h.effects = []; h.cleanups = []; h.user = 'host'; h.present = ['host', 'guest']; });
afterEach(() => { h.cleanups.forEach(fn => fn?.()); vi.useRealTimers(); });
it('starts round one, ignores repeated results and stale starts, and rewards only once', async () => {
  await joinGuest(); expect(get('rounds').props.current).toBe(1);
  message('round-end', { round: 1, scoreDeltas: { guest: 1 } }); message('round-end', { round: 1, scoreDeltas: { guest: 1 } });
  message('round-start', { round: 1, signerPeerId: 'host', signId: sign });
  expect(get('result')).toBeTruthy(); expect(get('scores').props.entries.find((p: any) => p.isYou).score).toBe(1);
  message('game-over', { finalScores: { guest: 1, host: 0 } }); message('game-over', { finalScores: { guest: 1, host: 0 } }); expect(h.addGold).toHaveBeenCalledTimes(1);
});
it('uses the final score snapshot when the last round-end was missed', async () => {
  await joinGuest(); message('game-over', { finalScores: { guest: 1, host: 0 } }); expect(h.addSigns).toHaveBeenCalledWith(150); expect(h.addGold).toHaveBeenCalledWith(8);
});
it('cancels host-loss timeout after recovery and ends sustained loss without rewards', async () => {
  await joinGuest(); h.present = ['guest']; render(); vi.advanceTimersByTime(20000); h.present = ['host', 'guest']; render(); vi.advanceTimersByTime(20000); expect(h.leave).not.toHaveBeenCalled();
  h.present = ['guest']; render(); vi.advanceTimersByTime(30000); expect(h.leave).toHaveBeenCalledTimes(1); message('game-over', { finalScores: { guest: 1 } }); expect(h.addGold).not.toHaveBeenCalled();
});
it('acknowledges repeated roster joins and ignores stranger readiness', async () => {
  await get('lobby').props.onCreate(); render(); message('roster-join', { username: 'Guest' }, 'guest'); message('roster-join', { username: 'Guest' }, 'guest'); expect(h.send.mock.calls.filter(c => c[0] === 'roster')).toHaveLength(2);
  nodes(render()).find(n => n.type === 'button' && n.props.children === 'Start Game').props.onClick(); render(); message('video-ready', { round: 1 }, 'stranger'); expect(h.send.mock.calls.filter(c => c[0] === 'round-timer-start')).toHaveLength(0);
  message('video-ready', { round: 1 }, 'guest'); expect(h.send.mock.calls.filter(c => c[0] === 'round-timer-start')).toHaveLength(1);
});

