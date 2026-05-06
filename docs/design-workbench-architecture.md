# Design Workbench Architecture

The design workbench is the portal drawing and model-editing surface for estimate-backed designs. The active workbench migration is sealed around an object-first project model and solved geometry spine. Compatibility remains only as explicit legacy estimate snapshot import/export support and named fallback boundaries.

## Design Workbench North Star: Read/Edit Split

The Design Workbench has one object-first design intent model and one solved geometry artifact. Perspective, Top, Section, Sheet, and elevation views are not separate geometry systems. They are derived presentations of the same solved scene.

The workbench has two render surfaces:

- **`Geometry3DViewport`** -- read-only 3D R3F scene graph. Camera presets (iso/top/front/right). Selecting an object writes into shared selection state; that is its only output. **No drag handlers, no gizmos, no commit paths.** Editing chrome must not appear in 3D, even temporarily.
- **`PlanViewport`** -- the 2D editor. Renders a clean plan drawing from `topProjection` plus overlays (dimensions, hit targets, selection halos, gizmos). All editing -- tools, drag, snap, dimension edits, commits -- lives here.

`DesignViewport.tsx` is the host that mounts the right surface for the active mode (`Sheet | Plan | 3D`). It owns the typed selection seam (`selectionRouter.ts`) shared between 3D and Plan; it does not own editing chrome.

Neither viewport is the source of truth. The source of truth is the object-first design intent plus `WorkbenchSolvedGeometryArtifact`, `viewerScene`, and `topProjection` generated from it.

Interaction loop, all driven from PlanViewport:

- pointer input is converted into plan-projection coordinates (mm) at the input edge.
- selection targets typed object refs through `selectionRouter`, not view-specific shapes.
- drag operates in plan-projection space; conversion to object-frame happens only at the commit boundary.
- commits issue a `Command` through the command bus, mutating design intent.
- the solved artifact rebuilds; both 3D and Plan re-render from the new artifact.

Legacy calculator-era plan geometry is fallback and compatibility only. It must not execute as normal visible body geometry in any geometry-ready surface. Refer to `docs/decision-log.md` for the nine foundational contracts that govern editor growth (single-source intent, three-phase drag, plan-projection math, typed selection, isolated tool state machines, snap-as-a-service, Plan-only gizmos and overlays, mm everywhere, 3D-is-read-only).

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
- `geometry`: package input builders, preview derivation, object-first geometry context, and geometry edit adapters.
- `interactions`: shared object interaction engine plus family adapters.
- `assembly`: semantic assembly builders and geometry contracts.
- `views`: plan/section/elevation view-model builders.
- `details` and `annotations`: generated details and placement policy.

## Object-First Model

The active workbench is object-first:

- House forms, decks, openings, and pergolas are modeled as explicit objects.
- Hosted objects resolve against derived house/building behavior.
- Object-first design intent resolves into one solved geometry artifact. In portal runtime state this contract is named `WorkbenchSolvedGeometryArtifact` and is exposed on `WorkbenchSolvedModule.geometryArtifact`; legacy `geometryPlan`, `geometryTopProjection`, `viewerScene`, `planModel`, and `sectionModel` fields are compatibility aliases or fallback/presentation metadata, not peer geometry truth.
- Workbench shell and viewport routing use `WorkbenchViewportGeometry`: `artifact` carries the canonical solved geometry, `legacyFallback` boxes calculator-era `ModulePlanModel`/`ModuleSectionModel` presenters, and `preview` is derived from the artifact when geometry is ready. Route clients and `WorkbenchViewportHost` should pass this bundle instead of fanning out loose scene/projection/preview fields.
- Sheet and Model Space drawing surfaces receive `WorkbenchDrawingSurfaceGeometry` from the same routing lane. Geometry-ready surfaces use artifact-derived plan, top projection, and section inputs first; calculator-era plan/section models remain boxed compatibility presenters and explicit fallback data. `ModuleDrawingRenderer` receives that drawing-surface contract rather than loose model-space geometry props; lower SVG presenters keep prepared render inputs as internal implementation detail. The renderer has geometry-native plan and section paths for solved artifact views with no legacy `ModulePlanModel`/`ModuleSectionModel` fallback; legacy presenters are only `legacyPlanModel`/`legacySectionModel` compatibility inputs. `buildWorkbenchDrawingSurfaceGeometry` is the named helper that turns the viewport bundle into the sheet/read-model contract, including explicit `solved_geometry`, `legacy_fallback`, and `unavailable` sources. Section SVG rendering now has a geometry-native presentation path for `GeometrySectionViewModel`; `ModuleSectionModel` is the fallback/card compatibility shape rather than geometry-ready section truth.
- Geometry-ready plan, 3D, sheet, section, snap frames, hit targets, dimensions, annotations, and interaction previews are derived views of that artifact, not independent geometric truths.
- Geometry, plan, 3D, section, and sheet views should consume the solved geometry spine rather than each inventing shape truth.
- The solved module's 3D scene and model-space top projection are paired: the projection is generated from the same `ViewerSceneModel` handed to the 3D viewport, with assembly reference shapes carried forward explicitly.
- The scene also carries plan-detail lines for real house wall segments. These project as context lines with wall/snap metadata, do not drive plan extents, and are the preferred live deck host-edge snap source.
- Geometry-ready model-space plan fitting uses `geometryTopProjection.extents`; legacy `ModulePlanModel` dimensions are a fallback path, not the source of scene fit.
- `apps/portal/lib/drawings/commercialDesignPayload.ts` is a callable-only shadow adapter from `WorkbenchSolvedModel` to the commercial boundary. It maps `WorkbenchSolvedGeometryArtifact.quantityTakeoff`, a `@sp/geometry` takeoff built from the same solved `Assembly3D` as plan, section, top projection, and viewer scene; low-level quantity hooks remain compatibility data inside that geometry-owned contract. The adapter does not drive workbench rendering, persistence, quote totals, or live pricing.
- Geometry-ready Model Space is a projection-only surface. Its normal body rendering consumes only top-projection committed bodies that match the 3D Top view; it does not execute legacy pergola plan geometry, semantic house context bodies, legacy footprint bodies, model primary dimensions, fall labels, or context/reference projection bodies. Sheet View and unsupported geometry fallback keep their existing legacy paths.
- Geometry-ready plan mode uses an internal plan render graph with explicit layer ownership: `committedBodies`, `contextLines`, `hitTargets`, `selectionOutlines`, `dimensions`, `dragPreview`, and `debug`. Normal visible body rendering may only consume `committedBodies`; selecting an object may add outlines, hit targets, handles, and dimensions, but must not add another filled house/deck/pergola body.
- Plan coordinate transforms are owned by the plan view layer, not by React render branches. The `PlanCoordinateAdapter` contract is the traceable boundary for projection-to-SVG and SVG-to-projection conversions; Model Space pointer tools should consume this adapter rather than duplicating top-projection math in components.
- Top-projection layer ownership is owned by the plan render graph contract. Model Space presenters consume prepared `committedBodies` and `contextLines` from that graph, while later interaction slices should add `hitTargets`, `selectionOutlines`, `dimensions`, `dragPreview`, and `debug` as explicit graph layers instead of hidden renderer branches.
- `ModuleViewsCard` is now a compatibility shell for calculator card chrome and public exports; drawing-surface orchestration lives in `ModuleDrawingRenderer`. Plan and Section SVG internals live in their own surface modules (`ModulePlanSvg`, `ModuleSectionSvg`) while `ModuleDrawingRenderer` routes status, scale, and plan/section branch orchestration only. The renderer no longer owns or exports broad surface primitives; plan layout, footprint presentation, plan annotations, section presentation, scale presentation, diagnostics, and SVG bridge concerns are implemented in their named modules. Plan layout is split further into shared plan geometry helpers (`ModulePlanGeometryPresentation`), sheet layout (`ModulePlanSheetLayoutPresentation`), and model-space layout (`ModulePlanModelSpaceLayoutPresentation`); `ModulePlanLayoutPresentation` is only a compatibility facade for existing imports. Geometry-native section presentation lives behind `buildGeometrySectionPresentation`, so workbench Section View can draw from the artifact's `GeometrySectionViewModel` without converting it back into a calculator section model. `ModuleDrawingSurfacePrimitives` is limited to shared low-level atoms and SVG/measurement helpers used by more than one owner. Model Space layer JSX lives in the app-local `ModulePlanLayerRenderers` module. Plan SVG presentation prep lives behind `buildPlanSvgPresentationModel`; geometry-backed SVG presentation prep lives behind `buildPlanSvgGeometryPresentation`; Plan SVG client/SVG bridge wiring lives behind `ModulePlanSvgBridge`. Large plan-surface JSX is split into focused PlanSvg presenters for house context, pergola geometry, dimensions, footprint edit controls, and popover chrome; `ModulePlanSvg` remains the composition boundary that wires those presenters together. Shells should not rebuild render-graph ownership, geometry projection arrays, SVG resolver bridges, or duplicate overlay source counts inline.
- Projection-backed overlays must also declare their source. Selection outlines, hit targets, drag previews, and dimensions bind to `top_projection_committed` polygons only. `house_reference`, `top_projection_context`, `geometry_plan_fallback`, opening overlays, and other legacy/reference polygons remain for host/reference math, explicit footprint editing, Sheet/fallback paths, or diagnostics, not normal Model Space overlays.
- Deck dragging in projection-backed plans must invert the same screen-axis transform used to draw the top projection, so pointer movement is screen-native. The live drag session uses the committed top-projection deck polygon, center, grabbed point, hit target, and preview polygon; SVG-only host-edge data and legacy/object polygons are kept out of live plan-space math. If the raw pointer-derived projection point is outside the committed deck polygon, the adapter normalizes both the grabbed point and drag-delta anchor to the same committed deck point and keeps the raw point as diagnostics only, so fallback anchoring cannot double-invert or drift the preview. Live snap candidates come from projected wall-edge context lines when available, with the committed top-projection house body as fallback. All projection-backed releases cross an explicit render-frame to object-frame commit boundary before writing deck fields; frame matching is semantic by wall side/orientation because projection and object footprints can number the same wall differently. Snapped releases persist the preview-derived host/center offset mapped into the object commit frame for the chosen wall, while floating releases build their saved floating rect from the frame-mapped object-space polygon rather than raw projected world XY. Floating releases remain valid away from walls, and late top-projection rebuilds are diagnostics, not user-facing failures.
- Calculator-era drawing surfaces are presenters and compatibility shells. `ModulePlanModel`, legacy sheet plan geometry, semantic house context, and object-workbench overlay polygons may support fallback rendering, explicit edit/reference math, migration, or diagnostics, but they must not be treated as active geometry when solved geometry is available.
- Compatibility or legacy fallback state must stay named and visible in tests or status models, and must not become active geometry truth.
- Workbench guard tests enforce that Sheet and Model Space do not pass loose model-space geometry props into `ModuleDrawingRenderer`; renderer geometry must enter through `WorkbenchDrawingSurfaceGeometry`.

