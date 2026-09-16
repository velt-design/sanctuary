# Costing And Geometry

## Accessory evidence review

`/admin/costing/accessory-review` is an admin-only, read-only review linked from the costing control centre. It pairs the shared `ACCESSORY_REVIEW_RATES` with supplier evidence and outstanding checks. Worked examples use canonical costing helpers and explicitly assume a 1.30 selling multiplier; they are not resolved published prices. Remaining amounts exclude GST and are not net profit. Ziptrak and rafter-light installed schedules are not reverse-engineered into supplier costs. The screen does not create approvals, persist edited rates, or publish configuration versions. Invoice evidence is transcribed without customer identifiers; unverified profiles remain provisional.

Costing and geometry are shared domain sources of truth. Do not copy their logic into app code.

## Installer payout transition

`calculateInstallerPayoutV1()` in `@sp/costing` proposes erection pay from the canonical site installation total and an explicitly supplied resolved costing configuration/version reference. It never falls back to repository rates. A reviewed benchmark must name the same scope and its evidence; missing or different scope returns `review_required` without a payout proposal. For matched scope, the proposal preserves the higher of model labour and benchmark, itemises the transition top-up, and calculates GST according to the installer's registration. The historical helper uses the December 2023 GST-inclusive base/area/roof schedule and returns an ex-GST benchmark; it does not establish scope eligibility. Timber, partial invoices, split crews, accessories and variations need explicit scope reconciliation before comparison.

The project's **Installer payout** page consumes this calculation through an admin-only preview. It requires exactly one accepted quote, uses its source estimate through the canonical calculator adapter, and requires published rates rather than legacy fallback. The admin enters the reviewed ex-GST benchmark, scope, exclusions, terms and installer acceptance reference. A fingerprint binds the preview to the inputs, terms and pricebook; confirmation recalculates before saving. The frozen agreement stores the canonical site and pricing provenance as admin-only evidence. Staff see the agreed payout sheet, variations and invoice reconciliation without the internal model comparison.

Agreements are append-only. Admins can record approved positive additions and installer invoice totals; sequence checks and command IDs prevent stale or duplicate writes. Invoice references are unique per project. Reconciliation compares cumulative invoices with the agreement plus variations; it never marks a payment made or sends a message. This first workflow supports one installer agreement per project; split contracts, credits, invoice corrections and replacement agreements require a separate admin review. It does not yet recover transition top-ups through customer prices. Keep that cost visible during margin review before pricing publication.

Apply `20260911000001_installer_payout_workflow.sql` through the normal migration release before using the page. Missing storage shows an explicit unavailable state; no browser-only agreements are created. Tests cover calculation, API authority, real PostgreSQL-compatible migration execution, staff redaction, retries and stale writes. The isolated Version 11 fixture is test evidence, not a production pricebook snapshot.

## Read First

- Use `## Costing Source Of Truth` before changing pricing or costing imports.
- Use `## Commercial Boundary And Migration Harness` and `## Costing Configuration Control` for commercial shadow flow and configuration boundaries.
- Use `## Geometry Source Of Truth` before changing geometry solvers or portal drawing adapters.
- Use the projection and shape sections for top-projection, roof/span, gable, downslope, and acrylic rules.
- Finish with `## Verification` for package and app checks.

## Costing Source Of Truth

`calculateConfiguredCustomerPriceV1` is the opt-in `configured-offer.v1` adjustment for the customer configurator's single-module aluminium offer, up to 30 m² ground / 20 m² elevated. It removes only the calculated bespoke design allocation, retains the original labour classification and operational overhead, and adds any shortfall against the GST-normalised historical erection benchmark. The existing multiplier is retained. It requires an explicit configuration; it does not mutate general costing, published rates, frozen quotes or installer agreements. The development review-price adapter consumes it with the local pricebook. Production publication still requires the published-rate pipeline and complete accessory costing; the development-only route remains gated. Price parity tests cover the approved base and upgrade examples.
### September timber pricing release

The pricing-only release advances the package to v2.7 and adds factory-coated Cedar and ThermoPine ceiling selections in 100 mm and 150 mm covers. The package owns selected-length bands, supported stock joins, waste, coating, fixings and fitting labour. Historical inputs without a ceiling selection retain the existing cedar identity; new selections require a published v2.7 configuration. Compatible earlier publications retain their original rates and semantics. Candidate `157b63465bc0` preserves production Version 11 values and adds the reviewed catalogue/accessory allowances; production publication is separate from deploying compatible code.

The staff single-module, job and material-explanation APIs preserve and validate the same ceiling selection through `requestCeiling.ts`. An unsupported selection is rejected rather than silently priced as legacy cedar. Integration coverage starts with saved calculator inputs and verifies the actual material lines returned by all three routes. Detailed batten/screen design controls remain configurator functionality; publishing accessory rates does not add those controls to the staff calculator.

Selected ceiling takeoff plans hip-corner wings independently using each wing's slope, support grid and timber area, then sums the stock length bands, coating and fixings. Mixed acrylic bays stay on their selected wing; ridge strips follow wing lengths; a location-free acrylic area override is allocated proportionally by roof area. The Phase 2 `PergolaModuleCostInputV2` contract is unchanged by this staff pricing release.

