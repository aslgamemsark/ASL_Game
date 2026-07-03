---
type: moc
---

# ASL Game — Knowledge Base

Open **this repo's `docs/` folder** (or the repo root) as an Obsidian vault so the `[[wikilinks]]`
below resolve — Obsidian matches links by filename across the whole vault, regardless of
subfolder, so notes here link straight into the existing handoff docs (`[[AVATAR_AUTHORING_HANDOFF]]`,
etc.) without needing them moved. Nothing in this folder is required reading to run the app — it's
a navigable map of what exists and why, kept updated as work lands (not a one-time snapshot).

## Folder layout
- `docs/vault/` (this folder) — the knowledge base: core reference notes at this level,
  session-by-session work logs under `Workstreams/`.
- `docs/*.md` (one level up) — the original, longer-form handoff docs (avatar rig conventions,
  licensing checklist, architecture). Not moved into the vault folder — linked from here instead,
  so this reorganization didn't touch their git history.

## Start here (core reference — rarely changes)
- [[Architecture]] — the five-parameter sign schema, dual-engine parity, why it exists
- [[Scenarios]] — how coffee_shop / hospital_shop / classroom are structured and how to add a new one
- [[ML-Pipeline]] — the WLASL/ASL-Citizen → trained classifier pipeline
- [[Decisions-Log]] — judgment calls made without stopping to ask, and why — read before assuming
  a pattern (like the H/N/U letter aliasing) is safe to reuse elsewhere

## Session work logs (`Workstreams/`, newest session first)
**2026-07-03 growth roadmap:**
- [[Workstream-A-Classroom]] — the new Classroom/School scenario, signs, and `model_v6` training
- [[Workstream-B-Mobile]] — responsive + performance fixes
- [[Workstream-C-Security]] — security hardening
- [[Workstream-D-E-Polish]] — sound/UI polish, the second Coffee Shop story, the `impeccable` contrast fix
- [[Workstream-F-Alphabet]] — fingerspelling letters W, I (and why H/N/U were deliberately skipped)

## Existing project docs (`docs/*.md` — not duplicated here, linked)
- [[ARCHITECTURE]] — the original architecture doc
- [[PROJECT_STATUS]] — the other standing status doc
- [[LICENSING_CHECKLIST]] — pre-commercial-release dataset/asset licensing checklist
- [[AVATAR_AUTHORING_HANDOFF]] — read before touching `web/src/avatar/` (currently paused)
- [[VIDEO_RETARGET_HANDOFF]] — avatar retargeting research (currently paused)
- [[AVATAR_ANIMATION_METHODS_FEASIBILITY]] — survey of animation approaches considered
- [[REFERENCE_POSE_SPEC]] — reference-pose data format for the avatar pipeline
- [[BLENDER_WORKFLOW]] — how the user authors poses in Blender
- [[Avatar_engine_specification]] — full avatar engine spec (moved here from the repo root
  2026-07-03 so it's actually visible in this vault — it lived outside `docs/` before, invisible
  to any Obsidian vault rooted here)

## Tooling installed in this repo
- **`impeccable`** (`.claude/skills/impeccable/`) — AI-agent design-anti-pattern scanner. Run
  `npx impeccable detect <path-or-url>` any time; its PostToolUse hook also auto-scans UI edits
  (hook registered per-machine in the gitignored `.claude/settings.local.json` — re-run
  `npx impeccable skills install` on another machine to get it there too).
- **`seekstone`** (`.mcp.json`) — Obsidian MCP server, filesystem-direct, pointed at this `docs/`
  folder. Gives Claude `search`/`read_note`/`list_notes`/etc. tools directly over this vault.
  **Needs a Claude Code restart to load** — MCP servers initialize at startup.
