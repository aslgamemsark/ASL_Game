import { motion } from 'framer-motion';
import { Zippy } from './Zippy';
import type { ZippyExpression } from '@/data/zippy';

// Row layout puts Zippy beside a single-line-height bubble, so the natural full-body render
// (sized by height, ~40% as wide) reads as a disproportionate sliver next to normal-width text.
// A fixed square avatar, cropped to his face like every other chat-avatar in the app (Story
// Mode's NPC avatars), reads correctly instead.
const ROW_AVATAR_PX: Record<'sm' | 'md' | 'lg', number> = { sm: 48, md: 64, lg: 88 };

interface Props {
  expression: ZippyExpression;
  message: string;
  size?: 'sm' | 'md' | 'lg';
  /** 'row' = Zippy beside a speech bubble (default); 'column' = Zippy above a centered bubble. */
  layout?: 'row' | 'column';
  /** Hide the small "Zippy" name label above the message (e.g. compact inline greetings). */
  hideName?: boolean;
  className?: string;
}

// Zippy + a speech bubble — the workhorse for greetings, empty states, and coaching moments.
// Reuses the app's card styling and the same bubble-notch (rounded-*-md) used by Story Mode so it
// reads as one design language. One per screen; never a modal that covers content.
export function ZippyMessage({
  expression,
  message,
  size = 'md',
  layout = 'row',
  hideName = false,
  className = '',
}: Props) {
  if (layout === 'column') {
    return (
      <div className={`flex flex-col items-center text-center gap-3 ${className}`}>
        <Zippy expression={expression} size={size} float />
        <motion.div
          className="bg-z-card border border-white/5 rounded-2xl px-4 py-3 max-w-xs"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
        >
          <p className="text-sm text-z-gray-100 leading-snug">{message}</p>
        </motion.div>
      </div>
    );
  }

  const avatarPx = ROW_AVATAR_PX[size];
  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <div
        className="rounded-2xl bg-z-purple overflow-hidden shrink-0"
        style={{ width: avatarPx, height: avatarPx }}
      >
        {/* No `float` here — the row avatar is a small cropped face (44-88px), and the 6px hero
            bob would read as jittery at that scale. It still gets Zippy's default subtle idle
            breathing (see Zippy.tsx), just not the pronounced hero-moment bob. */}
        <Zippy expression={expression} fit="cover" />
      </div>
      <motion.div
        className="bg-z-card border border-white/5 rounded-2xl rounded-bl-md px-4 py-3 flex-1 min-w-0"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
      >
        {!hideName && <p className="text-sm font-bold text-z-purple-glow mb-0.5">Zippy</p>}
        <p className="text-sm text-z-gray-100 leading-snug">{message}</p>
      </motion.div>
    </div>
  );
}
