# Parallel Work Guardrails

Status: Active guardrail.

This is the canonical active home for parallel-work and design workbench migration guardrails. It supersedes the historical `docs/design-workbench-parallel-migration-rules.md` path, which is kept only as a redirect for discovery.

Related docs:

- [`docs/agent-playbook.md`](./agent-playbook.md)
- [`docs/architecture.md`](./architecture.md)
- [`docs/platform-workflow.md`](./platform-workflow.md)
- [`docs/testing-and-qa.md`](./testing-and-qa.md)
- [`docs/security-privacy-quality.md`](./security-privacy-quality.md)
- [`docs/quotes-invoices-job-packs.md`](./quotes-invoices-job-packs.md)
- [`docs/design-workbench-architecture.md`](./design-workbench-architecture.md)
- [`docs/local-first-sync.md`](./local-first-sync.md)

## Read First

- Start with `## Purpose` to confirm this doc applies to parallel or cross-area work.
- Use `## Agent Quick Gate` before editing to declare lane, source of truth, bridges, and tests.
- Use `## Core Parallel Rules` for ownership, contract, bridge, and merge expectations.
- Use `## Design Workbench Overlay` for drawing/workbench migration lanes.
- Use `## Integration Rhythm` when coordinating handoffs or integration PRs.

## Purpose

Use this document when multiple agents, branches, or PRs are changing the repo at the same time.

The goal is not only to avoid merge conflicts. Parallel work must also prevent drift across shared customer flows, quote and invoice routes, analytics and privacy behavior, package contracts, portal workflow state, and design workbench migration boundaries.

Parallel work is allowed when lanes have clear ownership, shared contracts are explicit, temporary bridges are visible, and every lane names the tests and docs that prove it still fits the platform.

## Agent Quick Gate

Before changing code in parallel with other work, confirm these gates:

1. Lane declared: name the lane, owned files or modules, shared contracts touched, tests, docs, and integration dependencies.
2. Worktree checked: run `npm run worktree:status`; use `WORKTREE_OWNER_PATTERNS` to declare lane-owned paths when the tree is dirty or work is parallel.
3. One source of truth: do not copy or reimplement logic owned by another app or package.
4. Contract first: agree on API, type, schema, event, queue, token, or data-flow shape before broad behavior changes depend on it.
5. Bridges are visible: compatibility adapters, legacy fallbacks, feature flags, and temporary duplicate paths must be explicit in names, state, tests, and docs.
6. Small PRs, hard boundaries: avoid mixed-purpose PRs unless they are agreed integration PRs.
7. Tests are merge gates: each lane must run focused tests and name any broader cross-lane checks required before merge.
8. Docs move with behavior: update the canonical current-state doc or this guardrail when a change affects behavior, source-of-truth boundaries, tests, or known risks.

## Source Of Truth Rules

Each lane must identify the owner of the behavior before editing:

- Marketing owns public site pages, enquiry forms, public quote and invoice viewers, analytics runtime routes, consent behavior, SEO, and conversion copy.
- Portal owns staff and admin workflow state, authenticated staff APIs, local-first project workflows, estimates, quotes, invoices, schedule, design list, running jobs, job packs, and imports.
- `packages/costing` owns costing logic and base config.
- `packages/geometry` owns geometry solving and 3D/profile assets.
- `packages/quote-format` owns shared quote display and formatting.
- `packages/theme` owns shared theme exports.
- Supabase migrations own production schema history and must move forward only.
- Server-owned flows own service-role Supabase access; browser UI should use API, query, or local-first layers rather than direct table reads.

Parallel work must not create a second source of truth. If a lane needs data from another owner, add or use an explicit contract at the boundary instead of reaching around it.

## Core Parallel Rules

### 1. Declare The Lane

Every parallel PR or task should state:

- lane name and purpose
- files or modules owned
- contracts changed or consumed
- compatibility, fallback, or feature flags touched
- tests to run
- docs to update
- integration dependencies on other lanes

Use `WORKTREE_OWNER_PATTERNS` with comma-separated path globs when running `npm run worktree:status`, for example:

```powershell
$env:WORKTREE_OWNER_PATTERNS='apps/portal/app/staff/calculator/**,docs/**'; npm run worktree:status
```

Files reported as outside-lane are not cleanup opportunities. Leave them untouched and mention them only as unrelated worktree changes intentionally avoided.

Use `npm run architecture:changed` as the preferred handoff sweep for parallel lanes. It runs `worktree:changed` first, then the changed-file architecture reports.

Use `npm run worktree:changed:strict` for local dirty-tree strict verification after declaring `WORKTREE_OWNER_PATTERNS`. Strict mode fails when a lane is undeclared, when changed files sit outside the declared patterns, or when deleted/missing paths need explicit owner confirmation. `npm run architecture:changed:strict` also starts with this strict ownership check, so declare the lane before running it in a dirty worktree.

