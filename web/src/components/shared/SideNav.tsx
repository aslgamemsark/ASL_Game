import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import { getShopItem } from '@/data/shop';
import { getBadge } from '@/data/badges';

export type SideNavScreen = 'home' | 'shop' | 'friends' | 'settings';

interface Props {
  active: SideNavScreen | null;
  onHome: () => void;
  onShop: () => void;
  onFriends: () => void;
  onSettings: () => void;
}

const NAV_ITEMS: { id: SideNavScreen; label: string; icon: string }[] = [
  { id: 'home', label: 'Journey', icon: '🗺️' },
  { id: 'shop', label: 'Shop', icon: '🪙' },
  { id: 'friends', label: 'Friends', icon: '🤝' },
];

export function SideNav({ active, onHome, onShop, onFriends, onSettings }: Props) {
  const { user, username, signOut } = useAuth();
  const { equippedAvatar, activeBadge } = useUserStore();
  const avatarIcon = equippedAvatar
    ? (getShopItem(equippedAvatar)?.icon ?? '🤟')
    : activeBadge ? (getBadge(activeBadge)?.icon ?? '🤟') : '🤟';

  const handlers: Record<SideNavScreen, () => void> = {
    home: onHome,
    shop: onShop,
    friends: onFriends,
    settings: onSettings,
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
          SignUp
        </span>
      </div>

      <div className="flex items-center gap-2.5 px-2 py-2.5 mb-6 rounded-xl bg-z-surface/60">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-z-purple to-z-purple-deep flex items-center justify-center text-lg shrink-0">
          {avatarIcon}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{username ?? (user ? '…' : 'Guest')}</p>
          <p className="text-z-gray-400 text-xs truncate">{user ? 'Signed in' : 'Not signed in'}</p>
        </div>
      </div>

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
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-z-gray-300 hover:bg-white/5 hover:text-z-red transition-colors"
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="text-lg">🚪</span>
          Log out
        </motion.button>
      </div>
    </aside>
  );
}
