# PROJECT_MEMORY.md — QuickSign single source of truth

> Read this before starting any task. Update it whenever an architecture decision, launch choice,
> analytics change, infra change, known issue, TODO, or lesson-learned lands. Newest facts win;
> convert relative dates to absolute. This is the human-readable index; code + `docs/` hold detail.

_Last updated: 2026-07-20._

## 1. What QuickSign is
Gamified ASL-learning web app. Camera-based, **on-device** sign recognition (MediaPipe Tasks +
rule verifier + veto-only ML classifier). React 19 + Vite + TypeScript SPA, Supabase (auth/DB/
realtime), PostHog analytics. Two-person student team (Saad + ARKhan). Preparing a **Reddit open
beta**. Live at https://aslgame.vercel.app (production branch = `main`, auto-deploys on push).

## 2. Architecture decisions (do not relitigate)
- **Recognition is client-side.** No video or landmarks stream to a server for recognition. Rule
  engine is source of truth; the Bi-GRU classifier is **veto-only** (never turns a fail into a pass).
- **Five-parameter sign model**, movement validated over a rolling ~1.5–2s window (never one frame).
- **Multiplayer = P2P WebRTC + Supabase Realtime signaling**, no game server. ICE config is
  env-driven (`web/src/config/iceServers.ts`); free OpenRelay TURN is the $0 default; swapping to a
  paid provider is an env change only. See `docs/MULTIPLAYER_RUNBOOK.md`.
- **Analytics is centralized** in `web/src/analytics/` — `track()` in `capture.ts` is the ONLY
  sanctioned PostHog surface (enforced by a test). Privacy-first: no session replay, no autocapture,
  anonymous-until-identify, DNT respected, Settings opt-out. Landmarks/video NEVER sent to PostHog.
- **Camera/landmark data belongs in Supabase**, not PostHog (biometric; own infra; retention rules).
  500MB Postgres cap is guarded by a pg_cron trim of `training_samples`; bulk data → Supabase
  Storage / object store, not the analytics stream.

## 3. Infrastructure
- **Vercel** project `asl-game` (team `aslgamemsark-7554`). Prod branch `main`. **Only push to
  `main` deploys to prod — nobody use the Promote button** (it silently reverted prod twice on
  2026-07-20 when both devs promoted different branch builds).
- **Supabase** project `juzqilqilxzmudazltjx` (ap-northeast-1, Postgres 17). RLS on all 13 tables.
  Likely Free tier → ~1-day backup retention; `supabase/migrations/` is the restorable schema
  backup (kept complete as of 2026-07-20).
- **PostHog** org "QuickSign", project 518794 (US). Key is a public write-only token (safe to ship).
  Prod env vars `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST` were added 2026-07-20; analytics verified
  live (events arriving tagged `deployment_environment=production`).

## 4. Analytics taxonomy (see `docs/analytics/` + `web/src/analytics/`)
~42 ACTIVE events across auth/onboarding/camera/AI/lessons/sign_attempt/multiplayer/economy/
feedback/crashes, plus `multiplayer_ice_connected`/`_failed` (added 2026-07-20 to answer "do we
need paid TURN?"). Session super-props: app_version, git_commit, deployment_environment. Group:
`beta_cohort`. Kill-switch flags: disable_camera/classifier/multiplayer/shop/review.

## 5. Launch strategy (see `docs/LAUNCH_STRATEGY.md` — authoritative)
- **North-star for launch:** NOT upvotes — **number of users who complete their first lesson AND
  return day 2.** Optimize the funnel for that.
- Funnel: Reddit → landing page → app → guest → camera → onboarding → first lesson → first correct
  sign → lesson complete → (optional signup) → Day-2 return.
- Guest-first (no forced signup). Advertise privacy ("camera never leaves your browser") + the
  real-time feedback differentiator. Multiplayer is a bonus, not the headline (free TURN risk).

## 6. Known issues / risks
- **Free TURN (OpenRelay)** will fail for some mobile users under load — measured via ICE analytics;
  provision paid TURN only if `used_relay` is high post-launch. (Elephant, managed not solved.)
- In-app-browser banner + multiplayer recovery: unit-tested + build-clean but **not yet validated on
  a real phone via a real Reddit tap-through** (manual, real-device check owed before/at launch).
- `error_captured` event type declared but not yet wired to Supabase/network failure sites.
- Only 1 of 8 designed PostHog dashboards built live; 7 fully specced in `docs/analytics/`.
- Supabase advisor: "Leaked Password Protection" disabled (free toggle, do it).

## 7. Open TODOs (post-launch unless noted)
- [ ] Real-phone + 2-device manual launch checks (BEFORE launch).
- [ ] Enable Supabase leaked-password protection.
- [ ] Build remaining PostHog dashboards/funnels/retention (see `docs/POSTHOG_GUIDE.md`).
- [ ] Wire `error_captured` at Supabase/network failure points.
- [ ] Decide paid TURN from launch `used_relay` data.
- [ ] Monetization roadmap (free/premium/teacher/school) — design only, see LAUNCH_STRATEGY.

## 8. Lessons learned
- `tsc --noEmit` misses errors in this solution-style tsconfig — the authoritative check is
  `tsc -b` (what `npm run build` runs). Always gate on `tsc -b`.
- Vitest only discovers `**/tests/**/*.test.ts` — put tests in a `tests/` subdir.
- Two people pushing/promoting to the same Vercel prod caused silent overwrites — main-only deploys.
