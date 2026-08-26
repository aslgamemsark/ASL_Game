# OX_ALPHA_H2_CORE_LOOP.md

**Task:** ASL-H2 · `[REPORT]` Core loop — trace the learn → practice → review cycle end to end:
what loops, what advances, what repeats; verify spaced repetition actually cycles weak signs back.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `536c640`) ·
**Method:** executed Playwright probe (`web/e2e-adhoc/probe-core-loop.mjs`, persistent profile) plus
static trace of the SR scheduler. No code changed.

---

## 1. The loop as implemented (static trace)

- **Learn:** LessonPage completes → `recordSign(signId, correct)` per sign (LessonPage.tsx:138/253).
- **SR scheduling (SM-2 style, useUserStore.ts:215–253):**
  - correct: `interval = interval===1 ? 6 : round(interval × easeFactor)`; ease +0.1 (floor 1.3)
    → next review in ~6 days, then growing gaps;
  - miss: `interval = 1`, ease −0.2 (floor 1.3) → next review **tomorrow**, i.e. weak signs cycle
    back fastest.
- **Practice entry points pull from the SR state:**
  - PracticePage.tsx:230 — unfiltered expressive sessions draw `getSignsDueForReview(accuracy, 8)`
    (due-first sorted by nextReviewAt, weakest-success-rate fill);
  - PracticeTab.tsx:115–125 — Review tab counts due signs and surfaces honest copy ("N signs to
    review" / "Warm up…" / "Try your first signs…").
- **Review closes the loop:** answering calls `recordSign` again (PracticePage.tsx:318), which
  re-schedules intervals — the cycle is closed and self-reinforcing.

## 2. Executed verification (production build, persistent profile)

| Check | Result |
|---|---|
| Visit 1 misses recorded into the SR store | ✅ 5 letters persisted with attempts=1, successes=0 |
| SR math on a miss | ✅ all 5 at `interval=1`, `nextReviewInDays=1` — SM-2-style reset confirmed in persisted state |
| Due dates passing surface in UI | ✅ after backdating `nextReviewAt` 1 h into the past (+reload), Review tab shows **"5 signs to review"** |
| Quick Session opens the practice flow for those due signs | ✅ mode chooser appears (autoStart unset on this path); camera primer/hand-check gates handled by the probe |

**H2 SUMMARY: 4/4 checks passed.**

## 3. Findings

**No core-loop defects found.** The loop is genuinely closed: misses shorten intervals to tomorrow,
successes grow them, due signs are counted honestly in the Review tab copy (the F2-era "honest
copy" discipline holds here too), and Quick Session consumes exactly that state.

Two design observations for the owner (not defects):

1. **The Review tab's Quick Session does not auto-start.** It lands on PracticePage's mode chooser
   ("Sign It / Sign Quiz"), adding one decision tap for a learner who just wanted review. G2's
   activation math is unaffected (that's first-run); this is a returning-user micro-friction.
2. **Success interval jumps 1 → 6 days** (`interval===1 ? 6`). That's classic SM-2, but with only
   ~24 signs total, a learner can go nearly a week without seeing a sign they got right once.
   Whether that's right depends on retention goals (H6's territory) — noted for H6/H4 cross-check.

## 4. Re-run

`rm -rf <profile>` then `G4_PROFILE=<profile> node web/e2e-adhoc/probe-core-loop.mjs`
(exit 0 iff all checks pass). Requires a server on :4173 serving `dist/`.
