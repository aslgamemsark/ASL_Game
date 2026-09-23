# Multiplayer integration testing

The multiplayer integration suite (`web/e2e/multiplayer.spec.ts`) runs against a **local Supabase
stack** — a Dockerised Postgres + GoTrue + Realtime + PostgREST on `127.0.0.1`. It never touches the
hosted production project.

## Why a local stack, and not the alternatives

Three options were on the table. This one was chosen deliberately:

| Option | Verdict |
| --- | --- |
| **Local stack (`supabase start`)** | **Chosen.** Real schema, real `join_multiplayer_room_v2` RPC including its `for update` row lock (where the join race actually lives), real RLS and real Realtime. Disposable, with a localhost guard. |
| A dedicated hosted "test" Supabase project | Rejected. Costs money, needs credentials in CI, still a real network dependency that can be down, and one copy-pasted URL away from being production. |
| An e2e-only auth bypass in the app | Rejected outright. It would put a "skip authentication" branch into shipped production code. A test convenience that weakens the real security boundary is not a trade worth making at any price. |

The app under test is pointed at the local stack purely through **build-time environment variables**
in `web/playwright.multiplayer.config.ts`. No production source file knows this suite exists, and
the browser tests sign in through the real sign-in form against real GoTrue with fixture accounts.

## One-time setup

**Local runs need a working Docker engine** in addition to the normal web development setup.
GitHub Actions starts a disposable Linux Docker stack and can execute the full suite without
installing Docker on the developer machine.

1. **Install Docker Desktop** — <https://docs.docker.com/desktop/> — and start it.
2. **Start the stack** (from `web/`):

```bash
npm run supabase:start
```

That boots the containers and applies everything in `supabase/migrations/` to the local database.
First run pulls several images and takes a few minutes; later runs are seconds.

3. **Run the suite** (from `web/`):

```bash
npm run test:multiplayer
```

4. **Stop the stack when you're done** (from `web/`):

```bash
npm run supabase:stop
```

That is the whole manual setup. Test accounts are created automatically by the suite through the
admin API on first run — there is nothing to seed by hand and no credentials to manage.

### If the CLI issues different local keys

`supabase start` has historically issued the same fixed demo JWTs on every machine, and those are
the defaults in `web/e2e/support/multiplayerStack.ts`. They are **not secrets** — they are published
in Supabase's own documentation, identical everywhere, and only valid against `127.0.0.1`. If a
newer CLI issues different ones, the suite will fail with an authentication error rather than
skipping. Get the real values and export them:

```bash
npx supabase --workdir .. status -o env
```

Then set `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY` and `E2E_SUPABASE_SERVICE_ROLE_KEY`.

## Behaviour without Docker

Local developer runs **skip**, with a message naming the reason. CI fails if the stack is absent. It does not fail, and it does not silently
pass. This distinction is deliberate and enforced in `probeStack()`:

- **Stack unreachable** → skip. Expected on a machine without Docker.
- **Stack reachable but keys rejected, or migrations not applied** → **fail loudly.** A misconfigured
  setup must never look like a green run. This repo has already shipped a CI job that had never once
  executed; that is the failure mode this check exists to prevent.

There is also a hard guard (`assertLocalOnly()`) that refuses to run if `E2E_SUPABASE_URL` points at
anything other than localhost, unless `E2E_ALLOW_REMOTE_SUPABASE` is explicitly set. The suite
creates and deletes rows — pointing it at production by accident must be impossible, not merely
unlikely.

## Where it runs for real

The `multiplayer` job in `.github/workflows/ci.yml`. GitHub's `ubuntu-latest` runners have Docker,
so CI starts a local stack, applies migrations, and executes the full suite on every PR that touches
`web/**` or `supabase/**`.

## What it covers

**Part A — room registry (driven through the RPCs).** Concurrency lives here, not in the UI: the
join race is a row lock inside `join_multiplayer_room_v2`. Driving two browsers to race for a slot
would test the same lock far more slowly and far less deterministically.

- host creates a room; a second player joins by code (and by lowercase code)
- **simultaneous joins for the last slot** — exactly one wins, the other is told the room is full,
  and `participant_count` never exceeds `max_participants` under any interleaving
