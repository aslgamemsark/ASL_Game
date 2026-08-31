# Human Actions

## Open

| Owner | Action | Evidence required | Why this needs a human |
|---|---|---|---|
| Release owner | Confirm the Vercel deployment backing `quicksignn.vercel.app` and record its Git commit. | Vercel deployment URL, commit SHA, and production alias. | Local CLI inspection did not return deployment metadata, and this task must not deploy or relink the project. |
| Database owner | Review and apply the future `sign_attempts` outcome migration. | Approved migration and post-apply query result. | This task does not mutate production data. |
| ASL reviewer | Validate any minimal pairs, NMM requirements, variants, and new conversation wording before learner exposure. | Reviewed sign definitions/media/fixtures. | Linguistic authority cannot be inferred from existing fixtures. |
| Device testers | Test real camera recovery on Android, iPhone Safari, and desktop. | Device/browser matrix with pass/fail notes. | Automated fake cameras cannot establish real hardware behavior. |
