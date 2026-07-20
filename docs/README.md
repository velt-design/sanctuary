# Docs Index

These docs are current-state references and active guardrails for coding agents. They should describe what the repo does now, where source of truth lives, how to verify changes, and what recurring mistakes not to repeat.

## Read First

1. `../AGENTS.md`: root agent guide and repo boundaries.
2. `agent-playbook.md`: active protocol for non-trivial portal work.
3. `decision-log.md`: indexed lessons from past mistakes; scan relevant entries before risky work.
4. `change-routing.md`: path ownership, doc update triggers, and common task cards.
5. `maintainability-principles.md`: repo-specific maintainability rules and failure modes.
6. `portal-production-readiness.md`: active tracker for production-grade portal status, blockers, priorities, and parallel lanes.
7. `agent-centric-portal-plan.md`: active roadmap for making the portal easier for agents to inspect, reproduce, test, and improve.
8. `portal-ux-roadmap.md`: active roadmap for the highest-leverage staff usability work.
9. `architecture.md`: workspace structure and app/package ownership.
10. `target-architecture.md`: target workspace shape and migration direction.
11. `file-decomposition-and-ownership.md`: large-file ownership and early split guardrail.
12. `code-retirement-and-bloat-control.md`: dead-code and dependency cleanup guardrail.
13. `platform-workflow.md`: business workflow from lead to install completion.
14. The feature doc for the area you are changing.

## Canonical Reference Docs

| Doc | Status | Use When |
| --- | --- | --- |
| `agent-playbook.md` | Active protocol | You are doing non-trivial portal implementation, investigation, bugfix, or verification work. |
| `change-routing.md` | Active protocol | You need path ownership, doc update triggers, common task cards, or docs bloat control before editing. |
| `portal-production-readiness.md` | Active tracker | You need current portal production-readiness status, quality gates, blockers, priorities, or parallel work lanes. |
| `agent-centric-portal-plan.md` | Active roadmap | You are improving agent access, portal fixture coverage, debug exports, browser evidence, route smoke coverage, or quality ratchets. |
| `portal-ux-roadmap.md` | Active roadmap | You are planning or prioritising portal usability work, workflow polish, visual hierarchy, or staff UX improvements. |
| `repo-health-trends.md` | Advisory dashboard | You are choosing cleanup lanes, reviewing repo health pressure, or checking whether cleanup metrics are trending better or worse. |
| `architecture.md` | Current | You need the repo map, app/package boundaries, or CI/script overview. |
| `target-architecture.md` | Target contract | You need the north-star structure, target area map, target data path, or migration direction before expanding an area. |
| `maintainability-principles.md` | Active guardrail | You are fixing bugs, expanding large files, wiring interactions, or deciding whether to extract shared behavior. |
| `file-decomposition-and-ownership.md` | Active guardrail | You are expanding or refactoring a large component, route, domain module, package file, page, or test. |
| `code-retirement-and-bloat-control.md` | Active guardrail | You are deleting code, removing dependencies, retiring old compatibility paths, or triaging unused-code reports. |
| `platform-workflow.md` | Current | You need to understand lead, project, estimate, quote, invoice, design, schedule, or running-job flow. |
| `environment-auth-supabase.md` | Current | You need env vars, Supabase auth, role access, migrations, or schema readiness. |
| `supabase-schema-map.md` | Current | You are touching Supabase tables, RPCs, migrations, RLS/grants, route write paths, or schema ownership. |
| `staff-api-auth-contracts.md` | Current | You are touching staff/admin/public-token API routes, route auth helpers, Supabase client boundaries, diagnostics, or response conventions. |
| `automation-email-audit.md` | Current | You are touching automation events, project tasks, follow-ups, email outbox, email previews, audit events, or marketing enquiry email side effects. |
| `testing-and-qa.md` | Current | You need the canonical command catalog, Playwright auth, smoke checks, performance checks, or manual QA gates. |
| `portal-route-catalog.md` | Current | You need portal route metadata, required roles, data requirements, owner docs, or browser-smoke status. |
| `projects-contacts-estimates-calculator.md` | Current | You are touching contacts, projects, project snapshots/tasks, calculator estimates, estimate locks, or local-first estimate mutations. |
| `quotes-invoices-job-packs.md` | Current | You are touching quote, invoice, public-token, PDF/email, file-artifact, or job-pack side effects. |
| `parallel-work-guardrails.md` | Active guardrail | You are working in parallel across apps, packages, shared flows, docs, or design workbench migration lanes. |
| `costing-and-geometry.md` | Current | You are touching costing inputs/outputs, geometry semantics, or pricing/shape assumptions. |
| `local-first-sync.md` | Current | You are touching portal working copies, mutation queue, optimistic state, or conflict handling. |
| `design-workbench-architecture.md` | Current | You are touching drawing workbench, object-first model, geometry preview, or direct manipulation. |
| `design-workbench-multi-object-goal.md` | Active goal | You are moving the workbench toward robust multiple-house or multiple-pergola editing. |
| `workbench-captured-repro-workflow.md` | Active protocol | You are turning a live workbench solver/render bug into a captured fixture before changing geometry or render behavior. |
| `decision-log.md` | Active guardrail log | You need lessons from past mistakes, durable decisions, or reusable safety rules before risky work. |
| `design-list.md` | Current | You are touching `/staff/projects/design-packages` or design-package request APIs. |
| `running-jobs.md` | Current | You are touching `/staff/projects/running-jobs` or running-job spreadsheet APIs. |
| `schedule.md` | Current | You are touching `/staff/schedule`, Schedule V2 APIs, Gantt, Board, Site Visits, or legacy fallback. |
| `security-privacy-quality.md` | Current | You are touching tracking, consent, CSP, Lighthouse, audits, or quality gates. |

