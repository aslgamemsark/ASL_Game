# Security Audit — ASL Game ("SignUp")

_Senior-engineer, pentest-style architectural review. Date: 2026-07-06.
Reviewer: automated deep review, grounded in the actual repository at commit on branch
`claude/replay-and-coaching-2026-07-06`. Companion docs: [THREAT_MODEL.md](THREAT_MODEL.md),
[SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md), [DEPENDENCY_AUDIT.md](DEPENDENCY_AUDIT.md)._

## How to read this

Findings are ordered by severity. Each has: severity, why it matters, how to reproduce, exact
files, and a fix. **Confidence is stated** — where a finding depends on a Supabase *dashboard*
setting I cannot see from the repo, it is marked **⚠ NEEDS VERIFICATION** rather than assumed.

The single most important structural fact (repeated from the threat model because it drives half
the findings): **there is no backend server. RLS is the entire authorization layer, and the
browser is fully attacker-controlled.** Any value the client computes — `passed`, `xp`, `gold`,
"I won the match" — is forgeable.

---

## VULN-01 — Client-authoritative progress & leaderboard (scores are forgeable) — **HIGH**

**Why it matters:** The leaderboard, XP, levels, streaks, and completed-lesson state are written
**directly by the client** and the database validates only *ownership*, never *values*. Any
logged-in user can make themselves #1 forever, "complete" every lesson, and unlock every
story/badge — with a single REST call. For a competitive/gamified product this destroys
leaderboard trust, the core social hook.

**Exact files:**
- `web/src/hooks/useProgressSync.ts:62-77` — `upsert` of `xp`, `level`, `streak`,
  `longest_streak`, `completed_lessons`, `sign_accuracy` straight from the local store.
- `web/src/hooks/useProgressSync.ts:87-92` — `logSignAttempt` inserts `passed` as a client-chosen
  boolean.
- `supabase/migrations/20260701235816_initial_schema.sql:37-38` — the only guard is
  `auth.uid() = user_id`. No `CHECK`, no server-side computation.

**How to reproduce:** In the browser console while logged in:
```js
// top the leaderboard
await supabase.from('sign_attempts').insert(
  Array.from({length: 500}, () => ({ user_id: MY_ID, sign_id: 'HELLO', passed: true }))
);
// or just set XP to a million
await supabase.from('user_progress').upsert({ user_id: MY_ID, xp: 1_000_000, level: 9999 });
```
Both succeed — they satisfy `auth.uid() = user_id`.

**Fix (short term):** Treat the leaderboard as **best-effort/social**, not competitive, and label
it as such. Add sanity `CHECK` constraints (e.g. `xp >= 0`, `level` derivable from xp) and a
per-user insert rate limit (VULN-06) to blunt the crudest abuse.

**Better alternative (real fix):** Move score-affecting writes behind a **Supabase Edge Function
(or Postgres `SECURITY DEFINER` RPC)** that is the *only* thing granted INSERT/UPDATE on
`sign_attempts`/`user_progress`; revoke direct client write. The function recomputes XP from a
server-trusted event and rejects impossible deltas. Full anti-cheat for a camera app is hard (the
recognition itself runs client-side), so the pragmatic target is "raise the cost of cheating above
the effort a casual user will spend," not perfection.

---

## VULN-02 — Multiplayer: client-awarded rewards + spoofable peers + guessable rooms — **HIGH**

**Why it matters:** 1v1 multiplayer is pure peer-to-peer over Supabase Realtime **broadcast** with
no authoritative referee. The winner grants *themselves* +200 signs and +10 gold client-side;
peer identity is a self-declared payload field; room codes are 6 characters. An attacker gets free
currency and can hijack/snoop matches.

**Exact files:**
- `web/src/pages/MultiplayerPage.tsx:109,146` — channel name `mp-room-${roomId}` (roomId is a
  short code); anyone who knows/guesses it joins.
- `web/src/pages/MultiplayerPage.tsx:175` — `join` payload carries `userId`/`username` chosen by
  the sender → **identity spoofing**.
- `web/src/pages/MultiplayerPage.tsx:127,133,170,185` — game state (`start`, `signed`, `guess`)
  is broadcast between peers with no server validation; win → reward is applied locally.

**How to reproduce:** Join any `mp-room-<code>` channel with the anon key, broadcast a `join` with
an arbitrary `username`, then broadcast the winning `guess`. Client applies the reward. Or brute
6-char codes to enumerate live rooms.

**⚠ NEEDS VERIFICATION:** Whether **Realtime "Broadcast authorization"** (channel RLS) is enabled
in the Supabase dashboard. If it is *off* (the default), the above works with just the anon key.
Verify in Dashboard → Realtime → Settings.

