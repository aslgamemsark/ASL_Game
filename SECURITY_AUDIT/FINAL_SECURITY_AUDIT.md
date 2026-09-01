# QuickSign — Final Commercial-Launch Security Audit (Phase 2)

**Date:** 2026-09-01 · **Branch:** `security/audit-2026-09-01`
**Scope:** verification of Phase 1 fixes + full adversarial re-audit
**Standards:** OWASP ASVS 5.0 L2 · OWASP Top 10:2025 · API Top 10:2023 · STRIDE

---

## EXECUTIVE VERDICT

# ⚠️ CONDITIONAL PASS

Every CRITICAL/HIGH finding is fixed **and now verified by executing real attacks against a real
PostgreSQL instance** — the gap Phase 1 could not close. Unit tests, typecheck, lint and
production build all pass; dependency vulnerabilities are at **zero**.

**The single remaining condition is one command only you can run.** I cannot apply the migration:
this machine has no Supabase CLI credential — no access token, no database password, only the
public anon key, which cannot execute DDL. That step needs your credentials and is deliberately
left to you.

### A correction to the Phase 2 report's own rollout advice

The first version of this report said "apply the migration, then merge." Re-examining it against
`AGENTS.md` showed that was **wrong in a way that would have degraded live users**:

> migrations must be **additive-only** … never *tighten* … in the same change a client might still
> be relying on … lets an old browser tab (running a stale JS bundle) keep working

The F-003 fix *tightens* `profiles` SELECT. Applied as one migration, it breaks any browser tab
still running the old bundle — friends search, leaderboard usernames and the username-uniqueness
check all silently return zero rows. That is exactly what the project's own policy forbids, and it
made the hazard bidirectional rather than one-way.

**The migration is now split so no state is ever broken:**

| | Migration | Effect | Safe to apply |
|---|---|---|---|
| **A** | `20260901180000_phase2_ban_enforcement_and_profile_view.sql` | F-008 ban enforcement + adds `public_profiles` | **Any time** — purely additive, tightens no existing read path |
| **B** | `20260901190000_restrict_profiles_read.sql` | F-003: restricts `profiles` to own-row-or-admin | **Only after** clients have rolled over |

The HIGH finding (F-008) lands entirely in **A**, so the security value arrives immediately and
with zero client dependency.

### Runbook

```bash
# 1. Apply migration A — safe now, fixes F-008, breaks nothing
supabase db push        # or apply 20260901180000 only

# 2. Merge the security branch -> main (Vercel deploys the client)
#    The client now reads public_profiles, which step 1 created.

# 3. Once clients have rolled over (PWA registerType is 'autoUpdate'; allow ~24h),
#    apply migration B to close F-003.
```

All three intermediate states were executed and verified
(`SECURITY_AUDIT/harness/verify-rollout.mjs`):

```
STATE 1  A applied, OLD client live
  PASS  OLD client cross-user username lookup still works
  PASS  OLD client username-uniqueness check still works
  PASS  F-008 ALREADY fixed (banned cannot join / cannot host)
  PASS  public_profiles already exists
STATE 2  A applied, NEW client deployed
  PASS  cross-user lookup via public_profiles · uniqueness check · self flag read
STATE 3  A + B applied, NEW client (final)
  PASS  anon cannot read profiles · cross-user moderation cols hidden
  PASS  new client works · self flag read works · admin panel works
HAZARD   CONFIRMED: an OLD-bundle tab reads 0 rows cross-user once B lands
         -> precisely why B ships separately
ALL ROLLOUT STATES SAFE
```

**Merged to `main`: NO.** Step 1 is a prerequisite for the client deploy that merging triggers, and
step 1 needs a credential I do not have. Merging now would deploy a client whose `public_profiles`
reads fail. Once you have run step 1, the merge is safe and unblocked.

Two non-code launch items remain outstanding and are outside this audit's authority: the
COPPA/GDPR-minors review and production crash monitoring (both tracked in
`docs/LAUNCH_CHECKLIST.md`). Given F-001 and F-008 both turned out to be **unauthorized-webcam-
access** issues, the minors review is a genuine launch prerequisite, not paperwork.

---

