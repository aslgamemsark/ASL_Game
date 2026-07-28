import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Options {
  /** Accessible name for the dialog, announced when it opens. */
  label: string;
  /**
   * Omit for a dialog that must be resolved through its own actions rather than dismissed — Escape
   * is then inert, matching how `ResetPasswordModal` already behaved mid password-recovery.
   */
  onClose?: () => void;
  /**
   * Whether the dialog is currently open. Only needed by a component that stays mounted and
   * renders its own content conditionally (`<AnimatePresence>{open && …}</AnimatePresence>` —
   * `LogoutConfirm` is the one that does this): without it the trap would arm on first render,
   * leaving a live Escape listener on a closed dialog and restoring focus to whatever happened to
   * be focused when the app booted. Dialogs their parent mounts and unmounts can leave it alone.
   */
  active?: boolean;
}

interface Dialog<E extends HTMLElement> {
  /** Attach to the dialog's outermost element — the focus trap searches inside it. */
  ref: React.RefObject<E | null>;
  /** Spread onto that same element. Carries the role, the accessible name, and the tabindex the
   *  trap needs in order to focus a dialog that has no focusable children yet. */
  props: {
    role: 'dialog';
    'aria-modal': true;
    'aria-label': string;
    tabIndex: -1;
  };
}

/**
 * The accessibility behaviour every modal dialog needs: announced as a dialog, focus moved inside
 * on open, focus trapped while open, focus restored to whatever opened it on close, and Escape to
 * dismiss.
 *
 * Returns the props rather than expecting callers to remember them, because remembering is exactly
 * what failed. `ModalShell` has had all of this since the 2026-07-12 audit, but adoption stopped at
 * the four auth modals: of eleven dialogs in the app, eight had no `role="dialog"`, no `aria-modal`,
 * no Escape and no focus management at all, so a keyboard user could tab straight through them into
 * the page behind and a screen reader never announced that a dialog had opened (found 2026-07-28).
 *
 * Separated from `ModalShell` because the two decisions are different: this owns the behaviour,
 * which is identical everywhere, while the shell owns the chrome, which legitimately varies — a
 * centred card, a bottom sheet, and a full-screen first-run gate are not the same layout, and
 * forcing them through one wrapper was what stopped the behaviour spreading in the first place.
 */
export function useDialogA11y<E extends HTMLElement = HTMLDivElement>({
  label,
  onClose,
  active = true,
}: Options): Dialog<E> {
  const ref = useRef<E | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // `onClose` is read through a ref so the listener can be installed once on mount. Depending on
  // the callback directly would re-run this effect on every parent render that passes a fresh
  // closure, and each re-run would re-capture previousFocusRef — losing the element that actually
  // opened the dialog and restoring focus to something inside it instead.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const node = ref.current;
    (node?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? node)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
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
      // Optional-call: the opener may have unmounted while the dialog was open.
      previousFocusRef.current?.focus?.();
    };
    // Re-arms when `active` flips, which is what makes the open/close transition correct: opening
    // captures the element that was focused a moment before, closing hands focus back to it.
  }, [active]);

  // aria-label rather than aria-labelledby: these dialogs' visible headings differ in shape (some
  // have none), so there is no single element id to point at across all of them.
  return { ref, props: { role: 'dialog', 'aria-modal': true, 'aria-label': label, tabIndex: -1 } };
}
