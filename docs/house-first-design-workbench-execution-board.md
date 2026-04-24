# House-First Design Workbench Execution Board

Date: 2026-04-22
Status: Draft
Depends on:

- [`docs/house-first-design-workbench-implementation-plan.md`](./house-first-design-workbench-implementation-plan.md)

## Purpose

Convert the canonical house-first implementation plan into a tighter first-pass execution board.

This document is for:

- PR-sized delivery slices
- explicit dependency order
- review checkpoints
- scope control for the first implementation pass

The longer implementation plan remains the detailed backlog and source of milestone intent. This board is the active first-pass build order for the current serious implementation pass.

This board implements:

- [`docs/house-first-design-workbench-implementation-plan.md`](./house-first-design-workbench-implementation-plan.md)

It supersedes older workbench execution sequencing. Once the legacy workbench docs are retired into superseded stubs, they remain historical context only and should not be used as active delivery authorities.

## First-Pass Definition

The first implementation pass should deliver a hidden-route workbench that can:

1. load a shared house model plus one or more pergolas
2. switch cleanly between `house` and `pergolas` modes
3. edit the house in a dedicated house-mode rail and model-space flow
4. treat house forms, decks, openings, and pergolas as selectable objects rather than loose drawing fragments
5. show editable driving dimensions and relationship dimensions when a relevant object is selected
6. support magnetic snapping that helps objects align and attach against shared house truth
7. support practical house foundation geometry:
   - footprint
   - roof type and core roof parameters
   - deck outline and level
   - windows
   - hinged doors
   - glass sliders and stackers
8. derive pergola attachment zones from the shared house model
9. reconnect pergola editing on top of the shared house truth
10. keep the route hidden and feature-flagged while internal QA hardens it

The first pass does not need to finish every future refinement. It does need to get the architecture and house-first editing flow right.

## Explicitly Deferred From This First Pass

The following can remain later unless they are required to complete the core house-first flow:

- public or normal-route exposure
- full production rollout
- complex irregular architectural exceptions
- interior room modelling
- advanced opening families beyond the core set
- deep section and elevation parity for every new house feature
- full deletion of all legacy code paths before replacement is proven

## Delivery Rules

### 1. Shared house model before mode polish

Do not build the new left-rail mode switch on top of the old per-pergola house data shape.

### 2. Small PRs only

Each ticket below should be implemented as a narrow, reviewable slice:

- one contract
- one adapter
- one state change
- one rail section
- one geometry family
- one validation set

### 3. Preserve the hidden route

The entire first pass stays on:

- `/staff/projects/[projectId]/design-workbench`

It stays:

- staff-only
- feature-flagged
- intentionally unadvertised

### 4. Validation is part of the build, not cleanup

Do not defer validation and fixtures until the end. Every geometry feature should land with at least basic constraints and tests.

### 5. Replace duplication deliberately

The goal is to converge to one unified rail path. During transition, temporary adapters are acceptable. Long-lived duplicate editing systems are not.

### 6. Snapping must stay semantic and predictable

Magnetic pull is useful only when it is understandable. Snaps should preview clearly, resolve against explicit anchors or zones, and create intentional relationships rather than mysterious geometry jumps.

## Phase Overview

| Phase | Outcome |
| --- | --- |
| P0 | First-pass contracts, scope, and migration rules are frozen |
| P1 | Shared house-first domain and UI-state contracts exist |
| P2 | Legacy-to-house-first adapter and shared store skeleton exist |
| P3 | Unified workbench shell and mode-aware rail scaffold exist |
| P4 | House footprint editing is strong in house mode |
| P5 | House roof modelling works for supported first-pass roof types |
| P6 | Deck modelling works as shared external context |
| P7 | Openings foundation works for windows, doors, and sliders |
| P8 | Attachment zones and pergola-mode reconnection work on shared house truth |
| P9 | Validation, fixtures, internal review, and cleanup are strong enough for the next pass |

## P0: Freeze First-Pass Scope

### Ticket P0.1: Commit the house-first execution board

Scope:

- add this execution board
- define first-pass boundaries
- define dependency order and review gates

Acceptance criteria:

- a first-pass board exists in `docs/`
- phase order is explicit
- first-pass scope and deferrals are explicit

Suggested PR slice:

- docs only

### Ticket P0.2: Freeze first-pass house feature scope

Scope:

- translate the large house backlog into a first-pass subset
- mark required versus optional-first-pass features

