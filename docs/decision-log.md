# Decision Log

Compact lessons and guardrails for future agents. Add an entry when a bug, regression, correction, or user intervention reveals a reusable rule that should affect future work.

## Entry Template

```text
Date: YYYY-MM-DD
Area: short area name
Decision or mistake: what happened or what was decided
Why it mattered: the risk or outcome
Current guardrail: what future agents must do
Related docs/tests: paths or commands
```

## Entries

### 2026-05-01 - Docs - Agent Playbook

Decision or mistake: recurring portal work needs a procedural playbook, not only an index of current-state references.

Why it mattered: future agents need a repeatable work loop for discovery, source-of-truth checks, risk routing, verification, docs maintenance, and learning from past corrections without requiring the user to intervene each time.

Current guardrail: agents should read `docs/agent-playbook.md` for non-trivial portal work. New lessons go to `docs/decision-log.md` first; only durable, repeatable behaviors should be promoted into the playbook.

Related docs/tests: `docs/agent-playbook.md`, `AGENTS.md`, `docs/README.md`, `docs/decision-log.md`.

### 2026-05-01 - Docs - Active Guardrail Docs

Decision or mistake: `docs/design-workbench-parallel-migration-rules.md` was deleted during a docs cleanup even though it was still an active workbench migration authority.

Why it mattered: the cleanup treated all long historical-looking docs as stale, but this file carried live rules for parallel workbench migration safety.

Current guardrail: before deleting any doc, check whether it is a current reference, active guardrail, operational runbook, or historical artifact. Active guardrail docs must be restored or explicitly superseded by an equivalent canonical doc.

Related docs/tests: `docs/design-workbench-parallel-migration-rules.md`, `docs/README.md`, `AGENTS.md`.

### 2026-05-01 - Docs - Current References And Operating Rules

Decision or mistake: the agent docs originally optimized for current-state references but did not clearly preserve active operating rules that guide ongoing migration work.

Why it mattered: future agents need both current architecture facts and procedural guardrails from past mistakes to work safely without repeated user intervention.

Current guardrail: docs may be either `Current` references or `Active guardrail` operating rules. `docs/README.md` must label them clearly, and agents should update relevant docs whenever implementation work changes behavior, boundaries, tests, or known risks.

Related docs/tests: `docs/README.md`, `AGENTS.md`, `docs/decision-log.md`.
