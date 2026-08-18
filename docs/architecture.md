# Architecture

This is a private npm workspace with two Next.js apps, one long-running Node worker app, and shared packages. Treat app code as integration code and packages as reusable business/domain source of truth.

For the north-star structure this repo is converging toward, read `docs/target-architecture.md`. This doc describes the current workspace shape and active ownership boundaries.

## Workspace Shape

- `apps/marketing`: public marketing site, enquiry form, public quote and invoice viewers, email templates, analytics runtime routes, consent handling, SEO.
- `apps/portal`: authenticated staff portal, admin surfaces, project workflow, estimates, quotes, invoices, schedule, design list, running jobs, job packs, imports, and the Calculator Brain costing control centre.
- `apps/worker`: Node 22 durable-job runtime, safe RPC adapter, lease/heartbeat/retry orchestration, bounded concurrency, health server, and CLI modes. It imports no Next.js app and defaults to dark mode.
- `packages/configurator`: canonical versioned customer pergola intent contract, strict parser, normalization, deterministic serializer, migrations/future-version recovery, customer-safe defaults/summaries, and typed patch/seed contracts, imported through the lightweight `@sp/configurator/core` subpath.
- `packages/costing`: canonical costing engine, base config, typed admin-configuration contract, validation, diff, and impact preview, imported as `@sp/costing`.
- `packages/geometry`: canonical geometry solvers and viewer helpers, imported as `@sp/geometry`.
- `packages/email-provider`: Node-only direct-`fetch` email provider boundary for canonical Resend request bytes, stable provider identity, typed outcomes, timeouts/abort handling, and Svix-signed webhook-envelope verification, imported as `@sp/email-provider`.
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
- The root `package-lock.json` is the workspace lockfile. App-local npm lockfiles are retired; do not recreate them or treat them as separate dependency authorities.

Inspect these root-level paths before creating new app or package logic. Do not duplicate behavior when an existing root helper is still wired into tests or runtime paths.

## App Boundaries

Marketing owns public lead capture and public document viewing. It may call Supabase through server-side service clients for lead persistence and public token flows, but it should not own staff workflow state.

Portal owns staff workflow state and staff APIs. Staff routes live under `apps/portal/app/staff`, admin routes under `apps/portal/app/admin`, and staff API routes under `apps/portal/app/api/staff/v1`.

Marketing and Portal also own separate UI systems. Marketing UI primitives and editorial patterns live under `apps/marketing/components/marketing-foundation` and are documented in `docs/marketing-ui-foundation.md`. Portal shared UI primitives, tokens, operational patterns, and active specialist/compatibility boundaries live under `apps/portal` and are documented in `docs/ui-foundation.md`. There is no cross-app design-system migration target: current checked-in and rendered behavior is canonical for each app, and a broad restyle or token migration requires explicit user approval.

The authenticated `/staff/design-booklets` route is a narrow customer-document exception, documented in `docs/design-booklets.md`. It owns its editorial UI and hides normal portal chrome without importing the marketing component system. Generic roof-form and roofing-choice strings remain owned by the marketing product data and cross into Portal through a server-only read adapter. The first round has local preview/PDF behavior only and owns no workflow or persistence boundary.

Within Portal, `apps/portal/lib/commercial` owns cross-cutting quote/invoice command, durable email-intent, and audit adapters. Quote composition remains in `lib/quotes`, invoice artifacts remain in `lib/invoices`, and provider wire identity remains in `@sp/email-provider`; callers must not duplicate those responsibilities in routes or components.

The portal's Calculator Brain lives at `/admin/costing` and is exposed to admins beneath the Pricebook navigation item. Browser code uses admin APIs and never writes Supabase tables directly. Portal server modules own draft/version persistence and audit orchestration; `@sp/costing` owns which values are supported, validation, application to the engine, calculations, diffs, and preview calculations. Published configuration rows are immutable, and estimate snapshots retain the exact version/snapshot used.

Worker owns generic durable execution mechanics only. It reaches Supabase through its private service-role RPC adapter, validates every response against `@sp/jobs`, and never imports portal or marketing modules. JOB-03 adds a reusable durable email-effect coordinator, but no registered domain handler or producer; workflow handlers may join later only through their existing shared owners.

Shared packages own business logic that must not be forked into apps. If app code needs a package behavior change, change the package and update call sites.

## Source Of Truth Rules

- Costing formulas, supported configuration types, validation, application, diffing, preview calculation, and base config live in `packages/costing`. Supabase stores immutable published values and draft workflow state, not executable logic.
- Provider-neutral AI task, agent, capability, approval, provenance, artifact, usage, evaluation, and node contracts live in `packages/ai`. Provider adapters, database persistence, UI, secrets, raw private payloads, and business-domain execution stay outside the package.
- Customer-authored pergola intent, its controlled option catalogues, parser, canonical serialization, migration status and contextual patch/seed contracts live in `packages/configurator`. Core remains universal and does not own React, storage, geometry, pricing, Supabase, enquiry intake or portal continuation.
- Geometry solving lives in `packages/geometry`; portal drawing code adapts it for UI and persistence.
- Durable background-job kinds, worker response contracts, retry policy, and transition policy live in `packages/jobs`; the Supabase ledger, private payload store, logged PGMQ queue, and lease-fenced RPCs own persistence. `apps/worker` owns execution mechanics, while later workflow checkpoints must own their domain preparation/finalisation and command-boundary enqueue decisions.
- Email-provider request normalization, exact wire-body hashing, stable Resend idempotency identity, typed delivery outcomes, timeout/abort behavior, and raw-body webhook verification live in `packages/email-provider`. Apps may provide server-only compatibility adapters, but they must not fork provider rules or log raw provider/customer content.
- Quote/invoice business idempotency, commercial revisions, atomic acceptance/invoice creation, and frozen request checkpoints live behind Portal commercial helpers plus service-role-only RPCs. Provider acceptance is evidence for replay-safe finalisation, not proof that the business transition completed.
- Pipeline stages and task definitions live in `apps/portal/lib/projects/pipelineDefinition.ts`.
- Staff portal roles are `admin` and `staff`, resolved from `portal_users`.
- Design List and Running Jobs read and write through staff APIs, not direct UI table writes.
- Schedule V2 write commands go through API/RPC command routes.

## Important Scripts

`docs/testing-and-qa.md` is the canonical command source for common scripts, guard scripts, browser tests, docs-only checks, and operational commands. Update that doc when broad command guidance changes.

## CI

- `.github/workflows/portal-quality.yml`: repository typecheck, portal Vitest, portal build, authenticated smoke, and performance report.
- `.github/workflows/background-jobs.yml`: `@sp/jobs`, `@sp/email-provider`, and worker typecheck/tests/build, built-CLI and container smoke, service-role boundary verification, plus isolated seven-migration logged-PGMQ contracts against upstream PostgreSQL 18 and the supported Supabase PostgreSQL 17 image.
- `.github/workflows/docs-health.yml`: scheduled and manual docs guard, mojibake, docs impact advisory, and readiness aging report.
- `.github/workflows/lighthouse.yml`: scheduled and PR Lighthouse guardrails for marketing.
- `.github/workflows/governance-monthly.yml`: marketing tests, production dependency audit, Lighthouse mobile and desktop.

## Agent Notes

- Check `AGENTS.md` first when starting any task.
- For non-trivial portal work, scan `docs/decision-log.md` for related guardrails before editing.
- Prefer changing the smallest owning layer.
- Keep docs and implementation aligned when behavior changes.
- Do not edit old applied migrations unless the user explicitly asks for migration-history repair.
