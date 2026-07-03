# Decisions log — 2026-07-03 growth roadmap session

Judgment calls made without stopping to ask (user was asleep, explicitly asked not to be
interrupted) — recorded here so they're reviewable, not silently baked in.

1. **New scenario theme = Classroom/School.** User's explicit choice via AskUserQuestion before
   the "going to sleep" message.
2. **Mobile scope = responsive/perf only, no PWA.** User's explicit choice, same question round.
3. **Alphabet batch shrunk from 5 letters to 2** (W, I — not H, N, U). See
   [[Workstream-F-Alphabet]] for the full reasoning — reusing `core/handshape.py`'s `h`/`n`/`u`
   patterns for *static* letters would make them mutually ambiguous with each other and with the
   already-shipped `LETTER_V`.
4. **Classroom's `BOOK` sign swapped for `WRITE`.** The original plan's own `BOOK` design
   contradicted its own stated constraint (excluding diverge-needing motions). Caught during
   implementation, not before — see [[Workstream-A-Classroom]].
5. **ASL Citizen skipped for classroom signs' training data**, WLASL-only. The raw ASL Citizen
   gloss list isn't available locally this session (only the post-extraction subset persists) —
   see [[ML-Pipeline]]. Not a judgment call so much as a hard constraint, documented so a future
   session doesn't assume ASL Citizen was checked and came back empty.
6. **"Obsidian" and "impeccable"** (from the user's own message): initially misread as generic
   concepts rather than named tools — corrected once the user clarified. **`impeccable`** is a
   real npm package (`impeccable.style`, Apache-2.0) — an AI-agent design-anti-pattern skill pack.
   Installed via `npx impeccable skills install -y --providers=claude --scope=project` into
   `.claude/skills/impeccable/`; its PostToolUse hook (auto-registered in
   `.claude/settings.local.json`, which is gitignored/per-machine — the teammate needs to run the
   install themselves to get the hook) now scans every Edit/Write on UI files. A live scan
   (`npx impeccable detect http://localhost:4173`) found one **genuine** WCAG contrast failure
   (`PracticeTab.tsx`'s "Coffee Shop Story" card — white text directly on a `#14B8A6` gradient,
   ~2.3:1 where 4.5:1 is required) — fixed with a `bg-black/30` scrim behind the text rather than
   changing the brand gradient. The other 3 findings (purple/cyan gradients flagged as "AI
   tells") were **not** acted on — they're the app's own established "Zippy" brand palette
   (`z-purple`/`z-teal` in `index.css`), and unilaterally rebranding the app is a much bigger,
   more disruptive call than "polish" — left for the user to decide.
   **`obsidian`** on npm is only Obsidian.md's own plugin-API type definitions (not an agent
   skill) — but a real, actively-maintained MCP server for it does exist (`seekstone`,
   filesystem-direct, no Obsidian app/plugin needed, ~575× smaller payloads than the REST-plugin
   alternative). Installed via `.mcp.json` (project-scoped), pointed at `docs/` (validated:
   `npx seekstone init --vault "E:\ASL_Game\docs" --client code` found 18 notes). Created a
   minimal `docs/.obsidian/app.json` so the folder validates as a real vault — the same thing
   opening it in the actual Obsidian app once would do automatically. **Requires a session/harness
   restart to take effect** — MCP servers load at Claude Code startup, not mid-session, so this
   session couldn't use the new `search`/`read_note`/`list_notes`/etc. tools itself.
7. **`badgeUnlock` sound defined but not wired.** No existing notification surface to trigger it
   from meaningfully — see [[Workstream-D-E-Polish]].
8. **Standing reminder still owed to the user:** run
   `python -m tools.demo_verify --sign MORE` and report the observed calibration numbers so
   `signs/more.py`'s inherited PAIN/WANT-precedent thresholds can be replaced with personally
   calibrated ones. Not done this session — requires the user's own camera.
