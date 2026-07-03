# Design

Captured from the live code (`web/src/index.css` `@theme` block + component conventions),
2026-07-03. This documents the system that EXISTS so changes stay on-brand — update it when the
tokens change, don't let it drift.

## Theme

Dark, purple-committed. The scene: a learner at home, evenings likely, lit mostly by their own
screen, webcam on — a dark UI keeps their video feed (the real focus) the brightest thing on
screen and avoids blasting their face with white light on camera.

## Color

Defined as Tailwind v4 `@theme` tokens in `web/src/index.css`. Use tokens (`text-z-*`, `bg-z-*`),
never raw hex in components — exceptions currently exist as inline gradients and should shrink
over time, not grow.

| Role | Token | Value |
|---|---|---|
| Brand / primary | `--color-z-purple` | `#7C3AED` |
| Brand dark / deep | `--color-z-purple-dark` / `-deep` | `#5B21B6` / `#2D1464` |
| Brand light / glow | `--color-z-purple-light` / `-glow` | `#A78BFA` / `#C4B5FD` |
| Energy / streak (accent) | `--color-z-orange` (+`-dark`, `-bright`) | `#F97316` |
| Knowledge / XP (accent) | `--color-z-teal` (+`-dark`, `-light`) | `#14B8A6` |
| XP text (aliased) | `--color-z-yellow` → teal-light | `#5EEAD4` |
| Success / error / info | `--color-z-green` / `-red` / `-blue` | `#34D399` / `#EF4444` / `#60A5FA` |
| Ink (body text) | `--color-z-gray-50` | `#F5F3FF` |
| Muted text ramp | `--color-z-gray-200/300/400` | `#D4CCEF` / `#A89BB5` / `#7C6F8A` |
| Page background | `--color-z-bg` | `#0D0A1E` |
| Card / surface / hover | `--color-z-card` / `-surface` / `-surface-hover` | `#18103A` / `#221548` / `#2D1B5C` |

**Color strategy: committed.** Purple carries identity; orange = streak/energy, teal = XP/
knowledge, semantic green/red for pass/fail coaching. **Rule (2026-07-03):** any text sitting on
a saturated gradient/solid brand background needs an explicit contrast check — two WCAG failures
were fixed with `bg-black/30` scrims (PracticeTab story card, SpeedChallenge tier cards); reuse
that scrim technique rather than lightening text.

## Typography

- Single family: **Quicksand** (300–700 variable), self-hosted via `@font-face` from Google's CDN.
  Rounded geometric sans — carries the friendly personality on its own; no second family.
- Hierarchy in practice: page titles `text-2xl font-bold tracking-tight`, section headers
  `text-sm uppercase tracking-widest text-z-gray-300`, card titles `text-lg font-bold`, body
  `text-sm`, metadata `text-xs` / `text-[11px] text-z-gray-400`.
- Numbers that update (XP, scores, timers): add `tabular-nums`.

## Components & patterns

- **Cards**: `bg-z-card border border-white/5 rounded-2xl p-4/p-5`. Hero/gradient cards get
  `rounded-3xl`. No nested cards.
- **Buttons/taps**: framer-motion `whileTap={{ scale: 0.9–0.97 }}` everywhere; hover effects are
  decorative only (touch-first).
- **Navigation**: sticky `TopBar` (streak/signs/gold pills) + fixed `BottomNav` (4 tabs), both
  `bg-z-bg/90 backdrop-blur-md` with a `border-z-purple-deep` hairline.
- **Progress bars**: `h-1.5`–`h-2.5`, track `bg-white/10–15`, fill = role gradient or `bg-white/65`
  on colored cards, animated width via framer-motion.
- **Overlays during recognition**: per-parameter checklist (`ParameterChecklist`) with
  green/amber state per parameter + a one-line coaching hint — this is the signature UI; keep it
  glanceable from arm's length.
- **Celebration**: `canvas-confetti` + synthesized Web Audio cues (`useSounds`) on pass/level-up —
  reserved for real wins per PRODUCT.md principle 3.

## Motion

framer-motion throughout. Entrances: small `opacity/y` fades with per-item stagger delays
(0.05–0.1s). Celebrations: scale + rotate bursts. Ambient loops exist only on streak-fire and
"today" pulse. **Known gap:** no `prefers-reduced-motion` handling yet — every new animation
should degrade, and a global fix is a welcome contribution.

## Layout

Single-column mobile-first app shell: `max-w-lg mx-auto px-4`, content pages `pb-24/pb-32` to
clear the fixed BottomNav. Grids only for stat pairs (`grid-cols-2 gap-3`) and the alphabet
(`grid-cols-4`). Camera views: `aspect-video` with mirrored canvas.
