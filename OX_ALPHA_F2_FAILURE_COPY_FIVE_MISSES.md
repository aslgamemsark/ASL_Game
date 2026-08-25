# OX_ALPHA_F2_FAILURE_COPY_FIVE_MISSES.md

**Task:** ASL-F2 · `[REPORT]` Failure copy after five straight misses — what does a discouraged
learner actually see, and does the app's response change as the streak grows?
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `d38367a`) ·
**Method:** static trace of every miss/skip feedback path + an EXECUTED probe
(`web/e2e-adhoc/probe-failure-copies.mjs`, two full Test-from-Memory sessions against the production
build with a fake camera: 3 real wrong answers + 6 skips observed). No code changed.

---

## 1. Where miss feedback lives (static trace)

There is exactly ONE copy bank for misses/skips in the entire app — Zippy's `encourage` lines
(src/data/zippy.ts:100–106):

> "Almost! Let's try that one again." · "So close — give it another go." · "Nice try! Once more,
> you've got this." · "Signing takes practice. Let's try again together."

Consumed at LessonPage.tsx:250 (skip), PracticePage.tsx:352 (skip), StoryPage.tsx:163 (fail). The
comment above the bank states the design contract outright: *"A miss or a skip. Always kind; never
disappointed."* A repo-wide trace found **no miss-streak / consecutive-wrong counter anywhere in
src/** — no state exists that could escalate copy at 3 or 5 misses.

## 2. What each failure surface actually shows

| Surface | On a miss | Feedback channels |
|---|---|---|
| Receptive quiz (wrong answer) | Red highlight on chosen option + green on correct; auto-advances ~1.5 s | Visual only — **no text/Zippy toast fires on wrong answers** |
| Expressive skip (Lesson/Practice/Story) | Zippy avatar toast with a random non-repeating `encourage` line for 2 s | Visual + sr-only live region (a11y trio from E3) |
| Expressive camera miss | Coaching hint via `gateHint` (engine/coachingGate.ts) when the model confidently sees a different sign — specific corrective guidance, not generic praise | Visual |

## 3. Executed probe results (production build, two sessions)

- 6 Zippy toasts captured across skips — **all four bank lines observed**, zero off-bank strings.
  Randomization works (zippy.ts:189 prevents immediate repeats).
- 3 real receptive misses observed: color-only feedback, no toast — consistent with the static trace.
- Session completion after a mostly-missed run routes to `lessonCompleteEncourage`
  ("Nice effort! … You made it through") — still warm, never shaming (zippy.ts:119–124).

## 4. Findings & assessment

**F2-a — there IS no "after five straight misses" behavior; escalation is absent by documented
design.** The learner's experience at miss 5 is identical to miss 1: another kind line from a
four-line bank (on skips) or bare red/green paint (on quiz answers). Against PRODUCT.md's
"never disappointed" stance this is coherent and shaming-free — but it leaves a real gap: **five
straight misses with zero content change** is where a struggling learner churns. The kind-but-static
response is also a *repetition* risk: only 4 lines exist, and the probe saw repeats within one
session ("So close…" twice).

**F2-b — wrong QUIZ answers are the weakest surface:** color-only, no Zippy, no encouragement, no
pointer to the correct sign beyond the 1.5 s green flash. A discouraged learner on this path gets
less support than one who skips. Fix shape if desired: fire the existing `encourage` toast on
receptive wrongs too (the component already exists at PracticePage.tsx:740–752), and/or add a second
bank (`encourageDeep`: "This one's tricky — want to watch the clip again?") surfaced after N
consecutive misses. Both are owner decisions under `[REPORT]` scope; N-state tracking would be new
state (none exists today).

## 5. Verdict

No shaming, no harshness — the copy system honors its stated design contract perfectly. The gap is
the opposite of toxicity: **no escalation and no extra help at high miss counts**, plus color-only
feedback on quiz misses. Documented for the owner; probe committed for re-runs.
