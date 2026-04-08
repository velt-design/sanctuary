# Sanctuary Geometry Workbench Spec

Date: 2026-04-08
Status: Locked
Depends on:

- [`docs/drawing-workbench-spec.md`](./drawing-workbench-spec.md)
- [`docs/drawing-workbench-execution-board.md`](./drawing-workbench-execution-board.md)
- [`docs/design-packages-spec.md`](./design-packages-spec.md)
- [`docs/portal-local-first-spec.md`](./portal-local-first-spec.md)

## Purpose

Turn the existing drawing-workbench, design-package, and portal local-first direction into one canonical product-level build spec for the Sanctuary configurator/workbench.

This document does not replace the lower-level architecture specs, but it is the top-level reference for product intent and V1 boundaries. It is the shared build reference for:

- what is already locked by the repo direction
- what V1 should build now
- how the workbench should enter the real project and estimate workflow
- how delivery should now be sequenced around geometry truth

This document owns:

- product definition
- V1 scope and non-goals
- route strategy and rollout posture
- workflow entry and canonical ownership
- the geometry-first implementation baseline

The lower-level docs remain authoritative for implementation detail in their areas:

- `docs/drawing-workbench-spec.md` for workbench architecture
- `docs/drawing-workbench-execution-board.md` for lower-level historical sequencing context
- `docs/design-packages-spec.md` for estimate-backed design-request workflow
- `docs/portal-local-first-spec.md` for portal sync and authority rules

If a lower-level doc is interpreted in a way that conflicts with this document on V1 product scope, rollout posture, or geometry-source-of-truth policy, this document wins until it is explicitly revised.

## Blunt Product Definition

We are not building a prettier SVG drafting surface first.

We are building a shared parametric geometry workbench for Sanctuary Pergolas whose primary job is to produce trustworthy structural 3D geometry from estimate-backed design inputs. That geometry then drives:

- the hidden internal 3D verification viewer
- derived 2D plan, section, and elevation outputs
- quantity hooks
- later ops, sales, and marketing skins

The internal portal workbench ships first, but its real long-term value is not the current route or rail shell. Its value is one shared geometry kernel that becomes the runtime source of truth.

## Locked Direction

These decisions are already established by the repo or are now explicitly frozen by this spec and should not be re-litigated during V1.

### 1. Geometry Truth First

- The current SVG plan and sheet surfaces are presentation layers, not geometry truth.
- `Assembly3D` is the long-term canonical model.
- 2D drawing outputs must be derived from 3D assembly, not treated as the upstream source of geometry.

### 2. One shared geometry pipeline

The same underlying geometry must power:

- hidden 3D verification
- `Model Space`
- `Sheet View`
- later sales and marketing skins

Do not fork viewport geometry and sheet geometry into separate systems.

### 3. `Model Space` is the editor

- Direct manipulation belongs in `Model Space`.
- The rail and viewport edit the same underlying configuration state.
- The hidden 3D viewer is a validation surface, not the primary editing surface.

### 4. `Sheet View` is document-first

- `Sheet View` is for review, composition, and printable output.
- It should not become the long-term editing surface.
- It is downstream of geometry truth.

### 5. The rail is a curated subset

The rail covers the common editing path only:

- geometry
- roof
- house/context
- supports
- view controls

Do not clone the full calculator into the rail.

### 6. Edits remain live draft edits

Workbench edits are live draft edits, not a staged apply flow.

### 7. Output delivery order is fixed

Output delivery still ships in this order:

1. `Plan`
2. `Section`
3. `Elevation`
4. `Details`

This is output order, not implementation order. Implementation order is now geometry-first.

### 8. The first generated detail family is fixed

The first detail proof-of-concept is:

- house connection / soffit attachment

### 9. Design work is estimate-backed

Design requests must be explicit and tied to a real `estimate_id`.

- initial request is estimate-backed
- revisions are new estimate-backed requests
- canonical workflow source is `design_package_requests`

Design requests remain workflow records. They do not replace the estimate-backed geometry/config state that drives the editor.

### 10. The portal is local-first for routine edits

- browser-owned working copies and queued edits should make routine work feel instant
- server-owned records remain authoritative for persisted business truth
- heavy artifact generation should happen after durable business writes, not on the visible save path

## Recommended V1 Implementation

These are recommended V1 directions that are now adopted for this build. They were not all previously repo-locked, but they should be treated as fixed for V1 unless this document is revised.