## SECURITY SCORE: 86 / 100

| Domain | Score | Basis |
|---|---:|---|
| Authorization / RLS | 94 | Every cross-user, privilege-escalation and anon-write probe blocked, verified by observed state change |
| Database | 92 | Zero dynamic SQL; `SECURITY DEFINER` all pin `search_path`; trigger fns unreachable via RPC; CHECK constraints back the triggers |
| Frontend / XSS | 95 | Zero raw HTML sinks; usernames DB-constrained to `^[a-zA-Z0-9_]{3,20}$`, killing stored XSS at source |
| Secrets | 95 | No real credential in history, tree or bundle; only the public `supabase-demo` keypair, guarded by `assertLocalOnly()` |
| Dependencies | 95 | **0 vulnerabilities** after `npm audit fix` (was 4); verified non-breaking |
| Multiplayer / WebRTC | 88 | F-001 + F-008 fixed; Realtime authz verified including **membership revocation** |
| Infrastructure | 85 | CSP, HSTS, XFO, nosniff, Referrer-Policy, Permissions-Policy all verified live |
| Authentication | 70 | Delegated to Supabase GoTrue; **not runtime-tested** — no JWT/session/reset coverage |
| Business logic | 70 | Per-write ceilings hold, but repeated writes compound (F-004, demonstrated) |
| Abuse resistance | 55 | Room joins throttled; **no global write rate limiting** |

Authentication and abuse resistance are the two genuinely weak areas, and both are honestly scored
rather than assumed.

---

## STATUS OF ALL FINDINGS

| ID | Severity | Title | Status |
|---|---|---|---|
| F-001 | HIGH | Private room codes world-readable → unauthorized live webcam access | **FIXED — VERIFIED** |
| F-002 | HIGH | Economy guard bypass via DELETE+INSERT | **FIXED — VERIFIED** |
| F-003 | LOW | `profiles` leaked `is_admin`/`is_banned`/`ban_reason` | **FIXED — VERIFIED** |
| F-004 | MEDIUM ↑ | No global write rate limiting (economy grinding) | **ACCEPTED RISK** (raised from LOW — now demonstrated) |
| F-005 | INFO | Vulnerable transitive dependencies | **FIXED — VERIFIED** (0 remaining) |
| F-006 | INFO | SPA catch-all returns 200 for unknown paths | **FALSE POSITIVE** |
| F-007 | INFO | Supabase demo JWTs in git history | **FALSE POSITIVE** |
| **F-008** | **HIGH** | **Ban evasion → banned users regain camera-room access** | **FIXED — VERIFIED** *(new)* |
| **F-009** | **LOW** | **Audit-log IP is client-influenceable** | **OPEN — documented** *(new)* |

---

## NEW FINDINGS (Phase 2)

### F-008 — HIGH — Ban evasion allows a banned user back into camera-enabled rooms

**CWE-284 Improper Access Control · OWASP A01:2025 · API5:2023 BFLA · ASVS V8.2.1**
**Component:** `multiplayer_rooms` policies, `join_multiplayer_room()`, `find_public_room()`, `feedback`, `user_reports`
**Prerequisite:** an account that has been banned by a moderator

**Root cause.** The `not public.current_user_banned()` predicate was applied to `user_progress`,
`sign_attempts`, `sign_verification_log`, `training_samples`, `friendships` and profile updates.
Multiplayer shipped later (`20260716000000`) and the predicate was **never carried across**;
`feedback` and `user_reports` never had it. A control that was correct when written simply did not
follow the product into a new feature.

**Verified attack (runtime, as a genuinely banned account):**

```
banned CREATES a multiplayer room ....... rows 0 -> 1     state change achieved
banned submits feedback ................. rows 0 -> 1
banned files a user report .............. rows 0 -> 1
join_multiplayer_room('AROOM1') ......... ALLOWED
  -> banned user is now a member of AROOM1: YES
```

**Impact.** The last line is what makes this HIGH. Room membership is exactly what the Realtime
policies (`room_receive_members`/`room_send_members`) authorize on, and a room member receives the
other participants' **live webcam stream** over WebRTC (`useMultiplayerSignaling.ts:161` publishes
the local camera via `pc.addTrack`). Bans here are a harassment and child-safety control; a ban
that does not remove camera access to other users fails at its core purpose.

