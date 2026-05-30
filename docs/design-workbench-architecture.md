# Design Workbench Architecture

## Read First

- Start with `## Product North Star (READ FIRST)` for every workbench, drawing, geometry, or cost-input change.
- Use `## Object-First Model`, `## Attachment Model: Snap-Derived Connections`, and `## Drawing Persistence` for implementation routing.
- Use `docs/design-workbench-multi-object-goal.md` for the current multi-house and multi-pergola campaign handoff.

## Product North Star (READ FIRST)

> This section gates every change to `apps/portal/lib/drawings/`, `apps/portal/components/drawings/`, `packages/geometry/src/`, and the costing engine's input layer. If a PR you're proposing doesn't fit one of the directions below, stop and ask before writing code.

Active campaign: [Design Workbench Multi-Object Goal](design-workbench-multi-object-goal.md) is the compact goal contract for moving from the current object-first foundation to robust multiple-house and multiple-pergola editing.

### The product

**A single solved geometry model that serves many UI shells.** The marketing-site self-design tool, the on-site sales tool, the full designer workbench, and the future standalone tradie tool all read and write the **same object-first model**. The Rhino/Vray export reads from it. The costing engine reads from it. The model is the product; UIs are thin layers over it.

### Three load-bearing decisions (locked 2026-05-22)

These are gates. Every PR must respect them.

