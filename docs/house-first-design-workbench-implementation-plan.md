# House-First Design Workbench Implementation Plan

Date: 2026-04-22
Status: Draft
Depends on:

- [`docs/portal-local-first-spec.md`](./portal-local-first-spec.md)

## Purpose

Break the house-first design workbench direction into manageable implementation tasks.

This document is the canonical workbench direction for the current build.

It exists to turn that direction into an execution-ready plan that can guide:

- product scoping
- domain modelling
- workbench state architecture
- geometry-kernel work
- rail and viewport UI work
- validation and test coverage
- phased rollout

The companion execution board translates this plan into the active first-pass delivery sequence:

- [`docs/house-first-design-workbench-execution-board.md`](./house-first-design-workbench-execution-board.md)

This document is the detailed implementation breakdown for the next major evolution:

- house-first modelling
- explicit `house` and `pergolas` workbench modes
- one shared house model
- one unified rail
- one shared geometry pipeline

Older workbench docs are historical context only once retired into superseded stubs. They should not be treated as competing product or sequencing authorities.

## Document Roles

- This document is the canonical direction, terminology, and milestone-level implementation plan.
- `docs/house-first-design-workbench-execution-board.md` is the active first-pass execution board and review-gate sequence.
- Tactical notes such as `docs/model-space-outline-drawing-polish-plan.md` support specific implementation areas inside this direction.

## Outcome We Are Building Toward

The target user flow is:

1. open the internal design workbench
2. start in `House Configurator` mode
3. create or refine house geometry quickly for the common 90 percent of homes
4. switch to `Pergolas` mode
5. add and edit pergolas that attach to the shared house model
6. review the same geometry in model space, 3D, and sheet outputs

The system should treat the house as a first-class shared design entity, not as duplicated context embedded inside each pergola module.

## Locked Architecture

The following architecture rules are part of the active house-first direction and should not be re-litigated during this build.

### 1. Geometry truth first

- `Assembly3D` and the shared geometry kernel remain the canonical runtime geometry truth.
- 2D plan, section, elevation, and sheet outputs must stay derived from that shared geometry truth.
- The house-first state model must feed the geometry pipeline cleanly instead of creating a second SVG-only geometry path.

### 2. One shared geometry pipeline

- House and pergola editing, hidden 3D verification, `Model Space`, and `Sheet View` must read from one shared pipeline.
- Shared house entities and pergola entities may have different roles, but they must still converge into one derived-output path.

### 3. `Model Space` is the primary editing surface

- Direct manipulation belongs in `Model Space`.
- The rail and the active viewport must edit the same underlying workbench state.
- The hidden 3D viewer remains a validation surface, not the primary editor.

### 4. `Sheet View` remains document-first

- `Sheet View` is for review, composition, and printable output.
- It may show the same shared truth, but it should not become the primary editing engine.

### 5. The rail stays curated

- The rail covers the common workbench editing path only.
- It should not become a clone of the full calculator UI.

### 6. Edits remain live draft edits on the hidden route

- Workbench edits remain live draft edits.
- The route stays hidden, staff-only, and feature-flagged until broader rollout criteria are met.

### 7. Editing is object-first, not line-first

- House forms, decks, pergolas, openings, and attachment zones should behave as selectable design objects rather than loose drawing fragments.
- Direct manipulation should prefer semantic object moves, alignments, and attachments over raw line motion.
- Snapping should create or reinforce explicit relationships where appropriate rather than silently producing coincidental geometry.
- Selected objects should reveal both driving dimensions and nearby reference dimensions that can be edited intentionally.

## Terminology