This release contains no enquiry-queue migration or producer activation and does not depend on Render setup. Gate 0: legacy workbench rows are N/A (no geometry/workbench changes); this retains the protected calculator V1 commercial path under the owner's explicit request to release staff pricing. No Phase 2 input migration or function consolidation is included. Existing costing, publication, materials-explain, calculator adapter, estimate, marketing price and quote consumers were checked. The new request parser owns the added HTTP validation outside the large routes; remaining route-parser decomposition is deferred to a focused follow-up.

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

The active package manifest is `v2.7`. It retains the `v2.5` powdercoat assumptions, `$1,000 ex GST` operational startup and the `v2.6` infill labour policy below, then adds the reviewed ceiling catalogue. Compatible earlier published controls retain their original commercial semantics after their original content hash is verified; the two material identities first introduced in `v2.5` are still hydrated where required. A fresh draft copies the active editable rates and advances to the current package manifest. Cloning an older version preserves that version's commercial semantics for rollback.

Manifest `v2.6` adds one `60`-minute productive labour allowance per job containing any infills and another `30` minutes per genuinely sloping or triangular opening. The once-per-job action is assigned to the first infill-bearing module so module and infill explanations reconcile, but it is deduplicated across pergolas, modules and standalone existing-pergola infills. Both allowances use the existing `$75/h ex GST` crew rate, feed the established overhead/customer-price sequence, and receive the existing Bespoke productive-time multiplier when applicable. Existing per-opening set-out, cutting, supports, fitting and finishing actions remain unchanged; there is no infill minimum price. Published `v2.5` and earlier controls do not receive either allowance.

Manifest `v2.0` corrects non-continuous extrusion procurement such as rafters. The BOM compares the whole purchase needed for each eligible stock length and chooses the lowest total ex-GST cost, then least waste, fewest bars and lowest cost per metre. Continuous ledger, beam, stringer and gutter runs keep the splice-minimising rule. Published `v1.9` retains the earlier cost-per-metre-first non-continuous selection so Version 2 remains reproducible.

Manifest `v2.1` derives Simple site days from productive installation actions only. Manifest `v2.4` extends that basis to Bespoke after multiplying productive actions by `1.2`. One-time mobilisation/demobilisation remains charged once and is not multiplied; setup, pack-down and tidy are charged once per resulting genuine site day. Published `v2.3` and earlier retain their original site-day behavior.

Manifest `v2.3` retains the existing actual sloped rafter cut-length and total-installed-metre takeoff. It keeps the live 2m and 3m loading points at `0.50` and `1.00`, then raises the 4m, 5m and 6m points to `3.75`, `6.50` and `7.80`. The engine linearly interpolates between points, so increasing projection produces a smooth labour increase rather than a threshold jump. Published `v2.2` and earlier controls preserve their frozen curve values, including any administrator-edited values.

Calculator-only `additional_aluminium` rows are explicit full-bar material purchases attached to one module. The staff-only catalogue endpoint derives selectable aluminium profiles and stock lengths from Mill rows in the active published pricebook; it does not expose costs to the browser. The costing package selects the matching bar in the module finish, applies the existing Mill powdercoat overlay and `1.2x` custom-colour multiplier, and includes the result in module and site materials. These rows never enter geometry, member sizing, or install actions. The assumed missing standard powdercoat surcharges are `$40.4853 ex GST` for 200x50 6m and `$34.80 ex GST` for Overhang Gutter 100x100 6m; both remain marked supplier-confirmation required in the additions catalogue.

## Marketing Estimate Use

Marketing enquiry estimates also use `@sp/costing`. Do not create a marketing-only pricing fork.

Version 2 adds a package-owned `Simple | Bespoke` classification. From manifest `v2.4`, Simple can include one residential acrylic/open pitched, acrylic gable, or acrylic box-perimeter pergola/module with fascia/facade/soffit connection, deck brackets, normal access, easy ground, standard black finish, no infills, and at most 30m² single-storey or 20m² two-storey. Structural-validity warnings remain independent and can still block an invalid box-perimeter fall. Any failed condition, manual Bespoke selection, engineering, or full building consent resolves to Bespoke. Both classifications use `$500 ex GST` per pro-rated productive crew-day and the same `1.3x` customer-price multiplier with no classification uplift. Manifest `v2.4` uses a `$500 ex GST` once-per-site startup; manifest `v2.5` raises it to `$1,000 ex GST`. Bespoke adds `$1,200 ex GST` design per site, `$800` per additional pergola, and `$300` for each module beyond the first module in its pergola; its productive installation actions take `20%` longer. Published configurations retain the commercial semantics of their effective manifest.

The staff calculator's `roof_material: none` mode is an open pergola frame, not a new roof form. `@sp/costing` normalizes it to the standard pitched structure at `0°`. Rafters, the front beam, and any attached ledger default to `150x50`, remain independently editable, and use the available `50mm`-wide profile sizes; the post profile remains unchanged. `rafter_spacing_mm` is a positive target maximum: it defaults to `500`, has no upper cap, and the engine evenly distributes rafters so the resolved spacing does not exceed it. Roofing, roof foam, gutters, downpipes, automatic or entered flashings, and their covering/drainage labour are zero. Open pergolas can use the active Simple eligibility, overhead and customer-price policy. Failed eligibility or approval requirements still resolve through Bespoke pricing. The public Simple cover calculator remains acrylic-only.

