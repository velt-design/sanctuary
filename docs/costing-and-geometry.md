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

Workbench pricing is intentionally disconnected in the 2026-06-11 breakaway pass. The live workbench does not build site-costing inputs, does not call costing engines, and does not save repriced outputs. Marketing enquiry and calculator V1 pricing remain separate protected paths.

`CommercialDesignInputV1` is the separate commercial parity and rollout-readiness contract. It is downstream of solved geometry and site/commercial options; it must not become a parallel geometry model or a competing live pricing path. Saved estimate pricing remains on the existing calculator path until a later explicit workbench-commercial rollout.

Workbench must not own pricing policy. Costing must not solve geometry. Portal may orchestrate, adapt, persist, and show status, but it must not duplicate package truth or reintroduce calculator-shaped inputs into live workbench runtime.

`packages/costing/src/commercial` exports the first shadow contract (`CommercialDesignInputV1`) and the calculator field-ownership map. Do not make saved estimates, quote totals, public outputs, or job-pack pricing consume the commercial boundary until an explicit rollout task lands.

`apps/portal/lib/estimates/commercialDesignPayload.ts` is the first portal-side shadow adapter. It converts current calculator inputs, plus an optional existing `SiteOutputV1`, into `CommercialDesignInputV1` for future comparison work. It is callable-only: it must not write saved estimate outputs, change quote totals, or replace the live `calculateSiteCostV1` path until a later explicit integration task.

There is no live workbench-side commercial adapter in the breakaway runtime. Future workbench commercial integration should consume `WorkbenchSolvedGeometryArtifact`/geometry quantity takeoff downstream and stay outside geometry/render decisions.

`compareCommercialDesignInputsV1()` in `@sp/costing` compares two commercial payloads and returns a structured parity report. Difference diagnostics carry the legacy comparison category, a drift origin, and `originDetail` with the origin, source category, field path, and a short explanation. Origins are authored intent, solved geometry, physical takeoff, or commercial mapping. These reports are shadow-only comparison signal for adapter and geometry alignment; they must not drive pricing, persistence, customer-facing quote totals, or job-pack output until a later explicit integration task.

Any future live rollout gate for workbench-solved pricing belongs at the estimate persistence boundary, not inside geometry, drawing, or costing packages. It must require ready workbench trust, package-owned geometry quantity takeoff, explicit estimate source metadata, preserved locks/local-first behavior, preserved downstream quote/invoice/job-pack boundaries, and an explicit rollback switch to calculator V1 pricing.

Do not price from calculator while claiming the saved source is workbench-solved. Until the downstream adapter is introduced, workbench save/reprice controls should stay disabled or unavailable.

## Portal Cost Overrides

Portal applies database overrides on top of `loadCostingConfigV1()`.

- Merge helpers: `apps/portal/lib/costing/overrides.ts`.
- Staff costing APIs: `apps/portal/app/api/staff/costing/v1`.
- Staff costing metadata fetch helper: `apps/portal/lib/costing/costEngine.ts`.
- Pricebook/admin cost surfaces: `apps/portal/app/pricebook` and `apps/portal/app/admin/costs`.

## Marketing Estimate Use

Marketing enquiry estimates also use `@sp/costing`. Do not create a marketing-only pricing fork.

Pitched-acrylic pergolas use a flat `$2000 ex GST` overhead total only when EVERY module is `pergola_style === 'pitched'` AND `roof_material === 'acrylic'` AND not `box_perimeter`, AND every acrylic module is at or below `3.0m` sloped `rafter_length_m`. If any module fails any of those checks (gable, hip-corner, box-perimeter, mixed/timber, or rafter > 3m), the costing engine falls back to the normal `fixed_plus_variable` overhead formula. (Tightened from "any acrylic-only" to "pitched-acrylic only" in PR-PE2 / 2026-06-16 — gable / box-perimeter / hip-corner acrylic builds carry their own per-style startup costs that the flat cap was hiding.)