### 1. Ship a dedicated internal workbench route first

Use a real portal route:

- `/staff/projects/[projectId]/design-workbench`

Optional later addressing:

- `/staff/projects/[projectId]/design-workbench?estimateId=...&requestId=...`

This route should be:

- internal only
- staff-auth gated
- feature-flag gated
- hidden until the production-readiness review passes
- available by direct URL only for approved internal testers during the hidden-route phase
- connected to real `project`, `estimate`, and optional `design_package_request` records
- capable of loading fixture/demo data inside the real route for fast iteration

Do not add this route to normal sidebar navigation or expose it as a default project-page action before production readiness.

### 2. Keep the project page as launcher and summary first

During the hidden-route phase, the project page should not become the editor and should not expose the workbench by default.

After the production-readiness review passes, the project page may show:

- open workbench action
- active design status
- optional design request status
- linked estimate/version
- last updated
- optional preview thumbnail or sheet snapshot

But the project page should not become the main editor.

### 3. Keep V1 geometry scope tight

Support:

- `mono`
- `gable`
- `box` perimeter with constrained internal fall rules

Defer:

- `hip`
- irregular footprints
- unusual multi-module edge cases
- bespoke architectural connection exceptions

### 4. Make `packages/geometry` the runtime kernel

Required shared package:

- `packages/geometry/`

This package is not just a type home. It is the intended runtime source of truth for normalized geometry config, `Assembly3D`, validation, and viewer-scene derivation. The portal uses it first. Sales and marketing can reuse it later.

## Product Goal

Reduce design-package turnaround time for standard pergolas by replacing a large portion of the Rhino to plan to quote-preparation path with a deterministic structural 3D geometry system that can drive:

- normalized configuration
- validated `Assembly3D`
- hidden 3D verification
- derived 2D plan output
- later derived section, elevation, and detail outputs
- quantity extraction from the same geometry truth

## Success Definition

For standard pergolas, staff should be able to:

- open the hidden workbench against an estimate-backed active design
- derive a normalized `GeometryConfig` from estimate/calculator state
- generate a trustworthy `Assembly3D` for `mono`, `gable`, and `box`
- inspect that assembly in a hidden internal 3D verification viewer
- derive a usable plan view and sheet preview from the same 3D assembly
- persist the design as part of the estimate draft flow
- reuse the same geometry for quantities and future drawing outputs

V1 is not successful if plan SVG looks better but 3D assembly truth is still uncertain.

## Non-goals

Do not use V1 to:

- build a freeform modelling system
- replace Rhino for irregular edge-case jobs
- claim full CAD or BREP solids
- stop at centerlines-only geometry with no structural member semantics
- chase photoreal rendering
- make `Sheet View` the main editing surface
- fork into separate configurator and sheet geometry stacks
- rewrite the full calculator before workbench value ships
- make quote sending, payment state, or other lock-sensitive workflows browser-authoritative

## Users

### Primary user: internal design and quoting staff

Needs:

- faster standard-job design creation
- trustworthy geometry, not just faster drafting
- reliable plan output derived from real geometry
- estimate-backed revision handling
- geometry reuse for quote preparation

### Secondary user: salesperson onsite

Needs:

- quick geometry shaping
- clear visual feedback
- fast preset-driven editing
- a constrained editing surface rather than full drafting depth

### Tertiary user: marketing site visitor

Needs:

- simplified exploratory configuration
- visual understanding
- no drafting-heavy or ops-heavy workflow

## Core Principles

### 1. Geometry Truth First

`GeometryConfig -> Assembly3D -> validation -> hidden 3D verification viewer -> derived 2D outputs` is the core pipeline.

Current SVG surfaces remain valid presentation layers, but they are not the geometry authority.

### 2. One shared geometry pipeline

Configuration, 3D assembly, validation, plan, sheet, and later detail generation all derive from the same source state.

### 3. `Model Space` is the editing surface

Direct manipulation belongs there. The hidden 3D viewer validates geometry. `Sheet View` is review and composition.

### 4. Estimate-backed workflow

All new design work starts from an estimate-backed request, and revisions remain tied to estimate snapshots.

### 5. Portal-first drafts, server-authoritative records

Fast editing is local-first. Persisted estimate rows, design workflow state, quote artifacts, stage changes, auth, and other final business records remain server-owned.

### 6. Durable write before heavy artifact generation

Persist the business entity first. Generate heavy outputs in the background after that.

