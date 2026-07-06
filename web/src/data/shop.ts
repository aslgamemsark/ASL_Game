export type CosmeticType = 'border' | 'avatar' | 'chest_skin' | 'consumable';

export interface ShopItem {
  id: string;
  title: string;
  description: string;
  type: CosmeticType;
  icon: string;
  goldPrice: number;
  preview: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export const SHOP_ITEMS: ShopItem[] = [
  // Borders
  { id: 'border_fire',     title: 'Fire Ring',      description: 'Blazing orange frame for your avatar',     type: 'border',  icon: '🔥', goldPrice: 15,  preview: 'ring-2 ring-orange-500 shadow-orange-500/50 shadow-lg',    rarity: 'common'    },
  { id: 'border_ice',      title: 'Ice Crown',      description: 'Cool blue frost frame',                    type: 'border',  icon: '❄️', goldPrice: 20,  preview: 'ring-2 ring-blue-400 shadow-blue-400/50 shadow-lg',        rarity: 'rare'      },
  { id: 'border_gold',     title: 'Gold Frame',     description: 'Glittering gold border — premium look',    type: 'border',  icon: '✨', goldPrice: 35,  preview: 'ring-2 ring-yellow-400 shadow-yellow-400/50 shadow-lg',    rarity: 'epic'      },
  { id: 'border_rainbow',  title: 'Rainbow Ring',   description: 'Every color at once',                      type: 'border',  icon: '🌈', goldPrice: 60,  preview: 'ring-2 ring-purple-500 shadow-purple-500/50 shadow-lg',    rarity: 'legendary' },
  { id: 'border_neon',     title: 'Neon Pulse',     description: 'Electric green glow that pulses',          type: 'border',  icon: '💚', goldPrice: 25,  preview: 'ring-2 ring-green-400 shadow-green-400/50 shadow-lg',      rarity: 'rare'      },
  { id: 'border_rose',     title: 'Rose Gold',      description: 'Soft pink metallic sheen',                 type: 'border',  icon: '🌸', goldPrice: 30,  preview: 'ring-2 ring-pink-400 shadow-pink-400/50 shadow-lg',        rarity: 'rare'      },

  // Avatar emojis
  { id: 'avatar_wave',     title: 'Wave',           description: 'Replace your avatar with 👋',              type: 'avatar',  icon: '👋', goldPrice: 5,   preview: '👋', rarity: 'common'    },
  { id: 'avatar_clap',     title: 'Clap',           description: 'Replace your avatar with 👏',              type: 'avatar',  icon: '👏', goldPrice: 5,   preview: '👏', rarity: 'common'    },
  { id: 'avatar_peace',    title: 'Peace',          description: 'Replace your avatar with ✌️',              type: 'avatar',  icon: '✌️', goldPrice: 5,   preview: '✌️', rarity: 'common'    },
  { id: 'avatar_raised',   title: 'Raised Hands',   description: 'Replace your avatar with 🙌',              type: 'avatar',  icon: '🙌', goldPrice: 8,   preview: '🙌', rarity: 'rare'      },
  { id: 'avatar_heart',    title: 'Heart Hands',    description: 'Replace your avatar with 🫶',              type: 'avatar',  icon: '🫶', goldPrice: 10,  preview: '🫶', rarity: 'rare'      },
  { id: 'avatar_rock',     title: 'Rock On',        description: 'Replace your avatar with 🤘',              type: 'avatar',  icon: '🤘', goldPrice: 8,   preview: '🤘', rarity: 'rare'      },
  { id: 'avatar_star',     title: 'Star Power',     description: 'Replace your avatar with ⭐',              type: 'avatar',  icon: '⭐', goldPrice: 15,  preview: '⭐', rarity: 'epic'      },
  { id: 'avatar_crown',    title: 'Royal Crown',    description: 'Replace your avatar with 👑',              type: 'avatar',  icon: '👑', goldPrice: 50,  preview: '👑', rarity: 'legendary' },

  // Consumables
  { id: 'rename_card', title: 'Username Rename Card', description: 'One-time use — change your username once per card', type: 'consumable', icon: '🎟️', goldPrice: 150, preview: '', rarity: 'rare' },
];

export function getShopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}

export const RARITY_COLOR = {
  common:    '#A78BFA',
  rare:      '#38BDF8',
  epic:      '#F59E0B',
  legendary: '#F97316',
};
