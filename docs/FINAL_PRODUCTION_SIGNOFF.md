# QuickSign — Final Production Sign-Off

_Date: 2026-07-15 · Branch reviewed: `main` @ post-merge of `game-feel-and-launch-prep` (495 tests
passing, `tsc` clean, production build clean)._

## Scope & honesty note

This is a real sign-off, not a rubber stamp. Findings below are grounded in three targeted audits
run this session (repo-wide TODO/dead-code scan, a full Supabase security review, and a multiplayer
concurrency review) plus direct reading of the highest-risk files. It is **not** a claim that every
one of the ~200 source files was read line-by-line — where coverage is partial, that is stated.
Nothing here is invented; every finding cites a file/location. Categories that are genuinely in good
shape are called out as such.

---

## Severity legend
- **P0 / Blocker** — do not launch publicly until addressed.
- **P1 / High** — fix within the first week; real user-facing or security impact.
- **P2 / Medium** — schedule soon; limited blast radius.
- **P3 / Low** — cleanup / polish / defense-in-depth.

---

## Findings

### Security & database

| # | Severity | Finding | Location | Impact | Fix | Est. |
|---|----------|---------|----------|--------|-----|------|
| S1 | ~~P2~~ **FIXED** | `admin_set_username` had a stray `anon`/`PUBLIC` EXECUTE grant that the 2026-07-12 hardening pass had removed from every other admin RPC | migration `20260715010000` (applied this session) | Unauth-reachable RPC surface (still blocked by the internal `is_admin` check, so not exploitable) | Revoked from `public`/`anon`; verified in live DB | Done |
| S2 | P2 | `showcase_badges` (added after the economy guard trigger) is not covered by `guard_progress_deltas()` — no length cap, no check that shown badges are actually owned | `20260714000000_showcase_badges.sql`; `useUserStore.ts` caps to 3 client-side only | A crafted REST call can display unearned badges publicly on the leaderboard. Cosmetic integrity only — no economy/privilege impact | Extend the guard trigger: cap `array_length(showcase_badges,1)=3` and require each ∈ `badges` | 1–2 h |
| S3 | P3 | `speed_high_scores` jsonb is fully client-trusted and drives client-side badge eligibility | `useProgressSync.ts`, `useUserStore.ts` badge checks | A crafted score lets a user then "earn" speed badges through the normal flow. Leaderboard/badge integrity, no economic impact | Bound `score`/`combo` in the guard trigger, or move speed scoring server-side | 2–4 h |
| S4 | P3 | `profiles.region` has no format CHECK constraint; client writes it directly | `20260712120000_region_leaderboard.sql` | A user can spoof their region string (display-only, feeds region leaderboard filter) | Add `CHECK (region ~ '^[A-Z]{2}$')` | 30 m |
| S5 | P3 | `admin_set_username` lacks the `log_audit_event(...permission_denied...)` call its sibling RPCs have | `20260715000000_admin_set_username.sql` | A rejected non-admin attempt leaves no durable audit trail (only the ephemeral error) | Add the same permission-denied log line before the `raise` | 30 m |
| S6 | P3 | Migration replay ordering bug: `20260707120000` policies `sign_verification_log` before that table is created in `20260709010000` | those two migrations | A fresh-from-scratch `migrations/` replay errors out — disaster-recovery / staging-parity risk, not a live-DB hole | Reorder/renumber so the table creation precedes the policy | 1 h |

