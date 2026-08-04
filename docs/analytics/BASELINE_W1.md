# KPI Baseline — Week 1 (frozen 2026-07-27)

Official baseline. Every future week is diffed against this. Do not edit historical rows; append
new week columns.

**Sources:** PostHog project 518794 · Supabase `juzqilqilxzmudazltjx` · window = all data to
2026-07-27 (first event 2026-07-19, so ~8 days).
**Segment rule:** all funnel/retention KPIs EXCLUDE `$geoip_country_code = 'PK'` (friends/family).
PK is reported separately, never blended.

---

## A. Activation funnel (non-PK)

| ID | KPI | W1 baseline |
|---|---|---|
| A1 | Users touching app | 52 |
| A2 | Reached app shell / Terms modal | 26 (50.0% of A1) |
| A3 | Got past Terms to a real onboarding step | 13 (50.0% of A2) |
| A4 | Reached auth step | 6 (46.2% of A3) |
| A5 | Reached skill step | 1 (16.7% of A4) |
| A6 | Completed onboarding | 1 (**1.9% of A1**) |
| A7 | Started a lesson | 2 |
| A8 | **Completed a lesson** | **1 (1.9% of A1)** |

**North-star: A8/A1 = 1.9%.**

## B. Core loop quality (all users — Supabase `sign_attempts`, n=812)

| ID | KPI | W1 baseline |
|---|---|---|
| B1 | Overall sign pass rate | 45.6% |
| B2 | Rule-engine pass rate | 93–100% per sign |
| B3 | **HELLO final pass rate** | **25.4%** (240 attempts) |
| B4 | YOU final pass rate | 28.9% (90 attempts) |
| B5 | PLEASE final pass rate | 70.8% (48 attempts) |
| B6 | Attempts vetoed by AI despite rule-pass | 170/240 HELLO; = 100% of HELLO failures |
| B7 | **Avg attempts per user on HELLO** | **24.8** (max 73) |
| B8 | Fingerspell pass rate (LETTER_*) | 66.7–100% |

## C. Retention (non-PK)

| ID | KPI | W1 baseline |
|---|---|---|
| C1 | Users active exactly 1 day | 51 / 52 |
| C2 | **D1 return rate** | **1/52 = 1.9%** |
| C3 | Users active 3+ days | 0 |

## D. Auth

| ID | KPI | W1 baseline |
|---|---|---|
| D1 | `signup_started` users | 9 |
| D2 | `signup_completed` users | 3 (33.3%) |
| D3 | `guest_started` users | 3 |

## E. Performance / health

| ID | KPI | W1 baseline | Verdict |
|---|---|---|---|
| E1 | LCP p75 mobile | 1,992 ms | healthy |
| E2 | LCP p75 desktop | 1,783 ms | healthy |
| E3 | `session_crashed` events | 1 | healthy |
| E4 | Median session (non-activated users) | 5–30 s | broken |

## F. Instrumentation trust (meta — fix before trusting the above)

| ID | Item | W1 state |
|---|---|---|
| F1 | `login` event | UNUSABLE — fires on token refresh, 222/user/day |
| F2 | `$rageclick` | IMPOSSIBLE — `autocapture: false` |
| F3 | Terms-wall drop-off | INFERRED only (screen_viewed minus onboarding_step_viewed), no direct event |
| F4 | Session replay | Working, ~20 recordings, AI summaries available |
| F5 | Auth tokens in analytics | LEAKING — `#` fragment unsanitized |

---

## Segment reference (do not blend)

| Country | Users | Saw onboarding | Onboarded | Lesson done |
|---|---|---|---|---|
| US | 38 | 11 | 1 | 1 |
| PK (friends/family) | 20 | 12 | 4 | 2 |
| IE | 6 | 1 | 0 | 0 |
| NL | 3 | 0 | 0 | 0 |
| CA | 3 | 1 | 0 | 0 |
| SE | 3 | 0 | 0 | 0 |

## Statistical health warning

n=52 non-PK users, n=1 activated. Any KPI below ~10 users is directional only. Findings B3/B6/B7
are exempt — 240 attempts with a 96.3% → 25.4% collapse is not a sample-size artifact.

## Reproduce these numbers

Queries used are in the audit turn (2026-07-27). Key one — the funnel:
`GROUP BY person_id` with `countIf(event=...)` per stage, then `countIf(is_pk=0 AND stage>0)`.