- `WorkbenchProjectModel`: the top-level persisted design model for the hidden workbench, including one shared house plus pergolas and related draft state.
- `HouseModel`: the shared house design entity edited in `house` mode and referenced by all pergolas in the workbench.
- `PergolaModel`: a pergola design entity that attaches to shared house truth rather than owning duplicated house context.
- `Assembly3D`: the canonical derived geometry representation consumed by the hidden 3D viewer and downstream 2D outputs.
- `DesignObject`: a selectable semantic workbench object such as a house footprint, roof zone, deck, opening, pergola, or attachment zone.
- `SnapAnchor`: a point, edge, centerline, or zone on a `DesignObject` that may attract or align other objects during direct manipulation.
- `DrivingDimension`: an editable dimension that changes the selected object's owned shape or size.
- `ReferenceDimension`: an editable dimension that changes the selected object's relationship to nearby objects, such as offsets, setbacks, or centering.
- `PlacementConstraint`: a shallow semantic relationship such as aligned-to-edge, centered-on-span, attached-to-wall, or offset-from-edge.
- `workbenchMode`: the domain editing mode, currently `house` or `pergolas`.
- `viewportMode`: the presentation mode, currently `model`, `sheet`, or `geometry3d`; it is independent from `workbenchMode`.
- `Model Space`: the primary interactive editing surface for direct manipulation and mode-aware tools.
- `Sheet View`: the document-first review and composition surface derived from the same underlying truth.

## Delivery Rules

### 1. Domain truth before UI convenience

Do not build the new mode switch or rail content first if the underlying data model still stores house data inside each pergola.

### 2. Shared house model first

The most important architectural change is introducing one shared house model above pergolas.

### 3. One rail system only

Do not continue growing both `SanctuaryWorkbenchRail` and `ConfiguratorRail` as parallel editors.

### 4. House geometry must stay constrained

This is not a freeform architectural CAD system. Every house feature added to v1 must have:

- a clear semantic role
- clear geometry responsibilities
- clear unsupported cases
- clear validation rules

### 5. Mode rules must be strict

In `house` mode:

- house geometry is editable
- pergola editing is hidden or locked

In `pergolas` mode:

- pergolas are editable
- house editing is hidden or locked

## Milestone Overview

| Milestone | Outcome |
| --- | --- |
| H0 | House-first product and domain model are locked |
| H1 | Shared workbench state supports house + pergolas + explicit modes |
| H2 | Legacy estimate/module inputs can be adapted into the new model safely |
| H3 | Unified rail shell exists and can swap by workbench mode |
| H4 | House configurator foundation works for footprint, attachment, and roof massing |
| H5 | House geometry feature set expands to decks, windows, doors, and sliders |
| H6 | Pergola mode is reconnected on top of shared house truth |
| H7 | Validation, fixtures, and regression coverage are strong enough for internal rollout |
| H8 | Hidden-route rollout, review, and legacy cleanup are complete |

## H0: Canonical Domain Model

### Goal

Define the target domain model and shared terminology before implementation work starts.

### Tasks

1. Write the canonical entity list:
   - `WorkbenchProjectModel`
   - `HouseModel`
   - `HouseLevelModel`
   - `HouseRoofModel`
   - `DeckModel`
   - `WallOpeningModel`
   - `PergolaModel`
   - `PergolaAttachmentModel`
2. Define what belongs to `HouseModel` versus `PergolaModel`.
3. Define which entities are shared across the whole workbench and which are per-pergola.
4. Define stable ids for house parts, deck parts, openings, and pergolas.
5. Define how a pergola references the house:
   - attached wall or edge
   - attachment zone
   - reference level
   - offset and datum rules
6. Define `WorkbenchMode`:
   - `house`
   - `pergolas`
7. Define selection types:
   - house
   - roof
   - wall
   - deck
   - opening
   - pergola
   - pergola member
8. Define the minimum persisted shape of each entity.
9. Define temporary UI-only state separately from persisted draft state.
10. Define how future unsupported or partially supported entities are flagged.
11. Define the first-pass `DesignObject` families and which ones are selectable in each mode.
12. Define the shared interaction vocabulary for:
   - snap anchors and snap targets
   - driving dimensions
   - reference dimensions
   - shallow placement constraints

### Acceptance Criteria

- the shared house model is explicit
- no core house concept is still defined as a pergola-only property
- mode and selection semantics are explicit
- object selection and dimension semantics are explicit
- the same model can drive rail, model space, 3D, and sheet outputs

## H1: House Scope Freeze

### Goal

Freeze the v1 house-configurator feature scope so the implementation stays practical and reliable.

### Tasks

1. List the exact v1 house features to support:
   - footprint
   - wall heights and storey assumptions
   - roof types
   - eaves, fascia, gutter, soffit values
   - decks
   - windows
   - hinged doors
   - glass sliders and stackers
   - attachment zones for pergolas
