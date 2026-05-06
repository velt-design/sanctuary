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

## Direction: Free-Floating Objects With Snap-Derived Connections

The current geometry model is **pergola-centric and rigidly coupled**: `Assembly3D` IS the pergola, the house is a reference, and `connection.type` ('soffit' | 'fascia' | 'freestanding') is an INPUT that drives where the pergola is placed relative to the house. When the house footprint changes, every dependent object (pergola, deck) is recomputed to maintain its connection — which means dragging a wall drags the pergola with it, and certain footprint edits cause the pergola to rotate or flip.

This was the right model when the only inputs were parametric (`lengthM`, `projectionM`, attachment-side dropdown). It is the wrong model once edits become spatial — drag a polygon edge, snap to another object, free-move a deck.

The intended target model is:

- **Per-object world positions.** Pergolas, decks, and house forms each store their own world position (origin + rotation). House change does not move the pergola unless the user drags it.
- **Connection state is OUTPUT, not INPUT.** The system DERIVES the connection ('soffit' | 'fascia' | 'freestanding') from spatial relationships at solve time — "is the pergola edge aligned with a house wall?" — instead of being told the connection upfront. The cost engine still reads the same `connection.type`-shaped value; it just gets it from a derived field.
- **Snap is the mechanism by which connections are formed and broken.** During edge-drag or move, the snap engine produces candidate alignments. On commit, an alignment becomes a soft snap (position-only) that breaks freely on the next drag, or a hard constraint that holds across re-solves until explicit detach. v1 should ship with soft snaps only.
- **Openings remain rigidly attached to walls.** They do not have a meaningful "freestanding" state. Everything else is free-floating with optional snaps.

The implementation order is:

