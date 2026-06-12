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

This is now split by product boundary:

- **Calculator V1 / marketing enquiry** stays separate and protected. The marketing email path still prices through the existing V1 calculator flow.
- **Design Workbench** is object-first only. It no longer loads, adapts, reprices, or falls back to calculator module state at runtime. Costing becomes a future downstream adapter from solved geometry/takeoff, not an input to the workbench.

### North star progress (2026-06-11)

The product north star is "a single solved geometry model that serves many UI shells." Where we are:

- ✅ **Canonical project shape** (`WorkbenchProjectModel`): object-first, snap-derived attachments, every object owns its world position + local outline. Workbench runtime accepts this shape only.
- ✅ **Workbench breakaway from calculator state**: live workbench code does not read, write, adapt, or fall back to calculator `inputs.modules[]`, house-first carriers, raw module inputs, module-index selection, calculator plan/section models, or costing payloads. Snapshot-only calculator designs open as unsupported/empty workbench designs instead of being synthesized.
- ✅ **Costing disconnected from workbench runtime**: workbench repricing is disabled for this breaker pass. Geometry/takeoff remains the future source for a downstream commercial adapter; calculator V1 remains the protected marketing/enquiry pricing path.
- ✅ **First-class spatial entities**: pergolas, decks, openings, house forms all own their geometry. No more "primary vs. additional" special-casing. Snap engine produces all attachments.
- ✅ **Project house geometry registry**: `WorkbenchSolvedModel.projectHouseGeometries` derives one canonical `house_reference:<formId>`, `HouseReferenceGeometry`, and `HouseModel3D` per valid house form. Plan references, host-excluded 3D scene composition, and PlanViewport house snap sources consume this registry instead of rebuilding host/non-host branches.
- ✅ **Package-owned house footprint canonicalization**: object-owned house footprints are numerically stabilized inside `@sp/geometry` before wall/eave/roof solving. The solver rounds solved input coordinates to `0.001 mm`, collapses duplicate consecutive points, removes residue-only collinear points, and exposes `footprintCanonicalization*` metadata while preserving the saved workbench draft exactly as authored.
- ✅ **Package-owned hipped eave topology**: fully hipped custom orthogonal house forms that fail the adjacent-edge eave offset with self-overlap can recover through `orthogonal_cell_union`, a package-owned exact eave boundary at the requested overhang. It commits only when downstream roof QA proves valid; reduced-overhang/narrow-return repair remains a quarantined approximate fallback.
- ✅ **Package-owned custom hipped topology**: fully hipped non-rectangular orthogonal house forms now evaluate package-owned semantic candidates instead of trusting Plan paint or active-module fallbacks. The `source_edge_exact_envelope_partition` attempt exposes exact partition diagnostics and may commit only when semantic QA passes. Known-good `eave_graph_source_edge_envelope` output can still commit under the same semantic gate, and `source_edge_coverage_partition` can recover split source-edge faces only when coverage and semantic QA prove the roof clean. Diagnostics expose solver, exact/coverage QA, failing edge, failure reason, semantic QA, and closed/expected face counts.
- ✅ **Project solve artifact**: `WorkbenchProjectModel` is solved into one `WorkbenchSolvedGeometryArtifact` spine keyed by object id. Plan, 3D, Sheet, Section, snap, diagnostics, and status read the same artifact instead of active-module geometry or calculator plan/section fallbacks.
- ✅ **Legacy bridge code retired from live workbench roots**: house-first runtime models, legacy snapshot synthesis, raw module wrapping, legacy plan/section fallback builders, and compatibility tests that preserved old module behavior were deleted or rewritten.
- ❌ **Multi-shell consumers** (marketing self-design upgrade, sales tool, tradie tool, Rhino/Vray export): not started, per Q6 ("all other shells worked on once the solved geometry and data model is polished and clean"). The workbench is the foundation; other shells consume the same `WorkbenchProjectModel` once Phase 2 fully lands.

The current boundary is intentionally strict: calculator and workbench are separate products. The next workbench-commercial slice should add a downstream takeoff-to-costing adapter outside the runtime geometry path, not revive calculator compatibility inside the workbench.

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

The design workbench is the portal drawing and model-editing surface for estimate-backed designs. The active workbench migration is sealed around an object-first project model and solved geometry spine. Calculator-era designs are unsupported/empty for live workbench runtime unless a future non-runtime import tool explicitly converts them.

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
- `viewports`: Plan editor, Sheet view, 3D review, and Draw Outline interaction.
- `rail`: object-workbench navigation, inspectors, and editing controls.
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

