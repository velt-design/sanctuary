# Target Architecture

Status: Target contract.

Purpose: describe the architecture this repo is actively converging toward. Current-state docs still describe what exists today; this doc names the north star so agents can tell whether a change moves the repo closer to or farther from the intended structure.

## Read First

- Use `## Target Areas` to pick the owner lane before broad or ambiguous work.
- Use `docs/change-routing.md` after choosing a lane to find owner docs and doc update triggers.
- Use current-state feature docs for exact implementation behavior; this doc names direction and boundaries.

## North Star

This repo should be a clean two-app product workspace where apps orchestrate workflows, packages own reusable domain truth, and persistence, auth, and side-effect boundaries are explicit and increasingly enforced by tests and tooling.

Agents should not need archaeology to make the right architectural move. A new behavior should have an obvious owner, an obvious data path, and an obvious verification path.

Geometry has one physical truth. Object-first design intent resolves into a single solved geometry spine owned by `packages/geometry`; plan, 3D, sheet, section, detail, snap, dimension, and interaction surfaces are views or adapters of that solved geometry. UI code may render, annotate, filter, select, or commit edits against that spine, but it must not invent a separate per-view geometry that can drift from the solved model.

In the portal workbench, that runtime boundary is the `WorkbenchSolvedGeometryArtifact`: one named bundle for the solved assembly, viewer scene, top projection, plan, section, validation, and trust/status metadata. Legacy calculator plan/section models and loose view fields are compatibility or fallback aliases around that artifact, not another geometry owner.

Interactive behavior should converge on one runtime owner too. Every movable or selectable workbench object should participate through a shared interaction layer keyed by stable object IDs and solved-geometry references. That layer owns pointer-session lifecycle, hover/selection/drag vocabulary, preview and blocked-state evaluation, object-to-object snap/relationship resolution, and the commit boundary back into object-first patches. Object-family adapters own the rules that differ per family: affordances, valid hosts, clearance/collision policy, movement constraints, and patch generation. Viewports may host and present this layer, but they must not fork object-to-object interaction policy inline.

Workbench and costing integration should converge on three explicit truths:

- Portal/workbench owns authored design intent and workflow state: house forms, pergolas, decks, openings, attachments, options, staff edits, persistence, and status.
- `packages/geometry` owns physical truth: solved assembly, derived views, validation, interaction geometry, and physical quantity/takeoff hooks.
- `packages/costing` owns commercial truth: pricing, BOM, labour/install, overheads, quote breakdowns, and commercial comparison rules.

The target data path is:

```text
object-first design intent
  -> @sp/geometry solved physical model
  -> geometry-derived quantity takeoff
  -> @sp/costing commercial input and pricing
  -> estimates / quotes / invoices / job packs
```

Long-running server work should converge on a second explicit path:

```text
server-owned workflow intent
  -> stable intent key plus frozen versioned payload
  -> atomic service-role enqueue RPC
  -> durable ledger plus private payload plus logged minimal PGMQ message
  -> worker claim with a random application lease token
  -> lease-fenced progress, effect checkpoints, retry, and finalisation RPCs
  -> owning workflow state and safe staff-visible status
```

The queue is a wake-up pointer, not the job record or payload store. `packages/jobs` owns shared kinds, worker-safe response contracts, and transition/retry policy; Supabase owns durable state, protected input, leases, append-only events, and effect checkpoints. `apps/worker` owns generic execution mechanics and is dark by default. It does not own copied quote/invoice/job-pack/email/automation rules, and its presence does not authorise a producer or rollout.

Workbench must not own pricing policy. Costing must not solve geometry. Portal may orchestrate, adapt, persist, and show status, but it must not duplicate package truth. `CommercialDesignInputV1` is allowed as the costing boundary and migration comparison contract, not as a parallel geometry model.

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
- commercial design input contracts, pricing adapters, and comparison helpers.

`packages/geometry` owns physical geometry truth:

- geometry solving, validation, normalization, one solved physical geometry spine, physical quantity/takeoff hooks, top projection, section/plan/viewer models derived from that spine, house/deck/opening/roof physical contracts, and generated profile assets.

`packages/jobs` owns durable background-job contract truth:

- versioned job kinds, safe queue and status contracts, retry/timeout/rollout policy, idempotency strategy, and allowed state/effect transitions.
- it does not own database persistence, business-workflow handlers, provider clients, or worker process lifecycle.

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