1. ✅ **Done.** Split `packages/geometry/src/houseModel.ts` (~7700 lines) into 27 focused per-concern files under `packages/geometry/src/house/`. Pure refactor, no behavior change. `houseModel.ts` is now ~690 lines — slim orchestrator + public entry points (`buildHouseModel3D`, `buildHouseReferenceGeometry`, `deriveHouseGableTerminalEndsFromFootprint`, `deriveHouseRoofAppendageSupportFromFootprint`). See `packages/geometry/src/house/README.md` for the per-file map.
2. **In progress.** Introduce a per-object `position` field on pergola (and any other rigidly-positioned object). Geometry consumes `position` directly. `connection.type` becomes a derived field computed at solve time.
   - *Slice A shipped:* `AssemblyPosition` type + optional `position` field on `GeometryConfig`, plumbed through `normalize.ts`.
   - *Slice B shipped then **reverted**:* an attempt to wire `position` into the datum frame via `composeDatumFromPosition` was reverted because rotating/translating the datum origin without applying the same transform to every consumer of `assembly.outline` (e.g. `topProjection.ts`'s canonical pergola_reference shape, which reads local pergola coords `[(0,0), (L,0), (L,P), (0,P)]`) caused the rendered scene objects (in world coords, transformed by datum) to drift out of alignment with the canonical outline after a house resize. `position` remains plumbed end-to-end as **pure metadata** for now; the datum stays world-aligned at the origin.
   - *Slice C shipped:* `position` is now a first-class field on `PergolaObjectModel` + `ObjectFirstPergolaDraft` and on `ObjectWorkbenchPergolaPatch`. `buildRawGeometryModuleInput` reads `pergola.position` and writes it to `RawGeometryModuleInput.position`. The action `commitSharedPergolaPosition` exists but is **not dispatched** from `EdgeDragTool` — the dim-sync commit (Slice D below) took precedence. Position remains addressable from code paths that want to set it programmatically.
   - *Slice D shipped (option a — dimension sync):* pergola edge-drag commits write `lengthM`/`projectionM` derived from polygon extents via `commitSharedPergolaGeometry`. Pergola stays at world origin. **Only the +along (right) and +depth (bottom) walls grow** — left/top wall drags are silent no-ops (would require negative world coords without an origin shift). Companion fixes: `houseFootprintWorldPointToSideLocal` + `buildSideLocalPolygonFromWorld` inverse helpers in `packages/geometry/src/footprints.ts` (eliminate the "house flips on edge drag" sign error for `attachmentSide='rear'`); deck edge-drag commits via `commitSharedHouseDeckPatch({ shape: 'custom', outline })` using the same side-local encoder. EdgeDragTool now publishes hover state on top of preview state — see `apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanEdgeHoverHighlightLayer.tsx`.
   - *Slice B redo shipped (datum composition via post-solve transform):* `packages/geometry/src/applyAssemblyPosition.ts` exposes `applyAssemblyPosition3D(assembly, position)` which translates + rotates every local-coord field on `Assembly3D` (`outline`, `attachmentEdge`, `members.centerline/localFrame`, `members.endCuts.plane`, `roofPlanes`, `roofCladdingPanels`, `roofFlashings.wings`) by the pergola's `position`. `solveAssembly3D` calls it once after the family solver returns. The house reference geometry is intentionally **not** transformed — it lives in world coords already and is shared across pergolas. With `position == null` (the legacy single-pergola case) the call is a no-op, so all 209 existing geometry tests pass unchanged. This is the first slice that genuinely decouples a pergola from world origin and is the prerequisite for multi-pergola support.
   - *Known limitations:* (1) Pergola left/top wall drags don't visually do anything — the hover highlight lights up but the commit no-ops. (2) For non-`rear` attachment sides (`front`/`left`/`right`), the house custom polygon's world position depends on pergola dims via `houseFootprintSideLocalPointToWorld`, so resizing the pergola will also shift the house. (3) Openings have no canonical polygon yet — edge-drag for openings is deferred.
3. Wire the existing `snapEngine.ts` (built but not yet consumed) into `EdgeDragTool` and a future move tool. Snap targets are other object outline edges.
4. Update the cost engine to read the derived connection field. Should be transparent if the derived field shape matches the old `connection.type`.
5. Add UI affordances: visual indicator for snapped edges, drag-to-detach gesture, inspector display of "snapped to wall A".

This is a multi-slice migration across the geometry package, costing engine, persistence shape, and UI. Each phase should land independently with its own tests and a clear rollback boundary. Do not begin Phase 2 before Phase 1 is complete; do not assume the cost engine can absorb the change without explicit migration coverage.

Until the migration completes, edge-drag of a house footprint will reposition attached pergolas/decks per the existing rigid rules. That is expected behaviour, not a regression.

## Multi-Pergola Constraint

The geometry pipeline today assumes **a single pergola pinned at the world origin**. `Assembly3D.outline` is emitted in pergola-local coords (`[(0,0,0), (L,0,0), (L,P,0), (0,P,0)]`), `assembly.datum` is identity, and every solver builds members relative to that origin. The host application can have multiple pergolas in design intent, but the solver currently produces one `Assembly3D` per active pergola; adding a second pergola would require a second solve, but both would land on top of each other at world origin.

Decoupling pergolas from `(0, 0)` is a hard prerequisite for multi-pergola quotes. The shape of the work, with current status:

1. ✅ **Per-pergola world transform.** Each pergola owns an `AssemblyPosition` (origin + rotation around +Z). Plumbed end-to-end (Slice A/C) and now applied at the solver boundary via `applyAssemblyPosition3D`. `commitSharedPergolaPosition` exists but is not dispatched from any UI surface yet — set the field programmatically (or wire a future move tool / second-pergola insertion flow).
2. ✅ **Datum composition.** Re-introduced as a post-solve transform (Slice B redo). Solvers still emit pergola-local geometry; `solveAssembly3D` calls `applyAssemblyPosition3D` once after the family solver returns, lifting every pergola-local field into world space. The originally-reverted `composeDatumFromPosition` in `normalize.ts` is **not** restored — the world transform happens at the solver boundary, not via the config datum.
3. ✅ **Consumer transform alignment.** Solved by routing every consumer through the post-transform `Assembly3D`. Because `applyAssemblyPosition3D` transforms `outline`, `members`, `roofPlanes`, etc. before any consumer sees the assembly, downstream code (`topProjection.ts`, viewer scene, cost engine) reads world coords without needing position-awareness.
4. ⏳ **Multi-active-pergola solve.** `buildGeometryAssembly3D` and the upstream module input pipeline currently produce one assembly per **module** (pergola). To support multiple pergolas in one project the loader/solver pipeline needs to fan out across pergolas, each with its own position, and stitch the results into the same scene. The cost engine and quantity takeoff would also need to aggregate across pergolas.
5. ⏳ **UI for pergola placement.** No surface currently dispatches `commitSharedPergolaPosition`. Either (a) add a Move tool that drags interior of a pergola and commits position, (b) extend EdgeDragTool so left/top wall drags write a position+dim combination instead of being no-ops, or (c) snap-to-house-edge on insertion of a 2nd pergola.

Items (4) and (5) are the remaining blockers for multi-pergola in practice. Items (1)-(3) are shipped and verified by 8 unit tests in `packages/geometry/src/applyAssemblyPosition.test.ts` plus the existing 209 geometry tests passing unchanged.

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