## Geometry And Costing Migration Roadmap

The full migration target is:

```text
object-first design intent
  -> @sp/geometry solved physical model
  -> geometry-derived quantity takeoff
  -> @sp/costing commercial input and pricing
  -> estimates / quotes / invoices / job packs
```

Workbench must not own pricing policy, and costing must not solve geometry. Portal may orchestrate, adapt, persist, and show status, but it must not duplicate package truth. `CommercialDesignInputV1` is allowed as the costing boundary and parity harness, not as a parallel geometry model.

Migration should proceed in this order:

1. Finish routing all geometry-ready plan, 3D, sheet, section, interaction, status, and quantity consumers through `WorkbenchSolvedGeometryArtifact`.
2. Keep the package-owned physical quantity takeoff contract in `packages/geometry` as the source for workbench-solved commercial shadow payloads; extend its physical buckets and parity coverage as solver support grows.
3. Dual-produce `calculator_compat` and `workbench_solved` commercial payloads and compare them with `compareCommercialDesignInputsV1()` across fixtures and representative estimate snapshots.
4. Invert remaining compatibility dependencies where geometry consumes costing-derived output; geometry should produce physical facts and costing should consume them.
5. Roll saved estimate or quote pricing to the workbench-solved commercial path only through an explicit rollout task after parity is stable, then retire compatibility layers in small, tested passes.

