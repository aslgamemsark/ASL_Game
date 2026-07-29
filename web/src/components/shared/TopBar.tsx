import { useLayoutEffect, useRef, useState } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import { useShallow } from 'zustand/react/shallow';
import { getShopItem } from '@/data/shop';
import { AvatarGlyph } from '@/components/shared/AvatarGlyph';
import { motion } from 'framer-motion';

const fireVariants = {
  rest: { rotate: 0, x: 0, scale: 1, filter: 'brightness(1) drop-shadow(0 0 0px rgba(249,115,22,0))', transition: { duration: 0.3, ease: 'easeOut' as const } },
  blaze: {
    rotate: [0, -4, 3, -3, 2, 0],
    x:      [0, -1.5, 1, -1, 0.5, 0],
    scale:  [1, 1.09, 1.04, 1.11, 1.05, 1],
    filter: [
      'brightness(1)    drop-shadow(0 0px 0px rgba(249,115,22,0))',
      'brightness(1.25) drop-shadow(0 -3px 8px rgba(249,115,22,0.7))',
      'brightness(1.3)  drop-shadow(0 -4px 10px rgba(249,115,22,0.8))',
      'brightness(1)    drop-shadow(0 0px 0px rgba(249,115,22,0))',
    ],
    transition: { duration: 1.9, repeat: Infinity, ease: 'easeInOut' as const },
  },
};

interface TopBarProps {
  onOpenShop?: () => void;
  onOpenProfile?: () => void;
  /** What the profile chip actually does for the current user — "Sign in" for a guest (it opens
   *  the auth modal), "My Profile" once signed in. On desktop this same distinction already exists
   *  as separate labeled items in SideNav ("Sign in" vs "View profile"); on mobile the chip is the
   *  ONLY entry point, so it needs the same distinction to give guests an accessible "Sign in"
   *  control at all — its title/aria-label used to be hardcoded to "My Profile" regardless of auth
   *  state, silently mislabeling the one guest sign-in affordance mobile has (found via e2e run on
   *  mobile viewports, 2026-07-28 — smoke.spec.ts's `getByRole('button', {name: /sign in/i})` had
   *  never run below the `lg` breakpoint before). Defaults to "My Profile" for any caller that
   *  doesn't pass it, matching the previous hardcoded behavior. */
  profileLabel?: string;
}

