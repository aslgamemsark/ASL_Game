# Operating Rules

Binding rules for all product/engineering work on QuickSign. Adopted 2026-07-27.
These override conflicting assumptions in any plan document.

Companion docs: [analytics/BASELINE_W1.md](analytics/BASELINE_W1.md) (frozen) ·
[analytics/KPI_DASHBOARD.md](analytics/KPI_DASHBOARD.md) (living) ·
[PRODUCT_BACKLOG_SAAD.md](PRODUCT_BACKLOG_SAAD.md) (tasks).

---

**1 — Evidence above opinion.** Every recommendation cites PostHog, session recordings, Supabase,
browser testing, production logs, code inspection, or user feedback. If the evidence isn't there,
write **"This is currently a hypothesis"** and design an experiment. Never present a hypothesis as
a fact.

**2 — Every change is an experiment.** Each task carries: Hypothesis · Success Metric · Baseline ·
Target · Validation Period · Result · Decision (Keep / Modify / Rollback / Monitor) · Confidence.
A task is not done when it merges — it is done when its experiment is evaluated.

**3 — Weekly baselines.** Each week is an immutable snapshot (`BASELINE_W1`, `W2`, …). Never
overwrite. Every week compares against all previous weeks: absolute change, % change, trend,
regression, confidence. Never rely on memory.

**4 — KPI dashboard.** Maintained in `analytics/KPI_DASHBOARD.md`, updated every sprint. A KPI that
cannot currently be measured is marked ⚠️ with the fix that unblocks it — never silently omitted.

**5 — Root cause before solution.** Ask "what is the actual root cause?" before proposing an
implementation. No symptom fixes. No optimizing around a broken system. Threshold-tuning as a
substitute for a root-cause fix is banned (see `.claude/rules/fixes.md`).

**6 — Stop defending old ideas.** When new analytics contradict a previous recommendation:
acknowledge it immediately, update the roadmap, state why the old assumption was wrong. Never keep
implementing a superseded strategy.

**7 — Simplicity wins.** Every sprint names what to delete: features, screens, clicks, components,
animations, code, analytics. If deleting improves the product, recommend deleting it.

**8 — Opportunity cost.** Before implementing, ask what higher-impact work exists instead.
Reprioritize automatically when the answer changes.

**9 — Before / after review.** Every visible change documents: current experience, new experience,
reason, expected KPI impact, risk. Screenshots where possible.

**10 — Sprint retrospective.** Completed · failed · unexpected discoveries · biggest remaining
bottleneck · highest-risk current assumption · next sprint · what NOT to work on.

**11 — Stop conditions.** Do not generate work to stay busy. If planned KPIs are met, stop and
recommend collecting another week of data. Do not invent features.

**12 — Long-term objective.** Optimize only for: users reaching value faster, higher lesson
completion, higher learning accuracy, higher confidence, higher retention, lower frustration,
higher satisfaction and quality. Never for more code, features, screens, or complexity.

**13 — Challenge the request.** If analytics suggest a request is low-impact, push back, explain
why, and recommend the higher-ROI alternative. Do not become an implementation machine.

**14 — Final goal.** Not tickets — a product where users understand it, complete lessons, enjoy
learning, return the next day, and recommend it.

---

## Local amendments (derived from W1 data, 2026-07-27)

**A1 — Minimum-n gate (extends Rule 3).** Do not declare a KPI improved or regressed below
n=30 users (funnel) or n=100 attempts (loop). W1 activation is n=1; week-over-week noise would
otherwise swamp signal. Record the number, mark confidence Low, wait.

**A2 — Asymmetric validation periods (extends Rule 2).** Core-loop KPIs (#7–#12) validate in
**days** — a handful of users generate hundreds of attempts. Funnel KPIs (#1–#6) and retention
(#15–#17) validate in **weeks** at ~6.5 users/day. Set validation periods per KPI class, never one
global period.

**A3 — D30 is not measurable until 2026-08-18.** Data begins 2026-07-19. Reporting a D30 number
before then is false precision. D7 is provisional until 2026-08-09.
