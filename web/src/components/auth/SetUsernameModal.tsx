import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { validateUsername } from '@/lib/username';

interface Props {
  onClose: () => void;
}

type Status = 'idle' | 'checking' | 'ok' | 'error';

export function SetUsernameModal({ onClose }: Props) {
  const { user, updateUsername, dismissUsernameSetup } = useAuth();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value.length < 3) { setStatus('idle'); setStatusMsg(''); return; }
    setStatus('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const msg = await validateUsername(value, user?.id);
      if (msg) { setStatus('error'); setStatusMsg(msg); }
      else      { setStatus('ok');    setStatusMsg('Available!'); }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, user?.id]);

  const handleSave = async () => {
    if (status !== 'ok') return;
    setSaving(true);
    setSaveError(null);
    const err = await updateUsername(value);
    setSaving(false);
    if (err) { setSaveError(err); return; }
    onClose();
  };

  const handleSkip = () => {
    dismissUsernameSetup();
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <motion.div
          className="relative w-full max-w-sm bg-z-card border border-white/10 rounded-3xl p-6 shadow-2xl"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className="text-center mb-5">
            <p className="text-3xl mb-2">✏️</p>
            <h2 className="font-bold text-lg">Choose your username</h2>
            <p className="text-z-gray-400 text-sm mt-1">
              This is how other players will find and challenge you.
            </p>
          </div>

          {/* Input */}
          <div className="mb-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-z-gray-400 text-sm select-none">@</span>
              <input
                className={`w-full bg-white/5 border rounded-xl pl-8 pr-10 py-2.5 text-sm placeholder:text-z-gray-500 focus:outline-none transition-colors ${
                  status === 'error' ? 'border-red-500/60 focus:border-red-500' :
                  status === 'ok'    ? 'border-green-500/60 focus:border-green-500' :
                  'border-white/10 focus:border-z-purple'
                }`}
                placeholder="your_username"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                maxLength={20}
                autoFocus
                autoComplete="username"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
                {status === 'checking' && <span className="text-z-gray-400 text-xs">…</span>}
                {status === 'ok'       && <span className="text-green-400">✓</span>}
                {status === 'error'    && <span className="text-red-400">✗</span>}
              </span>
            </div>
            {statusMsg && (
              <p className={`text-xs mt-1.5 px-1 ${status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                {statusMsg}
              </p>
            )}
            <p className="text-[10px] text-z-gray-500 mt-1.5 px-1">
              3–20 characters · letters, numbers, underscores only
            </p>
          </div>

          {saveError && <p className="text-red-400 text-xs mb-3 px-1">{saveError}</p>}

          <motion.button
            onClick={handleSave}
            disabled={status !== 'ok' || saving}
            className="w-full py-2.5 rounded-xl bg-z-purple text-white font-bold text-sm disabled:opacity-40 transition-opacity mb-2"
            whileTap={{ scale: 0.97 }}
          >
            {saving ? 'Saving…' : 'Save username'}
          </motion.button>

          <button
            onClick={handleSkip}
            className="w-full py-2 text-xs text-z-gray-500 hover:text-z-gray-300 transition-colors"
          >
            Maybe later
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
