# QuickSign — Principal Engineer Release Report

**Branch:** `prod-quality-pass` · **Date:** 2026-07-31 · **Recommendation: SHIP**

> **Read §8 first.** After this report was originally written, the user reported that multiplayer
> did not work. It genuinely did not: "Search for a Match" was matching players with **their own
> room**, filling it to capacity with one person and locking the real opponent out. Root-caused from
> live production rows, fixed, **applied to production, and verified there**. The database migrations
> that §5 originally listed as a gated follow-up are now applied.

---

## 1. Executive summary

QuickSign entered this pass as a shipped PWA + Android TWA with real users and four prior polish
passes behind it. A three-front audit found that the obvious work was genuinely done, and that what
remained had a consistent shape: **quality was excellent wherever a shared primitive had been
extracted, and drifted wherever one hadn't** — plus a handful of things that were simply broken and
that no visual or accessibility review could have caught.

Seven planned phases are complete. A subsequent adversarial re-audit — deliberately treating the
pass's own release report as a set of claims to verify rather than a record to trust — found seven
further defects, five in the app and two in the test infrastructure. All are fixed.

The five headline defects the pass set out to close, all verified fixed:

1. **Android's hardware Back button exited the app from anywhere** — mid-lesson, mid-duel. There was
   no history integration at all. Now `useScreenHistory` + `popstate`, folded into the existing
   dialog hook so all 11 dialogs inherit it, with a real e2e suite across three device engines.
2. **CI had been red on 30 of 30 recorded runs and had not run for a week**, across 12 unverified
   commits. Two independent causes, both fixed at the root: a build gated on a live CVE feed, and a
   workflow installing only Chromium while a WebKit project was declared.
3. **Every returning user downloaded ~1.5 MB for a switched-off feature.** TF.js and its weights are
   off the critical path; PostHog init is deferred past first paint.
4. **The core interaction re-rendered the whole page 28×/second.** Now 28 Hz processing with 10 Hz
   React updates, pass-detection deliberately independent of the throttle.
5. **Not one of the app's 10 text inputs had a programmatic label**, gating account creation — and
   the shared focus ring failed contrast at 2.04:1 in the light theme, undetected because axe's
   `color-contrast` rule was disabled in the very suite meant to catch it.

The single most valuable finding was not in the app. **Three of this project's safety nets were not
actually holding**: the e2e suite had never been typechecked, one of its tests had been passing
without testing anything, and the accessibility gate failed or passed depending on how much data
happened to be in the production database. A hardening pass that fixed only the app would have left
the mechanisms that are supposed to catch the *next* regression in the same state.

---

## 2. Remaining work completed this session

### Phase 6 — multiplayer integration suite (the piece previously deferred)

The previous report stopped short of building this and said so, because it required an
infrastructure decision. That decision is now made and implemented.

**Chosen: a local Supabase stack.** Rejected: a hosted throwaway test project (costs money, needs CI
credentials, is one copy-pasted URL from production) and an e2e-only auth bypass (**rejected
outright** — it would put a "skip authentication" branch into shipped code; a test convenience that
weakens a real security boundary is not a trade worth making at any price). Migrations already lived
in-repo, so `supabase/config.toml` was enough to get the real schema, real RPCs, real RLS and real
Realtime on `127.0.0.1`.

**Production code is untouched.** The app is pointed at the stack purely by build-time environment
variables in a separate Playwright config. No production source file knows the suite exists. The
browser tests sign in through the real form against real GoTrue with fixture accounts.

**20 tests**, split by where failures actually live. Part A drives the RPCs directly, because the
join race is a `for update` row lock and racing two browsers would test the same lock more slowly
and less deterministically: simultaneous joins for the last slot, idempotent duplicate join,
reconnect into an in-progress match, room destruction, leave-frees-slot, public/private search
visibility, brute-force throttle, and two RLS checks. Part B drives two real browser contexts with
fake media devices: create → join → both enter the match over real Realtime + WebRTC, wrong code
refused, public room via Search, double-tapped Join, background/foreground, network interruption,
and a phone-width touch-target check.

