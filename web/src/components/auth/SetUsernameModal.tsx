import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import { validateUsername } from '@/lib/username';

interface Props {
  onClose: () => void;
  /** 'setup' = first-time pick (free). 'rename' = change existing (costs a Rename Card). */
  mode?: 'setup' | 'rename';
}

type Status = 'idle' | 'checking' | 'ok' | 'error';

export function SetUsernameModal({ onClose, mode = 'setup' }: Props) {
  const { user, updateUsername, dismissUsernameSetup } = useAuth();
  const { renameCards, consumeRenameCard } = useUserStore();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRename = mode === 'rename';
  const canRename = !isRename || renameCards > 0;

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
    if (status !== 'ok' || !canRename) return;
    setSaving(true);
    setSaveError(null);
    const err = await updateUsername(value);
    setSaving(false);
    if (err) { setSaveError(err); return; }
    if (isRename) consumeRenameCard();
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
            <p className="text-3xl mb-2">{isRename ? '🎟️' : '✏️'}</p>
            <h2 className="font-bold text-lg">{isRename ? 'Change your username' : 'Choose your username'}</h2>
            <p className="text-z-gray-400 text-sm mt-1">
              {isRename
                ? 'This will use one Rename Card from your inventory.'
                : 'This is how other players will find and challenge you.'}
            </p>
          </div>

          {/* Rename card warning banner */}
          {isRename && (
            <div className={`rounded-xl px-3 py-2.5 mb-4 text-xs leading-relaxed border ${
              canRename
                ? 'bg-z-purple/10 border-z-purple/30 text-z-purple-light'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {canRename ? (
                <>
                  🎟️ You have <span className="font-bold">{renameCards}</span> Rename Card{renameCards !== 1 ? 's' : ''}.
                  One will be consumed when you save.
                </>
              ) : (
                <>
                  You have no Rename Cards. Purchase one from the Shop for 🪙 150 to change your username.
                </>
              )}
            </div>
          )}

          {/* First-time soft disclaimer */}
          {!isRename && (
            <div className="rounded-xl px-3 py-2 mb-4 text-xs text-z-gray-400 bg-white/4 border border-white/8 leading-relaxed">
              ⚠️ Choose carefully — future username changes require a <span className="text-z-gray-300 font-medium">Rename Card</span> from the Shop (🪙 150).
            </div>
          )}

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
                disabled={!canRename}
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
            disabled={status !== 'ok' || saving || !canRename}
            className="w-full py-2.5 rounded-xl bg-z-purple text-white font-bold text-sm disabled:opacity-40 transition-opacity mb-2"
            whileTap={{ scale: 0.97 }}
          >
            {saving ? 'Saving…' : isRename ? 'Change username' : 'Save username'}
          </motion.button>

          {!isRename && (
            <button
              onClick={handleSkip}
              className="w-full py-2 text-xs text-z-gray-500 hover:text-z-gray-300 transition-colors"
            >
              Maybe later
            </button>
          )}
          {isRename && (
            <button
              onClick={onClose}
              className="w-full py-2 text-xs text-z-gray-500 hover:text-z-gray-300 transition-colors"
            >
              Cancel
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
