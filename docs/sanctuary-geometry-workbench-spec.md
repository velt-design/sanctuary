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
- how delivery should be phased

This document owns:

- product definition
- V1 scope and non-goals
- route strategy and rollout posture
- workflow entry and canonical ownership

The lower-level docs remain authoritative for implementation detail in their areas:

- `docs/drawing-workbench-spec.md` for workbench architecture
- `docs/drawing-workbench-execution-board.md` for implementation sequencing
- `docs/design-packages-spec.md` for estimate-backed design-request workflow
- `docs/portal-local-first-spec.md` for portal sync and authority rules

If a lower-level doc is interpreted in a way that conflicts with this document on V1 product scope or rollout posture, this document wins until it is explicitly revised.

## Blunt Product Definition

We are not building a standalone website configurator first.

We are building a shared parametric geometry workbench for Sanctuary Pergolas that:

- starts from an estimate-backed design request
- edits in `Model Space`
- previews in `Sheet View`
- uses one shared configuration and geometry pipeline
- saves as a local-first draft with server-authoritative convergence
- eventually powers internal ops, onsite sales, and marketing through different skins

The internal portal workbench ships first.

## Locked Direction

These decisions are already established by the repo and should not be re-litigated during V1.

### 1. One shared geometry pipeline

The same underlying configuration and geometry must power:

- `Model Space`
- `Sheet View`
- later sales and marketing skins

Do not fork viewport geometry and sheet geometry into separate systems.

### 2. `Model Space` is the editor

- Direct manipulation belongs in `Model Space`.
- The rail and viewport edit the same underlying configuration state.
- `Sheet View` is not the main editing engine.

### 3. `Sheet View` is document-first

- `Sheet View` is for review, composition, and printable output.
- It can support light interaction where low-risk.
- It should not become the long-term editing surface.

### 4. The rail is a curated subset

The rail covers the common editing path only:

- geometry
- roof
- house/context
- supports
- view controls

Do not clone the full calculator into the rail.

### 5. Edits remain live draft edits

Workbench edits are live draft edits, not a staged apply flow.

### 6. Delivery order is fixed

Ship in this order:

1. `Plan`
2. `Section`
3. `Elevation`
4. `Details`

### 7. The first generated detail family is fixed

The first detail proof-of-concept is:

- house connection / soffit attachment

### 8. Design work is estimate-backed

Design requests must be explicit and tied to a real `estimate_id`.

- initial request is estimate-backed
- revisions are new estimate-backed requests
- canonical source is `design_package_requests`

### 9. The portal is local-first for routine edits

- browser-owned working copies and queued edits should make routine work feel instant
- server-owned records remain authoritative for persisted business truth
- heavy artifact generation should happen after durable business writes, not on the visible save path

## Recommended V1 Implementation

These are recommended V1 directions that are now adopted for this build. They were not all previously repo-locked, but they should be treated as fixed for V1 unless this document is revised.

### 1. Ship a dedicated internal workbench route first

Use a real portal route such as:

- `/staff/projects/[projectId]/design-workbench`

Optional later addressing:

- `/staff/projects/[projectId]/design-workbench?estimateId=...&requestId=...`

This route should be:

- internal only
- staff-auth gated
- feature-flag gated
- hidden until the production-readiness review passes
- available by direct URL only for approved internal testers during the hidden-route phase
- connected to real `project`, `estimate`, and `design_package_request` records
- capable of loading fixture/demo data inside the real route for fast iteration

Do not add this route to normal sidebar navigation or expose it as a default project-page action before production readiness.

### 2. Keep the project page as launcher and summary first

During the hidden-route phase, the project page should not become the editor and should not expose the workbench by default.

After the production-readiness review passes, the project page may show:

- open workbench action
- active design request status
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

### 4. Add a portable geometry kernel

Recommended shared package:

- `packages/geometry/`

The portal should use it first, then sales and marketing can reuse it later.

## Product Goal

Reduce design-package turnaround time for standard pergolas by replacing a large portion of the Rhino to plan to quote-preparation path with a deterministic shared geometry system that can drive:

- live configuration
- plan output
- sheet preview
- quantity extraction
- later section, elevation, and detail outputs

## Success Definition

For standard pergolas, staff should be able to:

- start from an estimate-backed design request
- configure a pergola in a live editing surface
- generate a usable plan view and sheet preview from the same state
- persist the design as part of the estimate draft flow
- reuse the same geometry for quantities and future drawing outputs