- **duplicate join from one player is idempotent** — does not burn a slot
- **reconnect** — an existing member can rejoin an in-progress match; a stranger still cannot
- **room destruction** — a closed room refuses everyone, including former members
- unknown codes refused; leaving frees the slot
- public rooms discoverable by search, private rooms never; closed rooms drop out of search
- **brute-force throttle** on repeated wrong-code guessing
- **RLS** — nobody can create a room owned by someone else, or close someone else's room
- **membership hardening** — nonmember/repeated leaves cannot decrement the count; concurrent
  leave/join stays within capacity; private-room reads require membership; only the host can delete
- **RPC contract** — v2 returns expected denials without rolling back the attempt counter;
  anonymous callers and the legacy join RPC are denied
- **friend-challenge insert** — the production duplicate-ignoring upsert remains compatible with
  restricted host update permissions

**Part B — two to four real browser contexts, fake media devices.**

Fixtures sign in normally, decline optional training collection and acknowledge the multiplayer
camera-sharing explanation before using the lobby.

- host creates → client joins by code → **both clients enter the match** (full Realtime + WebRTC
  signaling handoff)
- a wrong code is refused in the UI without breaking the lobby
- a public room is reachable through Search with nobody typing a code
- **a double-tapped Join** does not lock the room against the real opponent
- **backgrounding and restoring the tab** (visibilitychange) does not drop the match
- **network interruption** surfaces the offline banner and the session recovers
- the lobby is usable at phone width, with 44px touch targets

## Known coverage limits

- **Chromium only.** Fake-device WebRTC across two browser contexts is reliable on Chromium;
  WebKit's fake-capture support does not cover the same ground, and a cross-engine matrix here
  would mostly test Playwright's media shims rather than this app. Mobile behaviour is covered by
  an emulated phone viewport instead.
- **Not genuinely deterministic here, and honestly out of reach without two physical devices:**
  true radio-level interruption (airplane mode mid-round), high-latency/lossy links, and real
  mobile-Safari backgrounding, where iOS suspends timers and tears down media in ways
  `visibilitychange` in a desktop engine does not reproduce. `context.setOffline()` models a clean
  connectivity drop, not a degraded one.
- **The Duel and Room state machines are not merged**, per the standing decision. This suite is the
  precondition for revisiting that, not the thing that does it.

## Multiplayer audit follow-up (2026-09-22)

The code-join browser tests now scope the displayed code to the waiting-room label and verify
that the input retains all eight characters. The old typography selector could read `ROOM RULES`,
and the shared input independently truncated valid eight-character codes to six. Public Search
bypassed the input, which is why it passed while code joins failed.

The expanded suite has 24 database checks and 12 browser checks. In addition to lobby, search,
backgrounding and offline-banner coverage, it exercises complete scored and timeout duels,
remote video frame decoding across role rotation, a four-player group game, and recovery of a
lost group completion after a real Realtime socket reconnect. The latter deliberately drops
`round-end` and `game-over` messages, then requires the host snapshot to restore final scores.
It does not replace database authorization or inject a test authentication path.

CI fails rather than skips when its local stack is unreachable. Local developer runs still skip
with an explanation when Docker/Supabase is absent. The audit uses GitHub Actions' disposable
Docker stack; installing Docker on a developer machine is optional for this execution path.

Focused page-handler tests force stale presence during a local duel disconnect, forfeit expiry,
single-offerer recovery, lost start replay, lost group setup/results, duplicate completion,
late snapshots and bounded recovery failure. These test state transitions; the browser suite
separately verifies the real transport and rendered UI.

### Physical-device checks still required

- Two physical devices across different networks: video in both directions, every role rotation,
  scored rounds and timeout completion; repeat with three/four group participants.
- iOS Safari and Android Chrome: camera permissions denied then allowed, camera availability,
  app background/restore, screen lock/unlock and leaving/rejoining.
- Airplane mode/Wi-Fi-to-cellular switching mid-round and during the result screen; confirm
  recovery or a clear end state without duplicate points or an offline winner.
- Restricted NAT/forced TURN and a lossy/high-latency link; check video continuity and relay
  diagnostics. Same-machine Chromium fake cameras do not establish these guarantees.
- Real human signing and camera/model loading remain separate validation. Fake-media tests
  do not establish recognition accuracy or resolve the separately owned blank-camera issue.

All audit fixtures target local Supabase. Production project `juzqilqilxzmudazltjx` and migration
`20260920000051` are unchanged by this follow-up. Client-supplied sender IDs and host snapshots
are reliability mechanisms, not authenticated anti-cheat.