## Superseded Redirects

- `design-workbench-parallel-migration-rules.md`: historical discovery path only. The active workbench migration rules live in `parallel-work-guardrails.md`.

## Local READMEs

- `apps/worker/README.md`: worker modes, environment, health, deployment shape, and operational commands.
- `apps/portal/components/drawings/README.md`: drawing UI component boundaries.
- `apps/portal/lib/drawings/README.md`: drawing domain library boundaries.
- `apps/portal/vendor/pdf-lib-fontkit/README.md`: vendored dependency note. Leave vendor docs intact.

## Maintenance Rules

- Treat docs as part of the implementation surface, not as optional commentary.
- Treat maintainability as part of feature and bugfix work when touching known hotspots; use `maintainability-principles.md` and `file-decomposition-and-ownership.md` before adding inline behavior to warning or critical files.
- When changing portal behavior, data flow, source-of-truth boundaries, test strategy, or known risks, update the relevant canonical doc in the same task unless docs are explicitly out of scope.
- Prefer small current-state doc updates over new long planning docs.
- Scan `decision-log.md` for relevant areas before non-trivial or risky portal work.
- Use `change-routing.md` to decide which owner docs need updates instead of guessing from file names alone.
- Add reusable lessons to `decision-log.md` when a bug, regression, or correction reveals a guardrail future agents should know.
- Do not delete active guardrail docs just because they are not pure current-state references.
- Active guardrail docs may be broadened or superseded only when an equivalent active rule remains discoverable from the old path or the docs index.
- Keep docs ASCII unless a file already intentionally uses another character set.
- Prefer current paths and commands over prose about old migrations or past plans.
- Link to repo-relative paths in plain backticks. Avoid local absolute links.
- Remove docs when they are absorbed into canonical references.
- If a doc lists commands, keep them runnable from the repo root unless it states otherwise.
- Keep one canonical owner doc for each behavior; link to it instead of repeating the full rule set across many docs.
- Dense docs should include a routing, index, or read-first section. Do not split a doc only because it is long if one canonical owner doc is still clearer.
