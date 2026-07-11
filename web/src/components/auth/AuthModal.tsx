import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { validateUsername } from '@/lib/username';
import { supabaseReady } from '@/lib/supabase';

interface Props {
  onClose: () => void;
}

type Tab = 'signin' | 'signup' | 'reset';
type UsernameStatus = 'idle' | 'checking' | 'ok' | 'error';

export function AuthModal({ onClose }: Props) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, requestPasswordReset } = useAuth();
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [usernameMsg, setUsernameMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced username availability check
  useEffect(() => {
    if (tab !== 'signup') return;
    if (username.length < 3) {
      setUsernameStatus('idle');
      setUsernameMsg('');
      return;
    }
    setUsernameStatus('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const msg = await validateUsername(username);
      if (msg) {
        setUsernameStatus('error');
        setUsernameMsg(msg);
      } else {
        setUsernameStatus('ok');
        setUsernameMsg('Available!');
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username, tab]);

  if (!supabaseReady) {
    return (
      <Overlay onClose={onClose}>
        <div className="text-center p-6">
          <p className="text-2xl mb-3">🔧</p>
          <p className="font-bold text-base mb-2">Backend not connected</p>
          <p className="text-z-gray-300 text-sm leading-relaxed">
            Copy <code className="bg-white/10 px-1 rounded text-xs">.env.example</code> to{' '}
            <code className="bg-white/10 px-1 rounded text-xs">.env.local</code> and add your
            Supabase project URL + anon key, then restart the dev server.
          </p>
        </div>
      </Overlay>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === 'signup' && usernameStatus === 'error') return;
    setError(null);
    setLoading(true);

    if (tab === 'reset') {
      const err = await requestPasswordReset(email);
      setLoading(false);
      if (err) { setError(err); return; }
      setResetSent(true);
      return;
    }

    const err = tab === 'signin'
      ? await signInWithEmail(email, password)
      : await signUpWithEmail(email, password, username);

    setLoading(false);
    if (err) { setError(err); return; }

    if (tab === 'signup') { setDone(true); return; }
    onClose();
  }

  if (done) {
    return (
      <Overlay onClose={onClose}>
        <div className="text-center p-6">
          <p className="text-4xl mb-3">📬</p>
          <p className="font-bold text-lg mb-2">Check your email!</p>
          <p className="text-z-gray-300 text-sm">
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <button
            className="mt-5 w-full py-2.5 rounded-xl bg-z-purple text-white font-bold text-sm"
            onClick={() => { setDone(false); setTab('signin'); }}
          >
            Back to sign in
          </button>
        </div>
      </Overlay>
    );
  }

  if (resetSent) {
    return (
      <Overlay onClose={onClose}>
        <div className="text-center p-6">
          <p className="text-4xl mb-3">📬</p>
          <p className="font-bold text-lg mb-2">Check your email!</p>
          <p className="text-z-gray-300 text-sm">
            If <strong>{email}</strong> has an account, we've sent a link to reset the password.
          </p>
          <button
            className="mt-5 w-full py-2.5 rounded-xl bg-z-purple text-white font-bold text-sm"
            onClick={() => { setResetSent(false); setTab('signin'); }}
          >
            Back to sign in
          </button>
        </div>
      </Overlay>
    );
  }

  if (tab === 'reset') {
    return (
      <Overlay onClose={onClose}>
        <p className="font-bold text-base mb-1">Reset your password</p>
        <p className="text-z-gray-400 text-xs mb-4">We'll email you a link to set a new one.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-z-gray-400 focus:outline-none focus:border-z-purple transition-colors"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
          {error && <p className="text-z-red text-xs px-1">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-z-purple text-white font-bold text-sm disabled:opacity-50 transition-opacity"
          >
            {loading ? '…' : 'Send reset link'}
          </button>
          <button
            type="button"
            className="w-full py-3 text-xs text-z-gray-400 hover:text-white transition-colors"
            onClick={() => { setTab('signin'); setError(null); }}
          >
            Back to sign in
          </button>
        </form>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      {/* Tab switcher */}
      <div className="flex rounded-xl bg-white/5 p-1 mb-5">
        {(['signin', 'signup'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              tab === t ? 'bg-z-purple text-white' : 'text-z-gray-300'
            }`}
            onClick={() => { setTab(t); setError(null); setUsernameStatus('idle'); setUsernameMsg(''); }}
          >
            {t === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {tab === 'signup' && (
          <div>
            <div className="relative">
              <input
                className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm placeholder:text-z-gray-400 focus:outline-none transition-colors pr-10 ${
                  usernameStatus === 'error' ? 'border-z-red/60 focus:border-z-red' :
                  usernameStatus === 'ok'    ? 'border-z-green/60 focus:border-z-green' :
                  'border-white/10 focus:border-z-purple'
                }`}
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                minLength={3}
                maxLength={20}
                required
                autoComplete="username"
              />
              {/* Status indicator */}
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
                {usernameStatus === 'checking' && <span className="text-z-gray-400 text-xs">…</span>}
                {usernameStatus === 'ok'       && <span className="text-z-green">✓</span>}
                {usernameStatus === 'error'    && <span className="text-z-red">✗</span>}
              </span>
            </div>
            {usernameMsg && (
              <p className={`text-xs mt-1 px-1 ${usernameStatus === 'ok' ? 'text-z-green' : 'text-z-red'}`}>
                {usernameMsg}
              </p>
            )}
            <p className="text-[10px] text-z-gray-500 mt-1 px-1">
              3–20 characters · letters, numbers, underscores only · unique
            </p>
            <p className="text-[10px] text-z-gray-600 mt-1 px-1">
              ⚠️ Choose carefully — future changes require a Rename Card from the Shop (🪙 150)
            </p>
          </div>
        )}

        <input
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-z-gray-400 focus:outline-none focus:border-z-purple transition-colors"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-z-gray-400 focus:outline-none focus:border-z-purple transition-colors"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
        />

        {tab === 'signin' && (
          <button
            type="button"
            className="text-xs text-z-gray-400 hover:text-white transition-colors px-1"
            onClick={() => { setTab('reset'); setError(null); }}
          >
            Forgot password?
          </button>
        )}

        {error && (
          <p className="text-z-red text-xs px-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || (tab === 'signup' && usernameStatus === 'error')}
          className="w-full py-2.5 rounded-xl bg-z-purple text-white font-bold text-sm disabled:opacity-50 transition-opacity"
        >
          {loading ? '…' : tab === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-z-gray-400 text-xs">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <button
        onClick={signInWithGoogle}
        className="w-full py-2.5 rounded-xl border border-white/10 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          className="relative w-full max-w-sm bg-z-card border border-white/10 rounded-3xl p-6 shadow-2xl"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤟</span>
              <span className="font-bold text-base">Join Zippy</span>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 flex items-center justify-center text-z-gray-400 hover:text-white text-xl leading-none">×</button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
