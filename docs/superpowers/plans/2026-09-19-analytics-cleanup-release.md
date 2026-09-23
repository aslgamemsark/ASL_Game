# Analytics repair and repository cleanup

User authorized fixing and pushing the ASL bug fixes and analytics, adding useful events, and removing unused code/documentation. Animation content selection stays deferred.

Work from production baseline 50850b7 in this isolated worktree. Preserve the main checkout's unfinished work. Review its analytics fixes for selective reuse.

1. Repair ordered identity initialization/reset, first-success identity scope, safe first/latest attribution, and explicit internal traffic labels. Test delayed SDK and account transitions.
2. Add bounded camera/model and recognition-run diagnostics, demo playback failures, and accurate lesson counts. Recognition runs are not all physical sign attempts or an accuracy metric. Rename misleading runtime error reporting and limit repeated errors.
3. Correct auth intent/completion semantics. Preserve consent, URL redaction, local recognition, and all sign thresholds.
4. Consolidate general handoffs and correct onboarding documentation; retain specialized engineering history. Remove only proven unused source artifacts and wrappers, with reference checks.
5. Repair existing PostHog dashboards and activity definitions; label historical limitations and new-event release boundaries. Do not erase historical events or merge people speculatively.
6. Run regression/unit/type/lint/build/browser checks, independent review, then commit and push the reviewed branch. Follow repository release checks before merging/deployment; refresh the graph after cleanup.

Ownership: analytics worker owns SDK/identity/attribution/static pages and analytics docs; documentation worker owns root/general docs; primary owns lifecycle instrumentation, error/auth semantics, final review, PostHog dashboards and publication.

## Verification and release boundary

- Unit suite: 64 files, 778 passing tests, 9 existing expected failures, 10 TODOs.
- First-learning regressions: 7 passed, including camera/model recovery, older-browser ID fallback,
  recovery after one frame error, skip outcome, completion deduplication and correct XP.
- Production health/smoke: 24 passed across desktop Chromium, Android and iOS browser profiles.
- TypeScript build, production bundle/PWA generation and lint passed. Existing hook warnings,
  mixed PrivacyPage import and large-bundle warnings remain. Diff whitespace check passed.
- Independent review findings fixed; no engine definitions, recognition thresholds or demo assets changed.
- PostHog: nine existing insights corrected, two diagnostics added, four dashboards scoped to
  canonical external traffic, customer activity changed to screen_viewed. Saved dashboard readback
  and error-query execution verified; new events await deployment and ingestion validation.
- Seven general historical documents archived intact; default onboarding reduced to AGENTS and
  AI_ONBOARDING. Analytics guidance reconciled; historical figures preserved as dated evidence.
- Publish the reviewed branch and PR. Do not merge to production on the strength of these tests.
  The pre-launch skill says: "Never report GO while any automated check is red or any launch-blocking
  manual item is unconfirmed." Supabase advisors are unavailable in this session. Key rotation,
  two-device multiplayer and real-phone recognition confirmations remain unverified. No new
  secret exposure is asserted by this release note; these are inherited release checklist gates.
