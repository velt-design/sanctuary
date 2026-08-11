# Costing And Geometry

Costing and geometry are shared domain sources of truth. Do not copy their logic into app code.

## Read First

- Use `## Costing Source Of Truth` before changing pricing or costing imports.
- Use `## Commercial Boundary And Migration Harness` and `## Costing Configuration Control` for commercial shadow flow and configuration boundaries.
- Use `## Geometry Source Of Truth` before changing geometry solvers or portal drawing adapters.
- Use the projection and shape sections for top-projection, roof/span, gable, downslope, and acrylic rules.
- Finish with `## Verification` for package and app checks.

## Costing Source Of Truth

All costing logic and base config live in `packages/costing` and are imported through `@sp/costing`.

`loadCostingMaterialsV1()` is the narrow package-owned material-catalogue boundary for consumers such as infill stock-length lookup that do not need install, overhead, rule, hardware, BOM, or manifest data. `loadCostingConfigV1()` composes that exact merged catalogue into the unchanged full configuration contract. Do not make a narrow consumer import the full loader merely to read `materials`, and do not copy the catalogue into an app.

Use package imports such as:

```ts
import { calculateCostV1, calculateJobCostV1, loadCostingConfigV1 } from '@sp/costing';
```

Lint blocks legacy costing engine/config copies in app paths. If you need a costing behavior change, update `packages/costing` and then update call sites.

Blind customer pricing is also owned by `@sp/costing`. The banded base price receives its fabric multiplier and then a `1.15x` core selling uplift before GST. Motorisation remains a fixed `$900 inc GST` add-on. A blind-roll flashing is `$44/m inc GST` and a pelmet is `$145/m inc GST`, both charged from the entered blind width rather than the pricing-table width band; No cover adds nothing. Motor and roll-cover add-ons do not receive the core uplift. Inclusive blind totals are the quote-line authority, and aggregate ex-GST display totals are derived from those inclusive line totals so calculator and quote totals stay aligned.

Rafter-lighting customer pricing is package-owned and GST-inclusive. Each configured acrylic pergola receives an `$800` startup that includes labour and its first driver, `$190` per light, one optional `$500` dimmer, and `$500` for each additional driver. A standard driver supports 16 lights; a dimmed driver supports 12. Driver quantity is derived, lighting is not limited by rafter count, and each pergola is priced independently. Lighting stays at list price outside the quote discount. Structured calculator lighting takes precedence over the historical opaque lighting-total fallback.

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

Calculator quote discount remains a selling-price policy outside true-cost calculation. The shared portal quote-pricing helper applies it only after the frozen cost-to-sell multiplier and before GST; quote mapping and calculator customer-price displays consume the same helper. Historical outputs without a multiplier use `1.25`, while manifest `v2.4` freezes `1.3`. Actual-cost calibration is also downstream: it compares staff-entered actuals with frozen estimate outputs and must never mutate historical costing inputs or outputs.

`packages/costing/src/commercial` exports the first shadow contract (`CommercialDesignInputV1`) and the calculator field-ownership map. Do not make saved estimates, quote totals, public outputs, or job-pack pricing consume the commercial boundary until an explicit rollout task lands.

`apps/portal/lib/estimates/commercialDesignPayload.ts` is the first portal-side shadow adapter. It converts current calculator inputs, plus an optional existing `SiteOutputV1`, into `CommercialDesignInputV1` for future comparison work. It is callable-only: it must not write saved estimate outputs, change quote totals, or replace the live `calculateSiteCostV1` path until a later explicit integration task.

There is no live workbench-side commercial adapter in the breakaway runtime. Future workbench commercial integration should consume `WorkbenchSolvedGeometryArtifact`/geometry quantity takeoff downstream and stay outside geometry/render decisions.

`compareCommercialDesignInputsV1()` in `@sp/costing` compares two commercial payloads and returns a structured parity report. Difference diagnostics carry the legacy comparison category, a drift origin, and `originDetail` with the origin, source category, field path, and a short explanation. Origins are authored intent, solved geometry, physical takeoff, or commercial mapping. These reports are shadow-only comparison signal for adapter and geometry alignment; they must not drive pricing, persistence, customer-facing quote totals, or job-pack output until a later explicit integration task.

