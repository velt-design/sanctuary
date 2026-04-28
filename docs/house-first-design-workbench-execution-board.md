# Object-First Design Workbench Execution Board

Date: 2026-04-28
Status: Draft
Depends on:

- [`docs/house-first-design-workbench-implementation-plan.md`](./house-first-design-workbench-implementation-plan.md)

## Purpose

Convert the canonical object-first workbench direction into a tight first-pass delivery sequence.

This board is for:

- PR-sized delivery slices
- explicit dependency order
- review checkpoints
- scope control for the next serious implementation pass

The implementation plan remains the canonical authority for terminology and architecture. This board is the active build order.

## First-Pass Definition

The next implementation pass should deliver a hidden-route workbench that can:

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

| Phase | Outcome |
| --- | --- |
| P0 | Object-first scope, terminology, and merge/hosting rules are frozen |
| P1 | `HouseAssembly` + `HouseForm` contracts and draft envelope exist |
| P2 | Derived envelope and hosting contracts exist |
| P3 | Shared interaction engine and adapter boundaries exist |
| P4 | Object navigator + inspector rail scaffold exists |
| P5 | Deck interaction work is generalized onto the shared engine |
| P6 | Openings and pergolas reconnect against derived envelope truth |
| P7 | Validation, fixtures, and internal review are strong enough for the next pass |

## P0: Freeze Canonical Direction

### Ticket P0.1: Commit the object-first implementation plan and execution board

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

Suggested PR slice:

- types and contract tests only

Depends on:

- `P0.2`

### Ticket P1.2: Add authored draft envelope contract

Scope:

- define the persisted draft envelope for object-first workbench state
- keep authored object state separate from ephemeral UI state

Acceptance criteria:

- `HouseAssembly` draft location is explicit
- object lists and ids are coherent
- UI-only state is not mixed into persisted authored state

Suggested PR slice:

- types only

Depends on:

- `P1.1`

## P2: Derived Envelope And Hosting Contracts

### Ticket P2.1: Add derived building envelope contract

Scope:

- define `DerivedBuildingEnvelope`
- define wall graph, roof zones, edge semantics, and attachment zone outputs

Acceptance criteria:

- derived outputs are assembly-level
- exact geometry algorithms remain implementation details
- behavioral ownership is explicit

Suggested PR slice:

- types and docs

Depends on:

- `P1.2`

### Ticket P2.2: Add hosted-object resolution rules

Scope:

- define how openings re-resolve against derived walls
- define how pergolas re-resolve against derived edges/zones

Acceptance criteria:

- no canonical contract still assumes source-form-only hosting
- object hosting can respond to form movement and merge changes

Suggested PR slice:

- docs and contract tests

Depends on:

- `P2.1`

### Review Gate P2

Review questions:

- Is the derived envelope clearly distinguished from authored house forms?
- Can openings and pergolas be explained without reference to duplicated module house context?
- Are the contracts explicit enough to support multi-form work without hidden rules?

Proceed only if all three answers are yes.

## P3: Shared Interaction Architecture

### Ticket P3.1: Add interaction engine contract

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

Suggested PR slice:

- types, docs, and small adapter-facing tests

Depends on:

- `P1.2`

### Ticket P3.2: Add object adapter contracts

Scope:

- define adapter boundaries for:
  - house forms
  - decks
  - openings
  - pergolas

Acceptance criteria:

- object-specific behavior is isolated behind adapters
- future object families have a clear extension point

Suggested PR slice:

- types only

Depends on:

- `P3.1`

## P4: Object Navigator And Inspector Rail

### Ticket P4.1: Add family navigator scaffold

Scope:

- add left-rail family navigation for:
  - `House Forms`
  - `Decks`
  - `Openings`
  - `Pergolas`

Acceptance criteria:

- the primary rail structure reflects object-first navigation
- the active family is explicit in shared UI state

Suggested PR slice:

- shell and state only

Depends on:

- `P1.2`

### Ticket P4.2: Add per-family object list and selected-object inspector scaffold

Scope:

- define the inspector ownership model
- define selected-object state and switching behavior

Acceptance criteria:

- selecting an object swaps the inspector controls for that object type
- the rail no longer depends on house/pergolas as the primary user-facing grouping

Suggested PR slice:

- shell and contract tests only

Depends on:

- `P4.1`

## P5: Generalize Deck Interaction Work

### Ticket P5.1: Move deck movement and snapping onto the shared interaction engine

Scope:

- treat current deck interaction behavior as the first adapter-backed implementation
- move reusable pieces out of deck-only viewport logic where practical

Acceptance criteria:

- deck selection, drag, snap, preview, and dimensions read as shared interaction primitives
- deck logic is no longer the implicit final architecture

Suggested PR slice:

- one adapter plus the minimum extraction needed for reuse

Depends on:

- `P3.2`
- `P4.2`

### Ticket P5.2: Preserve current deck UX while changing the architecture

Scope:

- keep current snapping and movement behavior intact
- avoid regressions in the existing deck interaction suite

Acceptance criteria:

- current deck interaction tests still pass
- interaction extraction does not reduce existing deck polish

Suggested PR slice:

- tests and adapter-backed wiring

Depends on:

- `P5.1`

## P6: Reconnect Openings And Pergolas

### Ticket P6.1: Reconnect openings against derived walls

Scope:

- make opening hosting and movement consume derived wall truth
- align opening inspector behavior with object-first rail state

Acceptance criteria:

- openings remain coherent when forms move or merge
- opening edits do not assume a single shared-house source object

Suggested PR slice:

- one object family at a time

Depends on:

- `P2.2`
- `P3.2`

### Ticket P6.2: Reconnect pergolas against derived edges and zones

Scope:

- make pergola attachment consume derived edge and zone truth
- retire the old per-module house-copy assumption from the canonical path

Acceptance criteria:

- pergolas attach to derived building behavior
- pergola editing no longer relies on the old duplicated house context as the primary architecture

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

Scope:

- add fixture coverage for:
  - multiple house forms
  - touching/overlapping forms
  - derived hosting updates
  - deck regression coverage after interaction extraction

Acceptance criteria:

- internal QA can exercise the new canonical object model through fixtures
- multi-form derived behavior is covered by tests, not only by docs

Suggested PR slice:

- fixtures and tests

Depends on:

- `P6.2`

### Ticket P7.2: Internal review cleanup

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
