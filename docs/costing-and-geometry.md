# Costing And Geometry

Costing and geometry are shared domain sources of truth. Do not copy their logic into app code.

## Read First

- Use `## Costing Source Of Truth` before changing pricing or costing imports.
- Use `## Commercial Boundary And Migration Harness` and `## Portal Cost Overrides` for commercial shadow flow and override boundaries.
- Use `## Geometry Source Of Truth` before changing geometry solvers or portal drawing adapters.
- Use the projection and shape sections for top-projection, roof/span, gable, downslope, and acrylic rules.
- Finish with `## Verification` for package and app checks.

## Costing Source Of Truth

All costing logic and base config live in `packages/costing` and are imported through `@sp/costing`.

Use package imports such as:

```ts
import { calculateCostV1, calculateJobCostV1, loadCostingConfigV1 } from '@sp/costing';
```

Lint blocks legacy costing engine/config copies in app paths. If you need a costing behavior change, update `packages/costing` and then update call sites.

## Commercial Boundary And Migration Harness

The future commercial flow is geometry-first, but it remains shadow-only until an explicit integration task wires it into estimate or quote persistence:

```text
object-first design intent
  -> @sp/geometry solved physical model
  -> geometry-derived quantity takeoff
  -> @sp/costing commercial input and pricing
  -> estimates / quotes / invoices / job packs
```

- Design intent is the authored truth: house forms, pergolas, decks, openings, attachments, and options.
- Solved geometry is the physical truth: dimensions, planes, members, host zones, validation, interaction geometry, and trust.
- Geometry-derived quantity takeoff is the bridge between physical geometry and commercial pricing.
- Costing remains the commercial truth for materials, install/labour, overheads, accessories, BOM, quote breakdowns, and commercial comparison rules.

`CommercialDesignInputV1` is the costing-facing boundary and migration comparison contract. It is downstream of solved geometry and site/commercial options; it must not become a parallel geometry model. Existing `CostInputsV1`, `SiteInputsV1`, and `calculateSiteCostV1` remain the live pricing path until parity reports are stable and a later task explicitly changes that rollout boundary.

Workbench must not own pricing policy. Costing must not solve geometry. Portal may orchestrate, adapt, persist, and show status, but it must not duplicate package truth. Compatibility models may support fallback, migration, or diagnostics, but they must not become normal geometry-ready paths.

`packages/costing/src/commercial` exports the first shadow contract (`CommercialDesignInputV1`) and the calculator field-ownership map. Do not make saved estimates, quote totals, public outputs, or job-pack pricing consume the commercial boundary until an explicit rollout task lands.

`apps/portal/lib/estimates/commercialDesignPayload.ts` is the first portal-side shadow adapter. It converts current calculator inputs, plus an optional existing `SiteOutputV1`, into `CommercialDesignInputV1` for future comparison work. It is callable-only: it must not write saved estimate outputs, change quote totals, or replace the live `calculateSiteCostV1` path until a later explicit integration task.

`apps/portal/lib/drawings/commercialDesignPayload.ts` is the workbench-side shadow adapter. It converts `WorkbenchSolvedModel` plus explicit site commercial fields into `CommercialDesignInputV1` with `source: 'workbench_solved'`. It consumes solved geometry and quantity hooks only; it must not mutate geometry, persist commercial payloads, own physical takeoff policy long term, or replace live pricing until a later explicit integration task.

`compareCommercialDesignInputsV1()` in `@sp/costing` compares two commercial payloads and returns a structured parity report. These reports are shadow-only comparison signal for adapter and geometry alignment; they must not drive pricing, persistence, customer-facing quote totals, or job-pack output until a later explicit integration task.

## Portal Cost Overrides

Portal applies database overrides on top of `loadCostingConfigV1()`.

- Merge helpers: `apps/portal/lib/costing/overrides.ts`.
- Staff costing engine wrapper: `apps/portal/lib/costing/costEngine.ts`.
- Staff costing APIs: `apps/portal/app/api/staff/costing/v1`.
- Pricebook/admin cost surfaces: `apps/portal/app/pricebook` and `apps/portal/app/admin/costs`.

## Marketing Estimate Use

Marketing enquiry estimates also use `@sp/costing`. Do not create a marketing-only pricing fork.

Primary route:

```text
apps/marketing/app/api/enquiry/route.ts
```

## Geometry Source Of Truth

Canonical geometry solving lives in `packages/geometry`. There is one physical geometry truth:

```text
object-first design intent
  -> solved geometry
  -> viewer scene / top projection / section / sheet / snap / detail / interaction views
  -> physical quantity takeoff hooks
```

Portal workbench runtime packages this solved output as `WorkbenchSolvedGeometryArtifact`. Geometry-ready consumers should read scene, top projection, plan, section, validation, and trust/status metadata through that artifact first; loose plan/top-projection fields are compatibility aliases while legacy `ModulePlanModel` and sheet geometry remain fallback/presentation data.

Workbench viewport routing packages those view inputs as `WorkbenchViewportGeometry`. The 3D preview is routed from `viewportGeometry.artifact`/artifact-derived `preview`; Sheet and Model Space may still receive boxed `legacyFallback` plan/section data during migration, but that fallback is presentation support rather than a competing geometry source.

Sheet and Model Space routing packages drawing inputs as `WorkbenchDrawingSurfaceGeometry`. When solved geometry is ready, this surface contract points at the artifact plan, top projection, and section first; legacy `ModulePlanModel`/`ModuleSectionModel` values remain compatibility presenters or explicit fallback when the artifact is unavailable. `ModuleDrawingRenderer` consumes this drawing-surface contract instead of accepting loose model-space geometry props; lower SVG presenters may still receive prepared render inputs internally. Section View has a geometry-native presentation path for the artifact's `GeometrySectionViewModel`, so geometry-ready section rendering is a view of the solved geometry spine rather than a calculator-era section model fork.