Compatibility models may support fallback, migration, or diagnostics. They must not become normal geometry-ready paths, hidden commercial inputs, or long-term takeoff owners. The old `apps/portal/lib/drawings/geometry/compat/` namespace is retired; legacy estimate snapshot compatibility remains in state adapters and explicit fallback boundaries.

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

North-star interaction direction:

- Every authored workbench object should be a first-class interactive object with a stable object ID, family, solved-geometry references, and explicit interaction capabilities.
- The shared interaction layer is the only owner of pointer-session state, interaction-state vocabulary, preview lifecycle, blocked/allowed transitions, and commit diagnostics. `ModelSpaceViewport` and similar presenters host browser events, pointer capture, refs, and visual composition, but they should not branch into family-specific movement policy inline.
- Object-family adapters define what differs per object family: selectable/movable affordances, valid hosts or neighbors, snap candidates, attachment/hosting semantics, clearance/collision checks, movement constraints, preview shaping, and object-first patch generation.
- Object-to-object interaction should resolve against solved geometry, object IDs, and named relationship contracts. Interaction math must not depend on loose renderer overlays, SVG-only shapes, or family-specific viewport state as if those were the durable truth.
- Adding a new movable object should usually mean adding or extending a family adapter plus tests, not duplicating drag/session logic in a new viewport branch.

Deck dragging is the first concrete adapter pattern. Opening adapters also exist and should follow the same contract style.
Model Space object move lifecycles are routed through interaction controllers for deck and opening movement. `ModelSpaceViewport` resolves DOM/client/SVG/projection pointers, pointer capture, scroll anchoring, and persistence callbacks; the controllers own start, move preview, release intent, and commit diagnostics.
Deck release reconciliation is also interaction-owned: frozen preview, commit result state, rebuilt-shape matching, projection settle status, and release feedback are resolved by the deck settlement controller. Deck release-to-patch conversion lives in the focused deck commit adapter, which is the only projection-backed path that maps render-space deck preview polygons into object-frame persisted deck fields. Snapped projection commits use the snap preview's resolved center offset instead of re-projecting a render-space polygon center into a different frame; floating commits serialize the mapped commit-space rectangle. The commit adapter's coordinate trace is carried through settlement and exposed as debug/test diagnostics so preview-to-commit and release-to-rebuilt drift can be measured directly. `ModelSpaceViewport` may schedule animation frames and pass viewport stability into those controllers, but it should not own deck settle or commit-transform policy.
Plan dimension editing is also interaction-owned. `planDimensionEditController` validates dimension annotation edits and returns typed commit intents for house footprint edits, deck patches, and opening patches; `ModelSpaceViewport` keeps the popover, focus, error state, and persistence callback boundary, but it should not own dimension-specific patch math.
Footprint editing and draw-outline lifecycles are interaction-owned. `footprintEditController` resolves footprint control, handle, vertex, edge-add, and vertex-delete intents; `drawOutlineToolController` resolves outline select, hover, pointer-session, click-vs-pan transitions, distance-lock, undo, close, cancel, and custom-polygon commit intents. `ModelSpaceViewport` keeps DOM pointer capture, pan/zoom, popover positioning, refs, and persistence callback calls.
Model Space navigation math is interaction/view-domain owned. `modelSpaceNavigationController` owns zoom clamping, anchored zoom, fit-view transforms, mouse pan, touch pinch, WebKit gesture scale, wheel gesture classification, and deck-drag navigation lock decisions. `ModelSpaceViewport` keeps browser event registration, refs, active touch bookkeeping, pointer capture, scroll anchoring, and viewport transform persistence.
Legacy plan field resize math is interaction-owned. `planFieldResizeController` owns editable field lookup, resize start value resolution, SVG delta-to-metres conversion, clamping, and drawing field value formatting for `plan:lengthA` and `plan:spanA`; `ModelSpaceViewport` keeps refs, pointer listeners, hover/active state, field errors, and `onCommitField` persistence calls.

## Direction: First-Class Spatial Entities