Calculator V1 also accepts an empty pergola array for a project add-on estimate. That produces a current zero-geometry site snapshot with no materials, install actions, or pergola overhead; manual travel/extras remain site costs and standalone customer-priced items such as blinds remain separate quote lines. The result resolves as Bespoke and preserves the active customer-price multiplier for any site allowances. This exception belongs to the protected calculator V1 commercial path only: base estimate UI still requires a pergola, a declared pergola must still contain a module, and Design Workbench/V2 geometry contracts are unchanged.

Engineering and full building consent are direct customer sell allowances with markup already included, excluding GST and not discountable. Engineering is `$5,000 ex GST`; full consent (including engineering) is `$10,000 ex GST`. Both add `$3,000` per pergola after the first and `$1,500` per module beyond the first module included with each pergola. They remain separate from internal true cost and are frozen as customer add-ons for calculator preview and quote handoff.

Website enquiry base pergola budgets use the canonical core customer price as a lower-only amount and encode that as equal low/high values; optional blinds remain a range based on the same corrected shared blind list-price baseline, with No cover assumed. An ordinary enquiry resolves the active immutable published configuration once, builds one canonical two-post "standard build" snapshot and reuses it for email, saved inputs, exact outputs and provenance. A Simple calculator-linked enquiry instead verifies the opaque server-issued calculation reference, resolves its exact historical immutable publication and re-creates the same frozen calculator snapshot; its selected connection, automatic post count, level, inputs, exact outputs, displayed amount and provenance replace the ordinary enquiry assumptions together. Missing/invalid publication or reference removes the linked base price without blocking the enquiry; it never falls back to package defaults or silently creates a generic Simple price for a Custom, unavailable or unconfigured calculator continuation. The canonical customer-price sequence lives in `@sp/costing`: frozen multiplier, published policy uplift, ex-GST cents, discount, ex-GST cents, GST, then inc-GST cents. Frozen `pricing_policy.customer_price_multiplier` and `customer_price_uplift_pct` keep calculator preview, quote mapping, dashboard summaries, marketing and autoresponder pricing aligned without changing internal true cost. Historical outputs without the multiplier default to `1.25`. The portal pricing module re-exports that package owner so existing consumers keep one compatible import path.

Primary route:

```text
apps/marketing/app/api/enquiry/route.ts
```

### Public Simple cover calculator

`/simple-cover-calculator` is a reusable marketing component and standalone noindex route. Its input adapter is intentionally narrower than the staff calculator: an initially selected facade connection with customer-selectable fascia, facade or soffit bracket alternatives; pitched acrylic roof; deck brackets; normal access; easy ground; standard black finish; no blinds or electrical work; and an automatic editable post suggestion with no spacing above four metres along the front beam. It shares that suggestion policy with the staff calculator and does not import portal UI, CSS, drawing code, or the Design Workbench.

`calculateAcrylicRafterLayoutV1` in `@sp/costing` owns the acrylic rafter count, clear centre spacing and normalized plan positions used by both costing derivation and customer-safe concept plans. Its first and last 50 mm rafter faces align to the overall cover width. Marketing may style those positions independently but must not duplicate the 642 mm spacing derivation.

The isolated `/configurator-preview` now consumes those same layout helpers via
`solvePreview.ts`, supplying count/spacing and the canonical post suggestion as
physical layout context to `solveCustomerConfigurationV1`. The geometry package
does not import costing. `structural.framing.widthReference: 'outside_faces'`
opts mono inputs into an overall outside-face width: first/last rafter and post
centres are inset by their own half-profile widths, while ledger ends stay at
0/width. The package-owned `memberLayout.ts` supplies equal centre positions to
the mono solver. Inputs without this optional field retain existing centreline
placement and rounding, so saved portal designs are not reinterpreted. Regression
tests assert calculator-count agreement, face alignment and Plan/3D parity;
these checks do not certify spans, roof detailing or site-specific engineering.

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

The marketing preview's `buildRepresentativeSurroundings()` is a package-owned
visual reference derived from an untransformed mono assembly. It implements the
owner-confirmed soffit/fascia/facade relationships recorded in
`customer-configurator-architecture.md`. It does not mutate solved members,
persist house intent, supply a fixing schedule, enter takeoff, or change pricing.
Its wall and patio reference geometry is shared by the preview's Plan and 3D.
Its soffit bracket quantity comes from the same `calculateSoffitBracketCountV1`
helper as costing derive: one more bracket than the ceiling of attachment length
divided by 1,500 mm. Geometry receives the count and owns positions; front-post
count is not a proxy for house support quantity.

The isolated marketing preview uses the shared member renderer with optional
presentation-only roughness, metalness and environment-intensity overrides.
Existing callers retain their defaults. Its active 3D dimension annotations read
solved Plan extents and roof boundaries; horizontal projection remains distinct
from pitched member length. These materials and annotations do not alter the
assembly, takeoff or Simple cover pricing inputs.

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