Top projection, wall edges, section cuts, sheet plans, dimensions, snap frames, hit targets, and interaction frames must be generated from the same solved geometry. App-local calculator plan models, object-workbench overlays, and sheet renderers may adapt or present that geometry, but they must not own separate view-specific geometry that can drift from 3D or from saved object intent.

Physical takeoff should also be derived from the solved geometry spine. Portal shadow adapters may read geometry quantities during migration, but long-term takeoff policy belongs with package-owned geometry contracts, not app-local drawing or pricing code.

Top projection is scene-first: `buildTopProjectionViewModelFromScene()` projects the same `ViewerSceneModel` used by 3D into world-XY plan shapes. Mesh-backed house solids use the world `+Z` top-view contract, not render-mesh vertex order or face winding. The 3D Top camera sits above the model with screen X as world `-X` and screen Y down as world `+Y`; plan renderers mirror top-projection X coordinates to match that actual camera view and invert that same transform for deck drag coordinates. Geometry-ready Model Space is a projection-only surface: top projection is the single committed visual body source, and legacy/context/reference/opening overlays cannot draw normal Model Space bodies or draggable visible geometry. Sheet View and unsupported geometry fallback keep legacy paths. Normal projection rendering uses each shape's `metadata.topProjectionRole` so hidden lower envelope geometry and context/reference bodies cannot dominate or duplicate the plan. The assembly helper `buildTopProjectionViewModel()` remains available as a compatibility wrapper that builds the viewer scene, adds assembly reference shapes, and then calls the scene-first projection path.

Geometry-ready Model Space rendering is governed by a hard projection-only plan render graph. Its visible body layer is `committedBodies`; interaction state is limited to transparent `hitTargets`, `selectionOutlines`, `dimensions`, and `dragPreview` sourced from `top_projection_committed`. Scene-backed `house_line:wall_segment` objects may render as subtle context detail lines and are the preferred live deck host-edge snap frames; they are not committed bodies and do not drive extents. A selected deck or house must not cause a second filled body to appear from object-workbench or context geometry, and selected openings do not render legacy drag geometry in this mode. Overlay polygons must preserve source ownership: `house_reference`, `top_projection_context`, and `geometry_plan_fallback` polygons are only for reference math, explicit footprint editing, fallback paths, or diagnostics. Deck drag release is a round-trip contract: snapped previews must settle against rebuilt geometry, while floating releases persist the released projection rectangle directly and may report late projection rebuilds as diagnostics instead of blocking the move.

Portal drawing code adapts package output into workbench, plan, section, sheet, and preview state under:

- `apps/portal/lib/drawings`
- `apps/portal/components/drawings`

Compatibility paths must remain explicit. If a view uses fallback or compatibility-derived data, make that visible in naming, status, or tests.

Compatibility wrappers are non-canonical. They may translate legacy inputs into the solved geometry spine or provide explicit fallback views when solving is unavailable, but they must not become a second geometry source for normal geometry-ready workbench output.

## Top Projection Contract

Mesh-backed top projection must derive normal plan geometry from the 3D Top camera convention: world `+Z` looking down, screen X as world `-X`, and screen Y as world `+Y` downward. Roof and deck solids use their semantic top boundaries. Other mesh-backed solids use the highest non-vertical projected surface without trusting face winding. Lower envelope/context geometry must be classified with `topProjectionRole` and hidden from normal Model Space rendering unless it is intentional context.

Plan/3D accuracy work must also keep the top-view parity gate green. `buildTopProjectionParityReport()` verifies the scene/projection object contract, screen axis, hidden-shape extents, and rendered hidden-shape diagnostics. The portal drawing browser gate checks the fixture workbench's plan diagnostics against the 3D Top viewport convention. Projection-backed plans expose duplicate-body, context-body, render-layer, overlay-source, and deck-settle diagnostics; duplicate visual and rendered context body counts must remain `0`, and one semantic object may not own more than one visible body layer.

## Roof Length And Span

- Roof Length: dimension parallel to the ridge or gutter.
- Roof Span: total width across the roof.
- Pitched: span is the single sloped width from house to gutter.
- Gable: span is full eave-to-eave width across both sides.

## Gable Per-Plane Drivers

For gable roofs, the engine models two roof planes sharing a ridge beam.

- `roof_plane_count = 2`
- `roof_plane_span_m = roof_span_m / 2`
- `roof_plane_sloped_downslope_m = roof_plane_span_m / cos(pitch)`

## Downslope Drivers

Acrylic and joiner downslope length use the same physical driver:

- `cut_rafter_length_m = effective_run_m / cos(pitch)`
- `joiner_piece_length_m = cut_rafter_length_m + 0.020m`
- `acrylic_required_downslope_m = joiner_piece_length_m`

`effective_run_m` excludes house and gutter setbacks.

## Acrylic Sheet Rounding

Sheet-mode acrylic quantity is computed from total acrylic area, then rounded once:

```text
sheet_count = ceil(acrylic_area_total_m2 / sheet_area_m2)
```

Do not round per plane and then sum. That over-counts some gable cases.

## Verification

For costing changes:

```bash
npm run test -- packages/costing
npm run test:portal
npm run test:marketing
```

For geometry changes:

```bash
npm run test -- packages/geometry
npm run test -- packages/geometry/src/topProjection.test.ts packages/geometry/src/contracts.test.ts
npm run test:portal:browser
```
