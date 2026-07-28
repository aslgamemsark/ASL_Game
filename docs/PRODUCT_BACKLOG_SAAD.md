# QuickSign Product Backlog

> Format: one `### QS-0NN` block per item, grouped by severity. Update `Status:` in place when
> shipped — don't delete entries. Evidence must cite real numbers (PostHog project 518794 /
> Supabase `juzqilqilxzmudazltjx`), never guesses.
>
> **Analytics rule:** always exclude `$geoip_country_code = 'PK'` — that traffic is friends and
> family, not real users. Target market is US/CA.

---

## 🔴 Critical

### QS-001
Problem:
Need more users.

Evidence:
- most people are leaving at onboarding
Goal:
we need to make users do atleast 1 lesson.

Possible solutions:
-  read posthog analytics everyday at 12am(evening) and store the statistics , analyse them and give a thought on it,maybe ways to improve the app
make sure to open recording and maybe use (summarize by AI ) feature in post hog

Status:
Open — root causes now identified, see QS-002 through QS-005.

---

### QS-002
Problem:
The ML classifier veto rejects signs the user performed **correctly**. This is the single biggest
reason nobody finishes Lesson 1. The rule engine says pass; the AI overrides it and tells a correct
learner they are wrong, repeatedly, until they leave.

Evidence (Supabase `sign_attempts`, 812 attempts / 11 users, 2026-07-27):
- HELLO: 240 attempts → rule engine passed **231 (96.3%)** → final passed **61 (25.4%)**.
  All 170 losses were `ai_vetoed`. `rule_ok_but_failed` == `ai_vetoed` exactly, every sign.
- YOU: rule 97.8% → final 28.9%. MEDICINE: rule 100% → final 16%. WANT: rule 100% → final 33.3%.
- The model is *confidently* wrong, so no threshold fixes it:
  HELLO vetoed as `NO_SIGN` 81× @ 0.872 avg conf; as `HOSPITAL` 61× @ 0.938 avg conf (max 0.967).
  `GATE_CONFIDENCE` was already raised 0.5 → 0.7 once and did not help.
- One user attempted HELLO **73 times**; average 24.8 attempts per user on HELLO alone.
- Lesson 1 is `['HELLO','PLEASE','YOU']` (data/lessons.ts:16) — two of its three signs are the
  two worst performers in the entire app.
- Fingerspelled letters (static handshapes, no movement model) pass 90–100%. The failure is
  specific to the sequence model.

Root cause:
Out-of-distribution failure. `model_v4` was trained on ASL Citizen / WLASL studio video and scored
85% on that distribution; it is being run on live webcam landmarks. `NO_SIGN` @ 0.87 confidence on
a correctly-performed sign indicates the live preprocessing/temporal window does not match training.
The comment in `web/src/engine/gate.ts` claiming veto-only "never rejects a correct sign the user
actually made" is empirically false in production and should be corrected.

Possible solutions:
- **Immediate:** disable the veto (`GATE_CONFIDENCE` in `web/src/config/classifier.ts`, or bypass
  in `gatePass`). Restores the 96% rule pass rate today. Also lets the 1.08 MB `vendor-tfjs`
  chunk be dropped from the bundle.
- Then, before re-enabling: verify live-pipeline feature parity against training preprocessing;
  re-train/calibrate on the real webcam captures already collected (`training_samples` 808 rows,
  `sign_verification_log` 442 rows); re-enable per-sign only where measured veto precision is high.
- Per `.claude/rules/fixes.md`, do NOT ship another threshold bump as the fix.

Status:
Open

---

### QS-003
Problem:
Two consent/commitment walls stand between a cold visitor and any value. The first screen at the
root URL is a **Terms & Conditions modal** — not a hero, not a sign, not the camera. The second
onboarding step is an **account wall** ("Save your progress"), shown before the user has seen a
single sign.

Evidence (PostHog, non-PK users, 90d):
| Stage | Users |
|---|---|
| Non-PK users touching the app | 52 |
| Reached the app shell / Terms modal | 26 |
| Got past Terms to a real onboarding step | **13** |
| Reached the auth step | 6 |
| Reached the skill step | **1** |
| Completed onboarding | 1 |
| Completed a lesson | 1 |

