import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import { useShallow } from 'zustand/react/shallow';
import { getShopItem } from '@/data/shop';
import { AvatarGlyph } from '@/components/shared/AvatarGlyph';
import { LogoutConfirm } from '@/components/auth/LogoutConfirm';

export type SideNavScreen = 'home' | 'review' | 'alphabet' | 'basicSigns' | 'shop' | 'friends' | 'multiplayer' | 'leaderboard' | 'settings' | 'profile';

interface Props {
  active: SideNavScreen | null;
  onHome: () => void;
  onReview: () => void;
  onAlphabet: () => void;
  onBasicSigns: () => void;
  onShop: () => void;
  onFriends: () => void;
  onMultiplayer: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
  onProfile: () => void;
  /** Open the sign-in modal (used when a guest taps the profile chip or the "Sign in" item). */
  onSignIn: () => void;
}

// Shop was removed from this list (2026-07-24, analytics-driven nav simplification) — it stays
// reachable via the TopBar cart icon and the mobile BottomNav.
const NAV_ITEMS: { id: SideNavScreen; label: string; icon: string }[] = [
  { id: 'home', label: 'Journey', icon: '🗺️' },
  { id: 'alphabet', label: 'Alphabets', icon: '🔤' },
  { id: 'basicSigns', label: 'Basic Signs', icon: '👋' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
  { id: 'multiplayer', label: 'Multiplayer', icon: '⚔️' },
  { id: 'friends', label: 'Friends', icon: '🤝' },
  { id: 'review', label: 'Review', icon: '🪞' },
];

// Single source of the hover/tap feel for every row in this list — a plain tween (no spring
// overshoot) so rapidly moving the pointer between adjacent rows can't visibly bounce/jitter
// (reported as "stutters" when pointing between two tabs, 2026-07-16).
const ROW_TRANSITION = { duration: 0.12, ease: 'easeOut' as const };

export function SideNav({ active, onHome, onReview, onAlphabet, onBasicSigns, onShop, onFriends, onMultiplayer, onLeaderboard, onSettings, onProfile, onSignIn }: Props) {
  const { user, username } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  // Always mounted on desktop widths — see TopBar's identical fix for why a selector matters here.
  const { equippedAvatar, activeBadge, equippedBorder } = useUserStore(
    useShallow((s) => ({
      equippedAvatar: s.equippedAvatar, activeBadge: s.activeBadge, equippedBorder: s.equippedBorder,
    }))
  );
  const borderClasses = equippedBorder ? (getShopItem(equippedBorder)?.preview ?? '') : '';

  const handlers: Record<SideNavScreen, () => void> = {
    home: onHome,
    review: onReview,
    alphabet: onAlphabet,
    basicSigns: onBasicSigns,
    shop: onShop,
    friends: onFriends,
    multiplayer: onMultiplayer,
    leaderboard: onLeaderboard,
    settings: onSettings,
    profile: onProfile,
  };

  return (
    // <nav>, not <aside>: this is primary navigation, not complementary content — same landmark
    // reasoning as BottomNav, which owns the equivalent role below the `lg` breakpoint.
    <nav aria-label="Main" className="hidden lg:flex fixed left-0 top-0 h-dvh w-64 flex-col py-6 px-4 bg-z-card border-r border-white/5 z-40">
      <div className="flex items-center gap-2 px-2 mb-8 shrink-0">
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
          <img src="/pwa-192x192.png" alt="" className="w-full h-full object-cover" />
        </div>
        <span
          className="font-bold text-lg tracking-tight text-gradient-brand"
        >
          QuickSign
        </span>
      </div>

      {/* Tapping the chip goes to the Me tab when signed in, or opens the sign-in modal for a guest. */}
      <motion.button
        onClick={() => (user ? onProfile() : onSignIn())}
        className="flex items-center gap-2.5 px-2 py-2.5 mb-6 rounded-xl bg-z-surface/60 hover:bg-z-surface transition-colors text-left w-full shrink-0"
        whileTap={{ scale: 0.98 }}
      >
        <div className={`w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-z-purple to-z-purple-deep flex items-center justify-center text-lg shrink-0 ${borderClasses}`}>
          <AvatarGlyph avatarId={equippedAvatar} badgeId={activeBadge} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{username ?? (user ? '…' : 'Guest')}</p>
          <p className="text-z-gray-400 text-xs truncate">{user ? 'View profile' : 'Tap to sign in'}</p>
        </div>
      </motion.button>

      {/* min-h-0 lets this shrink below its content size inside the flex column (the default
          min-height:auto would otherwise stop it from ever compressing), so it's the ONLY part
          that scrolls if content is ever taller than the viewport — the header above and the
          Settings/Log out block below stay pinned and always visible without any scrolling. */}
      <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={handlers[item.id]}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive ? 'bg-z-purple/20 text-z-purple-light' : 'text-z-gray-300 hover:bg-white/5'
              }`}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={ROW_TRANSITION}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </motion.button>
          );
        })}
        <motion.button
          onClick={onProfile}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            active === 'profile' ? 'bg-z-purple/20 text-z-purple-light' : 'text-z-gray-300 hover:bg-white/5'
          }`}
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          transition={ROW_TRANSITION}
        >
          <span className={`text-lg w-6 h-6 flex items-center justify-center overflow-hidden rounded-md ${borderClasses}`}><AvatarGlyph avatarId={equippedAvatar} badgeId={activeBadge} /></span>
          Me
        </motion.button>
      </nav>

      <div className="flex flex-col gap-1 pt-4 mt-4 border-t border-white/5 shrink-0">
        <motion.button
          onClick={onSettings}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            active === 'settings' ? 'bg-z-purple/20 text-z-purple-light' : 'text-z-gray-300 hover:bg-white/5'
          }`}
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          transition={ROW_TRANSITION}
        >
          {/* Explicit SVG (not the ⚙️ emoji): that glyph's default silver/gray color scheme reads
              as washed-out against the light theme's surfaces. currentColor ties it to this
              button's existing text-z-purple-light/text-z-gray-300 state instead. */}
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </motion.button>
        {/* A guest has no session to end — sending them to the sign-in modal (rather than the old
            "you're already logged out" toast) is what they actually want, and their local guest
            progress merges into the account on sign-in. A signed-in user gets the real logout
            confirm, after which App routes them to the sign-in screen. */}
        <motion.button
          onClick={() => (user ? setShowLogout(true) : onSignIn())}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-z-gray-300 hover:bg-white/5 hover:text-z-red transition-colors"
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          transition={ROW_TRANSITION}
        >
          <span className="text-lg">{user ? '🚪' : '🔑'}</span>
          {user ? 'Log out' : 'Sign in'}
        </motion.button>
      </div>

      <LogoutConfirm open={showLogout} onClose={() => setShowLogout(false)} />
    </nav>
  );
}
