import { ZIPPY_SRC } from '@/data/zippy';

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
  /** For image-based avatars (e.g. illustrated Zippy art): the picture URL. When set, avatar
   *  render sites draw this image instead of the emoji `icon`. Undefined = emoji avatar. */
  image?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  // Borders — static single-color rings (data-only; the `preview` Tailwind classes render around
  // the player's video in lessons and multiplayer).
  { id: 'border_fire',     title: 'Fire Ring',      description: 'Blazing orange frame for your avatar',     type: 'border',  icon: '🔥', goldPrice: 15,  preview: 'ring-2 ring-orange-500 shadow-orange-500/50 shadow-lg',    rarity: 'common'    },
  { id: 'border_ice',      title: 'Ice Crown',      description: 'Cool blue frost frame',                    type: 'border',  icon: '❄️', goldPrice: 20,  preview: 'ring-2 ring-blue-400 shadow-blue-400/50 shadow-lg',        rarity: 'rare'      },
  { id: 'border_gold',     title: 'Gold Frame',     description: 'Glittering gold border — premium look',    type: 'border',  icon: '✨', goldPrice: 35,  preview: 'ring-2 ring-yellow-400 shadow-yellow-400/50 shadow-lg',    rarity: 'epic'      },
  { id: 'border_rose',     title: 'Rose Gold',      description: 'Soft pink metallic sheen',                 type: 'border',  icon: '🌸', goldPrice: 30,  preview: 'ring-2 ring-pink-400 shadow-pink-400/50 shadow-lg',        rarity: 'rare'      },
  { id: 'border_teal',     title: 'Teal Tide',      description: 'Cool teal frame',                          type: 'border',  icon: '🌊', goldPrice: 18,  preview: 'ring-2 ring-teal-400 shadow-teal-400/50 shadow-lg',        rarity: 'common'    },
  { id: 'border_crimson',  title: 'Crimson Edge',   description: 'Bold red frame',                           type: 'border',  icon: '🍎', goldPrice: 22,  preview: 'ring-2 ring-red-500 shadow-red-500/50 shadow-lg',          rarity: 'rare'      },
  { id: 'border_sky',      title: 'Sky Halo',       description: 'Soft sky-blue frame',                      type: 'border',  icon: '☁️', goldPrice: 18,  preview: 'ring-2 ring-sky-400 shadow-sky-400/50 shadow-lg',          rarity: 'common'    },
  { id: 'border_amber',    title: 'Amber Glow',     description: 'Warm amber frame',                         type: 'border',  icon: '🟡', goldPrice: 24,  preview: 'ring-2 ring-amber-400 shadow-amber-400/50 shadow-lg',      rarity: 'rare'      },

  // Borders — ANIMATED (custom CSS classes in index.css; these actually move, unlike the rings).
  { id: 'border_neon',     title: 'Neon Pulse',     description: 'Electric cyan glow that really pulses',    type: 'border',  icon: '💚', goldPrice: 40,  preview: 'qs-border-electric',  rarity: 'epic'      },
  { id: 'border_inferno',  title: 'Inferno',        description: 'A living, breathing flame ring',           type: 'border',  icon: '🔥', goldPrice: 55,  preview: 'qs-border-inferno',   rarity: 'epic'      },
  { id: 'border_goldpulse',title: 'Golden Aura',    description: 'A pulsing halo of gold',                   type: 'border',  icon: '✨', goldPrice: 45,  preview: 'qs-border-goldpulse', rarity: 'epic'      },
  { id: 'border_emerald',  title: 'Emerald Pulse',  description: 'A living emerald glow',                    type: 'border',  icon: '💎', goldPrice: 42,  preview: 'qs-border-emerald',   rarity: 'epic'      },
  { id: 'border_violet',   title: 'Violet Surge',   description: 'A pulsing violet ring',                    type: 'border',  icon: '🔮', goldPrice: 42,  preview: 'qs-border-violet',    rarity: 'epic'      },
  { id: 'border_rainbow',  title: 'Rainbow Ring',   description: 'Every color, cycling forever',             type: 'border',  icon: '🌈', goldPrice: 75,  preview: 'qs-border-aurora',    rarity: 'legendary' },
  { id: 'border_sunset',   title: 'Sunset Cycle',   description: 'Warm colors drifting forever',             type: 'border',  icon: '🌅', goldPrice: 70,  preview: 'qs-border-sunset',    rarity: 'legendary' },

  // Avatars — illustrated Zippy art (real images, not emoji). Reuses the shipped Zippy expression
  // WebPs, so no new assets are needed.
  { id: 'avatar_zippy_wave',  title: 'Hi Zippy',    description: 'Zippy waving hello',    type: 'avatar', icon: '👋', goldPrice: 20, preview: '', image: ZIPPY_SRC['welcome'],     rarity: 'rare'      },
  { id: 'avatar_zippy_cool',  title: 'Cool Zippy',  description: 'Zippy giving a thumbs up', type: 'avatar', icon: '👍', goldPrice: 25, preview: '', image: ZIPPY_SRC['thumbsup'],  rarity: 'rare'      },
  { id: 'avatar_zippy_proud', title: 'Proud Zippy', description: 'Zippy beaming with pride', type: 'avatar', icon: '🌟', goldPrice: 30, preview: '', image: ZIPPY_SRC['proud'],     rarity: 'epic'      },
  { id: 'avatar_zippy_party', title: 'Party Zippy', description: 'Zippy mid-celebration', type: 'avatar', icon: '🎉', goldPrice: 40, preview: '', image: ZIPPY_SRC['celebrating'], rarity: 'legendary' },

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
  { id: 'streak_protection', title: 'Streak Protection', description: 'Auto-saves your streak the next time you miss too many days', type: 'consumable', icon: '🛡️', goldPrice: 100, preview: '', rarity: 'rare' },
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