2. List the exact v1 non-goals:
   - arbitrary wall reshaping beyond supported footprint workflows
   - full room modelling
   - interior modelling
   - bespoke roof intersections outside supported presets and custom outlines
   - structural detailing of every house element
3. Define the supported common-home patterns that v1 must cover.
4. Define the edge cases that will still require manual modelling.
5. Define a review checklist for "does this feature increase the 90 percent coverage materially?"

### Acceptance Criteria

- v1 house scope is explicit
- unsupported cases are explicit
- every feature has a reason to exist
- "odd one out needs manual modelling" remains true

## H2: Workbench State Architecture

### Goal

Refactor the workbench state to support a shared house plus a pergola list, with explicit domain mode and viewport mode.

### Tasks

1. Extend workbench UI state to include:
   - `workbenchMode`
   - `activeHouseSelection`
   - `activePergolaId`
   - per-mode panel state
2. Keep viewport mode separate:
   - `sheet`
   - `model`
   - `geometry3d`
3. Define state transitions when switching between `house` and `pergolas`.
4. Define how selection is normalized when the mode changes.
5. Define when house selections are cleared or preserved.
6. Define when pergola selections are cleared or preserved.
7. Define mode-specific hover and drag behavior.
8. Define how model-space tools are enabled by mode.
9. Define the draft persistence boundary for shared house edits.
10. Define how shared house edits notify pergola previews that depend on them.

### Acceptance Criteria

- `workbenchMode` is first-class
- viewport mode is independent from workbench mode
- shared house state is not duplicated across pergolas
- mode switching rules are predictable

## H3: Data Flow Refactor

### Goal

Move from module-centric workbench data flow to house-first workbench data flow.

### Tasks

1. Introduce a top-level workbench store builder that resolves:
   - shared house
   - pergola list
   - active selection
   - derived view models
2. Define a shared draft format for the new workbench model.
3. Define how existing calculator snapshot data is read into the new structure.
4. Define how pergola-derived house defaults are detected when legacy data has per-module house context.
5. Define precedence rules when multiple legacy pergolas disagree on house context.
6. Define safe failure behavior when legacy modules cannot be reconciled automatically.
7. Define a warning model for migrated-but-ambiguous house data.
8. Define how the 3D preview reads the shared house instead of active pergola-only house context.
9. Define how plan and section builders consume shared house truth.
10. Define how house edits invalidate and rebuild pergola attachments.

### Acceptance Criteria

- workbench derivation begins from a shared house
- pergolas attach to that house
- migration behavior is explicit for ambiguous legacy data
- there is one authoritative source for house context

## H4: Compatibility Layer And Migration Strategy

### Goal

Introduce the new model safely without breaking current estimate-backed flows.

### Tasks

1. Define a `legacy -> house-first` adapter.
2. Define a `house-first -> legacy-compatible` adapter where needed.
3. Define feature flags for hidden-route migration testing.
4. Define which route still uses the legacy rail while the hidden route migrates.
5. Define what must round-trip losslessly in early phases.
6. Define what can be read-only during migration.
7. Define warning banners for partial migration states.
8. Define fixture coverage for single-pergola and multi-pergola migration.
9. Define rollback conditions if migration exposes incorrect house inference.
10. Define internal QA checks to verify migrated geometry visually and semantically.

### Acceptance Criteria

- migration strategy is incremental
- legacy estimates remain usable
- ambiguous legacy data is surfaced clearly
- the hidden route can exercise the new model before wider adoption

## H5: Unified Rail System

### Goal

Replace the two overlapping rail systems with one unified workbench rail shell.

### Tasks

1. Define the unified rail shell responsibilities.
2. Define shared rail primitives:
   - summary card
   - collapsible sections
   - field rows
   - action rows
   - mode banner
3. Define mode-based content swapping:
   - house sections in `house` mode
   - pergola sections in `pergolas` mode
4. Define a single rail field-definition system for both modes.
5. Define where advanced controls still route to the full calculator.
6. Define which controls are intentionally absent from the rail.
7. Define disabled-state behavior when a mode is not editable.
8. Define validation error display rules.
9. Define section ordering for each mode.
10. Define how module/pergola switching appears only in `pergolas` mode.

### Acceptance Criteria

- there is one rail implementation path
- house and pergola modes are visually and behaviorally distinct
- the left column shows only relevant controls for the current mode
- the rail no longer mixes competing domain models

