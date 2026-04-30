# Object-First Design Workbench Implementation Plan

Date: 2026-04-28
Status: Draft
Depends on:

- [`docs/portal-local-first-spec.md`](./portal-local-first-spec.md)

## Current Implementation Status

This section describes current repo state only. It does not change the canonical target architecture defined by this document.

- A hidden, staff-only, feature-flagged design workbench route already exists in the portal.
- `Model Space`, `Sheet View`, and 3D review are already present on that hidden route for internal use and QA.
- Local working-copy draft behavior already exists for workbench edits on the hidden route.
- Object-first TypeScript contracts now exist for `WorkbenchProjectModel`, `HouseAssembly`, `HouseForm`, authored decks, openings, pergolas, derived hosting resolvers, and the `ObjectFirstWorkbenchDraftVNext` draft envelope.
- `drawingWorkbenchStore` now exposes an object-first `WorkbenchProjectModel`, using `EstimateDrawingDraft.objectFirst` when present and deriving a compatibility projection for older geometry paths.
- The hidden workbench rail already exposes object-family navigation for `House Forms`, `Decks`, `Openings`, and `Pergolas`, with selected-object inspector scaffolding.
- The compatibility House Forms inspector now supports all existing house footprint presets and live house roof form selection for flat, mono, gable, and hipped roofs; all eight presets are expected to preview without blocking roof topology diagnostics across attachment-side rotations in `Model Space`, `Sheet View`, and 3D.
- Preset footprint transitions preserve the chosen roof form while re-solving stale gable/hipped ridge orientation and filtering open-gable end ids against the rebuilt preset footprint.
- Unsupported custom/non-orthogonal roof topology remains selectable in the hidden route so intent is preserved, but it is blocked with explicit diagnostics instead of approximate fallback geometry.
- Opening host resolution now flows through object-first derived wall contracts in store and rail state, with hidden-route edits persisted to `objectFirst`.
- Pergola attachment resolution now flows through object-first derived edge and zone contracts in store, rail, and inspector option state, with hidden-route edits persisted to `objectFirst`.
- Object-first validation fixtures now cover separate forms, touching/merged forms, stale hosted-object references, and deck interaction regression checks.
- Shared interaction state helpers exist, and deck plus opening work have started moving toward adapter-backed object interaction.
- Geometry, plan overlay, and some editor helpers still consume a derived compatibility `houseFirst` projection rather than a true multi-form `HouseAssembly` runtime source of truth.
- The existing hidden-route workbench is a bridge implementation for internal iteration, not the canonical end-state described by this document.

## Current Bridge Boundary

Object-first code contracts are now the canonical vocabulary for future slices, and hidden-route authored edits persist through the `objectFirst` draft envelope. The live hidden workbench still derives a compatibility `houseFirst` projection for geometry, plan-overlay, and editor paths that have not yet moved to true multi-form runtime state.

## Purpose

Replace the previous single-shared-house workbench direction with a cleaner canonical architecture for the next serious implementation pass.

This document is the active workbench authority for:

- product framing
- domain modelling
- interaction architecture
- geometry-kernel responsibilities
- inspector rail design
- validation and rollout

The companion execution board translates this direction into the active delivery order:

- [`docs/house-first-design-workbench-execution-board.md`](./house-first-design-workbench-execution-board.md)

## Direction Summary

The canonical direction is now:

- object-first workbench navigation and editing
- reusable interaction architecture shared across all object families
- `HouseAssembly` built from multiple movable `HouseForm`s
- authored objects stay separate
- building behavior is derived
- touching or overlapping house forms merge behaviorally into one derived building envelope

The workbench is no longer modeled as one shared house plus pergolas. It is modeled as one project-level object graph whose building behavior is derived from authored forms and attachments.

## Outcome We Are Building Toward

The target user flow is:

1. open the internal design workbench
2. see object families in the left rail: `House Forms`, `Decks`, `Openings`, `Pergolas`
3. select an object family
4. select an individual object inside that family
5. edit that object in `Model Space` using reusable drag, snap, and dimension behavior
6. review the same derived result in 3D and `Sheet View`

The primary user model is object-first, not `house`-first versus `pergolas`-first. Internal compatibility modes may still exist during transition, but they are not the product model this document is optimizing for.

## Locked Architecture

The following rules are canonical for this build and should not be re-litigated during implementation unless the document itself is revised.

### 1. Geometry truth first

- `Assembly3D` and the shared geometry kernel remain the canonical runtime geometry truth.
- 2D plan, section, elevation, and sheet outputs remain derived from that same truth.
- The workbench must not grow a second SVG-only geometry path for convenience.

### 2. Authored truth and derived truth are separate

Authored objects are what the user edits:

- `HouseForm`
- `Deck`
- `Opening`
- `Pergola`

Derived building behavior is computed:

- combined building envelope
- wall graph
- roof zones
- eaves
- gutters
- attachment zones

The user edits authored objects. The system derives building behavior.

### 3. One shared geometry pipeline

