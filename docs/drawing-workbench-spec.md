# Drawing Workbench Architecture Spec (Superseded Compatibility Reference)

Date: 2026-03-21
Status: Superseded

This March 2026 document is retained as a historical compatibility reference only.

Active workbench authority now lives in:

- [`docs/house-first-design-workbench-implementation-plan.md`](./house-first-design-workbench-implementation-plan.md)
- [`docs/house-first-design-workbench-execution-board.md`](./house-first-design-workbench-execution-board.md)

This page captures the previous single-shared-house / compatibility workbench direction. It is no longer the canonical authority for current planning or implementation.

## Goal

Establish a durable architecture for a portal drawing workbench that can support:

- live plan configuration in the portal
- document-grade sheet preview from the same source state
- future section and elevation views
- future generated connection details

The workbench must support two viewport modes that run from the same configuration and geometry pipeline:

- `Model Space`
- `Sheet View`

## Locked product decisions

### 1. `Model Space` becomes the primary editing surface

- Direct manipulation belongs in `Model Space`.
- The portal rail and the viewport both edit the same underlying configuration state.
- `Model Space` is the long-term home for the real-time configurator feel.

### 2. `Sheet View` remains document-first

- `Sheet View` is primarily for generated drawing review and printable composition.
- Light interaction may exist where low-risk, but the sheet surface should not become the main editing engine.
- The current sheet preview in `apps/portal/components/estimates/EstimateDrawingSheet.tsx` is a presentation surface, not the target long-term editing surface.

### 3. One shared pipeline powers both viewport modes

- Portal editing state, direct manipulation, and sheet generation must all read from the same configuration source.
- Derived geometry must not fork into separate "configurator geometry" and "sheet geometry" systems.

### 4. Annotation placement is semantic and viewport-aware

- Annotation text must never render upside down.
- Geometry may rotate; annotation placement must be recomputed per viewport.
- Page-anchored annotations and geometry-anchored annotations must be explicitly classified.
- This rule applies to plan first, then to sections, elevations, and details.

### 5. The portal rail is a curated calculator subset

- The rail is not a copy of the full calculator UI.
- It should cover the common 80-90% editing path:
  - geometry
  - roof
  - house/context
  - support conditions
  - view controls
- The full calculator remains the advanced escape hatch.

### 6. Portal edits remain live-draft edits

- Workbench edits update the local estimate drawing draft live.
- The workbench is not a staged "apply" flow in v1.

### 7. Delivery order is locked

- `Plan`
- `Section`
- `Elevation`
- `Details`

### 8. First detail proof-of-concept is locked

- The first generated detail family will be `house connection / soffit attachment`.
- Details will be generated from semantic assembly data, not hand-authored sheet graphics.

## Scope

In scope:

- workbench shell
- shared workbench state
- shared assembly model for drawings
- plan `Model Space`
- plan `Sheet View`
- section and elevation foundations
- annotation rules and placement policy
- detail-generation foundation

Out of scope:

- rewriting the full calculator before workbench value is shipped
- replacing estimate draft persistence rules
- making sheet view the primary interaction model
- generating every detail family in the first milestone set

## Repo-specific findings

These decisions are based on the current implementation.

### 1. Plan rendering, interaction, and annotation policy are mixed together today

- `apps/portal/app/staff/calculator/ModuleViewsCard.tsx` currently owns:
  - geometry projection
  - plan rendering
  - sheet fit/layout behavior
  - direct interaction behavior
  - some annotation placement
- This is workable for the current scope but is not the right long-term boundary once multiple viewport modes exist.

### 2. Plan geometry already has useful semantic seeds

- `apps/portal/app/staff/calculator/moduleViews.ts` already provides a useful seed for derived drawing data, especially for:
  - roof geometry
  - house footprint semantics
  - attachment-side semantics
- It is the best current starting point for a more explicit assembly model.

### 3. Portal sheet view is already valuable, but it is carrying too much interaction logic

- `apps/portal/components/estimates/EstimateDrawingSheet.tsx` already provides a strong documentation-style surface.
- Recent iterations added direct hover editing, rotation, and house-context editing there.
- That surface should not continue to accumulate the long-term editing engine.

### 4. The current annotation problem is architectural, not cosmetic

- The recent rotation issues show that some annotations are now page-anchored while others still behave like rotated SVG.
- `FALL`, `c/c`, and dimension placement need explicit viewport-aware rules instead of inheriting transform behavior from geometry groups.

### 5. Existing drawing draft helpers are still the right persistence path

- `apps/portal/lib/estimates/drawingEdits.ts` and the estimate draft flow remain the right source for live portal edits.
- The workbench should sit above that persistence layer, not replace it.

## Target architecture

The target stack is:

1. configuration state
2. assembly model
3. view builders
4. annotation engine
5. presentation surfaces

### 1. Configuration state

The editable source of truth.

Responsibilities:

- persisted estimate drawing draft values
- active module and active view
- viewport mode
- direct-manipulation actions
- rail edits
- temporary UI state such as hover, drag, selection, zoom, and popovers

