import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import { useShallow } from 'zustand/react/shallow';
import { getShopItem } from '@/data/shop';
import { AvatarGlyph } from '@/components/shared/AvatarGlyph';
import { LogoutConfirm } from '@/components/auth/LogoutConfirm';

export type SideNavScreen = 'home' | 'review' | 'alphabet' | 'shop' | 'friends' | 'multiplayer' | 'leaderboard' | 'settings' | 'profile';

interface Props {
  active: SideNavScreen | null;
  onHome: () => void;
  onReview: () => void;
  onAlphabet: () => void;
  onShop: () => void;
  onFriends: () => void;
  onMultiplayer: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
  onProfile: () => void;
  /** Open the sign-in modal (used when a guest taps the profile chip or the "Sign in" item). */
  onSignIn: () => void;
}

// Shop intentionally excluded from the main list — it renders as its own row below the divider,
// alongside Settings/Log out (2026-07-16), not mixed in with the primary navigation items.
const NAV_ITEMS: { id: SideNavScreen; label: string; icon: string }[] = [
  { id: 'home', label: 'Journey', icon: '🗺️' },
  { id: 'review', label: 'Review', icon: '🪞' },
  { id: 'alphabet', label: 'Alphabets', icon: '🔤' },
  { id: 'multiplayer', label: 'Multiplayer', icon: '⚔️' },
  { id: 'friends', label: 'Friends', icon: '🤝' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
];

// Single source of the hover/tap feel for every row in this list — a plain tween (no spring
// overshoot) so rapidly moving the pointer between adjacent rows can't visibly bounce/jitter
// (reported as "stutters" when pointing between two tabs, 2026-07-16).
const ROW_TRANSITION = { duration: 0.12, ease: 'easeOut' as const };

export function SideNav({ active, onHome, onReview, onAlphabet, onShop, onFriends, onMultiplayer, onLeaderboard, onSettings, onProfile, onSignIn }: Props) {
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
    shop: onShop,
    friends: onFriends,
    multiplayer: onMultiplayer,
    leaderboard: onLeaderboard,
    settings: onSettings,
    profile: onProfile,
  };

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-dvh w-64 flex-col py-6 px-4 bg-z-card border-r border-white/5 z-40">
      <div className="flex items-center gap-2 px-2 mb-8 shrink-0">
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
          <img src="/pwa-192x192.png" alt="" className="w-full h-full object-cover" />
        </div>
        <span
          className="font-bold text-lg tracking-tight"
          style={{
            background: 'linear-gradient(90deg, #A78BFA 0%, #14B8A6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
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
                isActive ? 'bg-z-purple/20 text-z-purple' : 'text-z-gray-300 hover:bg-white/5'
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
            active === 'profile' ? 'bg-z-purple/20 text-z-purple' : 'text-z-gray-300 hover:bg-white/5'
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
          onClick={onShop}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            active === 'shop' ? 'bg-z-purple/20 text-z-purple' : 'text-z-gray-300 hover:bg-white/5'
          }`}
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          transition={ROW_TRANSITION}
        >
          <span className="text-lg">🛒</span>
          Shop
        </motion.button>
        <motion.button
          onClick={onSettings}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            active === 'settings' ? 'bg-z-purple/20 text-z-purple' : 'text-z-gray-300 hover:bg-white/5'
          }`}
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          transition={ROW_TRANSITION}
        >
          <span className="text-lg">⚙️</span>
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
    </aside>
  );
}
