# Workstream G — Design system + impeccable-driven polish (2026-07-03, third round)

**Status: done.** Triggered by the user's honest question ("would you have done anything
differently? I need better UI") — the answer was yes: previous rounds only used `impeccable`'s
*linter*, never its actual design workflow. This round ran that workflow properly.

## Foundation written (the part every future design task reads first)
- **`PRODUCT.md`** (repo root) — register: product. Audience confirmed with the user: **all ages /
  general learners** (playful but not childish). Brand direction confirmed: **keep the purple/teal
  Zippy palette, refine execution** — evolution, not rebrand. Encodes the app's real design
  principles ("coach, don't judge", "the camera is the hero", "celebrate deliberately") and the
  accessibility floor (WCAG AA; never gate anything on audio — the audience overlaps with the
  Deaf/HoH community).
- **`DESIGN.md`** (repo root) — the visual system as it actually exists, captured from
  `web/src/index.css`'s `@theme` tokens + observed component conventions. Documents the
  scrim-over-gradient contrast rule from the earlier fixes so it doesn't regress.

`impeccable`'s commands all read these two files before doing work — they were the missing
prerequisite (`context.mjs` reported `NO_PRODUCT_MD`) that previous rounds skipped.

## Polish items shipped (each one a named checklist failure, not vibes)
1. **Global reduced-motion support** — `<MotionConfig reducedMotion="user">` wrapping the app in
   `main.tsx` (one line covers every framer-motion animation) + a CSS
   `@media (prefers-reduced-motion: reduce)` fallback in `index.css` for plain-CSS transitions.
   Closes the gap PRODUCT.md itself flags.
2. **Visible keyboard focus** — global `:focus-visible` purple ring in `index.css`; previously
   keyboard focus was completely invisible app-wide.
3. **Heading text-wrap** — `balance` on h1–h3, `pretty` on prose.
4. **Gradient-text reduction** — `OnboardingFlow`'s "Welcome to SignUp" h1 de-gradiented to solid
   white + purple-light span. The `TopBar` wordmark is kept as the app's **single deliberate**
   gradient-text brand mark (one use = voice; two+ = the AI tell impeccable bans).
5. **TopBar shop pill** — was a `motion.div` with onClick: not keyboard-reachable, not announced
   as a control, ~28px tall. Now a real `<button>` with `aria-label` and a pseudo-element hit-area
   expansion to ~48px effective (visual size unchanged — the topbar doesn't get chunky).
6. **`aria-current="page"`** on the active `BottomNav` tab.

All verified live in `npm run preview` (built CSS rules confirmed present via CSSOM inspection;
button/hit-area/aria checked via DOM queries; zero console errors) — not just "tests pass."

## Judgment calls
- Kept `whileHover` decorative animations (product register says motion conveys state, not
  decoration — but these are the app's established personality per PRODUCT.md; tightening them
  app-wide is a `quieter` pass for another day, not this one).
- Did NOT touch the "DAILY QUESTS" uppercase-tracked section label — it's one instance in an app
  shell (standard product-UI section labeling), not the every-section eyebrow scaffold the ban
  targets.
- A false-alarm during review: `PracticeTab`'s `bg-z-orange/10` looked like a `\10` typo in grep
  output — reading the actual file showed it was fine. Checked before "fixing".