Any future live rollout gate for workbench-solved pricing belongs at the estimate persistence boundary, not inside geometry, drawing, or costing packages. It must require ready workbench trust, package-owned geometry quantity takeoff, explicit estimate source metadata, preserved locks/local-first behavior, preserved downstream quote/invoice/job-pack boundaries, and an explicit rollback switch to calculator V1 pricing.

Do not price from calculator while claiming the saved source is workbench-solved. Until the downstream adapter is introduced, workbench save/reprice controls should stay disabled or unavailable.

## Costing Configuration Control

`@sp/costing` remains the only calculation authority. `packages/costing/src/controlConfig.ts` defines the exact typed configuration snapshot, validation, application, deterministic diff, and representative-scenario impact preview. The database stores JSON values conforming to that contract; it never stores JavaScript, SQL, predicates, quantity expressions, or unrestricted formulas.

The admin-only control centre is `/admin/costing`. Its browser component calls guarded admin APIs only. `apps/portal/lib/costing/configurationAdmin.ts` owns draft/version orchestration, while `configurationResolver.ts` owns the staff calculation read path. Published version rows are immutable; a separate singleton publication row points to the current version so switching versions never mutates an old published row.

The admin experience is a guided `Overview -> Edit settings -> Review impact -> Publish` workflow. Every draft and immutable published version has a concise name and purpose; these are version identity, not a replacement for the separate publication audit note. The editor payload includes the validated active configuration snapshot alongside the selected draft so the UI can show active and draft values, changed counts by section, grouped material categories and labour subsections, changed-only filtering, and field/group/section resets without reconstructing costing logic in the portal. Material context may display existing package-owned product, supplier, unit, category, notes, and unconfirmed-assumption flags, but those identities and meanings are not editable.

Draft changes remain browser-local until `Save & validate` calls the admin API. While editing, a debounced admin-only validation request runs the same package-owned typed and cross-field validation without saving or touching Supabase rows; save and publish still revalidate authoritatively. Package validation issues are attached to business-labelled fields. Review continues to use the package-generated diff and fixed representative-scenario preview, including material, labour, overhead, and total movement. Admins can optionally select a recent or searched saved estimate and compare its frozen calculator inputs under the active and saved-draft configurations. This real-estimate preview is server-calculated through the canonical calculator-to-site adapter and `@sp/costing`; it is read-only and never updates the estimate, its frozen outputs, or provenance. UUIDs, hashes, schema names, manifests, and raw diff paths are available only as optional technical detail.

Current data flow:

```text
admin draft
  -> non-mutating package validation
  -> package diff + calculateSiteCostV1 fixed and optional frozen-estimate preview
  -> confirmed atomic publish RPC + append-only audit event
  -> current publication pointer
  -> package validation/application on each server costing read
  -> package calculation
  -> exact costingConfiguration provenance on the response
  -> frozen estimate outputs + configVersions.costingControl + version foreign key
```

Before the first version is explicitly published, the resolver preserves the previous effective behavior: it loads the legacy material/action/curve overrides, snapshots their exact effective typed configuration, hashes it, and returns that snapshot as calculation provenance. Once a version is published, staff calculator, materials-explain, V2 costing, and job-pack material-option reads use the published version. A database error after the version schema exists fails closed; it must not silently fall back from a published version to package defaults. The legacy immediate-write routes return `409` and the old Pricebook pages redirect to the control centre.

Production published **Version 1 — Current portal baseline** on 2026-08-04 from the complete active legacy-effective `v1.8` snapshot. The authoritative review recorded `0` changed values and `0.0%` movement across every representative scenario. Staff costing, the public Simple cover calculator, and the website enquiry costing snapshot now resolve that immutable version; the public response exposes only `versionNumber: 1` provenance.

### Complete configuration boundary