`buildPergolaInteractionAnchors()` derives the four semantic perimeter edges and rafter/perimeter lighting runs only from a post-transform `Assembly3D`; hosted state comes from `Assembly3D.attachmentEdge`. Anchor and lighting-run IDs are stable within one assembly only. Project/application consumers pair them with their own assembly identity rather than adding source-object identity to the geometry contract.

`@sp/configurator/geometry` owns the customer solve wrapper. Its normalizing
adapter is the single public-intent mapping path, `solveCustomerConfigurationV1()`
calls `solvePergolaGeometry()` once for each adapter success, and scene, top
projection, plan, section, validation and customer-semantic anchors all refer to
that one returned assembly. Customer anchor IDs pair the stable public pergola
ID with edge/run semantics; they never contain runtime project or estimate IDs.
Raw solve and validation text is not a customer message contract.

Mono acrylic remains a narrow Phase 2 boundary: when the known roof-detailing
invariant is the only validation failure, the configurator preserves the solved
artifact as `review_required` and emits a redacted acrylic-detailing assumption.
It must not fabricate commercial inputs or extend that allowlist to any other
validation failure. Presentation accessories/materials,
viewer UI, quantity takeoff/pricing, portal/marketing integration and rollout
remain downstream work.

Physical takeoff should also be derived from the solved geometry spine. Portal shadow adapters may read geometry quantities during migration, but long-term takeoff policy belongs with package-owned geometry contracts, not app-local drawing or pricing code.

Host house identity is an object-id contract. Workbench callers resolve host relationships through object references and the solved project artifact, not through per-module house-context copies.

Package adapters that need representative house context use the stable `@sp/geometry` `buildHouseFootprintPolygon()` export so preset footprints stay geometry-owned. Adapter-owned geometry identifiers remain assembly-scoped and must not be promoted into project or estimate identity.

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

### Local v2.9 ridge candidate (16 September 2026)

Release preparation now promotes the package manifest to v2.9 and explicitly
accepts v2.8 and earlier published controls. This does not publish a pricebook:
the resolver still uses each saved control's effective version. A publication
regression proves v2.8 retains its old ridge/foundation behavior while a v2.9
snapshot applies steel over 6m, four corner piles and intermediate brackets.
The candidate clones production Version13 without changing its rates; candidate
hash is `33f2f61e754eac149b6f434f5c9eecd1a2321fe9d283ceb82fd03705d47c1dcf`.
Gate 0: legacy rows N/A, owner-approved protected calculator release, no input
migration, Phase2 dependency or function/type consolidation. Configuration,
publication, staff calculator/meta/admin and marketing consumers were checked.

**Freestanding corner-only amendment:** owner subsequently requested piles only
at the four corners, with all intermediate posts on deck brackets. For effective
v2.9 rectangular freestanding modules (`house_connection_type=none`) selecting
`pile_1_5m`, `pilePostCounts` allocates four piles (capped at total post count)
and the remainder to deck brackets. BOM uses buried cut lengths only for those
four posts; concrete, excavation, consumables and pile labour use the pile count.
Deck hardware and installation use only the remaining count. Other post-based
actions still use the total count. Attached pile-supported modules retain all
piles; older pricing versions remain unchanged. This changes no input schema;
the existing selected pile connection plus freestanding geometry defines the
versioned mixed-foundation rule. Four/six/eight-post regression cases cover it.

**Approved pile costing implemented locally, 16 September:** owner confirmed
400mm holes, 1.5m depth and continuous posts stopping 100mm above the hole bottom,
then explicitly approved adding the draft to actual costing. Effective v2.9 now
adds 1.4m to each pile post's material cut length, without changing its visible
height. Actual stock optimisation replaces the draft $80/post approximation.
Per post material allowances are concrete $175, auger/spoil $50 and bracing,
protection/consumables $25 ex GST. The existing pile action is replaced with 120
base minutes ($150 at the published $75/hour), retaining normal access, ground,
height and job complexity multipliers. These allowances are not added on top of
the old pile labour or deck brackets. The draft $480 is a rounded direct-cost
guide, not a fixed final price or additional surcharge. Earlier costing scenarios
below are retained as rationale and superseded by this approval.

Engine owner: `engine/pileFooting.ts`, consumed by BOM and install. Existing
v2.8 and frozen historical inputs keep their old semantics. Local candidate route
uses v2.9; production pricebook publication remains a separate release step.
Gate 0: owner-authorized protected calculator extension, legacy rows N/A, no
workbench or Phase 2 input migration. No shared input fields were changed.

The customer configurator's freestanding adapter now selects the existing
`pile_1_5m` post connection instead of deck brackets, as requested by the owner
on 16 September. It applies to all geometry-counted posts for every roof family
and is retained in frozen enquiry inputs. It uses the existing pile installation
allowance; it does not change above-ground post heights or introduce new pile
material rates. Attached designs retain their existing connection selection.

**Launch blocker discovered in owner review:** the existing pile option is not
a complete foundation allowance. Read-only comparison against published Version
13 rates for the owner's 6.9 x 4.3m freestanding gable with infills reproduces
$29,968. Replacing only its six deck brackets removes $570 material cost and adds
$270 installation plus $225 operational overhead (all ex GST), reducing the
customer total by about $112. No concrete material or additional buried post
length is added. Do not treat this as verified full pile pricing. Resolve pile
construction, material quantities/rates and labour before releasing freestanding
pile estimates. Evidence: temporary sanctuary-pile-comparison.json. The earlier
tests proved selection and receipt persistence, not completeness of foundations.

