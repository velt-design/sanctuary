# Drawing Workbench Execution Board

Date: 2026-03-21
Depends on:

- `docs/drawing-workbench-spec.md`

## Objective

Ship a portal drawing workbench that supports:

- shared `Model Space` and `Sheet View`
- live plan configuration
- future section and elevation support
- future generated detail support

## Delivery strategy

Implement in this order:

1. architecture freeze and scaffold
2. stabilize the current plan path
3. introduce the workbench shell
4. extract shared state and assembly model
5. ship `Model Space` plan
6. refactor `Sheet View` onto the same foundation
7. add `Section`
8. add `Elevation`
9. add details foundation
10. ship the first generated detail

## M0: Architecture Freeze And Scaffold

### Ticket M0.1: Commit locked architecture spec

Scope:

- capture locked product and architecture decisions
- define state layers
- define viewport-mode responsibilities
- define annotation policy
- define extraction boundaries from current calculator and sheet code

Acceptance criteria:

- architecture spec exists in `docs/`
- locked decisions are explicit
- annotation policy is explicit
- current seed files are named

Suggested PR slice:

- docs only

### Ticket M0.2: Commit execution board

Scope:

- convert milestones into an implementation-ready board
- include acceptance criteria and dependency order
- include suggested PR slices

Acceptance criteria:

- execution board exists in `docs/`
- all milestones from `M0` to `M10` are covered
- dependency order is explicit

Suggested PR slice:

- docs only

### Ticket M0.3: Create drawings folder scaffold

Scope:

- add the initial component and library folders for the future workbench
- add lightweight placeholder READMEs so the structure is committed and reviewable

Acceptance criteria:

- `apps/portal/components/drawings/` scaffold exists
- `apps/portal/lib/drawings/` scaffold exists
- folder responsibilities are documented at a lightweight level

Suggested PR slice:

- scaffold only

## M1: Current Plan Stabilization

### Ticket M1.1: Fix plan annotation policy regressions

Scope:

- fix `FALL`
- fix `c/c`
- fix any rotated plan annotation that can render upside down or on the wrong side

Acceptance criteria:

- text never renders upside down in plan
- fall direction is correct for rotated states
- framing annotations stay readable

Suggested PR slice:

- annotation policy fixes only

### Ticket M1.2: Finish plan house-edge interaction polish

Scope:

- stabilize hover/drag behavior
- keep sheet editing predictable until `Model Space` exists

Acceptance criteria:

- no stuck hover states
- edge drag remains stable during pointer transitions
- no point handles remain in sheet mode

Suggested PR slice:

- interaction polish only

### Ticket M1.3: Add plan regression fixtures

Scope:

- add tests and/or golden references for plan rotation, attachment sides, square vs non-square, and house context

Acceptance criteria:

- key rotated plan states are covered
- fall and dimension behavior are covered

Suggested PR slice:

- tests only

## M2: Workbench Shell

### Ticket M2.1: Add `DrawingWorkbench` shell

Scope:

- create the top-level workbench layout
- add left rail and center viewport regions

Acceptance criteria:

- workbench shell renders without replacing the current estimate tab surface yet
- shell supports active module and active view selection

Suggested PR slice:

- component shell only

### Ticket M2.2: Add viewport mode switch

Scope:

- add `Model Space` and `Sheet View` mode switch

Acceptance criteria:

- mode switch exists
- active mode is stored in shared workbench UI state

Suggested PR slice:

- mode switch only

## M3: Shared State And Assembly Extraction

### Ticket M3.1: Add workbench store

Scope:

- create shared workbench state for:
  - active module
  - active view
  - viewport mode
  - selection
  - hover
  - drag
  - zoom/pan

Acceptance criteria:

- rail and viewport can read/write the same workbench state
- ephemeral UI state is separated from persisted draft state

Suggested PR slice:

- state only

### Ticket M3.2: Add assembly model builder

Scope:

- derive a canonical semantic assembly model from estimate draft + module inputs

Acceptance criteria:

- assembly model represents roof, house context, attachment edge, posts/beams/rafters/gutters, fall vector, and support conditions
- the assembly model does not depend on sheet placement

Suggested PR slice:

- library extraction only

### Ticket M3.3: Add plan view-model contract

Scope:

- extract the first `PlanViewModel` contract from the current drawing code

Acceptance criteria:

- plan geometry can be produced from assembly model + mode
- annotation intents are represented separately from final placement

Suggested PR slice:

- plan view-model contract only

## M4: Model Space Plan v1

### Ticket M4.1: Add `ModelSpaceViewport`

Scope:

- render plan in a clean drawing-space viewport

Acceptance criteria:

- no title block
- no sheet furniture
- viewport responds to shared state

Suggested PR slice:

- base viewport only

### Ticket M4.2: Add pan/zoom and selection

Scope:

- basic model-space navigation and selection

Acceptance criteria:

- pan and zoom work
- selection state is stable

Suggested PR slice:

- interaction-only PR

### Ticket M4.3: Add plan direct manipulation in model space

