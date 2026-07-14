import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import { useShallow } from 'zustand/react/shallow';
import { getShopItem } from '@/data/shop';
import { getBadge } from '@/data/badges';
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
  /** Open the sign-in modal (used when a guest taps the profile chip). */
  onSignIn: () => void;
  /** Show a transient toast (used when a guest taps "Log out"). */
  onNotice: (msg: string) => void;
}

const NAV_ITEMS: { id: SideNavScreen; label: string; icon: string }[] = [
  { id: 'home', label: 'Journey', icon: '🗺️' },
  { id: 'review', label: 'Review', icon: '🪞' },
  { id: 'alphabet', label: 'Alphabets', icon: '🔤' },
  { id: 'multiplayer', label: 'Multiplayer', icon: '⚔️' },
  { id: 'shop', label: 'Shop', icon: '🪙' },
  { id: 'friends', label: 'Friends', icon: '🤝' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
];

export function SideNav({ active, onHome, onReview, onAlphabet, onShop, onFriends, onMultiplayer, onLeaderboard, onSettings, onProfile, onSignIn, onNotice }: Props) {
  const { user, username } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  // Always mounted on desktop widths — see TopBar's identical fix for why a selector matters here.
  const { equippedAvatar, activeBadge, equippedBorder } = useUserStore(
    useShallow((s) => ({
      equippedAvatar: s.equippedAvatar, activeBadge: s.activeBadge, equippedBorder: s.equippedBorder,
    }))
  );
  const avatarIcon = equippedAvatar
    ? (getShopItem(equippedAvatar)?.icon ?? '🤟')
    : activeBadge ? (getBadge(activeBadge)?.icon ?? '🤟') : '🤟';
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
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 flex-col py-6 px-4 bg-z-card border-r border-white/5 z-40">
      <div className="flex items-center gap-2 px-2 mb-8">
        <span className="text-2xl">🤟</span>
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
        className="flex items-center gap-2.5 px-2 py-2.5 mb-6 rounded-xl bg-z-surface/60 hover:bg-z-surface transition-colors text-left w-full"
        whileTap={{ scale: 0.98 }}
      >
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br from-z-purple to-z-purple-deep flex items-center justify-center text-lg shrink-0 ${borderClasses}`}>
          {avatarIcon}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{username ?? (user ? '…' : 'Guest')}</p>
          <p className="text-z-gray-400 text-xs truncate">{user ? 'View profile' : 'Tap to sign in'}</p>
        </div>
      </motion.button>

      <nav className="flex-1 flex flex-col gap-1">
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
        >
          <span className={`text-lg w-6 h-6 flex items-center justify-center rounded-md ${borderClasses}`}>{avatarIcon}</span>
          Me
        </motion.button>
      </nav>

      <div className="flex flex-col gap-1 pt-4 mt-4 border-t border-white/5">
        <motion.button
          onClick={onSettings}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            active === 'settings' ? 'bg-z-purple/20 text-z-purple' : 'text-z-gray-300 hover:bg-white/5'
          }`}
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="text-lg">⚙️</span>
          Settings
        </motion.button>
        <motion.button
          onClick={() => (user ? setShowLogout(true) : onNotice("You're already logged out"))}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-z-gray-300 hover:bg-white/5 hover:text-z-red transition-colors"
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="text-lg">🚪</span>
          Log out
        </motion.button>
      </div>

      <LogoutConfirm open={showLogout} onClose={() => setShowLogout(false)} />
    </aside>
  );
}
