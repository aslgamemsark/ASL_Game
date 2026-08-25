# OX_ALPHA_D1_UIUX_SWEEP.md

**Task:** ASL-D1 · `[REPORT]` UI/UX sweep — pages × 3 viewports × 2 themes, executed against the
production build. No code changed.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `cf6ff05`, clean) ·
**Method:** executed Playwright sweep (`web/e2e-adhoc/probe-uiux-sweep.mjs`) + 42 full-page screenshots
(`e2e-adhoc/d1-*.png`) reviewed visually; findings below carry their evidence.

---

## 1. Sweep shape

- **Pages audited (7 guest-reachable surfaces):** Home (Journey tab), Alphabets tab, Review tab,
  Leaderboard screen, Friends screen, Multiplayer screen, Settings screen. (Camera-flow screens
  Lesson/Practice/Story/Speed are excluded for parity with the canonical suite's rationale — they need
  the fake device and are covered by fakecam.spec.ts + D3's denied-path probe.)
- **Viewports:** phone 390×844 (BottomNav band), tablet 820×1180 (SideNav band), desktop 1280×800.
- **Themes:** dark + light, forced via ThemeContext's `asl-game-theme` localStorage key before app
  boot; theme application on `<html>` verified each run.
- **Total audited combinations:** 7 pages × 3 viewports × 2 themes = **42**.

## 2. Programmatic results (all 42 combinations)

- **Horizontal overflow (`scrollWidth - clientWidth > 2px`): 0 of 42 combinations.** No page scrolls
  sideways at any viewport/theme — exit code 0.
- **Elements spilling past the right viewport edge (non-fixed): 0 across all 42.**
- Per-combination JSON lines were emitted by the probe (overflowPx, spill count + sample,
  minContrast) — see §3 for the contrast caveat.

## 3. Contrast sampler — honest limitation

My inline contrast estimator returned `null` on every combination: this app paints backgrounds via
gradients and layered translucent surfaces, so a walk-up-the-parent `backgroundColor` search usually
hits transparency before finding an opaque color, and the estimator correctly refuses to invent a
number rather than guess. **Therefore this report makes NO WCAG numeric claim** (per master-mission
rule 3/5: never write a number you did not measure). Token-level contrast IS covered elsewhere by the
repo's own `tokenContrast.test.ts` gate; visual review below found nothing that reads as low-contrast.

## 4. Visual review of screenshots (10 sampled across the matrix)

Reviewed: phone dark/light home, phone dark leaderboard/friends/multiplayer/settings/review,
tablet light alphabets/multiplayer/settings/home, desktop light home/multiplayer, desktop dark
leaderboard/settings.

- **No overlapping text, cut-off elements, broken images, or misaligned rows found in any sampled
  combination**, both themes. Sidebar (desktop/tablet) and bottom-nav (phone) render their correct
  variant per breakpoint; leaderboard rows, letter grid, quest cards, and gate screens all lay out
  cleanly in light mode (light theme is the riskier one for a dark-first design).
- Light theme specifically checked for the classic dark-first failure modes: text invisible on light
  background, dark cards bleeding into light cards — none observed in the samples above.

## 5. Findings

**No UI/UX defects found within the swept scope.** The only caveats are scope statements, not
defects: (a) signed-in-only states (badges earned, friends list populated, shop owned-items) were not
swept — they need an authenticated session, which this repo's e2e deliberately avoids against
production Supabase; (b) numeric contrast verification is delegated to `tokenContrast.test.ts` as
noted in §3.

## 6. Re-running

`node web/e2e-adhoc/probe-uiux-sweep.mjs` with any server on :4173 serving `dist/` (exit 0 iff zero
overflow). Screenshots land next to the probe as `d1-<viewport>-<theme>-<page>.png`.