Scope:

- move rotate and house-edge drag interaction into model space

Acceptance criteria:

- model space supports live rotate
- model space supports live house-edge drag
- shared draft path still updates live

Suggested PR slice:

- direct-manipulation only

## M5: Configurator Rail v1

### Ticket M5.1: Add rail field schema

Scope:

- define the v1 field groups and schema used by the rail

Acceptance criteria:

- field groups are explicit
- advanced/full-calculator-only fields are excluded

Suggested PR slice:

- schema only

### Ticket M5.2: Build `ConfiguratorRail`

Scope:

- render the curated portal editing subset

Acceptance criteria:

- rail can drive shared state
- rail fields reflect persisted draft values

Suggested PR slice:

- rail UI only

### Ticket M5.3: Add full-calculator escape hatch

Scope:

- add a clear path to open the full calculator for advanced edits

Acceptance criteria:

- advanced users can leave the rail flow without losing draft context

Suggested PR slice:

- navigation only

## M6: Sheet View Refactor

### Ticket M6.1: Add `SheetViewport`

Scope:

- make sheet view consume shared plan view-model output

Acceptance criteria:

- sheet view renders from shared state and shared view data
- no duplicated drawing logic is introduced

Suggested PR slice:

- viewport only

### Ticket M6.2: Add `SheetComposer`

Scope:

- move title block, legend, metadata, and note composition into a dedicated sheet surface

Acceptance criteria:

- sheet furniture is separated from geometry rendering

Suggested PR slice:

- sheet composition only

### Ticket M6.3: Remove remaining sheet-owned editing logic

Scope:

- keep sheet interaction lightweight and presentation-oriented

Acceptance criteria:

- core editing logic no longer lives in the sheet surface

Suggested PR slice:

- cleanup/refactor only

## M7: Section View

### Ticket M7.1: Add section view model

Scope:

- derive section from assembly model

Acceptance criteria:

- section generation does not depend on projected plan geometry

Suggested PR slice:

- library only

### Ticket M7.2: Add section annotation placement

Scope:

- dimension and callout placement for sections

Acceptance criteria:

- section annotations follow the annotation policy

Suggested PR slice:

- annotation only

### Ticket M7.3: Ship section in both viewport modes

Scope:

- render section in model space and sheet view

Acceptance criteria:

- section is available in both modes
- inspect-first section workflow is stable

Suggested PR slice:

- rendering only

## M8: Elevation View

### Ticket M8.1: Add elevation view model

Scope:

- derive elevation geometry from assembly model

Acceptance criteria:

- elevation faces are explicit and selectable

Suggested PR slice:

- library only

### Ticket M8.2: Add elevation annotations

Scope:

- add elevation dimensioning/callout rules

Acceptance criteria:

- elevation annotations are readable and mode-aware

Suggested PR slice:

- annotation only

### Ticket M8.3: Ship elevation in both viewport modes

Scope:

- render elevation in model space and sheet view

Acceptance criteria:

- elevation is available in both modes

Suggested PR slice:

- rendering only

## M9: Details Foundation

### Ticket M9.1: Add detail-family registry

Scope:

- define detail family selection from assembly conditions

Acceptance criteria:

- detail registry can resolve at least one family from assembly inputs

Suggested PR slice:

- library only

### Ticket M9.2: Add detail view-model contract

Scope:

- define the geometry and annotation contract for generated details

Acceptance criteria:

- detail builders can output semantic geometry and annotation intents

Suggested PR slice:

- library only

## M10: First Generated Detail

### Ticket M10.1: Implement soffit attachment detail family

Scope:

- generate the first detail family from assembly semantics

Acceptance criteria:

- soffit attachment detail renders from assembly inputs
- sheet view can place the detail

Suggested PR slice:

- one detail family only

### Ticket M10.2: Integrate detail selection into the workbench

Scope:

- expose detail selection/navigation in the workbench

Acceptance criteria:

- user can inspect the generated detail alongside the parent module context

Suggested PR slice:

- UI only

## Dependency order

- `M0 -> M1 -> M2 -> M3 -> M4 -> M5 -> M6 -> M7 -> M8 -> M9 -> M10`
- `M4` depends on `M3`
- `M6` depends on `M3`
- `M7` depends on `M3`
- `M8` depends on `M3`
- `M9` depends on `M7`
- `M10` depends on `M9`

## Recommended PR sequence

1. `M0.1`
2. `M0.2`
3. `M0.3`
4. `M1.1`
5. `M1.2`
6. `M1.3`
7. `M2.1` + `M2.2`
8. `M3.1`
9. `M3.2`
10. `M3.3`
11. `M4.1`
12. `M4.2`
13. `M4.3`
14. `M5`
15. `M6`
16. `M7`
17. `M8`
18. `M9`
19. `M10`

## M0 exit criteria

M0 is complete when:

- `docs/drawing-workbench-spec.md` is committed
- `docs/drawing-workbench-execution-board.md` is committed
- the initial drawings scaffold exists in the repo
