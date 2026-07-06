import { supabase } from '@/lib/supabase';
import { isInappropriate } from '@/lib/profanity';

/** Returns an error string, or null if the username is valid and available. */
export async function validateUsername(username: string): Promise<string | null> {
  if (username.length < 3)  return 'At least 3 characters required';
  if (username.length > 20) return 'Maximum 20 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Letters, numbers, and underscores only';
  if (isInappropriate(username)) return 'Username not allowed';
  const { data } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
  if (data) return 'Username already taken';
  return null;
}
