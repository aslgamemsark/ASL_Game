import { supabase } from '@/lib/supabase';
import { isInappropriate } from '@/lib/profanity';

/**
 * Returns an error string, or null if the username is valid and available.
 * Pass excludeId (the current user's id) when checking for a username change
 * so the user's own current name doesn't report as "taken".
 */
export async function validateUsername(username: string, excludeId?: string): Promise<string | null> {
  if (username.length < 3)  return 'At least 3 characters required';
  if (username.length > 20) return 'Maximum 20 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Letters, numbers, and underscores only';
  if (isInappropriate(username)) return 'Username not allowed';
  let q = supabase.from('public_profiles').select('id').eq('username', username);
  if (excludeId) q = q.neq('id', excludeId);
  const { data } = await q.maybeSingle();
  if (data) return 'Username already taken';
  return null;
}