Draft foundation costing for owner discussion, not implemented (16 September):
use alternative 300mm and 450mm diameter holes at 1.5m depth as costing scenarios,
not structural specifications. Gross concrete volumes are 0.106/0.239m3 per hole;
with 10% waste and 0.01m3 per 20kg bag, allow 12/27 bags. Retail reference $9.55
including GST per bag gives approximately $100/$225 ex GST per hole. Sources:
https://www.cemix.co.nz/products/multicrete and
https://www.bunnings.co.nz/products/building-hardware/cement-concreting/concrete.
Bagged mix is a costing benchmark, not the confirmed site supply method.

Provisional direct-cost components per post, ex GST: concrete $100/$225;
additional post stock $80; installation $150; shared auger/spoil allowance $50;
bracing/protection/consumables $25. Total $405/$530. All except concrete reference
and repository stock prices are proposed allowances requiring owner validation.
The $80 stock allowance assumes continuous buried posts: six 2.4m above-ground
posts plus 1.5m burial require six 6m bars instead of three, at repository black
100x100 stock cost $154.20/bar; incremental cost is $77.10/post before rounding.
Separate piles/connectors need a different takeoff. Confirm construction and
diameter before choosing either case, including required protection/reinforcement.
Installation $150 means two hours at current $75/hour costing rate, replacing the
existing pile action rather than adding to it. Allocate machine/spoil once per
job; $50/post is only the six-post example's $300 allocation. These direct costs
replace bracket foundation costs and require the normal overhead/markup/GST path;
they are neither customer selling prices nor surcharges on the existing pile rate.
No pricebook, live prices or calculator rules changed by this draft proposal.

Owner-requested automatic gable ridge selection uses RHS 150x50x3 steel when
the full ridge length exceeds 6m; exactly 6m retains the previous default.
Explicit staff profile overrides remain authoritative. Standard and box gables
use the same rule. The customer adapter already maps ridge direction into module
length; eave-to-eave width is not the trigger. Existing steel stock, crane hire
and installation allowances apply. Standard gables include the steel ridge in
material takeoff; box gables retain their existing single ridge takeoff.

This is gated on effective manifest v2.9 and available through the development-only
`CONFIGURATOR_LOCAL_PRICING_CANDIDATE=v2.9` review route. The active repository
manifest and published Version 13 remain v2.8. Publication of a v2.9 pricebook is
still required for live use; frozen estimates and old-version calculations retain
their rules. Local review cannot issue published calculation references.

Gate 0: legacy audit rows N/A; this is an explicitly owner-requested extension of
the protected calculator pricing path, not a workbench or cost-input migration.
No Phase 2 dependencies or type consolidation. Consumers checked: derive, BOM,
steel installation allowances, staff profile overrides and customer price adapter.
Derive/BOM hotspot extraction is deferred to avoid moving broad geometry/takeoff
logic during this pricing correction; the new automatic selector has its own
small owner in `engine/ridgeProfile.ts`.

Verification: 400 costing/pricing route tests passed, plus two customer ridge-
direction cases (nine focused ridge cases including the seven engine checks).
Costing and marketing TypeScript checks, repository lint and architecture checks
passed. Local port 3074 serves the v2.9 review candidate: a 7 x 3m acrylic gable
with the ridge parallel to the house returns $19,886 using the existing published
rates. No production settings or customer records changed.

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

## Existing-Pergola Infill Add-ons

Calculator add-on estimates may cost infills against an existing pergola without supplying pergola geometry. `SiteInputsV1.standalone_infills` owns these job-level inputs, including their independent aluminium finish and site access/height. The engine reuses the canonical infill takeoff, BOM and labour-action families, emits `SiteOutputV1.standalone_infills`, and must not expose a synthetic pergola/module in `pergolas[]`. Roof-rafter matching is unavailable for this contract; staff enter target opening widths and supports explicitly. Customer pricing uses the frozen site multiplier/uplift and quote discount rules, while the output remains a distinct infill line.

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


## Factory-coated ceiling choices (v2.7, pending publication)

The calculator accepts optional `ceiling.option`: `cedar-100`, `cedar-150`, `thermopine-100`, or `thermopine-150`. Absence preserves the historical 110 mm cedar takeoff and labour. The four material rates, coating and fixings allowances are rows in the existing shared material catalogue/control editor. JSC supplier rates are owner-approved as ex GST with 100/150 mm effective cover and 11–12 mm finished thickness. Geometry represents 12 mm. Factory coating is a provisional $20 per purchased square metre; fixings are a provisional $3 per lined square metre.

`engine/ceilingTakeoff.ts` owns selected stock rounding, support-position joins, minimum 10% timber waste and line-item coating. Selected 1.8–2.4 m lengths receive 10%; 2.7–4.8 m receive 30%. Long runs split on the standard calculator purlin grid and buy lengths rounded upward to 300 mm. Offcuts are included, without assuming cross-run reuse; the larger of purchased stock and the 10% minimum waste quantity is charged. Narrow fitting retains the current timber installation action; wide fitting scales that action by 12/14.4. Both add a provisional two crew-minutes per lined square metre for cut-end sealing/touch-ups. No full on-site coating labour is added. Normal job labour, overhead and selling policies remain authoritative.

