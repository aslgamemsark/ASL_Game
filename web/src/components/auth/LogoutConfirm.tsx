import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { pickZippyLine } from '@/data/zippy';
import { Zippy } from '@/components/shared/Zippy';
import { Sheet } from '@/components/shared/Sheet';

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
    <Sheet ariaLabel="Confirm log out" onClose={onClose} open={open} className="text-center">
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
    </Sheet>
  );
}