Acceptance criteria:

- core first-pass features are explicit
- non-goals are explicit
- "good enough for common homes" is anchored to concrete feature coverage

Suggested PR slice:

- docs only

Depends on:

- `P0.1`

### Ticket P0.3: Freeze migration and ambiguity policy

Scope:

- define how conflicting legacy house values are handled
- define when to auto-merge, warn, or block

Acceptance criteria:

- migration behavior is explicit before implementation starts
- warning cases and block cases are named

Suggested PR slice:

- docs only

Depends on:

- `P0.1`

### Review Gate P0

Review questions:

- Is the first pass narrow enough to build without losing the architectural goal?
- Is shared house truth clearly the prerequisite for every later phase?
- Are migration ambiguity rules defined before code starts?

Proceed only if all three answers are yes.

## P1: Shared House-First Contracts

### Ticket P1.1: Add domain model contracts

Scope:

- add initial TS contracts for:
  - `WorkbenchProjectModel`
  - `HouseModel`
  - `HouseRoofModel`
  - `DeckModel`
  - `WallOpeningModel`
  - `PergolaModel`
  - `PergolaAttachmentModel`

Acceptance criteria:

- house and pergola data are modeled separately
- shared-house relationships are explicit
- ids and references are stable

Suggested PR slice:

- types and contract tests only

Depends on:

- `P0.2`
- `P0.3`

### Ticket P1.2: Add explicit workbench mode contract

Scope:

- add `workbenchMode`
- define selection, object affordance, and mode-specific editability contracts

Acceptance criteria:

- `house` and `pergolas` are first-class modes
- the mode contract is independent from viewport mode
- selected-object semantics are explicit enough to drive snapping and dimensions later

Suggested PR slice:

- UI-state contracts only

Depends on:

- `P1.1`

### Ticket P1.3: Add shared draft envelope contract

Scope:

- define the persisted draft envelope for the house-first workbench
- separate persisted design state from ephemeral UI state

Acceptance criteria:

- shared house data has one draft location
- pergola list and house references are persisted coherently
- UI-only state is not mixed into persisted state

Suggested PR slice:

- types only

Depends on:

- `P1.1`
- `P1.2`

### Ticket P1.4: Add contract fixtures

Scope:

- add minimal fixtures that instantiate the new contracts
- cover single-pergola and multi-pergola shapes

Acceptance criteria:

- new contracts are executable in tests
- fixture shapes are understandable and stable

Suggested PR slice:

- fixtures and tests only

Depends on:

- `P1.3`

### Review Gate P1

Review questions:

- Is the shared house model genuinely separated from pergolas?
- Can the contracts support both rail and geometry-kernel needs?
- Is the draft boundary clear enough for migration work?

Proceed only if the contracts are stable enough to build adapters on top of them.

## P2: Adapter And Store Skeleton

### Ticket P2.1: Add legacy-to-house-first adapter

Scope:

- read existing estimate and module data
- produce the new shared house-first model

Acceptance criteria:

- single-pergola legacy estimates adapt cleanly
- multi-pergola estimates can adapt into one house plus a pergola list
- unresolved ambiguity is surfaced instead of silently discarded

Suggested PR slice:

- adapter only

Depends on:

- `P1.3`
- `P1.4`

### Ticket P2.2: Add migration warning model

Scope:

- implement warning structures for:
  - conflicting house parameters
  - partial migration
  - unsupported legacy combinations

Acceptance criteria:

- ambiguous adaptation emits structured warnings
- warnings can be rendered later without re-deriving logic

Suggested PR slice:

- adapter + tests only

Depends on:

- `P2.1`

### Ticket P2.3: Add shared workbench store skeleton

Scope:

- build a top-level store that resolves:
  - house
  - pergolas
  - active mode
  - active selection
  - derived active item

Acceptance criteria:

- the store no longer assumes `activeModuleIndex` is the only top-level selection concept
- the store can return active house selections and active pergola selections

Suggested PR slice:

- store only

Depends on:

- `P1.2`
- `P2.1`

### Ticket P2.4: Add mode-aware selection normalization

Scope:

- normalize selection when switching modes
- prevent invalid lingering selections
- clear or preserve selected-object dimensions and snap state intentionally

Acceptance criteria:

- house selections do not survive incorrectly into pergola mode
- pergola selections do not break house mode
- stale dimension or snap overlays do not leak across modes

Suggested PR slice:

- store logic only