### 7. Output order remains plan-first, implementation order becomes geometry-first

Plan remains the first production output. But implementation now moves through 3D geometry, validation, and verification before broader 2D/editor polish.

## Product Scope

### V1 in scope

- hidden internal workbench route
- normalized `GeometryConfig`
- runtime `Assembly3D` kernel in `packages/geometry`
- deterministic solvers for `mono`, `gable`, and `box`
- geometry validation and fixture QA
- hidden 3D verification viewer for internal validation
- derived plan `Model Space` and derived plan `Sheet View`
- estimate-backed draft persistence
- geometry-derived quantity hooks

### V1 out of scope

- production section output
- production elevation output
- generated detail output
- public or broad internal 3D viewer exposure
- sales skin
- marketing skin
- photoreal or presentation-grade rendering
- full CAD solids or fabrication-grade solid modelling
- broad exposure outside the hidden staff route before production readiness

## Route And Rollout Strategy

### Route

Build the first version at:

- `/staff/projects/[projectId]/design-workbench`

### Launch policy

The route should be:

- internal only
- behind staff auth
- behind a feature flag
- hidden until the production-readiness review passes
- direct URL only for approved internal testers during the hidden-route phase
- connected to real entities from day one
- able to run with fixture data for development speed

Do not add normal navigation exposure or a default project-page launcher before production readiness.

### Project-page relationship

At first, the project page does not host the editor and does not expose the workbench by default.

Later, after the hidden-route period ends, the project page becomes the orchestration and summary surface for:

- status
- linked estimate
- active request metadata
- last updated
- preview

The workbench remains the editor and geometry QA host.

## Core Workflow

### Entry points

#### A. From calculator estimate generation

After estimate creation succeeds, the user may optionally request a design package.

#### B. From the project estimates tab

A selected estimate can be used to create a design request.

### Core flow

1. User creates or selects an estimate.
2. User may request design for workflow tracking.
3. System may create or update the relevant `design_package_request`.
4. Workbench opens against:
   - `project_id`
   - `estimate_id`
   - current estimate drawing draft state, or the estimate snapshot when no draft exists yet
   - optional linked design request metadata when relevant
5. Estimate and calculator inputs are normalized into `GeometryConfig`.
6. `GeometryConfig` generates `Assembly3D`.
7. Validation and hidden 3D verification confirm geometry correctness.
8. Plan `Model Space` and `Sheet View` are derived from the same assembly.
9. Quantity hooks are derived from the same geometry truth.
10. Draft is saved locally immediately and queued for sync.
11. Heavy artifacts are generated after durable save, not before preview or open.

## Canonical Ownership

### Browser or local working copy owns

- active configuration edits
- unsaved drawing draft state
- selection, hover, drag, zoom
- provisional local mutations
- local preview state

### Server owns

- persisted estimate rows
- persisted design request workflow state
- quote versions and artifacts
- stage changes
- schedule commitments
- auth and permissions
- any final workflow action

## Domain Model

### `DesignPackageRequest`

Canonical design-work child record. It is estimate-backed and versioned. It tracks:

- request version
- status
- selected estimate
- priority tier snapshot
- notes
- due date
- assignment

One active request per project is enforced.

### `Estimate`

Immutable pricing and design anchor used to start design work and revisions.

### `DrawingDraft`

Recommended persistence layer above current estimate drawing draft helpers. This is not a new workflow record. It is persisted editable geometry/config state associated with the estimate and optional request context.

### Coordinate system

Lock the runtime coordinate system as:

- `X` = pergola length
- `Y` = projection away from the attachment edge
- `Z` = height

All 3D member coordinates, datums, roof planes, and derived 2D projections must follow this convention.

### `GeometryConfig`

Normalized runtime geometry input. It is derived from estimate/calculator state and persisted draft state. It is not a view model and must contain no SVG or sheet concerns.

