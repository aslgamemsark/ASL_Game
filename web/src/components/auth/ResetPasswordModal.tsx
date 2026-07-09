import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

// Shown when AuthContext.passwordRecoveryMode is true — the user followed the emailed reset
// link and Supabase established a short-lived recovery session. No onClose prop: this can't be
// dismissed without either setting a new password or signing out, since a bare recovery session
// otherwise leaves the app in a half-authenticated state.
export function ResetPasswordModal() {
  const { completePasswordReset, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('At least 8 characters required'); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setError(null);
    setSaving(true);
    const err = await completePasswordReset(password);
    setSaving(false);
    if (err) { setError(err); return; }
    setDone(true);
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          className="relative w-full max-w-sm bg-z-card border border-white/10 rounded-3xl p-6 shadow-2xl"
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {done ? (
            <div className="text-center">
              <p className="text-3xl mb-2">✅</p>
              <h2 className="font-bold text-lg mb-2">Password updated</h2>
              <p className="text-z-gray-400 text-sm mb-5">You're all set — this device is signed in with your new password.</p>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 rounded-xl bg-z-purple text-white font-bold text-sm"
              >
                Continue
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <p className="text-3xl mb-2">🔑</p>
                <h2 className="font-bold text-lg">Set a new password</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-z-gray-400 focus:outline-none focus:border-z-purple transition-colors"
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                  autoFocus
                />
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-z-gray-400 focus:outline-none focus:border-z-purple transition-colors"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
                {error && <p className="text-red-400 text-xs px-1">{error}</p>}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl bg-z-purple text-white font-bold text-sm disabled:opacity-50 transition-opacity"
                >
                  {saving ? '…' : 'Update password'}
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full py-1 text-xs text-z-gray-400 hover:text-white transition-colors"
                >
                  Cancel and sign out
                </button>
              </form>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