**Fix:** (a) Enable Realtime channel authorization so only authenticated participants of a room can
subscribe/broadcast. (b) Make room codes long & random (≥ 128 bits, e.g. a UUID). (c) Award match
currency through the same server-side RPC as VULN-01, computed from a server-refereed result — not
on the client.

---

## VULN-03 — Public `profiles` table leaks email-derived usernames to anyone — **MEDIUM (privacy)**

**Why it matters:** `profiles` is world-readable (`using (true)`), and usernames **default to the
part of the email before `@`** (`handle_new_user`). So `john.smith@gmail.com` becomes public
username `johnsmith`, readable by any anonymous visitor for *every* user — a partial-identity /
email-guessing disclosure across the whole user base, harvestable at scale.

**Exact files:**
- `supabase/migrations/20260701235816_initial_schema.sql:16` — `profiles_select_public ...
  using (true)`.
- `...:118-120` — username derived from `split_part(new.email, '@', 1)`.

**How to reproduce:** `await supabase.from('profiles').select('id, username')` while logged out
returns every user.

**Fix:** The leaderboard needs *some* public display name, so don't kill public read outright —
instead: (a) stop deriving usernames from email (generate a neutral handle like `signer_4f9a2`, let
users optionally set a display name); (b) if feasible, expose only the columns the leaderboard
needs through a dedicated view and restrict base-table `profiles` reads to `authenticated`. At
minimum, decouple the public identifier from the email.

---

## VULN-04 — Biometric-ish landmark data, uploaded by default (opt-OUT), vague consent — **MEDIUM (privacy/legal)**

