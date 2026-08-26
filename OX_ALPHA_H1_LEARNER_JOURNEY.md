# OX_ALPHA_H1_LEARNER_JOURNEY.md

**Task:** ASL-H1 · `[REPORT]` Play it as a learner — one page on where they get stuck/bored.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `f9d4919`) ·
**Method:** synthesis of this session's *executed* learner-journey evidence — every claim below traces
to a committed probe run from today (G2/G3/G4/E2/E3/E4/F2/H2/H6), not opinion. No code changed.

---

## The learner's first hour, moment by moment

| Minute | What the learner hits | Evidence | Verdict |
|---|---|---|---|
| 0:00–0:07 | Welcome → guest → skill pick → Home → **live signing view in 6.9 s**, 6 taps, no account wall | G2 probe, 2 runs ±0.2 s | ✅ Excellent |
| ~0:05 | First camera ask arrives with **zero app-side context** on this fastest path (native browser bar only) | G3 executed | ⚠️ G3-a (owner call) |
| 0:07+ | Lesson prompts are clear; camera-denial path is honest with Try-again recovery; muted users can complete lessons except one audio-throw defect | G3, E4 | ✅ / 🐛 E4-a |
| +5 min | Keyboard-only learners can finish a full lesson; SR users get live-region announcements; quiz misses show **no text feedback** (color only) | E2, E3, F2 executed | ⚠️ F2-b gap |
| Day 2 | Return visit skips onboarding, Home in 3.1 s, progress hydrated | G4 probe, 4/4 ×2 | ✅ Excellent |
| Week 1 | Missed signs cycle back via SM-2 review; "N signs to review" counts honestly; Quick Session adds one mode-choice tap | H2 executed | ✅ (+1 tap noted) |
| Week 1+ | Failure copy never escalates — same encourage lines at miss 1 and miss 10; bored learners have ~1 h of novel content, then repeat loops only | F2, H6 | ⚠️ churn risk |

## Where they get STUCK (defects, fix-worthy now)

1. **E4-a — blocked audio breaks lesson entry.** With Web Audio unavailable, `sounds.tap()` throws
   before navigation: Practice Letters card appears dead. Highest-severity finding of the session;
   hits exactly the Deaf/HoH audience the product serves.
2. **F2-b — quiz misses are color-only.** Wrong answers flash red with no text/toast equivalent;
   color-blind learners get nothing.

## Where they get BORED (design gaps, owner's roadmap)

3. **No escalation after repeated misses** (F2): one encourage bank, no streak awareness, no "want a
   hint?" moment — a struggling learner sees identical responses forever.
4. **~1 hour of novelty** (H6/H3): after 16 lessons + 5 stories there is nothing new; retention then
   rides entirely on daily quests + SR reviews of known signs.
5. **Review re-entry costs a tap** (H2 observation): Review-tab Quick Session stops at the mode chooser.
6. **Letters never progress** (H3-curve-a): 24 letters sit outside the lesson curve, taught
   first-5-then-random — no fingerspelling mastery arc for learners who want one.

## What does NOT need work

Activation speed (13× under bar), return-visit friction (near zero), camera-permission honesty,
keyboard/SR operability, reward economy (no farms, no shaming). The skeleton is genuinely good —
fix the two stuck-points, feed the machine content, and the journey holds.

**One-page rule of thumb:** *unstick E4-a and F2-b; then buy novelty with new units — everything else
is already fast, honest, and kind.*
