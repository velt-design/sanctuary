# Claude Code: First Moves

This file is auto-loaded into Claude's context at session start. It exists to ensure Claude reads the repo's existing agent guide before making changes. The canonical guidance lives in `AGENTS.md` and `docs/`; this file deliberately does **not** duplicate it.

## Every session, before any code change

1. Read **[AGENTS.md](AGENTS.md)** and apply its First Moves checklist (git status, `docs/agent-playbook.md`, `docs/decision-log.md`, `docs/change-routing.md`). Do not start coding before working through the items relevant to the task.

2. Read **[docs/maintainability-principles.md](docs/maintainability-principles.md)** -- this is the highest non-functional priority for this codebase. Every change should be checked against it. Repeat violations cause shipped bugs; the doc captures the patterns we have already paid for in production.

3. For portal UI / component / route / domain work, read **[docs/file-decomposition-and-ownership.md](docs/file-decomposition-and-ownership.md)** before adding code to an existing file. Honour the advisory size bands:

   | Category | Warning | Critical |
   | --- | ---: | ---: |
   | Component or page | 800 lines | 1200 lines |
   | Route, domain, package, or script | 700 lines | 1200 lines |
   | Test | 1200 lines | 2500 lines |

   The doc's caveat is load-bearing: **split when the extracted piece has a name, owner, and test surface — not to satisfy a line count.** A single tightly-coupled consumer of <50 lines stays inline.

4. Before handoff on non-trivial work, run `npm run architecture:changed`. Add `npm run files:changed` when the task touched a warning/critical file (it shows current vs. HEAD line counts and prints the handoff cue). Add `npm run dead-code:changed` for cleanup or deletion work.

## Operating defaults

- Keep changes scoped to the requested surface. Don't refactor adjacent code unless the task asks for it.
- Don't revert user changes or unrelated worktree changes; assume a dirty tree may belong to in-flight work.
- Update the relevant `docs/*.md` in the same pass when behaviour, data flow, source-of-truth ownership, or known risks shift. Use `docs/change-routing.md` to identify the owner doc.
- Match the conventions already present in the file you're editing — don't introduce a new style mid-file.

## Why this file exists

`AGENTS.md` and `docs/*.md` are not auto-loaded into agent context — agents must choose to read them, and frequently don't. CLAUDE.md is auto-loaded. This file is the trampoline that ensures the existing system actually gets used at the start of every session.
