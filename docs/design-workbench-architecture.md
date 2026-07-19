# Design Workbench Architecture

Status: Current contract.

## Read First

Start here for every change to the design workbench, drawing runtime, geometry package workbench output, or future workbench commercial input.

- Use `## Product North Star (READ FIRST)` as the gate for all proposals.
- Use [`docs/house-composition-vision.md`](house-composition-vision.md) for the future-direction input model for house forms (rectangle primitives + join operations). House-related PRs must answer how they advance this vision (see Gate 0).
- Use `docs/design-workbench-legacy-cull.md` only for legacy audit row citations and historical context.
- Use `docs/workbench-captured-repro-workflow.md` before changing solver, render, Plan, or 3D behavior from a visible bug.
- Use `docs/costing-and-geometry.md` for package geometry and downstream commercial/takeoff boundaries.
- Use `apps/portal/lib/workbenchBreakawayImportGuards.test.ts` as the executable runtime boundary.

## Product North Star (READ FIRST)

The workbench product is a single object-first geometry model that can serve multiple UI shells.

```text
WorkbenchProjectModel
  -> @sp/geometry project solve / portal solve adapter
  -> WorkbenchSolvedGeometryArtifact
  -> Plan / 3D / Sheet / future Section / Snap / Diagnostics
```

Future commercial work is downstream only:

```text
WorkbenchSolvedGeometryArtifact / geometry quantity takeoff
  -> commercial/costing adapter
  -> estimates / quotes / invoices / job packs
```

The calculator and the workbench are separate product paths. The marketing enquiry and calculator V1 pricing path remains protected, but the live Design Workbench must not read, synthesize, reprice, or fall back to calculator-era design state.

### House Input Is Composed, Not Drawn

New house forms are composed from axis-aligned rectangle primitives joined by explicit `Join` operations. See [`docs/house-composition-vision.md`](house-composition-vision.md) for the model and [`docs/pr-comp1-plan.md`](pr-comp1-plan.md) for the Phase 1 implementation. Legacy free-form house forms continue to render via the existing geometry pipeline; that path is read-only and not in scope for new feature work.

### Gate 0 For Workbench PRs

Every implementation proposal touching workbench, drawing runtime, package geometry workbench output, or cost-input migration must answer:

- Which legacy audit row(s) from `docs/design-workbench-legacy-cull.md` does this touch?
- Does the change remove legacy or build on legacy? Build-on changes need explicit approval before coding.
- **For house-form work:** how does this advance the composition vision ([`docs/house-composition-vision.md`](house-composition-vision.md))? Acceptable: "Phase N of the migration", "geometry foundation for a future phase", or "diagnostic/observability shared across composition + legacy paths". Unacceptable: "adds a feature to the legacy free-form pipeline" — the legacy path is read-only.
- Does the change introduce a Phase 2 commercial/cost-input dependency? If yes, split the geometry/runtime cleanup from commercial rollout.
- If consolidating functions or types, list all parameter/field differences and how each difference is preserved, parameterized, or intentionally dropped.
- Which consumers were grepped before changing the boundary?

## Current State

The post-breakaway workbench is object-first and intentionally strict:

- `WorkbenchProjectModel` is the only live workbench design input.
- House forms, pergolas, decks, and openings are object-owned entities with stable ids.
- Plan, 3D, Sheet, snap, diagnostics, and status read the same solved geometry artifact. A future Section surface must join that artifact path instead of reviving a separate workbench view state.
- Project pergola Plan/3D bodies are produced before project composition: `buildWorkbenchSolvedModel` builds object-first pergola render artifacts, then `buildProjectObjectRenderPipeline` and project scene composition consume that artifact list. Empty pergola artifact sets are valid only when the project has no pergolas.
- Invalid geometry renders diagnostic/reference geometry only. It must not borrow another object's committed body. The PR-HR3 fail-soft amber-tint surfaces best-effort solver output for QA-invalid roofs so designers see what the solver attempted; this does not change the invalid classification.
- Workbench repricing is unavailable until a downstream artifact/takeoff-to-commercial adapter exists.
- Snapshot-only calculator designs are unsupported or empty in the live workbench. They are not synthesized into object-first geometry at runtime.
- **New house forms are rectangle compositions; legacy free-form forms are read-only.** See [`docs/house-composition-vision.md`](house-composition-vision.md). PR-COMP1 ships the geometry primitives; subsequent phases land the workbench data model and the rectangle-tool UX.

The current implementation is north-star aligned and exposes a project-level `WorkbenchSolvedProjectArtifact` as the live UI boundary. `WorkbenchSolvedModel` no longer exposes loose project geometry/status aliases; UI and state consumers read project geometry, plan layers, snap sources, and diagnostics from the bundled artifact.

## Runtime Boundaries

Live workbench roots are:

- `apps/portal/app/staff/projects/[projectId]/design-workbench`
- `apps/portal/app/qa/design-workbench-fixture`
- `apps/portal/components/drawings`
- `apps/portal/lib/drawings`