The first aggregate architecture handoff check is `npm run architecture:changed`. It runs worktree ownership, dead-code changed reporting, file decomposition, root compatibility, browser Supabase, and service-role Supabase reports together without making them part of lint.

Locally, changed-file checks read the dirty worktree against `HEAD`. In CI, `ARCHITECTURE_CHANGED_BASE` and `ARCHITECTURE_CHANGED_HEAD` make the same reports compare PR base to head, so a clean checkout still produces useful architecture handoff output.

The first selective strict aggregate is `npm run architecture:changed:strict`. It is for architecture/tooling PRs and CI-visible advisory reporting, and currently blocks undeclared dirty-tree lanes plus selected new risky growth rather than legacy debt. It includes `worktree:changed:strict` first and the new-unused-file dead-code strict gate. Portal Quality runs it as non-blocking PR advisory output until the strict signal has proved accurate enough to enforce.

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

Durable background-job callers go through server-owned enqueue helpers and service-role RPCs. Browser code never reads PGMQ, private payloads, or job tables directly. Until a later migration task explicitly moves a workflow, the current owning synchronous/legacy helper remains authoritative.

The first browser data-access visibility gate is `npm run browser:supabase`, with `npm run browser:supabase:changed` for handoffs that touch browser-facing Supabase access. This report is advisory; `npm run cache:forbid` remains the narrower hard guard for invalid portal UI table access.

## Auth And Security Target

Staff routes use staff auth helpers. Admin routes use admin auth helpers. Public quote and invoice routes are token-bound and hash-checked.

Service-role access is server-only and must stay allowlisted. Valid service-role uses are admin tooling, imports, automation, public-token verification, server-owned side effects, and explicit RLS bypasses documented by the owning feature.

Background-job access is a narrower service-role boundary: direct job-table, PGMQ, and private-schema access stays revoked from browser roles and `service_role`; workers use only the granted security-definer RPCs. Protected payload reads and worker-owned lifecycle/effect writes require both worker identity and the current random lease token; cancellation, manual retry, recovery, and repair use separate administrative RPCs.

Never expose raw tokens, token hashes, service-role keys, broad file access, or private artifacts to client components, browser bundles, generated documents, public payloads, or logs.

The first service-role visibility gate is `npm run service-role:report`, with `npm run service-role:changed` for handoffs that touch service-role Supabase access. This report is advisory and broader than the portal-only service-role allowlist test.

## Package Boundary Target

Apps should depend on packages through declared workspace dependencies and public package exports, not accidental TypeScript-only aliases.

When app code needs a domain behavior change:

- change the package that owns the behavior.
- update app adapters or call sites.
- add or update package tests first, then app-level tests when integration behavior changes.

Portal drawing code may adapt `@sp/geometry` for workbench state, persistence, and rendering, but geometry-ready plan, sheet, section, interaction, and 3D semantics must remain views of the same solved geometry. Calculator-era plan models, object overlays, and sheet renderers may be presentation, edit-support, or compatibility layers; they must not become competing geometry owners.

Costing must come from `@sp/costing`. Marketing must not create a pricing fork. Portal overrides may layer database-owned overrides on top of package base config through documented portal helpers.

Durable background-job kinds and transition policy must come from `@sp/jobs`. Apps and workers may supply handlers and workflow adapters, but they must not fork the kind registry, queue-message schema, status machine, effect-state machine, or rollout vocabulary.

## Target Areas

This map is the agent-facing routing layer between the broad north star above and the detailed current-state docs. Use it to pick an owner, data path, verification path, and next safe movement before expanding a domain.

How to use this map: pick the target area before editing, treat `Forbidden shortcuts` as the "do not improvise here" list, use `Primary gates` for verification, and update the canonical owner doc only when behavior, data flow, risks, or gates change. If a change spans areas, choose the lane that owns the source of truth or write path, then update secondary docs only when their behavior changes.

### Portal Quality Gates