Depends on:

- `P2.3`

### Ticket P2.5: Add hidden-route diagnostics for migrated state

Scope:

- expose internal debug metadata for:
  - migration warnings
  - house/pergola counts
  - active mode
  - selection type

Acceptance criteria:

- internal testers can verify migration and mode state quickly
- debug info is available without leaking into public UI

Suggested PR slice:

- hidden-route diagnostics only

Depends on:

- `P2.2`
- `P2.4`

### Review Gate P2

Review questions:

- Does the hidden route now have a real shared-house model under the hood?
- Are ambiguous legacy cases visible instead of hidden?
- Is the store safe to build UI on top of?

Proceed only if the answer to all three is yes.

## P3: Unified Shell And Rail Scaffold

### Ticket P3.1: Add workbench mode switch to the hidden route

Scope:

- add a `house` / `pergolas` mode switch
- wire it into shared UI state only

Acceptance criteria:

- mode switching works without changing viewport mode behavior
- the current mode is visible and stable

Suggested PR slice:

- shell UI only

Depends on:

- `P2.4`

### Ticket P3.2: Add unified rail shell

Scope:

- create one shared rail shell
- support mode-specific section rendering

Acceptance criteria:

- one rail implementation path exists for the hidden route
- the shell can render different section sets by mode

Suggested PR slice:

- rail shell only

Depends on:

- `P3.1`

### Ticket P3.3: Add mode-specific visibility and edit locks

Scope:

- hide or lock pergola editing in `house` mode
- hide or lock house editing in `pergolas` mode

Acceptance criteria:

- the left rail no longer mixes both editing domains at once
- mode behavior matches product intent

Suggested PR slice:

- mode gating only

Depends on:

- `P3.2`

### Ticket P3.4: Add temporary legacy rail fallback strategy

Scope:

- keep the old editing path available only where required during transition
- avoid blocking migration while the unified rail fills out

Acceptance criteria:

- fallback behavior is explicit
- hidden-route testing can continue while the unified rail grows

Suggested PR slice:

- integration-only PR

Depends on:

- `P3.2`

### Review Gate P3

Review questions:

- Is the UI now structurally capable of the two-mode workflow?
- Is there one clear rail direction rather than long-term duplication?
- Can the old paths be phased out gradually without blocking progress?

Proceed only if the answer to all three is yes.

## P4: House Footprint Editing

### Ticket P4.1: Add `HouseFootprint` model and validation

Scope:

- formalize house footprint primitives
- add validation for:
  - minimum edge length
  - self-intersection
  - closure
  - area sanity

Acceptance criteria:

- footprint geometry is explicit and validated
- invalid outlines are rejected or warned consistently

Suggested PR slice:

- domain + validation only

Depends on:

- `P1.1`
- `P2.3`

### Ticket P4.2: Add house-mode preset footprint section

Scope:

- implement preset-first house footprint controls in the unified rail

Acceptance criteria:

- common preset shapes can be applied in house mode
- pergola controls remain hidden in this mode

Suggested PR slice:

- one rail section only

Depends on:

- `P3.3`
- `P4.1`

### Ticket P4.3: Promote custom outline to primary house-mode tool

Scope:

- move custom outline flow into house mode as a first-class action
- stop treating it as an indirect fallback

Acceptance criteria:

- staff can start outline drawing directly from house mode
- entry flow no longer depends on first navigating to a pergola-centric context

Suggested PR slice:

- tool entry flow only

Depends on:

- `P4.2`

### Ticket P4.4: Add direct outline editing after creation

Scope:

- support vertex and edge editing for the house outline
- show the selected outline with usable driving and reference dimensions

Acceptance criteria:

- outline edits remain stable after creation
- invalid edits are constrained or rejected
- selected outline edges expose editable dimensions instead of opaque linework

Suggested PR slice:

- direct-manipulation only

Depends on:

- `P4.3`

### Ticket P4.5: Preserve attachment semantics across footprint edits

Scope:

- keep or re-resolve house attachment zones and references after footprint changes

Acceptance criteria:

- downstream pergola references are not silently orphaned
- changed geometry emits understandable warnings where needed

Suggested PR slice:

- store + geometry integration only

Depends on:

- `P4.4`

### Ticket P4.6: Add footprint fixtures and interaction tests

Scope:

- add preset and custom-outline fixtures
- add tests for mode-specific editing behavior

Acceptance criteria:

- common footprint flows are covered in tests
- regressions in house-mode interactions are caught automatically

Suggested PR slice:

- tests only

Depends on:

- `P4.5`

### Review Gate P4

Review questions:

- Can a tester create a realistic house shell without touching pergola mode?
- Is custom outline now a first-class house tool?
- Do footprint edits preserve enough downstream semantics to continue building on them?

Proceed only if the answer to all three is yes.

## P5: House Roof Foundation

### Ticket P5.1: Add `HouseRoofModel` contract and validation boundary

Scope:

- formalize house roof entities and supported form options
- define validation inputs and outputs

Acceptance criteria:

- supported roof forms are explicit
- this roof milestone is locked to `flat`, `mono`, `gable`, `hipped`, plus one appendage band
- unsupported roof topology is blocked and explained rather than downgraded
- the roof model is independent from viewport-specific rendering

Suggested PR slice:

- contracts only

Depends on:

- `P1.1`
- `P4.1`

### Ticket P5.2: Add flat and mono roof generation

Scope:

- implement the simplest supported first-pass roof forms first

Acceptance criteria:

- flat and mono roof forms can be derived from supported footprints
- roof datums are stable

Suggested PR slice:

- one solver family slice

Depends on:

- `P5.1`

### Ticket P5.3: Add gable roof generation

Scope:

- implement supported gable generation rules

Acceptance criteria:

- gable generation is stable for supported footprints
- eave and gable-end semantics are exposed for later attachment logic

Suggested PR slice:

- one solver family slice

Depends on:

- `P5.2`

### Ticket P5.4: Add constrained hipped roof generation

Scope:

- implement only the hipped cases that are reliable enough for the first pass

Acceptance criteria:

- supported hipped cases are explicit
- unsupported topology fails clearly

Suggested PR slice:

- one constrained solver slice

Depends on:

- `P5.3`

### Ticket P5.5: Add house roof editing section in house mode

Scope:

- build the roof section in the unified rail
- expose supported roof controls only

Acceptance criteria:

- house roof editing is available in house mode
- unsupported roof options are not exposed prematurely

Suggested PR slice:

- one rail section only

Depends on:

- `P5.4`

### Ticket P5.6: Add roof fixtures and 3D diagnostics

Scope:

- add fixtures for each supported roof form
- expose internal QA diagnostics for roof validity

Acceptance criteria:

- each supported roof form has fixture coverage
- QA can detect invalid roof topology quickly

Suggested PR slice:

- tests + diagnostics only

Depends on:

- `P5.5`

### Review Gate P5

Review questions:

- Are supported roof forms working reliably enough to attach pergolas against later?
- Are unsupported roof cases clearly rejected instead of half-working?
- Is house roof editing useful without leaking complexity into the rail?

Proceed only if the answer to all three is yes.

## P6: Deck Foundation

### Ticket P6.1: Add `DeckModel` contract

Scope:

- formalize deck outline, host relationship, and level semantics

Acceptance criteria:

- decks are first-class external context entities
- deck state is not faked through house footprint hacks

Suggested PR slice:

- contracts only

Depends on:

- `P1.1`
- `P4.1`

### Ticket P6.2: Add deck section in house mode

Scope:

- add deck create/edit controls to the unified rail
- define deck selection behavior and visible relationship dimensions

Acceptance criteria:

- a tester can create and edit a deck in house mode
- deck controls are absent from pergola mode
- selected decks can expose meaningful offsets to nearby house edges

Suggested PR slice:

- one rail section only

Depends on:

- `P6.1`
- `P3.3`

### Ticket P6.3: Add deck geometry and level behavior

Scope:

- derive deck geometry into plan and 3D contexts
- support basic level relationships
- support object grab, placement, and snapping against shared house geometry

Acceptance criteria:

- deck geometry is visible in plan and 3D
- deck level can inform later support-condition logic
- deck placement can snap and preserve explicit host relationships

Suggested PR slice:

- geometry slice only

Depends on:

- `P6.2`

### Ticket P6.4: Add deck support-condition hooks

Scope:

- connect deck presence to support-condition warnings and assumptions

Acceptance criteria:

- deck bracket and related scenarios can be reasoned about from shared context

Suggested PR slice:

- validation slice only

Depends on:

- `P6.3`

### Ticket P6.5: Add deck fixtures

Scope:

- cover common rear, side, and wrap deck cases

Acceptance criteria:

- supported deck scenarios are captured in fixtures and tests

