import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { pickZippyLine } from '@/data/zippy';
import { Zippy } from '@/components/shared/Zippy';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Controlled confirm dialog for signing out — Zippy waves goodbye and the user has to confirm,
// which doubles as an accidental-logout guard. Owns the signOut call so both entry points (the
// Settings button and the side-nav item) just toggle `open`.
export function LogoutConfirm({ open, onClose }: Props) {
  const { signOut } = useAuth();
  // Pick a line once per open (pickZippyLine advances a rotation counter, so calling it raw in
  // render would re-roll on every animation frame).
  const line = useMemo(() => pickZippyLine('goodbye'), [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-sm bg-z-card border border-white/10 rounded-3xl p-6 shadow-2xl text-center"
            initial={{ y: 40, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          >
            <Zippy expression="goodbye" size="lg" priority className="mx-auto mb-3" />
            <h2 className="font-bold text-lg mb-1">Leaving so soon?</h2>
            <p className="text-z-gray-300 text-sm mb-5">{line}</p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-z-gray-200 font-bold text-sm hover:border-white/20 transition-colors"
              >
                Stay
              </button>
              <button
                onClick={() => { onClose(); void signOut(); }}
                className="flex-1 py-2.5 rounded-xl bg-z-red/15 text-z-red font-bold text-sm"
              >
                Log out
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