- Lane label: `quality-gates`.
- North star: local and CI gates are truthful, repeatable, and explicit about external blockers.
- Source of truth: `docs/portal-production-readiness.md`, `docs/testing-and-qa.md`, and Portal Quality workflows.
- Allowed paths: update scripts, CI steps, readiness docs, and focused tests together when command behavior changes.
- Forbidden shortcuts: silent skips, false-green auth gates, hidden credential requirements, or broad warning suppression.
- Primary gates: `npm run portal:doctor`, `npm run portal:doctor:quick`, `npm run test:portal:log`, `npm run build:portal`, `npm run test:portal:browser`, authenticated smoke, and performance gates.
- Next direction: keep authenticated blockers explicit, preserve strict CI expectations, and separate blocking gates from advisory handoff reports.
- Canonical docs: `docs/portal-production-readiness.md`, `docs/testing-and-qa.md`, `docs/security-privacy-quality.md`.

### Auth, Staff/Admin Access, And Supabase Boundaries

- Lane label: `security-boundaries`.
- North star: every staff, admin, service-role, browser, and public-token access path has one documented boundary.
- Source of truth: staff/admin helpers, auth-bound server clients, service-role allowlisted helpers, and token-hash domain helpers.
- Allowed paths: staff/admin APIs use auth helpers and auth-bound clients; public quote/invoice routes stay token-bound; service-role stays server-only and allowlisted.
- Forbidden shortcuts: direct browser table writes, raw token exposure, client-visible service keys, unauthenticated staff bypasses, or implicit env-backed server clients where auth context is required.
- Primary gates: `npm run audit:security`, `npm run browser:supabase`, `npm run service-role:report`, `npm run root:compat`, and Supabase boundary tests.
- Next direction: keep moving route tests toward explicit staff/admin context injection and make new boundary growth visible in changed-file reports.
- Canonical docs: `docs/staff-api-auth-contracts.md`, `docs/environment-auth-supabase.md`, `docs/security-privacy-quality.md`, `docs/supabase-schema-map.md`.

### Contacts, Projects, Snapshots, And Staff Workflow Spine

- Lane label: `staff-workflow-spine`.
- North star: contacts, projects, snapshots, tasks, and pipeline state form the stable staff workflow spine for other portal surfaces.
- Source of truth: portal staff APIs, auth-bound Supabase helpers, project snapshot read models, and project/task domain helpers.
- Allowed paths: UI uses query/API/local-first layers; routes pass auth-bound clients into helpers; snapshots stay read models unless an owning mutation route changes state.
- Forbidden shortcuts: browser table mutation, service-role fallback for normal staff workflow, snapshot writes from view code, or hidden schema fallback behavior.
- Primary gates: `npm run test:portal:projects`, focused contact/project route tests, `npm run portal:doctor:quick`, and manual staff workflow QA.
- Next direction: keep project snapshot ownership explicit and preserve request diagnostics while tightening manual login/contact/project checks once valid staff data exists.
- Canonical docs: `docs/projects-contacts-estimates-calculator.md`, `docs/platform-workflow.md`, `docs/staff-api-auth-contracts.md`.

### Calculator, Estimates, And Costing

- Lane label: `calculator-estimates`.
- North star: calculator UI orchestrates estimates while live pricing remains explicit; future workbench pricing flows consume geometry-derived commercial input through `@sp/costing`.
- Source of truth: `packages/costing`, commercial input contracts, portal calculator helpers, estimate domain helpers, and staff estimate APIs.
- Allowed paths: extract pure calculator inputs, save-readiness, view models, commercial parity adapters, and orchestration helpers without changing mutation keys or live costing payloads.
- Forbidden shortcuts: copied costing rules in apps, hidden estimate persistence changes, direct browser Supabase writes, browser-selected pricing source, calculator-driven quote side effects outside owning routes, or making `CommercialDesignInputV1` a competing geometry model.
- Primary gates: `npx vitest run apps/portal/app/staff/calculator`, `npm run test:portal:projects`, `npm run typecheck`, and costing package tests when package behavior changes.
- Next direction: keep current live pricing stable while building parity between `calculator_compat` and `workbench_solved`, then switch saved estimates only through a server-owned rollout gate with explicit source metadata, audit events, failed-gate blocking, and rollback to `calculator_live`. Quote totals change only after saved estimate or quote-version pricing is explicitly rolled forward.
- Canonical docs: `docs/projects-contacts-estimates-calculator.md`, `docs/costing-and-geometry.md`, `docs/file-decomposition-and-ownership.md`.

### Local-First Sync