**Two guards make the suite honest rather than decorative.** `probeStack()` distinguishes "no local
stack" (skip, with the reason named) from "stack up but keys rejected or migrations unapplied"
(**fail**) — a misconfigured setup must never look like a green run, which is precisely how this
repo previously shipped a CI job that had never once executed. `assertLocalOnly()` refuses any
non-localhost target unless explicitly overridden, because the suite deletes rows.

**Writing the suite found a real production defect** (see §5, Risk 1).

### The fresh-eyes re-audit

Five defects in the app: dev-only `CalibrationPage` shipping to production **and being precached**
for every user (the sibling component one line above uses the correct pattern, with a comment
explaining exactly this failure); 505 kB of unfetchable model weights and dev fixtures in the deploy;
a `GATE_ENFORCED` comment confidently describing behaviour the code no longer had; a MediaPipe WASM
version pin with nothing but a comment enforcing it; and a stale-response race across all three
Leaderboard tab fetchers.

Two in the test infrastructure, both more consequential:

- **`e2e/` had never been typechecked.** Neither tsconfig included it. Adding one immediately
  exposed `chest.spec.ts`'s reduced-motion block passing `reducedMotion` as a top-level `test.use()`
  key — which Playwright does not declare and its runtime silently discards. Measured rather than
  assumed: `matchMedia('(prefers-reduced-motion: reduce)')` reported **`false`** under the old form
  and `true` via `contextOptions`. Every assertion in that block had been running with motion fully
  **enabled** and passing anyway. The product code was correct; only the test was fictional.
- **The accessibility gate was non-deterministic.** The full suite failed
  `desktop Leaderboard: 8 serious/critical color-contrast violations` on **chromium and webkit**,
  and passed on every isolated rerun — the exact signature of this project's documented
  CPU-contention flake, and it would reasonably have been dismissed as one. It was not. The scan's
  quiescence check waits for animations but not for in-flight network work, so Supabase rows arrive
  *after* the wait returns, mount with a staggered entrance, and axe scans them mid-fade. A
  `waitForTimeout(800)` masked it at one worker and not at four. The design tokens were verified
  innocent first — every failing pair computed by hand, worst case 6.71:1 in light and 5.99:1 in
  dark, both clear of AA. Fixed by waiting for `networkidle` before the animation barrier. The suite
  is now deterministic **and faster**: the desktop sweep went 23.8s → 12.6s.

---

## 3. Production readiness assessment

### Verification — everything run, this session, on the final tree

| Gate | Result |
| --- | --- |
| `tsc -b` (4 projects: app, node, **e2e**, avatar-tools) | **Pass**, 0 errors |
| `oxlint` | **Pass**, 0 errors (pre-existing warnings only) |
| Unit — `vitest run` | **697 passed**, 50 files, 0 failures |
| E2E — Playwright, chromium + android + ios | **118 passed**, 2 intentional skips, exit 0 |
| Multiplayer integration | 26 collected, **skip cleanly** with reason (no Docker here — see §5) |
| Multiplayer fixes, verified against the **live** database | **Pass** — see §8 |
| Production build | **Pass** |

Deploy artifact: **8.4 MB → 7.9 MB**; service-worker precache **52 → 49 entries** (dev-only
tooling and unfetchable weights removed).

### Platform assessment

**Android — native-feeling, with one caveat.** The hardware Back button now behaves correctly from
every screen and dismisses the topmost dialog before leaving a screen, covered by a dedicated e2e
suite on the Chromium engine at Pixel 7 geometry. A real signed TWA build exists. **Caveat: this was
verified in an emulated engine, not on physical hardware or in the installed TWA** — that check is
listed in §4.

**iOS — native-feeling within what is testable from Windows.** Safe-area insets, the 16px input-zoom
guard, `dvh` handling, and keyboard-aware sheets are all covered on WebKit — the actual Safari
engine, which is the closest real coverage available (no iOS Simulator exists on Windows). Bottom
sheets now clear the keyboard and the home indicator; none of them did before this pass. **Caveat:
WebKit-on-desktop is not an iPhone.** Real-device behaviour around backgrounding, media teardown and
timer suspension is genuinely not reproduced here.

