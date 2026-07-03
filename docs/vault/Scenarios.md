# Scenarios

Three scenarios exist: `coffee_shop` (Saad), `hospital_shop` (teammate), `classroom` (added this
session, see [[Workstream-A-Classroom]]). Each owns only presentation — background, prompts,
theme — never recognition logic, per CLAUDE.md's repo-layout rule.

## Python side (`scenarios/<name>/`)
- `main.py` — `build_levels() -> list[Level]` (levels of `Prompt(sign, hint_text)`), plus a
  `main(camera_index, debug)` game loop that's ~95% identical across scenarios (Capture → verify →
  GameSession → scene.render). Copy an existing `main.py` almost verbatim for a new scenario.
- `scene.py` — a `<Name>Scene` class with `_procedural_background()`, `_hud()`, `_prompt()`,
  `render()`. Reuses `core/game.py`'s `composite_pip()` / `flash()` — never duplicates them.

## Web side
- `web/src/types/lesson.ts` — `LessonNode.scenario` union type (extend it for a new scenario).
- `web/src/data/lessons.ts` — `LessonUnit[]`, each `LessonNode` lists `signIds`.
- `web/src/data/worlds.ts` — one `World` per scenario: `unlockCondition` (a completed-lesson id
  that gates it), `unitIds`, `badgeId`, `storyId`.
- `web/src/data/stories.ts` — a `StoryScript` (NPC-driven dialogue, one `DialogueLine` per sign).
  **A `World` can now host more than one story** — `WorldMap.tsx` renders any lesson node whose id
  matches a registered story's id as a story card, not just `world.storyId` (changed in
  [[Workstream-D-E-Polish]] to add the second Coffee Shop story without widening `World`'s type).
- `web/src/data/badges.ts` + `useUserStore.ts`'s `checkBadges()` — every story needs a matching
  badge id checked against `completedLessons.includes(<story-id>)`, or the world's `badgeId`
  silently points at nothing.

## Adding a sign to a scenario — the proven pipeline (see [[Workstream-A-Classroom]] for a worked example)
1. `signs/<name>.py` (Python, source of truth) + `web/src/engine/signs/index.ts` entry.
2. Export from `signs/__init__.py`, add to the scenario's `<NAME>_SIGNS` tuple.
3. Confusor fixture pair (reuse `tools/make_synth_fixtures.py`'s `make_hand()`) + tests in both
   `tests/` and `web/tests/`.
4. `web/src/data/signs.ts` display metadata — omit `clip` unless a real reference video exists.
5. If training the ML classifier on it: verify the gloss exists in the source dataset **before**
   mapping it (see [[ML-Pipeline]]) — don't assume.
