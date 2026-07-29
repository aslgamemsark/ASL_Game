import { useState } from 'react';
import { useDialogA11y } from '@/hooks/useDialogA11y';
import { motion, AnimatePresence } from 'framer-motion';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { SHOP_ITEMS, RARITY_COLOR, type ShopItem, type CosmeticType } from '@/data/shop';
import { useUserStore } from '@/stores/useUserStore';
import { useSounds } from '@/hooks/useSounds';
import { useFeatureFlag } from '@/analytics';

const SECTIONS: { type: CosmeticType; title: string; icon: string }[] = [
  { type: 'border', title: 'Borders', icon: '🖼' },
  { type: 'avatar', title: 'Avatars', icon: '😊' },
  { type: 'consumable', title: 'Consumables', icon: '🎫' },
];

interface Props {
  onExit: () => void;
}

export function ShopPage({ onExit }: Props) {
  // Emergency remote kill switch — lets the shop be pulled instantly (e.g. a pricing/economy bug
  // found live) without a hotfix deploy. Defaults to enabled when the flag is unreadable.
  const shopDisabled = useFeatureFlag('disable_shop', false);
  const { gold, ownedCosmetics, equippedBorder, equippedAvatar, renameCards, streakFreezes, purchaseCosmetic, purchaseRenameCard, purchaseStreakFreeze, equipBorder, equipAvatar } = useUserStore();
  const { purchase, wrong } = useSounds();
  const [selected, setSelected] = useState<ShopItem | null>(null);
  // active: !!selected — the detail sheet is gated on `selected` inside an always-mounted page.
  const dialog = useDialogA11y({
    label: selected ? selected.title : 'Shop item',
    onClose: () => setSelected(null),
    active: !!selected,
  });
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handleBuy = (item: ShopItem) => {
    if (item.type === 'consumable') {
      const ok = item.id === 'streak_protection'
        ? purchaseStreakFreeze(item.goldPrice)
        : purchaseRenameCard();
      if (ok) { purchase(); showToast(item.id === 'streak_protection' ? 'Streak Protection added! 🛡️' : 'Rename Card added! 🎟️'); }
      else     { wrong();   showToast('Not enough Gold 🪙'); }
      return;
    }
    const ok = purchaseCosmetic(item.id, item.goldPrice);
    if (ok) {
      purchase();
      showToast(`Unlocked "${item.title}"! 🎉`);
    } else {
      wrong();
      showToast('Not enough Gold 🪙');
    }
  };

  const handleEquip = (item: ShopItem) => {
    // Tapping an already-equipped cosmetic un-equips it (toggle); otherwise equip it.
    if (item.type === 'border') equipBorder(equippedBorder === item.id ? null : item.id);
    else if (item.type === 'avatar') equipAvatar(equippedAvatar === item.id ? null : item.id);
    setSelected(null);
  };

  const isOwned = (item: ShopItem) => item.type === 'consumable' ? false : ownedCosmetics.includes(item.id);
  const isEquipped = (item: ShopItem) =>
    (item.type === 'border' && equippedBorder === item.id) ||
    (item.type === 'avatar' && equippedAvatar === item.id);

  if (shopDisabled) {
    return (
      <div className="min-h-dvh bg-z-bg flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
          <HeaderBackButton onClick={onExit} />
          <h1 className="font-bold text-lg flex-1">Shop</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="text-5xl">🛠️</span>
          <p className="font-bold text-lg">The shop is briefly offline</p>
          <p className="text-z-gray-400 text-sm">We're fixing something — check back in a bit.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-z-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton onClick={onExit} />
        <h1 className="font-bold text-lg flex-1">Shop</h1>
        <div className="flex items-center gap-1.5 bg-z-card border border-z-yellow/20 rounded-xl px-3 py-1.5">
          <span className="text-sm">🪙</span>
          <span className="font-bold text-z-yellow text-sm">{gold}</span>
        </div>
      </div>

      {/* Category sections */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 pt-6 pb-24 overflow-y-auto">
        {SECTIONS.map((section) => {
          const items = SHOP_ITEMS.filter((i) => i.type === section.type);
          if (items.length === 0) return null;
          return (
            <div key={section.type} className="mb-8">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-lg">{section.icon}</span>
                <h2 className="font-bold text-base tracking-wide">{section.title}</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map((item, i) => {
                  const owned = isOwned(item);
                  const equipped = isEquipped(item);
                  const isConsumable = item.type === 'consumable';
                  const consumableCount = isConsumable
                    ? (item.id === 'streak_protection' ? streakFreezes : item.id === 'rename_card' ? renameCards : 0)
                    : 0;
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className={`relative rounded-2xl p-4 text-left border transition-all ${
                        equipped
                          ? 'border-z-purple bg-z-purple/15'
                          : owned
                            ? 'border-z-green/30 bg-z-green/8'
                            : 'border-white/8 bg-z-card'
                      }`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {/* Rarity dot */}
                      <div
                        className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full"
                        style={{ background: RARITY_COLOR[item.rarity] }}
                      />

                      {item.image ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden mb-2">
                          <img src={item.image} alt="" draggable={false} className="w-full h-full object-cover object-top" />
                        </div>
                      ) : (
                        <div className="text-3xl mb-2">{item.icon}</div>
                      )}
                      <p className="font-bold text-sm leading-tight">{item.title}</p>
                      <p className="text-[11px] text-z-gray-400 mt-0.5 leading-tight">{item.description}</p>

                      <div className="mt-3 flex items-center justify-between">
                        {owned ? (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                            equipped ? 'bg-z-purple/30 text-z-purple' : 'bg-z-green/20 text-z-green'
                          }`}>
                            {equipped ? '✓ Equipped' : 'Owned'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm font-bold text-z-yellow">
                            🪙 {item.goldPrice}
                          </span>
                        )}
                        {isConsumable && consumableCount > 0 && (
                          <span className="text-[11px] font-bold bg-z-purple/20 text-z-purple-light px-2 py-0.5 rounded-lg">
                            ×{consumableCount}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Item detail sheet */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
            />
            <motion.div
              ref={dialog.ref}
              {...dialog.props}
              className="fixed bottom-0 left-0 right-0 bg-z-surface border-t border-white/10 rounded-t-3xl max-h-[85dvh] overflow-y-auto px-6 pt-6 pb-[calc(1.5rem+var(--sab))] z-50 max-w-lg mx-auto outline-none"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="w-12 h-1 bg-z-gray-500 rounded-full mx-auto mb-5" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-z-card border border-white/10 flex items-center justify-center overflow-hidden text-4xl">
                  {selected.image
                    ? <img src={selected.image} alt="" draggable={false} className="w-full h-full object-cover object-top" />
                    : selected.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{selected.title}</h3>
                  <p className="text-xs text-z-gray-400 capitalize"
                    style={{ color: RARITY_COLOR[selected.rarity] }}>
                    {selected.rarity}
                  </p>
                  <p className="text-sm text-z-gray-300 mt-1">{selected.description}</p>
                </div>
              </div>

              {selected.type === 'consumable' ? (
                <>
                  {selected.id === 'rename_card' && renameCards > 0 && (
                    <p className="text-center text-xs text-z-purple-light mb-3">
                      You own {renameCards} rename card{renameCards !== 1 ? 's' : ''}
                    </p>
                  )}
                  {selected.id === 'streak_protection' && streakFreezes > 0 && (
                    <p className="text-center text-xs text-z-purple-light mb-3">
                      You have {streakFreezes} protection card{streakFreezes !== 1 ? 's' : ''}
                    </p>
                  )}
                  <motion.button
                    onClick={() => handleBuy(selected)}
                    disabled={gold < selected.goldPrice}
                    className="w-full py-3 rounded-2xl font-bold text-base text-white disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-amber"
                                       whileTap={{ scale: 0.97 }}
                  >
                    Buy for 🪙 {selected.goldPrice}
                  </motion.button>
                </>
              ) : isOwned(selected) ? (
                <motion.button
                  onClick={() => handleEquip(selected)}
                  className={`w-full py-3 rounded-2xl font-bold text-base ${
                    isEquipped(selected)
                      ? 'bg-z-surface border border-white/20 text-z-gray-300'
                      : 'bg-z-purple text-white'
                  }`}
                  whileTap={{ scale: 0.97 }}
                >
                  {isEquipped(selected) ? 'Unequip' : 'Equip'}
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => handleBuy(selected)}
                  disabled={gold < selected.goldPrice}
                  className="w-full py-3 rounded-2xl font-bold text-base text-white disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-amber"
                                   whileTap={{ scale: 0.97 }}
                >
                  Buy for 🪙 {selected.goldPrice}
                </motion.button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-z-card border border-white/10 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl z-50"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