- ~50% lost at the Terms wall; ~83% of those reaching auth never get past it.
- `signup_started` 9 users → `signup_completed` 3.
- Median session length for users who never reached onboarding: **5–30 seconds**.
- `landing.html` advertises "**Free, no signup**" — the app then demands signup. Promise break.
- "Continue as guest" is the lowest-contrast, smallest element on the auth screen
  (`text-z-gray-400 text-sm underline`, OnboardingFlow.tsx:160-165).

Possible solutions:
- Move Terms acceptance to first *account creation*, not first paint. A beta disclaimer can be a
  dismissible strip.
- Move the account wall to **after** the first successful sign (Duolingo's ordering). Let the whole
  first lesson run as guest, then offer "save your streak".
- Make guest the visually equal option, not a hidden link.
- Route the root URL to the real landing page, or fold its value proposition into the welcome step.

Status:
Open

---

### QS-004
Problem:
Supabase auth tokens are leaking into PostHog session recordings.

Evidence:
- A recording's `start_url` (2026-07-25T21:56) contains a full Supabase JWT `access_token` **and**
  `refresh_token` from a `type=signup` redirect. The JWT payload decodes to a real user's email.
- `sanitizeAnalyticsProperties` (`web/src/analytics/client.ts:28-36`) strips only `?` query
  strings. Supabase returns tokens in the `#` fragment, which passes through untouched.
- The function's own comment anticipates exactly this risk ("in case a query string (e.g. a
  password-reset or magic-link token) ever leaks") but only handles the wrong separator.

Possible solutions:
- Strip on `#` as well as `?` in `sanitizeAnalyticsProperties`, and scrub the fragment before
  PostHog initializes.
- Purge affected recordings; rotate/invalidate any still-valid refresh tokens.
- Add a unit test asserting a URL containing `access_token` is redacted.

Status:
Open

---

### QS-011 — Framing guide was calibrated to a headshot, not a signing space
Problem:
The camera-framing guide told users their framing was wrong 87% of the time, including users who
were signing perfectly.

Evidence (measured 2026-07-27, not estimated):
- PostHog `framing_check`: only **153 of 1,155 checks passed (13.2%)**. "Raise your camera a touch"
  fired 281× and hit **all 10** users who ever reached a camera.
- Framing had **no predictive validity**: the user with 0.0% framing-OK passed 9/9 signs; another
  at 1.4% passed 15/22; a user at 20.2% passed 0/52.
- Replayed the old rule over **27,110 frames from attempts the rule verifier actually passed**
  (`training_samples where rule_passed`): it rejected **81.1%** of them.
  Per-rule false-positive rate: mouth-height **77.0%**, come-closer 11.8%, center 2.2%, move-back 0.1%.
- Real successful geometry: shoulder-width median 0.409 (p05 0.289, p95 0.607), mouth median
  **0.641** — the old rule demanded ≤0.55, i.e. it excluded the typical successful signer.
- Signing space by sign: **PLEASE is the lowest** — hands sit *below* the shoulder line
  (median +0.036 of frame height) and **2.93% of its hand points already fall off the bottom edge**.
  HELLO is highest (−0.366). So "raise your camera" actively crops the signs that need low space.

Root cause:
The rule modelled face + shoulder position and never checked room *below* the shoulders, which is
where chest-level signs happen. It optimised for the one thing that hurts PLEASE/COFFEE/MORE.

Fix shipped (S1-T8): mouth rule deleted; come-closer 0.32 → 0.28 (p05 of real successes);
chest-room advice added at shoulder-Y > 0.92 as a **non-blocking tip**; first-run guide given a
20s safety ceiling so it can never nag for a whole lesson. New rule set passes **94%** of the same
known-good frames (was 18.9%). 7 calibration tests in `web/tests/framing.test.ts`.

⚠️ Caveat: `training_samples` only contains attempts that passed, so this measures **false
positives**, not false negatives. It cannot rule out framings that genuinely break recognition.

Status:
Shipped 2026-07-27 — verify against W2 `framing_check` ok-rate (target ≥85%, baseline 13.2%)