Suggested PR slice:

- tests only

Depends on:

- `P6.4`

### Review Gate P6

Review questions:

- Is the deck now a meaningful shared context object?
- Can deck state influence later pergola reasoning?
- Is deck editing practical without over-modeling?

Proceed only if the answer to all three is yes.

## P7: Openings Foundation

### Ticket P7.1: Add opening host-wall contract

Scope:

- formalize how windows, doors, and sliders attach to walls

Acceptance criteria:

- openings reference host walls explicitly
- wall-bound placement rules are defined in code, not implied by UI

Suggested PR slice:

- contracts only

Depends on:

- `P1.1`
- `P4.1`

### Ticket P7.2: Add windows foundation

Scope:

- support basic window creation and editing in house mode

Acceptance criteria:

- windows can be placed on valid walls
- windows respect wall bounds and spacing rules

Suggested PR slice:

- one opening family slice

Depends on:

- `P7.1`

### Ticket P7.3: Add hinged-door foundation

Scope:

- support standard hinged door placement and editing

Acceptance criteria:

- doors are host-wall openings
- door placement conflicts are validated

Suggested PR slice:

- one opening family slice

Depends on:

- `P7.2`

### Ticket P7.4: Add slider and stacker foundation

Scope:

- support large glazed openings used heavily in pergola jobs

Acceptance criteria:

- sliders can be placed, sized, and validated
- large-opening constraints are explicit

Suggested PR slice:

- one opening family slice

Depends on:

- `P7.3`

### Ticket P7.5: Add openings section in house mode

Scope:

- expose opening creation and editing controls in the unified rail

Acceptance criteria:

- openings are editable only in house mode
- house mode can manage windows, doors, and sliders coherently

Suggested PR slice:

- one rail section only

Depends on:

- `P7.4`

### Ticket P7.6: Add opening validation and fixtures

Scope:

- add overlap validation
- add wall-fit validation
- add representative fixtures

Acceptance criteria:

- opening conflicts are detected
- representative window, door, and slider scenarios are covered

Suggested PR slice:

- validation + tests only

Depends on:

- `P7.5`

### Review Gate P7

Review questions:

- Are windows, doors, and sliders now part of the shared house model rather than cosmetic marks?
- Are host-wall and overlap rules strong enough for internal use?
- Do large glazed openings now inform later pergola reasoning?

Proceed only if the answer to all three is yes.

## P8: Attachment Zones And Pergola Reconnection

### Ticket P8.1: Add house-derived attachment zones

Scope:

- derive attachment zones from walls, eaves, roof edges, and openings

Acceptance criteria:

- pergola attachment candidates come from explicit house-derived geometry
- openings and roof form can constrain the valid zones

Suggested PR slice:

- geometry + semantics only

Depends on:

- `P5.6`
- `P6.4`
- `P7.6`

### Ticket P8.2: Reconnect pergola mode to shared house truth

Scope:

- make pergola editing consume the shared house model instead of per-module house copies
- resolve pergola placement and attachment against explicit snap targets and attachment zones

Acceptance criteria:

- pergola mode edits against shared house references
- house state is not duplicated back into pergola-local shape
- successful snapping produces intentional attachment relationships rather than loose coordinates

Suggested PR slice:

- integration-only PR

Depends on:

- `P8.1`

### Ticket P8.3: Add pergola-mode rail sections on top of the unified rail

Scope:

- implement pergola-specific sections in the unified rail shell

Acceptance criteria:

- pergola mode has only pergola-relevant controls
- house controls are hidden or locked

Suggested PR slice:

- pergola rail sections only

Depends on:

- `P8.2`

### Ticket P8.4: Add mode-specific model-space gating

Scope:

- house mode edits house geometry only
- pergola mode edits pergolas only

Acceptance criteria:

- model space respects workbench mode consistently
- hit targets and prompts are mode-correct
- selected objects show mode-correct driving and reference dimensions

Suggested PR slice:

- viewport interaction only

Depends on:

- `P8.3`

### Ticket P8.5: Add one-pergola attached happy-path integration test

Scope:

- test the simplest complete flow:
  - build house
  - add roof
  - add deck and openings
  - switch to pergola mode
  - attach pergola

Acceptance criteria:

- one end-to-end house-first happy path is covered automatically

Suggested PR slice:

- integration tests only

Depends on:

- `P8.4`

### Review Gate P8

Review questions:

- Can a tester now complete the intended house-first then pergola-second workflow?
- Are attachment zones explicit and trustworthy enough for internal testing?
- Is mode behavior clean across rail, model space, and 3D?

Proceed only if the answer to all three is yes.

## P9: Hardening, Fixtures, And Cleanup

### Ticket P9.1: Expand fixture matrix for common homes

Scope:

- add broader house and house-plus-pergola fixtures

Acceptance criteria:

- straight, L, U, decked, and large-opening homes are represented

Suggested PR slice:

- fixtures only

Depends on:

- `P8.5`

### Ticket P9.2: Add regression coverage for migration and mode switching

Scope:

- add tests for:
  - migration ambiguity
  - shared house persistence
  - mode switching
  - selection normalization

Acceptance criteria:

- the most fragile architectural transitions are covered

Suggested PR slice:

- tests only

Depends on:

- `P9.1`

### Ticket P9.3: Add hidden-route internal review checklist

Scope:

- create a QA checklist for internal testers
- anchor review against the first-pass goals

Acceptance criteria:

- reviewers have a repeatable checklist
- supported versus unsupported scenarios are explicit

Suggested PR slice:

- docs only

Depends on:

- `P9.2`

### Ticket P9.4: Remove the most dangerous duplicate rail assumptions

Scope:

- remove or isolate overlapping rail logic that would otherwise drift

Acceptance criteria:

- the hidden route has one clear editing path
- dangerous duplication is reduced before the next pass

Suggested PR slice:

- cleanup-only PR

Depends on:

- `P8.3`
- `P9.2`

### Ticket P9.5: Decide next-pass entry criteria

Scope:

- review what remains for:
  - rollout
  - advanced roof cases
  - broader opening families
  - deeper section/elevation integration

Acceptance criteria:

- next-pass work is based on evidence from the first pass
- unresolved architecture debt is named explicitly

Suggested PR slice:

- docs only

Depends on:

- `P9.3`
- `P9.4`

### Review Gate P9

Review questions:

- Is the hidden route now credible for serious internal testing?
- Did the first pass solve the shared-house architecture rather than just add new controls?
- Is the remaining work now refinement rather than foundational correction?

Proceed to the next pass only if the answer to all three is yes.

## Dependency Order

The recommended dependency order for the first implementation pass is:

1. `P0`
2. `P1`
3. `P2`
4. `P3`
5. `P4`
6. `P5`
7. `P6`
8. `P7`
9. `P8`
10. `P9`

Within that sequence:

- `P1.1 -> P1.2 -> P1.3 -> P1.4`
- `P2.1 -> P2.2 -> P2.3 -> P2.4 -> P2.5`
- `P3.1 -> P3.2 -> P3.3`; `P3.4` can land in parallel if needed after `P3.2`
- `P4.1 -> P4.2 -> P4.3 -> P4.4 -> P4.5 -> P4.6`
- `P5.1 -> P5.2 -> P5.3 -> P5.4 -> P5.5 -> P5.6`
- `P6.1 -> P6.2 -> P6.3 -> P6.4 -> P6.5`
- `P7.1 -> P7.2 -> P7.3 -> P7.4 -> P7.5 -> P7.6`
- `P8.1 -> P8.2 -> P8.3 -> P8.4 -> P8.5`
- `P9.1 -> P9.2 -> P9.3`; `P9.4` can start after `P8.3`; `P9.5` is last

## Recommended PR Cadence

Use these heuristics for PR sizing:

- docs and contract PRs: small and review-fast
- adapter and store PRs: one architectural change at a time
- rail PRs: one section or one mode behavior at a time
- geometry PRs: one family or one domain feature at a time
- validation PRs: land close to the feature they validate
- fixture PRs: keep them readable and named after real user scenarios

Avoid PRs that combine:

- new contracts
- migration logic
- rail UI
- geometry generation
- validation

all in the same slice.

## First-Pass Done Definition

The first implementation pass is complete when:

1. the hidden route uses a shared house-first workbench model
2. `house` and `pergolas` modes are explicit and enforce distinct editing behavior
3. the unified rail is the main editing path in the hidden route
4. house mode can handle practical common-home setup:
   - footprint
   - roof
   - deck
   - windows
   - hinged doors
   - sliders
5. pergola mode attaches to the shared house rather than duplicating house context per pergola
6. fixtures and tests cover the core happy paths and migration risks
7. internal reviewers can use the hidden route and clearly identify supported versus unsupported cases