Pitched/gable lining uses timber slope area and board runs; box lining uses horizontal projected timber area and runs. Mixed roof acrylic area is excluded. This remains the calculator's representative area-based roof partition, not a fabrication cutting schedule for arbitrary custom openings.

Manifest v2.7 introduces the catalogue rows. Historical published control snapshots are hash-checked unchanged, receive only the explicitly allowed catalogue additions, and retain their original `appliedControlManifestVersion`. New selections fail closed under pre-v2.7 published controls. An administrator must review/save/publish a v2.7 configuration before live estimates can use these choices. Historical unselected calculations are regression-tested unchanged. No production publication has been performed.

The marketing preview stores the ceiling choice with its roof finish, changes board cover/species appearance and retains it in saved links/enquiry summaries. It still withholds whole-design public pricing for non-Simple designs; the broader public pricing adapter and accessory breakdown are separate outstanding work.

### Local configurator price review

Development-only `/api/configurator-review-price` maps the preview design to the
existing shared calculator using repository v2.7 rates. Production returns 404:
it does not activate provisional prices, produce frozen calculation references,
or change enquiry pricing. The UI labels estimates as draft owner review.
The exact footprint must be at most 30 m2 ground level or 20 m2 elevated;
larger designs remain editable with no price. Pending requests hide stale totals.
Mixed-roof acrylic area comes from the displayed roof regions; away gables swap
calculator length/span, and box internal pitch/mode follow the displayed roof.
These remain standard calculator allowances, not a fabrication takeoff.
Selected accessories now contribute itemised owner-review lines. Portal Ziptrak
and rafter-light selling prices include installation and are reused without a
second markup or installation allowance (owner-confirmed). Blind fabric
group mappings remain provisional; specialty Soltis ranges
are explicitly unpriced. Blind drop is the full opening height, independent of
the displayed lowered position. Lighting quantities follow actual placement,
including mirrored gables and strips replacing spots on selected members.

`@sp/costing/accessoryReview` (exported through `@sp/costing`) owns unpublished
assembly allowances, using the same selling multiplier/uplift as the base design.
Supply costs below are ex GST; they are estimates, not confirmed supplier rates:

| Assembly | Provisional cost basis before selling multiplier |
| --- | --- |
| Timber 39x39 / 65x39 / 90x39 | $12 / $18 / $24 per lm; selected-length factor 1.30, waste 1.10; coating $2/lm and fitting $12/lm |
| Aluminium 50x10 / 65x16 | $12 / $18 per lm; waste 1.10 and fitting $8/lm |
| Frames / vertical-timber support plates | $45 / $25 per lm supplied, finished and fitted; $120 slat-panel setup |
| 100x50 acrylic frame upgrade | Additional $20/lm over standard framing |
| Blind installation | Included in portal Ziptrak price; additional structural header/strut allowance $45/lm where needed |
| 110 mm ceiling downlight | $140 each supply and fit |
| LED strip | $65/lm including channel and fitting, plus $100 driver allowance per selected member |
| Electrical connection | $550 once for ceiling/strip lighting; omitted when portal rafter-light startup is already charged |

Slat quantities use gross cut lengths before slope trimming, then the stated
waste allowance. Roof battens use representative visible coverage. These are
review quantities, not fabrication takeoffs. Acrylic uses the canonical portal
infill takeoff and incremental installation/operations without another design
fee or consuming the base installer top-up. Perimeter framing is a separate
allowance; internal supports come from the takeoff. Failed infill takeoffs remain
explicitly unpriced. Automatic pelmet-clearance post upgrades are also flagged
until their incremental cost is mapped. No assumed zero-price completion.

The expandable breakdown shows provisional status and assumptions. Whole-dollar
line amounts sum exactly to the displayed GST-inclusive total. Travel, special
site work, new electrical circuits and difficult cable routes remain excluded.
Trapezoidal uses the corrugated allowance pending its own rate. Live release still
requires supplier/installation validation, controlled rate publication and frozen
enquiry integration. These review allowances do not modify the published pricebook.

Marketing combination-roof rafter lights use only internal acrylic-band rafters;
rafters bordering the timber lining are excluded from spots. Alternate rows are
counted within the eligible band and mirrored across gable slopes. Timber battens
allow lights to shift from centre/quarter points into the nearest clear gap
(owner confirmed clear gaps only). Clearance is measured in the roof plane for
the full 40 mm fitting with 0.1 mm per-side separation; the UI recommends at least
41 mm gaps. Gable placement stays mirrored and two lights remain on opposite
halves of the member. Lighting controls show availability counts and disable levels with no
valid positions, explaining the obstruction instead of silently selecting zero.
If battens leave no positions for the selected rafter-light level, draft
normalisation clears the selection to Off and zero quantity. Widening the gap
does not silently restore lights or their price; the owner selects a level again.
This representative-geometry correction is outside the live workbench path
(legacy audit rows N/A).

Gate 0: legacy audit rows N/A (marketing preview adapter); this builds on the
existing calculator under the owner's explicit pricing request, not the design
workbench runtime. No Phase 2 migration or function/type consolidation.


