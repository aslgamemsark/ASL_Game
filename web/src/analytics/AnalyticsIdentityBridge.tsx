import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { detectCountryCode } from '@/lib/geolocation';
import { aliasAnon, identifyUser, resetIdentity } from './capture';

/**
 * No-UI bridge that keeps PostHog identity in sync with Supabase auth state. Mount once, inside
 * AuthProvider (main.tsx). Anonymous browsing generates events under an anonymous distinct id;
 * the FIRST time a session resolves to a real user in a given browser tab, this aliases that
 * anonymous id to the account id (preserving pre-signup event history) and identifies. On
 * SIGNED_OUT, resets to a fresh anonymous id so the next guest on this device isn't attributed to
 * the account that just left.
 */
export function AnalyticsIdentityBridge() {
  const { user } = useAuth();
  const identifiedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      if (identifiedForRef.current) {
        resetIdentity();
        identifiedForRef.current = null;
      }
      return;
    }
    if (identifiedForRef.current === user.id) return;
    identifiedForRef.current = user.id;

    const provider = (user.app_metadata?.provider === 'google' ? 'google' : 'email') as 'email' | 'google';
    const createdAt = user.created_at ? new Date(user.created_at).getTime() : Date.now();
    const accountAgeDays = Math.max(0, Math.round((Date.now() - createdAt) / 86_400_000));
    const language = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : null;

    aliasAnon(user.id);
    identifyUser(user.id, {
      username: null, // set separately once AuthContext resolves it — avoids a stale/incorrect value here
      provider,
      account_age_days: accountAgeDays,
      plan: 'beta',
      language,
      country: null,
    });

    // Best-effort country enrichment — never blocks identify, matches the existing
    // best-effort region detection pattern in hooks/useProgressSync.ts.
    void detectCountryCode().then((country) => {
      if (country) identifyUser(user.id, { username: null, provider, account_age_days: accountAgeDays, plan: 'beta', language, country });
    });
  }, [user]);

  return null;
}
