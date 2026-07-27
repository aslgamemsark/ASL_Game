# KPI Dashboard (living)

Updated every sprint. Week columns are append-only — never overwrite a past week.
Segment rule: excludes `$geoip_country_code = 'PK'` unless marked "all users".
Frozen snapshots: [BASELINE_W1.md](BASELINE_W1.md).

**Minimum-n rule:** do not declare a KPI "improved" or "regressed" unless the denominator is
≥ 30 users (funnel KPIs) or ≥ 100 attempts (loop KPIs). Below that, record the number and mark
confidence **Low**. This prevents celebrating noise — W1 activation is n=1.

| # | KPI | W1 (2026-07-27) | W2 | Δ | Δ% | Trend | Conf | Status |
|---|---|---|---|---|---|---|---|---|
| **ACTIVATION** |
| 1 | Users touching app | 52 | | | | | High | baseline |
| 2 | Past Terms wall (A3/A2) | 50.0% | | | | | Med | 🔴 |
| 3 | Onboarding completion (A6/A1) | 1.9% | | | | | Low (n=1) | 🔴 |
| 4 | **Lesson 1 completion (A8/A1)** | **1.9%** | | | | | Low (n=1) | 🔴 NORTH STAR |
| 5 | Guest conversion (guest→lesson) | not measurable | | | | | — | ⚠️ needs S1-T4 |
| 6 | Signup conversion (D2/D1) | 33.3% (3/9) | | | | | Low | 🟠 |
| **CORE LOOP** (all users) |
| 7 | Recognition accuracy — final pass | 45.6% (n=812) | | | | | High | 🔴 |
| 8 | Recognition accuracy — rule engine | 93–100% | | | | | High | ✅ |
| 9 | HELLO pass rate | 25.4% (n=240) | | | | | High | 🔴 |
| 10 | Avg attempts per sign (HELLO) | 24.8 (max 73) | | | | | High | 🔴 |
| 11 | Time to first successful sign | not measurable | | | | | — | ⚠️ needs instrumentation |
| 12 | Recognition failures (rule-pass vetoed) | 170/240 HELLO | | | | | High | 🔴 |
| **ENGAGEMENT** |
| 13 | **Median session duration** | **21 s** (p75 34 s) | | | | | High | 🔴 |
| 14 | Session abandonment (<30 s) | ~50% of sessions | | | | | Med | 🔴 |
| **RETENTION** |
| 15 | D1 return rate | 1.9% (1/52) | | | | | Low (n=1) | 🔴 |
| 16 | D7 retention | **not computable** | | | | | — | ⚠️ 8 days of data |
| 17 | D30 retention | **not computable** | | | | | — | ⚠️ earliest 2026-08-18 |
| **HEALTH** |
| 18 | Camera permission grant rate | **100%** (10/10) | | | | | Med | ✅ NOT A PROBLEM |
| 19 | Camera errors / stalls | 0 / 0 | | | | | Med | ✅ |
| 20 | Crash rate | 1 user (`session_crashed`) | | | | | Med | ✅ |
| 21 | Fatal errors | 0 | | | | | Med | ✅ |
| 22 | LCP p75 mobile / desktop | 1,992 / 1,783 ms | | | | | High | ✅ |
| 23 | AI model unavailable | 2 users | | | | | Low | 🟡 |

Legend: 🔴 broken · 🟠 poor · 🟡 watch · ✅ healthy · ⚠️ cannot measure yet

## Measurement gaps to close (blocks the dashboard)

| Gap | Blocks KPI | Fix | Sprint |
|---|---|---|---|
| No Terms modal event | #2 direct measurement | `terms_viewed/accepted/deferred` | S1-T4 |
| No guest→lesson linkage | #5 | `auth_option_selected {method}` | S1-T4 |
| No first-success timestamp | #11 | emit `first_sign_success {ms_since_lesson_start}` | S1-T4 |
| `login` fires on token refresh | #15 return rate | session-id guard | S1-T3 |
| Only 8 days of history | #16, #17 | time only | — |

## Dead events (Rule 7 — deletion candidates)

Declared in `analytics/events.ts`, **never once emitted**: `hint_used`, `lesson_skipped`,
`camera_error`, `camera_stalled`, `fatal_error`, `camera_permission_denied`,
`password_reset_requested`, `streak_lost`, `chest_skipped`, `friend_removed`, `bug_reported`,
`feature_requested`, `multiplayer_*` (8 events), `journey_completed`.

Not all are bugs — `camera_permission_denied` at zero is *good news*. But `hint_used` and
`lesson_skipped` appear to be unwired (see the comment at `LessonPage.tsx:99`). Audit before S3.
