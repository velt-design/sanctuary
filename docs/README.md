# Docs Index

These docs are current-state references for coding agents. They should describe what the repo does now, where source of truth lives, and how to verify changes. Do not add long implementation-history documents unless the history is needed to make a current decision.

## Read First

1. `../AGENTS.md`: root agent guide and repo boundaries.
2. `architecture.md`: workspace structure, app/package ownership, CI.
3. `platform-workflow.md`: business workflow from lead to install completion.
4. The feature doc for the area you are changing.

## Canonical Reference Docs

| Doc | Status | Use When |
| --- | --- | --- |
| `architecture.md` | Current | You need the repo map, app/package boundaries, or CI/script overview. |
| `platform-workflow.md` | Current | You need to understand lead, project, estimate, quote, invoice, design, schedule, or running-job flow. |
| `environment-auth-supabase.md` | Current | You need env vars, Supabase auth, role access, migrations, or schema readiness. |
| `testing-and-qa.md` | Current | You need test commands, Playwright auth, smoke checks, performance checks, or manual QA gates. |
| `costing-and-geometry.md` | Current | You are touching costing inputs/outputs, geometry semantics, or pricing/shape assumptions. |
| `local-first-sync.md` | Current | You are touching portal working copies, mutation queue, optimistic state, or conflict handling. |
| `design-workbench-architecture.md` | Current | You are touching drawing workbench, object-first model, geometry preview, or direct manipulation. |
| `design-list.md` | Current | You are touching `/staff/projects/design-packages` or design-package request APIs. |
| `running-jobs.md` | Current | You are touching `/staff/projects/running-jobs` or running-job spreadsheet APIs. |
| `schedule.md` | Current | You are touching `/staff/schedule`, Schedule V2 APIs, Gantt, Board, Site Visits, or legacy fallback. |
| `security-privacy-quality.md` | Current | You are touching tracking, consent, CSP, Lighthouse, audits, or quality gates. |

## Local READMEs

- `apps/portal/components/drawings/README.md`: drawing UI component boundaries.
- `apps/portal/lib/drawings/README.md`: drawing domain library boundaries.
- `apps/portal/vendor/pdf-lib-fontkit/README.md`: vendored dependency note. Leave vendor docs intact.

## Maintenance Rules

- Keep docs ASCII unless a file already intentionally uses another character set.
- Prefer current paths and commands over prose about old migrations or past plans.
- Link to repo-relative paths in plain backticks. Avoid local absolute links.
- Remove docs when they are absorbed into canonical references.
- If a doc lists commands, keep them runnable from the repo root unless it states otherwise.
