# Findings

**Verification status is stated per finding and is not uniform.** No local or staging environment could be built (no Docker), so no finding below was proven by live exploitation. F-001 and F-002 are confirmed by full-chain source and schema analysis, with executable regression tests written but **not run**.

| ID | Severity | Title | Status |
|---|---|---|---|
| F-001 | **HIGH** | Private room codes world-readable → unauthorized live webcam access | Fixed (unverified at runtime) |
| F-002 | **HIGH** | Economy guard bypassable via DELETE+INSERT on `user_progress` | Fixed (unverified at runtime) |
| F-003 | LOW | `profiles` exposes `is_admin`/`is_banned`/`ban_reason` to anonymous users | Open — documented |
| F-004 | LOW | No global write rate limit on PostgREST | Accepted risk — documented |
| F-005 | INFO | 3 vulnerable transitive dependencies, all unreachable at runtime | Open — patch recommended |
| F-006 | INFO | Catch-all rewrite returns 200 for non-existent paths (scanner false-positive generator) | Accepted by design |
| F-007 | INFO | Local Supabase demo JWTs in git history | False positive — no action |

---

## F-001 — Private multiplayer room codes are readable by any authenticated user, enabling unauthorized access to participants' live webcam streams

**Severity:** HIGH · **CWE-639** (Authorization Bypass Through User-Controlled Key) · **OWASP API1:2023 BOLA** / **A01:2025 Broken Access Control** · **ASVS V4.1.3, V4.2.1**

**Component:** `supabase/migrations/20260716000000_multiplayer_rooms.sql` (policy `rooms_select_all`), `20260731120000_idempotent_room_rejoin.sql` (`join_multiplayer_room`)

**Prerequisite:** Any account. Free signup. No privileged access.

### Evidence

```sql
-- 20260716000000_multiplayer_rooms.sql
create policy "rooms_select_all" on public.multiplayer_rooms
for select to authenticated using (true);
```

`multiplayer_rooms` contains `code text not null unique` and `visibility text ... check (visibility in ('public','private'))`. The policy places **no restriction whatsoever** on which rows an authenticated user may read, so every private room's join code is readable by every logged-in user.

`join_multiplayer_room(p_code)` checks the throttle, that the room exists, and that `status <> 'closed'`. It **never checks `visibility`** — by design: for a private room, *possessing the code is the authorization*. The function even rate-limits to 10 attempts/minute *before* revealing whether a code exists, specifically so codes cannot be brute-forced.

That control is sound but moot: **an attacker never needs to guess a code, because they can read them all.**

### Full attack chain

1. `select code from multiplayer_rooms where visibility='private' and status='waiting'` — permitted by `rooms_select_all`.
2. `select join_multiplayer_room('<code>')` — succeeds; no visibility check.
3. The attacker is now a genuine row in `multiplayer_room_members`.
4. The Realtime policies `room_receive_members` / `room_send_members` authorize on exactly that membership — so they now **pass**. The realtime layer does not save us; it was authorizing on a premise F-001 corrupts.
5. WebRTC signalling completes. `useMultiplayerSignaling.ts:161` — `stream?.getTracks().forEach(t => pc.addTrack(t, stream))` — publishes the local camera; `pc.ontrack` (line 137) receives the peer's.

**Result: the attacker receives the live webcam video of users in a room they believed was private.**

### Impact

This is not metadata disclosure. It is unauthorized access to live video of other users. For an ASL-learning product that expects minors — the repository's own `docs/LAUNCH_CHECKLIST.md` lists COPPA/GDPR-minors handling as a launch blocker — a stranger silently joining a "private" room is the most consequential outcome available in this system.

### Root cause

The room model has two distinct concepts — *discoverability* (matchmaking) and *joinability* (code possession) — and the SELECT policy was written for neither. Matchmaking never needed the policy at all: it runs through `find_public_room()`, which is `SECURITY DEFINER` and bypasses RLS entirely. `using (true)` was broader than any caller required.

### Fix applied

`supabase/migrations/20260901120000_security_audit_room_visibility_and_progress_insert.sql` replaces the policy with host-or-member scope.

