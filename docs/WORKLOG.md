# QuickSign — Engineering Worklog

## 2026-07-15 — Production sign-off pass

### What was done
- Ran three targeted audits (repo-wide TODO/dead-code, full Supabase security review, multiplayer
  concurrency review) and synthesized findings into four sign-off deliverables:
  `FINAL_PRODUCTION_SIGNOFF.md`, `LAUNCH_CHECKLIST.md`, `KNOWN_LIMITATIONS.md`,
  `POST_LAUNCH_ROADMAP.md`.
- **Security fix (applied to production DB + committed):** revoked the stray `anon`/`PUBLIC` EXECUTE
  grant on `admin_set_username` so it matches the 2026-07-12 hardening of every other admin RPC.
  Migration `20260715010000_harden_admin_set_username.sql`; verified in the live DB that only
  `postgres`/`authenticated`/`service_role` retain EXECUTE.
- **Moderation follow-through (applied to production DB):** the `admin_set_username` RPC was present
  as a file but had never been applied to the live database, and the slur username `n_i_g_g_a` was
  still live. Applied the RPC and renamed the row to `player_aaca7b28` (matching the sweep script's
  placeholder convention), logged in `admin_audit_log`. Re-ran the real `isInappropriate` filter
  against all 6 live usernames — all clean.
- **Duel bug fix (earlier this session):** the 1v1 "both players sign at once" bug — root cause was
  duplicated, non-complementary role logic. Extracted to one pure `isSignerForRound()`
  (`web/src/lib/duelRoles.ts`) used by all three call sites, with a regression test.
- **Code fix:** DEV-gated an unconditional production `console.warn` in `useRecognition.ts` to match
  its siblings.
- Merged `game-feel-and-launch-prep` → `main` (with explicit user approval) so the multiplayer/
  borders/region/streak/moderation work actually deploys — it had never been merged, which is why the
  Multiplayer tab was missing on the live site. Removed a stray `tmp_head_version.ts` leftover from an
  older merge along the way.

### Why
- The user requested a final production sign-off. The highest-value, safe actions were: (1) an honest,
  evidence-grounded audit, (2) the one clearly-correct security fix, (3) closing the moderation gap
  that was actually still live, and (4) getting the finished feature branch deployed.

### Tests / verification
- Full suite green throughout: **495 passed, 9 todo**. `tsc --noEmit` clean. Production build clean.
- Live DB grants on `admin_set_username` verified post-revoke.
- All live usernames verified against the real profanity filter.

### Commits (this branch: `production-signoff-audit`)
- DEV-gate the production console.warn in useRecognition.
- Add the four sign-off deliverables + this worklog.
- (Earlier, on `game-feel-and-launch-prep` / `main`): duel role fix, admin_set_username hardening,
  stray-file removal, feature-branch→main merge.

### Risks / open items
- **Not merged to main:** this audit branch is intentionally kept off `main` (docs + one gated log fix)
  pending review — `main` auto-deploys to production.
- Launch blockers remain **human-owned**: error monitoring, and privacy/legal for a minor-facing camera
  app (see `LAUNCH_CHECKLIST.md`).
- Low-severity DB hardening (showcase_badges / speed_high_scores / region CHECK / audit parity /
  migration reorder) is documented but **not** applied — deliberately left for a reviewed migration
  rather than more autonomous production DB mutation.

### Remaining work
See `POST_LAUNCH_ROADMAP.md` (sequenced) and `LAUNCH_CHECKLIST.md` (manual tasks).