The v1 control contract is exhaustive by exact keyset. Unknown keys and missing package keys fail validation.

| Current item | Classification | Editable shape |
| --- | --- | --- |
| Every active `materials.items[*].cost_ex_gst` value (currently 150 package material IDs) | Safely admin-editable | Non-negative ex-GST number; material identity, unit, attributes, and supplier/product meaning remain package-owned. |
| Install crew-hour rate | Safely admin-editable | Positive ex-GST number; inc-GST companion is derived by the package adapter. |
| Every action with an existing `base_minutes` value (currently 35 scalar actions and 4 by-profile actions; actions without a base value remain unavailable) | Constrained typed rule | Non-negative bounded minutes. By-profile actions must retain the package-defined profile key and exact profile options. |
| Existing multiplier values in `access`, `access_logistics`, `height`, `ground`, `structure_type`, and `roof_type` | Constrained typed rule | Positive bounded numbers with the exact package-defined groups/options. Action applicability and multiplier attachment remain code/config-manifest logic. |
| Rafter-length loading curve | Constrained typed rule | Two to twenty bounded points with strictly increasing lengths. Interpolation and use of the curve remain package code. |
| Eight named overhead allocation values: crew-day hours; operations fixed/job, variable/crew-day, gable startup, box startup, timber/rounded crew-day; sales/design per job and extra-module factor | Safely admin-editable | Individually bounded numbers. Allocation formulas and eligibility predicates remain package code. |
| Overhang default/min/max; nine box-perimeter dimension/pitch/setback allowances; acrylic max slope; cedar cover and waste factor; BOM stock-length preference | Constrained typed rule | Named bounded values with cross-field validation (`min <= default <= max`), unique stock lengths, and exact package field ownership. |
| Site travel, extras, timber-roof allowance, and quote discount | Per-estimate inputs, not global configuration | Continue to be entered and frozen with the estimate; they are not Calculator Brain settings. |

### Code-owned semantics

The following are deliberately not database-editable:

- costing formulas, action applicability predicates, quantity expressions, multiplier attachment rules, curve interpolation, material/BOM expressions, hardware placeholder expressions, and warning logic;
- geometry normalization/derivation, rafter and member solving, sheet/stock rounding, infill takeoff, pooling, kerf and bin-packing algorithms;
- Simple/Bespoke eligibility, progressive Simple overhead, approval allowance formulas, GST rate, currency rounding sequence, job/site aggregation, and customer-price/discount sequence;
- blind band tables, fabric factors, selling uplift, motor/cover add-on rates, and blind rounding;
- generic minimum charges (the active engine has no generic minimum-charge rule), new allowance categories, arbitrary supplier formulas, and executable formulas;
- manifest file selection, material/action identities and units, supplier/product attributes, roof/style option semantics, marketing standard-build assumptions, and workbench/commercial input migration.

Changing any code-owned item is a normal package semantic change with package regression tests and explicit review. It must not be smuggled into a database setting merely to make the editor more flexible.

### Version and rollback rules

- Draft rows may be edited and revalidated; published rows are immutable.
- A stale first draft can be reset in one explicit action to the complete active legacy-effective snapshot, including the package manifest version; resetting only visible rate sections is not sufficient for an exact baseline publication.
- Draft name and purpose use bounded plain text and persist when a version is cloned. The publication note remains a separate publish-time audit field.
- Publishing requires a saved hash, compare-time current-version ID, non-empty audit note, and representative impact. Normal publications also require a clear diff. The first publication may have an empty diff only when it freezes the active legacy-effective portal pricing unchanged as Version 1. The RPC locks publication and rejects stale drafts or comparisons.
- Rollback means cloning a compatible previous published version into a new draft and publishing that new version. History is never rewritten.
- A package manifest change must ship with an explicit compatibility/migration decision for the current published control snapshot. Incompatible published data fails closed.
- Published estimates store `estimates.costing_config_version_id`; pre-publication estimates store the full hashed legacy control snapshot in `outputs.configVersions.costingControl`. All estimates retain frozen inputs and outputs as the historical commercial record.

