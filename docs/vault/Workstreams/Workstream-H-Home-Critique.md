# Workstream H — `/impeccable critique` on the home screen + fixes (2026-07-03, fourth round)

**Status: done.** First real run of the critique workflow (dual sub-agent: Assessment A = design
review, Assessment B = detector + live-browser evidence, per the skill's mandatory invariant).
Score: 32/40 ("Good"). Full report and priority list are in the chat transcript / persisted at
`.impeccable/critique/`.

## What the two assessments corroborated
Assessment A named two contrast problems qualitatively (StreakCard's milestone-footer text,
DailyQuestsCard's "0/3 done" counter). Assessment B, working blind to A's findings, independently
measured the *exact* numeric ratios via live computed-style color math and landed on the same two
elements (2.53:1 and 2.03:1) — strong agreement between human-judgment review and deterministic
measurement. Notably, `detect.mjs`'s static scan came back **clean (exit 0)** on all 6 home-screen
source files — the contrast bug is invisible to static analysis because it depends on
runtime-composited opacity over a gradient position; only live-browser measurement caught it. This
is the concrete demonstration of why the critique flow mandates *both* assessments.

## Fixes shipped (verified via my own re-measurement, not just re-reading the fix)
1. **StreakCard contrast** — reading the actual file surfaced this wasn't just the one named line;
   three translucent-white captions ("Today's goal", "1 freeze left", "X days to 🏅") all measured
   3–3.6:1, all failing 4.5:1. Applied the same `bg-black/20` scrim technique already used on two
   other cards this session, THEN re-measured: freeze-left and days-to were still short (3.84/3.14)
   with the scrim alone, so bumped those two specifically from `/50`/`/60` to `/80` opacity.
   Final measured ratios: 5.61 / 4.65 / 5.61 — all clear.
2. **DailyQuestsCard "0/3 done" counter** — `text-z-gray-500` → `text-z-gray-300`.
3. **Untokenized gradient** — `#7B2FBE`/`#A855F7` (appeared twice: Claim! button + progress fill)
   replaced with the real tokens `#7C3AED`/`#A78BFA` (`z-purple`/`z-purple-light`).
4. **Ambient animation loops** — Claim! button's `repeat: Infinity` pulse and ChestCard's ready-
   chest bounce both capped to `repeat: 3` — announces "actionable," then holds still, matching
   PRODUCT.md's "celebrate deliberately, never ambient" principle.
5. **Chrome before content** — `DailyQuestsCard` now collapses to a one-line "`X/Y quests in
   progress · View all →`" summary whenever nothing is claim-ready and not all are done; full
   expansion is one tap away (verified both states + the expand interaction live). This was the
   single biggest contributor to "too much scrolling before Worlds."
6. **Locked-world copy tone + a third contrast bug found in the same pass**: while fixing the
   requested tone rewrite ("Complete X to unlock" → "Finish X to open this world!"), grepped the
   same file for other low-opacity white text and found two more instances Assessment B had also
   measured as failing (world progress "0/6" counter at 2.10:1, "X of Y lessons / %" row at
   3.01:1) — bumped `/35`→`/60`, `/40`→`/70`, `/50`→`/75` respectively. Not requested explicitly,
   but the same bug class in the same component the fix was already touching.

## Verification method
Wrote a small in-page contrast-measurement script (canvas `fillStyle` round-trip to resolve any
CSS color format — this build's computed styles came back as `oklab()`, not `rgb()`, which broke
a naive regex approach on the first attempt) that alpha-composites text color onto its actual
resolved background (walking up ancestors, folding in gradient stops and sibling scrim overlays)
before computing the WCAG ratio. Re-ran it after the fix to confirm real numbers, not just "the
code looks right" — the first version of this fix (scrim alone) genuinely wasn't enough and would
have been reported as fixed if not re-measured.

## Not addressed
- P3 in the critique ("locked-world copy" tone) — done as part of this pass.
- The `signs` pill reading "0" between two populated numbers on a fresh account (Assessment A's
  minor observation) — not verified further; flagged as out of scope for this pass.
- Screen-reader announcement of quest-claim state changes (persona red flag for Sam) — a real gap,
  not fixed here; would need an `aria-live` region, a larger a11y task than this pass's scope.