- House forms, decks, openings, pergolas, `Model Space`, hidden 3D verification, and `Sheet View` must all read from one shared pipeline.
- Object-family differences may exist at the authored layer, but they must converge into one derived-output path.

### 4. `Model Space` is the primary editing surface

- Direct manipulation belongs in `Model Space`.
- The rail and the active viewport must edit the same underlying workbench state.
- The hidden 3D viewer remains a validation surface, not the primary editor.

### 5. `Sheet View` remains document-first

- `Sheet View` is for review, composition, and printable output.
- It may expose the same derived truth, but it is not the primary editing engine.

### 6. The inspector rail stays curated

- The left rail is an object navigator plus selected-object inspector.
- It should not become a clone of the full calculator UI.
- It should expose the common editing path for the selected object family only.

### 7. Edits remain live local-first draft edits on the hidden route

- Workbench edits remain live draft edits.
- The route stays hidden, staff-only, and feature-flagged until broader rollout criteria are met.
- Local-first working copies remain the persistence model for this phase.

### 8. Editing is object-first, not line-first

- House forms, decks, openings, pergolas, and attachment zones behave as selectable design objects rather than loose drawing fragments.
- Direct manipulation prefers semantic object moves, alignments, attachments, and dimensions over raw line motion.
- Snapping should create or reinforce explicit relationships where appropriate rather than silently producing coincidental geometry.

## Canonical Product Model

### `WorkbenchProjectModel`

Top-level persisted workbench draft containing:

- one `HouseAssembly`
- `Deck[]`
- `Opening[]`
- `Pergola[]`
- related UI-neutral authored draft state

### `HouseAssembly`

The top-level building authoring container.

- Contains one or more `HouseForm`s.
- Owns no freehand geometry of its own.
- Owns the derived building envelope and derived building behavior outputs.

### `HouseForm`

An individually selectable and movable authored building form.

- Has its own identity.
- Has its own footprint intent.
- Has its own transform.
- Has its own roof intent.
- May overlap or touch other forms inside the same assembly.

### `DerivedBuildingEnvelope`

The merged building result derived from the active set of house forms.

- Touching or overlapping forms always merge behaviorally.
- The merged result drives wall hosting, roof behavior, derived edges, eaves, gutters, and pergola attachment zones.
- Derived edges are assembly-level outputs, not authored edges copied from a single form.
- Attachment zones are projected from derived envelope behavior and may reference derived edge and wall outputs together.
- Contract helpers now resolve hosted objects only against the assembly-level derived envelope.
- This document defines the behavioral contract only, not the exact geometry algorithms.

### `Deck`

An authored external object edited independently from house forms.

- May snap against the derived envelope.
- May move freely when detached.
- Uses shared interaction primitives rather than deck-only viewport behavior.

### `Opening`

An authored wall-hosted object.

- Openings host to the derived wall graph, not to a source house form.
- If house forms merge into one building envelope, openings still behave coherently against the derived walls.

### `Pergola`

An authored attached or freestanding object.

- Pergolas attach to derived building edges and derived attachment zones.
- They do not attach to a single source house form as the canonical behavior model.

## Merge Rule

The following merge rule is canonical:

- If two or more `HouseForm`s touch or overlap, the system derives them as one behavioral building envelope.

Implications:

- wall hosting is assembly-level
- roof behavior is assembly-level
- eaves and gutters resolve at assembly-level
- pergola attachment zones resolve at assembly-level

This does not mean authored forms lose identity. Authored forms remain individually selectable, movable, and editable.

## Hosting Rules

### Roofs

- Roof intent lives per `HouseForm`.
- Combined roof behavior is derived at the `HouseAssembly` level when forms touch or overlap.
- This phase defines responsibility boundaries, validation expectations, and ownership. It does not lock specific merge algorithms.

### Openings

- Openings host to the derived wall graph.
- They are not canonically bound to the authored form that first produced a wall segment.
- `sourceFormId` is provenance only; it is not a fallback host.
- Moving or merging house forms may re-resolve opening hosting against the updated derived wall graph.

### Pergolas

- Pergolas attach to the derived envelope.
- Attachment edges and zones are derived after house-form merge behavior resolves.
- Pergola attachment references a derived `edgeId` plus an optional supporting `zoneId`.
- When both are present, the attachment zone must belong to the resolved derived edge.
- Pergolas should not rely on hidden per-module house copies.

## Interaction Architecture

The current deck movement and snapping work must evolve into a reusable interaction system, not remain a deck-only subsystem.

### Shared Interaction Vocabulary

- selection
- hover
- drag lifecycle
- snap anchors
- snap targets
- preview state
- driving dimensions
- reference dimensions
- commit
- cancel
- validation feedback

### `InteractionEngine`

Shared workbench interaction layer responsible for:

- pointer gesture lifecycle
- drag session lifecycle
- snap resolution
- preview state updates
- generic dimension activation and commit flow
- commit/cancel orchestration

### `InteractionAdapter`

One adapter per object family:

- `HouseFormInteractionAdapter`
- `DeckInteractionAdapter`
- `OpeningInteractionAdapter`
- `PergolaInteractionAdapter`