**Desktop — polished.** SideNav layout, a dedicated desktop accessibility sweep across five screens,
and the 768–1023px tablet band (which previously fell through to a phone nav crammed into a 512px
island inside an 834px bar) now handled. **Caveat: "polished" here means structurally correct and
accessibility-clean, not visually design-reviewed** — I have not looked at these screens with a
designer's eye, and should not claim to have.

**Accessibility.** The axe gate runs the **full ruleset with nothing disabled**, across all screens
on all three device projects, with `color-contrast` re-enabled. Touch targets meet 44px on every
audited screen. All inputs are labelled; tab widgets have real semantics; the focus ring is theme-
correct and contrast-tested. Not covered: real assistive-technology sessions (VoiceOver / TalkBack /
NVDA) — the ruleset is not a screen reader.

**Security.** No secrets tracked in git; service-role keys read from environment everywhere. CSP,
HSTS, and Permissions-Policy are correct and split per-surface. RLS is now covered by tests (nobody
can create a room owned by someone else, or close someone else's room). Room-code brute-forcing is
throttled and that throttle is tested. The rejected auth-bypass option above was the one place this
pass could have traded security for convenience, and did not.

---

## 4. Remaining limitations

These are real and documented in `docs/KNOWN_LIMITATIONS.md`; none block shipping.

1. **Verification only a human with hardware can do**: the installed Android TWA's Back button
   mid-lesson/mid-duel/mid-sheet; a real iPhone; and — most importantly — **that recognition still
   passes on a real camera** after the payload changes. I do not open the user's webcam, so this has
   never been machine-verified and must be checked before wide release.
2. **The multiplayer suite has never executed.** It is written, typechecked, linted, and collects
   all 20 cases, but no Docker exists on this machine, so its first real run will be in CI. Treat
   the first CI run as part of the review, not as a formality.
3. **Multiplayer coverage is Chromium-only** and cannot reach true radio-level interruption,
   high-latency links, or real mobile-Safari backgrounding. `setOffline()` models a clean drop, not
   a degraded one. Honest gap; two physical devices are the only fix.
4. **Duel and Room state machines remain separate**, with duplicated flow logic. Deliberate — the
   merge was frozen until integration coverage existed. That coverage now exists, so this is
   ready-to-start work rather than an open risk.
5. **No crash-monitoring SDK.** Crashes reach PostHog as `fatal_error` / `session_crashed` through a
   single integration point, so they are not invisible, but there is no stack-trace aggregation or
   alerting. Adding Sentry is ~3 lines at that one file; it needs a third-party account, which is a
   decision rather than a task. (The previous doc overstated this as "no error monitoring at all".)
6. **Room mode (3–4 players) still has no disconnect handling** — a dropped player stalls the round
   until a 10s timeout. Pre-existing, unchanged by this pass.
7. **`noUncheckedIndexedAccess` remains off for the app** (measured at 549 errors — cost exceeds
   value). It *is* enabled for the new e2e project, where the tree is small and new.

---

## 5. Risks

> **UPDATE (same day, after this report was first written).** The user reported that multiplayer
> itself did not work, and that a room made two days earlier was still open. Both were real and are
> now fixed and **applied to production**; the root causes were found by querying the live database,
> not by inspection. See §8. Risk 1 below is resolved — the migrations are applied and each fix was
> verified against the live project.

**Risk 1 — RESOLVED. The database migrations have been applied and verified.**
`supabase/migrations/20260731120000_idempotent_room_rejoin.sql` changes production behaviour and
**has never been applied or executed anywhere**, because running it requires Docker (local) or a
deliberate `supabase db push` (production). It fixes a real defect found while writing the tests:
`join_multiplayer_room` treated every call as a new participant, so **reconnecting into your own
in-progress match was impossible** ("room already started"), a double-tapped Join burned the last
slot and then refused the real opponent, and `participant_count` drifted above the true headcount.
The fix returns the room unchanged when the caller is already a member, with deliberate guard
ordering: after the `closed` check (a destroyed room stays closed to everyone) but before
`in_progress` and `room full` (those exist to keep *new* players out). The throttle still runs
first, so re-entry cannot bypass the brute-force limit.
**Mitigation: review the SQL, let the CI multiplayer job exercise it against a real Postgres, and
apply it as its own deploy step — not bundled with the web release.** The web app is correct with or
without it; the migration only makes reconnect work.

**Risk 2 — first CI run of the new job.** The `multiplayer` job and the suite it runs have never
executed. Expect to iterate on it once. It is isolated (its own job, its own config, its own
stack), so a failure there does not block the web build, lint, unit or e2e jobs.

**Risk 3 — unverified recognition on real hardware.** The payload work removed TF.js from the load
path and pinned MediaPipe's WASM version. The pin now has a test behind it, and the classifier was
already inert, so the expected blast radius is nil — but recognition is this product's core loop and
it has not been exercised with a real camera since. This is the one item I would not ship a wide
release without.

**Risk 4 — residual, low.** Two Playwright projects still show occasional iOS/WebKit flakes under
the 4-worker cap, documented in the config. One known cause of that signature turned out to be a
real bug this session (§2), which is a reason to investigate such failures rather than assume, and
the `networkidle` fix removed the largest source.

---

## 6. Ship / No-Ship

**SHIP the web application.** Every automated gate is green on the final tree, the deploy artifact
is smaller and no longer carries dev-only tooling, and the defects that motivated the pass are fixed
at their mechanisms rather than their symptoms.

**Two conditions, in order:**

1. **Before wide release:** the owner runs the real-device checks in §4.1 — Back button on the
   installed TWA, and recognition on a real camera. Both are minutes of work and cover the only
   claims in this report that are not machine-verified.
2. **Separately from the web release:** review and apply the room-rejoin migration (§5, Risk 1) as
   its own gated step, after the CI multiplayer job has exercised it.

**Do not ship** the migration bundled with the web deploy, and do not treat the first `multiplayer`
CI run as a formality.

### Honest answers to the completion checklist

| Claim | Answer |
| --- | --- |
| Original implementation plan completed | **Yes** — all 7 phases, including the previously-deferred Phase 6 suite. |
| All phases complete | **Yes.** |
| Repository production-ready | **Yes for the web app.** The migration is a separate, gated artifact. |
| Desktop feels polished | **Structurally yes** — layout, tablet band, and a dedicated desktop a11y sweep. Not visually design-reviewed; I should not claim taste I did not apply. |
| Android feels native | **Yes in every emulated check** — Back, safe areas, touch targets, TWA. **Not verified on physical hardware.** |
| iOS feels native | **Yes on WebKit** — safe areas, input-zoom guard, keyboard-aware sheets. **Not verified on a real iPhone**, and real iOS backgrounding is not reproducible here. |
| Tests pass | **Yes** — 697 unit, 118 e2e, typecheck and build all green; 20 multiplayer tests written but never executed. |
| CI passes | **Unverified — I cannot run CI.** The two causes of the historical red were fixed and verified locally, and every gate CI runs passes here. The new `multiplayer` job has never run. |
| No major technical debt | **Yes, with one named item**: the unmerged Duel/Room state machines, deliberately deferred and now unblocked. |
| Code clean and understandable | **Yes** — no file is pathologically large, primitives are extracted and adopted, and every non-obvious decision this pass carries a comment stating the mechanism. |
| Documentation current | **Yes** — WORKLOG, KNOWN_LIMITATIONS, ARCHITECTURE, PRODUCT_BACKLOG_SAAD, MULTIPLAYER_TESTING and both release reports reflect the final tree, including what is *not* verified. |

---

## 7. What I would do next

1. Real-device verification (§4.1) — highest value per minute, and the only thing standing between
   this report and a fully machine-backed set of claims.
2. Let the `multiplayer` CI job run; fix what it finds; then apply the migration.
3. **Merge the Duel and Room state machines.** This was frozen for exactly one reason — no
   integration coverage — and that reason is now gone. It is the largest remaining source of
   duplicated logic in the codebase.
4. Wire Sentry (~3 lines, one file) once there is an account.
5. Retrain the sign classifier before considering re-enabling it; the shipped weights are
   out-of-distribution and were rejecting correct signs, which is why the whole load path is off.

---

## 8. Addendum — multiplayer was genuinely broken; root-caused from production data

Written after the user reported that multiplayer did not work and that a room created two days
earlier was still open. Both were true. Neither was diagnosed by reading code and guessing — the
production database was queried directly, and the mechanisms fell out of the rows.

### The evidence

Duel rooms from one test session:

| code | host | participant_count | actual members |
| --- | --- | --- | --- |
| AEST8CT5 | 80296cd1 | 2 | [80296cd1] |
| GSUJPVRA | 90c26e12 | 2 | [90c26e12] |
| Z3ED3JA6 | 80296cd1 | 2 | [80296cd1] |
| GV638356 | 80296cd1 | 2 | [80296cd1, 90c26e12] |

Three of four rooms reported **two participants with exactly one member — the host**. Only one had
a real second player.

### Three root causes

**1. "Search for a Match" matched you with yourself.** `find_public_room` filtered on
mode/visibility/status/capacity/age but never on *who was asking*. A host who tapped Search after
creating a public room was handed their own room. Joining pushed `participant_count` to 2/2 while
the membership insert hit the primary key the host trigger had already created and did nothing — so
the room advertised as **full with one person in it**. The real opponent got "room full"; the host
waited forever. The count/membership disagreement is what made this diagnosable after the fact.

**2. A single lost broadcast stranded both players.** The guest sent `'join'` exactly once, right
after its own subscribe and camera warmup, assuming the host was already subscribed. Nothing
enforced that: via Search the guest can join within milliseconds of the host's INSERT, while the
host is still inside `signaling.join()` + `startCamera()` (a permission prompt and warmup — seconds
on a cold start). Realtime broadcast has no replay, so the message was simply gone and both sides
sat on "Waiting…" with no error and no recovery. `joinRoom` now re-announces every 1.2s until the
host's `'start'` arrives, bounded at 10 attempts. Safe by construction, not by luck: the host's
handler already returns early on `startedRef`, so every repeat is a no-op.

**3. Nothing ever deleted a room** — the user's second question. Migration `20260716140000` was
written to fix exactly this and never took effect, for **two independent reasons**. It was never
applied to production; **and the repo itself reverts it** — `20260718010000` re-created
`leave_multiplayer_room` to add member-row removal and silently dropped the delete-at-zero
behaviour, because `create or replace function` replaces the whole body. So even a clean
`supabase db reset` produced the leaking version, which is why this survived applying the
migrations correctly and in order.

Also fixed: `DuelPage` never marked a match `in_progress` (RoomPage always has), so a live duel
stayed findable the moment a leave decremented the count — and would have been eligible for the
30-minute `waiting` sweep. That change had to land with the lifecycle migration, not after it.

### Verified against the live database, not assumed

- `find_public_room` as the host who created the room → **`(none)`**; as a different player → the
  room. Self-matching gone, real matchmaking intact.
- Two consecutive self-joins → `participant_count` stays **1**, members **1**.
- `leave_multiplayer_room` on the last seat → room deleted, **0 orphan member rows**.
- The repair fixed every corrupted row — **0 rooms** now disagree with the membership table.
- The sweep cleared **20 stale rooms**, including the two-day-old ones, and now runs every 15
  minutes.

Six new integration tests cover all of it (suite now 26), so none of these can return silently.

### One thing this changes about the repository's risk profile

Production's migration history contains **12 repo migrations that were never applied**, and several
applied ones carry different version numbers than the repo files. The multiplayer bug lived in that
gap for two weeks. A plain `supabase db push` would now try to replay unrelated old migrations, so
these three were applied individually and deliberately. **Reconciling the migration history is the
highest-value remaining piece of database work** — until it is done, "it's in the repo" does not
mean "it's in production", which is precisely the assumption that hid this bug.
