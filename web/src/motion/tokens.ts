/** Shared framer-motion primitives. Audited 2026-07-31: 62 distinct `transition` literals, 25
 *  durations, 11 spring stiffness/damping pairs and 10 `whileTap` scale values were scattered
 *  across 57 files, each a slightly different guess at the same handful of intended feels rather
 *  than 62 deliberate design decisions. These are the values that clustered — new call sites
 *  should reach for one of these before inventing another number. Existing call sites are migrated
 *  as their surrounding component is rebuilt as a design-system primitive (Phase 4b onward), not in
 *  one mass rename — a `transition` object is usually mixed with component-specific delay/repeat
 *  values, so migrating in place here would touch the same 57 files this module is meant to
 *  prevent growing further. */

// Seconds. FAST for micro-interactions (icon hover), BASE for the default entrance/exit fade,
// MODERATE for a card or panel settling into place, SLOW for a deliberately unhurried reveal.
export const DURATION_FAST = 0.2;
export const DURATION_BASE = 0.3;
export const DURATION_MODERATE = 0.4;
export const DURATION_SLOW = 0.6;

// The specific cubic-bezier used for full-screen tab/panel transitions (HomePage's tab switch,
// among others) — matched to framer-motion's default 'easeOut' closely enough that either reads
// as "ease out," but this exact curve is what's already shipping, so it's named rather than
// silently swapped for the built-in keyword.
export const EASE_STANDARD: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

// type: 'spring' configs. DEFAULT is the overwhelming majority case (dialogs, chips, entrances).
// SNAPPY for something that must feel instantaneous (a tap response). BOUNCY for a deliberately
// playful overshoot (celebrations, rewards) — never for structural UI like a dialog or dropdown.
export const SPRING_DEFAULT = { type: 'spring' as const, stiffness: 300, damping: 25 };
export const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 500, damping: 30 };
export const SPRING_BOUNCY = { type: 'spring' as const, stiffness: 260, damping: 12 };

// whileTap scale. DEFAULT covers the large majority of buttons/chips (0.97 was already used at
// 40 of 74 call sites). FIRM is for a deliberately weightier press (a primary CTA, a destructive
// confirm) where a slightly bigger dip reads as "this did something."
export const TAP_SCALE_DEFAULT = 0.97;
export const TAP_SCALE_FIRM = 0.94;

// whileHover scale for a button-shaped element's hover lift. 1.03 and 1.02 were both in use for
// the same visual intent (imperceptibly different at these magnitudes) — one value, not two.
export const HOVER_SCALE_DEFAULT = 1.03;