Viewport routing should pass solved geometry bundles, not loose scene/projection fragments. `WorkbenchViewportGeometry` is the per-object/project bundle; `WorkbenchSolvedModel.projectViewportGeometry` is the project-level basis used by Plan and 3D when no object is selected.

- House forms, decks, openings, and pergolas are modeled as explicit objects.
- Hosted objects resolve against derived house/building behavior.
- Object-first design intent resolves into one solved geometry artifact. In portal runtime state this contract is named `WorkbenchSolvedGeometryArtifact` and is exposed as the workbench's only geometry view source.
- Workbench shell and viewport routing use `WorkbenchViewportGeometry`: `artifact` carries the canonical solved geometry and `preview` is derived from the artifact when geometry is ready. Route clients and `WorkbenchViewportHost` pass this bundle instead of fanning out loose scene/projection/preview fields.
- Sheet and Plan drawing surfaces receive `WorkbenchDrawingSurfaceGeometry` from the same routing lane. Geometry-ready surfaces use artifact-derived plan, top projection, and section inputs only. `ModuleDrawingRenderer` remains a calculator/public-export presenter, but live workbench surfaces do not pass calculator-era plan or section models into it.
- Geometry-ready plan, 3D, sheet, section, snap frames, hit targets, dimensions, annotations, and interaction previews are derived views of that artifact, not independent geometric truths.
- Geometry, plan, 3D, section, and sheet views should consume the solved geometry spine rather than each inventing shape truth.
- The solved project artifact's 3D scene and model-space top projection are paired: the projection is generated from the same `ViewerSceneModel` handed to the 3D viewport, with assembly reference shapes carried forward explicitly.
- The scene also carries plan-detail lines for real house wall segments. These project as context lines with wall/snap metadata, do not drive plan extents, and are the preferred live deck host-edge snap source.
- Geometry-ready plan fitting uses artifact top-projection extents; there is no live workbench module-plan fallback.
- Workbench commercial payload generation is intentionally disconnected in this breaker pass. Future pricing work should consume geometry-owned takeoff downstream from `WorkbenchSolvedGeometryArtifact`, outside the live geometry/render path.
- Geometry-ready Model Space is a projection-only surface. Its normal body rendering consumes only top-projection committed bodies that match the 3D Top view; it does not execute legacy pergola plan geometry, semantic house context bodies, legacy footprint bodies, model primary dimensions, fall labels, or context/reference projection bodies. Sheet View and unsupported geometry fallback keep their existing legacy paths.
- Geometry-ready plan mode uses an internal plan render graph with explicit layer ownership: `committedBodies`, `contextLines`, `hitTargets`, `selectionOutlines`, `dimensions`, `dragPreview`, and `debug`. Normal visible body rendering may only consume `committedBodies`; selecting an object may add outlines, hit targets, handles, and dimensions, but must not add another filled house/deck/pergola body.
- House-form Plan overlays and status resolve by `houseFormId`. Rail rows, inspector state, selection chrome, hit targets, dimensions, and visible body precedence must not borrow the first/legacy house form. House roof Plan bodies are package-owned eave-perimeter projections (`house_plan_roof:<formId>`); roof-material ribs/seams remain 3D/detail data and must not replace the semantic Plan roof body. Fully hipped custom orthogonal roofs that hit eave-offset self-overlap should try the package-owned `orthogonal_cell_union` eave boundary at the requested overhang before any approximate reduced-overhang/narrow-return fallback; saved wall footprint/eave settings remain unchanged, and diagnostics expose `eaveOffset*` metadata per form. Custom hipped roof repairs are render-only package diagnostics: Plan and 3D both consume the repaired roof eave topology and expose `roofEaveOffsetRepair*` metadata only when an approximate repair is used. Fully hipped custom orthogonal roofs must use package-owned semantic topology candidates instead of the legacy rectilinear dissolve path as geometry truth: exact source-edge partition first, legacy source-edge envelope only when semantic QA proves valid, and coverage recovery only when split source-edge faces still cover all source edges with no gaps, overlaps, unbacked internal boundary/chord, internal eave-height seams, fallback features, or unclassified feature lines. Any failure should be object-owned diagnostics, not a portal-only visual workaround.
- Plan coordinate transforms are owned by the plan view layer, not by React render branches. The `PlanCoordinateAdapter` contract is the traceable boundary for projection-to-SVG and SVG-to-projection conversions; Model Space pointer tools should consume this adapter rather than duplicating top-projection math in components.
- Top-projection layer ownership is owned by the plan render graph contract. Model Space presenters consume prepared `committedBodies` and `contextLines` from that graph, while later interaction slices should add `hitTargets`, `selectionOutlines`, `dimensions`, `dragPreview`, and `debug` as explicit graph layers instead of hidden renderer branches.
- `ModuleViewsCard` is now a compatibility shell for calculator card chrome and public exports; drawing-surface orchestration lives in `ModuleDrawingRenderer`. Plan and Section SVG internals live in their own surface modules (`ModulePlanSvg`, `ModuleSectionSvg`) while `ModuleDrawingRenderer` routes status, scale, and plan/section branch orchestration only. The renderer no longer owns or exports broad surface primitives; plan layout, footprint presentation, plan annotations, section presentation, scale presentation, diagnostics, and SVG bridge concerns are implemented in their named modules. Plan layout is split further into shared plan geometry helpers (`ModulePlanGeometryPresentation`), sheet layout (`ModulePlanSheetLayoutPresentation`), and model-space layout (`ModulePlanModelSpaceLayoutPresentation`); `ModulePlanLayoutPresentation` is only a compatibility facade for existing imports. Geometry-native section presentation lives behind `buildGeometrySectionPresentation`, so workbench Section View can draw from the artifact's `GeometrySectionViewModel` without converting it back into a calculator section model. `ModuleDrawingSurfacePrimitives` is limited to shared low-level atoms and SVG/measurement helpers used by more than one owner. Model Space layer JSX lives in the app-local `ModulePlanLayerRenderers` module. Plan SVG presentation prep lives behind `buildPlanSvgPresentationModel`; geometry-backed SVG presentation prep lives behind `buildPlanSvgGeometryPresentation`; Plan SVG client/SVG bridge wiring lives behind `ModulePlanSvgBridge`. Large plan-surface JSX is split into focused PlanSvg presenters for house context, pergola geometry, dimensions, footprint edit controls, and popover chrome; `ModulePlanSvg` remains the composition boundary that wires those presenters together. Shells should not rebuild render-graph ownership, geometry projection arrays, SVG resolver bridges, or duplicate overlay source counts inline.
- Projection-backed overlays must also declare their source. Selection outlines, hit targets, drag previews, and dimensions bind to `top_projection_committed` polygons only. `house_reference`, `top_projection_context`, `diagnostic_plan_reference`, opening overlays, and other reference polygons remain for host/reference math, explicit footprint editing, Sheet/fallback paths, or diagnostics, not normal Model Space overlays.
- Deck dragging in projection-backed plans must invert the same screen-axis transform used to draw the top projection, so pointer movement is screen-native. The live drag session uses the committed top-projection deck polygon, center, grabbed point, hit target, and preview polygon; SVG-only host-edge data and legacy/object polygons are kept out of live plan-space math. If the raw pointer-derived projection point is outside the committed deck polygon, the adapter normalizes both the grabbed point and drag-delta anchor to the same committed deck point and keeps the raw point as diagnostics only, so fallback anchoring cannot double-invert or drift the preview. Live snap candidates come from projected wall-edge context lines when available, with the committed top-projection house body as fallback. All projection-backed releases cross an explicit render-frame to object-frame commit boundary before writing deck fields; frame matching is semantic by wall side/orientation because projection and object footprints can number the same wall differently. Snapped releases persist the preview-derived host/center offset mapped into the object commit frame for the chosen wall, while floating releases build their saved floating rect from the frame-mapped object-space polygon rather than raw projected world XY. Floating releases remain valid away from walls, and late top-projection rebuilds are diagnostics, not user-facing failures.
- Calculator-era drawing surfaces are presenters for calculator/public-export paths only. Live workbench runtime must not depend on module plan/section models, house-context copies, or compatibility overlay bodies.
- Workbench guard tests enforce that runtime workbench roots do not import calculator, house-first, raw module, module-index, legacy plan/section, or costing contracts.

