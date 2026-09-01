# QuickSign — Handoff (2026-08-30 deep audit & release-repair session)

Branch: `release-audit-2026-08`, based on `origin/main`. **Not merged, not pushed.** 21 commits, nothing squashed — each is a small, reviewable, independently-revertable unit. Full tree still clean; every commit passed `tsc -b`, the full unit suite, lint, and (where applicable) live e2e/browser verification before landing.

## What this session actually found, vs. what the original brief assumed

The brief that started this session assumed production was broken (Vercel deploying the repo as Python) and treated a historical HELLO recognition failure as still-current. Neither was true — verified before acting:

- `quicksignn.vercel.app` → 200, serving current code, on the day this session started.
- `asl-game`'s Vercel project deploys green on current `main`.
- **Three** Vercel projects post commit statuses, not two: `asl-game` ✅, `signup-asl` ✅ (but serving a stale bundle — see `DEPLOYMENT.md`), `asl_game1` ❌ (a third party's account, likely a Python-misdetection issue from a root `requirements.txt` with no root `vercel.json`).
- HELLO's historical false-veto issue (2026-07-27, model confidently rejecting correct HELLO attempts as `NO_SIGN`) was already correctly fixed and is not a current defect — but HELLO turned out to have **zero fixture coverage** in the TS engine that actually ships, a real, previously-undocumented gap this session's Phase 4 work surfaced.

The real, previously-unflagged P0s this session found instead: the classifier model 404ing in production since 2026-08-04 (silently collecting zero shadow-mode data), two false privacy claims shipped to users, and a data-loss-shaped auth bug (`??` vs `||`) that could white-screen the app on a blank env var.

## Commits, in order

| SHA | What |
|---|---|
| `61318a4` | Canonicalize domain to `quicksignn.vercel.app`; add root `vercel.json` for `asl_game1` |
| `65f6937` | Fix `supabase.ts`'s `??`/`\|\|` bug (blank env var → white screen) |
| `8971ff5` | Disable `CLASSIFIER_LOAD_ENABLED` — stops the classifier 404, was silently 404ing since 08-04 |
| `d05acdd` | Make CI's `e2e` job pass in its own (Supabase-unconfigured) environment — was 91/118 failing |
| `ff08583` | Correct two false PrivacyPage claims (session replay, multiplayer video) |
| `076a3f1` | Camera privacy disclosure on every camera screen, not just Lesson |
| `fd0b77c` | Real Terms & Privacy link in onboarding; DNT/opt-out honored on landing.html |
| `06aa50c` | **Onboarding reorder**: welcome → skill → first-sign-attempt → auth (was auth-first). Guest promoted to primary action. **Needs your manual camera test — see below.** |
| `3e77d69` | Port Python's `test_static_confusor_is_rejected` invariant to TS |
| `0e73068` | Unit tests for `assignRoles`/`bestFitRoles` |
| `427dedd` | Fix stale `PASS_THRESHOLD` comment; reconcile drifted HELLO schema in `data/signs.ts` |
| `279d5ec` | Durable `traffic_type` flag, replacing "Pakistan = test" code-comment convention |
| `1968c42` | Register `guest_return` + 5 landing-page event types |
| `3530fd1` | Guest D1/D7 return tracking (previously unmeasurable) |
| `9a79046` | Wire up the never-fired `error_captured` event |
| `956e2bb` | Fix `first_sign_success.ms_since_lesson_start` — was attempt duration, mislabelled |
| `72cd1f2` | Fix `asl-alphabet.html`'s missing DNT/opt-out; reconcile `hero_cta_clicked` shape |
| `01e9603` | Fix `FeedbackModal.tsx` reading a `VITE_APP_VERSION` that never existed |
| `badaaf1` | Fix e2e onboarding-walk helpers for the reorder (regression I introduced in `06aa50c`, caught and fixed same session) |
| `0cc685e` | Fix `index.html`'s SEO meta description repeating the false camera-privacy claim |
| `3e539d9` | Correct README/ARCHITECTURE/AGENTS/CLAUDE.md's stale "Python is source of truth" claims |

## Needs YOUR action (I can't do these)

1. **Add msaad9632 as a Vercel team Member** on the canonical team, so their PRs get real Preview Deployments through the `web`-rooted project — better than relying on the root `vercel.json` fallback alone. Dashboard-only action.
2. **`signup-asl.vercel.app`** — a second live public copy of the product on stale code. Decide: point it at canonical, or pause its auto-deploy. Non-destructive either way; not touched this session.
3. **Rotate the Supabase secret keys** (`sb_secret_*`) and any personal access token that got pasted into this session's chat at any point — anything pasted into a chat transcript should be treated as exposed, even though nothing here stored or used them beyond the one publishable key that's safe client-side by design.
4. **Manually test the onboarding reorder (`06aa50c`) on a real device with a real camera.** This session verified: the full skip path end-to-end in a real browser, `tsc -b` clean, full unit suite green, and all e2e specs updated and passing. This session could **not** verify: whether the actual letter-A recognition in the new first-sign step passes reliably for a real hand (no camera device exists in this environment), and the reordered auth screen's real rendering (Supabase's `getSession()` hung in this session's test browser for reasons unrelated to the code change — confirmed via a direct network-reachability test, not a real bug, but never visually confirmed either).
5. **Real fixture recording for HELLO, WANT, YES, LETTER_J, LETTER_Z, RED, YELLOW, WIN, TEAM** — these movement signs have zero recorded correct-performance fixtures in `web/tests/fixtures/`, found via the new `static-confusor.test.ts` (`3e77d69`). Needs a camera + CalibrationPage; not something this session could produce without fabricating data, which it explicitly did not do.
6. **Reference-clip provenance audit** — `data/signs.ts`'s `clip` fields point to `/clips/*.mp4`; this session did not trace each clip's performer/consent/license. Flagged in `docs/ASL_VALIDATION_PROGRAM.md` §6, cross-reference `docs/LICENSING_CHECKLIST.md`.
7. **51 signs exist in both `data/signs.ts` and `web/src/engine/signs/index.ts`** — only HELLO's divergence was checked and reconciled this session (`427dedd`). The other 50 may have the same kind of display-vs-engine drift; not audited.

## Documents this session added or corrected

- `DEPLOYMENT.md` (new) — deployment topology, env vars, CI, rollback.
- `HANDOFF.md` (this file, new).
- `docs/ASL_VALIDATION_PROGRAM.md` (new) — Deaf/fluent-signer/educator review program design. **Design only — nothing recruited, nothing sent, nothing paid.**
- `docs/CMO_RESEARCH.md` (new) — marketing-agent-system feasibility research (competitors, tooling, budget tiers, approval gates). **Research only — no accounts, no posting, no spend.**
- `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `CLAUDE.md` — corrected the stale "Python is the recognition source of truth" claims; `web/src/engine/` is what ships. `AGENTS.md`'s `.Codex/rules/` reference list (30 files) was found entirely dangling — flagged, not fabricated a replacement.

## Constraints honored throughout (per the original mission brief)

No force-push. No destructive Vercel/DNS action. `GATE_ENFORCED` untouched (still `false`). The 2026-08-18 camera-performance work untouched. The pre-existing Settings-tab WIP (`git stash@{0}`) untouched — still stashed, still yours to pick up separately. Nothing implemented for the CMO/marketing system beyond research — no account, token, post, or dollar spent under this session's authority.

## Suggested next steps, in order

1. Review this branch's diff; test the onboarding reorder on a real device (item 4 above).
2. Merge to `main` if satisfied — no rebasing/squashing required, the commits are already small and reviewable individually.
3. Handle the two Vercel dashboard items (msaad9632 membership, `signup-asl` decision).
4. Rotate the exposed Supabase keys.
5. Record real fixtures for the 9 unfixtured movement signs when a camera is available.
6. Decide whether to act on `docs/ASL_VALIDATION_PROGRAM.md` and `docs/CMO_RESEARCH.md` — both are ready to execute against, neither commits you to anything by existing.
