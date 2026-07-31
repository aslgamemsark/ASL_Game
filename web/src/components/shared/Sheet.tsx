import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDialogA11y } from '@/hooks/useDialogA11y';

interface Props {
  children: ReactNode;
  ariaLabel: string;
  onClose?: () => void;
  className?: string;
  /** Defaults to `true` — the common case is the parent conditionally rendering `<Sheet>` itself
   *  (`{show && <Sheet>...}`), which unmounts it immediately with no exit transition regardless of
   *  what `Sheet` does internally. Pass `false` explicitly (and keep `<Sheet>` itself permanently
   *  mounted) for a dialog that must play its close animation — `useDialogA11y`'s focus trap also
   *  arms/disarms off this, not just the visual: see its own `active` option. */
  open?: boolean;
}

/**
 * Shared chrome for a small confirm/action dialog — a bottom sheet on phones, a centered card
 * above the `sm` breakpoint. Sibling to `ModalShell` rather than a shared base: `ModalShell` is
 * deliberately scoped to the 4 larger auth modals it already serves, and forcing every dialog
 * shape through one component is how the app ended up with dialogs whose accessibility behaviour
 * depended on which wrapper happened to get used (see `useDialogA11y`'s own history).
 *
 * Was hand-rolled 3 times (`FeedbackModal`, `ReportUserModal`, `LogoutConfirm`) with the exact
 * chrome each time and neither correctness fix `ModalShell` already had: no `--kb` margin, so
 * `FeedbackModal`'s `<textarea>` and `ReportUserModal`'s form opened *behind* the iOS keyboard;
 * and no `--sab` padding, so `LogoutConfirm`'s confirm button sat under the home indicator on any
 * phone with one. Both custom properties are already published by `useDialogA11y` while a dialog
 * is active — nothing here needed the plumbing, only the two lines reading it.
 */
export function Sheet({ children, ariaLabel, onClose, className = '', open = true }: Props) {
  const dialog = useDialogA11y<HTMLDivElement>({ label: ariaLabel, onClose, active: open });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-nested-modal flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            ref={dialog.ref}
            {...dialog.props}
            // See ModalShell.tsx for why --kb and max-h/overflow-y-auto are both load-bearing, not
            // decorative. The bottom padding is the same idea for the OTHER edge: a sheet anchored
            // to the bottom of the viewport (`items-end` below `sm`) needs var(--sab) ADDED to its
            // own padding to clear the home indicator — plain `pb-safe` (equal specificity to
            // `p-6`) would fight it and can *replace* the 1.5rem base padding with 0 on the common
            // case of no inset, rather than add to it; BottomNav/TopBar only ever use pb-safe/
            // pt-safe on a container with no competing padding on that edge, which a p-6 card
            // doesn't have.
            style={{ marginBottom: 'var(--kb, 0px)' }}
            className={`relative w-full max-w-sm max-h-[85dvh] overflow-y-auto bg-z-card border border-white/10 rounded-3xl p-6 pb-[calc(1.5rem+var(--sab))] shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-z-purple-light ${className}`}
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
