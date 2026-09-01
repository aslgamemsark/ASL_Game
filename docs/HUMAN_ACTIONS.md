# Human Actions

## Open

| Owner | Action | Evidence required | Why this needs a human |
|---|---|---|---|
| Release owner | Confirm the Vercel deployment backing `quicksignn.vercel.app` and record its Git commit. | Vercel deployment URL, commit SHA, and production alias. | Local CLI inspection did not return deployment metadata, and this task must not deploy or relink the project. |
| Database owner | Inspect production schema/conflicting migrations, review corrected legacy backfill, approve a rollback plan, apply `20260831195044_recognition_attempt_outcomes.sql`, then verify schema/data. | Approval, rollback/recovery plan, migration result, and post-apply queries proving legacy false rows stayed NULL. | This local task must not mutate production data. |
| ASL reviewer | Validate any minimal pairs, NMM requirements, variants, and new conversation wording before learner exposure. | Reviewed sign definitions/media/fixtures. | Linguistic authority cannot be inferred from existing fixtures. |
| Device testers | Test real camera recovery on Android, iPhone Safari, and desktop. | Device/browser matrix with pass/fail notes. | Automated fake cameras cannot establish real hardware behavior. |
| Recognition owner | Calibrate every shadow quality metric using valid, degraded, correct, and confusor fixtures plus real-device evidence before enabling any threshold. | Threshold report showing every valid fixture remains scorable and each enforced metric cleanly rejects its targeted degradation. | Current fixture overlap makes invented universal thresholds unsafe. |
| ML/data-license owner | Inventory every dataset used by each current/deployed classifier version; record governing licenses/permissions; confirm commercial rights to use and distribute resulting weights; obtain explicit permission where required or retrain on owned/commercially permissible data. | Dataset-to-model provenance plus license/permission records and written release approval. | This is a legal/provenance decision. Production builds strip the current weights until it is complete. |
