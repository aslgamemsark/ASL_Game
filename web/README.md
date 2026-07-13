# Segno — web app

The React/TypeScript/Vite port of ASL_Game. Same five-parameter recognition schema and
confusor-test discipline as the Python prototype in the repo root (see [../README.md](../README.md)
and [../CLAUDE.md](../CLAUDE.md)), running client-side in the browser via `@mediapipe/tasks-vision`,
with an optional trained TF.js classifier as a **veto-only** disambiguation layer on top of the
same rule-based checks — never a replacement for them.

Backend is [Supabase](https://supabase.com) (Postgres + Row Level Security + a handful of
`SECURITY DEFINER` RPCs for admin actions) — there is no custom server; the app talks to Supabase
directly from the browser via the anon key, which is safe to expose by design (RLS is the real
access boundary, not the key).

## Setup

1. **Node 20+** and npm.
2. Install dependencies:
   ```bash
   npm install
   ```
3. **Supabase project.** You need your own Supabase project (free tier is fine) unless you already
   have access to the team's:
   - Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
   - In the SQL Editor, run `../supabase/schema.sql` once, then every file under
     `../supabase/migrations/` **in filename order** — the schema file is the from-scratch
     baseline, migrations bring it to the current production shape. See that directory's own
     history for what each migration fixes.
   - Copy `.env.example` to `.env.local` and fill in your project's URL + anon key (Dashboard →
     Settings → API):
     ```bash
     cp .env.example .env.local
     ```
   Running without a configured Supabase project still works for local UI/recognition
   development — auth, sync, leaderboards, and social features just no-op (`supabaseReady` gates
   every Supabase call in the app).
4. **MediaPipe model files.** Downloaded automatically from Google's CDN at runtime on first
   camera use — no manual download step for the web app (unlike the Python prototype, which
   requires a one-time local download; see `../models/README.md`).

## Running

```bash
npm run dev       # dev server with HMR, http://localhost:5173
npm run build     # typecheck (tsc -b) + production build to dist/
npm run preview   # serve the production build locally
```

The ML classifier (`src/config/classifier.ts`, `src/hooks/useClassifier.ts`) loads the same way
under `npm run dev` and `npm run preview` — it's a fetch of `/models/signs/*` at runtime, not
build-mode-gated. It quietly no-ops (`status: 'disabled'`, rule verifier only) if those files
aren't reachable, so either command works for testing it as long as `public/models/signs/` is
present. Set `CLASSIFIER_DEBUG` in `src/config/classifier.ts` to see per-attempt gate decisions
logged to the console (statically stripped from production builds via `import.meta.env.DEV`).

## Testing and linting

```bash
npm run test       # vitest — unit tests (engine/avatar/classifier logic)
npm run test:e2e   # playwright — real-browser smoke tests (e2e/)
npm run lint        # oxlint
npm run audit       # npm audit --audit-level=high (dependency vulnerabilities)
```

`npm run test:e2e` needs the browser binary once: `npx playwright install chromium`. It builds
the app and runs it via `npm run preview` (playwright.config.ts's `webServer`), then drives it in
a real Chromium — currently onboarding-as-guest through to Home, plus the sign-in modal's
Escape/aria-modal behavior (see `e2e/smoke.spec.ts`). Deliberately scoped to what's reachable
without a real camera device; camera-dependent flows (lesson/practice recognition) would need a
fake video device feed and are a separate, larger effort.

All four (`test`, `test:e2e`, `lint`, `audit` — plus `build`) run in CI
(`../.github/workflows/ci.yml`) as separate jobs on every PR and push to `main` that touches
`web/**` (a separate CI job covers the Python side for changes to `core/`/`signs/`/`tests/`).

## Project structure

```
web/src/
├── pages/        # top-level screens (Lesson, Practice, Story, Shop, Leaderboard, Admin, ...)
├── components/   # shared UI — auth modals, onboarding, camera chrome, PWA prompts
├── hooks/        # useRecognition (camera+verifier loop), useProgressSync (Supabase sync),
│                 #   useClassifier, useLeaderboard, ...
├── engine/       # TypeScript port of the Python core/ recognition engine (capture, schema,
│                 #   verifier, movement, orientation, classifier gating) — kept in parity by hand;
│                 #   see docs/vault/Architecture.md at the repo root for how the two stay in sync
├── stores/       # Zustand (persisted) — local progress/economy state, synced to Supabase
├── contexts/     # AuthContext (Supabase Auth), ThemeContext
├── avatar/       # 3D procedural/retargeted avatar rig (branch claude/avatar-lab-prototype work;
│                 #   see ../docs/AVATAR_AUTHORING_HANDOFF.md before touching animation code)
├── lib/          # Supabase client, small pure helpers (username validation, geolocation, ...)
└── data/         # static content: sign metadata, shop items, ranks, badges, stories
```

`web/src/engine/` mirrors `core/` at the repo root — the same recognition rules exist twice (once
per language) because the Python prototype and the browser app both need to run recognition
locally, with no shared runtime between them. Changing a threshold or a movement check in one
without the other is a real drift risk; there's no automated parity check between the two today.

## Design system

See [../DESIGN.md](../DESIGN.md) for tokens, component conventions, and the running list of
anti-patterns found and fixed (off-token colors, touch targets, motion).
