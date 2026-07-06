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
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) fetchUsername(data.session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) fetchUsername(s.user.id);
      else setUsername(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUsername(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    setUsername((data as ProfileRow | null)?.username ?? null);
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

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      session,
      username,
      loading,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
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
