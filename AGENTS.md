# Coding Agent Guide

This repo is optimized for coding agents. Read this file first, then follow links into `docs/README.md`. For non-trivial portal work, read `docs/agent-playbook.md` before editing.

## First Moves

1. Check `git status --short` before editing.
2. Read `docs/agent-playbook.md` for non-trivial portal work.
3. Read the smallest relevant current-state doc in `docs/`.
4. Prefer `rg` and `rg --files` for repo discovery.
5. Keep changes scoped to the requested surface.
6. Do not revert user changes or unrelated worktree changes.
7. If the task changes portal behavior, data flow, source-of-truth boundaries, test strategy, or known risks, update the relevant doc in the same pass.

## Repo Map

- `apps/marketing`: public site, enquiry flows, public quote and invoice routes, analytics and consent.
- `apps/portal`: staff portal, authenticated project workflow, estimates, quotes, invoices, schedule, running jobs, design list, job packs, admin.
- `packages/costing`: only source of truth for costing engine and base config.
- `packages/geometry`: only source of truth for geometry solving and 3D/profile assets.
- `packages/quote-format`: shared quote display/formatting.
- `packages/theme`: shared theme exports.
- `supabase`: ordered migrations and legacy baseline SQL snapshots.
- `scripts`: operational scripts. Check env requirements before running scripts that touch Supabase or external services.

## Commands

Use the app-specific scripts:

```bash
npm run dev:marketing
npm run dev:portal
npm run test:marketing
npm run test:portal
npm run build:marketing
npm run build:portal
npm run lint
```

Useful focused checks:

```bash
npm run text:mojibake
npm run cache:forbid
npm run brand:forbid
npm run schedule:bundle-budget
npm run test:portal:smoke
npm run test:portal:performance
```

## Source Of Truth Boundaries

- Costing imports must come from `@sp/costing`; do not copy engine/config logic into apps.
- Geometry imports should use `@sp/geometry` or portal drawing adapters; keep compatibility paths explicit.
- Portal staff/admin APIs should use auth-bound server clients and `requireStaffSession` or `requireAdminSession`.
- Service-role Supabase access is reserved for server-owned flows, admin tooling, imports, public token flows, and automation.
- Browser UI should use API/query/local-first layers rather than direct Supabase table reads.
- Schedule V2 writes go through staff API/RPC command routes; do not bypass with ad hoc table mutation.
- Design List and Running Jobs share the spreadsheet shell and optimistic editing patterns.

## Risky Areas

- `apps/portal/app/staff/schedule`: large interactive surface with Board, Gantt, Site Visits, legacy fallback, drag/drop, and performance budgets.
- `apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.tsx` and `QuotesTab.tsx`: local-first flows, locks, quote state, PDF/email side effects.
- `apps/portal/lib/drawings` and `apps/portal/components/drawings`: object-first workbench, geometry compatibility, drawing persistence. Read `docs/design-workbench-parallel-migration-rules.md` before migration work here.
- `supabase/migrations`: ordered production schema history. Add forward migrations; do not edit old applied migrations without explicit direction.
- Public marketing analytics and conversion routes: consent, privacy, and tracking docs must stay aligned.

## Documentation Stewardship

- Treat docs as part of the implementation surface.
- If a canonical doc is stale after your change, update it unless the user explicitly scoped docs out.
- Prefer small current-state doc updates over new long planning docs.
- If a bug, regression, or correction teaches a reusable lesson, add a compact entry to `docs/decision-log.md`.
- Do not delete active guardrail docs just because they are not pure current-state references.

## Canonical Docs

- `docs/agent-playbook.md`: active protocol for non-trivial portal work.
- `docs/architecture.md`: repo structure and boundaries.
- `docs/platform-workflow.md`: business workflow across marketing and portal.
- `docs/environment-auth-supabase.md`: env, auth, roles, schema readiness.
- `docs/testing-and-qa.md`: test commands, Playwright, manual QA.
- `docs/costing-and-geometry.md`: costing and geometry semantics.
- `docs/local-first-sync.md`: working copies, queue, aliases, conflict handling.
- `docs/design-workbench-architecture.md`: object-first design workbench.
- `docs/design-workbench-parallel-migration-rules.md`: active guardrails for parallel workbench migration work.
- `docs/decision-log.md`: compact lessons and guardrails from past mistakes.
- `docs/design-list.md`: Design List current behavior.
- `docs/running-jobs.md`: Running Jobs current behavior.
- `docs/schedule.md`: Schedule V2 current behavior and legacy fallback posture.
- `docs/security-privacy-quality.md`: tracking, consent, security, quality gates.