## Geometry And Costing Migration Roadmap

The full migration target is:

```text
object-first design intent
  -> @sp/geometry solved physical model
  -> geometry-derived quantity takeoff
  -> downstream commercial/costing adapter
  -> estimates / quotes / invoices / job packs
```

Workbench must not own pricing policy, and costing must not solve geometry. Portal may orchestrate, adapt, persist, and show status, but it must not duplicate package truth. `CommercialDesignInputV1` is allowed as the costing boundary and parity harness, not as a parallel geometry model.

Migration should proceed in this order:

1. Keep all geometry-ready plan, 3D, sheet, section, interaction, status, and snap consumers on `WorkbenchSolvedGeometryArtifact`.
2. Keep package-owned physical quantity takeoff in `packages/geometry`; expand it as solver support grows.
3. Introduce a downstream workbench commercial adapter only after the artifact/takeoff contract is stable.
4. Compare that adapter against calculator V1 in a separate commercial parity harness; do not put calculator adapters back into live workbench runtime.
5. Roll saved estimate or quote pricing to a workbench-solved commercial path only through an explicit rollout task with rollback.

Compatibility models may support old calculator and public-export paths outside the workbench. They must not become normal geometry-ready workbench paths, hidden commercial inputs, or long-term takeoff owners.

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
- The shared interaction layer is the only owner of pointer-session state, interaction-state vocabulary, preview lifecycle, blocked/allowed transitions, and commit diagnostics. `PlanViewport` and similar presenters host browser events, pointer capture, refs, and visual composition, but they should not branch into family-specific movement policy inline.
- Object-family adapters define what differs per object family: selectable/movable affordances, valid hosts or neighbors, snap candidates, attachment/hosting semantics, clearance/collision checks, movement constraints, preview shaping, and object-first patch generation.
- Object-to-object interaction should resolve against solved geometry, object IDs, and named relationship contracts. Interaction math must not depend on loose renderer overlays, SVG-only shapes, or family-specific viewport state as if those were the durable truth.
- Adding a new movable object should usually mean adding or extending a family adapter plus tests, not duplicating drag/session logic in a new viewport branch.