## H6: House Configurator Foundation

### Goal

Build the first practical house configurator that supports fast common-home setup.

### Tasks

1. Define the default starting state for a new house.
2. Define the recommended edit order in the UI:
   - footprint
   - roof form
   - eave and wall settings
   - deck
   - openings
   - attachment zones
3. Define which controls are preset-first and which are direct-edit first.
4. Define the summary card for house mode.
5. Define house mode sections:
   - footprint
   - roof
   - walls and levels
   - decks
   - openings
   - attachment zones
6. Define how unsupported values are blocked or warned.
7. Define the minimum house representation that still feels useful even before all features ship.
8. Define the first-pass object interaction story for house mode:
   - selectable object families
   - what shows on selection
   - which dimensions are editable in viewport versus rail
   - when relationship dimensions appear
9. Define the first-pass object interaction story for pergola mode:
   - selected pergola behavior
   - attachment previews
   - placement and offset editing

### Acceptance Criteria

- house mode has a coherent editing story
- staff can create common house geometry without touching pergola controls
- the edit order matches real design workflow
- selected objects expose useful editing feedback instead of opaque geometry

## H7: House Footprint And Base Massing

### Goal

Make footprint and base massing the strongest part of the house configurator.

### Tasks

1. Keep preset workflows for common house footprints:
   - straight
   - L forms
   - recess forms
   - U forms
   - wrap forms
2. Redesign custom outline drawing as a primary house-mode tool, not a secondary escape hatch.
3. Define snapping and closure behavior for house outline drawing.
4. Define outline editing tools after creation:
   - move vertex
   - move edge
   - add vertex
   - remove vertex
5. Define attachment-edge persistence across outline edits.
6. Define footprint validation:
   - self-intersection checks
   - minimum edge lengths
   - minimum enclosed area
   - clockwise or counter-clockwise normalization
7. Define how footprint edits affect roof and deck regeneration.
8. Define how storey mode and wall heights attach to the footprint shell.
9. Define house-level datum rules:
   - finished floor level
   - deck level
   - exterior ground reference where relevant
10. Define how footprint edits are represented in plan, section, and 3D.

### Acceptance Criteria

- common footprints are fast to create
- custom outline is safe and discoverable
- downstream house features rebuild cleanly after footprint edits

## H8: House Roof Types

### Goal

Support a constrained but useful set of house roof types that help pergola attachment and context modelling.

### Supported V1 Roof Forms To Evaluate

- flat or near-flat
- flat
- mono
- gable
- hipped
- one attached lower appendage / lean-to band only

### Tasks

1. Freeze the exact roof forms that v1 will support.
   This milestone is explicitly limited to `flat`, `mono`, `gable`, `hipped`, and one attached lower appendage / lean-to band.
   Unsupported topology must stay selected and invalid; do not silently downgrade to a simpler roof.
2. Define roof-type selection UI for house mode.
3. Define which roof forms are footprint-wide and which can vary by zone.
4. Define roof datum rules:
   - eave height
   - ridge height
   - pitch
   - overhang
   - fascia and gutter relationship
5. Define roof generation from the house footprint.
6. Define how roof edges map to wall edges.
7. Define how roof features expose pergola-attachment-relevant semantics.
8. Define roof validation:
   - supported topology only
   - no broken roof planes
   - no disconnected eaves
   - no impossible pitch transitions
9. Define how hipped roofs are constrained for v1.
10. Define how appendage roofs or secondary roof bands are represented if included.
11. Define how roof edits affect attachment zones, eave lines, and 3D QA.
12. Define how roof types render differently in plan and 3D without inventing separate truth models.

### Detailed Task Breakdown By Roof Type

#### Flat Or Near-Flat

1. Define allowable pitch range.
2. Define whether "flat" is stored as a named form or as a mono roof with near-zero pitch.
3. Define eave and gutter semantics for flat edges.
4. Define how pergola attachment under flat eaves is validated.
5. Add fixtures for rectangular and L-shaped footprints.

#### Mono-Pitch

1. Define slope direction options.
2. Define which edge is the high edge.
3. Define how ridge-less roof extents are generated.
4. Define how appendages or step-downs are either supported or rejected.
5. Add fixtures for front, rear, left, and right fall directions.

#### Gable

