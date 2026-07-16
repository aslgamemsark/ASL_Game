import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseReady } from '@/lib/supabase';
import { validateUsername } from '@/lib/username';
import { isInappropriate } from '@/lib/profanity';
import { isAlreadyRegisteredError } from '@/lib/authErrors';
import { useUserStore } from '@/stores/useUserStore';

type ProfileRow = { username: string; is_admin: boolean; is_banned: boolean; ban_reason: string | null };

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  username: string | null;
  loading: boolean;
  /** True for Google users who haven't set a custom username yet. */
  needsUsernameSetup: boolean;
  /** True for the two owner accounts (profiles.is_admin) — gates the admin panel. */
  isAdmin: boolean;
  /** Non-null while the account is banned — the forced sign-out already happened; App renders a
   *  suspended screen using this message instead of the app. */
  bannedReason: string | null;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Change/set the username for any logged-in user. Pass the user's id to skip self-conflict. */
  updateUsername: (newUsername: string) => Promise<string | null>;
  /** Call after the user completes or skips username setup so the modal doesn't reappear. */
  dismissUsernameSetup: (permanent?: boolean) => void;
  /** True once, the first time this account signs in on this device — prompts an explicit choice
   *  for the AI training-data toggle instead of silently relying on its default. */
  needsTrainingConsent: boolean;
  /** Call with the user's choice; also persists so the prompt never reappears on this device. */
  dismissTrainingConsent: (keepOn: boolean) => void;
  /** Sends a password-reset email. Returns an error string, or null on success. Always returns
   *  the same generic success regardless of whether the email exists (Supabase's own behavior)
   *  so this can't be used to enumerate registered accounts. */
  requestPasswordReset: (email: string) => Promise<string | null>;
  /** True after the user follows the emailed reset link and lands back with a recovery session
   *  (Supabase fires a PASSWORD_RECOVERY auth event) — App shows a "set new password" modal. */
  passwordRecoveryMode: boolean;
  /** Sets the new password for the account currently in recovery mode, then clears the flag. */
  completePasswordReset: (newPassword: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function usernameSetupKey(userId: string) { return `asl_username_set_${userId}`; }
function trainingConsentKey(userId: string) { return `asl_training_consent_${userId}`; }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);
  const [needsTrainingConsent, setNeedsTrainingConsent] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bannedReason, setBannedReason] = useState<string | null>(null);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) fetchUsername(data.session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Fired once the user follows the emailed reset link and Supabase establishes a
      // short-lived recovery session — App renders a "set new password" modal while this is
      // true instead of dropping them straight into the app under a session they didn't
      // actively choose to start.
      if (event === 'PASSWORD_RECOVERY') setPasswordRecoveryMode(true);
      if (s) fetchUsername(s.user.id, s.user);
      else {
        setUsername(null);
        setNeedsUsernameSetup(false);
        setIsAdmin(false);
        // A real sign-out (explicit "Log out", banned-user force sign-out, or a session that
        // expired elsewhere) must wipe the locally-persisted progress store — otherwise the next
        // "guest" view keeps showing the just-logged-out account's gold, signs, avatar, and
        // border until they sign into a different account. Guarded to the SIGNED_OUT event only
        // (not INITIAL_SESSION) so a guest who was never signed in never gets reset on page load.
        if (event === 'SIGNED_OUT') {
          useUserStore.getState().reset();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUsername(userId: string, userObj?: User) {
    const { data } = await supabase
      .from('profiles')
      .select('username, is_admin, is_banned, ban_reason')
      .eq('id', userId)
      .single();
    const row = data as ProfileRow | null;

    // Enforcement happens server-side too (RLS denies a banned user's own reads/writes — see
    // migration 20260707120000_admin_panel.sql); this is the client-facing half: force sign-out
    // and show a suspended screen instead of silently failing every subsequent request.
    if (row?.is_banned) {
      setBannedReason(row.ban_reason ?? 'Your account has been suspended.');
      setUsername(null);
      setIsAdmin(false);
      await supabase.auth.signOut();
      return;
    }

    setBannedReason(null);
    const fetched = row?.username ?? null;
    setUsername(fetched);
    setIsAdmin(row?.is_admin ?? false);

    // First sign-in on this device: ask explicitly whether to help improve the AI, instead of
    // silently relying on collectTrainingData's default. One-time per account per device.
    if (localStorage.getItem(trainingConsentKey(userId)) !== 'true') {
      setNeedsTrainingConsent(true);
    }

    // Auto-assign a username if none exists (e.g. OAuth user with no profile row yet).
    if (!fetched) {
      const u = userObj ?? session?.user;
      if (u) {
        // Capped at 16 chars before appending the 4-digit suffix so the result always fits the
        // profiles.username CHECK constraint (3-20 chars) regardless of email length — an
        // uncapped prefix from a long email local-part could otherwise produce a >20-char
        // username the database would now reject.
        let emailPrefix = ((u.email ?? 'user').split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'user').slice(0, 16);
        // Don't let an email local-part seed a slur into the leaderboard: the interactive
        // signup/rename paths run validateUsername, but this auto-derived path never did. Fall
        // back to a neutral prefix if the derived name trips the profanity filter.
        if (isInappropriate(emailPrefix)) emailPrefix = 'player';
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
    if (error) {
      // Supabase's own signUp() response is an enumeration oracle: an already-registered,
      // confirmed email returns a distinct "already registered" error, while a fresh email
      // succeeds — an attacker can probe arbitrary addresses to learn which ones have accounts.
      // requestPasswordReset() below already avoids this by always reporting the same generic
      // success; match that here so signup can't be used as a side-channel for the same info.
      // The genuine trade-off: someone who already has an account and mistakenly tries to sign
      // up again sees a false "check your email" instead of a helpful "you already have an
      // account" — deliberate, since the alternative leaks account existence to anyone.
      if (isAlreadyRegisteredError(error.message)) return null;
      return error.message;
    }

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
      options: {
        redirectTo: window.location.origin,
        // Without this, Google silently reuses whatever account is already active in the
        // browser and never shows the account chooser — a real problem on a shared/family
        // device where switching accounts (e.g. going from a parent's to a kid's) needs to
        // actually be possible. select_account forces the picker every time.
        queryParams: { prompt: 'select_account' },
      },
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

  function dismissTrainingConsent(keepOn: boolean) {
    useUserStore.getState().setCollectTrainingData(keepOn);
    setNeedsTrainingConsent(false);
    if (session?.user) {
      localStorage.setItem(trainingConsentKey(session.user.id), 'true');
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    // Always wipe local progress on an explicit "Log out", even for a guest with no active
    // session — Supabase fires no SIGNED_OUT event in that case, so the onAuthStateChange handler
    // above never runs. Idempotent with that handler for a real session. This also flips
    // onboardingComplete back to false (defaultProgress), which App watches to route the now
    // signed-out user to the sign-in screen.
    useUserStore.getState().reset();
  }

  async function requestPasswordReset(email: string): Promise<string | null> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    // Supabase already returns success here even for an email that isn't registered (so this
    // can't be used to enumerate accounts) — surface a real error only for things like malformed
    // input or rate-limiting, never "no such user".
    return error?.message ?? null;
  }

  async function completePasswordReset(newPassword: string): Promise<string | null> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return error.message;
    setPasswordRecoveryMode(false);
    return null;
  }

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      session,
      username,
      loading,
      needsUsernameSetup,
      isAdmin,
      bannedReason,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      updateUsername,
      dismissUsernameSetup,
      needsTrainingConsent,
      dismissTrainingConsent,
      requestPasswordReset,
      passwordRecoveryMode,
      completePasswordReset,
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
