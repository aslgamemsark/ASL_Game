import { getShopItem } from '@/data/shop';
import { getBadge } from '@/data/badges';

interface Props {
  /** The user's equipped avatar shop-item id (may be null/undefined). */
  avatarId?: string | null;
  /** Falls back to the active badge's emoji when no avatar is equipped. */
  badgeId?: string | null;
}

/**
 * Renders the content that goes INSIDE an avatar container (the gradient square used in the top
 * bar, side nav, profile, leaderboard, etc.). If the equipped avatar is image-based (illustrated
 * Zippy art), draws the image filling the container; otherwise falls back to the avatar emoji, then
 * the active badge emoji, then the default 🤟. `rounded-[inherit]` matches the parent's corner
 * radius so no overflow-hidden is needed on the container.
 */
export function AvatarGlyph({ avatarId, badgeId }: Props) {
  const item = avatarId ? getShopItem(avatarId) : null;
  if (item?.image) {
    return (
      <img
        src={item.image}
        alt=""
        draggable={false}
        className="w-full h-full object-cover object-top rounded-[inherit] select-none pointer-events-none"
      />
    );
  }
  const emoji = item?.icon ?? (badgeId ? getBadge(badgeId)?.icon ?? '🤟' : '🤟');
  return <>{emoji}</>;
}
