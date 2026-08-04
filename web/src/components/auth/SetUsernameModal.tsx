import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import { validateUsername } from '@/lib/username';
import { ModalShell } from '@/components/shared/ModalShell';

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
    if (status !== 'ok' || saving) return;
    if (isRename && renameCards <= 0) {
      setSaveError('You need a Rename Card from the Shop (🪙 150) to change your username.');
      return;
    }
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
    <ModalShell
      onClose={isRename ? onClose : handleSkip}
      ariaLabel={isRename ? 'Change your username' : 'Choose your username'}
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

          {/* Rename card info — only shown when user has cards */}
          {isRename && renameCards > 0 && (
            <div className="rounded-xl px-3 py-2.5 mb-4 text-xs leading-relaxed border bg-z-purple/10 border-z-purple/30 text-z-purple-light">
              🎟️ You have <span className="font-bold">{renameCards}</span> Rename Card{renameCards !== 1 ? 's' : ''}.
              One will be consumed when you save.
            </div>
          )}

          {/* First-time soft disclaimer */}
          {!isRename && (
            <div className="rounded-xl px-3 py-2 mb-4 text-xs text-z-gray-400 bg-white/4 border border-z-gray-400/25 leading-relaxed">
              ⚠️ Choose carefully — future username changes require a <span className="text-z-gray-300 font-medium">Rename Card</span> from the Shop (🪙 150).
            </div>
          )}

          {/* Input */}
          <div className="mb-4">
            <label htmlFor="set-username" className="sr-only">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-z-gray-400 text-sm select-none">@</span>
              <input
                id="set-username"
                className={`w-full bg-white/5 border rounded-xl pl-8 pr-10 py-2.5 text-sm placeholder:text-z-gray-400 transition-colors ${
                  status === 'error' ? 'border-z-red/60 focus:border-z-red' :
                  status === 'ok'    ? 'border-z-green/60 focus:border-z-green' :
                  'border-z-gray-400/30 focus:border-z-purple'
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
                {status === 'ok'       && <span className="text-z-green">✓</span>}
                {status === 'error'    && <span className="text-z-red">✗</span>}
              </span>
            </div>
            {statusMsg && (
              <p className={`text-xs mt-1.5 px-1 ${status === 'ok' ? 'text-z-green' : 'text-z-red'}`}>
                {statusMsg}
              </p>
            )}
            <p className="text-3xs text-z-gray-400 mt-1.5 px-1">
              3–20 characters · letters, numbers, underscores only
            </p>
          </div>

          {saveError && <p className="text-z-red text-xs mb-3 px-1">{saveError}</p>}

          <motion.button
            onClick={handleSave}
            disabled={status !== 'ok' || saving}
            className="w-full py-2.5 rounded-xl bg-z-purple text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-opacity mb-2"
            whileTap={{ scale: 0.97 }}
          >
            {saving ? 'Saving…' : isRename ? 'Change username' : 'Save username'}
          </motion.button>

          {!isRename && (
            <button
              onClick={handleSkip}
              className="w-full py-3 text-xs text-z-gray-400 hover:text-z-gray-300 transition-colors"
            >
              Maybe later
            </button>
          )}
          {isRename && (
            <button
              onClick={onClose}
              className="w-full py-3 text-xs text-z-gray-400 hover:text-z-gray-300 transition-colors"
            >
              Cancel
            </button>
          )}
    </ModalShell>
  );
}
