import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
 * Shared modal chrome: backdrop + card positioning (previously hand-rolled identically across
 * AuthModal/SetUsernameModal/TrainingConsentModal/ResetPasswordModal) plus the accessibility
 * behavior none of them had — a keyboard user could previously tab straight through any of these
 * modals into the page behind it, with no Escape-to-close and no aria-modal announcing the modal
 * to a screen reader (production audit, 2026-07-12).
 */
export function ModalShell({ children, ariaLabel, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap: on mount, remember what was focused (to restore on close) and move focus inside
  // the dialog. On Tab/Shift+Tab, wrap focus between the first and last focusable descendant
  // instead of letting it escape into the page behind the modal.
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const node = containerRef.current;
    const firstFocusable = node?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? node)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          tabIndex={-1}
          className="relative w-full max-w-sm bg-z-card border border-white/10 rounded-3xl p-6 shadow-2xl outline-none"
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
