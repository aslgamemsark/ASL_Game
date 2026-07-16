import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseReady } from '@/lib/supabase';
import { Zippy } from '@/components/shared/Zippy';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Category = 'bug' | 'idea' | 'general';
type Status = 'idle' | 'sending' | 'sent' | 'error';

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'bug', label: 'Bug', icon: '🐛' },
  { id: 'idea', label: 'Idea', icon: '💡' },
  { id: 'general', label: 'Other', icon: '💬' },
];

// In-app feedback form — writes straight to the Supabase `feedback` table (see the matching
// migration). Replaces the old mailto: link, which handed off to an unreliable external mail
// client / Google account chooser. Works for guests too (anonymous submission, user_id null).
export function FeedbackModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>('bug');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setCategory('bug'); setMessage(''); setStatus('idle'); setError(null); };
  const close = () => { onClose(); setTimeout(reset, 200); };

  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (!supabaseReady) { setError("Feedback isn't available right now — please try again later."); setStatus('error'); return; }
    setStatus('sending');
    setError(null);
    const { error: insertError } = await supabase.from('feedback').insert({
      user_id: user?.id ?? null,
      category,
      message: trimmed,
      user_agent: navigator.userAgent,
    } as Record<string, unknown>);
    if (insertError) {
      setError('Could not send your feedback — please try again.');
      setStatus('error');
      return;
    }
    setStatus('sent');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
          <motion.div
            className="relative w-full max-w-sm bg-z-card border border-white/10 rounded-3xl p-6 shadow-2xl"
            initial={{ y: 40, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          >
            {status === 'sent' ? (
              <div className="text-center">
                <Zippy expression="celebrating" size="lg" priority className="mx-auto mb-3" />
                <h2 className="font-bold text-lg mb-1">Thank you!</h2>
                <p className="text-z-gray-300 text-sm mb-5">Your feedback went straight to the team. We read every note.</p>
                <button
                  onClick={close}
                  className="w-full py-2.5 rounded-xl bg-gradient-primary text-white font-bold text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Zippy expression="thinking" size="sm" />
                  <div>
                    <h2 className="font-bold text-lg leading-tight">Send feedback</h2>
                    <p className="text-z-gray-400 text-xs">Found a bug or have an idea? Tell us.</p>
                  </div>
                </div>

                <div className="flex gap-2 mb-3">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                        category === c.id
                          ? 'border-z-purple-light text-z-purple-light bg-z-purple/10'
                          : 'border-white/10 text-z-gray-300 hover:border-white/20'
                      }`}
                    >
                      <span className="mr-1">{c.icon}</span>{c.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={4000}
                  rows={5}
                  placeholder={category === 'bug' ? 'What happened? What did you expect?' : 'Share your thoughts…'}
                  className="w-full bg-z-surface border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-z-purple/60 placeholder:text-z-gray-500 resize-none"
                />

                {error && <p className="text-z-red text-xs mt-2">{error}</p>}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={close}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-z-gray-200 font-bold text-sm hover:border-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={!message.trim() || status === 'sending'}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-primary text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'sending' ? 'Sending…' : 'Send'}
                  </button>
                </div>

                <p className="text-[11px] text-z-gray-500 mt-3 text-center">
                  Prefer email? <a href="mailto:msaad9632@gmail.com" className="underline">msaad9632@gmail.com</a>
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
