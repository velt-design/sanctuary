# Design Workbench Parallel Migration Rules

Status: Draft

Related docs:

- [`docs/house-first-design-workbench-implementation-plan.md`](./house-first-design-workbench-implementation-plan.md)
- [`docs/house-first-design-workbench-execution-board.md`](./house-first-design-workbench-execution-board.md)
- [`docs/object-interaction-system-spec.md`](./object-interaction-system-spec.md)

## Purpose

This document defines the operating rules for doing the design workbench migration aggressively in parallel.

The migration goal is not just to rename house-first code to object-workbench code. The goal is to make the workbench accurate by construction:

```text
object-first draft
  -> solved workbench model
  -> geometry plan / 3D scene / section / sheet / interactions / status
```

Every parallel lane must move the codebase toward that pipeline.

## Non-Negotiable Standard

A view may format, filter, annotate, or interact with geometry, but it may not invent geometry.

Plan, 3D, section, and sheet must become different presentations of the same solved model. If a view still uses compatibility or legacy fallback during migration, that fallback must be explicit in state, naming, status, and tests.

## Current Bridge State

The current workbench is in a bridge phase:

- Object-first project and draft models exist.
- Hidden-route edits persist through the object-first draft envelope.
- Rail, inspector, and status models are being moved away from direct compatibility reads.
- Geometry and plan are closer to object-first because they can receive an object workbench project/context.
- Geometry still builds through compatibility-shaped house context internally.
- Model Space plan still has compatibility overlay and legacy drawing paths.
- 3D preview and store geometry derivation are closer, but still not one shared solved artifact.

This bridge is allowed while it is actively shrinking. It is not the final architecture.

## Core Rules

### 1. One Truth Rule

No new feature may introduce a separate source of geometric truth.

Allowed:

- deriving display data from the solved model
- adding annotations on top of solved geometry
- exposing temporary compatibility status with explicit names

Not allowed:

- computing a plan shape separately from the 3D geometry
- adding view-specific geometry shortcuts without a migration note
- hiding fallback geometry behind names that sound canonical

### 2. Compatibility Quarantine

Compatibility code must stay behind explicit compatibility boundaries.

Allowed compatibility locations:

- `apps/portal/lib/drawings/state/compat/`
- `apps/portal/lib/drawings/geometry/compat/`
- explicitly named migration adapters
- tests that are deliberately proving compatibility behavior

Public object-workbench files should not import compatibility models directly unless the file itself is a boundary facade.

Examples of names that must remain suspect:

- `HouseModel`
- `houseFirst`
- `sharedHouse`
- `compatibilityProjectModel`
- `objectWorkbenchCompatibilityHouse`
- `buildHouseFirst...`

These can exist only when the file is clearly acting as a temporary bridge.

### 3. Contract First

Before a lane changes broad behavior, define or update the contract it depends on.

Contracts that need special care:

- `WorkbenchSolvedModel`
- object-first geometry context
- geometry-derived plan overlay
- object hit-target model
- object-first edit/commit patch model
- trust/status model

If two lanes need the same contract, agree on the type shape first, then implement behind it.

### 4. No Silent Fallbacks

Legacy rendering or compatibility inference is allowed only if it is visible.

Fallbacks must expose status such as:

- `geometry_ready`
- `legacy_fallback`
- `legacy_unsupported_family`
- `invalid_geometry`
- `unresolved_host`
- `approximate`

Any user-facing or export-facing workflow that claims accuracy must be able to prove it is not using an untrusted fallback.

### 5. Small PRs, Hard Boundaries

Each PR should declare:

- lane
- files owned
- contracts changed
- compatibility touched
- tests run
- remaining bridge dependency

Parallel work should avoid mixed-purpose PRs. A slice that changes store derivation, plan rendering, and interaction commits at the same time is too wide unless it is an agreed integration PR.

### 6. Tests Are Merge Gates

Tests are not optional during this migration. The most important tests are parity tests that prove multiple surfaces are consuming the same truth.

Required test styles:

- unit tests for new contracts
- bridge tests that prove compatibility remains quarantined
- parity tests between plan and 3D geometry
- interaction tests that prove object-first edits update solved geometry
- status tests that prove fallback and unresolved states are visible

### 7. No Cosmetic Migration Credit

A change only counts as migration progress when dependency direction changes.

Does not count by itself:

- renaming `houseFirst` to `objectWorkbench`
- moving compatibility reads into a differently named file
- adding object-first types that runtime code does not use

Counts:

- a consumer moves from compatibility model to object-first model
- a view consumes solved geometry instead of fallback plan data
- a status gate exposes and blocks untrusted output
- a compatibility adapter becomes smaller or loses a caller

## Parallel Lanes

### Lane 1: Solved Model Spine

Goal:

Create the single solved artifact that all workbench views and status models consume.

Expected output:

```text
WorkbenchSolvedModel
  projectModel
  moduleSolutions[]
  activeSolution
  geometry config
  Assembly3D
  GeometryPlanViewModel
  GeometrySectionViewModel
  ViewerSceneModel or scene input
  validation/status
```

Primary ownership:

- `apps/portal/lib/drawings/state/drawingWorkbenchStore.ts`
- new solved model builder files
- geometry preview integration
- store tests

Done means:

- Model Space plan and 3D preview consume the same solved module artifact.
- 3D preview no longer independently rebuilds equivalent geometry from draft when store already has the solved model.
- The solved model records whether it is geometry-ready, fallback, invalid, or unsupported.

Do not:

- keep separate plan and 3D derivation paths indefinitely
- let the solved model depend on React state or viewport concerns

### Lane 2: HouseAssembly To Geometry

Goal:

Move geometry input away from compatibility `HouseModel` and toward object-first `HouseAssembly`.