The design north star: **every object — pergola, house, deck, opening — is a first-class spatial entity.** Each owns its own world position (origin + rotation around +Z) and its own outline expressed in its own local frame. Objects are spatially independent — moving or resizing one does not silently shift another. Connections between objects are *derived* from spatial alignment at solve time, not baked into the data model as positioning inputs.

This replaces the legacy **pergola-centric** model the codebase grew from, where `Assembly3D` *is* the pergola, world origin *is* the pergola origin, and the house and decks are positioned by frames sized from pergola dimensions. That model was right when the only inputs were parametric (`lengthM`, `projectionM`, attachment-side dropdown); it is wrong once edits are spatial (drag an edge, snap to a wall, free-move a deck).

### The principle, stated as invariants

1. **Origin independence.** No object's position is implicitly defined by another object's position or dimensions. Each object's `position` is the canonical source of truth for where it sits in world space.
2. **Local-frame outlines.** Each object stores its outline in its own local frame, with `(0, 0)` at the object's anchor. The world-space outline is derived by applying the object's `position`.
3. **Derived connections.** `connection.type` ('soffit' | 'fascia' | 'wall' | 'freestanding') is computed from spatial alignment between objects, not configured by the user. The cost engine reads the derived value through the existing `connection.type` shape — internal change, no callers re-wire.
4. **Snap is the connection-formation mechanism.** During edge-drag or move, the snap engine surfaces candidate alignments to other objects' edges/walls. Commit produces a soft snap (position-only, breaks on next drag) or a hard constraint (holds across re-solves until explicit detach). v1 ships soft snaps only.
5. **Openings are the one exception.** Openings are rigidly attached to walls — they have no meaningful freestanding state. Their "position" is a wall-local offset, not a world position.

### Legacy compat sites that violate the principle (audit, current as of 2026-05-07)

The audit below is the canonical to-do list for the migration. Each item names the file, the violation, and the migration target. Do not introduce new code that depends on these patterns.

| Site | Violation | Target |
|---|---|---|
| `packages/geometry/src/footprints.ts:132–226` (`resolveHouseFootprintFrame`, `houseFootprintSideLocalPointToWorld`) | House footprint frame is parameterised by `pergolaWidthMm`, `pergolaDepthMm`, and the pergola's `attachmentSide`. House polygon storage is `(alongM, depthM)` *relative to the pergola*. | House owns its own world-coord footprint. Drop the frame parameter on side-local converters or delete the converters entirely. |
| `packages/geometry/src/normalize.ts:470–530` (deck handling in `buildHouseModelConfig`) | Deck outline is decoded against a hardcoded `pergolaWidthMm: 1000, pergolaDepthMm: 1000` placeholder frame. Deck still nominally references a pergola attachment side. | Deck owns its own world-coord outline. Remove the hardcoded frame. Replace deck `hostEdgeId` (currently a pergola-perspective `AttachmentSide`) with an absolute reference to a house wall edge or "floating". |
| `apps/portal/lib/drawings/state/objectWorkbenchDeckGeometry.ts:36–89` (`DeckHostEdgeFrame`, `resolveDeckGeometryHostEdgeId`) | Deck "host edge" is normalised to an `AttachmentSide` (rear/front/left/right) — a pergola-local concept. | Deck host edge becomes an absolute house-wall ID; the rear/front/left/right enum becomes a derived label, not a stored field. |
| `apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts` (`HouseFormFootprintModel.attachmentSide`, `OpeningObjectModel.wallId`, deck host references) | Non-pergola objects carry pergola-relative `AttachmentSide` semantics in their persisted shape. | Each non-pergola object expresses its spatial relationships using absolute IDs (wall id, edge id) or its own world `position`. `AttachmentSide` becomes a derived label for UI labels only. |
| `packages/geometry/src/applyAssemblyPosition.ts:139–141` (house deliberately *not* transformed) | The post-solve world transform is applied to the pergola only; the house is left at its world position. This works for 1 pergola + 1 house but pins the house to be shared by all pergolas in a multi-pergola scene. | When the house becomes a first-class entity with its own `position`, transform it via the same `applyAssemblyPosition3D` boundary using its own position. Pergolas + houses become independently positioned. |
| `packages/geometry/src/topProjection.ts:547–592` (`buildReferenceShapes`) | Emits exactly one `house_reference` shape and one `pergola_reference` shape. Assumes one of each. | Accept a list of objects per family; emit one canonical reference shape per object instance. |
| `packages/geometry/src/takeoff.ts:56–64` (`dimensionsFromOutline`) | Pergola dimensions are derived from the singleton `assembly.outline` bounding box. | Per-pergola takeoff: one `Assembly3D` per pergola object, each with its own outline + dims. |
| `packages/geometry/src/contracts.ts:1–11` (file header comment), `contracts.ts:1099–1124` (`Assembly3D` is singular) | Documentation and type both encode "the assembly = the pergola." | `Assembly3D` becomes "an instance of any spatial entity"; project state holds an array of assemblies, one per object. Header comment becomes "Assembly space: object-local. World space: post-`applyAssemblyPosition3D`." |
| `apps/portal/lib/drawings/geometry/buildRawGeometryModuleInput.ts` (deck frame hardcode, `attachmentSide` plumbing) | Builds a `RawGeometryModuleInput` per pergola module; non-pergola objects are wrapped into the pergola's `houseContext` rather than being independent. | Drop the wrapping. Each object family has its own raw input shape with its own position + outline. The geometry pipeline iterates per object, not per pergola. |

