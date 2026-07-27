# Design

Captured from the live code (`web/src/index.css` `@theme` block + component conventions),
2026-07-03, updated 2026-07-11 (impeccable flagship polish pass ahead of the v1.0.0 beta launch).
This documents the system that EXISTS so changes stay on-brand — update it when the tokens
change, don't let it drift.

## Theme

Dark, purple-committed. The scene: a learner at home, evenings likely, lit mostly by their own
screen, webcam on — a dark UI keeps their video feed (the real focus) the brightest thing on
screen and avoids blasting their face with white light on camera.

## Color

Defined as Tailwind v4 `@theme` tokens in `web/src/index.css`. Use tokens (`text-z-*`, `bg-z-*`),
never raw hex in components, and never raw Tailwind palette classes (`text-red-400`,
`border-green-500`, etc.) for success/error states — always `text-z-green`/`text-z-red`/etc. The
2026-07-11 polish pass found 16 raw-Tailwind-color instances across 5 files (mostly the auth
modals) that had drifted off-token; they broke light-mode contrast since the light theme
redefines `z-red`/`z-green` to different, darker values than Tailwind's own red-400/green-400.
All fixed — don't reintroduce the pattern.

The brand gradient is consolidated into the `bg-gradient-primary` utility class
(`web/src/index.css`, defined via Tailwind v4's `@utility`) — use that class instead of writing
`style={{ background: 'linear-gradient(135deg, ...)' }}` again; 15 call sites across the app had
drifted into two near-duplicate hex pairs before this was extracted.

**Resolved 2026-07-27.** That claim had gone stale — 20 hardcoded `linear-gradient(...)` values had
reappeared across 15 files, all literal hex and therefore all theme-blind. They are now nine
`@utility` classes:

| Utility | Used by | Text it carries |
|---|---|---|
| `bg-gradient-primary` | primary CTA buttons | `text-white` only (unscrimmed) |
| `bg-gradient-teal` | alphabet/basics quiz cards, Warm Up tier | `text-white`, `text-white/80` |
| `bg-gradient-blue` | Speed Challenge entry + Sprint tier | ” |
| `bg-gradient-violet` | practice entry cards, Blitz tier | ” |
| `bg-gradient-amber` | Shop purchase buttons | ” |
| `bg-gradient-ember` | Weak Signs card | ” |
| `bg-gradient-streak` | streak card | ” |
| `bg-gradient-locked` | locked / coming-soon world | ” |
| `bg-gradient-urgent` | Speed timer bar under 40% | no text |
| `text-gradient-brand` | the QuickSign wordmark | (is the text) |

**Gradient text is banned everywhere except the wordmark.** It is decorative rather than
meaningful, so it is confined to the logotype, where decorative *is* the meaning — that is why the
onboarding `h1` and every other heading use solid colour (`OnboardingFlow.tsx:99-101`). This was
already the convention in a component comment; recording it here so it survives. Design linters
will flag `text-gradient-brand` as an anti-pattern hit: that is correct, and it is a known scoped
exception, not a licence to gradient another heading or metric.

**The scrim is baked into the utility, not written at the call site.** Every card used to hand-roll
`<div className="absolute inset-0 bg-black/NN" />`, and those had drifted to /20, /30, /45 and /50
— several below what their own gradient needed, and three cards had none. 45% is the family floor:
what the lightest gradient (amber) needs to carry body text.

**Text on a gradient is white.** `text-white`, or `text-white/80` for a secondary line — never
lower (white/70 fails on teal at 4.28:1 and amber at 3.94:1), and never an accent token. Accent
tokens are derived against the theme surfaces and invert between light and dark; these gradients do
not invert, so a token legible on a dark card is not legible here. `text-z-yellow` on the streak
card measured 1.95:1 in the light theme for exactly this reason.

Data-driven gradients (`WORLDS[].bgGradient`, a unit's own colour) stay in data and get the same
floor at the point of use via `WorldMap`'s `scrimmed()` helper — the data describes what a world
looks like, not how text is made legible on it.

Both rules are enforced by `web/tests/tokenContrast.test.ts` (scrim + stops parsed out of the
shipped CSS, AA asserted per theme) and `web/tests/designTokens.test.ts` (no literal hex in a
component gradient; no undefined `bg-gradient-*` class, which Tailwind would otherwise drop
silently and render as a transparent card with white text on it).

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

The table above lists DARK values. **Light values are not hue-matches of them and must never be
"corrected" into hue-matches** — a dark theme needs light accents to be legible on a near-black
surface, and a light theme needs the same semantic role to be dark. Light values are derived by
holding each colour's OKLCH hue and chroma and lowering lightness only until it clears AA against
`z-bg` (`#E7D9FB`), the darkest of the three light surfaces. Hue-matching is exactly how the
2026-07-27 regression happened: 26 light pairs sat below AA, `z-yellow` (XP) at 1.27:1 and
`z-green` (sign passed) at 2.82:1 — the learner could not read their own result. See QS-009.

`web/tests/tokenContrast.test.ts` now asserts this mechanically for every text token × surface ×
theme, parsing the shipped CSS so it cannot drift from what ships. Change a token, run it, and it
reports the exact ratio. Do not silence it by lightening a surface — that flattens the card/page
separation the light theme deliberately builds.

**Color strategy: committed.** Purple carries identity; orange = streak/energy, teal = XP/
knowledge, semantic green/red for pass/fail coaching. **Rule (2026-07-03, floor corrected
2026-07-27):** any text sitting on a saturated gradient/solid brand background needs an explicit
contrast check — use a scrim rather than lightening the text. The original `bg-black/30` was
tuned against one gradient and does not hold for the lighter ones (teal and amber cards fail even
at full white). The verified floor across the whole card family is **`bg-black/45` +
`text-white/80` minimum** — 4.62:1 worst case. See QS-010.

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
- **Touch targets**: every interactive element needs a real ≥44px hit area, even when its visible
  icon is smaller — use padding or an explicit `w-11 h-11` box around a small icon, not a
  small box around a small icon. The 2026-07-11 polish pass found this violated in 11+ page
  headers (all now the shared `HeaderBackButton`) plus several icon-only list actions
  (Friends remove/report) and PWA-toast buttons; don't regress it on new screens.
- **Page header back/close button**: use `<HeaderBackButton onClick={...} icon="back" | "close" />`
  (`web/src/components/shared/HeaderBackButton.tsx`) — every page header used to hand-roll this
  at 32px, extracted into one shared, correctly-sized component. `icon="back"` (arrow) for
  navigating up a level, `icon="close"` (×) for exiting a focused session
  (lesson/practice/story/speed/multiplayer).
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
(0.05–0.1s). Celebrations: scale + rotate bursts. Ambient (`repeat: Infinity`) loops have grown
past the original streak-fire/"today"-pulse pair to ~22 as features shipped (Zippy idle-breathing,
hover-gated CTAs, etc.) — most are hover-gated and harmless, but keep new always-mounted ambient
loops rare and intentional; they're the kind of thing that quietly adds up (impeccable audit,
2026-07-15). **`prefers-reduced-motion` is handled globally**: `<MotionConfig reducedMotion="user">`
in `main.tsx` covers all framer-motion animations app-wide, and a matching `@media` block in
`index.css` covers the remaining plain-CSS transitions — new framer-motion usage doesn't need its
own reduced-motion handling, it's automatic. (This doc previously listed it as a known gap; that
was stale — confirmed fixed during the 2026-07-11 polish pass.)

## Layout

Single-column mobile-first app shell: `max-w-lg mx-auto px-4`, content pages `pb-24/pb-32` to
clear the fixed BottomNav. Grids only for stat pairs (`grid-cols-2 gap-3`) and the alphabet
(`grid-cols-4`). Camera views: `aspect-video` with mirrored canvas.
