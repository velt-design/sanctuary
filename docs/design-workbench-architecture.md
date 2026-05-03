# Design Workbench Architecture

The design workbench is the portal drawing and model-editing surface for estimate-backed designs. The active workbench migration is sealed around an object-first project model and solved geometry spine. Compatibility remains only as explicit legacy estimate snapshot import/export support and named fallback boundaries.

## Primary Paths

- Route: `/staff/projects/[projectId]/design-workbench`.
- Estimate workbench client: `apps/portal/app/staff/projects/[projectId]/design-workbench`.
- UI components: `apps/portal/components/drawings`.
- Domain library: `apps/portal/lib/drawings`.
- Geometry package: `packages/geometry`.
- Browser smoke: `playwright/portal.drawing-workbench.spec.ts`.

## Component Layers

- `workbench`: top-level shell, viewport mode switching, save/status surfaces, and the only component-layer host that composes viewport branches.
- `viewports`: Model Space, Sheet View, 3D, Draw Outline interaction.
- `rail`: configurator and object-workbench inspector rails.
- `sheets`: A3 sheet composition.
- `renderers`: shared drawing rendering components when present.

## Domain Layers

- `state`: workbench store, UI state, object-first model, compatibility adapters, status/inspector models.
- `geometry`: package input builders, preview derivation, compatibility geometry adapters.
- `interactions`: shared object interaction engine plus family adapters.
- `assembly`: semantic assembly builders and geometry contracts.
- `views`: plan/section/elevation view-model builders.
- `details` and `annotations`: generated details and placement policy.

## Object-First Model

The active workbench is object-first:

- House forms, decks, openings, and pergolas are modeled as explicit objects.
- Hosted objects resolve against derived house/building behavior.
- Geometry, plan, 3D, section, and sheet views should consume solved/derived models rather than each inventing shape truth.
- The solved module's 3D scene and model-space top projection are paired: the projection is generated from the same `ViewerSceneModel` handed to the 3D viewport, with assembly reference shapes carried forward explicitly.
- The scene also carries plan-detail lines for real house wall segments. These project as context lines with wall/snap metadata, do not drive plan extents, and are the preferred live deck host-edge snap source.
- Geometry-ready model-space plan fitting uses `geometryTopProjection.extents`; legacy `ModulePlanModel` dimensions are a fallback path, not the source of scene fit.
- `apps/portal/lib/drawings/commercialDesignPayload.ts` is a callable-only shadow adapter from `WorkbenchSolvedModel` to the commercial spine. It reads solved geometry and quantity hooks for future comparison work, but it does not drive workbench rendering, persistence, quote totals, or live pricing.
- Geometry-ready Model Space is a projection-only surface. Its normal body rendering consumes only top-projection committed bodies that match the 3D Top view; it does not execute legacy pergola plan geometry, semantic house context bodies, legacy footprint bodies, model primary dimensions, fall labels, or context/reference projection bodies. Sheet View and unsupported geometry fallback keep their existing legacy paths.
- Geometry-ready plan mode uses an internal plan render graph with explicit layer ownership: `committedBodies`, `contextLines`, `hitTargets`, `selectionOutlines`, `dimensions`, `dragPreview`, and `debug`. Normal visible body rendering may only consume `committedBodies`; selecting an object may add outlines, hit targets, handles, and dimensions, but must not add another filled house/deck/pergola body.
- Plan coordinate transforms are owned by the plan view layer, not by React render branches. The `PlanCoordinateAdapter` contract is the traceable boundary for projection-to-SVG and SVG-to-projection conversions; Model Space pointer tools should consume this adapter rather than duplicating top-projection math in components.
- Top-projection layer ownership is owned by the plan render graph contract. Model Space presenters consume prepared `committedBodies` and `contextLines` from that graph, while later interaction slices should add `hitTargets`, `selectionOutlines`, `dimensions`, `dragPreview`, and `debug` as explicit graph layers instead of hidden renderer branches.
- `ModuleViewsCard` is now a compatibility shell for calculator card chrome and public exports; drawing-surface orchestration lives in `ModuleDrawingRenderer`. Plan and Section SVG internals live in their own surface modules (`ModulePlanSvg`, `ModuleSectionSvg`) while `ModuleDrawingRenderer` routes status, scale, and plan/section branch orchestration only. The renderer no longer owns or exports broad surface primitives; plan layout, footprint presentation, plan annotations, section presentation, scale presentation, diagnostics, and SVG bridge concerns are implemented in their named modules. `ModuleDrawingSurfacePrimitives` is limited to shared low-level atoms and SVG/measurement helpers used by more than one owner. Model Space layer JSX lives in the app-local `ModulePlanLayerRenderers` module. Plan SVG presentation prep lives behind `buildPlanSvgPresentationModel`; geometry-backed SVG presentation prep lives behind `buildPlanSvgGeometryPresentation`; Plan SVG client/SVG bridge wiring lives behind `ModulePlanSvgBridge`. Large plan-surface JSX is split into focused PlanSvg presenters for house context, pergola geometry, dimensions, footprint edit controls, and popover chrome; `ModulePlanSvg` remains the composition boundary that wires those presenters together. Shells should not rebuild render-graph ownership, geometry projection arrays, SVG resolver bridges, or duplicate overlay source counts inline.
- Projection-backed overlays must also declare their source. Selection outlines, hit targets, drag previews, and dimensions bind to `top_projection_committed` polygons only. `house_reference`, `top_projection_context`, `geometry_plan_fallback`, opening overlays, and other legacy/reference polygons remain for host/reference math, explicit footprint editing, Sheet/fallback paths, or diagnostics, not normal Model Space overlays.
- Deck dragging in projection-backed plans must invert the same screen-axis transform used to draw the top projection, so pointer movement is screen-native. The live drag session uses the committed top-projection deck polygon, center, grabbed point, hit target, and preview polygon; SVG-only host-edge data and legacy/object polygons are kept out of live plan-space math. Live snap candidates come from projected wall-edge context lines when available, with the committed top-projection house body as fallback. All projection-backed releases cross an explicit render-frame to object-frame commit boundary before writing deck fields; frame matching is semantic by wall side/orientation because projection and object footprints can number the same wall differently. Snapped releases persist the preview-derived host/center offset for the chosen wall, while floating releases build their saved floating rect from the frame-mapped object-space polygon rather than raw projected world XY. Floating releases remain valid away from walls, and late top-projection rebuilds are diagnostics, not user-facing failures.
- Compatibility or legacy fallback state must stay named and visible in tests or status models, and must not become active geometry truth.

