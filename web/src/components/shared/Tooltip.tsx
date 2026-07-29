import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  title: string;
  description: string;
  /** Which side of the trigger the popup opens on — 'top' (default) for most grids, 'bottom' for
      items near the top of the viewport where an upward popup would get clipped. */
  placement?: 'top' | 'bottom';
  /** Extra classes on the wrapper — e.g. "aspect-square" so a grid cell's sizing lands on the
      wrapper (the actual grid child) rather than getting lost once the trigger is nested inside. */
  className?: string;
  children: ReactNode;
}

/**
 * Small hover/focus popup showing a title + description. No codebase-wide tooltip primitive
 * existed before this (only bare native `title=` attributes), so this is deliberately minimal:
 * one shared component rather than another one-off per call site.
 *
 * Also opens on tap: hover/focus alone is unreachable on touch — tapping a div doesn't move focus
 * on iOS Safari, so the tooltip (the only place several badge meanings are explained) was
 * completely inert on a phone (mobile audit, 2026-07-28). A tap toggles it open; a second tap
 * anywhere outside, or Escape, closes it — mirroring how a native title/popover behaves.
 */
export function Tooltip({ title, description, placement = 'top', className = '', children }: Props) {
  const [show, setShow] = useState(false);
  const [shiftX, setShiftX] = useState(0);
  const isTop = placement === 'top';
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const onOutside = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setShow(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShow(false);
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [show]);

  // The popup is centered on the trigger (`left-1/2 -translate-x-1/2`) at a fixed w-40 (160px),
  // which clips off-screen on the first/last column of a grid. Clamp it back into the viewport
  // with a horizontal shift rather than a fixed-position portal — good enough for the app's actual
  // layouts (grids inside a max-w-lg column) without the complexity of a real popover primitive.
  useEffect(() => {
    if (!show || !popupRef.current) {
      setShiftX(0);
      return;
    }
    const rect = popupRef.current.getBoundingClientRect();
    const margin = 8;
    let shift = 0;
    if (rect.left < margin) shift = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) shift = window.innerWidth - margin - rect.right;
    if (shift !== 0) setShiftX(shift);
  }, [show]);

  return (
    <div
      ref={wrapperRef}
      className={`relative ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onClick={(e) => {
        // Only toggle when the trigger itself is a non-interactive wrapper (badge tiles, etc.) —
        // if children already handle their own click (a real button), let that win and don't
        // fight it by also toggling here.
        if ((e.target as HTMLElement).closest('button, a, [role="button"]') === null) {
          setShow((s) => !s);
        }
      }}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            ref={popupRef}
            role="tooltip"
            style={{ x: shiftX }}
            className={`absolute left-1/2 -translate-x-1/2 z-50 w-40 ${
              isTop ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
            initial={{ opacity: 0, y: isTop ? 4 : -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isTop ? 4 : -4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <div className="bg-z-card border border-white/10 rounded-xl px-3 py-2 text-center shadow-xl shadow-black/40">
              <p className="font-bold text-xs text-z-gray-50 leading-snug">{title}</p>
              <p className="text-[10px] text-z-gray-400 leading-snug mt-0.5">{description}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
