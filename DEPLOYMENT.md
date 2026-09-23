# Deployment

## Canonical production

**`https://quicksignn.vercel.app`** is canonical. The old `aslgame.vercel.app` alias was removed at the owner's request during the September 2026 audit. Do not recreate it or assume the former redirect still exists.

## Vercel projects (as of 2026-08-30 — verify current state before assuming this is still accurate)

| Project | Account/Team | Root Directory | Status |
|---|---|---|---|
| `asl-game` | `aslgamemsark-7554s` | `web` | ✅ Green, deploys canonical domain |
| `signup-asl` | `abdurrafaykhan04-6636s` | `web` | ✅ Green, but serves an **older bundle** at `signup-asl.vercel.app` — a second live public copy of the product on stale code. Owner decision needed: point it at canonical, or pause its auto-deploy. Not destructive to leave as-is short-term. |
| `asl_game1` | `msaad9632` (third-party account, no access) | repo root (not `web`) | ❌ Was failing — likely because Vercel's zero-config detection saw the root `requirements.txt` with no root `vercel.json` and treated the repo as a Python project. A root `vercel.json` now exists (see below) as an in-repo fix for this. |

**Better fix for `asl_game1` than the root `vercel.json` alone**: add msaad9632 as a **Member** on the canonical Vercel team, so their PRs get real Preview Deployments through the actual `web`-rooted project instead of a separate, misconfigured root-rooted one. This requires dashboard access only the project owner has — **action item for you**, not something I can do.

## Config: two `vercel.json` files, by design

- `web/vercel.json` — what the canonical (`web`-rooted) project actually reads. The real source of CSP headers, rewrites, build config.
- `/vercel.json` (repo root) — exists **only** so a project rooted at the repo root (like `asl_game1`) builds correctly instead of Vercel's zero-config Python misdetection. It is inert for the canonical project — Vercel resolves `vercel.json` inside a project's own Root Directory, confirmed by this repo's own history (a root file with different values coexisted for ~4 weeks in July 2026 with zero production effect).
- **These two files must stay in sync** (headers/rewrites identical) — `web/tests/vercelConfigParity.test.ts` enforces this as a real, running test (part of `npm run test` in `web/`), not a manual reminder. If you ever intentionally diverge them, update that test's expectations deliberately.

## Environment variables

Required for the app to function with auth/sync:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — from the Supabase project dashboard (Settings → API). The **anon/public key** only — never a `sb_secret_*` key or a personal access token in any `VITE_`-prefixed variable; those get bundled straight into client-side JS shipped to every browser.

Optional, safe to leave blank:
- `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` — analytics no-ops without a key.
- `VITE_STUN_URLS` / `VITE_TURN_*` — multiplayer WebRTC falls back to the free-tier default (Google STUN + OpenRelay TURN) if unset.

`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` **must both be truthy or both effectively absent** — as of this audit, `web/src/lib/supabase.ts` correctly falls back to a placeholder client on empty-string or missing values (fixed 2026-08-30, was previously vulnerable to a blank-but-defined value white-screening the app via `createClient('')` throwing).

## Deploying

Push to `main` — Vercel auto-deploys. There is no manual deploy step for the canonical project.

**Database migrations:** this repository has no `db:backup` or `db:migrate:deploy` npm scripts and does not use Prisma. Before changing production, verify the target project and a usable backup/restore path, review the exact SQL, and replay the migration against a disposable local Supabase database. Apply only the reviewed migration through Supabase's migration tooling after the release checks pass; never reset the production database or blindly push all pending local migrations.

Prefer additive migrations so older browser tabs remain compatible. The pending `20260920000051_secure_multiplayer_membership.sql` deliberately revokes the unsafe legacy join RPC and introduces `join_multiplayer_room_v2`; release it together with its matching client. Older tabs will need a refresh to join rooms. This security change is not a zero-downtime compatibility guarantee. The migration has not been applied to production.

**Verified production database (2026-09-21):** the public QuickSign bundle points to `juzqilqilxzmudazltjx`, named **ARKhan8604's Project**, in the **QuickSign** organization. Recheck the deployed bundle and dashboard before a database mutation; a similar project name is insufficient.

## CI

`.github/workflows/ci.yml` runs on PR and push to `main`, gated on paths (`web/**`, `core/**`, `signs/**`, `tests/**`, `supabase/**`, `requirements.txt`, and — since 2026-08-30 — `.github/workflows/**` itself, so CI changes actually trigger CI). Four jobs:

- `web` — lint, unit tests (`vitest`), `tsc -b`, production build. Runs on both PR and push.
- `e2e` — Playwright, **deliberately Supabase-unconfigured** (matches CI's real environment; do not add placeholder Supabase env vars here — see the job's own comment in `ci.yml` for why that makes things worse, not better). PR-only.
- `multiplayer` — Playwright against a local Supabase stack (`supabase start`), its own env from `playwright.multiplayer.config.ts`. PR-only.
- `python` — pytest against the Python prototype engine (`core/`/`signs/`/`tests/`). Runs on both PR and push. **This does not gate the web app** — see the Python-vs-TS correction in `README.md`/`ARCHITECTURE.md`/`AGENTS.md`/`CLAUDE.md` (fixed 2026-08-30): `web/src/engine/` is what ships, `core/` is the design reference.
- `audit.yml` (separate workflow) — `npm audit`, runs on a schedule (Monday), not per-commit — a new advisory on an unchanged dependency must not redden every build.

Node is pinned to `>=22.12.0` (`web/package.json`'s `engines` field, matched by `setup-node` in both `ci.yml` and `audit.yml`) — required by `@supabase/realtime-js`'s native WebSocket dependency.

## Rollback

No automated rollback tooling exists. For a frontend-only regression, use Vercel → the canonical project → Deployments → the last known-good deployment → "Promote to Production." First verify that its client still matches the deployed database API. In particular, rolling back the v2 multiplayer client alone after revoking the legacy RPC breaks joining. Prefer a tested forward fix that preserves the security restrictions. Database restore requires a verified backup and an explicit recovery plan; it can discard writes made since that backup. Do not treat restore as a routine deployment rollback.

## Known production issues fixed this session (2026-08-30)

- Classifier model 404 (build was deleting `dist/models/signs` while the load flag was on) — fixed by disabling the load flag (`CLASSIFIER_LOAD_ENABLED = false`) rather than shipping the known out-of-distribution model.
- `web/src/lib/supabase.ts`'s `??` vs `||` bug (see Environment variables above).
- `FeedbackModal.tsx` reading a `VITE_APP_VERSION` env var that was never defined anywhere — always evaluated to `null`. Fixed to read the real `__APP_VERSION__` build-time global.

See `HANDOFF.md` for the full list of this session's commits and open items.