## Rail Notes

`ObjectWorkbenchRail` is the canonical hidden workbench rail. `ConfiguratorRail` remains for estimates-tab compatibility.

Rail state flows through route/store selection contracts. Rail components do not import viewport modules, and viewport components do not import rail modules; route clients and the workbench shell are the composition boundary that places the lanes together.

House Forms expose preset footprints and roof forms: flat, mono, gable, and hipped. Preset changes should keep roof-form intent available across attachment-side rotations. Unsupported custom topology should preserve selected intent while surfacing blocking diagnostics rather than silently approximating geometry.

## Interaction Model

Shared vocabulary for direct manipulation:

- `hover`
- `selected`
- `drag-intent`
- `dragging`
- `snap-available`
- `snapped`
- `floating`
- `blocked`
- `commit`
- `cancel`

`objectInteractionEngine` owns shared pointer and drag lifecycle behavior. Object-family adapters own hit targets, drag eligibility, previews, snap rules, commit payloads, validation, and hint text.

Deck dragging is the first concrete adapter pattern. Opening adapters also exist and should follow the same contract style.
Model Space object move lifecycles are routed through interaction controllers for deck and opening movement. `ModelSpaceViewport` resolves DOM/client/SVG/projection pointers, pointer capture, scroll anchoring, and persistence callbacks; the controllers own start, move preview, release intent, and commit diagnostics.
Deck release reconciliation is also interaction-owned: frozen preview, commit result state, rebuilt-shape matching, projection settle status, and release feedback are resolved by the deck settlement controller. Deck release-to-patch conversion lives in the focused deck commit adapter, which is the only projection-backed path that maps render-space deck preview polygons into object-frame persisted deck fields. Snapped projection commits use the snap preview's resolved center offset instead of re-projecting a render-space polygon center into a different frame; floating commits serialize the mapped commit-space rectangle. The commit adapter's coordinate trace is carried through settlement and exposed as debug/test diagnostics so preview-to-commit and release-to-rebuilt drift can be measured directly. `ModelSpaceViewport` may schedule animation frames and pass viewport stability into those controllers, but it should not own deck settle or commit-transform policy.
Plan dimension editing is also interaction-owned. `planDimensionEditController` validates dimension annotation edits and returns typed commit intents for house footprint edits, deck patches, and opening patches; `ModelSpaceViewport` keeps the popover, focus, error state, and persistence callback boundary, but it should not own dimension-specific patch math.
Footprint editing and draw-outline lifecycles are interaction-owned. `footprintEditController` resolves footprint control, handle, vertex, edge-add, and vertex-delete intents; `drawOutlineToolController` resolves outline select, hover, pointer-session, click-vs-pan transitions, distance-lock, undo, close, cancel, and custom-polygon commit intents. `ModelSpaceViewport` keeps DOM pointer capture, pan/zoom, popover positioning, refs, and persistence callback calls.
Model Space navigation math is interaction/view-domain owned. `modelSpaceNavigationController` owns zoom clamping, anchored zoom, fit-view transforms, mouse pan, touch pinch, WebKit gesture scale, wheel gesture classification, and deck-drag navigation lock decisions. `ModelSpaceViewport` keeps browser event registration, refs, active touch bookkeeping, pointer capture, scroll anchoring, and viewport transform persistence.
Legacy plan field resize math is interaction-owned. `planFieldResizeController` owns editable field lookup, resize start value resolution, SVG delta-to-metres conversion, clamping, and drawing field value formatting for `plan:lengthA` and `plan:spanA`; `ModelSpaceViewport` keeps refs, pointer listeners, hover/active state, field errors, and `onCommitField` persistence calls.

## Drawing Persistence

Design workbench persistence uses local-first working copies for estimate drawing drafts. Object-first data is stored inside the estimate drawing draft shape while compatibility loading remains explicit for older snapshots.

When changing persistence:

- Keep estimate locks respected.
- Preserve local draft recovery.
- Keep compatibility adapters isolated.
- Add tests for migration or fallback boundaries.

## Verification

```bash
npm run test:portal:workbench
npm run test:portal -- apps/portal/lib/drawings
npm run test:portal -- apps/portal/components/drawings
npm run test:portal:browser
```

Latest local signal: on 2026-05-03, `npm run test:portal:workbench` passed with 53 Vitest files and 557 tests, then 3 no-auth fixture browser tests passed and the auth-backed smoke stayed skipped by design.

`npm run test:portal:browser` covers no-auth fixture rendering for nonblank Model Space Plan, 3D containment, top-projection parity, and object-first/fallback visibility. It should fail if the fixture route redirects to login, becomes unavailable, silently renders hidden top-projection bodies, or shows user-facing legacy fallback failure text.

For 3D or drawing UI work, use Playwright screenshots or visual checks in addition to unit tests. Authenticated edit/save/reload, high-risk visual QA, and persisted staff project checks remain release checks until safe staff data is configured locally or in CI.
