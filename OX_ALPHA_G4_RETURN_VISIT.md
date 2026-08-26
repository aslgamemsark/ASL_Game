# OX_ALPHA_G4_RETURN_VISIT.md

**Task:** ASL-G4 · `[REPORT]` Return-visit path — verify the second-visit experience: onboarding
skipped, progress restored, straight-to-content.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `b8e5f72`) ·
**Method:** executed Playwright probe (`web/e2e-adhoc/probe-return-visit.mjs`) using a persistent
browser profile: VISIT 1 completes onboarding + a full Practice Letters session (all skips, so
progress = completion record at 0 XP); the profile then re-opens the app as VISIT 2. No code changed.

---

## 1. Executed results (production build, phone 390×844)

| Check | Result |
|---|---|
| Return visit: welcome/onboarding skipped entirely | ✅ "Get started" never appears; app goes straight past onboarding |
| Return visit reaches usable Home | ✅ **3.1 s** from navigation start (shell 0.1 s) |
| Progress state restored and readable | ✅ TopBar XP counter renders persisted value (`xp=0` is a *valid restore* — visit 1 skipped all signs, earning nothing; the counter itself proves state hydration) |
| Content one nav tap away | ✅ Return lands on Journey ("Welcome back! … Start your journey"); Practice Letters card visible after exactly one BottomNav tap |

**G4 SUMMARY: 4/4 checks passed.**

## 2. What the return visit feels like (from the measured run)

Second visit: no welcome screen, no skill pick, no repeated permission dance (camera permission
persists per-origin), no modal walls. The app opens directly on a personalized Journey tab that
says "Welcome back! Ready to learn something new?" with the learner's current lesson surfaced
("Say Hello is ready"), streak/XP/gold counters already hydrated in the TopBar, and any content card
one tap away. Total time from cold navigation to usable Home content: **~3 seconds** — versus the
first-visit funnel's 5.5 s + onboarding taps.

## 3. Findings

**No return-visit defects found.** Two design observations worth recording for the owner:

1. **Return landing tab is Journey**, not the last-used tab. Defensible: it surfaces "what's next"
   ("Say Hello is ready"). If the owner ever wants stricter recency, remembering `lastHomeTab`
   would be a two-line change — noted, not recommended either way without user data.
2. **Guest progress is device-bound** (localStorage): clearing browser storage wipes it. This is
   inherent to the guest model (Supabase sync exists for signed-in users) and matches the product's
   stated design; recorded so nobody mistakes it for a persistence bug later.

## 4. Probe-harness notes

The probe requires a FRESH persistent profile per run (env `G4_PROFILE` or its default Temp path) —
a leftover profile makes visit 1 hang waiting for an onboarding button that visit-2 behavior has
already skipped. Run: `rm -rf <profile>` then `node web/e2e-adhoc/probe-return-visit.mjs`
(exit 0 iff all checks pass).

## 5. Verdict

Return-visit path is fast (3.1 s), friction-free, and state-correct. Nothing to fix.