```ts
type GeometryConfig = {
  projectId: string
  estimateId: string
  designRequestId?: string | null

  family: "mono" | "gable" | "box"

  datum: {
    origin: Point3
    xAxis: Vector3
    yAxis: Vector3
    zAxis: Vector3
    attachmentEdgeStart: Point3
    attachmentEdgeEnd: Point3
  }

  dimensions: {
    lengthMm: number
    projectionMm: number
    roofPitchDeg: number
  }

  roof: {
    material: "acrylic" | "insulated" | "timber" | "louvre"
    mode?: string | null
    fallDirection: "positiveY" | "negativeY" | "dual"
    boxPerimeterEnabled: boolean
  }

  connection: {
    type: "fascia" | "soffit" | "wall" | "freestanding"
    attachmentSide: "left" | "right" | "rear" | "front"
  }

  supports: {
    postMode: "standard" | "custom"
    postPositions?: Array<Point3>
    postCount?: number
    postCutHeightMm?: number
    footingType?: "slab" | "pier" | "pile"
    groundLevelMm?: number | null
  }

  houseContext: {
    wallLine?: Line3 | null
    fasciaLine?: Line3 | null
    roofEdgeLine?: Line3 | null
    soffitDepthMm?: number | null
    footprint?: Polygon3 | null
  }
}
```

### `AssemblyMember3D`

The atomic structural output of the kernel.

```ts
type AssemblyMember3D = {
  id: string
  role:
    | "post"
    | "beam"
    | "ledger"
    | "ridge"
    | "rafter"
    | "gutter"
    | "brace"
  centerline: Line3
  profile: {
    shape: "rectangular" | "c-channel" | "custom"
    widthMm: number
    depthMm: number
  }
  localFrame: {
    origin: Point3
    xAxis: Vector3
    yAxis: Vector3
    zAxis: Vector3
  }
  metadata?: Record<string, string | number | boolean | null>
}
```

### `RoofPlane3D`

```ts
type RoofPlane3D = {
  id: string
  boundary: Polygon3
  plane: Plane3
  fallVector: Vector3
  metadata?: Record<string, string | number | boolean | null>
}
```

### `HouseReferenceGeometry`

```ts
type HouseReferenceGeometry = {
  wallPlane?: Plane3 | null
  fasciaLine?: Line3 | null
  roofEdgeLine?: Line3 | null
  soffitDepthMm?: number | null
  footprint?: Polygon3 | null
}
```

### `Assembly3D`

Canonical structural 3D output of the workbench. This is the only geometry truth.

```ts
type Assembly3D = {
  family: "mono" | "gable" | "box"
  datum: GeometryConfig["datum"]
  outline: Polygon3
  attachmentEdge: Line3 | null
  house: HouseReferenceGeometry
  members: AssemblyMember3D[]
  roofPlanes: RoofPlane3D[]
  supportConditions: Array<{
    type: string
    memberId: string
    metadata?: Record<string, string | number | boolean | null>
  }>
  quantityHooks: Array<{
    key: string
    quantity: number
    unit: string
  }>
  semantics: {
    connectionType: string
    roofType: string
    structuralZones: string[]
  }
}
```

### `GeometryValidationReport`

Required validation output for internal QA.

```ts
type GeometryValidationReport = {
  status: "pass" | "fail" | "unsupported"
  invariants: Array<{
    key: string
    status: "pass" | "fail"
    message: string
  }>
  unsupportedReasons: string[]
  fixtureComparisons: Array<{
    fixtureId: string
    status: "match" | "drift"
    message: string
  }>
}
```

### `ViewerSceneModel`

3D viewer-facing scene structure derived from `Assembly3D`.

```ts
type ViewerSceneModel = {
  layers: Array<{
    id: string
    label: string
    visibleByDefault: boolean
    objects: Array<{
      id: string
      type: "member" | "roofPlane" | "reference" | "annotation"
      sourceId?: string
      metadata?: Record<string, string | number | boolean | null>
    }>
  }>
}
```

### Derived view models

These are downstream projections. They are never geometry truth.

```ts
type PlanViewModel = { /* derived from Assembly3D */ }
type SectionViewModel = { /* derived from Assembly3D */ }
type ElevationViewModel = { /* derived from Assembly3D */ }
```

## Architecture

The canonical runtime pipeline is now:

1. estimate and calculator inputs
2. normalized `GeometryConfig`
3. `Assembly3D`
4. `GeometryValidationReport`
5. `ViewerSceneModel`
6. derived 2D view models
7. annotation engine
8. presentation surfaces

### 1. Estimate and calculator inputs

These remain the upstream business and pricing inputs. They are not the geometry kernel themselves.

### 2. Normalized `GeometryConfig`

This is the first geometry-owned runtime contract.

It must:

- normalize estimate/calculator state
- lock datums and units
- encode house connection and support conditions explicitly
- remain free of view, SVG, and sheet concerns

### 3. `Assembly3D`

This is the canonical geometry model.

It must:

- hold world-space member coordinates
- hold member profiles and local frames
- hold roof planes and fall semantics
- hold house reference geometry
- remain future-safe for detail generation and quantity extraction

Current `planModel` and `sectionModel` structures are temporary legacy intermediates and must not remain the long-term source of geometry truth.

### 4. `GeometryValidationReport`

Validation is a first-class stage, not an afterthought.

It must cover:

- invariants
- unsupported-case rejection
- fixture comparisons
- solver drift detection

### 5. `ViewerSceneModel`

The hidden 3D viewer consumes a scene model derived directly from `Assembly3D`.

This viewer is a required internal validation surface. It is not optional polish.

### 6. Derived 2D view builders

2D builders are pure derivations from `Assembly3D`.

Required builders:

- `buildPlanViewModel`
- later `buildSectionViewModel`
- later `buildElevationViewModel`
- later `buildDetailViewModel`

V1 only requires plan production output, but the geometry model must remain correct and future-safe for the later builders.

### 7. Annotation engine

Annotation remains a separate placement layer over derived 2D output.

It should solve:

- upside-down text
- `FALL`
- framing spacing labels
- geometry-anchored versus page-anchored placement

But it must not become a substitute for real geometry.

### 8. Presentation surfaces

Required surfaces remain:

- hidden internal 3D verification viewer
- `DrawingWorkbench`
- `ModelSpaceViewport`
- `SheetViewport`
- `SheetComposer`
- renderers such as `PlanRenderer`, then later section and elevation renderers

These are presentation surfaces. They are not geometry truth.

## UI Surface Spec

### Hidden 3D verification viewer

This is a required V1 internal validation surface.

It should:

- render directly from `Assembly3D`
- remain hidden and internal
- support orbit, pan, zoom, and fit
- support layer toggles for members, roof planes, and house context
- support enough inspection tooling to confirm geometry correctness

It is not the primary user-facing editing surface.

### `Model Space`

Primary editing surface. It should support:

- clean drawing background
- pan and zoom
- direct manipulation
- immediate visual feedback
- minimal document-style chrome

Recommended V1 interactions:

- switch pergola type
- change roof or material mode
- width and projection edits
- attachment-side edits
- constrained house/context editing
- rotate or fit view
- select members for contextual controls

Further `Model Space` polish is frozen unless it directly supports the new geometry kernel.

### `Sheet View`

Document-first preview surface. It should support:

- title block
- legend
- note and metadata area
- scale-aware composition
- lower-interaction review behavior

`Sheet View` remains downstream of geometry truth and is not a substitute for 3D verification.

### Rail

The rail should cover:

- geometry
- roof
- house/context
- supports
- view controls

Do not put these in the rail:

- title block editing
- sheet layout logic
- rare advanced calculator-only fields

Do not broaden the rail further until geometry review gates are passed.

## Annotation Rules

These rules are locked and apply only to derived 2D outputs:

- text must never render upside down
- page-anchored and geometry-anchored annotations must be explicitly declared
- geometry rotation must not define annotation behavior
- primary dimensions should follow viewport-specific placement policy
- `FALL` must be semantic, not decorative
- framing annotations like `c/c` stay tied to real semantic members

### V1 annotation outputs

- overall width
- overall projection
- selected framing spacing
- fall arrow and label
- attachment edge label
- post count or key member labels where needed

## Persistence And Sync

The workbench should sit on top of the portal local-first model rather than inventing a separate persistence pattern.

### Recommended persistence behavior

- local working copy keyed by `estimateId`, with optional request metadata
- queued mutation payloads for config and drawing edits
- server-side durable draft save
- background artifact generation after durable save

### Mutation classes

- workbench config edits are Class A local-first syncable mutations
- design workflow status changes are Class B optimistic but server-authoritative mutations
- quote send, payment, and destructive actions remain Class C server-only final actions

### Required sync states

- saved
- syncing
- offline
- conflict
- error

## Outputs

### V1 required outputs

- normalized `GeometryConfig`
- validated `Assembly3D`
- `GeometryValidationReport`
- hidden internal 3D verification viewer
- derived plan `Model Space` output
- derived plan `Sheet View` preview
- persisted drawing draft
- geometry-derived quantity hooks
- estimate-backed design revision traceability

Plan and sheet output are not production-trustworthy until the 3D validation and viewer gates are passed.

### V2 outputs

- derived section view
- derived elevation view
- first generated detail family: house connection / soffit attachment