If two lanes need the same file, type, API route, schema, or shared package export, pause and split the contract from the implementation. Land the contract first or nominate one lane as the owner.

### 2. Keep Boundaries Hard

Parallel lanes should avoid editing across unrelated ownership boundaries:

- Marketing changes should not mutate portal staff workflow state directly.
- Portal UI changes should not bypass staff API, query, or local-first layers.
- Shared package changes should preserve app-facing contracts or land coordinated app updates in an integration PR.
- Public token flows should keep quote and invoice access token-bound.
- Analytics and marketing pixels must remain consent-gated and documented in the tracking register.
- Schedule V2 writes must stay behind staff API/RPC command routes.

Cross-boundary work is acceptable only when the PR makes the boundary clearer, updates the relevant docs, and includes the integration tests needed for both sides.

### 3. Make Bridges Visible

Temporary bridges are allowed during migration or parallel delivery, but they must be easy to find and remove.

Allowed:

- explicitly named compatibility adapters
- feature flags with owner, purpose, and removal condition
- public-token or server-owned bridge routes with tests
- legacy fallback status that is visible to users, QA, or logs where accuracy matters
- duplicated read paths only when a migration note explains which path is canonical

Not allowed:

- silent fallback behavior that looks canonical
- view-specific business, costing, geometry, or workflow rules
- hidden service-role access in browser or staff UI code
- package logic copied into apps
- analytics scripts that load before consent
- compatibility names that make legacy behavior look like the long-term source of truth

### 4. Contract First

Before a lane changes broad behavior, define or update the contract it depends on.

Contracts that need special care:

- public enquiry/contact payloads and conversion events
- public quote and invoice token routes
- quote, invoice, PDF, email, and job-pack side effects
- local-first working copies, locks, aliases, queues, and conflicts
- Schedule V2 command APIs and readiness checks
- costing, geometry, quote-format, and theme exports
- analytics consent categories and tracking register entries
- Supabase migrations and role boundaries
- design workbench solved model, geometry, plan, 3D, sheet, interaction, and trust contracts

If two lanes disagree, the canonical source-of-truth doc and owner package or route win.

### 5. Small PRs, Integration PRs

Prefer small lane PRs with one behavioral purpose. Use an explicit integration PR when a slice must coordinate marketing, portal, packages, migrations, and docs.

Integration PRs should name:

- lane PRs or branches being combined
- shared contracts that changed
- removed temporary adapters or duplicate paths
- cross-app or shared-package tests run
- remaining bridge dependencies

### 6. Tests Are Merge Gates

Choose tests proportional to the lane and blast radius.

Always consider:

- marketing tests and build for public pages, enquiry, public quote/invoice, consent, SEO, or analytics changes
- portal tests and build for staff workflow, auth, local-first, schedule, drawings, estimates, quotes, invoices, or job packs
- shared package tests or both app builds when package exports change
- docs-only checks for guardrail or current-state doc changes
- Playwright or manual QA when layout, routing, auth, persisted state, or user-visible interaction changes

If a required check cannot run, record the reason and the residual risk in the PR or final response.

## Cross-Lane Integration Checks

Use these checks when parallel work touches shared flows:

- Public enquiry/contact: verify marketing form behavior, server conversion reporting, portal contact/project intake expectations, consent, and privacy docs.
- Public quote/invoice: verify token-bound public routes, portal quote/invoice state, generated PDFs/emails, retries, and customer-facing formatting.
- Shared packages: verify package tests plus the app tests or builds for every consumer changed by the contract.
- Analytics and consent: verify optional integrations do not load before consent and the tracking register stays current.
- Portal workflow state: verify local-first queues, locks, aliases, schedule commands, and Supabase role boundaries.
- Migrations: add forward migrations only, preserve ordering, and verify readiness/failure states when applicable.
- Docs: update `docs/README.md`, `docs/agent-playbook.md`, area docs, and `docs/decision-log.md` when guardrails or known risks change.

## Design Workbench Overlay

Use this overlay for parallel work that touches `apps/portal/lib/drawings`, `apps/portal/components/drawings`, solved-model, compatibility, plan, 3D, sheet, geometry, or interaction boundaries.

### Workbench Standard

A view may format, filter, annotate, or interact with geometry, but it may not invent geometry.

Plan, 3D, section, sheet, detail, snap, dimension, and interaction surfaces must be different views of one solved physical geometry artifact. They may not each own a separate geometry model. If a surface still uses compatibility or legacy fallback during migration, that fallback must be explicit in state, naming, status, and tests.

The workbench migration goal remains:

```text
object-first draft
  -> one solved geometry artifact
  -> plan / 3D scene / section / sheet / details / snap frames / interactions / status
```

### Workbench Quick Gate

Before changing workbench migration code, confirm:

1. One solved truth: views may present geometry, but must not own independent geometry.
2. Object-first authored state: edits persist through the object-first draft envelope.
3. Compatibility quarantine: fallback or legacy paths stay in explicit compat adapters, bridge facades, or tests.
4. No silent fallbacks: status must expose `geometry_ready`, `legacy_fallback`, `legacy_unsupported_family`, `invalid_geometry`, `unresolved_host`, or `approximate`.
5. Tests are merge gates: every lane PR names the tests that prove dependency direction and fallback behavior.
6. No cosmetic migration credit: renames count only when a runtime consumer moves closer to object-first or solved geometry.

### Workbench Lanes

Parallel workbench lanes should stay narrow:

- Solved geometry spine: make plan, 3D, section, sheet, snap/detail views, interactions, and status consume one solved artifact.
- HouseAssembly to geometry: move geometry input away from compatibility `HouseModel` and toward object-first assembly data.
- Plan from geometry: make Model Space plan a top-down view of solved geometry, with object IDs matching solved geometry IDs.
- Object-first interaction layer: target object IDs and solved geometry, then commit object-first patches.
- Accuracy and trust gate: make untrusted fallback, invalid, approximate, and unresolved states visible and enforceable.

### Workbench Compatibility Quarantine

Compatibility code must stay behind explicit compatibility boundaries.

Allowed compatibility locations:

- `apps/portal/lib/drawings/state/compat/`
- `apps/portal/lib/drawings/geometry/compat/`
- explicitly named migration adapters
- tests that deliberately prove compatibility behavior

Public object-workbench files should not import compatibility models directly unless the file itself is a boundary facade.

Names that must remain suspect:

- `HouseModel`
- `houseFirst`
- `sharedHouse`
- `compatibilityProjectModel`
- `objectWorkbenchCompatibilityHouse`
- `buildHouseFirst...`

These can exist only when the file is clearly acting as a temporary bridge.

### Workbench Shared Contracts

Treat these contracts as shared lane boundaries:

- `WorkbenchSolvedModel`
- object-first geometry context
- geometry-derived plan overlay
- object hit-target model
- object-first edit/commit patch model
- workbench trust/status model

`WorkbenchSolvedModel` must answer:

- what object-first draft/project was solved
- which module is active
- whether geometry solved
- which `Assembly3D` produced plan and 3D scene
- what fallback or invalid condition applies

Geometry-derived plan overlays and hit targets must include object IDs, object family, geometry source IDs, selectable or editable affordances, and trust metadata. They must not own independent geometric truth.

### Workbench Merge Gates

Every workbench migration PR must answer:

1. Does this move a consumer closer to object-first or solved geometry?
2. Did it add or remove compatibility surface area?
3. What fallback remains?
4. What proves plan and 3D still agree?
5. What tests were run?

Required for any PR touching geometry, plan, or interactions:

```text
npm run test:portal -- apps/portal/lib/drawings/state/drawingWorkbenchStore.test.ts
npm run test:portal -- apps/portal/components/drawings/rail/objectWorkbenchImportGuards.test.ts
```

Required when touching plan overlays:

```text
npm run test:portal -- apps/portal/lib/drawings/views/plan/buildPlanViewModel.test.ts
npm run test:portal -- apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx
```

Also run `houseFirstPlanOverlay.test.ts` when the change touches compatibility or legacy plan fallback behavior. `objectWorkbenchPlanOverlay` is covered through the plan view-model and viewport interaction tests until it has a dedicated test file.

Required when touching geometry derivation:

```text
npm run test:portal -- apps/portal/lib/drawings/geometry/buildWorkbenchGeometryPreview.test.ts
npm run test:portal -- apps/portal/lib/drawings/geometry/buildRawGeometryModuleInput.test.ts
```

Required when touching viewport interaction behavior:

```text
npm run test:portal -- apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx
```

Broader runs may be required before merging an integration branch.

### Workbench Forbidden Patterns

Avoid these patterns unless the file is explicitly inside a compatibility adapter:

```ts
store.derived.house
store.derived.decks
store.derived.openings
store.derived.pergolas
store.persisted.compatibilityProjectModel
sharedHouse: HouseModel
buildHouseFirstWorkbenchProjectModel(...)
```

Avoid public file names or type names that make compatibility look canonical.

Avoid adding geometry rules directly into React view components.

Avoid plan-only coordinate transforms that cannot be traced back to solved geometry.

## Integration Rhythm

For aggressive parallel work:

1. Land contract-only PRs first when multiple lanes need the same shape.
2. Land lane PRs behind existing behavior where possible.
3. Add import guards as soon as a boundary is created.
4. Run focused tests on every lane PR.
5. Use integration PRs to remove temporary adapters, update docs, and prove cross-lane behavior.

Parallel work should converge on canonical source-of-truth owners. If two lanes disagree, the owner package, route, schema, or current-state doc wins.
