import { beforeEach, expect, it, vi } from 'vitest';
import { joinMultiplayerRoom } from '../src/lib/joinMultiplayerRoom';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: { rpc } }));
beforeEach(() => { rpc.mockReset(); });

it('treats a committed join denial as an error, not a successful join', async () => {
  rpc.mockResolvedValue({ data: { room: null, error: 'too many join attempts' }, error: null });
  expect(await joinMultiplayerRoom('ABCDEFGH')).toBe('Too many attempts — wait a minute and try again.');
  expect(rpc).toHaveBeenCalledWith('join_multiplayer_room_v2', { p_code: 'ABCDEFGH' });
});

it('requires a matching room even when the transport reports success', async () => {
  for (const data of [null, {}, { room: null, error: null }, { room: { code: 'OTHER' }, error: null }]) {
    rpc.mockResolvedValue({ data, error: null });
    expect(await joinMultiplayerRoom('ABCDEFGH')).not.toBeNull();
  }
  rpc.mockResolvedValue({ data: { room: { code: 'ABCDEFGH' }, error: null }, error: null });
  expect(await joinMultiplayerRoom('ABCDEFGH')).toBeNull();
});

it('reports database and network errors without entering a room', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
  expect(await joinMultiplayerRoom('ABCDEFGH')).not.toBeNull();
  rpc.mockRejectedValue(new Error('offline'));
  expect(await joinMultiplayerRoom('ABCDEFGH')).not.toBeNull();
});