Each adapter defines:

- selectable hit targets
- available drag behaviors
- available snap anchors and targets
- visible dimensions
- commit payloads
- object-specific validation rules

Deck dragging and snapping are the first real implementation of this pattern and should be documented and refactored as such.

## Inspector Rail Architecture

The rail is structured as:

1. object family navigator
2. per-family object list
3. selected-object inspector

Canonical object families for the current phase:

- `House Forms`
- `Decks`
- `Openings`
- `Pergolas`

Selecting an object must swap the inspector controls for that object type. The rail is no longer primarily organized around `house` mode versus `pergolas` mode.

## Delivery Rules

### 1. Domain truth before UI convenience

Do not build a more polished rail or navigator on top of an old single-shared-house mental model.

### 2. Object adapters before one-off interactions

Do not continue growing object-specific editing behavior directly inside viewport code if that behavior is intended to be reused by other object families.

### 3. Multi-form building behavior is canonical

Do not treat overlapping house forms as a visual overlay trick. The derived building envelope must be the architectural source of merged building behavior.

### 4. The rail must reflect the object model

Do not keep mode-first UX as the canonical user-facing organization once object-family navigation becomes the active direction.

### 5. House geometry must stay constrained

This is still not a freeform architectural CAD system. Every new authored object or derived building rule must have:

- a clear semantic role
- clear geometry responsibilities
- clear unsupported cases
- clear validation rules

## Milestone Overview

| Milestone | Outcome |
| --- | --- |
| O0 | Object-first product model and terminology are locked |
| O1 | `HouseAssembly` and `HouseForm` authored contracts are explicit |
| O2 | Derived building envelope and hosting rules are explicit |
| O3 | Shared interaction engine and adapter boundaries are explicit |
| O4 | Object navigator + inspector rail is the canonical UX shell |
| O5 | Deck movement and snapping are generalized onto interaction primitives |
| O6 | Openings and pergolas reconnect against derived envelope truth |
| O7 | Validation, fixtures, and regression coverage are strong enough for internal rollout |

## O0: Canonical Object Model

### Goal

Lock the object-first workbench vocabulary and authored-vs-derived responsibilities before more implementation work lands.

### Acceptance Criteria

- `HouseAssembly` replaces one-shared-house as the canonical top-level building concept
- authored objects and derived building behavior are clearly separated
- merge and hosting rules are explicit
- object-family navigation is the primary UX framing

## O1: Multi-Form Authoring Contracts

### Goal

Define the minimum persisted shape and selection semantics for `HouseAssembly` and `HouseForm`.

### Acceptance Criteria

- a `HouseAssembly` can contain multiple `HouseForm`s
- `HouseForm`s remain individually selectable and movable
- roof intent is defined per form
- form identity is stable under movement and merge resolution

## O2: Derived Building Behavior

### Goal

Define how authored forms become one behavioral building when they touch or overlap.

Current status: derived-envelope and hosted-object resolution contracts are explicit in code, tests, and docs. Exact multi-form geometry algorithms remain deferred.

### Acceptance Criteria

- the merge rule is explicit
- walls, roof behavior, eaves, gutters, and attachment zones are assembly-level derived outputs
- openings and pergolas host against derived building outputs

## O3: Reusable Interaction Architecture

### Goal

Turn direct-manipulation behavior into reusable interaction primitives plus object adapters.

### Acceptance Criteria

- interaction engine responsibilities are explicit
- adapter responsibilities are explicit
- deck movement/snapping is documented as the first adapter implementation, not the final pattern

## O4: Object Navigator And Inspector Rail

### Goal

Replace mode-first framing with object-family navigation plus selected-object inspection.

### Acceptance Criteria

- the rail structure is explicit
- object-family switching and object selection rules are explicit
- selected-object controls are clearly owned by the inspector, not duplicated across unrelated rail surfaces

## O5: Generalize Deck Work

### Goal

Use current deck movement and snapping as the template for reusable object manipulation behavior.

### Acceptance Criteria

- selection, snap, drag preview, and dimension editing are documented as shared primitives
- deck logic is no longer treated as an isolated special-case editing story

## O6: Reconnect Openings And Pergolas

### Goal

Reconnect wall-hosted and attached objects against derived building truth.

Current status: opening host resolution and pergola attachment resolution are partially reconnected through object-first derived contracts in the store and rail. Full hosted-object runtime and persistence migration remain next.

### Acceptance Criteria

- openings behave against derived walls
- pergolas behave against derived edges and zones
- no canonical doc still depends on per-module duplicated house context

## Rollout Expectations

- hidden route only
- staff-only
- feature-flagged
- local-first drafts remain active
- unsupported edge cases may still require manual modelling in this phase

## Definition Of Done For This Direction

This direction is established when:

1. active docs no longer describe one shared house model as the canonical target
2. active docs no longer describe `house` versus `pergolas` as the primary product model
3. the implementation plan and execution board use the same object model and hosting rules
4. current deck work is framed as reusable interaction architecture for future object families
