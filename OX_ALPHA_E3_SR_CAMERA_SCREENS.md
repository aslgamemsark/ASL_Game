# OX_ALPHA_E3_SR_CAMERA_SCREENS.md

**Task:** ASL-E3 · `[REPORT]` Screen-reader pass on the camera screens (Lesson / Practice / Story /
Speed) — the mission marks this **product-critical**: an ASL app whose audience includes Deaf/HoH
learners must not assume hearing OR sight.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `5e4368a`) ·
**Method:** executed Playwright probe (`web/e2e-adhoc/probe-sr-camera-screens.mjs`) with a fake camera,
auditing each screen's accessibility tree: unnamed-control sweep, live-region inventory, and axe
(serious/critical). This covers the machine-checkable half of a SR pass; the human half (does the
announcement *read well* in NVDA/VoiceOver) is flagged as owner scope. No code changed.

---

## 1. Executed results (production build, phone 390×844, fake camera)

| Check | Lesson | Practice (receptive quiz) |
|---|---|---|
| Reached live view | ✅ "Sign It 1/5" | ✅ mode chooser ("Sign It — Camera + demo clip") |
| Live regions present | ✅ 3 (`status/polite` ×2 + `alert/assertive` ×1, all sr-only, always-mounted per DESIGN.md pattern) | ✅ same trio |
| Every visible interactive control has an accessible name | ✅ none unnamed | ❌ ONE unnamed control |
| Serious/critical axe findings | ✅ zero | ✅ zero |

Plus: Story/Speed screens are **not guest-reachable** (verified live on the Me tab explore grid —
neither "Story" nor "Speed" appears for a zero-progress guest), so their SR audit requires a signed-in
session; recorded as scope for the owner rather than skipped silently.

## 2. Finding E3-a — one unnamed checkbox on Practice's pre-session card (Minor/Moderate)

`PracticePage.tsx:477-485`: the "Record my attempts for replay" toggle renders its label text inside
a `<span>` sibling of the `<input type="checkbox">`, but they are **not programmatically associated**
— no `htmlFor`/`id`, no wrapping association honored because the input sits outside the text span's
label subtree... in fact the input IS inside the `<label>` element (:472), which browsers normally
treat as implicit association. The probe's name computation (aria-label → labelledby → textContent)
reports empty because the checkbox itself has no direct text; real ATs generally DO resolve the
implicit `<label>` wrapper. Severity therefore: **likely fine in practice, but fragile** — it depends
entirely on implicit-wrapper behavior, has no `aria-label` fallback, and would break silently if the
markup is ever restructured. Fix shape (one attribute): `aria-label="Record my attempts for replay"`
on the input at :477. NOT changed here — report-only.

## 3. What the camera screens get right for non-sighted/SR users (verified)

- **Live-region discipline:** LessonPage announces success ("+10 XP") and lesson completion
  (accuracy + XP summary) through an always-mounted polite `role="status"` (LessonPage.tsx:288,
  announcement copy :279-282); skip encouragement likewise (:562); PracticePage mirrors this (:738);
  ParameterChecklist announces checklist progress (:191). The always-mounted-before-text pattern is
  applied consistently — exactly what DESIGN.md "Status messages" prescribes.
- **No unnamed controls** anywhere on the Lesson live view; every button carries text or aria-label
  (the earlier ASL-A8 aria-label work on LessonNode shows in the tree).
- **Zero serious/critical axe findings** on both audited camera screens — consistent with E1's full
  sweep (only the two moderate structural landmark findings there).

## 4. Honest limits of this pass

A complete SR verdict needs human ears: whether "Sign It 1/5 ⚙️" reads as useful context, whether the
camera view itself needs an explicit "video of you signing" description, and how announcements queue
during rapid signing are AT-behavior questions no DOM probe can answer. Recommended owner follow-up:
one manual NVDA (Windows) + VoiceOver (iOS) session over Lesson and Practice using §1's walk path;
the mechanical layer they'd build on is verified clean above.

## 5. Re-run

`node web/e2e-adhoc/probe-sr-camera-screens.mjs` against any :4173 server of `dist/`
(exit 0 iff all checks pass — currently exits 1 solely due to E3-a's unnamed-checkbox finding).

**Post-report addendum (verification runs):** across five re-runs the two deterministic checks held
(live views reached; lesson controls all named; E3-a reproduced every time), while the single-scan
`color-contrast` axe findings appeared in SOME runs only (lesson x1–x6, practice x0–x2) and vanished
under double-scan with settle-waits (probe-contrast-detail/stability probes: stable set = 0). This
matches a11y.spec.ts's documented transient behavior exactly — the canonical gate's double-scan
agreement exists for precisely this reason. The E3 report's "zero serious/critical" claims stand as
STABLE-state claims; single-scan transients are not regressions.
