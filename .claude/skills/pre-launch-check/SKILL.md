---
name: pre-launch-check
description: Use before deploying QuickSign to production or announcing it (e.g. a Reddit launch). Runs the full automated quality gate (types, unit tests, lint, e2e health, production build), checks Supabase security/performance advisors, and prints the manual items only the user can do (key rotation, two-device multiplayer test, real-phone recognition). Produces a go / no-go report. NOT a substitute for the manual checks — it surfaces them.
version: 1.0.0
user-invocable: true
argument-hint: "(no args)"
license: MIT
---

# QuickSign pre-launch gate

Run this before any production deploy or public announcement. It has two parts: **automated
checks you run now** and **manual checks only the user can do**. Report a clear GO / NO-GO at the
end. Never report GO while any automated check is red or any launch-blocking manual item is
unconfirmed.

## Part A — Automated gate (run these)

From `web/`:

1. **Types:** `npx tsc --noEmit` — must exit 0.
2. **Unit tests:** `npx vitest run` — all pass (todos allowed). This includes the confusor
   regression tests that guard the COFFEE-class false-pass — a red here can mean a sign broke.
3. **Lint:** `npx oxlint src` — no errors (pre-existing react-hooks warnings are acceptable; a
   NEW error is not).
4. **e2e health:** `npx playwright test e2e/health.spec.ts e2e/smoke.spec.ts` — must pass. The
   health suite guards the class of defect that ships silently (the self-hosted-font 404 that
   dropped the app to a system font, broken images, console errors, blank unknown-route). If
   Playwright browsers aren't installed, run `npx playwright install chromium` first.
5. **Production build:** `npm run build` — must succeed. Confirm the PWA precache generated and no
   chunk error (size warnings are fine).

## Part B — Supabase advisors (run these)

Using the Supabase MCP tools against the production project:

6. `get_advisors` (type: security) — must be clean of NEW findings. Watch specifically for
   `rls_enabled_no_policy` (a table with RLS on but no policy = deny-all to authenticated role;
   this is what silently broke ALL multiplayer joins once). Any new security finding is NO-GO.
7. `get_advisors` (type: performance) — review; unindexed foreign keys / auth_rls_initplan are
   acceptable to defer if documented, but note them in the report.

## Part C — Manual checks (surface these — the user must confirm each)

These CANNOT be automated here. List each with its current status and ask the user to confirm:

- [ ] **Secret key rotation** — the exposed Supabase keys rotated + the leaked `sbp_` token
      revoked (user-only, via the Supabase dashboard). LAUNCH-BLOCKING.
- [ ] **Two-device multiplayer test** — a real duel/room between two devices actually connects,
      both webcams show, turns/timer work. Playwright can't stage a true 2-peer WebRTC session.
      LAUNCH-BLOCKING for the multiplayer feature.
- [ ] **Real-phone recognition test** — at least the pilot signs recognized on an actual phone
      camera (not just desktop). LAUNCH-BLOCKING for the core loop.
- [ ] **Feedback flow** — the in-app feedback button + the landing-page feedback link both reach
      the Google Form / feedback table.
- [ ] **Landing unfurl** — the landing page's OG image + tags render when the link is pasted
      (Reddit/Discord preview).
- [ ] **Training-data auto-cap** — the pg_cron trim is active so a traffic spike can't fill the DB.

## Report format

Print:
- **Automated:** each check with ✅/❌ and the key output line.
- **Advisors:** count of new security/performance findings, named.
- **Manual:** the checklist above with each item's status (confirmed / unconfirmed / N/A).
- **Verdict:** **GO** only if every automated check is green, no new security advisor finding, and
  every launch-blocking manual item is confirmed by the user. Otherwise **NO-GO**, listing exactly
  what blocks it. Do not soften a NO-GO.
