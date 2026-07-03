# Workstream A — Classroom / School scenario

**Status: done.** Signs, scaffolding, and ML training (`model_v6`) all complete and deployed.

## Sign set (5 new signs)
`TEACHER`, `WRITE`, `READ`, `NAME`, `FRIEND` — chosen specifically to fit the engine's existing
`MovementKind` set (`none/linear/circular/repeated/converge`, no diverge/trace). See
[[Architecture]] for why that constraint exists.

**Mid-session correction:** the original plan proposed `BOOK` (two hands opening like a book —
inherently a *diverging* motion). That directly contradicted the plan's own stated principle of
excluding diverge-needing signs. Swapped for `WRITE` (a repeated scribbling motion over the
non-dominant palm), which fits the REPEATED detector cleanly and pairs thematically with READ.

`NAME` reuses the `h` handshape pattern (see [[Workstream-F-Alphabet]] for why that pattern is
ambiguous) — safe here specifically because NAME is two-handed with a **required** tap movement,
which is the same accepted precedent as NURSE/HOSPITAL.

## Files
- `signs/teacher.py`, `write.py`, `read.py`, `name_sign.py`, `friend.py` (+ TS mirrors) —
  `CLASSROOM_SIGNS` tuple in `signs/__init__.py`.
- `tools/make_classroom_fixtures.py` — synthetic correct/confusor fixtures (mirrors
  `tools/make_synth_fixtures.py`'s technique). Copied into `web/tests/fixtures/` for the TS suite.
- `tests/test_classroom.py` (30 tests) + `web/tests/test-all-signs.ts` additions — all green in
  both suites.
- `scenarios/classroom/main.py` + `scene.py` — chalkboard-green theme, same 3-level shape
  (Greetings / Classroom Basics / Fingerspelling) as `coffee_shop`.
- Web: `worlds.ts` (new `classroom` world, unlocked after `hospital-story`), `lessons.ts` (units
  5 & 6), `stories.ts` (`CLASSROOM_STORY`), `badges.ts` + `useUserStore.ts` (`classroom_story`
  badge condition — easy to forget, a world's `badgeId` silently points at nothing if this is
  skipped).

## ML training — model_v6
All 5 glosses confirmed present in WLASL's local metadata (`data/wlasl/WLASL_v0.3.json`, 16-17
instances each) — added to `tools/wlasl_vocab.py`. **Not verified in ASL Citizen** — the raw
source gloss list isn't available locally this session (see [[ML-Pipeline]]'s caveat). WLASL-only,
same situation as MORE.

`tools/wlasl_extract.py` yielded 46/228 downloadable instances (182 dead links, 140 already
extracted from prior signs) — 8-11 clips per new sign (TEACHER 9, WRITE 11, READ 9, NAME 9,
FRIEND 8). Visual gate (`ml/inspect.py`) passed for all 5 — hands upright, correct handedness
colors, present through the motion (one single-frame lead-in gap in FRIEND, not mid-sign, judged
acceptable).

Trained on the merged ASL Citizen + WLASL cache (802 clips, 24 classes, `data/cache_merged.npz`),
same hyperparameters as `model_v5` (80 epochs, batch 32, n_aug 14). **82.6% test accuracy**
(vs. `model_v5`'s 83.6% on 19 classes — a small, expected dip from adding 5 low-data classes).
Per-class metrics for the new signs (tiny test-split support, same situation MORE was in on
`model_v5` — not a red flag, just noisy with 1-2 test examples each):

| sign | precision | recall | f1 | support |
|---|---|---|---|---|
| TEACHER | 1.000 | 1.000 | 1.000 | 2 |
| NAME | 1.000 | 1.000 | 1.000 | 2 |
| FRIEND | 1.000 | 1.000 | 1.000 | 1 |
| READ | 0.500 | 1.000 | 0.667 | 1 |
| WRITE | 0.333 | 0.500 | 0.400 | 2 |

`ml.sanitize_tfjs` again nulled exactly 3 regularizer entries (confirms it's still a required
step, not a no-op). Deployed to `web/public/models/signs/` (`classes.json` now lists all 24
signs). Verified via direct fetch (valid JSON, correct `weightsManifest`) — could not verify an
actual in-browser `tf.loadLayersModel()` call without navigating past the camera-permission gate,
which this session doesn't do. Same deploy pipeline as `model_v4`/`model_v5`, unmodified.

## Verified working end-to-end (browser, `npm run preview`)
World card, lesson units, locked story node all render correctly with no console errors. Deepest
lesson-node click stops at the expected sequential-progress lock (not a bug — same behavior as
every other world).
