import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDialogA11y } from '@/hooks/useDialogA11y';

interface Props {
  children: ReactNode;
  /** Accessible name for the dialog (there's no single consistent visible heading id to point at
   *  across the four modals this wraps, so aria-label is simpler than aria-labelledby here). */
  ariaLabel: string;
  /** Omit for a modal that must be resolved via its own in-content actions (e.g. ResetPasswordModal
   *  mid password-recovery) — Escape and backdrop-click are then both disabled, matching the
   *  existing "can't be dismissed" behavior those modals already relied on. */
  onClose?: () => void;
}

/**
 * Shared modal chrome: backdrop + centred-card positioning, previously hand-rolled identically
 * across AuthModal/SetUsernameModal/TrainingConsentModal/ResetPasswordModal (production audit,
 * 2026-07-12).
 *
 * Owns only the chrome. The accessibility behaviour now lives in `useDialogA11y`, because seven
 * other dialogs in the app need exactly that behaviour but a different layout — bottom sheets and
 * a full-screen first-run gate can't be forced through this wrapper, and while the behaviour was
 * welded to it they simply went without (found 2026-07-28).
 */
export function ModalShell({ children, ariaLabel, onClose }: Props) {
  const dialog = useDialogA11y<HTMLDivElement>({ label: ariaLabel, onClose });

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-overlay flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          ref={dialog.ref}
          {...dialog.props}
          // `--kb` (set by useDialogA11y from window.visualViewport while this dialog is active)
          // shifts the card up by the keyboard's occluded height — on iOS the layout viewport this
          // `fixed inset-0` sheet is positioned against does NOT shrink for the keyboard, so without
          // this every text input in the app (all of them live inside a ModalShell) opens behind it.
          // max-h + overflow-y-auto: no modal in the app had either, so any content taller than the
          // viewport (long forms, CameraOnboarding's bullet list) was simply unreachable/unscrollable.
          // pb-[calc(...+var(--sab))], not plain `pb-safe`: this card sits flush to the bottom edge
          // below `sm` (`items-end`), so its own confirm/submit buttons can land under the home
          // indicator without it — added to the base 1.5rem rather than replacing it (found while
          // building Sheet.tsx, which shares this exact shape; see that file's longer comment).
          style={{ marginBottom: 'var(--kb, 0px)' }}
          className="relative w-full max-w-sm max-h-[85dvh] overflow-y-auto bg-z-card border border-white/10 rounded-3xl p-6 pb-[calc(1.5rem+var(--sab))] shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-z-purple-light"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