---

## 🟠 High

### QS-005
Problem:
Retention is effectively zero and the instrumentation that would explain it is partly broken.

Evidence:
- **51 of 52** non-PK users were active on exactly one day. One user returned for a second day.
  Zero users reached day 3.
- `login` fires on every Supabase `SIGNED_IN`, including token refresh — one user produced **222
  login events in a single day** (`AuthContext.tsx:82`). The metric is unusable as-is.
- `autocapture: false` means PostHog cannot compute `$rageclick` — a core signal for QS-001's
  "read recordings" plan is structurally unavailable.
- `dominant_hand_selected` is emitted from `PracticePage.tsx`, not onboarding, but an
  `onboarding_step_viewed` step named `hand` exists in the data — taxonomy drift worth cleaning.

Possible solutions:
- Gate the `login` track on a real sign-in (compare against previous session id) rather than the
  raw `SIGNED_IN` event.
- Enable autocapture, or add explicit dead-click/repeat-click instrumentation on key CTAs.
- Fix QS-002 and QS-003 first — there is currently no retention to measure because almost nobody
  reaches the product.

Status:
Open

---

### QS-006
Problem:
The welcome screen overflows the fold on a 720p viewport, and communicates nothing about what the
product actually does.

Evidence:
- Measured on production at 1280×720: `document.scrollHeight` 728px vs 720px viewport. The
  "Get Started" CTA sits at y=628–688 — the very bottom edge. On a 1366×768 laptop with browser
  chrome (~650px usable) it would sit below the fold.
- Total copy on the screen: "Welcome to QuickSign / BEYOND WORDS / Hi! I'm Zippy. Let's learn to
  sign, one step at a time." No mention of the camera, the per-parameter feedback, that it's free,
  or how long a lesson takes — while `landing.html` (which almost nobody sees) says all of it well.

Possible solutions:
- Tighten vertical rhythm so the CTA clears a 650px viewport.
- Pull the landing page's actual value proposition ("Practice real signs with real-time feedback
  that tells you exactly what to fix", "on-device, private", "free") onto this screen.

Status:
Open

---

## 🔵 Merged from Rafay's backlog (triaged 2026-07-27)

Source preserved verbatim at [PRODUCT_BACKLOG_RAFAY.md](PRODUCT_BACKLOG_RAFAY.md).

### QS-009 (was Rafay QS-002) — Drop email/password signup; keep Google + guest
Problem:
Email signup loses half the people who start it.

Evidence:
- Rafay: session replays `019f91e5-18a4-7048-8790-946904c61f5f`,
  `019f9b45-90dd-7419-b246-72cb459226dd` — users leaving before confirming their email.
- **Confirmed in `auth.users`:** 4 email signups, **2 never confirmed (50%)**. 17 of 21 total users
  came via Google. `signup_started` 9 → `signup_completed` 3 in PostHog.

⚠️ **Rafay's stated mechanism is NOT supported by the data — the fix is still correct.**
He attributed it to "Supabase can only handle 5 emails per hour." The 4 email signups occurred on
2026-07-16, 07-24, 07-25 and 07-26 — days apart, never clustered, so no hourly limit was hit.
`confirmation_sent_at` is populated within ~0.1s in all 4 cases, and the 2 who did confirm took
**1.7 min and 0.23 min** — delivery works and is fast. The real mechanism is the **context switch**:
users leave the app to check email and don't come back.

This distinction matters: believing the rate-limit theory would lead to configuring custom SMTP
(SendGrid/Resend), which would **not** fix anything. Removing the email round-trip does.
(Rate limits may still bite later at higher volume — revisit above ~50 signups/day.)

