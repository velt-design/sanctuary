# Docs Index

These docs are current-state references and active guardrails for coding agents. They should describe what the repo does now, where source of truth lives, how to verify changes, and what recurring mistakes not to repeat.

## Read First

1. `../AGENTS.md`: root agent guide and repo boundaries.
2. `agent-playbook.md`: active protocol for non-trivial portal work.
3. `decision-log.md`: indexed lessons from past mistakes; scan relevant entries before risky work.
4. `architecture.md`: workspace structure, app/package ownership, CI.
5. `platform-workflow.md`: business workflow from lead to install completion.
6. The feature doc for the area you are changing.

## Canonical Reference Docs

| Doc | Status | Use When |
| --- | --- | --- |
| `agent-playbook.md` | Active protocol | You are doing non-trivial portal implementation, investigation, bugfix, or verification work. |
| `architecture.md` | Current | You need the repo map, app/package boundaries, or CI/script overview. |
| `platform-workflow.md` | Current | You need to understand lead, project, estimate, quote, invoice, design, schedule, or running-job flow. |
| `environment-auth-supabase.md` | Current | You need env vars, Supabase auth, role access, migrations, or schema readiness. |
| `testing-and-qa.md` | Current | You need the canonical command catalog, Playwright auth, smoke checks, performance checks, or manual QA gates. |
| `quotes-invoices-job-packs.md` | Current | You are touching quote, invoice, public-token, PDF/email, file-artifact, or job-pack side effects. |
| `parallel-work-guardrails.md` | Active guardrail | You are working in parallel across apps, packages, shared flows, docs, or design workbench migration lanes. |
| `costing-and-geometry.md` | Current | You are touching costing inputs/outputs, geometry semantics, or pricing/shape assumptions. |
| `local-first-sync.md` | Current | You are touching portal working copies, mutation queue, optimistic state, or conflict handling. |
| `design-workbench-architecture.md` | Current | You are touching drawing workbench, object-first model, geometry preview, or direct manipulation. |
| `decision-log.md` | Active guardrail log | You need lessons from past mistakes, durable decisions, or reusable safety rules before risky work. |
| `design-list.md` | Current | You are touching `/staff/projects/design-packages` or design-package request APIs. |
| `running-jobs.md` | Current | You are touching `/staff/projects/running-jobs` or running-job spreadsheet APIs. |
| `schedule.md` | Current | You are touching `/staff/schedule`, Schedule V2 APIs, Gantt, Board, Site Visits, or legacy fallback. |
| `security-privacy-quality.md` | Current | You are touching tracking, consent, CSP, Lighthouse, audits, or quality gates. |

## Local READMEs

- `apps/portal/components/drawings/README.md`: drawing UI component boundaries.
- `apps/portal/lib/drawings/README.md`: drawing domain library boundaries.
- `apps/portal/vendor/pdf-lib-fontkit/README.md`: vendored dependency note. Leave vendor docs intact.

## Maintenance Rules

- Treat docs as part of the implementation surface, not as optional commentary.
- When changing portal behavior, data flow, source-of-truth boundaries, test strategy, or known risks, update the relevant canonical doc in the same task unless docs are explicitly out of scope.
- Prefer small current-state doc updates over new long planning docs.
- Scan `decision-log.md` for relevant areas before non-trivial or risky portal work.
- Add reusable lessons to `decision-log.md` when a bug, regression, or correction reveals a guardrail future agents should know.
- Do not delete active guardrail docs just because they are not pure current-state references.
- Keep docs ASCII unless a file already intentionally uses another character set.
- Prefer current paths and commands over prose about old migrations or past plans.
- Link to repo-relative paths in plain backticks. Avoid local absolute links.
- Remove docs when they are absorbed into canonical references.
- If a doc lists commands, keep them runnable from the repo root unless it states otherwise.
