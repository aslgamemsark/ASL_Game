import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ZIPPY_SRC, type ZippyExpression } from '@/data/zippy';

const SIZE_PX: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = { xs: 56, sm: 72, md: 128, lg: 200, xl: 280 };

interface Props {
  expression: ZippyExpression;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Makes Zippy react to pointer input — hover tilt + tap squash, and (with onTap) clickable.
   *  Off by default so decorative Zippys stay inert (pointer-events-none). Suppressed under
   *  prefers-reduced-motion, like the float. */
  interactive?: boolean;
  onTap?: () => void;
  /**
   * Provide only when Zippy is the meaningful content (e.g. the error screen). When omitted the
   * image is decorative (aria-hidden, empty alt) because the adjacent text already conveys the
   * message — that avoids a screen reader announcing "Zippy waving image" on top of the words.
   */
  alt?: string;
  /** Gentle idle bob. Suppressed under prefers-reduced-motion. */
  float?: boolean;
  /** Load eagerly instead of lazily — use for above-the-fold heroes (welcome, error) to avoid a
   *  first-paint flash. Leave off for below-the-fold uses (empty states) so they stay deferred. */
  priority?: boolean;
  /**
   * 'contain' (default): natural full-body art at a fixed height, auto width — use standalone.
   * 'cover': fills a fixed-size square parent (e.g. `w-12 h-12`) and crops to the top of the
   * frame, so the character reads as a face-forward avatar icon instead of a tiny sliver of a
   * full standing body — use inside a chat-avatar-style square slot alongside other avatars.
   */
  fit?: 'contain' | 'cover';
}

// The one image primitive every Zippy appearance goes through. Swapping the static art for an
// animated version later (Lottie / APNG / video) means changing only this file — call sites and
// the ZIPPY_SRC map stay the same.
export function Zippy({ expression, size = 'md', className = '', alt, float = false, priority = false, fit = 'contain', interactive = false, onTap }: Props) {
  const reduce = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const px = SIZE_PX[size];
  const decorative = !alt;
  const canReact = interactive && !reduce;

  // If the asset ever fails to load, collapse to nothing rather than showing a broken-image icon
  // (matters most inside the ErrorBoundary, where the failure might BE an asset problem).
  if (failed) return null;

  return (
    <motion.img
      src={ZIPPY_SRC[expression]}
      alt={decorative ? '' : alt}
      aria-hidden={decorative || undefined}
      draggable={false}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={() => setFailed(true)}
      onClick={interactive ? onTap : undefined}
      style={fit === 'cover' ? undefined : { height: px, width: 'auto' }}
      className={
        fit === 'cover'
          ? `select-none ${interactive ? 'cursor-pointer' : 'pointer-events-none'} w-full h-full object-cover object-top ${className}`
          : `select-none ${interactive ? 'cursor-pointer' : 'pointer-events-none'} object-contain ${className}`
      }
      whileHover={canReact ? { scale: 1.06, rotate: 3 } : undefined}
      whileTap={canReact ? { scale: 0.92 } : undefined}
      initial={reduce ? false : { opacity: 0, scale: 0.94 }}
      animate={
        reduce
          ? { opacity: 1 }
          : float
            ? { opacity: 1, scale: 1, y: [0, -6, 0] }
            : { opacity: 1, scale: 1 }
      }
      transition={
        float && !reduce
          ? {
              opacity: { duration: 0.4 },
              scale: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
              y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
            }
          : { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
      }
    />
  );
}
