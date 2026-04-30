# Object-First Design Workbench Execution Board

Date: 2026-04-28
Status: Draft
Depends on:

- [`docs/house-first-design-workbench-implementation-plan.md`](./house-first-design-workbench-implementation-plan.md)

## Current Implementation Status

This section describes current repo state only. It does not change the canonical target architecture defined by the active April workbench docs.

- A hidden, staff-only, feature-flagged design workbench route already exists in the portal.
- `Model Space`, `Sheet View`, and 3D review are already available there for internal use and QA.
- Local working-copy draft behavior already exists for workbench edits on that hidden route.
- Object-first contracts, draft normalizers, and derived hosting resolvers already exist for the future `HouseAssembly` / `HouseForm` model and authored decks, openings, and pergolas.
- The store now exposes an object-first `WorkbenchProjectModel`, using `EstimateDrawingDraft.objectFirst` when present and deriving a compatibility projection for older geometry paths.
- Object-family rail navigation and selected-object inspector scaffolding already exist on the hidden route.
- The compatibility House Forms inspector now treats all existing footprint presets and flat, mono, gable, and hipped house roof forms as live hidden-route editing controls.
- Shared interaction state helpers exist, and deck plus opening interaction work has started moving toward adapter-backed behavior.
- Geometry, plan overlay, and some editor helpers still consume a derived compatibility `houseFirst` projection rather than a true multi-form `HouseAssembly` runtime source of truth.
- The current hidden-route workbench is a bridge implementation and validation surface, not the canonical end-state described by this execution board.

## Current Bridge Boundary

Object-first code contracts are canonical for new work, hidden-route authored edits persist through the `objectFirst` draft envelope, and `drawingWorkbenchStore` exposes an object-first project model. Geometry, plan-overlay, and some editor paths still use a derived compatibility projection. This board tracks both landed bridge pieces and the remaining migration path to true object-first runtime state.

## Purpose

Convert the canonical object-first workbench direction into a tight next serious implementation pass on top of the existing hidden compatibility workbench.

This board is for:

- PR-sized delivery slices
- explicit dependency order
- review checkpoints
- scope control for the next serious implementation pass

The implementation plan remains the canonical authority for terminology and architecture. This board is the active build order.

## Status Legend

- `Done`: landed for the current docs or bridge layer.
- `Partial`: meaningful bridge implementation exists, but the canonical runtime target is not complete.
- `Next`: highest-priority implementation work.
- `Blocked/Deferred`: should wait for prerequisite contracts, runtime migration, or validation.

## First-Pass Definition

The next implementation pass should advance the existing hidden-route workbench so it can:

1. load a `HouseAssembly` plus authored `Deck`, `Opening`, and `Pergola` objects
2. author multiple movable `HouseForm`s inside the same assembly
3. derive one behavioral building envelope when forms touch or overlap
4. let the left rail navigate `House Forms`, `Decks`, `Openings`, and `Pergolas`
5. show the selected-object inspector for the active object
6. reuse one interaction architecture for dragging, snapping, preview, and dimensions
7. keep deck movement and snapping as the first adapter implementation of that shared interaction system
8. host openings on derived walls and attach pergolas to derived envelope edges and zones
9. keep the route hidden and feature-flagged while internal QA hardens it

## Explicitly Deferred From This Pass

The following can remain later unless required by the core object-first flow:

- public or normal-route exposure
- full production rollout
- full freeform architectural CAD behavior
- finalized roof-merge algorithms for every irregular edge case
- interior modelling
- deep section/elevation parity for every new multi-form behavior
- full deletion of legacy compatibility paths before replacement is proven

## Delivery Rules

### 1. Multi-form contracts before rail polish

Do not build the new navigator/inspector shell on top of the old one-shared-house data shape.

### 2. Shared interaction architecture before repeated object hacks

Do not continue landing future object manipulation directly into viewport code if the behavior is intended to be reused.

### 3. Derived envelope before hosted-object reconnection

Do not reconnect openings or pergolas before the docs and contracts clearly define derived walls, derived edges, and derived attachment zones.

### 4. Small PRs only

Each ticket should still be a narrow, reviewable slice:

- one contract
- one adapter
- one state/model change
- one rail slice
- one derived behavior family
- one validation set

## Phase Overview

| Phase | Status | Outcome |
| --- | --- | --- |
| P0 | Done | Object-first scope, terminology, and merge/hosting rules are frozen in the active docs |
| P1 | Partial | `HouseAssembly` + `HouseForm` contracts, draft envelope, and shadow runtime exist, but persistence/source-of-truth wiring remains deferred |
| P2 | Done | Derived envelope and hosted-object resolution contracts are explicit in code, tests, and docs |
| P3 | Partial | Shared interaction state exists, with deck/opening adapter work started but not complete for all object families |
| P4 | Partial | Object navigator + inspector rail scaffold exists, still backed by compatibility `houseFirst` data |
| P5 | Partial | Deck interaction work is adapter-backed enough to validate the pattern, but remains an active stabilization lane |
| P6 | Partial | Opening and pergola host resolution now use object-first derived contracts; full runtime/persistence migration remains deferred |
| P7 | Partial | Object-first fixture and regression coverage is landing; internal review cleanup remains next |

