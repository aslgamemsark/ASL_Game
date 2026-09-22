import { beforeEach, afterEach, expect, it, vi } from 'vitest';
// Persistent hook slots exercise the real page handlers without adding a DOM dependency.
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as (() => void)[], cleanups: [] as (() => void)[], message: null as any, send: vi.fn(), addGold: vi.fn(), addSigns: vi.fn(), present: ['host', 'guest'], user: 'host', leave: vi.fn(), connect: vi.fn(), status: 'subscribed', join: vi.fn(async () => {}) }));
vi.mock('react', () => ({
  useState: (initial: any) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = initial; return [h.slots[i], (v: any) => { h.slots[i] = typeof v === 'function' ? v(h.slots[i]) : v; }]; },
  useRef: (initial: any) => h.slots[h.cursor++] ??= { current: initial },
  useCallback: (fn: any, deps: any[]) => { const i = h.cursor++; const old = h.slots[i]; if (!old || deps.some((d, j) => !Object.is(d, old.deps[j]))) h.slots[i] = { fn, deps }; return h.slots[i].fn; },
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
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ upsert: async () => ({}), insert: async () => ({}), update: () => ({ eq: async () => ({}) }), select: () => ({ eq: () => ({ single: async () => ({ data: { host_id: 'host' } }) }) }) }), rpc: vi.fn() } }));
vi.mock('@/hooks/useMultiplayerSignaling', () => ({ useMultiplayerSignaling: (options: any) => { h.message = options.onMessage; return { send: h.send, join: h.join, startCamera: async () => {}, leave: h.leave, presentPeerIds: h.present, channelStatus: h.status, peers: {}, localVideoRef: { current: null }, connectToPeer: h.connect, disconnectFromPeer: vi.fn(), camStatus: 'idle' }; } }));
vi.mock('@/components/multiplayer/MultiplayerLobby', () => ({ MultiplayerLobby: 'lobby' }));
vi.mock('@/components/shared/Button', () => ({ Button: 'button' }));
vi.mock('@/components/shared/HeaderBackButton', () => ({ HeaderBackButton: 'back' }));
vi.mock('@/components/shared/WebcamMirror', () => ({ WebcamMirror: 'camera' }));
vi.mock('@/components/shared/RemotePeerVideo', () => ({ RemotePeerVideo: 'remote' }));
vi.mock('@/components/multiplayer/Scoreboard', () => ({ Scoreboard: 'scores' }));
vi.mock('@/components/multiplayer/RoundProgressDots', () => ({ RoundProgressDots: 'rounds' }));
vi.mock('@/components/multiplayer/RoundResultCard', () => ({ RoundResultCard: 'result' }));
import { DuelPage } from '../src/pages/DuelPage';
import { SIGNS } from '../src/data/signs';
const sign = Object.keys(SIGNS)[0];
function render() { h.cursor = 0; const tree = DuelPage({ onExit: vi.fn() }); h.effects.splice(0).forEach(fn => fn()); return tree; }
function nodes(v: any): any[] { return !v || typeof v !== 'object' ? [] : Array.isArray(v) ? v.flatMap(nodes) : [v, ...nodes(v.props?.children)]; }
function get(type: string) { return nodes(render()).find(n => n.type === type); }
function text(v: any): string { return v == null || typeof v === 'boolean' ? '' : typeof v !== 'object' ? String(v) : Array.isArray(v) ? v.map(text).join(' ') : text(v.props?.children); }
function message(event: string, payload: any, from = 'host') { h.message(event, payload, from); }
async function start(host = false) {
  h.user = host ? 'host' : 'guest';
  if (host) get('lobby').props.onCreate();
  else { get('lobby').props.onJoinCodeChange('ABC123'); get('lobby').props.onJoin(); }
  for (let i = 0; i < 8; i++) await Promise.resolve();
  render();
  if (host) message('join', { username: 'Guest' }, 'guest');
  else message('start', { signs: [sign, sign], firstSign: sign, hostId: 'host', turnSeconds: 15 });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  render(); render(); h.connect.mockClear();
}
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); h.slots = []; h.cursor = 0; h.effects = []; h.cleanups = []; h.user = 'host'; h.present = ['host', 'guest']; h.status = 'subscribed'; });
afterEach(() => { h.cleanups.forEach(fn => fn?.()); vi.useRealTimers(); });
it('pauses on local loss with stale presence and exposes retry and leave, without awarding an offline win', async () => {
  await start(); h.status = 'disconnected'; render();
  expect(text(render())).toContain("You've been disconnected");
  const buttons = nodes(render()).filter(n => n.type === 'button');
  buttons.find(n => n.props.children === 'Retry').props.onClick();
  expect(h.join).toHaveBeenLastCalledWith('mp-room-ABC123');
  expect(buttons.some(n => n.props.children === 'Leave')).toBe(true);
  h.status = 'connecting'; render(); expect(text(render())).toContain("You've been disconnected");
  vi.advanceTimersByTime(30000); render();
  expect(text(render())).toContain('Connection could not be restored');
  expect(h.addGold).not.toHaveBeenCalled(); expect(h.addSigns).not.toHaveBeenCalled();
});
it('withholds a forfeit if our channel drops during an opponent-loss countdown', async () => {
  await start(); h.present = ['guest']; render(); render();
  vi.advanceTimersByTime(20000); h.status = 'disconnected'; render();
  vi.advanceTimersByTime(10000); render();
  expect(text(render())).toContain('Connection could not be restored'); expect(h.addGold).not.toHaveBeenCalled();
});
it('withholds a forfeit after local recovery without opponent recovery', async () => {
  await start(); h.status = 'disconnected'; h.present = ['guest']; render(); render();
  vi.advanceTimersByTime(10000); h.status = 'subscribed'; render();
  vi.advanceTimersByTime(20000); render();
  expect(text(render())).toContain('Connection could not be restored'); expect(h.addGold).not.toHaveBeenCalled();
});
it('awards one forfeit to a continuously connected player after sustained opponent absence', async () => {
  await start(); h.present = ['guest']; render(); render();
  vi.advanceTimersByTime(30000); render(); render();
  expect(text(render())).toContain('You Won!'); expect(h.addGold).toHaveBeenCalledExactlyOnceWith(10);
  vi.advanceTimersByTime(30000); expect(h.addSigns).toHaveBeenCalledExactlyOnceWith(200);
});
it.each([false, true])('recovers before timeout with only the host offering WebRTC (host=%s)', async host => {
  await start(host); h.status = 'disconnected'; render(); render();
  vi.advanceTimersByTime(10000); h.status = 'subscribed'; render(); render();
  expect(text(render())).not.toContain('disconnected'); expect(h.connect).toHaveBeenCalledTimes(host ? 1 : 0);
  vi.advanceTimersByTime(21000); expect(h.addGold).not.toHaveBeenCalled();
});

it('replays a lost start only to the same opponent without creating another peer connection', async () => {
  await start(true);
  const first = h.send.mock.calls.find(c => c[0] === 'start');
  expect(first).toBeTruthy();
  message('join', { username: 'Guest' }, 'guest');
  message('join', { username: 'Stranger' }, 'stranger');
  expect(h.send.mock.calls.filter(c => c[0] === 'start')).toEqual([first, first]);
  expect(h.connect).not.toHaveBeenCalled();
  expect(get('rounds').props.current).toBe(1);
});