1. Define ridge axis derivation from footprint.
2. Define how gable ends are identified.
3. Define how eave edges are identified.
4. Define how pergola attachment behaves at eave edge versus gable end.
5. Define how non-rectangular footprints downgrade or reject gable generation.
6. Add fixtures for straight, L, and U footprints where supported.

#### Hipped

1. Define the supported footprint shapes for hipped generation.
2. Define the internal topology rules that must hold.
3. Define how valleys and hips are represented semantically.
4. Define what happens when the footprint is not roof-topology-safe.
5. Define when v1 must downgrade to a simpler roof or require manual modelling.
6. Add fixtures specifically to catch invalid hipped topology.

### Acceptance Criteria

- roof types are explicit and limited
- roof generation is stable for supported inputs
- pergola attachment logic can consume roof semantics reliably
- roof invalid states are detected early

## H9: Deck Modelling

### Goal

Model decks as first-class external context because pergolas frequently relate to deck geometry and level.

### Tasks

1. Define whether v1 supports one deck or multiple decks.
2. Define the deck entity model:
   - id
   - outline
   - level
   - relationship to house
   - optional stairs flag if needed later
3. Define deck placement workflows:
   - derive from house edge
   - preset deck off selected side
   - custom outline
4. Define deck outline validation rules.
5. Define deck height semantics:
   - same level as interior floor
   - stepped down
   - custom relative height
6. Define how deck edges interact with pergola support logic.
7. Define deck surface representation in plan.
8. Define deck volume or slab representation in 3D if needed for clarity.
9. Define how decks affect support-condition warnings:
   - deck bracket
   - slab anchors
   - pile assumptions
10. Define whether pergolas can extend beyond deck extents and how that is shown.
11. Define fixtures for:
   - rear deck
   - side deck
   - wrap deck
   - split-level deck where supported

### Acceptance Criteria

- decks are not faked as house footprint variants
- deck level and outline can inform pergola design meaningfully
- supported deck scenarios are explicit

## H10: Windows

### Goal

Represent windows as lightweight but semantically useful wall openings.

### Tasks

1. Define the window entity model:
   - id
   - host wall id
   - opening width
   - sill height
   - head height
   - center or edge offset along wall
   - type
2. Freeze the v1 window types:
   - standard window
   - clerestory if included
   - highlight or narrow window if included
3. Define window placement tools:
   - add on selected wall
   - drag along wall
   - resize width
   - edit sill and head
4. Define how windows are constrained to walls.
5. Define wall-boundary clipping rules.
6. Define overlap prevention with other openings.
7. Define minimum spacing rules from wall corners.
8. Define how windows behave when the host wall length changes.
9. Define how windows behave when footprint topology changes.
10. Define whether windows affect pergola warnings:
    - obstruction
    - attachment conflict
    - access conflict
11. Define plan rendering for windows.
12. Define section and elevation placeholder semantics for windows even if not fully rendered yet.
13. Define fixtures for:
    - one window on a straight wall
    - multiple windows on one wall
    - window near pergola attachment zone
    - footprint edit that shortens a host wall

### Acceptance Criteria

- windows are semantically attached to walls
- window placement remains stable through supported house edits
- opening conflicts are validated clearly

## H11: Hinged Doors

### Goal

Represent pedestrian doors as first-class openings that matter for pergola placement and access.

### Tasks

1. Define the hinged-door entity model.
2. Freeze v1 door types:
   - single door
   - double door if included
3. Define door swing representation policy:
   - semantic only
   - plan arc if needed
4. Define placement tools on selected wall.
5. Define width rules and defaults.
6. Define threshold or sill assumptions if needed for deck relationships.
7. Define collision rules with windows and sliders.
8. Define corner setback rules.
9. Define how doors behave when walls or footprint geometry changes.
10. Define pergola warning rules around door clearance and access obstruction.
11. Define plan rendering and labels for hinged doors.
12. Define fixtures for:
    - single rear entry
    - side door near pergola post zone
    - double door centered on wall

### Acceptance Criteria

- doors are wall-hosted, validated openings
- door placement can feed pergola design warnings
- door behavior remains stable under supported edits

## H12: Glass Sliders And Large Openings

### Goal

Support the most important house opening type for pergola design: large glazing openings and sliders.

### Tasks