**Regression risk assessed before changing it:** there are **no direct `.select()` calls against `multiplayer_rooms` anywhere in `web/src/`** — every read goes through `find_public_room()` or `join_multiplayer_room()`, both `SECURITY DEFINER`. The three write paths (`App.tsx:229`, `DuelPage.tsx:342`, `RoomPage.tsx:434`) each destructure only `{ error }` with no chained `.select()`, so PostgREST uses `return=minimal` and requires no SELECT privilege. Matchmaking, hosting and joining are unaffected.

### Verification

- ❌ **Not runtime-verified** — no local stack available.
- ✅ Regression tests written: `web/e2e/security-rls.spec.ts` — non-member cannot read a private room; host *can* still read their own (guards against over-tightening).
- **Required before launch:** run those tests against a local Supabase stack.

---

## F-002 — Economy delta guard bypassable via DELETE + INSERT on `user_progress`

**Severity:** HIGH (control bypass) / MEDIUM (business impact — no real money involved) · **CWE-841** (Improper Enforcement of Behavioral Workflow) · **OWASP API6:2023** / **A04:2025 Insecure Design** · **ASVS V4.2.1, V11.1.4**

**Component:** `20260710120000_progress_delta_guard.sql`, `20260712130000_guard_economy_columns.sql`, `20260712120000_region_leaderboard.sql`

**Prerequisite:** Any account.

### Evidence

An entire migration exists to cap economy growth per write:

```sql
create trigger guard_progress_deltas_trg
  before update on public.user_progress          -- ← UPDATE ONLY
  for each row execute function public.guard_progress_deltas();
```

But `user_progress` simultaneously carried both:

```sql
create policy "progress_delete_own" on public.user_progress for delete using (auth.uid() = user_id);
create policy "progress_insert_own" on public.user_progress for insert with check (auth.uid() = user_id and not public.current_user_banned());
```

### Attack

```sql
delete from user_progress where user_id = auth.uid();
insert into user_progress (user_id, gold, xp, level, signs, total_correct_signs,
  owned_cosmetics, unlocked_world_ids, badges, rename_cards, streak_freezes, longest_streak)
values (auth.uid(), 999999999, 999999999, 999, 999999, 999999,
  '{...}', '{...}', '{...}', 999, 999, 999);
```

Neither statement is an UPDATE, so the guard **never fires**. The ceiling is not defeated — it is skipped.

### Impact

Instant top of the **public** `weekly_leaderboard` (granted to `anon`), every gold-gated cosmetic, every world unlocked. No PII exposure and no financial loss (there is no payment system — gold is earned, never bought), but it nullifies a control the team built deliberately and destroys the integrity of a public ranking.

### Root cause

A trigger only covers the DML events it is attached to. The guard was written when UPDATE was the only reachable mutation path; a later migration (`20260712120000`) added a DELETE policy, silently opening a route around it. **Neither change is wrong in isolation** — the vulnerability lives in the interaction, which is why diff review did not catch it.

### Fix applied — two layers

1. **`progress_delete_own` dropped.** Closes the chain at its root: `handle_new_user()` creates the row for every user at signup, and the client can no longer remove it, so every subsequent write necessarily takes `upsert`'s `ON CONFLICT → UPDATE` path, which the existing guard covers. Nothing in `web/src/` deletes this row (verified). **GDPR erasure is unaffected** — deletion still cascades `auth.users → profiles → user_progress` via `ON DELETE CASCADE`.
2. **New `guard_progress_insert()` trigger on INSERT**, for the residual case of a user whose row is genuinely missing.

**A deliberate design decision in layer 2:** it **caps** rather than zeroes. `useProgressSync.ts:200` pushes real progress via `.upsert(payload, { onConflict: 'user_id' })`, which lands on INSERT when the row is absent. Forcing zeroes there would silently wipe a real user's legitimate progress on their next sync — a worse bug than the one being fixed. Capping at the same ceilings the UPDATE guard uses preserves every honest write while making the `999999999` insert impossible.

### Verification

- ❌ **Not runtime-verified.**
- ✅ Regression tests written (`security-rls.spec.ts`): client DELETE must not remove the row; INSERT must be capped, not zeroed.

---

## F-003 — `profiles` exposes moderation and privilege state to anonymous users

**Severity:** LOW · **CWE-200** · **A01:2025** · **ASVS V8.3.1**

`create policy "profiles_select_public" on public.profiles for select using (true);` — combined with Supabase's default grants, any **unauthenticated** caller can read all of `profiles`, including:

