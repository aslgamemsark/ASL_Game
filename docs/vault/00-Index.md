---
type: moc
---

# ASL Game — Knowledge Base

Open **this repo's `docs/` folder** (or the repo root) as an Obsidian vault so the `[[wikilinks]]`
below resolve — Obsidian matches links by filename across the whole vault, so notes here can link
straight into the existing handoff docs (`[[AVATAR_AUTHORING_HANDOFF]]`, etc.) without needing
them moved. Nothing in this folder is required reading to run the app — it's a navigable map of
what exists and why, kept updated as work lands (not a one-time snapshot).

## Start here
- [[Architecture]] — the five-parameter sign schema, dual-engine parity, why it exists
- [[Scenarios]] — how coffee_shop / hospital_shop / classroom are structured and how to add a new one
- [[ML-Pipeline]] — the WLASL/ASL-Citizen → trained classifier pipeline

## This session's work (2026-07-03 growth roadmap)
- [[Workstream-F-Alphabet]] — fingerspelling letters W, I (and why H/N/U were deliberately skipped)
- [[Workstream-A-Classroom]] — the new Classroom/School scenario, signs, and training status
- [[Workstream-B-Mobile]] — responsive + performance fixes
- [[Workstream-C-Security]] — security hardening
- [[Workstream-D-E-Polish]] — sound/UI polish + the second Coffee Shop story

## Existing project docs (not duplicated here — linked)
- [[ARCHITECTURE]] — the original architecture doc
- [[AVATAR_AUTHORING_HANDOFF]] — read before touching `web/src/avatar/` (currently paused)
- [[VIDEO_RETARGET_HANDOFF]] — avatar retargeting research (currently paused)
- [[LICENSING_CHECKLIST]] — pre-commercial-release dataset/asset licensing checklist
- [[PROJECT_STATUS]] — the other standing status doc

## Standing decisions worth remembering
See [[Decisions-Log]] for the specific judgment calls made this session and why — read it before
assuming a pattern like the H/N/U letter aliasing is safe to reuse elsewhere.