Goal: raise signup conversion (KPI #6, baseline 33.3%).

Possible solutions:
- Hide email/password signup; offer **Google + Continue as guest** only. Keep email *sign-in* for
  the 4 existing accounts. Behind a flag so it's reversible.
- Supersedes nothing in Sprint 2 — it composes with QS-003's guest-first ordering.

Status:
Open — scheduled S1-T6 (cheap, low risk, cannot confound Sprint 1's core-loop KPI)

---

### QS-010 (was Rafay QS-001) — No path to the next lesson after completing one
Problem:
After finishing a lesson there is no "Next lesson" action, and returning Home does not surface
where the user left off.

Evidence:
- Rafay: PostHog session `019f91da-af1b-7bbc-b146-2d01ed87d0d2`; replays show users leaving before
  starting a second lesson.
- Corroborating: `lesson_completed` 5 events / 3 users vs `lesson_started` 12 / 5 users — nobody
  progresses past their first completion.

⚠️ **Deliberately NOT scheduled for Sprint 1.** Only 1 non-PK user has ever completed a lesson, so
this currently affects ~1 person and cannot be measured (minimum-n gate). It becomes a top-priority
item the moment QS-002 + QS-003 land and users start finishing lessons — it is the *next*
bottleneck, not the current one.

Goal: lessons completed per activated user (currently ~1.0).

Possible solutions:
- "Next lesson →" as the primary action on the completion screen.
- Home auto-scrolls to / highlights the next incomplete lesson.

Status:
Open — scheduled Sprint 2, pending Sprint 1 data

---

## 🟡 Medium

### QS-007
Problem:
`room_join_attempts` has RLS enabled but **no policies**, and 11 `SECURITY DEFINER` admin functions
are executable by any authenticated user.

Evidence (Supabase security advisor, 2026-07-27):
- `rls_enabled_no_policy` on `public.room_join_attempts`.
- `admin_grant_gold`, `admin_set_ban`, `admin_grant_cosmetics`, `admin_set_username`,
  `admin_set_world_flag`, `admin_analytics`, and others callable via `/rest/v1/rpc/...` by the
  `authenticated` role.
- Leaked-password protection (HaveIBeenPwned) is disabled in Supabase Auth.

Possible solutions:
- Confirm each `admin_*` function performs its own `is_admin` check internally; if it does, this is
  informational — document that. If any does not, revoke `EXECUTE` from `authenticated`.
- Add an explicit policy to `room_join_attempts` (or drop the table if unused — it has 3 rows).
- Enable leaked-password protection.

Status:
Open

---

### QS-008
Problem:
Bundle carries 1.08 MB of TensorFlow.js to run the model that is currently breaking recognition.

Evidence:
- `dist/assets/vendor-tfjs-*.js` = 1,082,670 bytes uncompressed; `dist/` totals 18 MB.
- `AnalyticsTab` chunk is 393 KB — admin-only surface.

Possible solutions:
- Falls out of QS-002: if the veto is disabled, tfjs and the model download can be dropped entirely
  until the model is fixed.
- Confirm `AnalyticsTab` is lazy-loaded behind the admin check.

Status:
Open

---

### QS-009
Problem:
The light theme shipped without a contrast audit. 26 token/surface pairs were below WCAG AA,
including every colour that carries the product's core feedback vocabulary. A learner in light
mode could not reliably read whether they had just succeeded.

Evidence (computed from the `@theme` values in `web/src/index.css`, both themes, all three
surfaces — `z-bg` / `z-card` / `z-surface`):
| Token | Role | Worst ratio (light) | Text call sites |
|---|---|---|---|
| `z-yellow` | XP | **1.27:1** | 34 |
| `z-orange` | streak / energy | **2.02:1** | 14 |
| `z-green` | sign passed | **2.82:1** | 26 |
| `z-blue` | info | 3.87:1 | 1 |
| `z-gray-300` | muted body text | 4.23:1 | 102 |
| `z-purple-light` / `-glow` | brand accent text | 4.26:1 | 69 |

- The dark theme was clean (one pair at 4.40:1) — so this is specifically a theme that was never
  audited, not a general palette problem. Light mode is user-toggleable and persisted
  (`contexts/ThemeContext.tsx`), so this is live for anyone who flips it.
- Root cause: light values were chosen by hue-matching their dark counterparts rather than
  re-derived against an inverted background. `--rt-z-yellow` was `#4CD7F6` in BOTH themes.
- Contradicts PRODUCT.md's stated floor ("WCAG AA is the floor").

Fix shipped:
Light values re-derived by holding each colour's OKLCH hue + chroma and lowering lightness only
until it cleared AA against `z-bg` (the darkest light surface, so clearing it clears the other
two). Dark `z-red` `#EF4444` → `#F24746`. Also removed the raw-Tailwind drift that DESIGN.md says
was fixed on 2026-07-11 and has since regressed (8 sites: `emerald-400`/`emerald-500`/`blue-200`,
plus a hardcoded `#34D399` inline style in `DailyQuestsCard`). `ClassifierDevPanel`'s raw colours
were deliberately left — it renders on a fixed `bg-black/85`, so it is theme-independent.

Guarded by `web/tests/tokenContrast.test.ts` — parses the shipped CSS (not a duplicated palette)
and asserts every text token against every surface in both themes, 84 assertions. Verified to
fail with the real ratio when a token regresses.

Status:
Shipped 2026-07-27 — `npm run build` clean, 640 tests pass, new values confirmed in emitted CSS.

---

### QS-010
Problem:
The "saturated gradient card" pattern is used ~6 times and its `bg-black/30` scrim was tuned
against one gradient. It does not hold for the lighter gradients in the family, so subtitle text
on several cards is below AA.

Evidence (contrast measured over each gradient's light end, at the scrim each card uses today):
| Card | Gradient light end | Subtitle today | Ratio |
|---|---|---|---|
| HomePage Speed Challenge | `#3B82F6`, **no scrim** | `text-blue-200` | **2.59:1** |
| SpeedChallenge — Warm Up | `#14B8A6` @ /30 | `text-white/70` | 3.16:1 |
| SpeedChallenge — Sprint | `#3B82F6` @ /30 | `text-white/70` | 4.13:1 |
| SpeedChallenge — Blitz | `#A855F7` @ /30 | `text-white/70` | 4.30:1 |
| ShopPage gold card | `#F59E0B` @ /30 | — | 2.88:1 at white/70 |

- The teal and amber cards fail even at **full white** under a /30 scrim (4.77:1 and 4.20:1).
- DESIGN.md records the 2026-07-03 pass as having fixed "SpeedChallenge tier cards" — it fixed the
  white *headings*, not the subtitles beneath them, and missed HomePage's entry-point card
  entirely (same gradient, same card shape, no scrim at all).
- Verified floor: **`bg-black/45` + `text-white/80`** clears AA on every card in the family
  (4.62:1 worst case, the amber shop card). `text-white/70` still fails there (3.94:1).

Fix shipped:
The per-call-site scrim div is gone. Nine `@utility bg-gradient-*` classes in `index.css` now own
the family, each with the 45% scrim painted as its first background layer — a card physically
cannot be added without one. All 20 hardcoded `linear-gradient(...)` values are gone from
components; the only inline gradients left are token-based or data-driven (a world's or unit's own
identity colour), and world gradients get the same 45% floor via `WorldMap`'s `scrimmed()` helper.

Two further failures surfaced while doing it, both worse than the original finding:
- **`bg-gradient-primary` — every primary button in the app** ("Get Started", "Start Signing",
  "Continue", "Claim!") — ended on `z-purple-light`, putting white bold label text at **2.72:1**
  in the dark theme, under even the 3:1 large-text floor. The 2026-07-11 consolidation had picked
  the lighter of the two drifted pairs. Now ends on `z-purple`: 7.53 → 5.70:1.
- **World cards**, the app's main navigation, had **no scrim at all**: white/80 subtitles sat at
  **1.72:1** on the teal world. Their gradients come from `data/worlds.ts`, chosen as world
  identity colours with no reference to the text that would sit on them.
- The wordmark (`SideNav`/`TopBar`) hardcoded the dark theme's `#A78BFA`/`#14B8A6`, so in the light
  theme it rendered pale lavender on pale lavender at **2.05:1** — effectively invisible.
  Tokenised as `text-gradient-brand`.
- `StreakCard`'s milestone badge used `text-z-yellow` on the streak gradient: **1.95:1** in the
  light theme. Accent tokens invert with the theme; these gradients do not, so the two cannot be
  combined. Now white.

Guarded by two tests. `tests/tokenContrast.test.ts` parses each `@utility`'s scrim alpha and colour
stops out of the shipped CSS and asserts white / white-80 clears AA on the LIGHTEST stop, per theme
— verified to reproduce both original numbers (2.72:1 primary, 3.65:1 teal at the old /30 scrim).
`tests/designTokens.test.ts` fails on any literal hex inside a `linear-gradient(...)` in a `.tsx`,
and on any `bg-gradient-*` class used but not defined (Tailwind drops unknown classes silently,
which would render a transparent card with white text on it).

Status:
Shipped 2026-07-27 — 656 tests pass, `tsc -b` clean, production build clean, all 10 utilities
confirmed in the emitted CSS. Before/after captured at `web` preview in both themes.

---

### QS-012
Problem:
Every overlay on the camera and reference-clip surfaces was built assuming the video behind it
would be dark. It is dark in a developer's room. Against a bright one — a learner sitting in front
of a window, which is a normal way to sit for a camera app — seven of them dropped below AA, three
of them to the point of being invisible.

Evidence (worst-case contrast, each overlay composited over a white frame AND a black frame,
2026-07-27):
| Overlay | Treatment | On a bright frame |
|---|---|---|
| WebcamMirror hand-zone label | unplated `text-white/60` | **1.00:1** — invisible |
| ReferenceClip sign name | at the transparent end of a `to-t from-black/60` fade | **1.41:1** |
| WebcamMirror hand label, occupied | `text-z-green` on `bg-z-green/10` | 1.79:1 |
| Camera guide, SUCCESS state | `bg-z-green/90` + `text-white` | **1.82:1** |
| ReferenceClip subtitle | `text-white/70` on the fade | 2.46:1 |
| ReferenceClip ⤢ badge | `bg-black/50` + `text-white/90` | 3.56:1 |
| TurnOverlay label | `bg-z-purple/85` | 4.36:1 |

Two of these are worse than their ratio suggests. The camera guide's failure was on its **success**
state — the one message telling a learner they are finally framed correctly was the least readable
thing on screen, while the error state (`bg-black/75`, 10.41:1) was fine. And the reference clip's
fade put the *least* backing behind the *most* important label: on a `to-t` gradient the
transparent end is the top, which is exactly where the sign name sits.

Root cause:
Two mistakes, both invisible to review. (1) A fade was treated as a plate — it is decoration, and
where the text sits in it was never checked. (2) Accent tokens were used as text over video; they
invert with the theme and the video does not, so no single value can work.

Fix shipped:
One `@utility bg-video-plate` (62% black — derived from the worst case; below 54% a bright frame
wins) behind all 9 overlays across 5 components. `text-white/85` floor. State moved onto borders
and icons. The reference-clip caption is now a text-free fade strip above a real plate, keeping the
soft edge without putting text on it. The ✓ badge uses `bg-z-green` + `text-z-bg`, which works
because those two tokens invert in opposite directions between themes.

Guarded by `tokenContrast.test.ts` (plate alpha against both frame extremes, plus the ✓ badge and
turn chip per theme) and `designTokens.test.ts` (no `bg-black/NN` and no sub-85 white text in the
five video-surface components; `fixed inset-0` modal backdrops excluded by position, not by an
exception list that would rot). The markup guard was verified to fail on the real `text-white/60`.

Status:
Shipped 2026-07-27 — 676 tests pass, `tsc -b` clean, production build clean. Before/after rendered
over a blown-out frame using the shipped stylesheet.

---

### QS-013
Problem:
Colour contrast was the only accessibility axis this project had ever measured. Operability —
keyboard reachability, dialog semantics, accessible names — had never been checked at all. Two
distinct classes of barrier were sitting in the app.

Evidence (2026-07-28):
- **Five unlabelled toggle switches on Settings.** `role="switch"` with `aria-checked` but no
  accessible name, so a screen reader announced all five as "switch, on" with nothing to say which
  setting had been toggled — including the two privacy controls (training-data collection and
  analytics opt-out). axe `button-name`, critical. The markup was copy-pasted five times, which is
  why all five shared the same omission.
- **Eight of eleven dialogs had no dialog semantics whatsoever** — no `role="dialog"`, no
  `aria-modal`, no Escape, no focus management. A keyboard user could tab straight through them
  into the page behind, and nothing announced that a dialog had opened. Three more
  (`ClipEnlarge`, `FeedbackModal`, `TermsModal`) had the aria attributes but no focus trap.
  Affected: `CameraOnboarding` (the gate every learner passes before the camera opens),
  `LogoutConfirm` (a destructive confirm), `CelebrationHost`, `LetterDetailModal`,
  `SignDetailModal`, `ReportUserModal`, `BadgesSection`, `ShopPage`.

Root cause:
The same shape both times — a correct shared implementation existed and adoption stopped. The
2026-07-12 audit fixed the four auth modals and extracted `ModalShell` with a full focus trap, but
the behaviour was welded to that component's centred-card chrome, so bottom sheets, a full-screen
first-run gate and a portal'd lightbox could not use it and simply went without.

Fix shipped:
- `Toggle` component with a REQUIRED `label`, wired through `aria-labelledby` to the visible text so
  the two cannot drift. Five call sites collapsed into it; a sixth cannot be added unlabelled.
- `useDialogA11y` hook carrying role, `aria-modal`, accessible name, focus-into, focus trap, focus
  restore and Escape. Applied to all twelve dialogs; `ModalShell` now uses it too, so there is one
  implementation rather than two. Takes `active` for the five components that stay mounted and gate
  their own content on an `open` flag — without it the trap arms while the dialog is closed, which
  was a real bug caught during this work, not a hypothetical.

Also fixed in passing: **the e2e smoke suite had been red since the onboarding rework.** Both
failing tests asserted a dominant-hand step that moved out of onboarding into PracticePage (it needs
a live camera). Nobody noticed, which is its own finding — the suite is not in CI.

Guarded by `e2e/a11y.spec.ts` (axe-core over 12 screens and states; contrast rules disabled there
because axe cannot see through a canvas or video, and contrast is already owned by the unit tests)
and a `designTokens.test.ts` rule requiring every `fixed inset-0` overlay to route through the hook
or the shell. That second one matters because axe CANNOT catch missing dialog semantics — it has no
way to know a div was meant to be a dialog, and it passed clean while all eight were broken.

Status:
Shipped 2026-07-28 — 681 unit tests + 15 e2e pass, `tsc -b` clean, oxlint 0 errors, production
build clean.

Follow-up shipped the same day:
- **Desktop sweep added.** Above `lg` the app swaps BottomNav for SideNav — different markup and
  labels, never scanned. 5 more screens, clean.
- **The Sign Coach now speaks.** `ParameterChecklist` carries a `role="status"` live region; the
  app had no live region anywhere. It announces ONE correction at a time, only for a parameter the
  coaching gate has marked `confident-fail`, and stays silent otherwise — three instructions read
  aloud is noise, and 'neutral' is not worth interrupting for. The decision of what to say is a
  pure function (`coachAnnouncement`) so it is unit-tested without a camera; mutation-checked to
  confirm the one-at-a-time and silence-on-no-hint cases actually bite.

Remaining in this area (not blockers):
- Other status messages still announce nothing: the sync-error toast, the skip toast, the
  incoming-challenge notification, and lesson success/XP.
- The e2e suite is not in CI. Three of this sprint's regressions would have been caught earlier by
  tests that already existed — the smoke suite sat red for days without anyone noticing.

---

## ✅ Verified healthy (do not spend time here)

- **Core Web Vitals.** LCP p75: Mobile 1,992 ms, Desktop 1,783 ms — both inside Google's "good"
  threshold. Load performance is *not* a drop-off cause.
- **Fingerspelled letters.** LETTER_B 100%, LETTER_H 93.3%, LETTER_I 90.9%, LETTER_N 66.7%.
  The static-handshape path works.
- **The rule engine.** 93–100% pass rate across every measured sign. The recognition core is sound;
  only the ML layer on top of it is broken.
- **Event taxonomy design.** `analytics/events.ts` is a genuinely well-built single source of truth
  with compile-time enforcement. The problems are in a few call sites, not the architecture.