Deck dragging is the first concrete adapter pattern. Opening adapters also exist and should follow the same contract style.
Plan object move lifecycles are routed through interaction controllers for deck and opening movement. `PlanViewport` resolves DOM/client/projection pointers, pointer capture, scroll anchoring, and persistence callbacks; the controllers own start, move preview, release intent, and commit diagnostics.
Deck release reconciliation is also interaction-owned: frozen preview, commit result state, rebuilt-shape matching, projection settle status, and release feedback are resolved by the deck settlement controller. Deck release-to-patch conversion lives in the focused deck commit adapter, which is the only projection-backed path that maps render-space deck preview polygons into object-frame persisted deck fields. Snapped projection commits use the snap preview's resolved center offset instead of re-projecting a render-space polygon center into a different frame; floating commits serialize the mapped commit-space rectangle. The commit adapter's coordinate trace is carried through settlement and exposed as debug/test diagnostics so preview-to-commit and release-to-rebuilt drift can be measured directly. `PlanViewport` may schedule animation frames and pass viewport stability into those controllers, but it should not own deck settle or commit-transform policy.
Plan dimension editing is also interaction-owned. `planDimensionEditController` validates dimension annotation edits and returns typed commit intents for house footprint edits, deck patches, and opening patches; `PlanViewport` keeps the popover, focus, error state, and persistence callback boundary, but it should not own dimension-specific patch math.
Footprint editing and draw-outline lifecycles are interaction-owned. `footprintEditController` resolves footprint control, handle, vertex, edge-add, and vertex-delete intents; `drawOutlineToolController` resolves outline select, hover, pointer-session, click-vs-pan transitions, distance-lock, undo, close, cancel, and custom-polygon commit intents. `PlanViewport` keeps DOM pointer capture, pan/zoom, popover positioning, refs, and persistence callback calls.
Plan navigation math is interaction/view-domain owned. The navigation controller owns zoom clamping, anchored zoom, fit-view transforms, mouse pan, touch pinch, WebKit gesture scale, wheel gesture classification, and deck-drag navigation lock decisions. `PlanViewport` keeps browser event registration, refs, active touch bookkeeping, pointer capture, scroll anchoring, and viewport transform persistence.
Plan field resize math is interaction-owned. The resize controller owns editable field lookup, resize start value resolution, screen/projection delta conversion, clamping, and drawing field value formatting; `PlanViewport` keeps refs, pointer listeners, hover/active state, field errors, and persistence calls.

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
| 9 | Deleted workbench runtime module-input bridge (`apps/portal/lib/drawings/geometry/buildRawGeometryModuleInput.ts`) | Previously built raw calculator-shaped module inputs and wrapped non-pergola objects into host context. | Workbench runtime solves from `WorkbenchProjectModel` into object-id-keyed geometry artifacts. Calculator-shaped raw inputs may remain only outside live workbench roots. | [done] 2026-06-11 breakaway pass -- live workbench roots no longer import raw module input, module context, module-index selection, or calculator plan/section fallback contracts |

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