1. **No "primary" form.** All house forms are peers. The legacy `LEGACY_PRIMARY_HOUSE_FORM_ID = 'house-main'` special-casing is being retired. A new design starts with zero forms; the user adds what they want.
2. **No hierarchy in the data.** The model does not know which form is "main." Any visual prominence belongs to the UI shell, not the model. (Customers and tradies will have different ideas of "main"; the model doesn't take sides.)
3. **Drag + snap is the only authoring flow.** A new deck, opening, or pergola is born freestanding. The user drags it to a host; the snap engine creates the attachment. There is no "select host first, then add" flow. Openings are the one exception (rigid wall attachment — see invariant 5).

### The 5 invariants (full detail in § "Direction" below)

1. **Origin independence.** No object's position is implicitly defined by another object's position or dimensions. Each object's `position` is the canonical source of truth.
2. **Local-frame outlines.** Each object stores its outline in its own local frame, with `(0, 0)` at the object's anchor. World-space outline is derived by applying `position`.
3. **Derived connections.** `connection.type` (`soffit`/`fascia`/`wall`/`freestanding`) is computed from spatial alignment at solve time, not stored as a user choice.
4. **Snap is the connection-formation mechanism.** During drag, the snap engine surfaces alignment candidates. Commit produces a soft snap (breaks on next drag) — that is how attachments are made.
5. **Openings are the exception.** Openings are rigidly attached to walls; their position is a wall-local offset, not a world position.

### Costing direction

The costing engine reads from the solved geometry, not from raw inputs. **We are rebuilding the costing engine's input layer around the workbench**, not the other way around. The cost engine's pricing logic (per-rafter, per-flashing, materials, labour, overheads) stays — it is hard-won and not being thrown out. What changes is the layer that feeds it.

This happens in **two phases**:

- **Phase 1 — workbench cull** ✅ shipped 2026-05-22. Legacy calc-era patterns removed, every object first-class, snap-derived connections. Cost engine unchanged; a thin temporary adapter (`costingPayload.ts`) converts the new model into the cost engine's current input shape. Email-quote path unchanged. See [Legacy Cull Plan](design-workbench-legacy-cull.md) for the retrospective.
- **Phase 2 — bridge deletion + cost engine input migration** ✅ substantially shipped 2026-05-23. Cost engine receives scene-derived input via `SiteInputsV2` carrying **pergola data only** — house/deck/opening data exists in the scene but is not costed. Pergola module grouping is derived from spatial adjacency (snapped pergolas = same logical pergola). Workbench's save-reprice goes through `WorkbenchProjectModel` → `buildSiteInputsV2FromScene` → `calculateSiteCostV2`. Marketing email path unchanged (still V1). Remaining: per-object solve loop (`workbenchSolvedModel.ts`), test-surface migration (40+ test cases on legacy carrier), other-shell V1 paths (calculator UI, commercial design, staff API). See [Phase 2 Plan](design-workbench-phase-2-plan.md) for status + lessons learned.

### North star progress (2026-05-30)

The product north star is "a single solved geometry model that serves many UI shells." Where we are:

- ✅ **Canonical project shape** (`WorkbenchProjectModel`): object-first, snap-derived attachments, every object owns its world position + local outline. Workbench layer fully on this shape.
- ✅ **Scene-derived cost engine input** (`SiteInputsV2`): cost engine consumes pergola data derived from scene adjacency. Snapped pergolas are modules of one logical pergola; unconnected pergolas are separate. Pure derivation, no stored field.
- ✅ **First-class spatial entities**: pergolas, decks, openings, house forms all own their geometry. No more "primary vs. additional" special-casing. Snap engine produces all attachments.
- ✅ **Project house geometry registry**: `WorkbenchSolvedModel.projectHouseGeometries` derives one canonical `house_reference:<formId>`, `HouseReferenceGeometry`, and `HouseModel3D` per valid house form. Plan references, host-excluded 3D scene composition, and PlanViewport house snap sources consume this registry instead of rebuilding host/non-host branches.
- 🟡 **Per-object solve**: the workbench now builds an explicit persisted + transient pergola solve-source list, groups object-first sources by host house form, and routes those groups through the package-level `solveProject` boundary. Object-first pergolas without a persisted module now use a runtime-only solve source, the rail can add new freestanding object-first pergolas through that path, Plan Editor and 3D Review aggregate full solved bodies for every valid pergola id, and selection routes by `pergolaId`. The active pergola is stored as `DrawingWorkbenchUiState.activePergolaId`; `activeModuleIndex` is only a temporary compatibility projection while `WorkbenchSolvedModel.modules[]` remains. Invalid/unsupported selected pergolas use reference/context fallback while Plan and 3D keep rendering from a stable ready project basis. The solve spine still adapts each pergola through temporary `CalculatorModuleInputs` / `RawGeometryModuleInput.houseContext` shapes until the full per-object rewrite lands.
- 🟡 **Legacy bridge code retired**: cross-file bridge synthesis deleted; `state/compat/` deleted; `HouseFirst*` draft types still used by test carrier (40+ tests pending migration); `legacyEstimateSnapshotAdapter` still loads-bears initial-state synthesis from calc-era server snapshots.
- ❌ **Multi-shell consumers** (marketing self-design upgrade, sales tool, tradie tool, Rhino/Vray export): not started, per Q6 ("all other shells worked on once the solved geometry and data model is polished and clean"). The workbench is the foundation; other shells consume the same `WorkbenchProjectModel` once Phase 2 fully lands.

The substantive Phase 1+2 work is done. The model is canonical, the cost engine reads from it, attachments are scene-derived. What's left is geometry-pipeline cleanup (per-object solve) and the multi-shell rollout — both unblocked by the core architecture being right.

### Anti-pattern alert — STOP if your PR does any of these

- Adds an `if (form.id === LEGACY_PRIMARY)` check or any "primary vs. additional" distinction
- Stores or reads `attachmentSide` as a positional concept (it survives only as a derived UI label)
- Calls `buildHouseFootprintPolygon({ pergolaWidthMm, pergolaDepthMm })` for a non-pergola use
- Wires a deck/opening/pergola position relative to a host's polygon (use world position + snap reference)
- Adds a "select host first" UX flow for any object family except openings
- Documents a workaround in `docs/decision-log.md` without first asking "can we just delete the legacy code instead?"
- Introduces a new file under `state/compat/` or similar legacy-bridging namespace

The legacy audit at § "Legacy compat sites that violate the principle" (further down this doc) is the canonical to-do list. With the cull permission granted 2026-05-22, **most rows are now DELETE candidates, not migration candidates** — the calculator-driven path is being removed, not double-maintained.

PRs that close audit rows are encouraged. PRs that extend them must justify it explicitly to the user before any code is written.

### Project View Stability

Plan and 3D must not depend on the selected pergola having a valid solved artifact. `WorkbenchSolvedModel.projectViewportGeometry` and `projectGeometryPreview` provide the stable project basis: active ready module first, otherwise the first ready module. Invalid or unsupported selected pergolas stay selectable as reference/context objects while valid houses and pergolas remain visible.

This rule is a render contract, not permission to invent fake geometry. If a pergola is invalid, show its reference/context outline and inspector/trust state; do not fabricate posts, roof planes, costing rows, or 3D bodies.

### Marketing-site enquiry path (preserve, do not touch in Phase 1)

The current marketing-site enquiry form collects fields that feed the calculator and trigger an automated estimate email. **The enquiry form stays.** Whatever it collects, a thin server-side adapter converts it to a simple object model (e.g., 1 house form + 1 pergola), which flows through the new solver → cost engine → email. Customer-facing surface is unchanged in Phase 1. (Future: a "design in the simple workbench" upgrade for the marketing site is a separate project, parallel to the form, both producing the same model.)

### Phase 1 acceptance — what must NOT break vs what CAN break

**Locked 2026-05-22.** The user explicitly authorised aggressive cull-and-rebuild work in the workbench. Phase 1 protects only one user-facing path:

**MUST NOT break:**
- The marketing-site enquiry → automated estimate email path: `apps/marketing/app/contact/page.tsx` → `apps/marketing/app/api/enquiry/route.ts` → `calculateCostV1()` from `@sp/costing` → `sendCustomerAutoresponder()` from `apps/marketing/lib/email/sendCustomerAutoresponder.ts`. **This path is fully independent of the workbench** — it goes form → API → costing package → email, without touching `apps/portal/lib/drawings/` at all.

**Implication: workbench refactors cannot break this path** as long as they don't modify:
- `@sp/costing/calculateCostV1` signature
- `CostInputsV1` shape (in `@sp/costing`)
- `EnquiryPayload` shape (in `apps/marketing/emails/types.ts`)
- The form contract at `apps/marketing/app/contact/page.tsx` line 293+

These four boundaries are the actual Phase 1 protect-list. Everything inside `apps/portal/lib/drawings/`, `apps/portal/components/drawings/`, and `packages/geometry/` (except the geometry types the cost engine consumes) is fair game.

**CAN break temporarily during Phase 1:**
- Workbench UI interactions (pergola attachment, deck snapping, rail buttons). Acceptable degradation while the cull is in flight.
- Project model byte-identity against fixture snapshots. Tests get updated alongside the PR that changes behavior.
- Visual rendering of attachment zones, snap targets, etc. As long as the underlying data is preserved, broken visuals get fixed in the rebuild.

**Implication for scoping decisions:**
- "Will this break the workbench UX?" is NOT a blocker.
- "Will this break the email-quote path?" IS a blocker.
- The previously-strict byte-identity rule was self-imposed and is retired. Update test fixtures freely.
- Refactors that previously required careful gradual migration (parameterised consolidations, dual-path support) can now be replaced with simpler delete-and-rebuild cycles.

The user is the only daily workbench user during Phase 1, has confirmed they're OK with degraded UX in exchange for faster progress to a clean foundation. **The goal is "end state quickly", not "no regressions along the way".**

### When to read this section

- **Every PR that touches** drawing state, drawings components, the geometry package, or the cost engine input layer.
- **Before proposing any "next task"** — the task must either close an audit row, advance Phase 1 cull, advance Phase 2 cost engine migration, or be explicitly cleared by the user as a new feature.
- **When in doubt**, default to: if your change requires a workaround comment, this section says no. Fix the foundation instead.

---

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

Viewport routing should pass solved geometry bundles, not loose scene/projection fragments. `WorkbenchViewportGeometry` is the per-active-object bundle; `WorkbenchSolvedModel.projectViewportGeometry` is the project-level fallback basis used by Plan when the selected object has no artifact.

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
- `apps/portal/lib/drawings/commercialDesignPayload.ts` is a callable-only shadow adapter from `WorkbenchSolvedProject` to the commercial boundary. It maps each solved pergola's `WorkbenchSolvedGeometryArtifact.quantityTakeoff`, a `@sp/geometry` takeoff built from the same solved `Assembly3D` as plan, section, top projection, and viewer scene; low-level quantity hooks remain compatibility data inside that geometry-owned contract. The adapter does not drive workbench rendering, quote totals, or live pricing, and saved estimate persistence may use `workbench_solved` only through the server-owned rollout gate.
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

The design north star: **every object -- pergola, house, deck, opening -- is a first-class spatial entity.** Each owns its own world position (origin + rotation around +Z) and its own outline expressed in its own local frame. Objects are spatially independent -- moving or resizing one does not silently shift another. Connections between objects are *derived* from spatial alignment at solve time, not baked into the data model as positioning inputs.

This replaces the legacy **pergola-centric** model the codebase grew from, where `Assembly3D` *is* the pergola, world origin *is* the pergola origin, and the house and decks are positioned by frames sized from pergola dimensions. That model was right when the only inputs were parametric (`lengthM`, `projectionM`, attachment-side dropdown); it is wrong once edits are spatial (drag an edge, snap to a wall, free-move a deck).

### The principle, stated as invariants

1. **Origin independence.** No object's position is implicitly defined by another object's position or dimensions. Each object's `position` is the canonical source of truth for where it sits in world space.
2. **Local-frame outlines.** Each object stores its outline in its own local frame, with `(0, 0)` at the object's anchor. The world-space outline is derived by applying the object's `position`.
3. **Derived connections.** `connection.type` ('soffit' | 'fascia' | 'wall' | 'freestanding') is computed from spatial alignment between objects, not configured by the user. The cost engine reads the derived value through the existing `connection.type` shape -- internal change, no callers re-wire.
4. **Snap is the connection-formation mechanism.** During edge-drag or move, the snap engine surfaces candidate alignments to other objects' edges/walls. Commit produces a soft snap (position-only, breaks on next drag) or a hard constraint (holds across re-solves until explicit detach). v1 ships soft snaps only.
5. **Openings are the one exception.** Openings are rigidly attached to walls -- they have no meaningful freestanding state. Their "position" is a wall-local offset, not a world position.

### Legacy compat sites that violate the principle (audit, current as of 2026-05-07)

The audit below is the canonical to-do list for the migration. Each item names the file, the violation, and the migration target. Do not introduce new code that depends on these patterns.

| # | Site | Violation | Target | Status |
|---|---|---|---|---|
| 1 | `packages/geometry/src/footprints.ts:132-226` (`resolveHouseFootprintFrame`, `houseFootprintSideLocalPointToWorld`) | House footprint frame is parameterised by `pergolaWidthMm`, `pergolaDepthMm`, and the pergola's `attachmentSide`. House polygon storage is `(alongM, depthM)` *relative to the pergola*. | House owns its own world-coord footprint. Drop the frame parameter on side-local converters or delete the converters entirely. | [wip] worked around (Step 3.4 -- house edits use unit `1m x 1m` frame + `houseFootprintPosition` overlay); converters not yet deleted |
| 2 | `packages/geometry/src/normalize.ts:470-530` (deck handling in `buildHouseModelConfig`) | Deck outline is decoded against a hardcoded `pergolaWidthMm: 1000, pergolaDepthMm: 1000` placeholder frame. Deck still nominally references a pergola attachment side. | Deck owns its own world-coord outline. Remove the hardcoded frame. Replace deck `hostEdgeId` (currently a pergola-perspective `AttachmentSide`) with an absolute reference to a house wall edge or "floating". | [wip] worked around (Step 4.5 -- deck position overlay + standardized 'rear' frame for first-class decks); `hostEdgeId` still pergola-perspective |
| 3 | `apps/portal/lib/drawings/state/objectWorkbenchDeckGeometry.ts:36-89` (`DeckHostEdgeFrame`, `resolveDeckGeometryHostEdgeId`) | Deck "host edge" is normalised to an `AttachmentSide` (rear/front/left/right) -- a pergola-local concept. | Deck host edge becomes an absolute house-wall ID; the rear/front/left/right enum becomes a derived label, not a stored field. | [pending] pending |
| 4 | `apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts` (`HouseFormFootprintModel.attachmentSide`, `OpeningObjectModel.wallId`, deck host references) | Non-pergola objects carry pergola-relative `AttachmentSide` semantics in their persisted shape. | Each non-pergola object expresses its spatial relationships using absolute IDs (wall id, edge id) or its own world `position`. `AttachmentSide` becomes a derived label for UI labels only. | [wip] partial -- pergola.attachment uses absolute `host.edgeId` (Step 8); house & deck still carry `attachmentSide` |
| 5 | `packages/geometry/src/applyAssemblyPosition.ts` (house transform routed through boundary) | The post-solve world transform is applied to the pergola only; the house is left at its world position. This works for 1 pergola + 1 house but pins the house to be shared by all pergolas in a multi-pergola scene. | When the house becomes a first-class entity with its own `position`, transform it via the same `applyAssemblyPosition3D` boundary using its own position. Pergolas + houses become independently positioned. | [done] shipped (milestone 12) -- `HouseReferenceGeometry.position` carries the house's world transform; `applyAssemblyPosition3D` reads it and translates `assembly.house.{footprint, fasciaLine, roofEdgeLine, wallPlane, model, attachmentTarget}` independently of the pergola transform; `normalize.ts` no longer pre-translates the house footprint when `houseFootprintPosition` is set; pergola and house transforms are now independent at the boundary |
| 6 | `packages/geometry/src/topProjection.ts:547-592` (`buildReferenceShapes`) | Emits exactly one `house_reference` shape and one `pergola_reference` shape. Assumes one of each. | Accept a list of objects per family; emit one canonical reference shape per object instance. | [done] shipped (Step 5b + 5c -- `buildReferenceShapes` accepts per-instance ids; `buildProjectReferenceShapes` aggregates N pergolas with house dedupe) |
| 7 | `packages/geometry/src/takeoff.ts:56-64` (`dimensionsFromOutline`) | Pergola dimensions are derived from the singleton `assembly.outline` bounding box. | Per-pergola takeoff: one `Assembly3D` per pergola object, each with its own outline + dims. | [done] already correct -- workbench solves per-module so `assembly.outline` IS the per-pergola outline; `WorkbenchSolvedModel.modules` holds one assembly + takeoff per pergola |
| 8 | `packages/geometry/src/contracts.ts:1-11` (file header comment), `contracts.ts` (`Assembly3D` is singular) | Documentation and type both encode "the assembly = the pergola." | `Assembly3D` becomes "an instance of any spatial entity"; project state holds an array of assemblies, one per object. Header comment becomes "Assembly space: object-local. World space: post-`applyAssemblyPosition3D`." | [done] shipped (Step 5e -- file header + `Assembly3D` JSDoc rewritten to per-instance / per-project semantics; the project state already holds the array via `WorkbenchSolvedModel.modules`) |
| 9 | `apps/portal/lib/drawings/geometry/buildRawGeometryModuleInput.ts` (deck frame hardcode, `attachmentSide` plumbing) | Builds a `RawGeometryModuleInput` per pergola module; non-pergola objects are wrapped into the pergola's `houseContext` rather than being independent. | Drop the wrapping. Each object family has its own raw input shape with its own position + outline. The geometry pipeline iterates per object, not per pergola. | [pending] pending -- needs the per-house first-class assembly (audit row 5) before wrapping can fully retire |

## Attachment Model: Snap-Derived Connections

Each object owns its own world position (per the first-class spatial entity invariants). Connections between objects -- which the cost engine reads to drive flashing, brackets, ledgers, etc. -- are **derived from spatial alignment**, never set explicitly by the user. This section captures the data model and rule set the snap engine produces.

### Spatial relationship vs. attachment method

The legacy `connection.type` enum (`'soffit' | 'fascia' | 'wall' | 'freestanding'`) conflates two orthogonal axes. The first-class model splits them:

- **Spatial relationship** -- *where the pergola is snapped*. One of `'wall'`, `'roof_edge'`, `'pergola_outline'`, or `'freestanding'`. Derived from the snap target's edge kind.
- **Attachment method** -- *how it physically connects*, only meaningful when the spatial relationship has multiple valid methods. Driven by user choice, but with a domain conditional on the spatial relationship.

| Spatial relationship | Valid methods | Source |
|---|---|---|
| `wall` | `facade_ledger` | Derived (only one valid method) |
| `roof_edge` | `fascia_under_gutter`, `direct_to_soffit`, `soffit_brackets` | **User picks** in the inspector |
| `pergola_outline` | `none` *(plus future: shared post / bracket-to-pergola)* | Derived |
| `freestanding` | `none` | Derived (no host) |

The legacy `connection.type` enum is preserved as a derived projection over `(spatialRelationship, method)` for the cost engine's existing reads -- so internal changes don't ripple through pricing logic.

### Attachment data shape

Per-pergola, replacing `attachmentSide` + `connection.type` + `attachmentStrategy` flat fields:

```ts
type PergolaAttachment = {
  // Derived from snap; null when the pergola is freestanding.
  host: {
    objectFamily: 'house_forms' | 'pergolas';  // future-proof for pergola-to-pergola
    objectId: string;                           // e.g. house form id or pergola id
    edgeKind: 'wall' | 'roof_eave' | 'pergola_outline';
    edgeId: string;                             // absolute id of the host edge
    myEdgeIndex: number;                        // which edge of MY polygon is snapped
  } | null;
  // Spatial relationship, derived from `host.edgeKind` (or 'freestanding' if host is null).
  spatialKind: 'wall' | 'roof_edge' | 'pergola_outline' | 'freestanding';
  // Attachment method. Only writable when `spatialKind === 'roof_edge'`; otherwise
  // a single-valued derived label (`facade_ledger` / `none`).
  method: 'facade_ledger' | 'fascia_under_gutter' | 'direct_to_soffit'
        | 'soffit_brackets' | 'none';
};
```

`attachmentSide` (`'rear' | 'front' | 'left' | 'right'`) becomes a **UI-only label**, derived from the geometric relation between `host.edgeId` and the pergola's outline. It is no longer stored.

Decks follow the same shape (with the method field collapsed; decks only attach to walls):

```ts
type DeckAttachment = {
  host: { objectFamily: 'house_forms'; objectId: string; edgeKind: 'wall'; edgeId: string; myEdgeIndex: number } | null;
  spatialKind: 'wall' | 'freestanding';
};
```

Openings remain rigidly attached to walls; their `wallId` becomes an absolute wall edge id, not a side enum.

### Snap rule set

The snap engine surfaces candidate alignments during edge-drag and move. On commit, the alignment that satisfies the rules (parallel within angular tolerance, midpoint within distance tolerance) becomes the host. The full v1 rule set:

| Mover | Snap target | Resulting attachment |
|---|---|---|
| Pergola edge | House wall edge (any segment of the perimeter) | `spatialKind: 'wall'`, `method: 'facade_ledger'` |
| Pergola edge | House roof eave | `spatialKind: 'roof_edge'`, `method` <- user picks |
| Pergola edge | Other pergola outline edge | `spatialKind: 'pergola_outline'`, `method: 'none'` |
| Pergola | (no candidate within tolerance) | `spatialKind: 'freestanding'`, `host: null` |
| Deck edge | House wall edge | `spatialKind: 'wall'` |
| Deck | (no candidate) | `spatialKind: 'freestanding'` |
| Opening | Wall edge (rigid, no detach) | `wallId = edgeId` |

v1 ships **soft snaps**: a snap holds while undisturbed but breaks freely on the next drag. Hard constraints (snaps that re-form across solves until explicit detach) are deferred.

### Snap targets the geometry pipeline must expose

For the snap engine to produce these results, the solved scene must surface, per object:

- House form: each wall edge (already plumbed via plan-detail lines with `wall/snap` metadata). Each roof eave **needs to be added** as a snap target keyed by `(houseFormId, roofId, edgeId)`.
- Pergola: the outline polygon edges (already in `assembly.outline`).
- Deck: the boundary polygon edges (already in `assembly.house.decks[].outline`).

Roof eaves today live as line metadata on `Assembly3D.house` (`fasciaLine`, `roofEdgeLine`) but as a back-reference to "the" house -- single-pergola legacy. Each house form's roof eaves should be discoverable independent of any pergola.

### Inspector UI: configurator -> derived inspector

The current `Host Attachment` panel has four explicit dropdowns: Connection, Attachment Strategy, Host Edge, Host Zone. In the first-class model this becomes:

- **Connection** -- read-only label showing `spatialKind` (`Wall` / `Roof edge` / `Pergola` / `Freestanding`).
- **Host Edge** -- read-only label showing `host.edgeId` resolved to a human-readable name (e.g. "House A -- rear wall", "House A -- front roof eave").
- **Host Zone** -- read-only label, derived from edge kind (e.g. "Wall facade", "Roof eave overhang").
- **Attachment Method** -- the only writable control; only enabled when `spatialKind === 'roof_edge'`. Options: `Fascia under gutter` / `Direct to soffit` / `Soffit brackets`.
- **Attachment Side** -- read-only label only ("rear" / "front" / etc.), derived from the host edge geometry.

Selecting a different attachment method is a `commitObjectWorkbenchPatch` write to `pergola.attachment.method`. Changing the host edge is **not** done via dropdown -- the user drags the pergola to a different snap target.

### Migration order (incremental, with integration tests at each step)

1. [done] **Pergola post-solve world transform** (shipped). `packages/geometry/src/applyAssemblyPosition.ts` lifts a solved pergola from local to world coords by its `position`. `solveAssembly3D` invokes it once after the family solver returns; legacy `position == null` case is a no-op so all 209 existing geometry tests pass unchanged. 8 unit tests cover the transform.
2. [done] **UI dispatch for pergola position (shipped).** `EdgeDragTool` commit handler in `DesignWorkbenchEstimateClient.tsx` now uses a bbox-based dispatch: `bbox.min(nextPolygon)` becomes the new `pergola.position.origin` and `bbox.max - bbox.min` becomes the new `(lengthM, projectionM)`. Any wall drag works -- left/top walls shift position, right/bottom walls grow dims, mixed drags do both. Position writes through `commitSharedPergolaPosition`; dims through `commitGeometryIntent`. Two transactions, one render. A Move tool that drags the pergola interior is a future addition but not blocking -- edge-drag covers all four walls already.
3. [done] **House first-class entity (shipped).** Staged migration, each stage with integration tests. Current workbench source of truth: `HouseFormModel.transform` carries the house world offset/rotation; legacy `module.houseFootprintPosition` remains only as compatibility fallback for callers without an object-first house form. `houseFootprintPolygon` stays in the same `(alongM, depthM)` storage shape but is decoded against a unit (1m x 1m) frame when position is set, with the position applied post-decode.
   - **3.1 -- Data plumbing.** `HouseFormModel.transform`, `RawGeometryModuleInput.houseContext.position`, `GeometryConfig.houseContext.position`, and compatibility `CalculatorModuleInputs.houseFootprintPosition` are threaded through.
   - **3.2 -- Decoder branch.** `normalize.ts` `buildHouseModelConfig` checks `input.houseContext.position`: when set, calls `buildCustomHouseFootprintPolygon` with `pergolaWidthMm: 1000, pergolaDepthMm: 1000` (unit frame) and then applies the position via `applyPositionToPolygon3` (translation + rotation around +Z). When null, the legacy real-frame decoder runs unchanged. Custom polygons only -- preset polygons remain pergola-coupled until the user edits a wall (which converts them to `custom_polygon` mode and triggers stage 3.4).
   - **3.3 -- Migration on first edit (lazy).** Legacy data has `houseFootprintPosition === undefined`; the geometry pipeline falls back to legacy decoder, preserving current behavior with no visual shift. The first house edge-drag commit triggers the migration: `DesignWorkbenchEstimateClient`'s `house_forms` commit handler computes the migration default from the current pergola dims at edit time using `'rear'/'left'`: `(0, 0)`, `'front'`: `(0, (pergolaDepthM - 1) x 1000)`, `'right'`: `((pergolaWidthM - 1) x 1000, 0)` -- then writes the position through a new `'position'` `EstimateDrawingFootprintEdit` variant (persisted on `CalculatorModuleInputs.houseFootprintPosition` so it survives across snapshot reloads). After this commit, the house is fully decoupled and subsequent pergola resizes leave it alone.
   - **3.4 -- Edge-drag commit.** Same handler as the migration trigger: subtracts the current (or migration-default) position from each world point of `commit.nextPolygon`, encodes the result against the unit frame via `buildSideLocalPolygonFromWorld({ pergolaWidthMm: 1000, pergolaDepthMm: 1000, params: null, attachmentSide })`, then writes the encoded polygon. Position stays unchanged on subsequent edits -- only the polygon coords absorb the drag delta. Rotation drag is deferred until a rotate gizmo lands.

   *Verification*: 4 integration tests in `packages/geometry/src/normalize.test.ts` lock the architectural invariants:
   - Legacy decoder still shifts the house on pergola resize for non-`rear` attachment (known coupling).
   - First-class decoder leaves the house untouched on pergola resize when position is set.
   - The migration default produces unit-frame world coords identical to legacy real-frame coords (visually invisible migration).
   - `'rear'` attachment is unit-frame-invariant by formula; migration default `(0, 0)` works out of the box.

4. [done] **Deck first-class entity (shipped).** Mirror of the house migration shape, simpler because the deck decoder already uses a hardcoded 1m x 1m unit frame at `normalize.ts` `buildHouseModelConfig`. Per-deck data shape: `DeckObjectModel.position` (optional) carries the world-space origin/rotation; the side-local outline storage is unchanged.
   - **4.1 -- Data plumbing.** `DeckObjectModel.position`, `ObjectFirstDeckDraft.position`, `ObjectWorkbenchDeckPatch.position`, `RawGeometryModuleInput.houseContext.decks[i].position` all defined and threaded through `mapDecks`. Patch round-trips position via `applyObjectWorkbenchDeckPatch`'s `...input.deck, ...patch` spread (preserved through `resolveObjectWorkbenchDeckDraftGeometry` because position isn't in the geometry-derived overwrite list).
   - **4.2 -- Decoder branch.** `normalize.ts` deck handling now resolves `deck.position` via the shared `resolveOptionalAssemblyPosition` helper and applies `applyPositionToPolygon3` post-decode when set. When null, the existing unit-frame decoder runs unchanged (back-compat).
   - **4.3 + 4.4 -- Edge-drag commit (lazy migration).** `DesignWorkbenchEstimateClient`'s `decks` commit handler computes `bbox.min(nextPolygon)` as the new `deck.position.origin`, shifts the polygon by `-position`, encodes against the unit frame, and writes both via `commitSharedHouseDeckPatch({ shape: 'custom', outline, position })`. Same logic on every edit; first edit triggers migration implicitly. Position persists in the local-first object-first draft (no snapshot field needed).

   *Verification*: 5 integration tests in `packages/geometry/src/normalize.test.ts` lock the invariants -- legacy attachment-side coupling, first-class post-decode position, negative-coord preservation, standardized-frame attachmentSide-invariance, and full bbox round-trip from edge-drag commit through decode. The full decoupling from `host.attachmentSide` for un-edited decks lands with the snap engine in steps 6-8.

