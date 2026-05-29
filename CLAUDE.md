# Claude Code: Repo Entrypoint

This file is Claude-specific. Claude Code auto-loads `CLAUDE.md`, while OpenAI Codex uses `AGENTS.md` as the repo instruction file.

The canonical coding-agent guidance for this repository lives in:

1. `AGENTS.md`
2. `docs/README.md`
3. The relevant owner doc under `docs/`

Before making any code change, read `AGENTS.md` and follow its First Moves checklist. Do not duplicate or edit canonical rules here unless the rule is specific to Claude Code behavior.

## Design Workbench Gate

For work touching design workbench, drawing, geometry, or costing-input paths, `AGENTS.md` Gate 0 applies. Read `docs/design-workbench-architecture.md` section "Product North Star (READ FIRST)" before writing code or proposing a next task.

For visual-only workbench changes, also read `docs/workbench-visual-snapshot-loop.md` and use the fixture snapshot loop instead of iterating from mockups alone.

## Why This File Exists

This file is a trampoline for Claude Code only. It keeps Claude aligned with the same canonical `AGENTS.md` and `docs/` guidance that Codex reads directly.