export function TopBar({ onOpenShop, onOpenProfile, profileLabel = 'My Profile' }: TopBarProps = {}) {
  // Selector + useShallow: TopBar is always mounted, so subscribing to the whole store (the
  // previous `useUserStore()` with no selector) re-rendered it on every unrelated field change
  // too — e.g. an XP tick during a lesson (production audit, 2026-07-12).
  const { streak, signs, gold, activeBadge, equippedAvatar, equippedBorder } = useUserStore(
    useShallow((s) => ({
      streak: s.streak, signs: s.signs, gold: s.gold,
      activeBadge: s.activeBadge, equippedAvatar: s.equippedAvatar, equippedBorder: s.equippedBorder,
    }))
  );
  const borderClasses = equippedBorder ? (getShopItem(equippedBorder)?.preview ?? '') : '';

  // The gold pill's width varies with its digit count, so a fixed CSS offset can't keep the cart
  // button centered under it — measure the pill's actual center relative to the header and
  // position the button there. Re-measures whenever the pill's size changes (digit count,
  // viewport width, font load), not just once on mount.
  const goldRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [cartCenter, setCartCenter] = useState<number | null>(null);

  useLayoutEffect(() => {
    const goldEl = goldRef.current;
    const headerEl = headerRef.current;
    if (!goldEl || !headerEl) return;
    const measure = () => {
      const goldRect = goldEl.getBoundingClientRect();
      const headerRect = headerEl.getBoundingClientRect();
      setCartCenter(goldRect.left - headerRect.left + goldRect.width / 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(goldEl);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  return (
    <div className="sticky top-0 z-50 bg-z-bg/90 backdrop-blur-md border-b border-z-purple-deep/50 pt-safe">
      {/* `relative` anchors the cart button below — it's placed at top-full, i.e. right past this
          header's own bottom border (the divider), under the gold pill's column. */}
      <div ref={headerRef} className="relative max-w-lg mx-auto lg:max-w-none">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <motion.button
              onClick={onOpenProfile}
              className="w-11 h-11 flex items-center justify-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-z-purple-light focus-visible:ring-offset-2 focus-visible:ring-offset-z-bg rounded-xl"
              whileTap={{ scale: 0.9 }}
              aria-label={profileLabel}
              title={profileLabel}
            >
              <motion.span
                className={`w-8 h-8 rounded-xl overflow-hidden bg-gradient-to-br from-z-purple to-z-purple-deep flex items-center justify-center text-lg ${borderClasses}`}
                whileHover={{ rotate: [0, -12, 12, -8, 0], scale: 1.08, transition: { duration: 0.45 } }}
              >
                <AvatarGlyph avatarId={equippedAvatar} badgeId={activeBadge} />
              </motion.span>
            </motion.button>
            <span
              className="font-bold text-xl tracking-tight lg:hidden text-gradient-brand"
            >QuickSign</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Streak */}
            <motion.div
              className="flex items-center gap-1 bg-z-surface/60 rounded-full px-2.5 py-1 cursor-default"
              initial="rest"
              whileHover="blaze"
              whileTap={{ scale: 0.92 }}
              variants={{
                rest:  { scale: 1, backgroundColor: 'rgba(34, 21, 72, 0.6)' },
                blaze: { scale: 1.1, backgroundColor: 'rgba(249, 115, 22, 0.16)', transition: { duration: 0.2 } },
              }}
            >
              <motion.span className="text-sm inline-block" variants={fireVariants}>🔥</motion.span>
              <span className="font-bold text-xs text-z-orange">{streak}</span>
            </motion.div>

            {/* Signs 🤟 */}
            <motion.div
              className="flex items-center gap-1 bg-z-surface/60 rounded-full px-2.5 py-1 cursor-default"
              whileHover={{ scale: 1.08, backgroundColor: 'rgba(124, 58, 237, 0.18)', transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.92 }}
            >
              <span className="text-sm">🤟</span>
              <span className="font-bold text-xs text-z-purple-light">{signs}</span>
            </motion.div>

            {/* Gold 🪙 — plain display; the shop entry point is the cart button below (see the
                absolutely-positioned button after this row), not the pill itself. */}
            <div ref={goldRef} className="flex items-center gap-1 bg-z-surface/60 rounded-full px-2.5 py-1 cursor-default">
              <span className="text-sm">🪙</span>
              <span className="font-bold text-xs text-z-yellow">{gold}</span>
            </div>
          </div>
        </div>

        {/* Shop entry point — a cart icon anchored just below the header's divider (its bottom
            border), horizontally centered under the gold pill via the measured `cartCenter`
            (a fixed right-N offset can't do this since the pill's width changes with its digit
            count). `top-full` places it right past that border. Centering/offset use framer's
            own x/y motion props (not a raw `transform` string) so they compose correctly with
            whileHover's `scale` instead of one clobbering the other. Hidden (opacity 0) until
            the first measurement lands, to avoid a flash in the wrong spot. */}
        <motion.button
          aria-label="Open shop"
          title="Shop"
          onClick={onOpenShop}
          style={{
            left: cartCenter ?? 0,
            x: '-50%',
            y: 8,
            opacity: cartCenter === null ? 0 : 1,
          }}
          className="absolute top-full w-11 h-11 rounded-full bg-z-surface border border-z-yellow/30 shadow-lg flex items-center justify-center text-z-yellow"
          whileHover={{ scale: 1.12, backgroundColor: 'rgba(250, 204, 21, 0.16)', transition: { duration: 0.15 } }}
          whileTap={{ scale: 0.9 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
