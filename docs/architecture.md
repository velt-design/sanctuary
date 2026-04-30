# Architecture

This is a private npm workspace with two Next.js apps and shared packages. Treat app code as integration code and packages as reusable business/domain source of truth.

## Workspace Shape

- `apps/marketing`: public marketing site, enquiry form, public quote and invoice viewers, email templates, analytics runtime routes, consent handling, SEO.
- `apps/portal`: authenticated staff portal, admin surfaces, project workflow, estimates, quotes, invoices, schedule, design list, running jobs, job packs, imports, pricebook.
- `packages/costing`: canonical costing engine and base config, imported as `@sp/costing`.
- `packages/geometry`: canonical geometry solvers and viewer helpers, imported as `@sp/geometry`.
- `packages/quote-format`: quote formatting utilities shared by portal and marketing.
- `packages/theme`: shared theme exports.
- `supabase`: SQL snapshots plus ordered migrations.
- `scripts`: operational scripts for imports, invites, media optimization, audits, and generated geometry assets.
- `playwright`: portal browser test harness.
- `.github`: CI workflows for portal quality, Lighthouse, and governance.

Root-level directories outside `apps` and `packages` are still active unless proven otherwise:

- `lib`: shared/root legacy application helpers and tests that current suites still reference.
- `components`: shared/root UI and marketing/portal-era components.
- `data`, `public`, `src`, `styles`, `test`: shared content, assets, compatibility entrypoints, styling, and test support.
- Root config files define workspace behavior, package aliases, linting, test setup, and Playwright harnesses.

Inspect these root-level paths before creating new app or package logic. Do not duplicate behavior when an existing root helper is still wired into tests or runtime paths.

## App Boundaries

Marketing owns public lead capture and public document viewing. It may call Supabase through server-side service clients for lead persistence and public token flows, but it should not own staff workflow state.

Portal owns staff workflow state and staff APIs. Staff routes live under `apps/portal/app/staff`, admin routes under `apps/portal/app/admin`, and staff API routes under `apps/portal/app/api/staff/v1`.

Shared packages own business logic that must not be forked into apps. If app code needs a package behavior change, change the package and update call sites.

## Source Of Truth Rules

- Costing logic and config live in `packages/costing`.
- Geometry solving lives in `packages/geometry`; portal drawing code adapts it for UI and persistence.
- Pipeline stages and task definitions live in `apps/portal/lib/projects/pipelineDefinition.ts`.
- Staff portal roles are `admin` and `staff`, resolved from `portal_users`.
- Design List and Running Jobs read and write through staff APIs, not direct UI table writes.
- Schedule V2 write commands go through API/RPC command routes.

## Important Scripts

```bash
npm run dev:marketing
npm run dev:portal
npm run build:marketing
npm run build:portal
npm run test:marketing
npm run test:portal
npm run lint
```

Guard scripts:

```bash
npm run cache:forbid
npm run brand:forbid
npm run text:mojibake
npm run schedule:bundle-budget
```

Operational scripts:

```bash
npm run portal:invite
npm run running-jobs:legacy-import
npm run costing:rebaseline-overrides
npm run geometry:generate-profile-assets
npm run emails:preview
```

## CI

- `.github/workflows/portal-quality.yml`: portal Vitest, portal build, authenticated smoke, and performance report.
- `.github/workflows/lighthouse.yml`: scheduled and PR Lighthouse guardrails for marketing.
- `.github/workflows/governance-monthly.yml`: marketing tests, production dependency audit, Lighthouse mobile and desktop.

## Agent Notes

- Check `AGENTS.md` first when starting any task.
- For non-trivial portal work, scan `docs/decision-log.md` for related guardrails before editing.
- Prefer changing the smallest owning layer.
- Keep docs and implementation aligned when behavior changes.
- Do not edit old applied migrations unless the user explicitly asks for migration-history repair.
