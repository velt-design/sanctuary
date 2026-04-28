# Model Space Outline Drawing Polish Plan

Date: 2026-04-15
Status: Living plan
Depends on:

- `docs/house-first-design-workbench-implementation-plan.md`
- `docs/house-first-design-workbench-execution-board.md`

## Objective

Support house-form footprint editing inside the canonical object-first workbench direction by making Model Space outline drawing feel like a polished, reliable CAD-style editing tool instead of a partial overlay on top of generated drawings.

The end state should support:

- obvious entry and exit from outline drawing mode
- clear visual feedback for every drawing state
- accurate point placement in model coordinates
- predictable confirm, undo, cancel, close, and edit behavior
- reliable panning and zooming while drawing
- robust validation with actionable errors
- browser-level regression coverage for the real user flow

This is a tactical implementation note, not a competing workbench spec. It supports the active object-first implementation plan and execution board by tightening one important part of selected-house-form editing in `Model Space`.

## Current State

Model Space is now closer to an open canvas:

- reset centers the active pergola focus target
- oversized house/context no longer controls the root SVG size
- model-space context is exposed through `data-model-space-world-box`
- the pale house/context surface is no longer intentionally clipped by the focus viewport

Outline drawing still feels unresolved because the feature is spread across renderer, viewport interaction state, SVG pointer conversion, popover controls, and draft persistence. The next work should treat outline drawing as a first-class tool mode with a clear state machine, not as a set of incidental pointer handlers.

## Current Flow Inventory

Current Draw Outline behavior is represented by `drawOutlineSession` in `ModelSpaceViewport`.

- Inactive: `drawOutlineSession` is `null`; existing house/context editing can render normally.
- First point: a session exists with no points; the popover says `Click first corner` and the existing footprint is hidden until enough draft points exist.
- Placing: at least one confirmed point exists and there is no typed pending point; pointer hover may render a hover preview segment.
- Pending segment: a click or typed distance/angle has produced a pending point; `Confirm` adds it to the confirmed point list.
- Close ready: at least three confirmed points exist; the first vertex becomes a close target.
- Close hovered: pointer hover is within close tolerance of the first point and the close target is highlighted.
- Error: validation or interaction errors are stored in `footprintError`/`fieldError` and shown through the shared viewport error surface.

Known coupling points:

- Pointer-to-model conversion still lives in the SVG renderer callback path.
- The popover position depends on rendered custom-vertex DOM markers.
- Preview geometry is passed through `customPolygonOverride`, which also drives normal custom footprint rendering.
- Validation, commit, and session transitions still live inside the viewport component.

## Success Criteria

Outline drawing is considered polished when:

- A new user can enter Draw Outline mode and understand the next action without training.
- Every pointer state has visible feedback: idle, hover, pending point, confirmed segment, close-ready, invalid, dragging, and committed.
- The drawn polygon matches the user clicks at all zoom/pan levels.
- Reset, zoom, pan, and window resize do not lose the draft or move controls to confusing places.
- The user can undo, cancel, close, and commit without hidden side effects.
- Invalid polygons are blocked before persistence, with a clear message and the relevant geometry highlighted.
- The mode works in Safari and Chromium through browser tests, not only React unit tests.
- Sheet View remains document-first and does not inherit outline editing behavior.

## Product Decisions

- Draw Outline is a Model Space plan tool only.
- Sheet View can show the resulting context, but it should not host the outline drawing workflow.
- The drawn outline represents selected house-form footprint geometry in model coordinates.
- Commit should update the existing drawing draft path. No new persistence surface is introduced.
- The outer Model Space viewport remains the only visible viewport shell.
- Panning should remain possible while drawing, but must not conflict with point placement.

## Architecture Direction

### 1. Treat Draw Outline As A Tool State Machine

Introduce an explicit internal tool model for outline drawing:

- inactive
- placing first point
- placing next point
- pending typed segment
- close-ready
- validating
- committing
- error

Each state should define:

- allowed user actions
- visible hint text
- enabled controls
- pointer behavior
- escape and cancel behavior
- whether pan/zoom gestures are allowed

### 2. Separate Geometry From UI Chrome

Keep coordinate and polygon logic out of ad hoc event handlers.

Target responsibilities:

- pointer-to-model conversion
- point snapping and close detection
- segment construction
- polygon validation
- polygon serialization
- draw-state-to-render-model projection

The viewport should consume a draw view model and render it, rather than recomputing behavior in scattered JSX.

### 3. Make Feedback Layered And Predictable

Draw feedback should have stable visual layers:

- existing house/context, muted
- active polygon segments
- pending preview segment
- point markers
- close target
- invalid segment or invalid polygon highlight
- tool controls and inline status