These roots must not import or depend on calculator design inputs, house-first carriers, raw module wrappers, module-index selection, legacy plan/section models, or costing payloads. The import guard owns the exact forbidden pattern list.

Calculator/public-export drawing presenters may keep their own compatibility vocabulary outside this boundary. They are separate surfaces, not fallbacks for live workbench geometry-ready views.

## Object Model

The workbench model is based on first-class spatial entities:

- **Origin independence:** each object owns its world position; no object is positioned implicitly by a host's dimensions.
- **Local-frame outlines:** each object stores its editable outline in its own local frame; world-space shape is derived.
- **Derived relationships:** snap/solve derives hosted relationships from spatial alignment and object ids.
- **Plan is the editor:** direct manipulation happens in Plan. 3D is read/select only.
- **Openings are rigid:** openings remain wall-local because they have no useful freestanding state.
- **Composed-from-primitives over arbitrary outlines:** new house forms are explicit compositions of axis-aligned rectangle primitives joined by `Join` operations. Snap aligns; only Join makes the forms render as one. Legacy free-form polygons remain readable but are not authored. See [composition vision](house-composition-vision.md).

Do not add select-host-first workflows for pergolas or decks. New authored objects are born freestanding and become related through snap.

## Solved Geometry Contract

`WorkbenchSolvedGeometryArtifact` is the workbench geometry view source. Its consumers should treat it as the only source for:

- committed Plan bodies and context/detail lines;
- 3D scene bodies and materials;
- sheet and section geometry;
- snap sources and hit targets;
- per-object trust/status diagnostics;
- future geometry quantity takeoff.

The live UI boundary is the project artifact bundle:

```text
WorkbenchSolvedProjectArtifact
  objectsById
  planProjection
  viewerScene
  sheet/section views
  snapSources
  diagnostics/health
  quantityTakeoff
```

The remaining cleanup after this boundary is lower-level naming only: existing Plan/3D viewport prop contracts may still use historical project-shape names internally, but new workbench-shell or route code must not introduce independent geometry arrays or view-specific truths.

## Plan And 3D

The workbench has two primary render surfaces:

- `PlanViewport`: the 2D editor. It owns pointer presentation, selection chrome, drag previews, dimensions, and tool affordances.
- `Geometry3DViewport`: the read/select 3D surface. It must not own drag handlers, gizmos, or commit paths.

Both surfaces must read from the solved geometry spine. If Plan and 3D disagree, investigate the first failing artifact/geometry/status stage before changing paint order or styling.

Plan and Sheet remain immediately available workbench surfaces. The Three-based 3D viewport is a separate loading boundary and preloads only from exact `3D Review` hover, focus, touch, or pointer intent; entering 3D without a completed preload shows a truthful local loading state. This changes code delivery only and does not create a second geometry source or alter either viewport's props.

The live canvas Plan surface reports `data-plan-render-source="geometry-canvas"`. Fixture browser coverage treats that diagnostic value as the current canvas contract; `geometry` remains the separate SVG calculator-drawing value.

Geometry-ready Plan body rendering may only draw committed body layers. Reference geometry, diagnostic outlines, context lines, hit targets, drag previews, and selection outlines must remain explicitly named and must not become normal filled bodies.

## Diagnostics And Captured Repros

Visible workbench geometry bugs must be captured through the debug fixture lane before solver or render changes. Do not infer geometry from screenshots.

Use `docs/workbench-captured-repro-workflow.md` to capture and bake payloads. The fixture should assert object id, failure stage, diagnostic code, Plan body counts, 3D body counts, solver metadata, and fallback/reference counts.

Object diagnostics must be owned by object id. A house failure reports a `houseFormId`; a pergola failure reports a `pergolaId`. Diagnostics must not resolve by first object, selected object, or old module index.

## House Roof And Eave Rules

House roof rendering is package-owned geometry, not Plan paint:

- Plan roof bodies come from solved eave/perimeter geometry, not roof-material rib hulls.
- Fully hipped custom orthogonal roofs must pass semantic/coverage QA before committed roof solids or normal Plan bodies render.
- Package eave offset/topology diagnostics decide whether a roof is valid, approximate, or invalid.
- Invalid roofs show diagnostic/reference geometry only.

Detailed roof-solver incident history lives in `docs/decision-log.md` and package tests. Keep this doc limited to stable rules and boundaries.

## Costing Boundary

Workbench runtime does not call costing engines and does not build costing payloads.

The future workbench commercial path starts from solved geometry and package-owned physical takeoff. It must be introduced as a downstream adapter with explicit rollout and rollback. Do not restore calculator compatibility inside the workbench to make pricing work.

Marketing enquiry and calculator V1 pricing remain separate protected paths.

## Verification

Use focused tests for the changed owner plus the boundary guards:

```bash
npx vitest run apps/portal/lib/workbenchBreakawayImportGuards.test.ts
npm run test:portal:workbench
npm run test:portal:browser
npm run docs:impact
```

For non-trivial work, run `npm run architecture:changed` with an appropriate `WORKTREE_OWNER_PATTERNS` declaration.