## P0: Freeze Canonical Direction

### Ticket P0.1: Commit the object-first implementation plan and execution board

Status: Done.

Scope:

- replace the old active workbench direction
- define the new authoritative vocabulary
- define authored-vs-derived truth

Acceptance criteria:

- active docs describe `HouseAssembly` and `HouseForm` as canonical
- active docs describe object-first navigation as canonical
- active docs define merge and hosting rules explicitly

Suggested PR slice:

- docs only

### Ticket P0.2: Freeze merge and hosting rules

Status: Done in docs.

Scope:

- define when forms merge behaviorally
- define where roof intent lives
- define opening hosting
- define pergola attachment ownership

Acceptance criteria:

- touching or overlapping forms always merge behaviorally
- roof intent is per form, derived roof behavior is assembly-level
- openings host to derived walls
- pergolas attach to derived edges/zones

Suggested PR slice:

- docs only

Depends on:

- `P0.1`

### Review Gate P0

Review questions:

- Is one-shared-house fully retired as the canonical workbench model?
- Is object-first navigation clearly the primary UX model?
- Are merge and hosting rules explicit enough that implementers do not need to improvise?

Proceed only if all three answers are yes.

## P1: Multi-Form Authoring Contracts

### Ticket P1.1: Add `HouseAssembly` and `HouseForm` contracts

Status: Partial / mostly landed.

Scope:

- add initial TS contracts for:
  - `WorkbenchProjectModel`
  - `HouseAssembly`
  - `HouseForm`
  - authored `Deck`
  - authored `Opening`
  - authored `Pergola`

Acceptance criteria:

- multiple house forms are supported in the contract
- stable ids are explicit
- per-form roof intent is explicit
- runtime use of these contracts remains deferred until the compatibility store boundary is crossed

Suggested PR slice:

- types and contract tests only

Depends on:

- `P0.2`

### Ticket P1.2: Add authored draft envelope contract

Status: Partial / mostly landed.

Scope:

- define the persisted draft envelope for object-first workbench state
- keep authored object state separate from ephemeral UI state

Acceptance criteria:

- `HouseAssembly` draft location is explicit
- object lists and ids are coherent
- UI-only state is not mixed into persisted authored state
- live hidden-route persistence uses `EstimateDrawingDraft.objectFirst`, while legacy `houseFirst` fallback loading remains for compatibility

Suggested PR slice:

- types only

Depends on:

- `P1.1`

## P2: Derived Envelope And Hosting Contracts

### Ticket P2.1: Add derived building envelope contract

Status: Done.

Scope:

- define `DerivedBuildingEnvelope`
- define wall graph, roof zones, edge semantics, and attachment zone outputs

Acceptance criteria:

- derived outputs are assembly-level
- exact geometry algorithms remain implementation details
- behavioral ownership is explicit

Suggested PR slice:

- types, docs, and contract tests

Depends on:

- `P1.2`

### Ticket P2.2: Add hosted-object resolution rules

Status: Done.

Scope:

- define how openings re-resolve against derived walls
- define how pergolas re-resolve against derived edges/zones

Acceptance criteria:

- no canonical contract still assumes source-form-only hosting
- object hosting can respond to form movement and merge changes

Suggested PR slice:

- docs, resolver contracts, and contract tests

Depends on:

- `P2.1`

### Review Gate P2

Status: Done for the contract slice. Runtime reconnection remains tracked in `P6`.

Review questions:

- Is the derived envelope clearly distinguished from authored house forms?
- Can openings and pergolas be explained without reference to duplicated module house context?
- Are the contracts explicit enough to support multi-form work without hidden rules?

Proceed only if all three answers are yes.

## P3: Shared Interaction Architecture

### Ticket P3.1: Add interaction engine contract

Status: Partial.

Scope:

- define shared responsibilities for:
  - selection
  - hover
  - drag lifecycle
  - snap resolution
  - preview state
  - dimension activation and commit
  - commit/cancel orchestration

Acceptance criteria:

- interaction responsibilities are explicit
- the engine is UI-facing but object-agnostic
- current shared state helpers are kept, but broader snap/dimension/commit orchestration still needs adapter hardening

Suggested PR slice:

- types, docs, and small adapter-facing tests

Depends on:

- `P1.2`

### Ticket P3.2: Add object adapter contracts

Status: Partial.

Scope:

- define adapter boundaries for:
  - house forms
  - decks
  - openings
  - pergolas

Acceptance criteria:

- object-specific behavior is isolated behind adapters
- future object families have a clear extension point
- deck and opening adapter work exists; house-form and pergola adapter boundaries remain incomplete

Suggested PR slice:

- types only