The active package manifest is `v2.5`. It retains `v2.4` commercial behavior and adds only the two governed powdercoat assumptions used by Additional aluminium. Compatible published `v2.4` and earlier controls hydrate those new identities from the immutable `v2.5` base after their original content hash is verified; all stored rates and original commercial semantics remain unchanged. A fresh draft copies the active editable rates and advances to `v2.5`. Cloning an older version preserves that version's commercial semantics for rollback.

Manifest `v2.0` corrects non-continuous extrusion procurement such as rafters. The BOM compares the whole purchase needed for each eligible stock length and chooses the lowest total ex-GST cost, then least waste, fewest bars and lowest cost per metre. Continuous ledger, beam, stringer and gutter runs keep the splice-minimising rule. Published `v1.9` retains the earlier cost-per-metre-first non-continuous selection so Version 2 remains reproducible.

Manifest `v2.1` derives Simple site days from productive installation actions only. Manifest `v2.4` extends that basis to Bespoke after multiplying productive actions by `1.2`. One-time mobilisation/demobilisation remains charged once and is not multiplied; setup, pack-down and tidy are charged once per resulting genuine site day. Published `v2.3` and earlier retain their original site-day behavior.

Manifest `v2.3` retains the existing actual sloped rafter cut-length and total-installed-metre takeoff. It keeps the live 2m and 3m loading points at `0.50` and `1.00`, then raises the 4m, 5m and 6m points to `3.75`, `6.50` and `7.80`. The engine linearly interpolates between points, so increasing projection produces a smooth labour increase rather than a threshold jump. Published `v2.2` and earlier controls preserve their frozen curve values, including any administrator-edited values.

Calculator-only `additional_aluminium` rows are explicit full-bar material purchases attached to one module. The staff-only catalogue endpoint derives selectable aluminium profiles and stock lengths from Mill rows in the active published pricebook; it does not expose costs to the browser. The costing package selects the matching bar in the module finish, applies the existing Mill powdercoat overlay and `1.2x` custom-colour multiplier, and includes the result in module and site materials. These rows never enter geometry, member sizing, or install actions. The assumed missing standard powdercoat surcharges are `$40.4853 ex GST` for 200x50 6m and `$34.80 ex GST` for Overhang Gutter 100x100 6m; both remain marked supplier-confirmation required in the additions catalogue.

## Marketing Estimate Use

Marketing enquiry estimates also use `@sp/costing`. Do not create a marketing-only pricing fork.

Version 2 adds a package-owned `Simple | Bespoke` classification. From manifest `v2.4`, Simple can include one residential acrylic/open pitched, acrylic gable, or acrylic box-perimeter pergola/module with fascia/facade/soffit connection, deck brackets, normal access, easy ground, standard black finish, no infills, and at most 30m² single-storey or 20m² two-storey. Structural-validity warnings remain independent and can still block an invalid box-perimeter fall. Any failed condition, manual Bespoke selection, engineering, or full building consent resolves to Bespoke. Both classifications use one `$500 ex GST` site startup plus `$500 ex GST` per pro-rated productive crew-day and the same `1.3x` customer-price multiplier with no classification uplift. Bespoke adds `$1,200 ex GST` design per site, `$800` per additional pergola, and `$300` for each module beyond the first module in its pergola; its productive installation actions take `20%` longer. Published `v2.3` and earlier retain their prior overhead, uplift, multiplier, eligibility and site-day semantics.

The staff calculator's `roof_material: none` mode is an open pergola frame, not a new roof form. `@sp/costing` normalizes it to the standard pitched structure at `0°`. Rafters, the front beam, and any attached ledger default to `150x50`, remain independently editable, and use the available `50mm`-wide profile sizes; the post profile remains unchanged. `rafter_spacing_mm` is a positive target maximum: it defaults to `500`, has no upper cap, and the engine evenly distributes rafters so the resolved spacing does not exceed it. Roofing, roof foam, gutters, downpipes, automatic or entered flashings, and their covering/drainage labour are zero. Open pergolas can use the active Simple eligibility, overhead and customer-price policy. Failed eligibility or approval requirements still resolve through Bespoke pricing. The public Simple cover calculator remains acrylic-only.