This state must be shared by the rail and the active viewport.

### 2. Assembly model

A canonical semantic representation of the pergola.

Responsibilities:

- pergola outline and roof form
- attachment edge
- house context
- posts, beams, rafters, gutters
- support conditions
- fall vector
- connection semantics required by future details

The assembly model is not the final rendered SVG geometry. It is the semantic source for all view builders.

### 3. View builders

Pure derivation from assembly model to viewport-specific geometry and annotation intents.

Required builders:

- `buildPlanViewModel`
- `buildSectionViewModel`
- `buildElevationViewModel`
- later `buildDetailViewModel`

Outputs should include:

- geometry primitives
- semantic anchors
- annotation intents
- selection/interaction affordances where needed

### 4. Annotation engine

A separate placement step that resolves annotation intents into readable drawing annotations.

Responsibilities:

- text orientation
- fall arrows and labels
- primary dimensions
- framing dimensions such as `c/c`
- callouts and leaders
- viewport-aware placement policy
- page-space vs model-space anchoring rules

This is where the current rotated annotation issues must be solved.

### 5. Presentation surfaces

Consumers of shared view-model output.

Required surfaces:

- `DrawingWorkbench`
- `ModelSpaceViewport`
- `SheetViewport`
- `SheetComposer`
- renderers such as `PlanRenderer`, `SectionRenderer`, and `ElevationRenderer`

## Viewport modes

### `Model Space`

Purpose:

- primary live editing surface

Behavior:

- clean drawing background
- pan and zoom
- direct manipulation
- live calculator-rail editing
- minimal documentation chrome

### `Sheet View`

Purpose:

- generated document preview

Behavior:

- title block
- legend
- note and sheet metadata
- scale-aware composition
- lower-interaction review surface

## Annotation policy

These rules are locked.

### Rule 1: text never renders upside down

- Rotated geometry does not justify upside-down labels.
- Labels may rotate only when their final orientation is still readable.

### Rule 2: page-anchored and geometry-anchored annotations must be declared

- Page-anchored examples:
  - sheet metadata
  - page furniture
  - sheet title block labels
- Geometry-anchored examples:
  - primary dimensions
  - fall arrows
  - framing spacing
  - section/elevation callouts

### Rule 3: geometry may rotate; annotation placement must be recomputed

- Geometry transforms must not be treated as annotation policy.
- The annotation engine must place each annotation after the active viewport transform is known.

### Rule 4: primary plan dimensions use viewport-mode-specific policy

- `Sheet View`
  - keep primary dimensions on the left and bottom where that is the chosen documentation rule
- `Model Space`
  - dimensions may use a more interaction-friendly policy such as nearest readable side

### Rule 5: `FALL` is semantic, not decorative

- Fall direction must come from the underlying roof/attachment/fall model.
- The fall callout must be projected into the active viewport and placed on the correct downhill side.

### Rule 6: framing annotations remain tied to semantic members

- `c/c` annotations must follow the correct framing members even if geometry is rotated or re-laid out in the viewport.

## What belongs in the rail

The rail should own the common portal editing subset.

v1 rail categories:

- geometry
- roof
- house/context
- supports
- view controls

The rail should not own:

- title-block editing
- sheet layout composition logic
- advanced calculator-only fields that are rarely used in the portal

## What belongs in the viewer

The viewport should own:

- selection and hover
- pan and zoom
- direct manipulation
- contextual affordances
- view switching affordances if needed
- visual feedback for current configuration

The viewer should not own:

- long-term persistence logic
- business validation rules already handled by shared draft/persistence helpers
- independent copies of calculator logic

## Proposed file structure

### Components

- `apps/portal/components/drawings/workbench/`
- `apps/portal/components/drawings/rail/`
- `apps/portal/components/drawings/viewports/`
- `apps/portal/components/drawings/renderers/`
- `apps/portal/components/drawings/sheets/`

### Libraries

- `apps/portal/lib/drawings/state/`
- `apps/portal/lib/drawings/assembly/`
- `apps/portal/lib/drawings/views/plan/`
- `apps/portal/lib/drawings/views/section/`
- `apps/portal/lib/drawings/views/elevation/`
- `apps/portal/lib/drawings/annotations/`
- `apps/portal/lib/drawings/details/`

## Migration boundaries from current code

### Near-term seeds to extract from

- `apps/portal/app/staff/calculator/moduleViews.ts`
- `apps/portal/app/staff/calculator/ModuleViewsCard.tsx`
- `apps/portal/components/estimates/EstimateDrawingSheet.tsx`
- `apps/portal/lib/estimates/drawingEdits.ts`

### Temporary constraint

The current calculator and sheet renderer remain the live implementation while the new workbench architecture is introduced incrementally.

The goal is extraction and migration, not a risky stop-the-world rewrite.

## Definition of done for M0

M0 is complete when:

- this architecture spec is committed
- the execution board is committed
- the initial drawings folder scaffold exists in the repo
- annotation policy is explicitly recorded in the repo