### Migration order (incremental, with integration tests at each step)

1. ✅ **Pergola post-solve world transform** (shipped). `packages/geometry/src/applyAssemblyPosition.ts` lifts a solved pergola from local to world coords by its `position`. `solveAssembly3D` invokes it once after the family solver returns; legacy `position == null` case is a no-op so all 209 existing geometry tests pass unchanged. 8 unit tests cover the transform.
2. ⏳ **UI dispatch for pergola position** — currently no surface writes `pergola.position`. Until this lands, the post-solve transform is dormant. Approach: extend `EdgeDragTool` so left/top wall drags write a `position` shift while right/bottom drags write a `lengthM`/`projectionM` grow; or add a Move tool that drags the pergola interior. Either way the data plumbing is already in place (`commitObjectWorkbenchPatch` accepts `patch.position` end-to-end).
3. ⏳ **House first-class entity.** Staged migration. Each stage ships with tests and is independently revertable.
   - **3.1 — Data plumbing (in progress).** Add `position?: HouseFormPosition` field to `HouseFormFootprintModel` and a parallel `position` field to `RawGeometryModuleInput.houseContext`. Both are optional, default null, and have no consumer yet. *Status:* types added 2026-05-07; safe additive change. No behavior change.
   - **3.2 — Decoder branch.** When `houseContext.position` is set, `buildHouseModelConfig` uses a unit (1m × 1m) frame for `buildCustomHouseFootprintPolygon` and applies the position transform post-decode. When null, falls back to the legacy real-frame decoder. Backward-compatible: legacy data with no position set continues to render exactly as today.
   - **3.3 — Migration on load.** When the project model is built from a legacy snapshot or draft, populate `house.position` from the current pergola dimensions using the migration math: `'rear'` and `'left'` get `(0, 0)`; `'front'` gets `(0, (pergolaDepthM - 1) × 1000)`; `'right'` gets `((pergolaWidthM - 1) × 1000, 0)`. Once populated, the house is now decoupled from the pergola — pergola resize will no longer shift the house. Snapshot persistence: store `houseFootprintPosition` as a new optional field on `CalculatorModuleInputs` (additive); legacy snapshots without it trigger the migration on load. Drafts persist position via the existing patch mechanism.
   - **3.4 — Edge-drag commit.** Update the house edge-drag commit handler to encode the world polygon against the unit frame using the *current* `house.position`, then write the new polygon. Position can stay or be updated to `bbox(nextPolygon).min` if the user dragged the house bodily; for now the simpler "polygon coords absorb the change, position stays" behavior matches the current data model.

   **Why staged**: each step is mechanically simple but the four together touch ~8 files in lockstep, and a half-done migration introduces invisible drift (legacy data reads via one decoder, new data via the other, edge-drag commits don't match the migration). Better to land each stage with its own integration test than to attempt all four at once.

4. ⏳ **Deck first-class entity.** Same migration shape as the house: 4.1 add `position` field; 4.2 add decoder branch; 4.3 migrate on load; 4.4 edge-drag commit. The deck is already partially decoupled — the geometry decoder uses a hardcoded 1m × 1m frame at `normalize.ts:470-530`, so the deck's `(alongM, depthM)` polygon already behaves like unit-frame coords. The remaining coupling is `hostEdgeId: AttachmentSide` (a pergola-perspective concept on a non-pergola object); migrate to an absolute house-wall edge id.
5. ⏳ **Multi-active-object solve.** The solver pipeline iterates over all objects in the project (one or many pergolas, one house, many decks), each producing its own `Assembly3D` with its own position applied. The viewer scene + top projection accept a list of assemblies; the cost engine aggregates per object.
6. ⏳ **Wire `snapEngine.ts`** into edge-drag and move tools. Snap targets become other objects' outline edges and walls.
7. ⏳ **Derive `connection.type`** at solve time from spatial alignment. Cost engine continues to read the same shape; only the producer changes.

Each step ships with an integration test that locks the new invariant (e.g. "pergola at position X renders at world X", "house with custom polygon stays put when pergola dims change", "deck stays put when pergola is moved or resized"). The tests are the architectural guardrails that prevent drift back to the pergola-centric model.

### Until the migration completes

- Edge-drag of a house footprint may visibly reposition attached pergolas/decks for non-`rear` attachment sides — that is expected behaviour given the legacy frame coupling, not a regression.
- Pergola edge-drag of left/top walls is a silent no-op (would require negative world coords without `position` being wired). Will be fixed by step 2.
- Adding a second pergola to a project will render both at world origin (overlapping) — blocked by step 5.

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

Latest local signal: on 2026-05-04, `npm run test:portal:workbench` passed with 58 Vitest files and 589 tests, then 7 no-auth fixture browser tests passed and the auth-backed smoke stayed skipped by design.

`npm run test:portal:browser` covers no-auth fixture rendering for nonblank Model Space Plan, 3D containment, top-projection parity, and object-first/fallback visibility across the mono, gable, box, mono-join, and screenshot-style hipped fixture shapes. It also checks compact fixture-only browser diagnostics for the shadow `workbench_solved` commercial source, ready trust status, solved-geometry quantity takeoff source, no blocking readiness gates, and commercial parity counts. It should fail if the fixture route redirects to login, becomes unavailable, silently renders hidden top-projection bodies, loses the workbench-solved readiness signal, or shows user-facing legacy fallback failure text.

`apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.ts` carries fixture-only QA metadata for the baked workbench fixtures: source, purpose, parity-critical status, geometry family, authored house roof form, expected dimensions, material, attachment side, pitch, roof type, and roof plane count. `listParityCriticalSanctuaryGeometryWorkbenchFixtures()` is the shared registry for baked fixture parity gates. Representative saved estimate snapshot cases live in the commercial parity harness until a checked-in saved snapshot fixture corpus exists; do not invent private-data fixtures or bless drift without understanding the geometry change.

`apps/portal/lib/drawings/commercialDesignPayload.test.ts` dual-produces `calculator_compat` and `workbench_solved` commercial payloads across the parity-critical workbench fixtures and representative saved estimate snapshots. It fails on missing comparable structures, blocking parity differences, or drift in parity-critical authored dimensions, material, roof type, attachment side, pitch, roof plane count, primary takeoff dimensions, and geometry-owned per-plane takeoff fields such as area, rafter length, and bay count. Snapshot parity also asserts warning drift is classified by authored intent, solved geometry, physical takeoff, or commercial mapping, with `originDetail` explaining the source category and field path. This is comparison signal only; it must not switch live estimate, quote, invoice, job-pack, or public pricing to `workbench_solved`.

For 3D or drawing UI work, use Playwright screenshots or visual checks in addition to unit tests. Authenticated edit/save/reload, high-risk visual QA, and persisted staff project checks remain release checks until safe staff data is configured locally or in CI.