Primary ownership:

- object workbench geometry context
- raw geometry input adapter
- geometry package input contracts if required
- geometry adapter tests

Done means:

- `deriveWorkbenchGeometry` no longer needs `sharedHouse: HouseModel`.
- `buildRawGeometryModuleInput` can build house context from object-first assembly data.
- compatibility conversion is isolated to a temporary adapter.

Do not:

- add new callers to `sharedHouse`
- make multi-form behavior impossible by preserving first-house-only assumptions

### Lane 3: Plan From Geometry

Goal:

Make Model Space plan a top-down view of solved geometry.

Primary ownership:

- plan view model
- geometry-derived plan overlay
- `ModuleViewsCard` plan rendering
- `ModelSpaceViewport` plan plumbing
- plan overlay tests

Done means:

- house, deck, opening, and pergola plan display use solved geometry or geometry-derived overlay data.
- `houseFirstPlanOverlay` is deleted, renamed as explicitly legacy-only, or no longer decides shape truth.
- plan object IDs match solved geometry object IDs.

Do not:

- draw a plan object from compatibility data while 3D draws it from solved geometry
- introduce SVG-only geometry rules that are not derivable from `Assembly3D`

### Lane 4: Object-First Interaction Layer

Goal:

Make interactions target object IDs and solved geometry, then commit object-first patches.

Primary ownership:

- object workbench draft actions
- `useObjectWorkbenchActions`
- deck/opening/pergola interaction adapters
- hit-target and selection contracts

Done means:

- dragging or editing an object updates the object-first draft.
- the workbench re-solves geometry after edits.
- interactions use solved geometry hit targets and constraints where available.
- compatibility selection language is removed from public action contracts.

Do not:

- commit edits by converting object-first to compatibility, editing compatibility, then converting back
- keep separate interaction rules for plan and 3D that can disagree

### Lane 5: Accuracy And Trust Gate

Goal:

Make accuracy visible and enforceable.

Primary ownership:

- object workbench status model
- rail and inspector statuses
- export/review readiness checks
- diagnostics and trust tests

Done means:

- every active view exposes whether it is geometry-backed, fallback, approximate, invalid, or unresolved.
- export/review can block or warn when the current result is not accurate enough.
- users and QA can tell why something is not trusted.

Do not:

- allow a legacy fallback to look production-accurate
- hide unresolved host or invalid geometry states inside debug-only metadata

## Shared Contracts

### WorkbenchSolvedModel

This is the central contract for Lane 1.

Minimum shape:

```ts
type WorkbenchSolvedModel = {
  projectModel: WorkbenchProjectModel;
  modules: WorkbenchSolvedModule[];
  activeModule: WorkbenchSolvedModule | null;
  trust: WorkbenchTrustStatus;
};
```

The exact implementation can differ, but it must answer these questions:

- What object-first draft/project was solved?
- Which module is active?
- Was geometry solved?
- Which `Assembly3D` produced the plan and 3D scene?
- What fallback or invalid condition applies?

### Geometry-Derived Plan Overlay

This is the central contract for Lane 3 and Lane 4.

It should provide:

- object ID
- object family
- geometry source ID
- polygon or line in plan coordinates
- selectable hit area
- editable handles
- status/trust metadata

It should not own independent geometric truth.

### Object Hit Target

This is the shared interaction contract.

It should provide:

- family
- object ID
- geometry ID
- editable affordance kind
- resolved host edge/wall/zone when relevant
- trust status

The same hit target contract should be usable by plan interactions and future 3D interactions.

### Workbench Trust Status

This is the shared accuracy contract.

Minimum status values:

- `geometry_ready`
- `legacy_fallback`
- `legacy_unsupported_family`
- `invalid_geometry`
- `unresolved_host`
- `approximate`

Every view can map these to its own UI, but the state must come from the same trust source.

## Merge Gates

Every migration PR must answer:

1. Does this move a consumer closer to object-first or solved geometry?
2. Did it add or remove compatibility surface area?
3. What fallback remains?
4. What proves plan and 3D still agree?
5. What tests were run?

Required for any PR touching geometry, plan, or interactions:

```text
npm test -- apps/portal/lib/drawings/state/drawingWorkbenchStore.test.ts
npm test -- apps/portal/components/drawings/rail/objectWorkbenchImportGuards.test.ts
```

Required when touching plan overlays:

```text
npm test -- apps/portal/lib/drawings/views/plan/houseFirstPlanOverlay.test.ts
npm test -- apps/portal/lib/drawings/views/plan/buildPlanViewModel.test.ts
```

Required when touching geometry derivation:

```text
npm test -- apps/portal/lib/drawings/geometry/buildWorkbenchGeometryPreview.test.ts
npm test -- apps/portal/lib/drawings/geometry/buildRawGeometryModuleInput.test.ts
```

Required when touching viewport interaction behavior:

```text
npm test -- apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx
```

Broader runs may be required before merging an integration branch.

## Forbidden Patterns

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

1. Land contract-only PRs first.
2. Land lane PRs behind existing behavior where possible.
3. Add import guards as soon as a boundary is created.
4. Run focused tests on every lane PR.
5. Run a weekly integration PR that removes temporary adapters or updates the execution board.

Parallel work should converge on the solved model spine. If two lanes disagree, the solved model contract wins.

## Definition Of Done For The Migration

The migration is complete when:

- authored state is object-first
- geometry input is object-first
- the store exposes one solved workbench model
- plan, 3D, section, and sheet consume the same solved geometry
- interactions commit object-first patches
- compatibility adapters are either deleted or isolated to legacy import/export paths
- no accurate output is allowed from untrusted fallback geometry
- parity tests prove plan and 3D agree by object ID and coordinate tolerance

