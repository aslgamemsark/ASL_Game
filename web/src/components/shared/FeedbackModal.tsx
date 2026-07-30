import { useState } from 'react';
import { useDialogA11y } from '@/hooks/useDialogA11y';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { buildFeedbackPayload, MAX_FEEDBACK_LEN, type FeedbackCategory } from '@/lib/feedback';
import { safeTruncate } from '@/lib/text';
import { track } from '@/analytics';

const CATEGORIES: { id: FeedbackCategory; label: string; icon: string; hint: string }[] = [
  { id: 'bug', label: 'Report a bug', icon: '🐞', hint: "Something broke or didn't work" },
  { id: 'feature', label: 'Suggest an idea', icon: '💡', hint: 'A feature or improvement' },
  { id: 'other', label: 'Something else', icon: '💬', hint: 'General feedback' },
];

interface Props {
  /** Which screen the tester opened this from — stored to help reproduce bugs. */
  page?: string;
  onClose: () => void;
}

/**
 * Beta "Report a Problem" / feedback flow: pick a category, write a message, optionally submit
 * anonymously, done. Distinct from ReportUserModal (which reports other users). Browser + page
 * context is auto-captured so a tester doesn't have to describe their setup. Insert follows the
 * same supabase.from(...).insert(...) pattern as ReportUserModal; reads are admin-only via RLS.
 */
export function FeedbackModal({ page, onClose }: Props) {
  const dialog = useDialogA11y({ label: 'Send feedback', onClose });
  const { user } = useAuth();
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    if (!category || status === 'submitting') return;
    const payload = buildFeedbackPayload({
      category,
      message,
      anonymous,
      userId: user?.id ?? null,
      page: page ?? (typeof window !== 'undefined' ? window.location.pathname : null),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      appVersion: import.meta.env.VITE_APP_VERSION ?? null,
    });
    if (!payload) return; // empty message
    setStatus('submitting');
    const { error } = await supabase
      .from('feedback')
      .insert(payload as unknown as Record<string, unknown>);
    if (error) {
      setErrorMsg('Could not send — check your connection and try again.');
      setStatus('error');
      return;
    }
    const feedbackPage = payload.page ?? 'unknown';
    track('feedback_submitted', { category, page: feedbackPage, anonymous });
    if (category === 'bug') track('bug_reported', { page: feedbackPage });
    if (category === 'feature') track('feature_requested', { page: feedbackPage });
    setStatus('done');
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-nested-modal bg-black/60 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-sm bg-z-card border border-white/10 rounded-2xl p-5 outline-none"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          onClick={(e) => e.stopPropagation()}
          ref={dialog.ref}
          {...dialog.props}
        >
          {status === 'done' ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-2">🙌</p>
              <p className="font-bold text-sm">Thanks for the feedback!</p>
              <p className="text-z-gray-400 text-xs mt-1">
                It really helps us improve QuickSign during the beta.
              </p>
              <button
                onClick={onClose}
                className="mt-4 w-full py-2.5 rounded-xl font-bold text-sm bg-z-purple/20 text-z-purple-light"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <p className="font-bold text-base">Send feedback</p>
              <p className="text-z-gray-400 text-xs mt-1 mb-4">
                You're helping test QuickSign — tell us what's working, what's broken, or what you'd
                love to see.
              </p>

              <div className="flex flex-col gap-2 mb-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border transition-colors ${
                      category === c.id
                        ? 'border-z-purple bg-z-purple/20 text-z-gray-50'
                        : 'border-z-gray-400/30 text-z-gray-300 hover:border-z-gray-400/50'
                    }`}
                  >
                    <span className="text-lg" aria-hidden="true">{c.icon}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{c.label}</span>
                      <span className="block text-xs text-z-gray-400">{c.hint}</span>
                    </span>
                  </button>
                ))}
              </div>

              <label htmlFor="feedback-message" className="sr-only">Your feedback</label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(safeTruncate(e.target.value, MAX_FEEDBACK_LEN))}
                placeholder={
                  category === 'bug'
                    ? 'What happened? What did you expect instead?'
                    : 'Tell us more…'
                }
                rows={4}
                className="w-full bg-z-surface border border-z-gray-400/30 rounded-xl px-3 py-2 text-sm text-z-gray-50 placeholder:text-z-gray-400 resize-none"
              />

              {user && (
                <label className="flex items-center gap-2 mt-3 text-xs text-z-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                    className="accent-z-purple"
                  />
                  Send anonymously (don't attach my account)
                </label>
              )}

              {status === 'error' && <p className="text-z-red text-xs mt-2">{errorMsg}</p>}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-z-gray-400/30 text-z-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={!category || !message.trim() || status === 'submitting'}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gradient-primary text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {status === 'submitting' ? 'Sending…' : 'Send feedback'}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
