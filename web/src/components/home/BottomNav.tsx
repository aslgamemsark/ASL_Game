import { motion, type TargetAndTransition } from 'framer-motion';
import { useUserStore } from '@/stores/useUserStore';
import { AvatarGlyph } from '@/components/shared/AvatarGlyph';

export type Tab = 'learn' | 'review' | 'alphabet' | 'basicSigns' | 'profile';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  /** Navigates to the top-level Multiplayer screen directly — not a home sub-tab, so it never
   *  participates in `active`/`onChange` or gets a highlighted state. */
  onMultiplayer: () => void;
  /** Opens the Shop (a top-level screen, like Multiplayer/Settings). Added to the bar because the
   *  TopBar cart alone tested as too small to find. */
  onShop: () => void;
  /** Settings is a separate top-level Screen (not a HomePage-internal Tab, unlike the other
      four) — navigating there leaves Home entirely, matching SideNav's onSettings on desktop. */
  onSettings: () => void;
}

const STATIC_TABS = [
  { id: 'learn'      as Tab, label: 'Journey',  icon: '🗺️' },
  { id: 'review'     as Tab, label: 'Review',   icon: '🪞'  },
  { id: 'alphabet'   as Tab, label: 'Alphabets', icon: '🔤'  },
  { id: 'basicSigns' as Tab, label: 'Basics',   icon: '👋'  },
];

const ICON_HOVER: Record<Tab, TargetAndTransition> = {
  learn:      { rotate: [0, -9, 8, -6, 0],           transition: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' as const } },
  review:     { scale: [1, 1.16, 1, 1.12, 1],         transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const } },
  alphabet:   { rotate: [0, -6, 6, -4, 0], scale: [1, 1.1, 1], transition: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' as const } },
  basicSigns: { rotate: [0, 14, -10, 14, 0],         transition: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' as const } },
  profile:    { rotate: [0, -18, 14, -18, 14, 0],    transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const } },
};

const SETTINGS_HOVER: TargetAndTransition = {
  rotate: [0, 24, -18, 24, 0], transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const },
};

export function BottomNav({ active, onChange, onMultiplayer, onShop, onSettings }: Props) {
  const { equippedAvatar, activeBadge } = useUserStore();

  // Profile tab renders <AvatarGlyph> (image or emoji) instead of a plain emoji string — icon here
  // is just a placeholder that's never shown for the profile tab (see the render below).
  const tabs = [
    ...STATIC_TABS,
    { id: 'profile' as Tab, label: 'Me', icon: '🤟' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-z-bg/90 backdrop-blur-md border-t border-z-purple-deep/40">
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
              <span className={`text-[10px] font-semibold tracking-wide ${
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

        {/* Top-level Shop screen — like Duel/Settings below, it bypasses onChange/active. */}
        <motion.button
          onClick={onShop}
          className="relative flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-2xl transition-colors"
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
            variants={{
              rest:  { rotate: 0, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
              hover: { rotate: [0, -10, 8, -5, 0], transition: { duration: 0.6, ease: 'easeInOut' } },
            }}
          >
            🛒
          </motion.span>
          <span className="text-[10px] font-semibold tracking-wide text-z-gray-400">Shop</span>
        </motion.button>

        {/* Top-level Multiplayer screen — bypasses onChange/active entirely, unlike the tabs above
            which switch Home's internal sub-tab. */}
        <motion.button
          onClick={onMultiplayer}
          className="relative flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-2xl transition-colors"
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
            variants={{
              rest:  { rotate: 0, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
              hover: { rotate: [0, -12, 10, -6, 0], transition: { duration: 0.6, ease: 'easeInOut' } },
            }}
          >
            ⚔️
          </motion.span>
          <span className="text-[10px] font-semibold tracking-wide text-z-gray-400">Duel</span>
        </motion.button>

        <motion.button
          onClick={onSettings}
          className="relative flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-2xl transition-colors"
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileTap={{ scale: 0.88, y: 0 }}
          variants={{
            rest:  { y: 0, scale: 1, transition: { duration: 0.18, ease: 'easeOut' } },
            hover: { y: -3, scale: 1.06, transition: { duration: 0.18, ease: 'easeOut' } },
          }}
        >
          {/* Explicit SVG (not the ⚙️ emoji): that glyph's default silver/gray color scheme reads
              as washed-out against the light theme's bg. text-z-gray-400 matches the label below
              and themes correctly in both modes, unlike the emoji's fixed color. */}
          <motion.span
            className="inline-block text-z-gray-400"
            variants={{
              rest:  { rotate: 0, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
              hover: SETTINGS_HOVER,
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </motion.span>
          <span className="text-[10px] font-semibold tracking-wide text-z-gray-400">
            Settings
          </span>
        </motion.button>
      </div>
    </div>
  );
}