1. Define the slider entity model.
2. Freeze v1 slider types:
   - 2-panel slider
   - 3-panel slider
   - 4-panel slider if needed
   - stacking slider if included
   - bi-fold only if truly needed
3. Define what is semantic versus visual only:
   - opening width
   - panel count
   - nominal active panel direction if relevant
4. Define slider placement tools on a wall.
5. Define large-opening width limits by host wall length.
6. Define edge clearance rules to corners.
7. Define overlap rules with other openings.
8. Define how sliders behave when a host wall is edited or shortened.
9. Define how sliders affect pergola design:
   - preferred centering
   - obstruction warnings
   - post placement warnings
   - beam and fascia visual alignment checks
10. Define plan rendering for sliders:
    - opening linework
    - panel cues
    - simplified symbols at small scales
11. Define future-proof section and elevation semantics even if not rendered immediately.
12. Add fixtures for:
    - centered rear slider
    - wide stacker opening
    - slider adjacent to corner
    - slider facing a deck and pergola

### Acceptance Criteria

- sliders are treated as high-value design openings
- large-opening constraints are validated early
- slider context can guide pergola attachment and layout warnings

## H13: Attachment Zones

### Goal

Make pergola attachment possible against the shared house model without relying on hidden assumptions.

### Tasks

1. Define attachment-zone semantics for walls, eaves, fascia, and soffit.
2. Define which house edges can accept pergola attachment.
3. Define how openings reduce or constrain valid attachment spans.
4. Define how decks influence support assumptions at the outer edge.
5. Define zone visualization in house mode.
6. Define zone selection and editing behavior in pergola mode.
7. Define how unsupported attachment requests fail.
8. Define how house edits invalidate and rebuild attachment zones.
9. Define warnings for low confidence or ambiguous attachment geometry.
10. Define how attachment zones become snap targets and offset references for pergola placement.

### Acceptance Criteria

- pergolas attach to explicit zones rather than inferred magic
- openings and roof geometry can constrain attachments correctly
- valid attachment zones can drive visible snapping and placement feedback

## H14: Model Space House Editing

### Goal

Make model space the natural editing surface for house geometry rather than a secondary tool.

### Tasks

1. Define mode-specific hit targets for object selection and editing.
2. Define the first-pass selectable object families in `house` mode:
   - footprint shell
   - roof zones where supported
   - decks
   - openings
3. Define the first-pass selectable object families in `pergolas` mode:
   - pergola body
   - attachment relationship
   - relevant post and edge references where needed
4. Define house-mode tools:
   - outline draw
   - edge drag
   - vertex drag
   - opening placement
   - deck placement
5. Define mode-specific toolbars and prompts.
6. Define which edits are direct-manipulation only versus rail-driven only.
7. Define selected-object affordances in plan view:
   - grab regions
   - handles
   - snap previews
   - attachment previews
8. Define magnetic snapping behavior:
   - snap candidate families
   - preview states
   - snap thresholds
   - snap override behavior
   - which snaps create semantic relationships versus simple alignment
9. Define dimension behavior for selected objects:
   - driving dimensions
   - reference dimensions
   - edit-in-place behavior
   - which dimensions appear by object type
10. Define mode-based visibility rules:
   - pergolas hidden or deemphasized in house mode
   - house remains visible but non-editable in pergola mode
11. Define ghost previews for pending edits.
12. Define cancel, undo, and confirm semantics for house tools.
13. Define keyboard shortcuts for house editing.
14. Define model-space diagnostics for invalid geometry states, failed snaps, and broken relationships.

### Acceptance Criteria

- house editing feels native in model space
- users do not need to leave house mode to complete core geometry work
- visual affordances match the active mode
- selected objects expose usable snap and dimension feedback

## H15: Geometry Kernel And View Builder Integration

### Goal

Update the shared geometry pipeline so the new house-first state drives all derived outputs.

### Tasks

1. Extend geometry contracts to support shared house entities.
2. Define how house footprint, roof, deck, and openings flow into normalized config.
3. Define how pergola solvers consume house attachment zones and shared levels.
4. Define how 3D scene generation represents:
   - house shell
   - roof planes
   - deck surfaces
   - openings
   - pergolas