- Lane label: `local-first-sync`.
- North star: local-first gives staff visible pending, retry, alias, conflict, discard, and locked-state UX without becoming final server authority.
- Source of truth: local-first store, queue, portal mutation handlers, staff APIs, and server conflict/lock responses.
- Allowed paths: browser UI enqueues approved mutation keys and reconciles durable IDs, aliases, retries, and conflicts through the local-first layer.
- Forbidden shortcuts: putting server-authoritative side effects into local-first, silently retrying lock conflicts, bypassing staff APIs, hiding failed/pending state, or treating pricing-source selection as local browser authority.
- Primary gates: local-first store/queue tests, `LocalFirstPortalMutations` tests, focused estimate/quote tab tests, and manual pending/failed/conflict QA.
- Next direction: keep mutation keys stable and move workflow-specific conflict policy into named helpers before adding new mutation domains.
- Canonical docs: `docs/local-first-sync.md`, `docs/projects-contacts-estimates-calculator.md`.

### Quotes, Invoices, Public Tokens, PDFs, Emails, And Job Packs

- Lane label: `customer-side-effects`.
- North star: customer-facing side effects and money-state transitions are domain-owned, token-safe, and testable without real email or production data.
- Source of truth: quote, invoice, public-token, PDF, email, file-artifact, and job-pack domain helpers plus their API routes.
- Allowed paths: staff actions call owning server/domain helpers; public routes compare token hashes; generated artifacts and emails stay server-owned.
- Forbidden shortcuts: raw token leaks, client-side side-effect ownership, service-role sprawl, public artifact access without token scope, or real delivery in tests.
- Primary gates: `npm run portal:side-effects`, `npm run test:portal:quotes`, focused public-token route tests, `npm run build:portal`, and manual public-token QA.
- Next direction: keep side-effect boundary coverage current and add or keep public-token browser/manual smoke visible once safe seeded token data exists.
- Canonical docs: `docs/quotes-invoices-job-packs.md`, `docs/automation-email-audit.md`, `docs/security-privacy-quality.md`.

### Durable Background Jobs And Workers

- Lane label: `durable-jobs`.
- North star: long-running server work is crash-recoverable, idempotent, observable, privacy-safe, and rolled out without changing business ownership accidentally.
- Source of truth: `packages/jobs` for kinds and transition policy; the logged `portal_background_jobs` PGMQ queue, `background_jobs` ledger, private payload table, event/effect history, worker records, and service-role RPCs for durable persistence and lifecycle.
- Allowed paths: a server-owned workflow creates one stable intent and frozen input through an atomic enqueue RPC; workers claim a minimal queue message, read protected payload and perform worker-owned lifecycle/effect mutations only with the current lease token, checkpoint external effects before/following provider calls, and finalise the owning business workflow through its domain helper. Domain handler milestones stay separate from provider-effect checkpoints. Administrative cancellation, manual retry, recovery, and repair remain separate service-role RPCs.
- Forbidden shortcuts: sensitive or business payloads in PGMQ, browser or authenticated-role queue/table access, direct service-role table mutation, unfenced worker writes, queue deletion treated as business completion, duplicate effect dispatch without a checkpoint, or enabling a worker because foundation migrations merely exist.
- Primary gates: `npm run test:jobs`, `npm run test:worker`, `npm run typecheck:worker`, `npm run build:worker`, repo security/service-role tests, and the Docker-backed `npm run test:jobs:db` contract that executes the rollback-wrapped SQL on a disposable PGMQ-capable database before rollout.
- Next direction: JOB-01's five foundation migrations pass the isolated PostgreSQL 18/PGMQ 1.10.0 and Supabase PostgreSQL 17/PGMQ 1.5.1 matrix. JOB-02 adds the sixth runtime-projection migration and a dark-by-default, RPC-only worker with bounded concurrency, lease heartbeats, retry policy, shutdown/drain/reconcile modes, safe metrics, and an empty fail-closed handler registry. Local evidence passes `npm run test:jobs` at 5 files/86 tests and `npm run test:worker` at 9 files/76 tests; the six-migration matrix and non-root container still require dedicated CI evidence. After that gate, implement JOB-03's provider gateway and reconciliation boundary; JOB-04 through JOB-08 remain pending and no shared-environment rollout is implied.
- Canonical docs: `docs/supabase-schema-map.md`, `docs/environment-auth-supabase.md`, `docs/security-privacy-quality.md`, `docs/testing-and-qa.md`, and `docs/portal-production-readiness.md`.