4.5. [done] **Standardized 'rear' frame for deck encoder + decoder (shipped).** Edge-drag-edited decks now encode and decode against a fixed `attachmentSide: 'rear'` frame, regardless of the host's current attachmentSide. The host-edge dropdown can now be flipped between rear/front/left/right and the deck holds its position. Legacy un-edited decks (no position) still use the host's attachmentSide for back-compat -- the migration is lazy (first edit triggers it).
5. [done] **Multi-active-object solve (shipped).** **5a audit complete.** Today the workbench already iterates per pergola module -- each `WorkbenchSolvedModule` has its own `Assembly3D`, `topProjection`, and `viewerScene`. The shell shows the active module. There is no project-wide aggregated view, so multi-pergola scenes can't show both pergolas in one canvas. Singleton assumptions in the geometry package: `buildReferenceShapes` emits hardcoded ids; `buildTopProjectionViewModel`, `applyAssemblyPosition3D`, `takeoff`, `validate` all take a single assembly per call. **5b shipped**: `buildReferenceShapes` (and `buildTopProjectionViewModel` via a `referenceIdentifiers` option) now accept caller-provided per-instance source ids. Default behavior preserves the legacy singleton ids `'house-footprint'` / `'pergola-outline'` for back-compat; when supplied, ids become `house_reference:${houseSourceId}` / `pergola_reference:${pergolaSourceId}` so project-level aggregation doesn't collide. **5c shipped**: new `buildProjectReferenceShapes({ pergolas: [{assembly, pergolaSourceId}], houseSourceId })` aggregates reference shapes for an N-pergola project -- emits exactly one `house_reference` (dedupes across pergolas) plus one `pergola_reference` per entry. Scope is reference shapes only; per-pergola interior objects (posts, beams, rafters) stay at module-level until Step 5d disambiguates their object ids. *Verification*: 5 new tests cover house dedupe with 3 pergolas, empty input, legacy singleton fallback, canonical-outline metadata preservation, and the no-house freestanding case. **5d Option A shipped**: `WorkbenchSolvedModel.projectReferenceShapes` is computed once per build via `buildProjectReferenceShapesFromModules` (stable pergola source ids from `module.input.pergolaId` with `pergola-${index+1}` fallback; house source id from the project's first house form id). New `buildProjectContextOverlayShapes({ projectReferenceShapes, activePergolaSourceId })` filters out the active pergola's outline and the house reference (both already rendered by the active module's full topProjection). New `PlanProjectContextLayer` renders the remaining shapes as faded dashed outlines with object-id labels, plumbed through `DrawingWorkbench` -> `WorkbenchViewportHost` -> `PlanViewport` -> `PlanCanvas`. Multi-pergola scenes now show every pergola's outline at a glance; per-pergola interior objects (posts, beams, rafters) still render at module level only -- full scene aggregation with object-id disambiguation is a future slice. *Verification*: 1 store-level test confirms `projectReferenceShapes` is exposed with canonical-outline metadata; 6 filter-helper tests cover house dedupe, active-pergola exclusion, multi-pergola passthrough, null-active-id case, empty input, and metadata/order preservation. **5e shipped**: `Assembly3D` JSDoc rewritten to per-instance / per-project semantics (assembly-local vs world coord spaces; plurality; house-transform back-compat noted); `contracts.ts` file header refreshed to describe both coord spaces and Assembly3D's per-instance role. The migration audit table at the top of this section is updated with status per row -- rows 6 & 7 closed (Step 5b/5c shipped + per-module takeoff was already correct), row 8 closed (this slice), rows 1, 2, 4 marked partial (front-line consumers fixed but legacy storage shapes still carry `attachmentSide` enum), rows 3, 5, 9 still pending. **Step 5 main goal achieved**: multi-pergola scenes are now visible in one canvas via the project-level reference overlay. Future slices: full per-pergola scene aggregation with object-id disambiguation (would unblock interactive selection of non-active pergolas) and the per-house first-class assembly write into the geometry pipeline (audit row 5 -- needed before audit row 9's `buildRawGeometryModuleInput` wrapping fully retires).
5.1. [done] **Canonical house-form plan references (shipped 2026-05-29).** `buildProjectReferenceShapesFromModules` now uses `buildProjectReferenceShapes` only for pergola references and appends one `house_reference` per `houseAssembly.houseForms[]` entry via `buildHouseFormReferenceGeometry`, including `house-main`. `PlanViewport` promotes these canonical house references into committed bodies and dedupes same-id projection references before rendering, so selection/move identity comes from `house_reference:<formId>` for every house form. The per-pergola `houseContext` solve loop remains until audit row 9 is retired.
6. [done] **Roof eaves as first-class snap targets (shipped).** `HouseModel3D.roofEaves: HouseRoofEave3D[]` exposes one descriptor per drain-eave perimeter edge with a stable id (`roof-eave-${sourceEdgeId}`), `edgeKind: 'drain_eave'`, the eave line at gutter height in world coords, and the source roof plane id. Populated in `buildHouseModel3D` by filtering `allPerimeterEdges` to `drain_eave` kind. Other perimeter kinds (`weather_flashed_edge`, `house_apron_edge`) are not pergola attachment targets in v1. The snap engine (step 7) consumes this list to surface roof-edge candidates during edge-drag. Per-house keying (`{houseFormId, roofId, edgeId}`) lands with the multi-active-object solve in step 5; for now `model.roofEaves` is reachable as `assembly.house.model.roofEaves`. *Verification*: `houseModel.test.ts > exposes drain eaves as discoverable roof-eave snap targets` locks the contract (id format, edge kind, eave-height invariant, id uniqueness).
7. [wip] **Wire `snapEngine.ts` into `EdgeDragTool` (in progress).** Visual snap is shipped: dragging a pergola edge near a parallel house wall or roof eave shows an orange snap indicator, locks the preview to the target line, and surfaces the resolved `target` (id + edgeKind) on the commit. Soft snaps only -- the snap holds while undisturbed and breaks freely on continued drag. Implementation: `snapEngine.ts` extended with `SnapLineTarget` (line-shaped candidates with `edgeKind` metadata) alongside the existing polygon-shape candidates; `buildHouseSnapTargets.ts` projects `HouseModel3D.{wallSegments, roofEaves}` to plan-space line targets; `resolveEdgeSnap.ts` does the parallel-line geometry (angular + distance tolerance, perpendicular-foot delta correction); `EdgeDragTool` consults snap on every pointermove and on commit; `PlanSnapIndicatorLayer` renders the visual. Snap is wired only for `activeFamily === 'pergolas'` to avoid self-snaps when a house or deck is the active object. *Verification*: 6 new EdgeDragTool snap tests, 5 new snapEngine line-target tests, 10 resolveEdgeSnap math tests, 6 buildHouseSnapTargets adapter tests. **Remaining for step 7**: derive `host` shape (`{ objectFamily, objectId, edgeKind, edgeId, myEdgeIndex }`) from the commit's snap result and feed it into the pergola attachment write path. Today the snap correction lands in the polygon and the attachment data shape stays legacy -- step 8 lands the new attachment fields and reads the snap result.
8. [wip] **Migrate `connection.type` and `attachmentStrategy` to `attachment.{spatialKind, method, host}` (in progress).** The `PergolaAttachment` type is defined in `objectFirstWorkbenchModel.ts` with strict invariants (freestanding <=> no host & method=none; wall => method=facade_ledger; pergola_outline => method=none; roof_edge accepts the three method picks). Plumbed through `ObjectFirstPergolaDraft.attachment`, `PergolaObjectModel.attachment`, and `ObjectWorkbenchPergolaPatch.attachment` with a `normalizePergolaAttachment` helper that defends invariants on rehydrate. `pergolaAttachmentFromSnap` (in `pergolaAttachment.ts`) builds the attachment from a snap result; `connectionTypeFromAttachment` projects it onto the legacy `ConnectionType` enum so cost-engine reads stay unchanged. Pergola edge-drag commits now persist the attachment via `commitSharedPergolaAttachment` whenever `commit.snap` resolves to a wall or roof_eave. **Step 8 follow-up #1 shipped**: `buildRawGeometryModuleInput` now reads `pergola.attachment` and projects it onto `RawGeometryModuleInput.connection.houseConnectionType` via `connectionTypeFromAttachment`, with legacy `module.houseConnectionType` as fallback. The snap-derived attachment is now load-bearing for the cost engine -- drag a pergola edge onto a roof eave with method='direct_to_soffit' and the cost engine sees `houseConnectionType: 'soffit'` regardless of the legacy field. **Step 8 follow-up #2 shipped**: lazy migration on first patch. `pergolaAttachmentFromLegacyFields` (in `pergolaAttachment.ts`) maps legacy `connectionKind` + `strategy` to the canonical attachment shape with `host: null` (resolved on first snap). `applyObjectWorkbenchPergolaPatch` writes the derived attachment alongside any patch on a legacy-only pergola -- one-time migration per pergola, post-patch state used so a kind-changing patch lands the right attachment. The relaxed `PergolaAttachment` invariant doc explains that `host: null` for non-freestanding means "spatial kind is known but absolute host edge has not yet been snap-resolved" -- the geometry pipeline reads spatialKind/method regardless. *Verification*: 7 lazy-migration tests covering label-only patches, kind-changing patches, attachment-overwrite protection, freestanding migration, and the round-trip through `connectionTypeFromAttachment`. 21 `buildRawGeometryModuleInput` tests, 21 attachment-shape tests (legacy helper + projection + normalizer). **Step 8 follow-up #3 shipped**: `EdgeDragCommit` now carries `edgeIndex` (the polygon edge of the dragged outline) alongside `snap`. The pergola edge-drag handler passes `commit.edgeIndex` into `pergolaAttachmentFromSnap`'s `myEdgeIndex` parameter, so the persisted attachment records which polygon edge is snapped -- re-solves can recover alignment from `host.myEdgeIndex` without re-querying the snap engine. *Verification*: 2 tests in `EdgeDragTool.test.ts` lock that the commit carries `edgeIndex` for both snap (top edge index 2) and no-snap (right edge index 1) cases. **Remaining for step 8**: derive `attachmentSide` (UI label) from `host.edgeId` so the legacy `attachmentSide` field can also retire from the geometry input.
9. [done] **Inspector UI redesign (shipped).** The legacy `Host Attachment` configurator (4 dropdowns: Connection / Strategy / Host Edge / Host Zone) is replaced by a derived inspector that reads `pergola.attachment` and exposes one writable control. Read-only labels: Connection (spatialKind), Host Edge (resolved via `labelForPergolaAttachmentHostEdge`, falls back to "Not snapped -- drag to assign" when host is null), Host Zone (derived from spatialKind + method), Attachment Side (legacy `pergola.side` for now -- UI-only label). Writable: Attachment Method picker, only enabled when `spatialKind === 'roof_edge'`. Re-hosting is exclusively via drag-snap; the host-edge dropdown is gone. Implementation: `pergolaAttachmentLabels.ts` (pure label helpers, 13 tests), rewritten `PergolaInspector.tsx`, new `commitSharedPergolaAttachment` wired through `ObjectWorkbenchRailHost`. The 4 legacy commit actions (`commitSharedPergolaConnectionKind`, `commitSharedPergolaAttachmentEdge`, `commitSharedPergolaAttachmentZone`, `commitSharedPergolaAttachmentStrategy`) and their supporting helpers (`resolvePreferredObjectWorkbenchPergolaZone`, `resolveObjectWorkbenchPergolaZoneKind`, `buildObjectWorkbenchPergolaZoneLookup`, plus the `PergolaAttachmentKind` / `PergolaDerivedAttachmentZoneOption` aliases) are deleted. Lazy-migration fallback (`pergolaAttachmentFromLegacyFields`) means legacy-only pergolas get the right inspector state on first render without requiring a snap. *Verification*: 13 label-helper tests, replacement DOM test in `DesignWorkbenchEstimateClient.test.tsx` confirming the legacy dropdowns are gone, the new inspector renders the right labels for legacy-only data, and the method picker round-trips through `commitSharedPergolaAttachment`. The legacy pre-existing test failures (6 of them, JSDOM `getScreenCTM` related) are unchanged.
10. [done] **Pergola-to-pergola attachment (shipped).** Pergola edge drags now snap to other pergolas' outline edges, not just house walls and roof eaves. Implementation: new `buildOtherPergolaSnapTargets` helper projects the project's `pergola_reference` shapes (already aggregated by Step 5d's `buildProjectContextOverlayShapes`, which excludes the active pergola + house) into per-edge `SnapLineTarget`s with `edgeKind: 'pergola_outline'` and stable ids of the form `pergola-edge-${pergolaSourceId}-${edgeIndex}`. `PlanViewport` concatenates these onto `buildHouseSnapTargets`'s output so the snap engine sees both kinds in one query (still gated to `activeFamily === 'pergolas'` to avoid self-snaps). The pergola edge-drag commit handler in `DesignWorkbenchEstimateClient` now routes `pergola_outline` snaps through `pergolaAttachmentFromSnap` with `host.objectFamily: 'pergolas'`, producing `PergolaAttachment{ spatialKind: 'pergola_outline', method: 'none', host: {...} }`. The legacy `connectionTypeFromAttachment` projection maps `pergola_outline -> 'freestanding'` so cost-engine reads stay unchanged until pergola-array cost semantics graduate from v1 (shared post counted once, etc.). *Verification*: 7 `buildOtherPergolaSnapTargets` tests covering per-edge emission, multi-pergola flattening, edgeKind metadata, non-pergola filtering, degenerate polygon skipping, empty input, and stable id round-trip; existing `pergolaAttachment.test.ts` already locked the `pergola_outline` shape (5 tests across `pergolaAttachmentFromSnap` and `connectionTypeFromAttachment`); existing `EdgeDragTool` snap tests prove parallel-target snap is `edgeKind`-agnostic. **Inspector**: the existing label helpers (`labelForPergolaAttachmentSpatialKind`, `labelForPergolaAttachmentHostEdge`, `labelForPergolaAttachmentHostZone`) already cover `pergola_outline` (Connection: "Pergola", Host Edge: "Pergola edge", Host Zone: "Pergola outline"), so a snapped pergola-to-pergola attachment renders coherently with no UI changes. **Cost-engine semantics deferred**: shared posts (one post counted instead of two when a pergola edge sits on another pergola edge) is a follow-up -- the legacy `connection.type` projection (`pergola_outline -> 'freestanding'`) keeps cost reads stable until that lands.
11. [wip] **Deck snap to walls + pergola post edges (shipped -- visual snap only).** Deck edge drags now consult the snap engine: dragging a deck edge near a parallel house wall or pergola outline edge locks the preview to the target line, and the commit's bbox-encoded polygon absorbs the snap correction. Implementation: `buildHouseSnapTargets` gained a `kinds: 'walls' | 'walls_and_eaves'` option; deck mode requests `'walls'` because decks sit at ground level and snapping to a gutter-height roof eave is meaningless. `PlanViewport`'s snap-target gate widened from `activeFamily === 'pergolas'` to also include `'decks'`, with per-family snap rules in one branch. `DesignWorkbenchEstimateClient` now scopes `activePergolaSourceId` to pergola-active state -- when a deck (or house) is the active object, `activePergolaSourceId` is null, so `buildProjectContextOverlayShapes` includes every pergola in the project. This unblocks the common case (deck attaches to its host pergola) and also makes the visual context overlay show all pergolas during deck edits. *Verification*: 2 new `buildHouseSnapTargets` tests lock the kinds filter (`'walls'` omits eaves; `'walls_and_eaves'` is the default and matches the no-flag behaviour). Existing `EdgeDragTool` snap tests are `edgeKind`-agnostic so no new tool tests are needed -- the polygon correction is already proven by the eave-snap tests, and the deck commit handler bbox-encodes `commit.nextPolygon`, which already includes any snap correction. **Persistence deferred**: the deck commit handler does not yet write a `host` shape onto the deck -- the snap correction lives only in the polygon. A follow-up could mirror `PergolaAttachment` on decks (`DeckAttachment{spatialKind, host, method?}`) so re-solves recover wall/pergola alignment from a stored host id, but that requires deck-attachment cost-engine semantics decisions that haven't landed yet. **Roof eaves**: deliberately excluded from deck snap (different elevation); reconsider if a future deck variant attaches at gutter height.

Each step ships with an integration test that locks the new invariant (e.g. "pergola at position X renders at world X", "house with custom polygon stays put when pergola dims change", "deck stays put when pergola is moved or resized", "pergola dragged onto roof eave produces `spatialKind: 'roof_edge'` with method preserved across re-solves"). The tests are the architectural guardrails that prevent drift back to the pergola-centric or configurator-driven model.

### Until the migration completes

- Edge-drag of a house footprint may visibly reposition attached pergolas/decks for non-`rear` attachment sides -- that is expected behaviour given the legacy frame coupling, not a regression.
- Pergola edge-drag of left/top walls is a silent no-op (would require negative world coords without `position` being wired). Will be fixed by step 2.
- Adding a second pergola to a project will render both at world origin (overlapping) -- blocked by step 5.
- The `Host Attachment` panel remains a configurator, not an inspector -- users still set Connection / Host Edge / Host Zone explicitly. Treat any data the user writes via that panel as a *legacy override* the snap-derived attachment will eventually replace.
- `connection.type`, `attachmentStrategy`, and `attachmentSide` remain stored, single-axis fields. Code reading them should keep doing so until step 8 lands; new code should not introduce additional readers.

### Next milestones (post-Step 11)

The work below is sequenced for "finish the foundation, then unlock multi-object features." Items 12 and 13 close the last two open audit rows (5 and 9) and unblock multi-house. Items 14-16 are user-facing features that depend on a clean foundation.

12. ✅ **House through `applyAssemblyPosition3D` (shipped — closes audit row 5).** The house is now a first-class spatial entity with its own world `position` routed through the boundary. *Implementation*: added `position?: AssemblyPosition | null` to `HouseReferenceGeometry`; `applyAssemblyPosition3D` factored to share a single transform context between pergola and house, then transforms `assembly.house.{footprint, fasciaLine, roofEdgeLine, wallPlane, model, attachmentTarget}` (including the full `HouseModel3D` graph -- wall segments, roof planes, roof flashings, roof material visuals, decks, openings, surface + linear solids, eave geometry, roof eaves, attachment target) when `assembly.house.position` is non-null; `buildHouseReferenceGeometry` populates `position` from `config.houseContext.position`; `normalize.ts` no longer pre-translates the unit-frame footprint -- the world translation runs at the boundary instead; `solve.ts` now always calls `applyAssemblyPosition3D` (previously skipped when `config.position` was null, which would have skipped the house transform). The pergola transform and the house transform are independent: each can be set without the other, and applying one doesn't affect the other. *Verification*: 11 `applyAssemblyPosition3D` tests including end-to-end "house wall segments and roof eaves land at world coords after the boundary runs" (the snap-target invariant); 42 `normalize.ts` tests including the migration-math invariant updated to apply the position post-decode; 236 of 237 geometry tests pass (one pre-existing `profileAssets` DXF failure, unrelated); 402 portal drawing tests pass; full geometry + portal typecheck clean. *Unblocks*: multi-house projects, deck-snap to a non-default-position house, milestone 13.
13. ⏳ **Drop pergola `houseContext` wrapping (closes audit row 9).** Today `buildRawGeometryModuleInput` is per-pergola: each pergola module input wraps the selected host house as context. Current bridge state: the workbench now derives a project-level house geometry registry and uses a shared house-form raw geometry boundary for project references and host raw geometry; host house ids flow through raw/normalized geometry and solver output directly; project references and multi-house snap targets use the registry. Object-first pergolas without a matching calculator module solve through an explicit runtime-only source, which removes the persisted `inputs.modules[]` dependency for orphan pergolas; the rail can now create new freestanding object-first pergolas through that same path. Plan Editor aggregates full solved plan bodies for every valid pergola id, and 3D Review now aggregates valid pergola scene bodies by `pergolaId` while keeping 3D read/select-only. These runtime sources still adapt pergolas through `CalculatorModuleInputs` in memory. The per-pergola `RawGeometryModuleInput.houseContext` solve loop still exists. **Scope**: add per-family raw input builders (`buildRawHouseInput`, `buildRawPergolaInput`, `buildRawDeckInput`); change solve orchestration so each house solves once into a stable `HouseModel3D`, then pergolas/decks read the appropriate house model as input rather than wrapping it. **Verification**: house-only and pergola-only projects solve cleanly; existing multi-pergola tests still pass; the `houseContext` field on `RawGeometryModuleInput` either retires or shrinks to a back-compat alias. **Remaining unblock**: eliminating per-module duplicate house context and future per-object solving optimizations.
14. ✅ **Move tool + project-wide undo (shipped).** *Move tool*: pergola and deck bodies can be dragged in plan view to translate `position.origin`. *Undo*: ctrl-Z / cmd-Z reverts the last move OR resize via a per-PlanViewport `CommandBus`. *Commit pipeline*: shared per-family helper `buildDeckTransformPatch` ([apps/portal/lib/drawings/commits/commitDeckTransform.ts](../apps/portal/lib/drawings/commits/commitDeckTransform.ts)) consumes a world polygon and produces the canonical atomic patch (`shape: 'custom'` + side-local outline + position); both move and edge-drag handlers route through it, so legacy decks migrate cleanly on first move. *Tool wiring*: `createPlanToolChain` ([apps/portal/components/drawings/viewports/PlanViewport/tools/createPlanToolChain.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/createPlanToolChain.ts)) is the named composite that the dispatcher routes to; pointer-down enters at EdgeDragTool which falls through to MoveTool which falls through to SelectTool, while pointer-move and pointer-up fan out to both EdgeDragTool and MoveTool so a drag started via fallthrough still receives its updates. `MoveTool` was simplified to one `canMoveTarget(target) => boolean` predicate (replacing the prior `acceptedFamilies` + `getActiveTarget` split) and the deck-id workaround was lifted into `topProjectionShapeClassifier` so consumers no longer special-case `metadata.sourceId`. *Edge-drag undo*: `onCommitOutlineEdit` returns a `ReversibleCommandInput` ({ label, apply, invert }) describing both directions of the edit, with the inverse capturing pre-edit state (deck shape/outline/position; pergola position/lengthMm/projectionMm/attachment) before the action fires. `PlanViewport` wraps that into a `Command` via [createReversibleCommand](../apps/portal/lib/drawings/commands/createReversibleCommand.ts) and pushes it through the same `CommandBus` as moves, so resize and translate share the undo stack. House-form edge-drag undo is *deferred* (the migration path also writes a position-migration patch alongside the polygon edit; reversing it cleanly needs a separate slice). Rotation, house-form move, and opening move are also deferred (rotation needs local-frame bbox math; house move depends on milestone 13's multi-house data model; openings stay wall-anchored). *Verification*: `MoveTool` (19 tests), `createPlanToolChain` integration (7 tests covering edge-click resize, body-click move, fallthrough-to-select, undo round-trip for moves AND for edge-drag commits via reversible command, cancel propagation), `commitDeckTransform` (7 tests + 4 round-trip), `commitPergolaTransform` (4 tests), `createReversibleCommand` (6 tests covering apply/invert/round-trip/CommandBus integration/captured-state survival), `selectionRouter` (deck `metadata.sourceId` preference), all in addition to the pre-existing portal suite; typecheck clean.

   *Maintainability cleanup shipped alongside the wiring* (per [docs/maintainability-principles.md](maintainability-principles.md)): per-family commit helpers extracted -- [commitDeckTransform.ts](../apps/portal/lib/drawings/commits/commitDeckTransform.ts) and [commitPergolaTransform.ts](../apps/portal/lib/drawings/commits/commitPergolaTransform.ts), both with unit tests, both used by move + edge-drag (principle #1); workarounds for deck `metadata.sourceId` and pergola `metadata.pergolaId` lifted to their sources -- `topProjectionShapeClassifier` and `buildTopProjectionFromSolvedScene` (principle #3); `acceptedFamilies` + `getActiveTarget` collapsed into `canMoveTarget` (principle #4); `createPlanToolChain` extracted from inline JSX with 6 integration tests for the dispatcher chain (principle #2). [Live preview layer](../apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanMovePreviewLayer.tsx) gives the user real-time visual feedback during drag. **Deck-drift fix**: `buildDeckTransformPatch` now subtracts `houseWorldPositionMm` from the world bbox before persisting `deck.position`, because the geometry decoder applies `deck.position + house.position` -- without the subtraction, every commit re-introduced an extra house offset and the deck drifted toward the house position on each move/resize. The footgun is documented in [maintainability-principles.md](maintainability-principles.md) under "Coordinate-system footguns."

   **Pointer-event contract (load-bearing — see [maintainability-principles.md](maintainability-principles.md) footgun #5).** Any pointer-driven tool added to PlanViewport depends on four invariants enforced at the [PlanCanvas.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas.tsx) boundary:

   1. **`touch-action: none`** on the canvas SVG. Default `auto` lets the browser steal the gesture (swipe-back, two-finger pan, scroll) and fire `pointercancel` mid-drag.
   2. **`setPointerCapture(pointerId)` on every primary-button pointer-down.** Without capture the browser fires `pointerleave` / `pointercancel` as soon as the cursor crosses an element boundary -- e.g. the cursor leaves the polygon hit-target while the user is still actively dragging.
   3. **`pointerCancel` MUST cancel the active tool, NOT dispatch as `pointerUp`.** Cancel events arrive with `clientX/Y === 0`; treating them as up means the dispatcher inverse-transforms `(0, 0)` into a wildly off-canvas world coord, MoveTool computes `delta = bogusEnd - realStart`, and the deck jumps roughly proportional to its distance from origin (the deck-runaway bug we paid for in production).
   4. **The dispatcher NEVER invents a coord on null.** [pointerDispatch.ts](../apps/portal/components/drawings/viewports/PlanViewport/canvas/pointerDispatch.ts) is the pure decision function: null point → skip, valid point on `down` → dispatch + capture, valid point on `move`/`up` → dispatch (no capture). Tested in `pointerDispatch.test.ts`. Future tools should consume the dispatcher's `ToolPointerEvent` and trust that `event.point` is the true cursor world coord.

   These invariants apply to every future move-like tool (rotation, house-form move once milestone 13 lands, opening-on-wall slide, etc.).
15. ⏳ **Inspector parity.** Bring deck, opening, and house-form inspectors up to the standard set by the pergola inspector (Step 9). Each inspector reads derived labels from the object's persisted state and exposes writable controls only for fields without a snap-derived equivalent. *Deck inspector*: dimensions (lengthM, depthM), surface material, host edge label, position. *Opening inspector*: wall, dimensions, panel count, validation status. *House form inspector*: roof intent, footprint shape, position. **Constraint**: ship before adding new pergola types (item beyond this list) so new types land with coherent UIs rather than empty inspectors. **Verification**: each inspector renders correctly for legacy-loaded data and round-trips writes through the existing patch model.
16. 🟡 **3D occlusion + hover sync (partial -- hover-sync for decks shipped; occlusion attempted-then-reverted; non-deck hover render deferred).** *Hover sync foundation (phase 1, shipped)*: cross-viewport hover state plumbed end-to-end. `DesignWorkbenchEstimateClient` owns a `hoveredObjectRef: WorkbenchObjectRef | null` lifted state; threads it through `DrawingWorkbench` -> `WorkbenchViewportHost` -> `PlanViewport` + `DesignViewport` -> `Geometry3DViewport`. PlanViewport emits via `topProjectionShapeClassifier` on local pointer-over (the same classifier already used for selection -- hover and selection share the typed-target rule), and renders a [PlanHoverHaloLayer](../apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanHoverHaloLayer.tsx) on shapes matching an externally-driven hover ref. Hover halo de-dupes against the active selection halo so the active object isn't double-painted. *Hover sync 3D-side for decks (phases 2 + 3, shipped)*: `HouseSurfaceSolidObject` accepts `hovered: boolean` + `onHoverEnter`/`onHoverLeave` props alongside the existing `selected` + `onSelect`. When hovered (and not selected), the deck renders intermediate-opacity body, top, outline, and groove materials so it reads as "under interest" without competing with the dominant `selected` styling. R3F `onPointerOver`/`onPointerOut` on the deck group publishes upward via `Geometry3DViewport.onHoveredObjectChange`. The dispatch site at the `<SceneObjectNode>` map handles workbench-id <-> 3D-scene-id translation: scene objects expose either `object.sourceId` (top-level, on surfaces) or `object.metadata.sourceId` (on solids built via `house/envelopeSolids.ts`); the 3D side accepts either form on the controlled hover prop and emits the workbench form on hover so plan and 3D agree on a single id. *Verification*: 5 PlanViewport hover tests (deck/pergola classifier round-trip, hover-leave clear, halo render, selection de-dup) + 1 Geometry3DViewport test (deck pointer-over emit + controlled-hover round-trip + data-hovered attr flip). 268 PlanViewport + 15 Geometry3DViewport tests pass; typecheck clean. *Occlusion (attempted, reverted)*: tried `depthWrite: true` + `renderOrder: -1` on walls + roofs so they would plant depth values before the deck and the deck-inside-house pixels would be depth-test-rejected. Reverted because the same depth values also occluded pergola elements that should be visible through semi-transparent walls -- the 3D viewport went near-blank. The depth-write knobs and `data-occlusion-depth-write` attribute hooks remain in place but are forced to `false` until a more targeted approach lands. Two viable options for the next attempt: (a) polygon-clip the deck outline against the house footprint as a pre-process (no depth tricks; requires a robust polygon-subtraction helper -- there isn't one in the codebase yet), or (b) stencil-pass the house footprint and render the deck only outside the stencil (Three.js stencil API; more invasive but localised to the deck/house pair). Both avoid CSG. *Phase-2/3 still deferred for non-deck families*: pergola scene tree (rafters/beams/posts/roof_planes), opening_marker, house_surface (footprint/wall/roof), member_prism, etc. -- each renderer needs the same `hovered: boolean` + `onPointerOver/onPointerOut` pass that `HouseSurfaceSolidObject` now demonstrates. The dispatch site already passes `hovered` + handlers to every `<SceneObjectNode>`, so renderers just need to (a) accept the props, (b) apply lighter-than-selected styling when hovered, (c) wire the pointer events on their root group. Mechanical follow-up; not blocking other milestones. **Remaining**: (a) hover render for non-deck families (mechanical sweep across ~10 renderer components); (b) occlusion via polygon-clip or stencil approach.

After (16), the foundation is complete enough to take on:
- New pergola types (gable, hip-end, dutch hip, lean-to-with-attached-deck, multi-tier).
- Plan-view fidelity polish (deck outline clipping at house walls, etc. -- deferred from earlier discussion).
- Sheet output / PDF generation.

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
