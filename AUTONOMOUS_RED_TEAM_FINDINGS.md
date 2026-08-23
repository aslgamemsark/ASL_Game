# AUTONOMOUS_RED_TEAM_FINDINGS.md

**Session:** 2026-08-22/23 · **Branch:** `audit/autonomous-red-team` (from `feat/qs-015-speak-sign-names`; NOT merged)
**Companion docs:** `OX_ALPHA_FINDINGS.md` (Round 1–2 handoff), `ASL_SHIPPING_CHANGELOG.md` (batches 1–2), `ASL_PRODUCT_AUDIT.md` (score history)

---

## FINDINGS INDEX

| ID | Category | Severity | Status | Commit |
|---|---|---|---|---|
| AR-001 | Auth UX | P1 | FIXED + TESTED | `117269f` |
| AR-002 | Reliability / telemetry | P1 | FIXED + TESTED | `c9b8150` |
| AR-003 | Performance / camera lifecycle | P1 | FIXED + TESTED | `edaf14b`, `3b6a4eb` |
| AR-004 | Data correctness (display) | P1 | FIXED + TESTED | `ff9201d`, `b198ac4` |
| AR-005 | Code quality | P3 | FIXED | `ff9201d` |
| AR-006 | Testing / navigation | P1 (coverage gap) | FIXED + TESTED | `2a7b16f` |
| AR-007 | Testing / sign dataset | P1 (coverage gap) | FIXED + TESTED | `b198ac4` |

---

## AR-001 — Raw Supabase auth errors shown to users
**Severity:** P1 · **Category:** Auth UX
**Problem:** AuthModal rendered GoTrue's raw error strings. A wrong password showed "Invalid login credentials"; a network drop showed "Failed to fetch". Users had no recovery hint.
**Root cause:** `signInWithEmail`/`signUpWithEmail`/`requestPasswordReset` returned `error.message` verbatim.
**Fix:** New `lib/authErrorMessages.ts` maps known classes (invalid credentials, unconfirmed email, rate limit, network, password policy, misconfig) to first-person actionable copy; unknown messages pass through unchanged (never hide a specific useful detail). Enumeration protections (`authErrors.ts`) untouched — mapping is response-shape based only.
**Verification:** 8 unit tests (`authErrorMessages.test.ts`) incl. an explicit no-enumeration-weakening test; tsc clean; full suite green.

## AR-002 — Telemetry rejections cascaded into global error reporting
**Severity:** P1 · **Category:** Reliability
**Problem:** `logAttempt`/`logVerification`/`logSignAttempt` are fire-and-forget (`void`-called from render paths). Any Supabase failure surfaced as an unhandledrejection → `installGlobalErrorReporting` recorded a misleading `session_crashed` PostHog event for what is a non-critical write.
**Root cause:** Async inserts with no local catch on a documented fire-and-forget path.
**Fix:** Failures now log locally (`console.error('[telemetry] …')`) and never rethrow; gameplay/progress never depended on these rows.
**Verification:** tsc clean; suite green; code path review of all three helpers.

## AR-003 — Recognition loop kept running against a dead camera
**Severity:** P1 · **Category:** Camera lifecycle
**Problem:** On all six signing screens, a track dying mid-session (unplug, OS revocation, iOS background-mute escalation) left the MediaPipe loop running: wasted CPU on low-end devices and garbage verify() scores rendered next to the recovery card.
**Root cause:** Loop-start effects only stopped the loop when the *phase* changed; `cameraUnavailable` was used purely for rendering.
**Fix:** LessonPage/PracticePage stop when `cameraUnavailable`; StoryPage/SpeedChallengePage/DuelPage/RoomPage stop when the camera isn't `'active'`. Recovery ("Try again" → camStatus active) re-arms via existing effect logic.
**Verification:** tsc clean; full vitest suite green post-change; second-order check confirmed retry path re-starts the loop.

## AR-004 — False copy for new learners + display HELLO semantic drift
**Severity:** P1 · **Category:** Data correctness
**Problem 1:** Review tab told a brand-new learner "Warm up with your learned signs" — false for zero attempts. Now honest ("Try your first signs — no experience needed").
**Problem 2:** Display `SIGNS.HELLO.location.required=true` while Python `signs/hello.py` and the engine deliberately gate location OFF ("a wave reads the same anywhere in upper space"). Display-side drift found by the new consistency lock; fixed to match Python (source of truth). Recognition behavior unchanged (pages always pass ENGINE_SIGNS).
**Verification:** PracticeTab logic branch test by inspection; `signConsistency.test.ts` locks required-ness parity across all 51 displayed signs and fails with an actionable diff listing if drift returns.

## AR-005 — Dead lint-suppression hack in the god store
**Severity:** P3 · **Category:** Code quality
**Problem:** `void ALL_BADGES; // Suppress unused import warning` inside `checkBadges`.
**Fix:** Unused import removed instead of suppressed.
**Verification:** tsc + oxlint clean.

## AR-006 — No automated exploration of guest navigation
**Severity:** P1 coverage gap → closed
**Fix:** `e2e-adhoc/explore.spec.ts` — 5 probes walking every side-nav screen as guest: content renders non-blank, exit affordances exist everywhere, Escape closes dialogs, 6× rapid double-clicks don't wedge nav, browser Back from lesson intro returns Home. All pass vs production build, zero console errors.

## AR-007 — "All signs work" was a manual claim, not evidence
**Severity:** P1 coverage gap → closed
**Fix:** `src/tests/signConsistency.test.ts` (+ superseded draft coverage suite): every displayed sign has an engine definition with matching id/name; required-ness parity per parameter; engine-only set must equal exactly RED/YELLOW/WIN/TEAM (pipeline-complete-but-not-yet-taught — deliberate per commit `3a1842b`, which restored them after the JSON generator silently dropped them).

---

## INVESTIGATED — NO ACTION (with reasons)

- **Auth lifecycle deep-dive:** guest path signup-free; sign-out resets progress by documented design; merge takes max(local, remote); banned-screen flow correct; login-event dedup keyed by user id; OAuth `select_account`. No dead ends found beyond AR-001's copy issue.
- **Memory-leak sweep:** every interval/timeout/rAF/listener/channel traced to cleanup, including multiplayer `leave()` on hook unmount and ChestCard's bounded reward rows. No leaks found.
- **Race guards:** phase-gated passes, `justPassedRef`, quiz double-click disable, skip confirmation — all present.
- **Privacy:** mechanically re-verified zero frame/image transmission paths (`toDataURL/toBlob/captureStream/sendBeacon/upload` absent from src); analytics payloads carry booleans/reasons only.
- **lesson_started double-fire on rapid Start clicks:** telemetry noise only; `setPhase('signing')` idempotent; startCam guarded by streamRef. Left as-is (P3).

## NOT VERIFIED (honest limits)
- Physical low-end Android/iPhone: still outstanding (the sole blocker between 86→90+).
- Sustained 30+ min thermal/memory soak: not run.
- Multiplayer E2E: requires local Supabase stack (Docker) — not available this session.