### Schedule V2 And Site Visits

- Lane label: `schedule-v2`.
- North star: schedule reads, commands, Board, Gantt, Site Visits, readiness, and legacy fallback remain separated by workflow.
- Source of truth: Schedule V2 read models, staff schedule APIs, `schedule_v2_*` RPC commands, and schedule UI view models.
- Allowed paths: UI reads through schedule APIs/read models and writes through staff API command routes backed by RPCs.
- Forbidden shortcuts: ad hoc Supabase mutation from schedule UI, coupling legacy fallback into the normal client path, or weakening bundle/performance budgets.
- Primary gates: `npm run test:portal:schedule`, readiness route tests, `npm run schedule:bundle-budget`, authenticated performance, and manual Board/Gantt/Site Visit QA.
- Next direction: extract workflow-specific clients, query/view models, and command adapters before adding new schedule modes.
- Canonical docs: `docs/schedule.md`, `docs/supabase-schema-map.md`, `docs/parallel-work-guardrails.md`.

### Design Workbench, Drawing State, And Geometry

- Lane label: `workbench-geometry`.
- North star: object-first design intent resolves into one solved geometry spine; every drawing, sheet, 3D, top-projection, section, interaction surface, and physical takeoff is a view or adapter. Every authored object is also a first-class interactive object that moves and relates to other objects through one shared interaction layer rather than per-object viewport branches.
- Source of truth: `packages/geometry`, `WorkbenchSolvedGeometryArtifact`, `WorkbenchViewportGeometry`, `WorkbenchDrawingSurfaceGeometry`, drawing state helpers, and workbench persistence adapters.
- Allowed paths: route viewport and sheet data through named bundles; keep compatibility fallback boxed, visible, and tested; route direct-manipulation sessions through the shared interaction layer and family adapters; commit object-first edits through owning handlers; derive physical takeoff from solved geometry before passing commercial inputs to costing.
- Forbidden shortcuts: legacy visible geometry truth, loose per-view preview props, hidden fallback activation, calculator geometry forks, app-local physical takeoff policy, costing-driven geometry solves, or persistence changes from render helpers.
- Primary gates: `npm run test:portal:workbench`, `npm run test:portal:browser`, focused drawing state/view/interaction tests, and manual edit/save/reload QA.
- Next direction: finish routing geometry-ready views and takeoff consumers through `WorkbenchSolvedGeometryArtifact`; generalize the shared interaction layer so new object families join by adapter instead of new viewport-only drag logic; keep package-owned takeoff derived from the same solved `Assembly3D` as plan/section/top projection/viewer scene; and stabilize commercial parity reports before any live pricing switch.
- Canonical docs: `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`, `docs/parallel-work-guardrails.md`.

### Design List And Running Jobs

- Lane label: `design-list-running-jobs`.
- North star: spreadsheet-style operational surfaces share shell patterns, optimistic editing, and staff API write paths without inventing separate workflow rules.
- Source of truth: Design List and Running Jobs staff APIs, spreadsheet shell components, optimistic edit helpers, and project/task/job read models.
- Allowed paths: UI edits flow through staff APIs and shared spreadsheet patterns; cross-workflow effects stay in the owning domain route.
- Forbidden shortcuts: direct browser Supabase writes, duplicated spreadsheet shells, hidden task/project mutations, or bypassing optimistic edit diagnostics.
- Primary gates: focused Design List and Running Jobs tests, portal project tests where shared workflow state changes, and manual spreadsheet QA.
- Next direction: keep extracting shared spreadsheet shell behavior and named optimistic edit helpers before adding new operational spreadsheet surfaces.
- Canonical docs: `docs/design-list.md`, `docs/running-jobs.md`, `docs/platform-workflow.md`.

### Marketing, Public Routes, Analytics, And Consent

- Lane label: `marketing-public`.
- North star: marketing owns public customer experiences, consent-aware analytics, conversion routes, and token-bound public quote/invoice views.
- Source of truth: `apps/marketing`, public route helpers, consent/analytics helpers, and shared quote formatting.
- Allowed paths: public flows use token-scoped APIs and safe shared packages; analytics respects consent and privacy docs.
- Forbidden shortcuts: staff workflow state in marketing, portal secrets in public bundles, raw token logging, or duplicated pricing/costing behavior.
- Primary gates: `npm run test:marketing`, public-token route tests, security/privacy checks, and docs guard for public route changes.
- Next direction: keep public-token behavior hash-bound and consider a compact marketing owner doc only if public route rules outgrow existing references.
- Canonical docs: `docs/security-privacy-quality.md`, `docs/platform-workflow.md`, `docs/quotes-invoices-job-packs.md`.