Engineering and full building consent are direct customer sell allowances with markup already included, excluding GST and not discountable. Engineering is `$5,000 ex GST`; full consent (including engineering) is `$10,000 ex GST`. Both add `$3,000` per pergola after the first and `$1,500` per module beyond the first module included with each pergola. They remain separate from internal true cost and are frozen as customer add-ons for calculator preview and quote handoff.

Website enquiry base pergola budgets use the canonical core customer price as a lower-only amount and encode that as equal low/high values; optional blinds remain a range based on the same corrected shared blind list-price baseline, with No cover assumed. An ordinary enquiry resolves the active immutable published configuration once, builds one canonical two-post "standard build" snapshot and reuses it for email, saved inputs, exact outputs and provenance. A Simple calculator-linked enquiry instead verifies the opaque server-issued calculation reference, resolves its exact historical immutable publication and re-creates the same frozen calculator snapshot; its selected connection, automatic post count, level, inputs, exact outputs, displayed amount and provenance replace the ordinary enquiry assumptions together. Missing/invalid publication or reference removes the linked base price without blocking the enquiry; it never falls back to package defaults or silently creates a generic Simple price for a Custom, unavailable or unconfigured calculator continuation. The canonical customer-price sequence lives in `@sp/costing`: frozen multiplier, published policy uplift, ex-GST cents, discount, ex-GST cents, GST, then inc-GST cents. Frozen `pricing_policy.customer_price_multiplier` and `customer_price_uplift_pct` keep calculator preview, quote mapping, dashboard summaries, marketing and autoresponder pricing aligned without changing internal true cost. Historical outputs without the multiplier default to `1.25`. The portal pricing module re-exports that package owner so existing consumers keep one compatible import path.

Primary route:

```text
apps/marketing/app/api/enquiry/route.ts
```

### Public Simple cover calculator

`/simple-cover-calculator` is a reusable marketing component and standalone noindex route. Its input adapter is intentionally narrower than the staff calculator: a customer-selectable fascia, facade or soffit-bracket connection; pitched acrylic roof; deck brackets; normal access; easy ground; standard black finish; no blinds or electrical work; and automatic posts with no spacing above four metres. It does not import portal UI, CSS, drawing code, or the Design Workbench.

`calculateAcrylicRafterLayoutV1` in `@sp/costing` owns the acrylic rafter count, clear centre spacing and normalized plan positions used by both costing derivation and customer-safe concept plans. Its first and last 50 mm rafter faces align to the overall cover width. Marketing may style those positions independently but must not duplicate the 642 mm spacing derivation.

The public pricing path is:

```text
bounded same-origin public request
  -> published-only marketing configuration resolver
  -> @sp/costing/server validation, hash check and application
  -> fixed Simple cover SiteInputsV1
  -> calculateSiteCostV1
  -> package-owned customer-price sequence
  -> existing residential marketing rounding
  -> explicit customer-safe response allow-list
```

The marketing resolver reads the singleton publication pointer and immutable published version through the server-only service-role client. It has no legacy or package-default fallback. Missing, draft, incompatible, unreadable or hash-mismatched configuration fails closed with no price. The endpoint returns only selected inputs, area, post/rafter plan positions, rounded customer price, public version number and an opaque authenticated calculation reference; true cost, BOM, labour, overhead, hashes and version IDs remain server-only and cannot be decoded from that reference in the browser.

`FrozenSimpleCoverPricingResult` keeps the validated inputs, canonical site inputs, full engine output, exact/display customer price and full published provenance together. The compact AES-256-GCM reference encrypts only those validated inputs, provenance, issue time and a canonical SHA-256 hash of the frozen result. Enquiry resolution decrypts the reference, loads the immutable published version by provenance, recalculates through the same named frozen-calculation owner and compares the complete result hash in constant time before using it. The browser never supplies trusted price or costing output. A verified result becomes the one canonical email/persistence snapshot; an invalid reference is ignored and cannot block contact intake. Deployment and the first publication remain separate rollout gates: until a compatible version is published, neither public path may emit a base price.

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