## Batten owner-review revision (2026-09-11)

### Versioned accessory draft rates (2026-09-14)

Installed selling schedules are also optional versioned data (`installedSellingRates`). Staff can explicitly capture the existing Ziptrak/Omni size-band matrices, fabric/core multipliers, motor/cover amounts and rafter-light startup/per-light/dimmer/driver amounts and capacities. The editor displays GST-inclusive dollars for cents-backed fields and clearly labels the blind base tables as ex GST before their existing fabric/core multiplier. Zero charge for uncovered blinds is enforced. These are installed selling schedules, so the adapter never adds a separate installation or pergola multiplier.

The shared blind and lighting functions accept an optional schedule with unchanged legacy defaults. The published configuration resolver retains the saved schedules; the marketing accessory adapter consumes them when supplied. Legacy staff calculator/quote callers still use their existing defaults, explicitly noted in the editor; wiring their historical estimate/quote contexts is a separate rollout requirement. No live pricebook was saved or published. Focused checks cover unchanged legacy outputs, altered saved schedules, strict validation, published resolution and staff dollar-to-cent editing.

The existing pricebook control configuration now accepts an optional, fully validated `accessoryRates` catalogue. Staff explicitly add the unpublished review allowances to a draft in the Accessories section, then edit, validate and compare numeric rates through the existing version workflow. Historical configurations without this field retain their original shape; snapshot/apply does not silently seed rates. Incomplete or unknown catalogue fields fail validation.

`accessoryRates.ts` owns the rate schema, provisional defaults and validation; `AccessoryRatesEditor.tsx` owns the new editor. The existing assembly/slat calculations accept an optional catalogue argument, preserving their former default for review callers. The marketing accessory adapter uses the supplied configuration catalogue when present. Its development endpoint still loads repository configuration, so saving a portal draft alone does not switch the customer's preview to that draft. Public expanded-price activation remains unimplemented and requires approval; review constants are not approved selling prices. Base-pergola impact examples do not evaluate accessory changes, and the review now states this explicitly.

Verification: 48 focused tests cover draft editing, historical configuration preservation, validation, rate application and the marketing adapter's changed downlight price with unchanged unrelated allowances. Marketing and portal type checks passed. Gate 0: legacy audit rows N/A, no workbench legacy build-on/removal, no Phase 2 input migration. No function consolidation; existing calculation signatures gain an optional rate parameter with their previous default preserved. Large control-centre changes are wiring only; catalogue UI and validation have separate owners.

The unpublished `accessoryReview.ts` estimate now separates timber supply from assembly time. Cedar raw allowances remain $12/$18/$24 per lm for 39x39/65x39/90x39; ThermoPine uses explicitly provisional $9/$13.50/$18 per lm. The 75% budget ratio is informed by the JSC thin ceiling-board species price relationship, not a quote for these batten profiles. Availability, finished sizes, coating and all three ThermoPine prices require supplier confirmation before publication. The July Mitre 10 J111 invoice is $36.08/lm ex GST already clear coated; the existing cedar allowances are not supplier-verified and that finished rate must not receive another coating/selected-length uplift if adopted.

Timber fitting is budgeted at $65 per person-hour, two minutes per cut piece, 1.5 minutes per fixing point, one setup hour per roof/panel and $0.35 consumables per fixing point. These are review assumptions, not agreed installer pay. The marketing quantity adapter uses gross side lengths and support counts; roof fixing points are estimated at a nominal 620mm module. Pieces allow joins at up to 4.8m; this is not a cutting plan or a stock optimisation. Selected-length factor 1.30, waste 10%, coating $2/lm, frame allowances and the existing selling policy remain. Aluminium fitting remains unchanged. The protected base erection payout is untouched.

For the owner's 7.5 x 4m pitched acrylic example, the old 375lm cedar39 allowance was $17,648 incl GST. With the revised fitting basis it is $13,230; the same layout in provisional ThermoPine is $10,824. The new 90x39 flat/90mm-gap ThermoPine default is 165lm and $7,992. The latter changes profile and spacing, not just species. Evidence: `artifacts/pricing-review-2026-09-11/economy-comparison.json` and focused regression tests. These prices remain development-only owner-review estimates; no publication, historical quote or staff agreement was changed.

## Combination preview bay costing correction (2026-09-11)

The development marketing adapter now maps actual generated acrylic panel counts per roof plane to the existing `mixed_roof.mode=acrylic_bays` input (`main` for one plane, `A/B` for two), rather than an area override. This activates canonical acrylic panel, joiner top/bottom and fixing labour and buys joiner materials on both gable slopes. The canonical 620mm bay basis remains an approximation to visible clear dimensions. Unsupported/missing plane counts fail closed. No engine rates or historical area-override semantics change. Gate0: legacy audit N/A, no workbench legacy build-on/removal, no Phase2 changes, no consolidation. Consumers: marketing adapter, configured offer helper/tests, accessory incremental calculator and review response. The offer exposes calculation warnings to its caller; the review reports a generic staff-review requirement rather than silently hiding them or exposing internal warning details.

