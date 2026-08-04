# Worklog

## Record every change as you make it, not at the end

`docs/WORKLOG.md` is the running record of what actually changed in this repo and why. It is
maintained continuously during a session, not written up afterwards.

**Read it at the start of every session, before writing any code.** It is the fastest way to learn
what the last session did, what is half-finished, and what was deliberately left alone. Read it
alongside `HANDOFF.md` (see `process.md`) — HANDOFF is the phase-level pointer, WORKLOG is the
change-level history.

---

### Append after every substantive change, in the same turn

The moment a change is verified — a fix lands, a test passes, a file is created or deleted — append
its entry. Do not batch entries to the end of a session: a session that runs out of context, is
interrupted, or is compacted loses everything not yet written down. That has already happened here,
which is why this rule exists.

An entry is required for: a bug fixed, a feature shipped, a file added or removed, a dependency
changed, a config value changed, a test added, a deliberate decision not to do something.

An entry is NOT required for: reading files, running tests that pass unchanged, exploratory
searching, or a change reverted within the same turn.

**Entry format** — one bullet, newest section at the top:

```markdown
## 2026-07-29

- **Switched the PWA to `registerType: 'autoUpdate'`** (`web/vite.config.ts`,
  `web/src/components/pwa/InstallPrompt.tsx`, `web/src/lib/cameraActivity.ts` — new).
  **Why:** under `'prompt'` the update was opt-in, so 13 of 17 real production users were still
  running the 2026-07-24 bundle days after the S1 fixes shipped. **Watch out:** the plugin
  force-reloads on activation; `onNeedReload` + `runWhenCameraIdle` defer that so it can never
  land mid-lesson. **Verified:** 687 unit + 76 e2e green; `dist/sw.js` has `clientsClaim()`.
```

State the mechanism, not just the symptom — same standard as `fixes.md`. "Fixed the nav" teaches
nothing; "BottomNav rendered only inside HomePage because 5 of its 8 items were HomePage-internal
tab state" teaches the next reader something reusable.

---

### Summarize when the file gets long

When `docs/WORKLOG.md` passes roughly 400 lines, or at the start of a session where it is already
long, compress it in place:

1. Keep the **current month** at full detail.
2. Collapse each older month into a short "what changed and what still matters" summary —
   preserve decisions, mechanisms, and gotchas; drop routine entries whose outcome is now just
   how the code works.
3. Never delete an entry that records a **deliberate decision not to do something**, a
   **known limitation**, or a **fix whose mechanism could recur**. Those are the entries that stop
   the same bug being reintroduced.

Summarizing is lossy by design — the goal is a file that still fits in context and is still worth
reading, not a complete archive. Git history is the complete archive.

---

### Rationale

Context runs out mid-session. When it does, everything held only in conversation is gone: which
fixes landed, which were abandoned and why, which numbers were measured, which assumption turned
out to be wrong. Re-deriving that costs far more than writing one bullet at the time.

It also protects against a specific failure this project has already hit: acting on a stale
conclusion. A worklog entry dated the day a fix shipped is what makes it obvious, later, that a
measurement spanning that date is mixing two different versions of the app.