**Not a duplicate of F-001.** F-001 was "anyone can *discover* a private room code." F-008 is "a
user we have explicitly ejected can walk back in." Different root cause, same webcam consequence —
which is itself the useful lesson: room membership is a webcam-access decision and every path to it
needs the same scrutiny.

**Fix** (`20260901180000`): ban predicate added to `rooms_insert_own`/`rooms_update_own`,
`feedback_insert_own`, `reports_insert_own`; an explicit ban check inside `join_multiplayer_room()`
(which is `SECURITY DEFINER` and therefore invisible to RLS); and `find_public_room()` no longer
matches banned users. **DELETE and `leave_multiplayer_room()` deliberately keep no ban predicate** —
a ban must never trap someone inside a room they are trying to leave, or leave an orphaned room
holding a seat.

**Verification — blocked *and* not over-tightened:**

```
PASS  banned user CANNOT create a room        PASS  NORMAL user CAN still create a room
PASS  banned user CANNOT join a room          PASS  NORMAL user CAN still join by code
PASS  banned matchmaking returns nothing      PASS  NORMAL matchmaking still returns a room
PASS  banned CANNOT submit feedback           PASS  NORMAL user CAN still submit feedback
PASS  banned CANNOT file reports              PASS  NORMAL user CAN still file a report
PASS  banned host CAN still delete their own room (not trapped)
```

**Regression test:** `web/e2e/security-rls.spec.ts` — F-008 pair (blocked + not-over-tightened).

---

### F-009 — LOW — Audit-log IP address is client-influenceable

**CWE-117 Improper Output Neutralization for Logs · OPEN**

`log_audit_event()` derives `ip` from `request.headers ->> 'x-forwarded-for'`. That header is
attacker-supplied on the way in, so the IP recorded against a security event may be spoofed.

Correctly, it is used **only for logging** — never for an authorization decision (verified). No fix
applied: the honest mitigation is procedural. **Treat `audit_logs.ip` as an indicator, not
evidence, during an incident**, and corroborate against Supabase's own edge logs.

---

## PREVIOUS FINDINGS — FINAL STATUS

### F-001 — FIXED — VERIFIED

Proven both ways against a real database:

```
PRE-FIX  (fix migration excluded):  EXPLOIT REPRODUCED: unrelated user reads private code (rows=1)
POST-FIX (all migrations):          unrelated user cannot read private room code (rows=0)
                                    host can still read own room .......... PASS
                                    legitimate member CAN read room info .. PASS
                                    public matchmaking still works ........ PASS
                                    anon cannot enumerate rooms ........... PASS
```

Realtime was tested separately and is sound, **including revocation**: a user who leaves a room
immediately loses signalling access (`EX-MEMBER reads topic: blocked`), so a removed participant
cannot keep receiving camera data.

### F-002 — FIXED — VERIFIED, with a Phase 1 correction

```
PRE-FIX:   client CAN delete own progress row ....... PASS
           arbitrary gold minted: gold = 99,000,000 .. EXPLOIT REPRODUCED
POST-FIX:  client CANNOT delete progress row ........ PASS
           INSERT capped ... gold=20000 xp=10000 rc=20  PASS
           UPDATE capped ... gold=20000 ............... PASS
           legitimate sync still works (gold=150) ..... PASS
           account deletion still cascades (GDPR) ..... PASS
```

**Correction to Phase 1.** Phase 1 asserted the exploit minted `999999999` gold. It does not — that
value trips the `user_progress_sane` CHECK constraint (ceiling 1e8), which Phase 1 never accounted
for. The vulnerability was still real, but the honest ceiling is ~1e8, not unbounded. Recorded
because an audit that quietly corrects its own overstatements is worth more than one that does not.

### F-003 — FIXED — VERIFIED

Runtime evidence pre-fix: anon read **4/4 profile rows including `is_admin`, `is_banned` and
`ban_reason`** (free-text moderator notes). RLS is row-level, so the fix is a curated projection:

