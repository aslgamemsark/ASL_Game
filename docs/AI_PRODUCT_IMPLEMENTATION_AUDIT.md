# QuickSign Product Trust Implementation Audit

## Baseline — 2026-08-31

- Working branch: `codex/quicksign-product-trust`, created from `6829bda`.
- Production origin: `https://quicksignn.vercel.app`.
- `origin/main` has eight commits absent from this branch. They overlap camera preview pacing,
  adaptive recognition pacing, and recovery code; a merge would conflict in recognition, camera,
  progress, verifier, authentication, and camera pages. They are not merged or cherry-picked.
- Existing untracked recognition-outcome files and ad-hoc probes are preserved untouched. Their
  vocabulary is useful, but their quality thresholds are not yet calibrated from valid fixtures.

## Batch 0 — Release Source of Truth

- Updated canonical, Open Graph, Twitter, schema, sitemap, robots, static-page, production-test,
  and onboarding documentation URLs to `quicksignn.vercel.app`.
- Added one application `main` landmark around active screen content.
- Hid the Profile Explore cards at `md` and above. Phone navigation remains unchanged; the SideNav
  reaches Leaderboard, Friends, Multiplayer, and Settings, while the TopBar reaches Shop.
- Added focused Playwright checks for one `main` landmark and desktop navigation parity.

### Evidence

- `npm run build` passed on 2026-08-31.
- Focused Chromium Playwright checks passed: desktop Explore visibility/navigation and one main
  landmark.
- Vercel deployment-to-commit mapping remains unverified locally; see `HUMAN_ACTIONS.md`.

## Deferred Until Calibrated

- No quality threshold becomes punitive until every existing valid fixture stays scorable and the
  corresponding degraded fixture is rejected.
- No Face Landmarker/NMM quality gate is added: no current canonical sign requires NMM scoring.