The layer order should be deterministic and covered by tests where possible.

### 4. Use Playwright For Real Interaction Confidence

Unit tests should cover geometry and state transitions. Playwright should cover:

- real click placement
- zoom and pan while drawing
- close target behavior
- cancel and undo
- persistence after commit
- Safari-like viewport/overflow risks through browser screenshots where supported

Playwright should be used whenever the bug is visual, pointer-coordinate, zoom/pan, or browser-layout dependent.

## Execution Board

Work through one ticket at a time. Keep each ticket small enough to review and verify independently.

### M0: Baseline And Diagnostics

#### Ticket M0.1: Capture Current Draw Outline Flow

Scope:

- document the current user flow in code comments or tests
- identify every state currently represented by `drawOutlineSession`
- identify all render branches that change during drawing

Acceptance criteria:

- current states and transitions are listed in this doc
- no behavior changes
- risky coupling points are named

Suggested PR slice:

- docs and read-only test scaffolding only

#### Ticket M0.2: Add Debug Metadata For Draw Mode

Status: Completed 2026-04-15

Scope:

- add non-user-facing data attributes for current draw mode state
- expose confirmed point count, pending point state, close-ready state, and validation state
- keep attributes internal to tests and diagnostics

Acceptance criteria:

- Playwright and unit tests can locate the active drawing state without visual guessing
- no user-visible UI change

Suggested PR slice:

- internal diagnostics only

#### Ticket M0.3: Establish Browser Test Fixture

Status: Completed 2026-04-15

Scope:

- define a stable fixture route for a known Mono 6m x 3m module
- confirm `npm run test:portal:browser:headed` can open Model Space and enter Plan
- document required environment variables

Acceptance criteria:

- browser smoke can reach the Model Space plan surface
- test can identify the SVG, reset button, zoom controls, and draw outline trigger
- test can take a screenshot on failure

Suggested PR slice:

- Playwright fixture and docs only

Implementation notes:

- the fixture route is `/staff/projects/fixture-roof/design-workbench?fixture=mono-standard`
- the smoke uses `openFixtureDrawingWorkbench(page, 'mono-standard')` and skips if fixture routes are unavailable
- the test verifies `[data-model-space-scroller]`, `data-draw-outline-state`, `[data-draw-outline-controls="true"]`, `svg[data-model-space-svg="plan"]`, and `[data-model-space-focus-target]`
- deeper click placement, pan, zoom, close target, and persistence flows belong to M5 browser interaction tickets

### M1: State Machine

#### Ticket M1.1: Define Outline Tool State Types

Status: Completed 2026-04-15

Scope:

- introduce internal state types for outline mode
- centralize transitions for start, add point, hover, type segment, undo, cancel, close, validate, and commit
- keep persistence API unchanged

Acceptance criteria:

- transitions are unit tested without rendering
- impossible states are not representable
- existing behavior remains functionally equivalent

Suggested PR slice:

- state model and tests

Implementation notes:

- `drawOutlineToolState.ts` owns the internal state union, pure transitions, close preparation, validation preservation, and view-model derivation
- `ModelSpaceViewport` still owns SVG/raw-point conversion, DOM refs, and async commit orchestration
- deeper geometry helper extraction remains in `M1.2`; validation model changes remain in `M1.3`

#### Ticket M1.2: Move Polygon Draft Logic Into Helpers

Status: Completed 2026-04-15

Scope:

- extract polygon draft operations from `ModelSpaceViewport`
- cover coordinate normalization, point append, preview point, close detection, undo, and serialization

Acceptance criteria:

- geometry helpers are pure and unit tested
- viewport event handlers become thin dispatchers
- existing draw outline unit tests still pass

Suggested PR slice:

- helper extraction only

Implementation notes:

- `drawOutlineToolGeometry.ts` owns draw-outline point math, draft projection, close-hover detection, preview polygon assembly, and serialization
- `drawOutlineToolState.ts` now delegates geometry/draft calculations to the helper and remains focused on transitions and view-model derivation
- existing custom footprint vertex/edge edit helpers remain in `ModelSpaceViewport` and are intentionally out of scope for this ticket

#### Ticket M1.3: Add Validation Model

Status: Completed 2026-04-15

Scope:

- validate minimum point count
- reject self-intersections
- reject near-zero-length edges
- reject duplicate adjacent points
- reject impossible or degenerate closed polygons

Acceptance criteria:

- invalid polygons cannot commit
- validation returns structured reasons and affected segment/point indexes
- validation is covered with unit tests

Suggested PR slice:

- validation helpers and tests

Implementation notes:

- `drawOutlineToolValidation.ts` owns structured validation issue codes, messages, and affected point/segment metadata
- `prepareDrawOutlineClose` still returns the existing `error` string and now also carries `validationIssue`
- invalid geometry rendering/highlighting is deferred to a later feedback ticket

### M2: Interaction Polish

#### Ticket M2.1: Clarify Entry And Exit

Status: Completed 2026-04-15

Scope:

- make Draw Outline mode visibly active
- provide a persistent instruction strip or tool status
- make Escape cancel the active mode
- ensure Cancel restores prior footprint context exactly

Acceptance criteria:

- user always knows they are in Draw Outline mode
- cancel has no persistence side effect
- keyboard escape and button cancel behave consistently

Suggested PR slice:

- UI and interaction state only

Implementation notes:

- active Draw Outline now shows a persistent viewport status strip with short state-specific hints and `Esc cancels`
- `[data-model-space-scroller]` exposes `data-draw-outline-active`, and the status strip exposes stable diagnostics for tests
- invalid geometry highlighting and point-placement precision remain deferred to later M2 tickets

#### Ticket M2.2: Make Point Placement Precise

Status: Complete.

Scope:

- audit `clientPointToSvg` and `getScreenCTM` behavior with pan, zoom, and reset
- ensure point placement is correct after viewport transform changes
- add a visible marker exactly where the click will land

Acceptance criteria:

- Playwright click coordinates produce expected SVG/model coordinates within tolerance
- placement remains correct after zoom and pan
- Safari behavior is verified manually or through available browser coverage

Suggested PR slice:

- pointer conversion and tests

Implementation notes:

- Draw Outline plan pointer conversion is now isolated behind a pure helper with formatted and numeric metre outputs.
- active Draw Outline hover exposes a small non-interactive landing crosshair plus scroller diagnostics before and after the first point
- fixture browser smoke now hovers/clicks a known plan SVG point and verifies landing coordinates without committing a polygon
- drag-vs-pan gesture separation remains deferred to `M2.3`

#### Ticket M2.3: Separate Pan From Draw Clicks

Status: Complete.

Scope:

- define gesture rules for click-to-place versus drag-to-pan
- add movement threshold before a pointer becomes a pan drag
- avoid placing a point after a pan gesture

Acceptance criteria:

- click places a point
- drag pans without placing a point
- accidental micro-movement still places a point
- tests cover threshold behavior

Suggested PR slice:

- viewport interaction only

Implementation notes:

- Draw Outline now defers point placement until pointer-up so gesture movement can be classified before selecting a point.
- drag movement beyond the 5px threshold pans the model-space viewport and leaves the outline draft unchanged
- scroller diagnostics expose the current draw gesture and threshold for focused unit and browser coverage
- close-target refinement and accidental close behavior remain in `M2.4`

#### Ticket M2.4: Improve Close Target Behavior

Status: Complete.

Scope:

- make close target visible only after three valid points
- add a larger invisible hit area
- highlight close preview segment
- prevent accidental close when pointer is not near start

Acceptance criteria:

- close affordance is obvious but not intrusive
- clicking close target validates and commits or moves to validation error state
- tests cover close-ready and not-close-ready states

Suggested PR slice:

- close behavior and tests

Implementation notes:

- close-ready now renders a dedicated first-vertex close hit target separate from the generic vertex hit area
- close-hover preview edges expose stable close-preview diagnostics while normal outside-tolerance hover remains close-ready
- browser smoke reaches close-hovered state but still avoids committing the polygon
- richer close-target styling remains part of `M3.1`

### M3: Visual Design

#### Ticket M3.1: Define Draw Layer Styles

Status: Complete.

Scope:

- add clear styles for confirmed points, pending point, hover point, active segment, close target, and invalid geometry
- ensure styles work on the current light canvas
- keep layout stable while status text changes

Acceptance criteria:

- visual states are distinct at normal zoom and high zoom
- no labels or controls overlap critical geometry at reset
- screenshots show the intended layer order

Suggested PR slice:

- CSS and renderer markup only

Implementation notes:

- Draw Outline SVG layers now expose distinct styling hooks for active confirmed edges, pending/hover previews, landing markers, close previews, and invalid drafts.
- active/error selectors are markup-only and do not change geometry, validation, persistence, or gesture behavior
- status and popover layout received minor stability constraints; broader tool chrome refinement remains in `M3.2`
- live measurement labels remain in `M3.3`

#### Ticket M3.2: Refine Tool Controls

Scope:

- replace floating ad hoc controls with stable tool chrome
- keep Confirm, Undo, Cancel, typed distance, and typed angle predictable
- disable controls that are invalid in the current state

Acceptance criteria:

- controls do not jump as points are added
- disabled states explain what is missing
- keyboard focus remains usable

Suggested PR slice:

- controls and accessibility only

#### Ticket M3.3: Add Inline Measurement Feedback

Scope:

- show live segment length and angle while hovering
- show last segment dimensions after placement
- keep text readable and non-overlapping

Acceptance criteria:

- measurements update during hover
- labels do not resize the drawing canvas
- formatting matches existing metre conventions

Suggested PR slice:

- annotation feedback only

### M4: Commit And Persistence Reliability

#### Ticket M4.1: Make Commit Transaction Explicit

Scope:

- model commit as a transition from validating to committing to complete or error
- prevent double submit
- keep the draft visible while commit is pending

Acceptance criteria:

- repeated clicks do not create duplicate commits
- failed commit keeps the user in draw mode with the draft intact
- success exits draw mode and renders the persisted footprint

Suggested PR slice:

- commit flow and tests

#### Ticket M4.2: Improve Error Recovery

Scope:

- show validation and persistence errors in the tool area
- highlight invalid segments or points
- allow user to undo or continue editing after an error

Acceptance criteria:

- error text is actionable
- invalid geometry is visible
- user can recover without canceling the whole mode

Suggested PR slice:

- errors and recovery only

### M5: Browser Coverage

#### Ticket M5.1: Add Model Space Draw Outline Playwright Spec

Scope:

- open a known drawing
- switch to Model Space plan
- start Draw Outline
- place at least three points
- verify preview and confirmed markers
- close and commit
- verify persisted context appears after reload or rerender

Acceptance criteria:

- test runs headed for local debugging
- screenshots are captured on failure
- test uses stable data attributes, not brittle text or pixel-only selectors

Suggested PR slice:

- Playwright test only

#### Ticket M5.2: Add Zoom And Pan Browser Regression

Scope:

- start Draw Outline
- zoom in
- pan
- place points
- verify resulting polygon coordinates remain correct

Acceptance criteria:

- click placement tolerance is documented
- test fails if transform math regresses

Suggested PR slice:

- Playwright interaction regression only

#### Ticket M5.3: Add Visual Smoke Screenshots

Scope:

- capture reset state
- capture active draw mode with pending segment
- capture validation error state
- compare against tolerant baseline or use targeted pixel/assertion checks

Acceptance criteria:

- visual crop/overflow regressions are detectable
- screenshots are useful for debugging without being too brittle

Suggested PR slice:

- browser visual smoke only

### M6: Cleanup And Architecture Alignment

#### Ticket M6.1: Move Drawing Logic Out Of `ModuleViewsCard`

Scope:

- extract plan drawing primitives and draw overlay rendering into a focused module
- keep public component APIs stable during extraction

Acceptance criteria:

- `ModuleViewsCard.tsx` is smaller and less stateful
- plan renderer responsibilities are documented
- tests remain green

Suggested PR slice:

- extraction only

#### Ticket M6.2: Align With Drawing Workbench Architecture

Scope:

- connect outline drawing helpers to the workbench state/view-model direction
- avoid new one-off state paths
- document what remains temporary

Acceptance criteria:

- outline drawing state can migrate cleanly into the broader workbench
- temporary adapters are named

Suggested PR slice:

- architecture alignment only

## Recommended Next Step

Start with `M0.2: Add Debug Metadata For Draw Mode`, then `M0.3: Establish Browser Test Fixture`.

Reason:

- The current pain is visual and interaction-heavy.
- Better state metadata plus Playwright access will make the next fixes observable.
- It reduces guessing before refactoring the state machine.

## Playwright Guidance

Use Playwright for any issue involving:

- visual clipping
- Safari or browser layout behavior
- pointer placement
- pan and zoom transforms
- active tool chrome positioning
- end-to-end commit behavior

Use unit tests for:

- state transitions
- polygon validation
- coordinate math helpers
- serialization
- renderer markup and data attributes

Required browser env:

- `PORTAL_TEST_EMAIL`
- `PORTAL_TEST_PASSWORD`

Optional:

- `PORTAL_BASE_URL`
- `PORTAL_DRAWING_URL`

Useful commands:

```bash
npm run test:portal:browser:headed
npm run test:portal:browser
```

## Open Questions

- Should Draw Outline support typed distance and angle in the first polished release, or should that be a follow-up after click-based drawing is reliable?
- Should outline edits support dragging existing vertices in the same mode, or should that remain separate from initial outline creation?
- Should the tool commit immediately on close, or should close create a closed draft that still requires Confirm?
- Should invalid geometry be blocked as the user draws, or only during final commit?

## Change Log

- 2026-04-15: Created plan after Model Space reset and context clipping fixes.
