# Target Architecture

Status: Target contract.

Purpose: describe the architecture this repo is actively converging toward. Current-state docs still describe what exists today; this doc names the north star so agents can tell whether a change moves the repo closer to or farther from the intended structure.

## North Star

This repo should be a clean two-app product workspace where apps orchestrate workflows, packages own reusable domain truth, and persistence, auth, and side-effect boundaries are explicit and increasingly enforced by tests and tooling.

Agents should not need archaeology to make the right architectural move. A new behavior should have an obvious owner, an obvious data path, and an obvious verification path.

## Target Workspace Shape

`apps/marketing` owns public customer-facing experiences:

- marketing pages, SEO, media, consent, analytics, and conversion tracking.
- enquiry and lead capture.
- public quote and invoice viewing.
- public-token routes and downloads, with token-bound access only.

Marketing must not own staff workflow state or staff-only business process mutations.

`apps/portal` owns staff and admin workflow orchestration:

- staff/admin pages, route handlers, and workflow UI.
- contacts, projects, estimates, quotes, invoices, job packs, schedule, design list, running jobs, imports, pricebook, and design workbench integration.
- local-first UX, query hooks, optimistic state, conflicts, locks, retries, and staff-facing failure states.

Portal may adapt package output for UI and persistence. It must not fork package-owned costing, geometry, quote formatting, or shared theme truth.

`packages/costing` owns commercial truth:

- costing engine behavior, base config, material/BOM logic, install/labour logic, overheads, accessories, and pricing semantics.
- commercial design input contracts and comparison helpers.

`packages/geometry` owns physical geometry truth:

- geometry solving, validation, normalization, top projection, section/plan/viewer models, house/deck/opening/roof physical contracts, and generated profile assets.

`packages/quote-format` owns shared customer-facing quote wording and formatting.

`packages/theme` owns shared brand tokens used by both apps.

`supabase` owns ordered schema history and setup snapshots. Add forward migrations for schema changes; do not edit applied migrations unless explicitly directed.

`scripts` owns operational tooling. Scripts that touch Supabase or external services must make env requirements clear.

## Root-Level Compatibility

Root-level `lib`, `components`, `src`, `styles`, `data`, and similar paths are compatibility or shared legacy surfaces unless a current doc says otherwise.

Target rule:

- Do not grow root-level application behavior by default.
- Put new marketing behavior under `apps/marketing`.
- Put new staff/admin behavior under `apps/portal`.
- Put reusable domain behavior under `packages/*`.
- When touching root compatibility code, either keep the change minimal or move the behavior toward its target owner.

Do not delete compatibility paths blindly. First prove the path is unused, update references, and keep docs/tests aligned.

The first root-compatibility visibility gate is `npm run root:compat`, with `npm run root:compat:changed` for handoffs that touch root compatibility files. These reports are advisory and exist to make root growth visible before it becomes normal.

## Data Access Target

Staff workflow UI should not read or write Supabase tables directly.

The target path is:

```text
UI/component
  -> query hook, API client, or local-first adapter
  -> staff/admin API route
  -> auth-bound server client or allowlisted service-role domain helper
  -> Supabase table or RPC
```

Local-first layers own optimistic state, mutation queues, aliases, retries, conflicts, and locks. They do not own final server authority.

Schedule writes go through Schedule V2 staff API routes and `schedule_v2_*` RPC commands.

Design List and Running Jobs spreadsheet edits go through their staff APIs and shared spreadsheet shell patterns.

Quote, invoice, PDF, email, public-token, generated-artifact, and job-pack side effects go through their owning server/domain helpers.

The first browser data-access visibility gate is `npm run browser:supabase`, with `npm run browser:supabase:changed` for handoffs that touch browser-facing Supabase access. This report is advisory; `npm run cache:forbid` remains the narrower hard guard for invalid portal UI table access.

## Auth And Security Target

Staff routes use staff auth helpers. Admin routes use admin auth helpers. Public quote and invoice routes are token-bound and hash-checked.

Service-role access is server-only and must stay allowlisted. Valid service-role uses are admin tooling, imports, automation, public-token verification, server-owned side effects, and explicit RLS bypasses documented by the owning feature.

Never expose raw tokens, token hashes, service-role keys, broad file access, or private artifacts to client components, browser bundles, generated documents, public payloads, or logs.

The first service-role visibility gate is `npm run service-role:report`, with `npm run service-role:changed` for handoffs that touch service-role Supabase access. This report is advisory and broader than the portal-only service-role allowlist test.

## Package Boundary Target

Apps should depend on packages through declared workspace dependencies and public package exports, not accidental TypeScript-only aliases.

When app code needs a domain behavior change:

- change the package that owns the behavior.
- update app adapters or call sites.
- add or update package tests first, then app-level tests when integration behavior changes.

Portal drawing code may adapt `@sp/geometry` for workbench state, persistence, and rendering, but geometry-ready plan/3D semantics belong in the package or explicit drawing adapters.

Costing must come from `@sp/costing`. Marketing must not create a pricing fork. Portal overrides may layer database-owned overrides on top of package base config through documented portal helpers.

## File Ownership Target

Files should have one clear responsibility and one obvious owner. A production-ready workspace should not keep adding inline UI, persistence, domain policy, browser event math, and tests to the same module just because that is where the previous behavior lived.

Use `docs/file-decomposition-and-ownership.md` before expanding large components, pages, route handlers, package files, domain modules, or tests. The target is not tiny files for their own sake; the target is cohesive modules that let agents make safe changes, run focused tests, and later separate the portal into a SaaS product without untangling hidden cross-app assumptions.

When a touched file is already large, prefer extracting a named helper, controller, adapter, child component, view model, or package/domain function if the extraction is cohesive and low risk. If extraction is too risky for the task, keep the change narrow and note the decomposition direction in the handoff or owning doc.

## Migration Posture

The repo is mid-migration. Compatibility paths, legacy fallbacks, and large transitional modules still exist.

Agents should treat them as named debt, not as normal expansion points.

When changing a compatibility area:

- preserve behavior unless the user requested a behavior change.
- keep compatibility names explicit.
- avoid adding a second source of truth.
- prefer small moves toward the target owner over broad rewrites.
- update the relevant current-state doc when behavior, data flow, risk, or ownership changes.

## Good New-Feature Shape

A good new feature has:

- one owning app or package.
- one documented write path.
- no duplicated domain rules in components.
- tests at the owning layer first.
- docs updated when behavior, source-of-truth boundaries, side effects, or risks change.
- no expansion of root compatibility paths unless there is a documented reason.

If a change does not clearly fit this shape, pause and identify the owner before editing.

## Enforcement Direction

The target architecture should become more mechanical over time.

Prefer adding or tightening:

- package dependency declarations and public exports.
- restricted imports for legacy or wrong-layer paths.
- service-role allowlist tests.
- browser Supabase access guards.
- source-of-truth package tests.
- docs impact and stale-link checks.
- large-file decomposition reports and changed-file ownership checks.
- root compatibility growth reports.
- focused browser/performance gates for heavy portal surfaces.

The first package-boundary gate is `npm run packages:guard`, which checks app imports of local `@sp/*` packages against app manifests and Next transpilation config.

The first large-file visibility gate is `npm run files:report`, which is advisory and reports files that need owner-aware decomposition before major feature expansion.

Docs name the destination. Tests, lint, CI, and package boundaries should increasingly make the destination hard to miss.