**Why it matters:** `training_samples.frames` stores per-attempt **hand/body landmark sequences**
(geometry of a person's hands over time) on the server. Collection is **on by default (opt-out)**,
and the consent copy just says "help improve the AI." Hand/body geometry can qualify as
**biometric data** under laws like Illinois BIPA and GDPR (Art. 9), which expect *explicit,
informed, opt-in* consent — not a default-on toggle buried in Profile settings. This is also in
tension with the project's own stated architecture rule ("no landmark streaming to a server").

**Exact files:**
- `supabase/migrations/20260701235816_initial_schema.sql:159-160,168-179` — `collect_training_data
  default true` and the `training_samples` table.
- `web/src/hooks/useProgressSync.ts:168-176` — `logAttempt` inserts frames, gated only by the
  default-on flag.
- `web/src/components/home/ProfileTab.tsx:435-438` — consent text: _"Save hand-landmark
  coordinates (not video) from your attempts as future training data."_ (no mention of commercial
  use, retention, or that it's biometric-adjacent).

**Fix:** Before any public/real-user launch: (a) make collection **opt-in** (default false), or at
least present the choice prominently during onboarding; (b) rewrite the consent to name the data
type, purpose (incl. potential commercial model training), sharing, and retention; (c) add a
data-deletion path (delete-my-training-data). RLS is correctly own-user here — this is a *consent
& default* problem, not an access-control one. Ties into the WLASL/ASL-Citizen licensing note in
`docs/LICENSING_CHECKLIST.md`.

---

## VULN-05 — No HTTP security headers (CSP / HSTS / X-Frame-Options / nosniff) — **MEDIUM**

**Why it matters:** `vercel.json` sets no response headers and `index.html` has no CSP meta. That
means: no clickjacking protection (the app can be framed → UI-redress attacks against a webcam
app), no HSTS, no `X-Content-Type-Options`, and no CSP as defense-in-depth if an XSS ever slips in.
XSS surface today is clean (no `dangerouslySetInnerHTML`/`eval`/`innerHTML`; React auto-escapes),
so this is defense-in-depth, not an active hole — but it's cheap and expected for production.

**Exact files:** `vercel.json` (no `headers` block); `index.html` (no CSP `<meta>`).

**Fix:** Add a `headers` block to `vercel.json`:
```json
"headers": [{
  "source": "/(.*)",
  "headers": [
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
    { "key": "Permissions-Policy", "value": "camera=(self), microphone=()" },
    { "key": "Content-Security-Policy", "value": "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'" }
  ]
}]
```
_Test the CSP against the app before shipping — MediaPipe/TF.js use WASM (`wasm-unsafe-eval`) and
fetch model/wasm assets; tighten `connect-src`/`script-src` to the exact CDN origins they use, and
verify Google OAuth's redirect isn't broken by `frame-ancestors`/`connect-src`._

---

## VULN-06 — No rate limiting on inserts (cost / data-poisoning DoS) — **MEDIUM**

**Why it matters:** Nothing throttles `sign_attempts` / `training_samples` inserts. A script can
write millions of rows → Supabase storage/egress cost blowup and **training-data poisoning**
(garbage frames pollute the proprietary dataset that `tools/export_supabase_samples.py` feeds into
model retraining).

**Exact files:** `web/src/hooks/useProgressSync.ts:87-92` (`logSignAttempt`), `:168-176`
(`logAttempt`) — unbounded client-driven inserts.

**Fix:** Route these through a `SECURITY DEFINER` RPC / Edge Function that enforces a per-user
insert budget (e.g. ≤ N/minute), and/or enable Supabase's platform rate limits. Add a server-side
`created_at`-window count check. Consider a "poisoning" guard (drop frames that fail basic shape
validation) before rows enter the training set.

---

## VULN-07 — In-app currency & unlocks live only in `localStorage` — **LOW today / CRITICAL if monetized**

**Why it matters:** `gold`, `signs`, `ownedCosmetics`, and the new `unlockedWorldIds` are stored
**only in `localStorage`** and never authoritatively validated server-side. A user can open
DevTools and set `gold` to a billion, unlock every world, own every cosmetic. Harmless while
everything is free and cosmetic — but the **moment real money buys gold**, this becomes a critical
economic exploit (free premium currency).

**Exact files:**
- `web/src/stores/useUserStore.ts:33-34` (`signs`/`gold` in the persisted store),
  `:407-412` (`purchaseCosmetic`), and the new `unlockWorldWithGold` action.
- Persisted to `localStorage` key `asl-game-progress` (Zustand `persist`).

**Fix:** No action needed while purely cosmetic/free. **Before monetizing:** move currency balance
and purchases server-side (authoritative wallet + transactional purchase RPC), and never trust a
client-reported balance.

---

## VULN-08 — Username availability check is TOCTOU (race) — **LOW**

**Why it matters:** `signUpWithEmail` checks availability then updates in two steps; two concurrent
signups could both pass the check. **Mitigated** because `profiles.username` is `unique not null`
at the DB level, so the DB rejects the loser — worst case is a confusing error, not a duplicate.

**Exact files:** `web/src/contexts/AuthContext.tsx:57-77`; constraint at
`supabase/migrations/20260701235816_initial_schema.sql:10`.

**Fix:** Low priority. Handle the unique-violation error gracefully in `signUpWithEmail` and show
"username taken" rather than a raw DB error.

---

## Things that are GOOD (verified, not just assumed)

- **RLS is enabled on every table** with correct `auth.uid() = user_id` own-row policies
  (`profiles`, `user_progress`, `sign_attempts`, `friendships`, `training_samples`). Friendships
  has proper participant-scoped select/insert/update/delete policies.
- **Analytics views use `security_invoker = true`** (migration lines 84, 198, 210, 224, 238) — so
  personal-insight views run as the querying user and inherit `sign_attempts` RLS; **no cross-user
  leakage** through the views. Personal views are granted to `authenticated` only; only
  `weekly_leaderboard` is granted to `anon`. Correct.
- **No secrets in the repo or git history.** The only `SUPABASE_SERVICE_ROLE_KEY` reference is a
  `eyJ...` placeholder in a docstring (`tools/export_supabase_samples.py:20`); the key is read from
  env at runtime and documented as "NEVER ship in the web client." `.env.local` is gitignored
  (`web/.gitignore` `*.local`); no `.env`/secret/`.pem` file ever appears in history.
- **Anon key in the client is by-design**, not a leak (Supabase model: anon key + RLS).
- **No XSS sinks**: no `dangerouslySetInnerHTML`, `eval`, `new Function`, `innerHTML`, or
  `document.write` in `src/`. React auto-escaping is the only render path. `localStorage` holds
  only non-secret UI prefs (theme, replay-enabled flag, camera-onboarded flag).
- **Auth uses Supabase primitives** — no homemade crypto, no custom JWT signing/validation, no
  custom password hashing. `signInWithOAuth` uses `redirectTo: window.location.origin` (not
  user-controlled → no open redirect). Sessions persist + auto-refresh via the SDK
  (`web/src/lib/supabase.ts`).
- **`npm audit` = 0 vulnerabilities** (prod and full) at time of audit.
- **On-device recognition**: webcam frames and attempt-replay video never leave the device
  (in-memory `Blob`/object URL, revoked on unmount — `useAttemptRecorder.ts`).

## ⚠ Items I cannot verify from the repo (Supabase dashboard settings — CHECK THESE)

1. **Email confirmation required?** (Auth → Providers → Email). If off, users can sign up with
   others' emails unconfirmed.
2. **Realtime broadcast authorization enabled?** (drives VULN-02 severity).
3. **Leaked-password protection / auth rate limits** (Auth → Policies).
4. **Storage buckets** — none referenced in code; confirm none are public in the dashboard.
5. **Whether the older `supabase/schema.sql` or the migration is what's actually deployed** —
   production had extra tables/views not in the committed schema when last inspected; reconcile
   the live DB against the committed migration.