### V3 outputs

- richer details
- salesperson skin
- marketing skin
- higher-quality visuals

## Recommended File Structure

Keep the current drawing-workbench folder split and extend it where needed:

```txt
packages/geometry/

apps/portal/app/staff/projects/[projectId]/design-workbench/page.tsx

apps/portal/components/drawings/workbench/
apps/portal/components/drawings/rail/
apps/portal/components/drawings/viewports/
apps/portal/components/drawings/renderers/
apps/portal/components/drawings/sheets/

apps/portal/lib/drawings/state/
apps/portal/lib/drawings/assembly/
apps/portal/lib/drawings/views/plan/
apps/portal/lib/drawings/views/section/
apps/portal/lib/drawings/views/elevation/
apps/portal/lib/drawings/annotations/
apps/portal/lib/drawings/details/
```

Near-term extraction seeds already identified by the repo:

- `moduleViews.ts`
- `ModuleViewsCard.tsx`
- `EstimateDrawingSheet.tsx`
- `drawingEdits.ts`

## Brief Phase Outline

This document sets product direction only. For task sequencing and review gates, use `docs/sanctuary-geometry-workbench-execution-plan.md`.

The implementation order is now geometry-first:

1. `G0` reset and freeze:
   - rewrite the plan around geometry truth
   - freeze non-geometry polish unless it supports validation
2. `G1` geometry contract and datum definition:
   - lock normalized config, datums, member semantics, and 3D output contracts
3. `G2` 3D primitives and normalization:
   - build the reusable geometry runtime base in `packages/geometry`
4. `G3` to `G5` family solvers:
   - solve `mono`, then `gable`, then `box`
5. `G6` validation and fixture QA:
   - prove geometry correctness against representative standard jobs
6. `G7` and `G8` hidden 3D verification:
   - render and inspect `Assembly3D` directly in the hidden route
7. `G9` derive plan from 3D:
   - rebuild plan output as a projection from `Assembly3D`
8. `G10` reconnect editing to trusted geometry:
   - bind rail and `Model Space` editing back onto the new geometry kernel

Output delivery still remains plan first, then section, elevation, and details. But no broad return to plan/sheet/editor polish happens until the geometry and viewer review gates are passed.

## Technical Constraints

### Shared package rule

The geometry kernel must live in a shared package, not page components.

### No split-geometry rule

Do not build one geometry system for the viewport and another for sheets.

### No fake lab model

Do not build a dead-end lab disconnected from real entities. Use real `project`, `estimate`, and optional `design_package_request` records from the start, with fixture mode only as a convenience.

### Geometry-first freeze rules

While the geometry-first plan is active:

- no more milestone credit is given for SVG/editor interaction work unless it depends on the new geometry kernel
- `apps/portal/lib/drawings/assembly/buildAssemblyModel()` is not treated as sufficient geometry completion
- sheet annotation and rail breadth do not expand ahead of `Assembly3D` correctness
- the hidden route remains the host for geometry QA, fixtures, and later 3D verification

## Hardening Note

The workbench can move forward while hardening continues, but it should not become deeply embedded in the core ops path until:

- staff auth boundaries are clearly enforced server-side
- broad development-only data grants are tightened
- the route is safe to expose inside the real internal portal

## Definition Of Done For V1

V1 is done when:

- a staff user can open a real project-linked active design in the hidden workbench route
- the system generates a trustworthy `Assembly3D` for supported `mono`, `gable`, and `box` jobs
- the hidden 3D verification viewer is good enough to catch geometry mistakes before broader rollout
- plan output is genuinely derived from that 3D assembly
- quantities come from the same geometry truth
- draft state can be saved and recovered without blocking on heavy artifact work
- unsupported cases fail clearly instead of degrading silently
- the workbench replaces Rhino and manual plan work for a meaningful share of standard jobs

V1 is not done merely because the SVG plan workflow feels more polished.

## Final Intent

This workbench is the shared geometry and drawing engine for Sanctuary.

It should:

- open on estimate-backed active designs while preserving estimate-backed design-request workflow records
- normalize geometry inputs from estimate and calculator state
- generate validated structural 3D geometry as the single source of truth
- verify that geometry in a hidden internal 3D viewer
- derive `Model Space` and `Sheet View` outputs from the same assembly
- preserve local-first editing with server-authoritative convergence
- become the internal production tool first
- later support sales and marketing through different skins on the same core