**Genuinely solid:** All 7 admin RPCs use the correct `SECURITY DEFINER` + server-side
`auth.uid()`-based `is_admin` re-check + audit log + `search_path=public` pattern. `admin_set_username`
has no SQL-injection surface (parameterized, no dynamic SQL). RLS is deny-by-default and every
write policy is scoped to `auth.uid()=owner`. The core economy (gold/xp/signs/cosmetics/world-unlocks)
has server-side delta clamping via `guard_progress_deltas()`. Ban enforcement is server-side
(RLS-independent of the client's forced sign-out). No `using(true)` write policies. The slur username
that motivated the moderation work has been removed and all live usernames now pass the filter.

### Multiplayer / concurrency

| # | Severity | Finding | Location | Impact | Fix | Est. |
|---|----------|---------|----------|--------|-----|------|
| M1 | ~~P1~~ **FIXED** | Duel round-1 role assignment computed the same boolean on both clients → both players signed at once | `DuelPage.tsx` (fixed via `lib/duelRoles.ts` + regression test) | Core 1v1 mode was broken | Extracted to one pure `isSignerForRound()` used by all call sites; unit-tested | Done |
| M2 | P2 | Room mode (up to 4 players) has **no** disconnect/forfeit handling at all | `RoomPage.tsx`, `useMultiplayerSignaling.ts` | If a player drops mid-round, the round hangs until the 10s host timeout; if the signer drops, nobody can guess correctly until timeout. UX stall, not state-divergence | Add a `bye` broadcast + roster pruning (duel already has this pattern; port it to rooms) | 3–5 h |
| M3 | P3 | WebRTC is P2P with public STUN + OpenRelay TURN; no reconnection beyond duel's rejoin-by-code | `useMultiplayerSignaling.ts` | Video can fail behind strict NATs/corporate firewalls with no fallback; multiplayer is inherently best-effort | Document as a known limitation; consider a TURN-only fallback path if reliability complaints arise | — |

**Genuinely solid:** Room mode is host-authoritative and broadcast-driven — turn/signer/score
decisions are computed once by the host and pushed to clients, which only check "is this me?" So it
does **not** share the duel bug's class. The duel fix is now single-sourced and regression-tested.

### AI / recognition pipeline

| # | Severity | Finding | Location | Impact | Fix | Est. |
|---|----------|---------|----------|--------|-----|------|
| A1 | P2 | Cross-dataset generalization gap: the model scores well on held-out splits of its training sources but far lower on genuinely unseen data (documented ~41% on unseen MS-ASL in prior analysis) | `ml/` + `docs/MODEL_STATUS.md` | Real-world recognition on users who don't sign like the training signers will be weaker than test-set numbers imply. The ML layer is veto-only, so this degrades disambiguation, not core pass/fail | Keep collecting real user data (pipeline exists); retrain periodically. This is inherent to the data available, not a bug | ongoing |
| A2 | P2 | RED and WANT share THANK_YOU's exact movement-threshold block, which needed a 0.25→0.85 fix once actually confusor-tested — RED/WANT were never individually tested | `engine/signs/index.ts` (comment flags this) | RED/WANT may accept a non-signing confusor the way THANK_YOU did pre-fix | Run each through `/calibrate` (correct + confusor), tune from real logs (see `docs/CALIBRATION_LOG.md` method) | 1–2 h + recording |
| A3 | P3 | HELP and DOCTOR-class signs are at a documented rule-verifier ceiling (accepted risk, kept playable) | `engine/signs/`, tests marked `it.todo` | These signs recognize less reliably; documented, not silent | Longer-term: lean on the ML layer once it has more real data for these classes | ongoing |
| A4 | P3 | 6 `_real.json` calibration fixtures are stale (predate a threshold recalibration), parked as `it.todo` | `web/tests/test-all-signs.ts` | Reduced regression coverage for those signs | Re-record the 6 fixtures | 1 h + recording |

**Genuinely solid:** Uses MediaPipe Tasks API (forward-compatible with the browser port — already
done). Shoulder-width normalization matches the rule engine's invariance. Dominant/nondominant
hand-slotting is now role-based (left-handed users handled). NO_SIGN negative class exists. The ML
layer is correctly veto-only (can reject a rule-pass, never fabricate one), which is the right
conservative design for an imperfect model. Cross-dataset holdout evaluation is wired into training.

### Code quality / architecture

| # | Severity | Finding | Location | Impact | Fix | Est. |
|---|----------|---------|----------|--------|-----|------|
| C1 | ~~P3~~ **FIXED** | Unconditional `console.warn` in a production path (siblings are DEV-gated) | `useRecognition.ts:120` | Console noise in production | DEV-gated this session | Done |
| C2 | P2 | No production error/crash telemetry — all errors go to `console.error`; real users' crashes are invisible | `lib/errorReporting.ts` (self-described stopgap) | You launch blind to production incidents | Wire Sentry (or equivalent); the file is structured to accept it | 2–4 h |
| C3 | P3 | ~20 `eslint-disable react-hooks/exhaustive-deps` across pages/hooks | Duel/Room/Practice/Calibration/Speed pages, several hooks | Systemic suppression; a latent source of stale-closure bugs, especially in camera/multiplayer lifecycle code | Dedicated review pass; convert to refs or correct deps where safe | 4–8 h |
| C4 | P3 | Stale "TEMPORARY DEBUG" comment on permanent, runtime-gated instrumentation | `useClassifier.ts:75-77` | Misleading label only | Rename the comment | 5 m |

**Genuinely solid:** The codebase is unusually disciplined about documenting its own rough edges —
nearly every "not implemented / for now / known gap" comment carries a commit reference and
root-cause. Python side (`core/`, `ml/`, `tools/`) is essentially free of TODO/FIXME/HACK markers.
No `it.skip`/`.only` anywhere; deliberately-skipped tests use `it.todo` with documented reasons.
Only two env vars are read, both documented in `.env.example` and defensively handled. Recognition
core is theme-agnostic and shared (not duplicated per scenario), per the project's own architecture
rule.

### Performance / bundle

| # | Severity | Finding | Location | Impact | Fix | Est. |
|---|----------|---------|----------|--------|-----|------|
| P1 | P3 | Large chunks: `dist-*.js` ~1.08 MB (MediaPipe/TF.js) and `AvatarLabPage` ~664 KB exceed the 500 KB warning | build output | Slower first load, especially on mobile/poor networks. AvatarLab is already lazy-loaded (dev-only route), so its weight doesn't hit normal users | MediaPipe/TF weight is inherent; ensure it's lazy-loaded only on pages that recognize. Confirm AvatarLab never ships to the main entry | 1–2 h to verify |
| P2 | P3 | No image/GLTF Draco/texture-compression audit performed here | avatar assets | Potential avatar load cost | Audit if/when avatar ships to end users | — |

**Genuinely solid:** Route-level code splitting is in place (per-page chunks visible in build). PWA
service worker precaches. The heavy recognition libs are the unavoidable cost of on-device inference
(which is itself the correct privacy choice — no video leaves the device).

### Privacy / legal (needs human judgment — see LAUNCH_CHECKLIST)

| # | Severity | Finding | Impact |
|---|----------|---------|--------|
| PR1 | **P0 for public launch** | A camera-based app likely to attract minors, collecting hand/pose landmark data, with `collectTrainingData` defaulting on. COPPA (US, under-13) and GDPR (EU, incl. minors) posture is unverified. | This is the single biggest genuine launch risk and it is legal, not code. Needs a real privacy policy, a verified consent model appropriate for minors, documented retention/deletion, and a decision on the opt-out-vs-opt-in default before public marketing. |

**Genuinely solid (engineering side of privacy):** Recognition runs fully on-device — no video or
landmark stream is sent for recognition. There is an explicit training-consent prompt on first
sign-in and a Settings toggle. Training data is consent-gated. The pieces exist; what's missing is
the legal wrapper and a deliberate default decision.

---

## Category scores (1–10, honest)

| Category | Score | One-line justification |
|---|---|---|
| Architecture | 8 | Clean shared-engine design, single-sourced role logic, host-authoritative rooms. WebRTC P2P is fragile by nature. |
| Code Quality | 8 | Disciplined, self-documenting, tested. A few systemic eslint-disables. |
| Maintainability | 8 | Strong comments-with-commit-refs culture; small, focused modules. |
| AI | 6 | Right architecture and safeguards; real cross-dataset generalization gap inherent to available data. |
| Security | 8 | Solid admin/RLS/economy-guard pattern; the one medium gap is fixed; remaining items are low-severity defense-in-depth. |
| UI | 7 | Polished, animated, themed (per screenshots). Full per-screen audit not completed this pass. |
| UX | 7 | Clear game loop; multiplayer disconnect UX (rooms) and recognition frustration on ceiling signs are the weak spots. |
| Accessibility | 5 | Not formally WCAG-audited this pass; heavy motion, camera-dependence, and unverified keyboard/screen-reader support are real gaps. |
| Performance | 7 | Good splitting/PWA; heavy inference libs are inherent; no deep profiling done. |
| Testing | 7 | 495 unit/integration tests, strong recognition regression suite. No E2E for multiplayer, no automated a11y. |
| Scalability | 7 | Supabase + on-device inference scales well; leaderboard view and P2P signaling are the watch points. |
| Privacy | 5 | On-device recognition is excellent; legal/consent posture for minors is unverified (the real blocker). |
| Deployment | 6 | Vercel+Supabase works; no crash monitoring, no documented CI gate on tests, no rollback runbook. |
| Database | 8 | Well-constrained, RLS-solid; one replay-ordering bug and two post-hoc columns lack guard coverage. |
| Avatar System | N/A* | AvatarLab is a dev-only route not in the user launch path; not scored for user-facing launch. |
| Game Design | 7 | Streaks, quests, shop, chests, multiplayer, leaderboards — a complete loop. Balance not deeply tested. |
| Documentation | 8 | Genuinely strong internal docs (MODEL_STATUS, CALIBRATION_LOG, handoffs). |
| Developer Experience | 8 | Fast tests, clear structure, good primers. |
| Technical Debt | 7 | Low and well-tracked; the eslint-disable cluster and stale fixtures are the main items. |
| **Overall Production Readiness** | **7** | **Engineering is genuinely strong; the blockers are observability and legal/privacy, not broken code.** |

\* Avatar system was not deep-reviewed because it is not on the end-user launch path (dev-only
`/avatarlab` route). If avatars ship to users, it needs its own review pass (see roadmap).

---

## The one question

**If this were my startup, would I launch QuickSign today?**

## NO

**Brutally honest explanation:**

Not because the code is bad — it genuinely isn't. The engineering here is above the bar for most
pre-launch products I've seen: 495 passing tests, a disciplined self-documenting codebase, a
correctly-conservative AI design, a solid Supabase security model, and a real multiplayer feature
with its worst bug already fixed and regression-tested this session. If "launch" meant "flip it on
for a controlled beta of consenting adults you personally know," I'd say yes today.

But "launch" for a public consumer app — especially one that **turns on a camera and collects
hand/body landmark data, is themed and marketed in a way that will attract children, and defaults
training-data collection to on** — carries two obligations that are not yet met, and both are the
kind you cannot un-ring after the fact:

1. **You are flying blind.** There is no crash/error telemetry (`errorReporting.ts` says so itself).
   The moment real users hit an edge case — a browser you didn't test, a camera permission quirk, a
   WebRTC failure behind a corporate firewall — you will not know it happened. Launching a product
   with zero production observability means your first bug report is a churned user, not an alert.
   That's a ~half-day fix (wire Sentry) and it should block launch.

2. **The privacy/legal posture for minors is unverified.** COPPA and GDPR are not code problems you
   can test your way out of. A camera app that appeals to kids and collects biometric-adjacent data
   needs a real privacy policy, an age-appropriate consent model, and documented retention/deletion
   — and a deliberate decision about whether training collection should be opt-in rather than
   default-on for this audience. The engineering foundation for this is excellent (recognition is
   fully on-device, consent plumbing exists), which is exactly why it would be a shame to undermine
   it with an untested legal wrapper.

Everything else I found is P2 or lower and can ship-then-fix: Room-mode disconnect handling, the
showcase-badge/speed-score integrity gaps (cosmetic), RED/WANT threshold verification, the stale
fixtures. None of those would stop me.

**The gap between "no" and "yes" here is small and concrete:** wire error monitoring (~half a day)
and close out the privacy/legal checklist (mostly non-engineering). Do those two things and this is
a confident YES for a beta, and a strong foundation for a full launch. The product is close. It just
isn't a same-day "today."

See `LAUNCH_CHECKLIST.md` for the exact remaining tasks, `KNOWN_LIMITATIONS.md` for what to ship
honestly, and `POST_LAUNCH_ROADMAP.md` for sequencing after go-live.