## Non-goals

Do not use V1 to:

- build a freeform modelling system
- replace Rhino for irregular edge-case jobs
- chase photoreal rendering
- make `Sheet View` the main editing surface
- fork into separate configurator and sheet geometry stacks
- rewrite the full calculator before workbench value ships
- make quote sending, payment state, or other lock-sensitive workflows browser-authoritative

## Users

### Primary user: internal design and quoting staff

Needs:

- faster standard-job design creation
- live editing
- reliable plan output
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

### 1. One shared geometry pipeline

Configuration, assembly, plan, sheet, and later detail generation all derive from the same source state.

### 2. `Model Space` is the editing surface

Direct manipulation belongs there. `Sheet View` is review and composition.

### 3. Estimate-backed workflow

All new design work starts from an estimate-backed request, and revisions remain tied to estimate snapshots.

### 4. Portal-first drafts, server-authoritative records

Fast editing is local-first. Persisted estimate rows, design workflow state, quote artifacts, stage changes, auth, and other final business records remain server-owned.

### 5. Durable write before heavy artifact generation

Persist the business entity first. Generate heavy outputs in the background after that.

### 6. Plan first

Plan output is the first useful production surface and the first quality bar.

## Product Scope

### V1 in scope

- workbench shell
- shared workbench state
- parametric assembly model for common pergola families
- plan `Model Space`
- plan `Sheet View`
- annotation engine for plan
- estimate-backed save flow
- design-request integration
- basic quantity extraction hooks

### V1 out of scope

- section production output
- elevation production output
- generated detail output
- the sales skin
- the marketing skin
- high-fidelity visualization
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
- active request
- last updated
- preview

The workbench remains the editor.

## Core Workflow

### Entry points

#### A. From calculator estimate generation

After estimate creation succeeds, the user may optionally request a design package.

#### B. From the project estimates tab

A selected estimate can be used to create a design request.

### Core flow

1. User creates or selects an estimate.
2. User requests design.
3. System creates or selects the active `design_package_request`.
4. Workbench opens against:
   - `project_id`
   - `estimate_id`
   - active request version
5. User edits pergola and context in `Model Space` and the rail.
6. Draft is saved locally immediately and queued for sync.
7. Plan `Sheet View` is generated from the same source state.
8. Quantity hooks are derived from geometry and can feed costing and quote preparation.
9. Heavy artifacts are generated after durable save, not before preview or open.

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

Recommended persistence layer above current estimate drawing draft helpers. This is not a new workflow record. It is persisted editable geometry and config state associated with the estimate and request.

### `GeometryConfig`

Recommended editable source of truth for the workbench.

```ts
type GeometryConfig = {
  projectId: string
  estimateId: string
  designRequestId: string

  pergolaType: "mono" | "gable" | "box"

  widthMm: number
  projectionMm: number
  roofPitchDeg?: number

  roof: {
    material: "acrylic" | "insulated" | "timber" | "louvre"
    mode?: string
  }

  connection: {
    type: "fascia" | "soffit" | "wall" | "freestanding"
    attachmentSide?: "left" | "right" | "rear" | "front"
  }

  supports: {
    postMode: "standard" | "custom"
    postPositions?: Array<{ x: number; y: number }>
  }

  houseContext: {
    wallLine?: Line2
    fasciaLine?: Line2
    soffitDepthMm?: number
    roofEdgeLine?: Line2
    footprint?: Polygon2
  }

  viewState: {
    activeView: "plan"
    viewportMode: "model" | "sheet"
  }
}
```

## Architecture

Keep the existing architecture intact:

1. configuration state
2. assembly model
3. view builders
4. annotation engine
5. presentation surfaces

### 1. Configuration state

Shared by the rail and active viewport. It contains:

- persisted draft values
- temporary UI state such as hover, drag, selection, zoom, and popovers

### 2. Assembly model

Canonical semantic representation of the pergola and house context, not final SVG.

It should include:

- outline
- roof form
- attachment edge
- house context
- posts
- beams
- rafters
- gutters
- support conditions
- fall vector
- connection semantics for later details

Recommended output shape:

```ts
type AssemblyModel = {
  outline: Polygon2
  roofForm: RoofForm
  attachmentEdge: EdgeRef | null
  houseContext: HouseContextModel
  posts: PostMember[]
  beams: BeamMember[]
  rafters: RafterMember[]
  gutters: GutterMember[]
  supports: SupportCondition[]
  fall: FallModel
  semantics: {
    connectionType: string
    roofType: string
    structuralZones: string[]
  }
}
```

### 3. View builders

Pure derivation from assembly model to view-specific output.

Required builders:

- `buildPlanViewModel`
- `buildSectionViewModel`
- `buildElevationViewModel`
- later `buildDetailViewModel`

V1 only needs `buildPlanViewModel`, but the assembly model should stay future-safe for the others.

### 4. Annotation engine

Separate placement step that resolves annotation intents into readable annotations with viewport-aware rules.

This is where upside-down text, `FALL`, and `c/c` issues are solved structurally rather than cosmetically.

### 5. Presentation surfaces

Required surfaces:

- `DrawingWorkbench`
- `ModelSpaceViewport`
- `SheetViewport`
- `SheetComposer`
- renderers such as `PlanRenderer`, then later section and elevation renderers

## UI Surface Spec

### `Model Space`

Primary editing surface. It should support:

- clean drawing background
- pan and zoom
- direct manipulation
- immediate visual feedback
- minimal document-style chrome

Recommended V1 interactions:

- drag the house attachment line
- drag width and projection handles
- switch pergola type
- change roof or material mode
- add or move posts in constrained ways
- rotate or fit view
- select members for contextual controls

### `Sheet View`

Document-first preview surface. It should support:

- title block
- legend
- note and metadata area
- scale-aware composition
- lower-interaction review behavior

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

## Annotation Rules

These rules are locked and should carry through implementation:

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

- local working copy keyed by `designRequestId` or `estimateId`
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

- live `Model Space` plan view
- `Sheet View` plan preview
- persisted drawing draft
- geometry-derived quantity hooks
- estimate-backed design revision traceability

### V2 outputs

- section view
- elevation view
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

This document sets product direction only. For ticket-level sequencing and review gates, use `docs/sanctuary-geometry-workbench-execution-plan.md` and `docs/drawing-workbench-execution-board.md`.

The intended delivery shape is:

1. Hidden route and real workflow entry:
   - establish `/staff/projects/[projectId]/design-workbench`
   - keep it behind staff auth and feature flag
   - attach it to real `project`, `estimate`, and `design_package_request` records
2. Shared geometry kernel:
   - create the reusable parametric core for `mono`, `gable`, and `box`
   - keep it UI-agnostic and future-safe for later views
3. `Model Space` and rail:
   - make `Model Space` the real editing surface
   - keep the rail constrained to common edits
4. Plan pipeline and `Sheet View`:
   - generate plan output for both surfaces from one shared pipeline
   - fix annotation behavior structurally, not cosmetically
5. Persistence and workflow integration:
   - add local-first draft persistence with server-authoritative convergence
   - integrate back into project and estimate workflow without turning the project page into the editor
6. Production readiness review:
   - keep the route hidden until standard jobs can be completed reliably
   - then decide whether to widen access

## Technical Constraints

### Shared package rule

The geometry kernel must live in a shared package, not page components.

### No split-geometry rule

Do not build one geometry system for the viewport and another for sheets.

### No fake lab model

Do not build a dead-end lab disconnected from real entities. Use real `project`, `estimate`, and `design_package_request` records from the start, with fixture mode only as a convenience.

## Hardening Note

The workbench can move forward while hardening continues, but it should not become deeply embedded in the core ops path until:

- staff auth boundaries are clearly enforced server-side
- broad development-only data grants are tightened
- the route is safe to expose inside the real internal portal

## Definition Of Done For V1

V1 is done when:

- a staff user can open a real project-linked design request in a dedicated workbench route
- edit a standard pergola in `Model Space`
- use a constrained rail for common edits
- generate a usable plan sheet preview from the same geometry state
- save without blocking on heavy artifact work
- reopen and recover draft state
- flow back to the project page cleanly
- replace Rhino and manual plan work for a meaningful share of standard jobs

## Final Intent

This workbench is the shared geometry and drawing engine for Sanctuary.

It should:

- start from estimate-backed design requests
- edit in `Model Space`
- review in `Sheet View`
- run on one shared geometry pipeline
- preserve local-first editing with server-authoritative convergence
- become the internal production tool first
- later support sales and marketing through different skins on the same core
