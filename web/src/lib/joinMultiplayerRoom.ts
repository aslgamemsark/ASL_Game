import { supabase } from './supabase';
import { joinErrorMessage } from './multiplayerRooms';

/** Expected denials are returned as data so the server can commit its attempt counter. */
export async function joinMultiplayerRoom(code: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('join_multiplayer_room_v2', { p_code: code });
    if (error) return joinErrorMessage(error.message);
    if (typeof data?.error === 'string') return joinErrorMessage(data.error);
    if (data?.room?.code !== code) return joinErrorMessage('invalid response');
    return null;
  } catch {
    return joinErrorMessage('network error');
  }
}