Depends on:

- `P3.1`

## P4: Object Navigator And Inspector Rail

### Ticket P4.1: Add family navigator scaffold

Status: Partial.

Scope:

- add left-rail family navigation for:
  - `House Forms`
  - `Decks`
  - `Openings`
  - `Pergolas`

Acceptance criteria:

- the primary rail structure reflects object-first navigation
- the active family is explicit in shared UI state
- the scaffold may continue consuming compatibility data until object-first runtime state is wired

Suggested PR slice:

- shell and state only

Depends on:

- `P1.2`

### Ticket P4.2: Add per-family object list and selected-object inspector scaffold

Status: Partial.

Scope:

- define the inspector ownership model
- define selected-object state and switching behavior

Acceptance criteria:

- selecting an object swaps the inspector controls for that object type
- the rail no longer depends on house/pergolas as the primary user-facing grouping
- compatibility panels can remain inside the scaffold during the bridge phase

Suggested PR slice:

- shell and contract tests only

Depends on:

- `P4.1`

## P5: Generalize Deck Interaction Work

### Ticket P5.1: Move deck movement and snapping onto the shared interaction engine

Status: Partial.

Scope:

- treat current deck interaction behavior as the first adapter-backed implementation
- move reusable pieces out of deck-only viewport logic where practical

Acceptance criteria:

- deck selection, drag, snap, preview, and dimensions read as shared interaction primitives
- deck logic is no longer the implicit final architecture
- current deck adapter work should be stabilized before repeating the pattern for new object families

Suggested PR slice:

- one adapter plus the minimum extraction needed for reuse

Depends on:

- `P3.2`
- `P4.2`

### Ticket P5.2: Preserve current deck UX while changing the architecture

Status: Partial.

Scope:

- keep current snapping and movement behavior intact
- avoid regressions in the existing deck interaction suite

Acceptance criteria:

- current deck interaction tests still pass
- interaction extraction does not reduce existing deck polish
- snap-preview and commit-settle behavior remain active regression areas

Suggested PR slice:

- tests and adapter-backed wiring

Depends on:

- `P5.1`

## P6: Reconnect Openings And Pergolas

### Ticket P6.1: Reconnect openings against derived walls

Status: Partial / bridge-landed.

Scope:

- make opening hosting and movement consume derived wall truth
- align opening inspector behavior with object-first rail state
- keep plan overlay and geometry compatibility-bound during this slice

Acceptance criteria:

- openings remain coherent when forms move or merge
- opening edits do not assume a single shared-house source object
- object-first opening host resolution is exposed in store state and rail status

Suggested PR slice:

- one object family at a time

Depends on:

- `P2.2`
- `P3.2`

### Ticket P6.2: Reconnect pergolas against derived edges and zones

Status: Partial / bridge-landed.

Scope:

- make pergola attachment consume derived edge and zone truth
- retire the old per-module house-copy assumption from the canonical path
- keep module geometry and plan-overlay paths compatibility-bound during this slice

Acceptance criteria:

- pergolas attach to derived building behavior
- pergola editing no longer relies on the old duplicated house context as the primary architecture
- object-first pergola attachment resolution is exposed in store state and rail status

Suggested PR slice:

- one object family at a time

Depends on:

- `P2.2`
- `P3.2`

### Review Gate P6

Review questions:

- Are decks, openings, and pergolas now clearly using the same interaction architecture?
- Are hosted objects resolved against derived building truth rather than old compatibility assumptions?
- Does the rail present a coherent object-first editing story?

Proceed only if all three answers are yes.

## P7: Validation And Internal Review

### Ticket P7.1: Strengthen fixtures and regression coverage for object-first flows

Status: Partial / bridge-landed.

Scope:

- add fixture coverage for:
  - multiple house forms
  - touching/overlapping forms
  - derived hosting updates
  - deck regression coverage after interaction extraction

Acceptance criteria:

- internal QA can exercise the new canonical object model through fixtures
- multi-form derived behavior is covered by tests, not only by docs
- object-first hosted-object and deck interaction regressions are covered at the bridge boundary

Suggested PR slice:

- fixtures and tests

Depends on:

- `P6.2`

### Ticket P7.2: Internal review cleanup

Status: Next.

Scope:

- remove or mark any remaining active docs or UI language that still imply the old canonical product model

Acceptance criteria:

- no active authority still frames the workbench as one shared house plus pergolas
- no active authority still frames house/pergolas as the primary UX model

Suggested PR slice:

- docs and copy cleanup

Depends on:

- `P7.1`

## Definition Of Done For This Execution Board

The next pass is complete when:

1. the active workbench contracts support `HouseAssembly` plus multiple `HouseForm`s
2. object-first rail navigation and selected-object inspection are the canonical UX shell
3. deck movement and snapping are documented and implemented as the first adapter-backed interaction slice
4. openings and pergolas resolve against derived building truth
5. validation and fixture coverage are strong enough for internal iteration on the hidden route