- `public_profiles` view → `id, username, created_at, region`, granted to `anon`/`authenticated`
- base `profiles` → own-row-or-admin, via a new `current_user_is_admin()` helper

```
PASS  anon CANNOT read the profiles base table (rows=0)
PASS  authenticated user CANNOT read another user's privilege/moderation columns (rows=0)
PASS  user CAN still read their OWN profile flags (AuthContext depends on this)
PASS  admin CAN still read all profiles (moderation panel, n=4)
PASS  anon CAN read public_profiles (rows=4)
PASS  public_profiles exposes ONLY safe columns (id,username,created_at,region)
PASS  authenticated user CAN look up another username (friends search)
```

The admin carve-out **must** go through a `SECURITY DEFINER` helper: an inline subquery on
`profiles` inside a policy *on* `profiles` aborts with `infinite recursion detected in policy`.
Caught by running the migration, not by reading it.

Six client call sites moved to the view (`FriendsPage` ×2, `LeaderboardPage`, `AdminPanel` ×2,
`lib/username.ts`) — every one requested only `id, username`. Self-reads that need the sensitive
columns all filter on the caller's own id and were left untouched.

### F-004 — ACCEPTED RISK — severity raised LOW → MEDIUM

Now demonstrated rather than theorised:

```
10 parallel capped writes:  gold 0 -> 199,990   (single-write ceiling = 20,000)
```

The per-write cap holds perfectly; nothing limits the *number* of writes, so a script grinds
linearly. **Deliberately not "fixed."** `useProgressSync` debounces at 3s and retries on failure,
so a DB-level write throttle tight enough to deter grinding would sit close enough to legitimate
sync traffic to risk silently dropping real user progress — a worse outcome than the cheating it
prevents. The correct fix is infrastructure-level (Supabase/edge rate limiting) or
server-authoritative progression, neither of which is a schema patch.

Impact is bounded: leaderboard integrity and gold-gated cosmetics. **No PII, no money** — there is
no payment system.

Room capacity was tested for the same class of bug and is **safe**: three concurrent joins on a
2-seat room yielded exactly 2 members (`for update` row lock holds).

### F-005 — FIXED — VERIFIED

`npm audit fix`: **4 vulnerabilities → 0**. Verified non-breaking (777 tests, typecheck, build all
pass afterward). Phase 1's reachability triage still stands — `browserslist`/`fast-uri`/`nanoid`
were build-time only and `dompurify` never entered the bundle — but patching removes the
supply-chain exposure regardless.

### F-006 / F-007 — FALSE POSITIVE (unchanged)

`/.git/config` returns the SPA shell via the catch-all rewrite (`Content-Type: text/html`), not a
git config. The two JWTs decode to `iss: supabase-demo`, the universally-published Supabase CLI
local keypair, additionally guarded by `assertLocalOnly()`.

---

## COMPLETE PERMISSION MATRIX (executed)

Rows visible per role; fixtures owned by **alice**:

| Table | anon | bob | banned | admin |
|---|---:|---:|---:|---:|
| `profiles` | **0** ✅ | own | own | 4 (moderation) |
| `user_progress` | 4 | 4 | 4 | 4 |
| `sign_attempts` · `training_samples` · `sign_verification_log` | 0 | 0 | 0 | 0 |
| `friendships` · `feedback` · `user_reports` | 0 | 0 | 0 | own/admin |
| `multiplayer_rooms` · `_members` · `room_join_attempts` | 0 | 0 | 0 | 0 |
| `world_flags` · `audit_logs` · `admin_audit_log` | 0 | 0 | 0 | admin |
| `weekly_leaderboard` (view) | 3 | — | — | — | intended |
| `public_profiles` (view) | 4 | 4 | 4 | 4 | intended |

`user_progress` remains world-readable **by design** (the leaderboard reads it) and holds no PII.
The analytics views (`most_failed_signs`, `sign_attempt_stats`, `ai_veto_stats`, `daily_accuracy`)
returned 0 rows to anon.

**All blocked (graded on observed state change, not absence of error):** every bob→alice
read/update/delete across profiles, progress, attempts, friendships, rooms, reports, feedback and
world flags; room hijacking; self-promotion to admin; a banned user unbanning themselves or
clearing their own moderation note; all 9 admin RPCs from a non-admin **and** from anon; all 7
trigger functions called directly; anon writes of every kind.