Recalculated18m2 packages: entry$11,595 and everyday$16,057 unchanged; combination$27,676 (previously$26,383); premium$37,315 (previously$36,025), all inclGST. Includes both material and labour changes, not a new markup. Evidence: configuratorMixedRoofCost.test.ts and artifacts/pricing-review-2026-09-11/package-review.json. Supplier-check evidence is in accessory-supplier-check.json and blind-invoice-parity.json. July Shade Elements invoices show45% discount on complete systems; extruded covers and provisional fabric-group mappings prevent treating the comparison as exact margin. No supplier, publication, staff agreement or frozen quote was changed.

## Local owner pricing candidate v2.8 (2026-09-15)

Owner authorised a local candidate shared by calculator and configurator. No
publication, migration, production activation or email is authorised by this pass.
Gate 0: legacy audit rows N/A; approved maintenance of the protected V1 costing
path, no workbench build-on, V2 module migration or Phase 2 dependency. Consumers
checked: calculateCostV1/calculateSiteCostV1, configuredCustomerPrice, accessoryReview,
portal staff costing and marketing configurator pricing; no type consolidation.

Effective manifest v2.8 permits module infills on an otherwise eligible Simple
job. It preserves explicit Bespoke selection, site/access/connection restrictions,
infill materials/actions and operating overhead. Historical published controls
retain their effective manifest and original behaviour.

Solid-roof common rafters use 50x50 up to a 4m per-plane span and 80x50 above.
Framing maximum spacing is 600mm; 50x50 purlins and 150x50 edge rafters remain.
Gables use each half-span; box internal pitched/gable geometry selects the run.
The calculator uses its existing single-run span model, not an engineering solve
of additional intermediate beams. Explicit staff rafter overrides remain valid.
Mixed roofs retain their acrylic-bearing rafter profiles and use the new spacing
for the timber-region support grid. Ceiling stock joins follow that same grid,
including unequal hip-corner wings. These are owner costing assumptions, not
structural certification or new permitted-span evidence.

For standard 50x50 rafters with no explicit fitting-time entry, v2.8 uses the
existing 80x50 fitting allowance instead of custom fabrication time. This makes
no assumption of faster installation; explicit configured 50x50 rates win.

Local preview on port 3074 opts into CONFIGURATOR_LOCAL_PRICING_CANDIDATE=v2.8.
Its development-only review endpoint overlays the candidate effective manifest
on the approved staging rates; it issues no published calculation reference.
Production ignores the flag and retains the normal published endpoint. Port 3073
remains the approved-rules comparison. Existing stored quotes are not rewritten.

Hotspot maintenance: derive.ts and install.ts remain package-owned. Broader
extraction is deferred to avoid disturbing historical calculations in this rule
change; next safe extraction is versioned timber framing selection from derive.ts
and profile-minute resolution from install.ts, with boundary and history tests.

Local comparison (same approved rates; amounts include GST): 5x3 acrylic baseline
$10,234 unchanged; with one standard full-height acrylic side $15,456 -> $14,369;
with upgraded side framing $15,939 -> $14,852. Timber and aluminium screen examples
are unchanged. ThermoPine solid pitched 5x3 $17,689 -> $16,898; 5x5 $26,443 ->
$25,870. Solid box 5x3 $23,297 -> $22,750; 5x5 $27,611 -> $26,950. Candidate
responses contain no excluded/unpriced selections for these cases. Approved
staging content hash was checked against the recorded release hash before reads.

## Pricing production release v2.8 (16 September 2026)

The owner approved making the tested staging pricebook live for both the staff
calculator and customer configurator. The isolated pricing release is based on
current main, preserving the released finance and timber fixes. Website/enquiry
activation remains separate. Production Version 12 was rechecked read-only at
hash `157b63465bc0e812de46fe4dbaa66f732c819e0a974ee37aab253944b52e00d2`.
The approved staging candidate is
`4d12a6bde67c28aeacbb8a0d9845529e3ebb7405555d0fab9b8e412de8d33661`.

This release carries the versioned v2.8 engine rules: acrylic infills alone do not
reclassify a Simple job; solid-roof common rafters are 50x50 through 4m per-plane
span and 80x50 above, with 600mm maximum centres and 50x50 purlins. Explicit staff
overrides remain valid. Historical published controls keep their old semantics.
No stored estimate or quote is rewritten. The customer configurator will bind to
the same production version when its separately gated application is released.

Gate 0: legacy rows N/A; owner-authorised maintenance of protected calculator V1;
no workbench input migration, Phase 2 dependency or function consolidation.
Consumers include staff single/job/material explanation, public calculation,
configuration publication and saved-estimate resolution. Package-owned derive
and install hotspot extraction is deferred to avoid changing historical
calculations; next safe extraction is versioned framing/profile-minute selection.

Release sequence: compatible main app deployments, authenticated admin draft
comparison and exact-hash publication, then live read-only pricing verification.
Rollback uses a new immutable publication cloned from Version 12. Do not promote
the staging deployment or its credentials into production.

Release review correction: the staff eligibility check has no configuration
argument, so it must use the active UI policy rather than silently assume an old
manifest. It now permits the acrylic infill request to remain Simple. Server
calculations still receive the exact published configuration and enforce its
historical policy. A real eligibility-to-React-hook regression covers this path.