### Current migration stance

The older incremental migration notes are superseded for live workbench runtime as of the 2026-06-11 breakaway pass. The active contract is:

1. Workbench loads only object-first project state.
2. Workbench solves only through object-owned project geometry and object-id-keyed artifacts.
3. Workbench Plan, 3D, Sheet, Section, snap, status, and diagnostics consume the same solved artifact.
4. Calculator module inputs, house-first carriers, raw module/house-context wrapping, module-index selection, legacy plan/section fallback, and costing payloads are not allowed in live workbench roots.
5. Calculator/public-export code can keep its own compatibility presenters outside the workbench, but workbench must not import them as fallback geometry.

Each future step should ship an integration test or import guard that locks one of those invariants and prevents drift back to the pergola-centric or configurator-driven model.

### Breakaway constraints

- Snapshot-only calculator designs are unsupported/empty in the workbench. Do not synthesize object-first workbench state from them.
- Workbench repricing stays disabled until a downstream commercial adapter is introduced.
- Object ids, not module indexes, own selection, status, diagnostics, Plan bodies, 3D bodies, and snap targets.
- Invalid geometry renders diagnostic/reference geometry only. It must not borrow a committed body from another object.

### Next milestones

The foundation is now the object-first workbench spine. Future milestones should build on that spine, not on calculator compatibility.

12. ✅ **House through `applyAssemblyPosition3D` (shipped — closes audit row 5).** The house is a first-class spatial entity with its own world position routed through the geometry boundary. The pergola transform and house transform are independent.
13. ✅ **Drop workbench module-context wrapping (shipped 2026-06-11 — closes audit row 9 for live workbench runtime).** The workbench no longer builds calculator-shaped raw module inputs, accepts snapshot-only module state as geometry, adapts object-first pergolas through module rows, or routes selection/render decisions through a module index. House forms, pergolas, decks, openings, snap, status, diagnostics, Plan, and 3D all read the object-id-keyed solved artifact. Calculator/raw-module contracts may still exist in old calculator or package compatibility paths, but they are forbidden imports in live workbench roots.
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

Design workbench persistence uses local-first working copies for estimate drawing drafts. Object-first data is stored inside the estimate drawing draft shape. Older calculator-only snapshots are not live workbench geometry sources.

When changing persistence:

- Keep estimate locks respected.
- Preserve local draft recovery.
- Keep any future import/migration tooling outside the normal workbench load path.
- Add tests for object-first persistence and unsupported legacy snapshot boundaries.

## Verification

```bash
npm run test:portal:workbench
npm run test:portal -- apps/portal/lib/drawings
npm run test:portal -- apps/portal/components/drawings
npm run test:portal:browser
```

Latest local signal: on 2026-06-11, `npm run test:portal:workbench` passed with 74 Vitest files and 738 tests, then 5 no-auth fixture browser tests passed and 2 auth-backed/browser cases stayed skipped by design.

`npm run test:portal:browser` covers no-auth fixture rendering for nonblank Plan, 3D containment, top-projection parity, object-first fixture visibility, invalid-object diagnostics, and the breakaway behavior for snapshot-only calculator fixtures. It should fail if the fixture route redirects to login, becomes unavailable, silently renders hidden top-projection bodies, revives legacy workbench synthesis, or shows user-facing compatibility fallback text.

`apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.ts` carries fixture-only QA metadata for the baked workbench fixtures: source, purpose, parity-critical status, geometry family, authored house roof form, expected dimensions, material, attachment side, pitch, roof type, and roof plane count. `listParityCriticalSanctuaryGeometryWorkbenchFixtures()` is the shared registry for baked fixture parity gates. Representative saved estimate snapshot cases live in the commercial parity harness until a checked-in saved snapshot fixture corpus exists; do not invent private-data fixtures or bless drift without understanding the geometry change.

`apps/portal/lib/workbenchBreakawayImportGuards.test.ts` enforces the live runtime boundary: workbench roots must not import calculator, house-first, raw module, module-index, legacy plan/section, or costing contracts. Commercial parity tests should be reintroduced only with a downstream adapter outside the live workbench runtime.

For 3D or drawing UI work, use Playwright screenshots or visual checks in addition to unit tests. Authenticated edit/save/reload, high-risk visual QA, and persisted staff project checks remain release checks until safe staff data is configured locally or in CI.