### Packages And Source-Of-Truth Modules

- Lane label: `package-truth`.
- North star: packages own reusable domain truth; apps orchestrate and adapt that truth for workflows and UI.
- Source of truth: `packages/costing`, `packages/geometry`, `packages/jobs`, `packages/quote-format`, `packages/theme`, and package public exports.
- Allowed paths: behavior changes start in the owning package, then app adapters and integration tests are updated.
- Forbidden shortcuts: TypeScript-only package aliases without declared dependencies, app-local forks of package rules, or private package internals used as stable APIs.
- Primary gates: package tests, `npm run packages:guard`, app integration tests for changed adapters, and `npm run typecheck`.
- Next direction: tighten package manifests, exports, and source-of-truth tests as package boundaries stabilize.
- Canonical docs: `docs/architecture.md`, `docs/costing-and-geometry.md`, `docs/target-architecture.md`.

### File Decomposition And Code Retirement

- Lane label: `decomposition-retirement`.
- North star: large files, compatibility paths, stale exports, and old dependencies are reduced with proof, owner awareness, and focused tests.
- Source of truth: decomposition registry, dead-code registry, changed-file reports, owner docs, and focused test signals.
- Allowed paths: extract cohesive helpers/controllers/view models, document deferred splits, and delete only after reference search plus owner-doc review.
- Forbidden shortcuts: broad rewrites during unrelated fixes, deleting compatibility without proof, hiding bloat in registries, or expanding critical files without a next split note.
- Primary gates: `npm run files:report`, `npm run files:changed`, `npm run dead-code:report`, `npm run dead-code:changed`, and `npm run architecture:changed`.
- Next direction: work one owner surface at a time and keep strict enforcement advisory until reports are calibrated and false positives are understood.
- Canonical docs: `docs/file-decomposition-and-ownership.md`, `docs/code-retirement-and-bloat-control.md`, `docs/portal-production-readiness.md`.

## File Ownership Target

Files should have one clear responsibility and one obvious owner. A production-ready workspace should not keep adding inline UI, persistence, domain policy, browser event math, and tests to the same module just because that is where the previous behavior lived.

Use `docs/file-decomposition-and-ownership.md` before expanding large components, pages, route handlers, package files, domain modules, or tests. The target is not tiny files for their own sake; the target is cohesive modules that let agents make safe changes, run focused tests, and later separate the portal into a SaaS product without untangling hidden cross-app assumptions.

When a touched file is already large, prefer extracting a named helper, controller, adapter, child component, view model, or package/domain function if the extraction is cohesive and low risk. If extraction is too risky for the task, keep the change narrow and note the decomposition direction in the handoff or owning doc.

## Code Retirement Target

Stale code should not become permanent architecture. Use `docs/code-retirement-and-bloat-control.md` before deleting code, removing dependencies, or retiring compatibility paths.

The first dead-code visibility gate is `npm run dead-code:report`, with `npm run dead-code:changed` for handoffs that touch files Knip reports. These reports are advisory. `npm run dead-code:changed:strict` blocks only newly added unused files without valid registry coverage; existing debt, modified transitional files, exports/types, and dependencies stay advisory. Deletion still requires owner-doc review, reference search, and focused tests.

Registry-backed findings live in `scripts/dead-code-registry.json`. A registry entry is a retirement or proof note, not a place to hide bloat.

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
- PR-aware architecture changed reports.
- dead-code and dependency retirement reports.
- worktree ownership reports and strict local lane checks for parallel dirty-tree work.
- focused browser/performance gates for heavy portal surfaces.

The first package-boundary gate is `npm run packages:guard`, which checks app imports of local `@sp/*` packages against app manifests and Next transpilation config.

The first large-file visibility gate is `npm run files:report`, which is advisory and reports files that need owner-aware decomposition before major feature expansion.

Docs name the destination. Tests, lint, CI, and package boundaries should increasingly make the destination hard to miss.
