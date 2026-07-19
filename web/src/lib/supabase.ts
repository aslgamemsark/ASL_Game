import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — ' +
    'auth and sync will be disabled. Copy .env.example → .env.local to enable.'
  );
}

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  key ?? 'placeholder',
  { auth: { persistSession: true, autoRefreshToken: true } }
);

export const supabaseReady = Boolean(url && key);

// Push the signed-in user's JWT to the Realtime socket on every auth change. Private channels
// (Realtime Authorization) evaluate RLS on realtime.messages with this token; without it,
// auth.uid() is null and every private subscribe is denied — which manifested as multiplayer
// hanging on "Joining room…". onAuthStateChange emits INITIAL_SESSION on load too, so this also
// covers returning users whose session is restored from storage (the case supabase-js does not
// reliably sync to Realtime on its own). Passing null on sign-out drops back to the anon key.
if (supabaseReady) {
  supabase.auth.onAuthStateChange((_event, session) => {
    void supabase.realtime.setAuth(session?.access_token ?? null);
  });
}