5. Define how plan builders represent shared house plus active pergola.
6. Define how section builders decide what to cut through.
7. Define how future elevation builders consume opening semantics.
8. Define how view builders suppress or highlight content by workbench mode.
9. Define how document outputs stay derived from the same kernel.

### Acceptance Criteria

- house-first state reaches the geometry kernel cleanly
- house and pergola outputs come from one pipeline
- no secondary SVG-only geometry path is introduced

## H16: Validation And Constraints

### Goal

Add strong guardrails so the house configurator remains trustworthy.

### Tasks

1. Define domain validation categories:
   - footprint
   - roof
   - deck
   - opening placement
   - attachment zones
   - pergola-to-house conflicts
2. Define severity levels:
   - blocking error
   - warning
   - informational note
3. Define opening overlap validation.
4. Define wall-host fit validation for openings.
5. Define roof-topology validation for each supported roof type.
6. Define deck relationship validation.
7. Define attachment-zone validity checks.
8. Define migration ambiguity validation for legacy-derived houses.
9. Define plan-space and 3D-space diagnostics for internal QA.
10. Define how validation messages appear in rail and viewport.

### Acceptance Criteria

- invalid inputs are caught close to the source
- warnings are specific enough to act on
- geometry drift is easier to diagnose

## H17: Fixtures And Test Coverage

### Goal

Build strong coverage before broader internal rollout.

### Tasks

1. Create fixtures for common house-only scenarios.
2. Create fixtures for house-plus-pergola scenarios.
3. Create fixtures specifically for roof-type coverage.
4. Create fixtures specifically for deck relationships.
5. Create fixtures specifically for windows, doors, and sliders.
6. Add adapter tests for legacy migration.
7. Add store tests for mode switching and shared-house editing.
8. Add rail tests for mode-specific control visibility.
9. Add model-space interaction tests for house tools.
10. Add 3D QA tests for roof and attachment topology.
11. Add visual regression fixtures for key house forms.

### Recommended Fixture Matrix

- straight house + rear slider + rear deck
- L-shaped house + side windows + mono roof
- U-shaped house + central outdoor room + pergola
- straight house + hipped roof + large stacker
- straight house + no deck + side door
- multi-pergola house sharing one roof and opening layout

### Acceptance Criteria

- common house forms are covered
- house features survive mode switching and migration
- geometry regressions are caught before staff rollout

## H18: Rollout Phases

### Goal

Roll out the house-first workbench safely and deliberately.

### Phase 1: Docs And Contracts

Tasks:

1. lock domain model
2. lock mode rules
3. lock house scope
4. lock migration strategy

### Phase 2: Hidden Route Foundation

Tasks:

1. introduce house-first store behind feature flags
2. keep old paths intact
3. verify hidden route can load real projects safely

### Phase 3: House Mode v1

Tasks:

1. ship shared house entity
2. ship house rail mode
3. ship footprint and roof massing
4. ship deck and opening basics

### Phase 4: Pergola Mode Reconnection

Tasks:

1. attach pergolas to shared house
2. move pergola editing into unified rail
3. verify attachment and support logic

### Phase 5: Internal QA And Hardening

Tasks:

1. run fixtures against real estimates
2. document unsupported cases
3. fix migration and validation gaps

### Phase 6: Legacy Cleanup

Tasks:

1. retire duplicate rail paths
2. remove module-centric house assumptions where no longer needed
3. update docs to make the shared house model canonical

## Suggested Implementation Order

1. `H0` canonical domain model
2. `H1` scope freeze
3. `H2` workbench state architecture
4. `H3` data flow refactor
5. `H4` compatibility layer
6. `H5` unified rail system
7. `H6-H8` house configurator foundation, footprint, roof types
8. `H9-H12` deck, windows, doors, sliders
9. `H13-H15` attachment zones, model-space editing, kernel integration
10. `H16-H17` validation and test coverage
11. `H18` rollout and cleanup

## Definition Of Done For The House Configurator

The house configurator is ready for broader internal use only when:

1. staff can create a common house model without touching pergola controls
2. the house is stored once and shared by all pergolas in the workbench
3. roof type, deck, and opening data survive save/load and mode switching
4. pergola attachment reads the shared house reliably
5. invalid house geometry and opening conflicts are surfaced clearly
6. fixtures cover the most common real-home scenarios
7. the odd unsupported homes are obvious early and can be routed to manual modelling