- `is_admin` — lets an attacker enumerate exactly which accounts to target first.
- `is_banned` / `ban_reason` — free-text moderator notes about a user, readable by anyone. Depending on what moderators write, this is a privacy and potentially defamation exposure.

**Confirmed absent:** no email, phone, or other direct PII in this table — emails live in Supabase-managed `auth.users` and are not exposed through PostgREST. That materially limits severity.

**Not fixed in this pass.** The public read is load-bearing (leaderboard, friends, profile pages) and narrowing it correctly means either a column-restricted grant or a public view — a functional change wider than a security patch should make unilaterally.

**Recommendation:** expose a `public_profiles` view (`id`, `username`, `created_at`) to `anon`, keep the base table authenticated-and-owner scoped, and move `ban_reason` out of client reach entirely.

---

## F-004 — No global write rate limit on PostgREST

**Severity:** LOW · **A04:2025** · **ASVS V11.1.4** · **Accepted risk**

`join_multiplayer_room` throttles (10/min) and `trim_training_samples` caps stored rows, but there is no general per-user write limit. With F-002 fixed the per-write ceilings hold, so the residual risk is *grinding* (repeated capped writes) and general write-volume abuse, not instant compromise.

Mitigating: Supabase enforces platform-level limits. Accepting this is reasonable for launch; revisit if abuse appears.

---

## F-005 — Vulnerable transitive dependencies (all unreachable at runtime)

**Severity:** INFO after triage (npm reported 2 HIGH + 1 MODERATE) · **A06:2025**

| Package | npm severity | Path | Triage |
|---|---|---|---|
| `fast-uri` 3.1.4 | HIGH | `vite-plugin-pwa → workbox-build → ajv` | **NOT REACHABLE** — build-time only, never shipped |
| `nanoid` 3.3.16 | HIGH | `vite → postcss` | **NOT REACHABLE** — build-time only, never shipped |
| `dompurify` 3.4.12 | MODERATE | `posthog-js` | **NOT REACHABLE** — verified absent from the shipped bundle |

The `dompurify` triage required care and is worth recording, because a naive check gets it wrong in *both* directions:

A first pass showed no `posthog-js` chunk at all — but that build was unrepresentative. With no `VITE_POSTHOG_KEY` set locally, `analyticsConfigured` is statically `false`, so rolldown dead-code-eliminates the entire `await import('posthog-js')`. Rebuilding **with** a key set (as Vercel does) produced `vendor-posthog-*.js` as expected. Re-checking that production-shaped bundle: `DOMPurify`, `ALLOWED_TAGS`, `IN_PLACE` and `RETURN_TRUSTED_TYPE` all return **zero** matches — posthog-js declares dompurify but loads its survey code lazily from PostHog's own CDN, so the vulnerable code never ships from this origin.

**Recommendation:** run `npm audit fix` anyway (all three are non-breaking patch bumps; build-time supply-chain integrity still matters). Not a launch blocker.

---

## F-006 — Catch-all rewrite returns HTTP 200 for non-existent paths

**Severity:** INFO · **Accepted by design**

`/((?!.*\.[a-zA-Z0-9]+$).*)` → `index.html` means any extensionless path returns **200 + `text/html`**. `GET /.git/config` returns 200 — but the body is the SPA shell, not a git config (`Content-Type: text/html`, verified). There is no `.git` exposure.

Recorded deliberately: **an automated scanner will report this as CRITICAL source disclosure.** It is a false positive, and this entry exists so the next audit doesn't re-raise it. Genuine static files correctly 404 (`/.env` → 404, verified).

---

## F-007 — Supabase demo JWTs in git history

**Severity:** INFO · **False positive — no action**

`web/e2e/support/multiplayerStack.ts` contains two JWTs. Decoded, both carry `"iss": "supabase-demo"` — the universally-published Supabase CLI local-development keypair, identical on every machine running `supabase start` and documented publicly by Supabase. Not secrets.

`assertLocalOnly()` additionally prevents pointing them at a non-local host without an explicit override.

**Confirmed clean:** no real `service_role` key anywhere in git history; no `.env` file ever committed (`.gitignore` covers `.env*` with an `!.env.example` exception); no high-signal secret patterns (`sk_live`, `AKIA…`, `ghp_…`, `sbp_…`, `AIza…`) in the shipped bundle.
