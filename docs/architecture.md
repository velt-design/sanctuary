# Architecture

This is a private npm workspace with two Next.js apps, one long-running Node worker app, and shared packages. Treat app code as integration code and packages as reusable business/domain source of truth.

For the north-star structure this repo is converging toward, read `docs/target-architecture.md`. This doc describes the current workspace shape and active ownership boundaries.

## Workspace Shape

- `apps/marketing`: public marketing site, enquiry form, public quote and invoice viewers, email templates, analytics runtime routes, consent handling, SEO.
- `apps/portal`: authenticated staff portal, admin surfaces, project workflow, estimates, quotes, invoices, schedule, design list, running jobs, job packs, imports, pricebook.
- `apps/worker`: Node 22 durable-job runtime, safe RPC adapter, lease/heartbeat/retry orchestration, bounded concurrency, health server, and CLI modes. It imports no Next.js app and defaults to dark mode.
- `packages/costing`: canonical costing engine and base config, imported as `@sp/costing`.
- `packages/geometry`: canonical geometry solvers and viewer helpers, imported as `@sp/geometry`.
- `packages/jobs`: shared durable background-job kinds, safe contracts, retry/rollout policy, and state/effect transition rules, imported as `@sp/jobs`.
- `packages/quote-format`: quote formatting utilities shared by portal and marketing.
- `packages/theme`: shared theme exports.
- `supabase`: SQL snapshots plus ordered migrations.
- `scripts`: operational scripts for imports, invites, media optimization, audits, and generated geometry assets.
- `playwright`: portal browser test harness.
- `.github`: CI workflows for portal quality, Background Jobs contracts, docs health, Lighthouse, and governance.

Root-level directories outside `apps` and `packages` are still active unless proven otherwise:

- `lib`: shared/root legacy application helpers and tests that current suites still reference.
- `components`: shared/root UI and marketing/portal-era components.
- `data`, `public`, `src`, `styles`, `test`: shared content, assets, compatibility entrypoints, styling, and test support.
- Root config files define workspace behavior, package aliases, linting, test setup, and Playwright harnesses.

Inspect these root-level paths before creating new app or package logic. Do not duplicate behavior when an existing root helper is still wired into tests or runtime paths.

## App Boundaries

Marketing owns public lead capture and public document viewing. It may call Supabase through server-side service clients for lead persistence and public token flows, but it should not own staff workflow state.

Portal owns staff workflow state and staff APIs. Staff routes live under `apps/portal/app/staff`, admin routes under `apps/portal/app/admin`, and staff API routes under `apps/portal/app/api/staff/v1`.

Worker owns generic durable execution mechanics only. It reaches Supabase through its private service-role RPC adapter, validates every response against `@sp/jobs`, and never imports portal or marketing modules. Domain handlers may join later only through shared owners; JOB-02 itself enables no producer or commercial side effect.

Shared packages own business logic that must not be forked into apps. If app code needs a package behavior change, change the package and update call sites.

## Source Of Truth Rules

- Costing logic and config live in `packages/costing`.
- Geometry solving lives in `packages/geometry`; portal drawing code adapts it for UI and persistence.
- Durable background-job kinds, worker response contracts, retry policy, and transition policy live in `packages/jobs`; the Supabase ledger, private payload store, logged PGMQ queue, and lease-fenced RPCs own persistence. `apps/worker` owns execution mechanics, while later workflow checkpoints must own their domain preparation/finalisation and command-boundary enqueue decisions.
- Pipeline stages and task definitions live in `apps/portal/lib/projects/pipelineDefinition.ts`.
- Staff portal roles are `admin` and `staff`, resolved from `portal_users`.
- Design List and Running Jobs read and write through staff APIs, not direct UI table writes.
- Schedule V2 write commands go through API/RPC command routes.

## Important Scripts

`docs/testing-and-qa.md` is the canonical command source for common scripts, guard scripts, browser tests, docs-only checks, and operational commands. Update that doc when broad command guidance changes.

## CI

- `.github/workflows/portal-quality.yml`: repository typecheck, portal Vitest, portal build, authenticated smoke, and performance report.
- `.github/workflows/background-jobs.yml`: `@sp/jobs` and worker typecheck/tests/build, built-CLI and container smoke, service-role boundary verification, plus isolated logged-PGMQ contracts against upstream PostgreSQL 18 and the supported Supabase PostgreSQL 17 image.
- `.github/workflows/docs-health.yml`: scheduled and manual docs guard, mojibake, docs impact advisory, and readiness aging report.
- `.github/workflows/lighthouse.yml`: scheduled and PR Lighthouse guardrails for marketing.
- `.github/workflows/governance-monthly.yml`: marketing tests, production dependency audit, Lighthouse mobile and desktop.

## Agent Notes

- Check `AGENTS.md` first when starting any task.
- For non-trivial portal work, scan `docs/decision-log.md` for related guardrails before editing.
- Prefer changing the smallest owning layer.
- Keep docs and implementation aligned when behavior changes.
- Do not edit old applied migrations unless the user explicitly asks for migration-history repair.
