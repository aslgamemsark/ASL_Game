import type { User } from '@supabase/supabase-js';
import { identifyUser, resetIdentity } from './capture';
import { setFirstSuccessIdentity } from './firstSuccess';

let currentUser: string | null | undefined;

/** Called from authoritative auth callbacks, before login/product events are queued. */
export function syncAnalyticsIdentity(user: User | null): void {
  const userId = user?.id ?? null;
  if (currentUser === userId) return;
  const previous = currentUser;
  currentUser = userId;
  setFirstSuccessIdentity(userId);
  if (user || previous) {
    try { localStorage.removeItem('quicksign_guest_last_seen'); } catch { /* optional telemetry */ }
  }
  if (!user) { resetIdentity(true); return; }
  identifyUser(user.id, {
    username: null,
    provider: user.app_metadata?.provider === 'google' ? 'google' : 'email',
    account_age_days: Math.max(0, Math.floor((Date.now() - Date.parse(user.created_at)) / 86_400_000)),
    plan: 'beta', language: typeof navigator === 'undefined' ? null : navigator.language.split('-')[0] ?? null,
    country: null,
  });
}