Website enquiry base pergola budgets use the `1.20x true cost` lower amount only and encode that as equal low/high values; optional blinds remain a range. (Reduced from `1.25x` in PR-PE1 / 2026-06-16. The marketing route also explicitly sets `post_count: 2` to match the typical "standard build" instead of inheriting the cost engine's default of 4. Portal staff customer pricing remains a separate `1.25x` surface. `apps/portal/lib/quotes/pricing.ts` owns its rounded ex-GST-then-GST sequence for both the calculator preview and quote mapping.)

Primary route:

```text
apps/marketing/app/api/enquiry/route.ts
```

## Infill Takeoff And Procurement

`calculateInfillsTakeoffV1()` in `@sp/costing` is the canonical owner of valid infill geometry, finished pieces, joiners, added 50x50 supports, and purchase stock. The costing BOM, labour drivers, calculator cut list, and CSV export must consume this takeoff; portal code may validate draft strings and present the result but must not independently recalculate valid infills.

The aperture is solved as a polygon and sliced at panel boundaries. Rectangle, trapezoid, and triangle panel geometry remains traceable to module, infill, and instance IDs. A mono-slope with exactly one zero-height endpoint is a valid three-edge triangle; the collapsed side is removed from perimeter joiners and support cuts rather than emitted as a zero-length material. Both endpoints at zero remain invalid. Perimeter joiners remain required even when an existing structural support is present. Missing structural supports add length-bearing 50x50 cuts. Bottom offset is installation position only and does not alter the aperture or finished cuts. Mono-slope top length comes from the infill width and its own height difference.

Roof-rafter matching is valid only for vertical panels on a full front or house edge with derived rafter spacing. A partial edge, missing spacing, horizontal request, or unrelated location is a blocking takeoff error and requires explicit support positions or a different mode.

Procurement is physical rather than area-based:

- sheet stock is `3.05m x 2.03m`, allows 90-degree rotation, and uses deterministic shelf/guillotine placement;
- non-rectangular panels reserve their full bounding rectangle;
- Crystalite uses fixed `620mm`-wide stock in `4m`, `5m`, and `6m` lengths;
- strip, joiner, and 50x50 stock use one-dimensional packing with `3mm` kerf between consecutive cuts;
- there is no edge trim allowance, so one exact `3.05m` finished sheet cut may use the nominal sheet length;
- physical offcuts pool only within the current job/site scope; module takeoffs remain standalone comparison outputs;
- any piece that cannot fit available stock blocks materials/save/export instead of falling back to total area.

Module, job, pergola, and site costing outputs expose additive `infill_takeoff` data. Job and site material totals are summed from the final pooled material lines, not pre-pooling module totals.

## Geometry Source Of Truth

Canonical geometry solving lives in `packages/geometry`. There is one physical geometry truth:

```text
object-first design intent
  -> solved geometry
  -> viewer scene / top projection / section / sheet / snap / detail / interaction views
  -> geometry-owned physical quantity takeoff
```

Portal workbench runtime packages this solved output as `WorkbenchSolvedGeometryArtifact`. Geometry-ready consumers read scene, top projection, plan, section, validation, and trust/status metadata through that artifact; calculator plan/section models are not live workbench fallbacks.

Workbench viewport routing packages those view inputs as `WorkbenchViewportGeometry`. The 3D preview is routed from `viewportGeometry.artifact`/artifact-derived `preview`; Plan, Sheet, Section, snap, diagnostics, and status consume artifact-derived views.

Sheet and Plan routing packages drawing inputs as `WorkbenchDrawingSurfaceGeometry`. When solved geometry is ready, this surface contract points at artifact plan, top projection, and section views. `ModuleDrawingRenderer` remains a calculator/public-export presenter, not a live workbench geometry fallback.

Top projection, wall edges, section cuts, sheet plans, dimensions, snap frames, hit targets, and interaction frames must be generated from the same solved geometry. App-local calculator plan models, object-workbench overlays, and sheet renderers may adapt or present that geometry, but they must not own separate view-specific geometry that can drift from 3D or from saved object intent.

Physical takeoff should also be derived from the solved geometry spine. Portal shadow adapters may read geometry quantities during migration, but long-term takeoff policy belongs with package-owned geometry contracts, not app-local drawing or pricing code.

Host house identity is an object-id contract. Workbench callers resolve host relationships through object references and the solved project artifact, not through per-module house-context copies.

Workbench project solving enters geometry from `WorkbenchProjectModel` and returns object-id-keyed solved artifacts. Houses solve as houses, pergolas solve as pergolas, decks/openings keep their own object contracts, and invalid objects return diagnostics/reference geometry without borrowing another object's committed body.

`GeometryQuantityTakeoff` includes package-owned physical buckets for primary/secondary dimensions, roof planes, members, rafters, beams, gutters, roof cladding, joiners, flashings from `Assembly3D.roofFlashings`, and rafter layout facts such as bay count, projected run, cut length, and average spacing. Roof cladding takeoff may expose physical effective run and downslope length from solved panels. Low-level `QuantityHook` values remain compatibility data. Custom calculator flashing rows, downpipes, sheet rounding, BOM, labour, markup, and pricing policy remain outside geometry.

Top projection is scene-first: `buildTopProjectionViewModelFromScene()` projects the same `ViewerSceneModel` used by 3D into world-XY plan shapes. Mesh-backed house solids use the world `+Z` top-view contract, not render-mesh vertex order or face winding. Project-level house-form Plan projection has one extra ownership rule: `buildHouseModelTopProjectionShapes()` emits the committed house roof body from the solved eave perimeter (`house_plan_roof:<formId>`), while roof-material ribs/seams stay out of committed Plan bodies. If a custom hipped house uses a render-only repaired eave topology, Plan must use the repaired eave package from the same `HouseModel3D` metadata/geometry rather than recomputing a body from the saved wall footprint. Object-owned house footprints cross a package-owned numeric boundary before wall/eave/roof solving: solved geometry input is rounded to `0.001 mm`, duplicate consecutive points are collapsed, and residue-only collinear points may be removed without mutating saved workbench values. Fully hipped non-rectangular orthogonal house footprints that fail with eave-offset self-overlap now try the package-owned `orthogonal_cell_union` eave boundary at the requested overhang before any approximate reduced-overhang or narrow-return repair. That exact eave boundary can commit only when downstream roof QA also proves valid; otherwise the roof remains invalid or falls through to the existing approximate repair path with `roofEaveOffsetRepair*` metadata. After eave construction, fully hipped custom roofs first try the package-owned `source_edge_exact_envelope_partition` topology candidate, which exposes exact partition QA metadata and can commit only when semantic QA proves a clean eave partition. Until that exact path proves every captured family, the older `eave_graph_source_edge_envelope` candidate may still commit when it passes the same semantic gate. If both fail, `source_edge_coverage_partition` may recover split source-edge faces only when it proves every source eave edge is represented, there are no gaps/overlaps, no unbacked internal boundary/chord, no internal eave-height seams, no fallback valley features, and feature lines are backed by final facet adjacency. Otherwise package QA marks the roof invalid and Plan/3D render diagnostic/reference geometry only. Open-end/gable variants remain on the existing joined path until that topology is retired separately. `HouseModel3D.footprint` is the canonical solved footprint for Plan, 3D, status, snap/reference geometry, and diagnostics, with `footprintCanonicalization*`, `eaveOffset*`, and topology metadata exposing runtime-only cleanup. The 3D Top camera sits above the model with screen X as world `-X` and screen Y down as world `+Y`; plan renderers mirror top-projection X coordinates to match that actual camera view and invert that same transform for deck drag coordinates. Geometry-ready Plan Editor is a projection-only surface: top projection is the single committed visual body source, and legacy/context/reference/opening overlays cannot draw normal Plan Editor bodies or draggable visible geometry. Sheet View and unsupported geometry fallback keep legacy paths. Normal projection rendering uses each shape's `metadata.topProjectionRole` so hidden lower envelope geometry and context/reference bodies cannot dominate or duplicate the plan.

Geometry-ready Plan Editor rendering is governed by a hard projection-only plan render graph. Its visible body layer is `committedBodies`; interaction state is limited to transparent `hitTargets`, `selectionOutlines`, `dimensions`, and `dragPreview` sourced from `top_projection_committed`. Scene-backed `house_line:wall_segment` objects may render as subtle context detail lines and are the preferred live deck host-edge snap frames; they are not committed bodies and do not drive extents. A selected deck or house must not cause a second filled body to appear from object-workbench or context geometry, and selected openings do not render legacy drag geometry in this mode. Overlay polygons must preserve source ownership: `house_reference`, `top_projection_context`, and `geometry_plan_fallback` polygons are only for reference math, explicit footprint editing, fallback paths, or diagnostics. Deck drag release is a round-trip contract: snapped previews must settle against rebuilt geometry, while floating releases persist the released projection rectangle directly and may report late projection rebuilds as diagnostics instead of blocking the move.

Portal drawing code adapts package output into workbench, plan, section, sheet, and preview state under:

- `apps/portal/lib/drawings`
- `apps/portal/components/drawings`

Compatibility paths must remain explicit. If a view uses fallback or compatibility-derived data, make that visible in naming, status, or tests.

Compatibility wrappers are non-canonical. They may translate legacy inputs into the solved geometry spine or provide explicit fallback views when solving is unavailable, but they must not become a second geometry source for normal geometry-ready workbench output.

## Top Projection Contract

Mesh-backed top projection must derive normal plan geometry from the 3D Top camera convention: world `+Z` looking down, screen X as world `-X`, and screen Y as world `+Y` downward. Roof and deck solids use their semantic top boundaries. Other mesh-backed solids use the highest non-vertical projected surface without trusting face winding. Lower envelope/context geometry must be classified with `topProjectionRole` and hidden from normal Plan Editor rendering unless it is intentional context.

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

Roof-cladding sheet-mode acrylic quantity is computed from total acrylic area, then rounded once:

```text
sheet_count = ceil(acrylic_area_total_m2 / sheet_area_m2)
```

Do not round per plane and then sum. That over-counts some gable cases.

This area-rounding rule does not apply to infills. Infill sheets use the physical placement rules above.

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
