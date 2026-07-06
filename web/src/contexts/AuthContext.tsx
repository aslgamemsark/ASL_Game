import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseReady } from '@/lib/supabase';
import { validateUsername } from '@/lib/username';

type ProfileRow = { id: string; username: string };

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  username: string | null;
  loading: boolean;
  /** True for Google users who haven't set a custom username yet. */
  needsUsernameSetup: boolean;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Change/set the username for any logged-in user. Pass the user's id to skip self-conflict. */
  updateUsername: (newUsername: string) => Promise<string | null>;
  /** Call after the user completes or skips username setup so the modal doesn't reappear. */
  dismissUsernameSetup: (permanent?: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function usernameSetupKey(userId: string) { return `asl_username_set_${userId}`; }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) fetchUsername(data.session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) fetchUsername(s.user.id, s.user);
      else { setUsername(null); setNeedsUsernameSetup(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUsername(userId: string, userObj?: User) {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    const fetched = (data as ProfileRow | null)?.username ?? null;
    setUsername(fetched);

    // Auto-assign a username if none exists (e.g. OAuth user with no profile row yet).
    if (!fetched) {
      const u = userObj ?? session?.user;
      if (u) {
        const emailPrefix = (u.email ?? 'user').split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'user';
        const suffix = Math.floor(1000 + Math.random() * 9000);
        const generated = `${emailPrefix}${suffix}`;
        await supabase.from('profiles').upsert({ id: userId, username: generated } as Record<string, unknown>);
        setUsername(generated);
      }
    }
  }

  async function signInWithEmail(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signUpWithEmail(email: string, password: string, username: string): Promise<string | null> {
    const usernameError = await validateUsername(username);
    if (usernameError) return usernameError;

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;

    // The trigger auto-creates the profile with a derived username.
    // Update it to the user's chosen username.
    if (data.user) {
      await supabase
        .from('profiles')
        .update({ username } as Record<string, string>)
        .eq('id', data.user.id);
    }
    return null;
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  async function updateUsername(newUsername: string): Promise<string | null> {
    if (!session?.user) return 'Not signed in';
    const err = await validateUsername(newUsername, session.user.id);
    if (err) return err;
    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername } as Record<string, string>)
      .eq('id', session.user.id);
    if (error) return error.message;
    setUsername(newUsername);
    setNeedsUsernameSetup(false);
    localStorage.setItem(usernameSetupKey(session.user.id), 'true');
    return null;
  }

  function dismissUsernameSetup() {
    setNeedsUsernameSetup(false);
    if (session?.user) {
      localStorage.setItem(usernameSetupKey(session.user.id), 'true');
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      session,
      username,
      loading,
      needsUsernameSetup,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      updateUsername,
      dismissUsernameSetup,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
