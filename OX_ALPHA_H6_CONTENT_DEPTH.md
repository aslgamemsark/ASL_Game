# OX_ALPHA_H6_CONTENT_DEPTH.md

**Task:** ASL-H6 · `[REPORT]` Is the sign vocabulary deep enough to retain anyone — content-depth
assessment: reachable content inventory, session/exhaustion math, retention levers present vs absent.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `79890b5`) ·
**Method:** data-file inventory (`web/e2e-adhoc/analyze-retention.mjs` + targeted greps) combined
with this session's executed timings (G2 funnel, G4 return visit, H2 SR math). No code changed.

---

## 1. Total content inventory (all of it, counted)

| Content type | Count | Notes |
|---|---:|---|
| Defined signs | 51 | 27 taught via 16 lessons; 24 letters on the Alphabets tab |
| Lessons (units) | 16 (7) | one-time XP total: **365 XP** |
| Stories | **5** | Meet Zippy, Coffee Shop, Rush Hour, Hospital, Classroom |
| Badges | 23 | achievement layer |
| Daily quests | 17 definitions | repeatable daily loop |
| Ranks | 6 | Beginner → ASL Legend at 10,000 XP |

The mission's "24 signs" framing is conservative: real teachable content is 27 lesson signs + a 26-letter
fingerspelling set (H/I also in lessons), i.e. **~51 distinct signs**.

## 2. Exhaustion math

- **Unique lesson content**: ~16 lessons × ~2.5 min (learner pace incl. retries, from this session's
  probe timings) ≈ **40 minutes** to see every lesson once. Stories add ~20–25 min. Total first-pass
  content: **~1 hour**.
- **XP ceiling check**: full curriculum = 365 XP. Reaching "ASL Legend" (10,000 XP) requires the
  repeatable loops: practice sessions (~15–35 XP each), duels, stories, quests. That is by design not
  a content wall but a grind wall — after ~1 hour there is *nothing new left to learn*, only things
  to re-do.
- **The retention engine after exhaustion is spaced repetition** (verified live in H2): due signs cycle
  back on SM-2 intervals, so a returning learner always has *something* scheduled. But SR reviews reuse
  known material — they maintain memory; they don't create novelty.

## 3. Assessment: enough for whom?

- **For its stated audience** (PRODUCT.md: absolute beginners, Deaf/HoH-inclusive, casual learners):
  51 signs ≈ a genuine first conversational foothold (greetings, café, hospital, classroom scenarios).
  As a free v1 scope this is coherent — an hour of novel content plus daily-review mechanics is a
  defensible "first month" product.
- **As a retention machine**: no. After ~1 hour a motivated learner has exhausted all novelty. The only
  forward pull is rank XP (grind), streaks, and badges (23). There are no additional worlds, no
  phrase-building beyond fixed scripts, no numbers/colors/family topics yet. Retention past week one
  depends entirely on the habit loop (daily quests + SR), which exists but has nothing new to feed it.

## 4. Verdict & owner-facing summary

- **Not a defect — a scope boundary.** The app does what it claims for beginners; it simply ends.
- If retention matters commercially, the highest-leverage additions are cheap thematically: numbers,
  colors, family, food-2, feelings — each reuses the entire existing pipeline (signs.ts entry, clip,
  verifier, lesson/story wiring). The engine is content-ready; the content is the bottleneck.
- Cross-checks recorded: H3 (curve well-formed within current scope), H4 (economy fine at this scale),
  H2 (SR keeps whatever content exists cycling). None of them block adding units later.

**Bottom line:** ~1 hour of unique content, honest about it, mechanically sound. Enough to hook a
beginner for days-to-weeks; not enough to retain past the first month without new units.
