import { motion, type TargetAndTransition } from 'framer-motion';
import { useUserStore } from '@/stores/useUserStore';
import { AvatarGlyph } from '@/components/shared/AvatarGlyph';

export type Tab = 'learn' | 'review' | 'alphabet' | 'basicSigns' | 'profile';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

// Ordered to match SideNav on desktop: the learning progression first, Review last.
//
// This bar carries ONLY Home's own sub-tabs. Shop, Multiplayer and Settings used to sit here too,
// which pushed it to eight items at 375px — roughly 44px each with no breathing room, well past
// the 3-5 a bottom bar is designed for. They are top-level screens rather than Home tabs anyway,
// so they never participated in `active`/`onChange` and sat here as visually identical buttons
// that behaved differently. Shop is now reached via the TopBar cart (44x44 as of 2026-07-29 —
// it was 32px when "the cart alone is too small to find" put Shop in this bar), and Multiplayer
// and Settings via the profile tab, alongside Leaderboard and Friends.
const STATIC_TABS = [
  { id: 'learn'      as Tab, label: 'Journey',  icon: '🗺️' },
  { id: 'alphabet'   as Tab, label: 'Alphabets', icon: '🔤'  },
  { id: 'basicSigns' as Tab, label: 'Basics',   icon: '👋'  },
  { id: 'review'     as Tab, label: 'Review',   icon: '🪞'  },
];

const ICON_HOVER: Record<Tab, TargetAndTransition> = {
  learn:      { rotate: [0, -9, 8, -6, 0],           transition: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' as const } },
  review:     { scale: [1, 1.16, 1, 1.12, 1],         transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const } },
  alphabet:   { rotate: [0, -6, 6, -4, 0], scale: [1, 1.1, 1], transition: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' as const } },
  basicSigns: { rotate: [0, 14, -10, 14, 0],         transition: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' as const } },
  profile:    { rotate: [0, -18, 14, -18, 14, 0],    transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const } },
};

export function BottomNav({ active, onChange }: Props) {
  const { equippedAvatar, activeBadge } = useUserStore();

  // Profile tab renders <AvatarGlyph> (image or emoji) instead of a plain emoji string — icon here
  // is just a placeholder that's never shown for the profile tab (see the render below).
  const tabs = [
    ...STATIC_TABS,
    { id: 'profile' as Tab, label: 'Me', icon: '🤟' },
  ];

  return (
    // <nav>, not a bare <div>: this is the app's primary navigation on every phone, and without a
    // landmark a screen-reader user has no way to jump to it — they must traverse the whole page.
    // It also gives automated checks a way to distinguish the nav from same-named content (a "Test
    // from Memory" card matched a naive search for the "Me" tab before this).
    <nav aria-label="Main" className="fixed bottom-0 left-0 right-0 z-overlay bg-z-bg/90 backdrop-blur-md border-t border-z-purple-deep/40 pb-safe">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2.5">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-2xl transition-colors ${
                isActive ? 'bg-z-purple/20' : ''
              }`}
              initial="rest"
              animate="rest"
              whileHover="hover"
              whileTap={{ scale: 0.88, y: 0 }}
              variants={{
                rest:  { y: 0, scale: 1, transition: { duration: 0.18, ease: 'easeOut' } },
                hover: { y: -3, scale: 1.06, transition: { duration: 0.18, ease: 'easeOut' } },
              }}
            >
              <motion.span
                className="text-xl inline-block"
                style={{ transformOrigin: tab.id === 'profile' ? '75% 80%' : 'center' }}
                variants={{
                  rest:  { rotate: 0, scale: isActive ? 1.1 : 1, transition: { duration: 0.25, ease: 'easeOut' } },
                  hover: ICON_HOVER[tab.id],
                }}
              >
                {tab.id === 'profile' ? (
                  <span className="w-5 h-5 rounded-md overflow-hidden flex items-center justify-center">
                    <AvatarGlyph avatarId={equippedAvatar} badgeId={activeBadge} />
                  </span>
                ) : tab.icon}
              </motion.span>
              <span className={`text-3xs font-semibold tracking-wide ${
                isActive ? 'text-z-purple-glow' : 'text-z-gray-400'
              }`}>
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  className="absolute -bottom-1 h-[3px] w-6 bg-z-purple-light rounded-full"
                  layoutId="nav-dot"
                />
              )}
            </motion.button>
          );
        })}

      </div>
    </nav>
  );
}
