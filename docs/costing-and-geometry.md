# Costing And Geometry

Costing and geometry are shared domain sources of truth. Do not copy their logic into app code.

## Costing Source Of Truth

All costing logic and base config live in `packages/costing` and are imported through `@sp/costing`.

Use package imports such as:

```ts
import { calculateCostV1, calculateJobCostV1, loadCostingConfigV1 } from '@sp/costing';
```

Lint blocks legacy costing engine/config copies in app paths. If you need a costing behavior change, update `packages/costing` and then update call sites.

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

Canonical geometry solving lives in `packages/geometry`.

Top projection is scene-first: `buildTopProjectionViewModelFromScene()` projects the same `ViewerSceneModel` used by 3D into world-XY plan shapes. Mesh-backed house solids use the world `+Z` top-view contract, not render-mesh vertex order or face winding. Normal Model Space rendering uses each shape's `metadata.topProjectionRole` so hidden lower envelope geometry cannot dominate the plan. The assembly helper `buildTopProjectionViewModel()` remains available as a compatibility wrapper that builds the viewer scene, adds assembly reference shapes, and then calls the scene-first projection path.

Portal drawing code adapts package output into workbench, plan, section, sheet, and preview state under:

- `apps/portal/lib/drawings`
- `apps/portal/components/drawings`

Compatibility paths must remain explicit. If a view uses fallback or compatibility-derived data, make that visible in naming, status, or tests.

## Top Projection Contract

Mesh-backed top projection must derive normal plan geometry from the 3D Top camera convention: world `+Z` looking down, screen X as world `+X`, and screen Y as world `+Y` downward. Roof and deck solids use their semantic top boundaries. Other mesh-backed solids use the highest non-vertical projected surface without trusting face winding. Lower envelope/context geometry must be classified with `topProjectionRole` and hidden from normal Model Space rendering unless it is intentional context.

Plan/3D accuracy work must also keep the top-view parity gate green. `buildTopProjectionParityReport()` verifies the scene/projection object contract, screen axis, hidden-shape extents, and rendered hidden-shape diagnostics. The portal drawing browser gate checks the fixture workbench's Model Space Plan diagnostics against the 3D Top viewport convention.

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