---

## TESTING EVIDENCE

| Command | Result |
|---|---|
| `node SECURITY_AUDIT/harness/verify-prior.mjs` | **ALL CHECKS PASSED** — F-001/F-002 exploits reproduce pre-fix, blocked post-fix |
| `node SECURITY_AUDIT/harness/verify-phase2.mjs` | **ALL PHASE 2 CHECKS PASSED** — F-008/F-003 blocked, legitimate flows intact |
| `node SECURITY_AUDIT/harness/writes.mjs` | **No unauthorized state change achieved** |
| `node SECURITY_AUDIT/harness/matrix.mjs` | Full object × role matrix; no unintended exposure |
| `node SECURITY_AUDIT/harness/realtime-race.mjs` | Realtime authz + revocation correct; capacity race safe; economy grinding confirmed (F-004) |
| `npx tsc -b` | Clean |
| `npm run test` | **777 passed**, 63 files |
| `npx oxlint` | 31 warnings, all pre-existing (`react-hooks/exhaustive-deps`) |
| `npm run build` | Clean |
| `npm audit` | **0 vulnerabilities** (was 4) |
| Secret scan (tree + history + bundle) | No real credentials |

**Method note.** All 36 migrations were applied to real PostgreSQL 18.3 via PGlite (WASM, no Docker
needed) with a Supabase-shaped bootstrap: `anon`/`authenticated`/`service_role` roles, `auth.uid()`
driven by the same JWT-claims GUC PostgREST uses, and Supabase's default grants. Attacks ran as
unprivileged roles through that path, so results transfer to production. See
`SECURITY_AUDIT/harness/README.md`.

### Not verified

GoTrue is out of reach of a database harness: **JWT issuance and signature verification, password
policy, reset-token entropy/expiry/single-use, session rotation and revocation, and account
enumeration remain NOT VERIFIED.** This is the largest remaining blind spot and warrants a runtime
pentest before scaling. Also untested: OWASP ZAP/Nuclei/Schemathesis (not installed), and iOS
WebKit e2e (browser binary unavailable).

---

## GIT STATUS

- **Branch:** `security/audit-2026-09-01`
- **Commits:** `449504f` (Phase 1) · `cde3832` (Phase 2) · this commit (migration split + rollout verification)
- **Pushed:** YES → `origin/security/audit-2026-09-01`
- **Merged to `main`:** **NO — blocked on step 1, which needs credentials I do not have**
- **Deployment triggered:** No

**What I could not do, stated plainly:** `supabase db push` requires a Supabase access token or the
database password. Neither is present on this machine — the only credential available is the public
anon key, which cannot execute DDL. I did not attempt to obtain or handle those credentials, and
production was never touched. Everything short of that step is done, tested and pushed.

## IF A HOSTILE RESEARCHER SPENT A WEEK

Where I would look next, in order — and why each is now hard:

1. **GoTrue.** The only substantial untested surface. Token replay after sign-out, reset-token
   entropy, session fixation. *Recommend a runtime pentest here.*
2. **Economy grinding (F-004).** Already works, already documented, bounded to leaderboard/cosmetic
   integrity. The most likely thing an attacker actually does.
3. **A future migration re-opening F-001/F-002/F-003/F-008.** Every one came from a *combination*
   of individually reasonable changes, which is why all four now have executable regression tests
   in CI rather than prose in a document.
4. **Client-side gating.** Fully attacker-controlled and never a boundary — the app puts 100% of
   authorization in Postgres, which is why the frontend was the *least* productive place to attack.
5. **Room-code brute force.** Throttled at 10/min *before* code existence is revealed, and codes are
   no longer enumerable. Genuinely closed.
6. **Stored XSS via profile fields.** Closed at the database: usernames are `^[a-zA-Z0-9_]{3,20}$`,
   and the frontend has zero raw HTML sinks.

---

*Security is never proven by an absence of findings. This report states exactly what was executed,
what was blocked, what remains untested, and one correction to Phase 1's own overstatement.*
