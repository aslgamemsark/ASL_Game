import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { safeTruncate } from '@/lib/text';

export type ReportContext = 'leaderboard' | 'friends' | 'multiplayer' | 'profile';

/** Matches the note-length assumption baked into the textarea below and the DB column. */
const MAX_NOTE_LEN = 280;
type ReportReason = 'offensive' | 'impersonation' | 'spam' | 'other';

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'offensive', label: 'Offensive or inappropriate name' },
  { id: 'impersonation', label: 'Impersonating someone' },
  { id: 'spam', label: 'Spam or fake account' },
  { id: 'other', label: 'Something else' },
];

interface Props {
  reporterId: string;
  reportedId: string;
  reportedUsername: string;
  context: ReportContext;
  onClose: () => void;
}

/**
 * Self-contained report flow: reason picker -> optional note -> submit -> inline confirmation.
 * Insert follows the same supabase.from(...).insert(...) pattern as FriendsPage's friend-request
 * insert. There's no admin UI yet — reports are reviewed directly in the Supabase Table Editor
 * (see supabase/schema.sql's user_reports comment).
 */
export function ReportUserModal({ reporterId, reportedId, reportedUsername, context, onClose }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    if (!reason || status === 'submitting') return;
    setStatus('submitting');
    const { error } = await supabase.from('user_reports').insert({
      reporter_id: reporterId,
      reported_id: reportedId,
      reason,
      note: note.trim() || null,
      context,
    } as Record<string, unknown>);

    if (error) {
      // 23505 = unique_violation: this pair already has an open report.
      setErrorMsg(
        error.code === '23505' ? "You've already reported this user." : 'Could not submit — try again later.'
      );
      setStatus('error');
      return;
    }
    setStatus('done');
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-sm bg-z-card border border-white/10 rounded-2xl p-5"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          onClick={(e) => e.stopPropagation()}
        >
          {status === 'done' ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-2">✅</p>
              <p className="font-bold text-sm">Report submitted</p>
              <p className="text-z-gray-400 text-xs mt-1">Thanks — we'll take a look.</p>
              <button
                onClick={onClose}
                className="mt-4 w-full py-2.5 rounded-xl font-bold text-sm bg-z-purple/20 text-z-purple-light"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <p className="font-bold text-base">Report @{reportedUsername}</p>
              <p className="text-z-gray-400 text-xs mt-1 mb-4">
                Tell us what's wrong with this username. We review reports manually.
              </p>

              <div className="flex flex-col gap-2 mb-3">
                {REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setReason(r.id)}
                    className={`text-left text-sm px-3 py-2.5 rounded-xl border transition-colors ${
                      reason === r.id
                        ? 'border-z-purple bg-z-purple/20 text-z-gray-50'
                        : 'border-z-gray-400/30 text-z-gray-300 hover:border-z-gray-400/50'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(safeTruncate(e.target.value, MAX_NOTE_LEN))}
                placeholder="Optional details…"
                rows={2}
                className="w-full bg-z-surface border border-z-gray-400/30 rounded-xl px-3 py-2 text-sm text-z-gray-50 placeholder:text-z-gray-500 resize-none"
              />

              {status === 'error' && (
                <p className="text-z-red text-xs mt-2">{errorMsg}</p>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-z-gray-400/30 text-z-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={!reason || status === 'submitting'}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-z-red/80 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {status === 'submitting' ? 'Submitting…' : 'Submit report'}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
