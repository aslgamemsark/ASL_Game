# OX_ALPHA_H3_DIFFICULTY_CURVE.md

**Task:** ASL-H3 · `[REPORT]` Difficulty curve — trace lesson/sign progression order against
difficulty: are lessons ordered sensibly, do XP rewards scale, does anything spike?
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `0fdf948`) ·
**Method:** structural analysis of `LESSON_UNITS` (16 lessons / 7 units) and `SIGNS` (51 defined)
via `web/e2e-adhoc/analyze-difficulty.mjs`, cross-checked with the SR scheduler (H2) for the
practice-side curve. No code changed.

---

## 1. The curriculum table (declaration order = play order)

| # | Unit | Lesson | Signs | New | XP | XP/new-sign |
|---|---|---|---:|---:|---:|---:|
| 1 | u0 Say Hello | Say Hello | 3 | 3 | 15 | 5.0 |
| 2 | u0 Say Hello | Spell It Out | 2 | 2 (letters H,I) | 15 | 7.5 |
| 3 | u0 Say Hello | Meet Zippy (story) | 5 | 0 | 30 | — |
| 4 | u1 Getting Started | Greetings | 4 | 1 (THANK_YOU) | 20 | 20.0 |
| 5 | u1 Getting Started | Cafe Order | 4 | 4 | 15 | 3.8 |
| 6 | u2 Building Skills | Coffee Shop (story) | 6 | 0 | 30 | — |
| 7 | u2 Building Skills | Coffee Shop: Rush Hour | 5 | 0 | 35 | — |
| 8 | u3 Hospital Care | First Aid | 3 | 3 | 20 | 6.7 |
| 9 | u3 Hospital Care | Body Check | 3 | 3 | 20 | 6.7 |
| 10 | u3 Hospital Care | Treatment | 2 | 2 | 15 | 7.5 |
| 11 | u3 Hospital Care | Hospital (story) | 8 | 0 | 40 | — |
| 12 | u4 Hospital Advanced | Medical Staff | 3 | 3 | 20 | 6.7 |
| 13 | u4 Hospital Advanced | Recovery | 1 (BREATHE) | 1 | 15 | 15.0 |
| 14 | u5 Classroom Time | Classroom Greetings | 3 | 0 (all review) | 15 | — |
| 15 | u5 Classroom Time | Classroom Basics | 5 | 5 | 25 | 5.0 |
| 16 | u6 Classroom Story | Classroom (story) | 7 | 0 | 35 | — |

Totals: **27 distinct signs taught across 16 lessons; every lesson's signs are defined; zero orphans**
(no sign is used before it is introduced); all 51 curriculum signs exist, 24 of which are letters that
live on the Alphabets tab path rather than in lessons (see §3).

## 2. Curve assessment

**Shape is genuinely gentle and well-formed:**

- **Lesson sizes**: 1–8 signs (median 3–4), never spiking above 8 even at the finale. The single 8-sign
  lesson (#11) is a story/review capstone composed *entirely of already-taught signs* — new-material
  load at that point is zero.
- **New-signs-per-lesson**: 1–5, typically 3. The largest single drop (Cafe Order introducing 4) comes
  right after the simplest lesson, and those four signs are thematically coherent (COFFEE/WANT/MORE/YES).
- **Review rhythm**: after every ~2 teaching lessons there is a 0-new-signs story/review lesson
  (#3, #6, #7, #11, #14 partially, #16). New material is never introduced twice in a row without a
  consolidation beat more than once.
- **XP scaling tracks load, not difficulty inflation**: XP/new-new-sign stays within 3.8–7.5 for all
  standard lessons (the 20.0 and 15.0 outliers are the 1-new-sign lessons #4/#13 — small-N artifacts,
  not real spikes). Story/review capstones award the biggest absolute XP (30–40) precisely because they
  demand the most recalls — economically sensible (cross-check H4).
- **Thematic progression** (greetings → café → hospital → classroom) matches plain-language difficulty:
  iconic/wave signs first (HELLO), abstract directional ones later.

## 3. Findings

**F3-curve-a — 24 of 51 signs (all letters except H/I) live outside the lesson curve entirely.**
Letters A–Z are taught through the Alphabets tab's "Practice Letters" card instead (`PRACTICEABLE_LETTER_IDS`,
alphabet.ts:38), which introduces only the first 5 letters to new users (FIRST_LETTERS_COUNT=5,
AlphabetTab.tsx:14) and otherwise randomizes. Consequence: the letter-sign difficulty "curve" is
effectively **flat/random by design** — there is no letters-progression (e.g., easy handshapes like
B/U before hard ones like M/N/T/R). Whether that matters depends on how central fingerspelling is to
the product vision — owner call. Not a defect; a design-space observation.

**F3-curve-b — no difficulty metadata exists per sign.** Ordering within units is thematic; nothing
marks a sign as objectively harder (two-handed signs, motion complexity). If retention data ever shows
a wall (e.g., at Hospital unit's 8-sign story), there's no signal distinguishing "many new signs" from
"intrinsically hard sign". Recording as future-instrumentation note only.

## 4. Verdict

The lesson curve is well-constructed: gentle sizes, regular review beats, XP proportional to load,
zero orphan references, complete coverage of taught signs. No fixes warranted. The one genuine design
question (letters outside the curve, F3-curve-a) belongs to the owner.