Each valid pergola output also exposes `infill_cost_breakdown_v2`. The engine performs one additional site calculation with all infills removed, preserving every other job input and the same costing configuration. That result is the stable base pergola. The difference between current and no-infill materials, install, overhead, shared cost, and total is the authoritative incremental infill pool:

- pooled material deltas are divided among the traceable pieces placed on purchased stock using blank area or cut length;
- labour deltas follow the package-owned setup, joiner, fixing, panel, support, and finishing drivers;
- incremental overhead is divided in proportion to direct material plus install cost;
- the no-infill baseline plus all infill increments reconcile to the current pergola components and total to the cent.

The `v1.8` labour calibration keeps the `$75/h ex-GST` single-installer crew basis. Infill actions now explicitly include measurement, stock handling, templating where needed, cutting, deburring, acrylic edge finishing, drilling, support preparation, complete sealing, protective-film removal, and cleanup. Active default minutes are: setup/set-out `30 min/instance`; cut/prepare/install joiners `6 min/m`; drilling/fixing `0.75 min/fixing`; cut/prepare/install sheet panels `25 min/m2`; strip panels `9 min/panel`; cut/prepare/install added supports `28 min/support`; final align/seal/clean `15 min/instance`. Access and height multipliers continue to apply.

Blocked or untraceable takeoff returns a blocked attribution and must not be presented as a separately priced customer breakdown. The Calculator allocates already-finalized pergola sell cents across physical modules in proportion to each package-produced module true cost, using the shared deterministic cent allocator so the module children reconcile exactly to the pergola parent. Ready infill contributions sit beneath their owning module and remain contained within its allocation. Neither module allocations nor infill contributions are additive quote items.

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

## Rafter Cut-Length Explanation Contract

`DerivedV1.rafter_cut_length_explanation` is the Calculator V1 trust contract for common-rafter cut length. It is emitted by the same `@sp/costing` derivation that owns `rafter_run_m_takeoff`, `rafter_cut_length_m`, and the separate gable-side fields. It contains the normalized entered span, engine-selected pitch, resolved rafter profile/count, plane-specific deductions, effective projected run, sloped length before allowance, angle-cut allowance, final cut, formula label, assumptions, source, and nearest-millimetre display rule. Numeric engine facts remain unrounded metres.

## Trusted Material And Labour Breakdown Contracts

The top-level `SiteOutputV1.materials.trusted_breakdown` and `SiteOutputV1.install.trusted_breakdown` contracts are compact, user-facing projections of the exact whole-job BOM lines and install actions already produced by `@sp/costing`. They do not recalculate quantities, time, cost, or multipliers. They add stable grouping, cleaned display labels, scope ownership, source references, assumptions, and progressive quantity explanations.

Material stock-cut explanations use the BOM allocator's published cut, stock-length, whole-bar, and waste facts. Sheet explanations use the BOM's area or strip-yield note and whole-sheet purchasing rule. Labour explanations use the resolved activity quantity, minutes, crew-hour conversion, scope, and non-neutral applied multipliers. Repeated BOM source IDs remain valid; each trusted row therefore also has a unique `instance_id` for presentation identity while preserving the original `id` for traceability. Internal cost fields remain subject to the Calculator's existing presentation permission boundary.

Pitched roofs expose one plane. Gable and low-gable roofs expose separate house and outer planes. Hip roofs expose the common-rafter result for both planes and explicitly exclude the separately derived diagonal hip rafters. Hip-corner modules fail closed because one Section cannot accurately explain both wings.

Calculator written workings and trusted Section annotations consume this contract directly. Portal drawing code may position and format those facts, but it must not recompute rafter cut length. Input-fallback drawings may show a clearly labelled schematic slope only; they must not claim an authoritative cut result.

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
