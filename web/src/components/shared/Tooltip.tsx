import { useState, type ReactNode } from 'react';
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
 */
export function Tooltip({ title, description, placement = 'top', className = '', children }: Props) {
  const [show, setShow] = useState(false);
  const isTop = placement === 'top';

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            role="tooltip"
            className={`absolute left-1/2 -translate-x-1/2 z-50 w-40 pointer-events-none ${
              isTop ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
            initial={{ opacity: 0, y: isTop ? 4 : -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isTop ? 4 : -4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <div className="bg-z-card border border-white/10 rounded-xl px-3 py-2 text-center shadow-xl shadow-black/40">
              <p className="font-bold text-xs text-white leading-snug">{title}</p>
              <p className="text-[10px] text-z-gray-400 leading-snug mt-0.5">{description}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
