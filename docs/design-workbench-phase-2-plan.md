# Design Workbench Phase 2 Plan

**Scope**: this document is the working plan for Phase 2 of the [Product North Star](design-workbench-architecture.md). Phase 1 (cull + restructure) is complete; this plan covers everything from "post-cull" to "end state for the full designer workbench."

## Read First

- Treat `## Status -- what we have, what's left` as the current summary.
- Use shipped markers in `## Work streams` before assuming a listed stream still needs implementation.
- Use `docs/design-workbench-multi-object-goal.md` for the current multi-object handoff.

**Locked decisions (2026-05-22, user-confirmed)**:

- **Costing direction**: cost engine receives **pergola data only** (plus future pergola accessories — blinds, lights). House forms, decks, openings exist in the scene for design/visualization but are NOT costed. Pergola module grouping (which pergolas are pieces of one logical pergola vs. separate pergolas) is **derived from spatial adjacency** in the scene — pergolas snapped to each other are modules of one pergola; pergolas not snapped are separate.
- **Marketing email path stays independent.** Phase 2 does not migrate the marketing form path. It keeps calling `calculateCostV1` with its own simple `CostInputsV1` shape. Workbench migrates separately.
- **Single shell**: the full designer workbench is the only shell being built right now. Other shells (marketing self-design, sales tool, tradie tool, Rhino export) are downstream consumers built once the canonical model is polished. Phase 2 does NOT pre-build for them.

---

## Architecture decisions (Q1–Q3 with rationale)

### Q1: Canonical project shape

**Decision: `WorkbenchProjectModel` (object-first) is canonical. All other shapes deprecated.**

`WorkbenchProjectModel` already exists at `apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts`. Its shape:

```
WorkbenchProjectModel {
  houseAssembly: { houseForms: HouseFormModel[], derivedEnvelope }
  decks: DeckObjectModel[]
  openings: OpeningObjectModel[]
  pergolas: PergolaObjectModel[]
}
```

Each object owns its world `position` + local outline + (optional) snap-derived `attachment` reference. This satisfies the five north-star invariants (origin independence, local-frame outlines, derived connections, snap-as-formation, openings-as-exception). Nothing else needs to exist.

**Solved-geometry caching**: not now. Solve is a pure function of inputs. If perf becomes an issue later, memoize per object on input hash. Premature now — workbench is solving a single project's worth of objects, not enough to matter.

**What goes away**: `HouseFirstWorkbenchProjectModel`, all `HouseFirst*` draft types, the bridge in `legacyObjectFirstCompatibilityAdapter.ts`, the `hostHouseFormId` field, the `compat/objectWorkbenchCompatibilityModel.ts` re-export namespace.

### Q2: Cost engine input migration

**Decision: replace `CostInputsV1` per-module shape with a lean scene-derived shape. Marketing form keeps `CostInputsV1`; workbench switches to the new shape.**

Today `CostInputsV1` carries `houseContext`, `decks`, `openings` fields that the cost engine **doesn't read** (verified in PR-G3a/b scope reports). Those fields are dead weight in the contract — they exist because the workbench's per-module bridge happens to carry them along. Per Q4, cost engine only needs pergola fields.

New cost input shape (`SiteInputsV2`, name TBD):

```
SiteInputsV2 {
  job_type, access, height, travel_ex_gst, ...               // site-level
  pergolas: [{                                                // logical pergola
    id, label,
    modules: [{                                                // module = physical piece
      // pergola-only fields the engine actually reads:
      pergola_style, length_m, projection_m, post_count,
      post_cut_height_m, post_connection_type,
      roof_pitch_deg, roof_material, extrusion_colour,
      house_connection_type,        // derived from snap reference
      attachment_length_mm,         // derived from snapped edge length (PR-F)
      // ... pergola-only fields (full list extracted from current CostInputsV1)
    }],
    accessories: []                                            // future: blinds, lights
  }]
}
```

**Workbench's builder** (`buildSiteInputsV2FromScene`) reads `WorkbenchProjectModel` + solved geometry, derives module grouping from spatial adjacency (see "Adjacency-derived grouping" below), produces `SiteInputsV2`. The cost engine consumes it.

**Marketing form** keeps its own `buildSiteInputsV1FromCalculatorInputs` (calculator-shaped → `SiteInputsV1` → cost engine). Cost engine accepts both shapes during transition. Per Q5, this stays. Eventually the marketing form could migrate to `SiteInputsV2` too, but that's out of scope.

**Cost engine internal**: accept both shapes. A thin adapter at the engine's entry point converts `SiteInputsV1` → `SiteInputsV2` (or vice versa — TBD by PR scoping). The pricing logic stays unchanged.

**Adjacency-derived module grouping** (this is the new mechanic):

Each `PergolaObjectModel` has a snap-derived `attachment: PergolaAttachment | null`. When `attachment.host.objectFamily === 'pergolas'`, this pergola is snapped to another pergola. Build an adjacency graph from these refs; connected components = logical pergolas; each pergola object in a component is a module of that logical pergola. Pure derivation from the scene, no stored "pergolaId" field needed.

### Q3: Snapshot persistence migration

**Decision: big-bang migration via a one-shot script. New writes go to canonical shape only. Reads expect canonical only.**

Rationale:
- The user is the only daily workbench user. Project population is small enough that big-bang is safe.
- Lazy migration (read-old, write-new) adds dual-shape code paths the cull was trying to remove. Defeats the point.
- Dual-write (write both shapes during transition) is the same problem doubled.
- The current legacy snapshot adapter (`legacyEstimateSnapshotAdapter.ts`) becomes a one-shot migration utility, not a runtime path.

**Migration ordering**:
1. Define canonical persisted shape (a serialisable subset of `WorkbenchProjectModel`).
2. Write the one-shot migration: load all snapshots, convert via the existing legacy adapter logic, save in canonical shape. Run once, verify, delete the migration code.
3. Workbench read path expects canonical shape. Throws (or shows error UI) on a legacy snapshot — no fallback.
4. Workbench write path emits canonical shape only.

**Backups**: snapshot the snapshot directory before migration. If it goes wrong, restore + investigate.

---

## Work streams

Phase 2 is four streams. They can run partly in parallel after the first stream lays the canonical foundation.

### Stream 2A: Object-first canonical shape lock-in (prerequisite for everything else)

**Goal**: `WorkbenchProjectModel` is the only project-state type used at runtime. Bridge deleted.

| PR | Closes | Scope |
|---|---|---|
| **2A.1a** Export load-bearing building blocks ✅ SHIPPED 2026-05-22 | — | `buildSharedHouse` + `buildPergolas` exported from `houseFirstWorkbenchAdapter`. Pure surfacing change, no behavior diff. |
| **2A.1b** Migrate downstream consumers off `HouseFirst*` drafts ✅ SHIPPED 2026-05-22 | N5 partial, N6 partial | `buildSharedDecks`, `buildSharedOpenings`, `buildHouseFormFromDraft`, `buildSharedHouse`, `buildPergolas` all consume `ObjectFirst*` draft types directly. The cross-file bridge synthesis (`buildObjectWorkbenchCompatibilityDraftFromObjectFirstDraft` + its alias) deleted from `legacyObjectFirstCompatibilityAdapter.ts` (~80 line shrink). `houseFirstWorkbenchAdapter.ts` no longer imports it. Internal `deriveHouseFirstDraftViewFromObjectFirst` helper deleted. The legacy `draft.houseFirst` carrier remains as a typed extension supporting test-suite assertions (production never sets it); fields are converted to ObjectFirst shape via small inline `readDeckDrafts` / `readOpeningDrafts` / `readPergolaDrafts` / `readAuthoredRoofDraft` helpers. `HouseFirstDeckDraft`/`HouseFirstOpeningDraft`/`HouseFirstPergolaDraft` types still live for the test path. **Verification:** typecheck clean · geometry 352/352 · portal lib/drawings 468 + 6 PR-B-era skips · email path 6/6. Two pre-existing `ModelSpaceViewport.tsx` fixture-rot guard failures (2026-05-21 decision log, unrelated). |
| ~~**2A.2** Snapshot migration~~ **SUPERSEDED BY STREAM 2B (2026-05-22)** | — | **Investigation revealed the original framing was based on a misread of the persistence model.** Server snapshots only ever stored calc-era `{inputs, outputs, warnings}` and are immutable after initial creation. The user's authored `draft.objectFirst` lives in IndexedDB (local-first), never persisted to the server — already in canonical object-first shape. The "legacy adapter" isn't a migration bridge but an initial-state synthesizer for first-load of an estimate. There's no shape to migrate FROM. The real architectural debt is calc-era snapshots being load-bearing for the cost engine — which is Stream 2B's job. After 2B ships, the snapshot becomes purely a cost-output artifact (or deletes entirely) and the legacy adapter has nothing to do. |
| **2A.3** Delete `state/compat/` namespace ✅ SHIPPED 2026-05-23 (rescoped) | N6 partial | **Scope tightened after audit (2026-05-23)**: the cull plan's "delete legacy types + bridge" was over-scoped relative to actual code state. Most targets are still load-bearing: `legacyEstimateSnapshotAdapter.ts` is the production snapshot → projectModel bridge; `hostHouseFormId` still routes decks/openings; `houseFootprintSideLocalToWorldPolygon` still feeds preset footprint synthesis; the `HouseFirst{Deck,Opening,Pergola}Draft` types remain consumed by the test-driven `draft.houseFirst` carrier path (40+ test cases). Truly deletable: the `state/compat/objectWorkbenchCompatibilityModel.ts` type re-export namespace. Done: aliases (`ObjectWorkbenchCompatibility*`) moved inline into `legacyObjectFirstCompatibilityAdapter.ts` (their only runtime consumer), 5 consumer imports migrated, file + directory deleted. **Verification:** typecheck clean · 712 tests + 6 PR-B-era skips · email path 6/6. The remaining "delete legacy types" cleanup is deferred until either (a) the 40+ test cases migrate to `draft.objectFirst.*` shapes, or (b) Stream 2B.1 (per-object solve) makes the test surface naturally retire. |

**Risk**: high. 2A.1 in particular has many consumers (10+ files import `HouseFirst*` types). Recommend doing 2A.1 itself in two sub-PRs: scope-first (audit every consumer + plan the cut), then execute.

**Acceptance**: `grep -r "HouseFirst\|houseFirst\|hostHouseFormId" apps/portal packages` returns empty outside historical docs.

### Stream 2B: Per-object solve + scene-derived cost input

**Goal**: solve happens per object, cost engine receives lean scene-derived input.

| PR | Closes | Scope |
|---|---|---|
| **2B.1a** Per-object solved shape (foundation) ✅ SHIPPED 2026-05-23 | — | New `SolvedPergola` + `WorkbenchSolvedProject` types in `workbenchSolvedModel.ts`. Per-object shape mirrors `WorkbenchSolvedModule` (22 of 25 fields lifted unchanged; drops `index` + `drawingModule` — both legacy-loop artifacts). New `buildWorkbenchSolvedProject({ solvedModel, activePergolaId? })` derivation transposes the legacy per-module array into per-pergola entries keyed by `PergolaObjectModel.id`. Active selection lifts from `activeModuleIndex` (array position) to `activePergolaId` (string id). Coexists with legacy `WorkbenchSolvedModel.modules[]` — consumers untouched. 9 equivalence tests pin down per-pergola field equality with the matching per-module fields, plus active-selection lift, ordering, orphan-pergola skip, and empty-project behaviour. Foundation for PR-2B.1b's consumer migration. |
| **2B.1b** Per-object solve loop (consumer switch) | Audit row 9 fully | Migrate consumers (`drawingWorkbenchStore.ts`, `commercialDesignPayload.ts`, viewport selectors, rail) from `solvedModel.modules`/`activeModule` to `solvedProject.pergolas`/`activePergola`. Lift `activeModuleIndex` to `activePergolaId` in `DrawingWorkbenchUiState`. After all consumers off, delete `WorkbenchSolvedModule[]` array + the derivation transposition; the solve loop iterates `projectModel.pergolas[]` directly. Equivalence tests from PR-2B.1a become the safety net during the migration. **Split into 4 sub-PRs** (2B.1b.1 → 2B.1b.4) to limit per-PR blast radius. |
| **2B.1b.1** Migrate `commercialDesignPayload` to per-object spine ✅ SHIPPED 2026-05-23 | — | `commercialDesignPayload.ts` now consumes `WorkbenchSolvedProject` directly (renamed `buildCommercialDesignInputFromWorkbenchSolvedModel` → `buildCommercialDesignInputFromWorkbenchSolvedProject`). Iterates `solvedProject.pergolas`, emits one `CommercialPergolaInputV1` per `SolvedPergola`, then iterates each pergola's `sourceModules` to produce one `CommercialModuleInputV1` per source module (preserves multi-module legacy commercial parity during coexist). Per-module helper `buildCommercialPergolaInput` takes `{module, pergolaId, pergolaLabel}` instead of a SolvedPergola — clarifies that it builds one cost row per source module, not per pergola. **`SolvedPergola` carrier extended** with `sourceModules: WorkbenchSolvedModule[]` (typically length 1; >1 only for legacy multi-module-per-pergola snapshots — collapses in 2B.4's V2 cost-engine endpoint). `buildWorkbenchSolvedProject` rewritten to iterate `solvedModel.modules` in source order, first-occurrence sets ordering + primary fields, subsequent occurrences append to `sourceModules`. **Label correctness:** label sourced from `projectModel.pergolas[].label` (not `module.label`) — caught by the multi-pergola groupBy test which expected "Pool"/"Main" not "M1"/"M2". Two consumer-side migrations: `workbenchFixturePricingReadiness.ts` + `lib/estimates/pricingRollout.ts` now wrap `buildWorkbenchSolvedProject({solvedModel})` around the call. **Verification:** typecheck clean · 558+10 portal tests + 6 PR-B-era skips · email path 6/6. Coexist intact — `WorkbenchSolvedModel.modules[]` still populated, no other consumer touched. |
| **2B.1b.2** Surface per-object spine on `drawingWorkbenchStore.derived` ✅ SHIPPED 2026-05-23 | — | Purely additive exposure (rescoped from the original "swap the rendering loop" framing). `drawingWorkbenchStore.derived` gains `solvedProject: WorkbenchSolvedProject` (derived via `buildWorkbenchSolvedProject` using `activeSolution.moduleInput.pergolaId` for active selection until 2B.1b.3 lifts the UI selection itself) and `activePergola: SolvedPergola | null`. Legacy `solvedModel.modules` + `activeSolution` + `activeModule` + `persisted.modules` all untouched. **Why split this off:** the original 2B.1b.2 ("swap the rendering loop") tightly coupled with 2B.1b.3 (lift activeModuleIndex), since the legacy module array is indexed by `activeModuleIndex` in 5+ consumer files (EstimatesTab cost-audit module selector, DesignWorkbenchEstimateClient viewport keys, PergolaInspector, DesignWorkbenchFixtureClient, WorkbenchViewportHost). Making `solvedProject` available first lets consumer migrations land one-at-a-time in 2B.1b.3 without a forklift. **Verification:** typecheck clean · 564 portal lib tests + 6 PR-B-era skips · email path 6/6. |
| **2B.1b.3** Migrate consumers from `activeModuleIndex` → `activePergolaId` | — | Migrate consumer files off `derived.activeModuleIndex` + `persisted.modules[index]` lookups to `derived.activePergola` + `derived.solvedProject.pergolas.find(...)` lookups, one consumer at a time. `ObjectWorkbenchRailHost.tsx:71/94` already finds pergola by id then translates back to module index — those become direct pergola-id assignments to UI state. Targets: `ObjectWorkbenchRailHost`, `PergolaInspector`, `DesignWorkbenchFixtureClient`, `DesignWorkbenchEstimateClient`, `EstimatesTab`, `WorkbenchViewportHost`, `DrawingWorkbench`, `useObjectWorkbenchActions`. |
| **2B.1b.3a** Active pergola id selection ✅ SHIPPED 2026-05-30 | — | `DrawingWorkbenchUiState.activePergolaId` is now the canonical active pergola selection. `buildWorkbenchSolvedModel` resolves `activeModule` by matching `moduleInput.pergolaId` before using the legacy module-index fallback, and `drawingWorkbenchStore` projects the matched module index back into `derived.activeModuleIndex` for compatibility. Rail, inspector, viewport pergola selection, add-pergola, and workbench viewport state keys now write/read pergola ids directly. `PergolaInspector` options come from `solvedProject.pergolas` first, with module options only as coexist fallback. `WorkbenchSolvedModel.modules[]`, `buildWorkbenchSolvedProject` transposition, and `RawGeometryModuleInput.houseContext` remain in place for later 2B.1b cleanup. |
| **2B.1b.3b** House-form plan truth unification ✅ SHIPPED 2026-05-30 | Row 9 partial, N4 partial | Model Space house-form overlay now receives the selected form's canonical `house_reference:<formId>` from `WorkbenchSolvedModel.projectHouseGeometries`, so selecting House 2 no longer borrows the active pergola module's host-house projection. Plan committed-body dedupe is per house form id, not global, so a roof body for one house form does not suppress or visually conflict with another form's canonical footprint. Regression coverage pins two-house preset variants (`straight`, `recess_right`, `l_right`, `wrap_right`) across reference geometry, solved-model registry, and PlanViewport overlay/render selection. Legacy `RawGeometryModuleInput.houseContext`, `WorkbenchSolvedModel.modules[]`, and solved-project transposition remain in place. |
| **2B.1b.3c** House-form footprint commits by id ✅ SHIPPED 2026-05-30 | Row 9 partial, N4 partial | House-form resize/outline commits now resolve the selected `houseFormId` and write an object-first footprint edit to only that form. The edge-drag path encodes polygons against the selected form transform instead of `activeModuleInput.houseFootprintPosition`, and inspector/model footprint commits use the same id-addressed action. The legacy shared footprint edit remains as a coexist wrapper for unmigrated primary/shared controls. |
| **2B.1b.3d** Active-pergola-independent house scene composition ✅ SHIPPED 2026-05-30 | Row 9 partial, N4 partial, N9/N10 partial | Project-wide 3D preview house layers now come from `WorkbenchSolvedModel.projectHouseGeometries`, not the active/basis pergola module's viewer scene. The aggregate scene injects canonical `house` and `house_roof_materials` layers keyed by `houseFormId`, while pergola-specific layers still aggregate from solved modules. Geometry scene helpers now emit roof-material scene objects for additional/project house models, so switching active pergola no longer drops another house form's roof material lines. |
| **2B.1b.3e** Project-level Plan projection ✅ SHIPPED 2026-05-30 | Row 9 partial, N4 direct | Plan Editor now receives `WorkbenchSolvedModel.projectPlanProjection`, a canonical project-level top projection built from project house geometry entries, full project pergola plan bodies, and unresolved pergola reference fallbacks. `PlanViewport` uses this projection override for object workbench plan/model surfaces, so active pergola selection changes selection/inspector state only and no longer swaps which house form owns visible roof/body plan shapes. |
| **2B.1b.3f** Project house roof-material Plan bodies ✅ SHIPPED 2026-05-30 | Row 9 partial, N4 direct | Plan render graph now treats project-level `house_roof_material` top-projection shapes as committed visual house bodies. House reference footprint visual dedupe keys off either roof or roof-material bodies for the same `houseFormId`, while hit targets and edit anchors continue to resolve through canonical house references/roof bodies. |
| **2B.1b.3g** Production-aligned multi-object workbench fixture ✅ SHIPPED 2026-05-30 | Row 9 partial, N4 direct, N9/N10 partial | `/qa/design-workbench-fixture` now passes the same project-level object-workbench render props as the production workbench route, including `projectPlanProjection`, project pergola/context overlays, canonical house snap sources, active object refs, hover state, and projection-only model interactions. Added the baked `multi-house-u-two-pergola` fixture with two independent U-shape house forms plus valid and unresolved pergola cases, and a reusable Playwright fixture helper/spec that verifies house plan bodies remain stable while pergola selection changes. |
| **2B.1b.3h** Active-module-independent transient pergola solve inputs ✅ SHIPPED 2026-05-30 | Row 9 partial, N4/N9/N10 guarded by regression coverage | Object-first pergolas without persisted calculator modules now synthesize runtime `CalculatorModuleInputs` from `makeDefaultModule(pergola.id)` plus their own family, connection, dimensions, roof, gable, support, and override fields. Transient sources no longer clone a preferred/active persisted module, and their default flashings are recalculated with stable object-first ids so switching Pergola 1 ↔ Pergola 2 cannot change an unbacked pergola's solve input or project render owner sets. |
| **2B.1b.3i** Explicit Plan hit targets and visible house bodies ✅ SHIPPED 2026-05-30 | Row 9 partial, N4 direct | Plan render graph now separates visible `committedBodies` from transparent `hitTargets`: canonical `house_reference:<houseFormId>` footprints anchor selection, moves, resize, hover, and dimensions, while visible house bodies render from roof / roof-material shapes when present. `house_reference` only promotes to a visible fallback outline when the same house form has no roof body. Project Plan projection assembly moved out of `workbenchSolvedModel.ts` into a focused state helper as the first decomposition step for the remaining solved-model hotspot. |
| **2B.1b.3j** House forms are removable peers ✅ SHIPPED 2026-05-30 | N2 direct, N7 partial, N5/N13 adjacent | `objectFirst.houseAssembly.houseForms[]` is authoritative when present, including an explicit empty array tombstone. The legacy snapshot synthesizer only creates imported `house-main` when no object-first house assembly exists. Any selected house form can be removed, including the first and last; removing the last form leaves zero house forms until `Add structure` creates deterministic `house-form-1`. Rail/inspector labels are derived by current order (`House 1`, `House 2`, ...) rather than persisted ids or labels, so existing `house-main` ids remain valid but are no longer user-facing primary forms. |
| **2B.1b.3k** Plan overlay ownership by house form ✅ SHIPPED 2026-05-31 | N2/N7 partial, N4 direct | Object workbench house status is now keyed per `houseFormId`; the active `status.houseForm` alias resolves to the selected form while rail rows read their own `houseFormsById` entry, so House 1/House 2 labels, presets, roof validation, inspector state, and overlay status no longer borrow the first form. Plan visible-body ownership now prefers `house_roof_material:<houseFormId>` over raw roof-solid bodies for the same form, keeping canonical `house_reference:<houseFormId>` as hit/selection geometry or visible fallback only. |
| **2B.1b.3l** Project Plan visual stack ownership ✅ SHIPPED 2026-05-31 | N4 direct | Plan committed-body rendering now uses a semantic project visual stack instead of raw top-projection array/z-order. Pergola bodies paint below house roof/roof-material bodies even when geometry z-order is higher, while canonical house references remain explicit hit/selection targets or visible fallback outlines only. The visible-body filter moved from the React canvas layer into the plan render graph helper so project Plan paint order is owned by the Plan view model. |
| **2B.1b.3m** Invisible Plan hit targets and object-owned hover chrome ✅ SHIPPED 2026-05-31 | N4 direct | Plan hit targets are now event-only geometry: normal hit targets and terminal-end hit targets remain above the drawing for pointer routing but no longer paint hover fills. Local hover feedback moved into explicit outline-only chrome owned by the Plan canvas, with selected-object hover suppressed so selection/dimension overlays remain the only active-object chrome. |
| **2B.1b.3n** Derived house roof axis and preset-as-seed ✅ SHIPPED 2026-05-31 | N4 direct, N2/N7 adjacent | Hipped ridge axis is no longer exposed as a primary house-inspector control. The workbench keeps `roofIntent.ridgeAxis` as an internal solver field during coexistence, but derives/reconciles it from the edited house form's current footprint before status, project geometry, footprint commits, legacy footprint sync, and add/clone structure paths. Rail subtitles now present neutral footprint state (`Footprint ready` / `Custom footprint`) instead of raw preset ids, so presets remain creation/edit seeds rather than house identity. |
| **2B.1b.3o** House roof intent commits by id ✅ SHIPPED 2026-05-31 | N2 direct, N7 partial, N4 adjacent | Normal house roof edits now commit through `commitHouseFormRoofIntent({ houseFormId, roof })`, which updates only the addressed house form, marks `roofIntentAuthored`, and derives the internal ridge axis from that form's footprint. Inspector roof controls and Plan terminal-end clicks no longer use the shared-house path or fall back to the first house; terminal-end hit shapes carry `metadata.houseFormId`, and missing ownership is a no-op. The old shared roof action remains only as a temporary legacy compatibility wrapper during coexistence. |
| **2B.1b.3p** Plan render provenance and reference fallbacks ✅ SHIPPED 2026-05-31 | N4 direct, N2/N7 adjacent, row 9 partial | Plan render diagnostics now report per-house reference ids, visible roof/roof-material body ids, hit targets, and any `house_reference:<houseFormId>` fallbacks promoted because that house has no visible roof body. Visible reference fallbacks render as transparent outline-only geometry instead of filled house bodies, so unresolved/custom house forms stay inspectable without visually covering roof/pergola bodies. Fixture helpers read the provenance diagnostics and fallback ids to expose the exact house form that lost its committed roof body. |
| **2B.1b.3q** House projection health and no-selection overlay cleanup ✅ SHIPPED 2026-05-31 | N4 direct, N2/N7 adjacent, row 9 partial | `WorkbenchSolvedModel` now carries per-house Plan projection health (`referencePresent`, model/wall/roof-plane counts, roof/roof-material body counts, and visible fallback ids) and threads it into Plan SVG / diagnostics, so fallback screenshots identify the exact failing `houseFormId` and missing projection stage. The object-workbench Plan overlay path now resolves only an explicitly selected house form and no longer manufactures a House 1 overlay when no house is selected; existing inspector compatibility remains separate until the broader facade cleanup. |
| **2B.1b.3r** Selected-house status facade split ✅ SHIPPED 2026-05-31 | N2/N7 direct, N4 adjacent | Object workbench status now separates project/row house status from selected-house status. `houseFormsById` remains populated for every house form, while `selectedHouseFormStatus` / the temporary `houseForm` alias are nullable and resolve only from an explicit selected `houseFormId`. Store trust aggregation, inspector context, diagnostics, and rail row subtitles no longer fall back to House 1 when no house is selected or an invalid selected id is present. |
| **2B.1b.3s** Object-owned house context for actions ✅ SHIPPED 2026-05-31 | N2/N7 direct, N4 adjacent, row 9 partial | Object workbench action paths now resolve house context through an explicit target owner: selected house id, deck `attachment.host.objectId`, opening `sourceFormId`, or pergola house host metadata. Missing ownership returns `null` and no-ops/validation errors instead of falling back to `houseForms[0]` or active module house position. Deck edge-drag commits encode against the deck host house transform, opening writes require an owned house form, and add-structure still supports zero-house projects through deterministic `house-form-1` creation. |
| **2B.1b.4** Delete legacy `WorkbenchSolvedModule[]` + transposition | Audit row 9 fully | Remove the `modules[]` array from `WorkbenchSolvedModel`, delete `buildWorkbenchSolvedProject`'s transposition step, switch solve loop to iterate `projectModel.pergolas[]` directly. |
| **2B.2** Pergola adjacency derivation ✅ SHIPPED 2026-05-22 | new | `derivePergolaGroupsFromScene` at `apps/portal/lib/drawings/state/derivePergolaGroupsFromScene.ts`. Pure function — union-find over the snap-derived `attachment.host.objectFamily === 'pergolas'` graph. Returns `PergolaGroup[]` sorted by `pergolaId` (stable lexicographic root). 12 tests covering empty, single, two-snapped, transitive chain, house-attached (own group), orphaned ref, direction-insensitive, deterministic ordering. |
| **2B.3** New `SiteInputsV2` shape + builder ✅ SHIPPED 2026-05-22 | new | `SiteInputsV2` + `PergolaInputsV2` + `PergolaModuleCostInputV2` + `PergolaAccessoryV2` defined in `@sp/costing` (`packages/costing/src/engine/types.ts`). Scene-derived builder at `apps/portal/lib/estimates/buildSiteInputsV2FromScene.ts` consumes `WorkbenchProjectModel.pergolas` + `CalculatorInputs`, groups via 2B.2, maps pergola-only fields via the new shared `buildPergolaModuleCostFields` helper extracted from V1's `buildModuleCostInputs` (consolidation point — both V1 and V2 paths flow through it). Site-level fields (`access`, `height`, `job_type`, travel/extras/discount) lift to top of V2 (per Q4: cost engine receives pergola data only; site context at the job level). Accessories slot empty (`never[]`) — forward-compatible for blinds/lights/etc. 10 tests + V1's 8 tests still passing through the shared helper. Not yet wired into the cost engine entry — that's PR-2B.4. |
| **2B.4** Cost engine accepts V2 input ✅ SHIPPED 2026-05-22 | new | `calculateSiteCostV2(SiteInputsV2)` exported from `@sp/costing`. Internally adapts V2 → V1 via private `adaptSiteInputsV2ToV1` and delegates to `calculateSiteCostV1`. Pricing logic untouched. Per-module adapter: strips V2-only `id`, copies V2's site-level `access`/`height` to each module (V1 carries them per-module), zero-pads V1's per-module site dummies. Per-pergola: drops the `accessories: []` slot (forward-compat slot; pricing wiring lands when first accessory family ships). 8 equivalence tests verify V2 input produces same `SiteOutputV1` as the equivalent V1 input: single-pergola, two-snapped-pergolas-as-one-logical, two-unconnected-pergolas-separate, site-level access/height propagation, error on empty pergolas, error on empty modules, job_type/travel/extras/discount pass-through, accessories no-op. |
| **2B.5** Workbench cost path migration ✅ SHIPPED 2026-05-22 | new | Workbench's save-reprice flow now uses V2. `EstimatesTab.tsx:1337` (the production cost-engine call site triggered by "Reprice latest" save) switched from `calculateSiteCostV1(buildSiteInputsFromCalculatorInputs(activeDraft.inputs))` to `calculateSiteCostV2(buildSiteInputsV2FromScene({ projectModel, calculatorInputs: activeDraft.inputs }))`. Project model is built via the existing `buildObjectFirstWorkbenchProjectModelFromLegacyEstimateSnapshot` (snapshot + draft → scene-aware project model). **New endpoint** `/api/staff/costing/v2/job/route.ts` accepts `SiteInputsV2`, loads pricebook config, delegates to `calculateSiteCostV2`. Validation deliberately thin (V2 input is produced by typed workbench code, not external untrusted source). **New HTTP client wrapper** `calculateSiteCostV2` in `apps/portal/lib/costing/costEngine.ts`. **Marketing form unaffected** — still uses `calculateSiteCostV1` against `/api/staff/costing/v1/job` (Phase 2 plan Q5). **What this means in practice:** when the user saves an estimate from the workbench, pergola adjacency in the scene now determines cost grouping. Two pergolas snapped together → one logical pergola with two modules in the cost output. Two unconnected pergolas → two separate pergolas. Verified: 712 tests pass + email path 6/6 + typecheck clean. |
| **2B.6** Future-proof accessories slot | new (design only) | The `accessories: []` field on each pergola in `SiteInputsV2` is wired through the engine as a no-op pass-through. Real accessory pricing logic comes later when the first accessory ships. |

**Risk**: medium. The pricing logic is preserved verbatim; only the input layer changes. Adjacency derivation is small and pure.

**Acceptance**:
- Workbench cost output matches today's cost output for equivalent projects (within rounding tolerance).
- Two pergolas snapped to each other group as one logical pergola in the cost output. Two unsnapped pergolas remain separate.
- `costingPayload.ts` is deleted.

### Stream 2C: Accessory framework foundations (design only, no shipping)

**Goal**: scene representation for blinds/lights as future spatial entities is sketched but not built.

This is one design document, not code. Captures:
- Where blinds/lights sit in the data model (probably a new `PergolaAccessoryModel` family)
- How they attach (snap to pergola walls/posts)
- What the cost-input slot looks like
- Marketing form impact (none in Phase 2)

Deferred until Phase 2A+2B ship. Then either becomes Phase 3 or stays in this doc as future-work.

### Stream 2D: Marketing form independence verification

**Goal**: confirm marketing path unchanged after Phase 2.

Just verification — no code changes. After 2A/2B ship, re-run the email-quote tests + manually walk through the marketing form. Confirm `CostInputsV1` still works, `calculateCostV1` still works, email is byte-identical (or close enough to mark as acceptable).

---

## Sequencing

```
2A.1 (audit + migrate adapter consumers)
  ↓
2A.2 (snapshot migration) — can run in parallel with 2B.1
  ↓
2A.3 (delete bridge + legacy types)

2B.1 (per-object solve) — depends on 2A.1
  ↓
2B.2 (adjacency derivation) — can run in parallel with 2B.3
2B.3 (SiteInputsV2 shape)
  ↓
2B.4 (cost engine V2 adapter)
  ↓
2B.5 (workbench cost path migration)
  ↓
2B.6 (accessories slot pass-through)

2D (verify marketing) — after 2B.5

2C (accessories design doc) — anytime
```

**Estimated total**: ~2 weeks of focused work. 2A is the biggest unknown — depends on how clean the legacy adapter consumer migration is.

---

## Status — what we have, what's left (updated 2026-05-23)

**Phase 2 substantially complete from the workbench-user's perspective.** Stream 2B (the cost-engine migration) shipped end-to-end. Stream 2A (canonical-shape lock-in) is mostly done in production; the remaining cleanup is bounded by genuinely load-bearing legacy code.

**Shipped:**
- ✅ Workbench's save-reprice flow uses `SiteInputsV2` — scene adjacency drives logical-pergola grouping (snapped pergolas = same logical pergola; unconnected = separate)
- ✅ Cost engine receives pergola data only (no house/deck/opening fields). House forms, decks, openings exist in the scene for design but aren't costed.
- ✅ `SiteInputsV2` extensible for future accessories (blinds, lights — empty `never[]` slot today)
- ✅ Cross-file bridge synthesis function (`buildObjectWorkbenchCompatibilityDraftFromObjectFirstDraft`) deleted in PR-2A.1b
- ✅ `state/compat/` namespace deleted in PR-2A.3
- ✅ Marketing form path unaffected (still on V1, intentionally per Q5)
- ✅ Pergola adjacency derivation (`derivePergolaGroupsFromScene`) — pure function, well-tested

**Updated acceptance criteria (revised after 2026-05-23 audit):**
- ✅ Workbench cost path: `WorkbenchProjectModel` → `buildSiteInputsV2FromScene` → `calculateSiteCostV2`. `EstimatesTab.tsx` no longer calls `buildSiteInputsFromCalculatorInputs` for the workbench save flow. (The V1 builder is still consumed by other paths — calculator UI, commercial design payload, staff API — which weren't in scope.)
- ✅ Cost output: two snapped pergolas are one logical pergola (multiple modules); two unsnapped pergolas are separate pergolas. Verified via 8 equivalence tests in `calculateSiteCostV2.test.ts`.
- ✅ `SiteInputsV2.pergolas[].modules[]` carries pergola-only fields. No `houseContext`, `decks`, `openings`. Verified by both type signature and tests.
- ✅ Marketing-site enquiry email path unchanged. `calculateCostV1` + `CostInputsV1` still in place.
- 🟡 `grep -r "HouseFirst\|houseFirst\|hostHouseFormId" apps/portal packages` — still has hits, all in the test-driven legacy carrier path inside `houseFirstWorkbenchAdapter.ts` (40+ test cases use `draft.houseFirst`). Production code is clean. Final scrub is deferred (see Remaining work below).
- ❌ `WorkbenchProjectModel` is the only project-state runtime type — partially true. `HouseModel`/`PergolaModel` (the "rich" computed types) still exist inside `houseFirstWorkbenchAdapter.ts` as intermediate synthesis results. They're not exported to UI/inspector layers (rail and inspector are already on object-first), but the synthesis pipeline still produces them. Retiring them requires PR-2B.1 (per-object solve).
- ❌ Existing project snapshots migrated to canonical shape — **not applicable** per the 2A.2 investigation. The server stores calc-era `{inputs, outputs, warnings}` snapshots (immutable after creation); the user's authored state lives in IndexedDB as `draft.objectFirst` (already canonical). The "legacy adapter" is an initial-state synthesizer, not a migration bridge — there is no shape to migrate FROM.

**Remaining work (in priority order):**

1. **PR-2B.1 — per-object solve loop.** Workbench's `workbenchSolvedModel.ts` still loops per-pergola-module (legacy V1 module shape). After this PR, solve runs per object (each pergola, house form, deck, opening solves independently). Closes audit row 9 fully. Largest remaining geometry-pipeline change.
2. **Test surface migration.** 40+ test cases in `houseFirstWorkbenchAdapter.test.ts` use `draft.houseFirst.*` legacy carrier. They test real business logic (deck routing, opening validation, pergola attachment) using the carrier as an input shape. Migration: rewrite to drive via `draft.objectFirst.*` shapes, or delete-and-replace with equivalent objectFirst-shaped fixture tests. After this, `HouseFirstDeckDraft`, `HouseFirstOpeningDraft`, `HouseFirstPergolaDraft` types can delete; `HouseFirstWorkbenchDraftCarrier` shim deletes; `readDeckDrafts`/`readOpeningDrafts`/`readPergolaDrafts` helpers delete.
3. **Stream 2A.3-extended — once test migration ships:** `houseFirstWorkbenchModel.ts`'s draft types delete; `legacyObjectFirstCompatibilityAdapter.ts`'s conversion helpers delete. `legacyEstimateSnapshotAdapter.ts` stays (initial-state synthesis from calc-era snapshots is genuinely needed until calc-era snapshots retire entirely).
4. **Other-shell V1 paths.** Calculator UI, commercial design payload, staff API endpoint still build V1 site inputs. Out of Phase 2 scope per Q6 (other shells deferred). Will migrate as those shells get their own Phase 2-equivalent work.
5. **Snapshot retirement (post-Phase 2).** Once the cost engine is fully V2-driven and the calculator UI retires, the server snapshot itself becomes redundant. That's Phase 3 work.

**Pre-existing test failure (not introduced by Phase 2):**
- `ModelSpaceViewport.tsx` fixture-rot — 2026-05-21 decision log diagnoses the issue (8-9 test failures from stale `objectWorkbenchOverlayInput` fixtures). Not blocking; will resolve naturally during PR-2B.1 fixture updates.

---

## Lessons learned

Captured during PR-A through PR-2A.3 + Stream 2B. Worth re-reading before scoping the next chunk.

1. **The cull plan over-promised on deletability.** Several "delete legacy code" PRs (PR-H, PR-2A.3) assumed the legacy code was unused. Investigation repeatedly found the code was load-bearing — either through tests, initial-state synthesis, or non-workbench consumers. Rule learned: every "delete X" PR needs a fresh consumer audit *before* writing code. Stale assumptions waste a round-trip.

2. **"Migration" framing fails when there's nothing to migrate.** PR-2A.2 assumed server snapshots were in a stale shape needing transformation. Reality: snapshots were always calc-era + cost outputs; user's authored state lives separately in IndexedDB. No migration applies. Architectural mental models can be wrong; verify the persistence layer before designing migrations.

3. **The shared helper is worth extracting early.** `buildPergolaModuleCostFields` (shared between V1 and V2 builders) made PR-2B.3 dramatically cleaner. Future cost-input changes touch one site, not two. When two paths emerge that need the same logic, factor immediately even if the second path is incoming-not-shipped.

4. **The cull plan's "single PR" sizing was wrong for several rows.** PR-G turned into G1/G2/G3a/G3b/G3c. PR-2A.1 turned into 2A.1a/2A.1b. Pattern: when a PR description says "delete X", the surface area scales with consumers. Split as soon as the audit reveals it.

5. **Equivalence tests are cheap insurance.** PR-2B.4 shipped with 8 V1↔V2 equivalence tests. They caught a test-factory bug instantly during the migration. When introducing a parallel code path, write the equivalence test before the production switch.

6. **Carrier shims are honest about test debt.** The `HouseFirstWorkbenchDraftCarrier` shim in PR-2A.1b is ugly but explicit: the production path is clean, the test path is legacy. Documenting "this exists for tests, production never uses it" is better than pretending the cleanup is done.

7. **Interrupt the user with a question only when the answer changes the architecture.** Every "do you want X or Y?" mid-PR was answered quickly because the question was framed in concrete trade-offs (Path 1 vs Path 2, Option A vs B). The questions that DIDN'T need asking — every mechanical choice during execution — went through fine. Cost of interrupting is real; gate the question on "this changes the design direction".

8. **The user's "ruthlessly cull" permission unlocks fast progress.** PR-B's byte-identity divergence (workbench attachment zones temporarily disappearing) would have been blocking under old rules. Under the locked permission, it shipped as a 6-skip-and-move-on. Speed of iteration > short-term UX continuity when the foundation needs work.

9. **The Phase 1/Phase 2 boundary was blurry.** Several "Phase 1 cleanup" rows turned out to require Phase 2 work to make safe. The line between them was the cost engine migration — until that shipped (Stream 2B), most "delete legacy adapter" work was blocked. Worth noting for future big-bang/incremental decisions: identify the irreducible boundary first.

10. **Documentation rot is fast.** The cull plan referenced PRs (PR-D, PR-E, PR-F) by names whose scope shifted across sessions. By PR-G, the plan's "what's next" was already wrong. Lesson: don't reference future PR names; describe outcomes and let the next PR name itself.

---

## Anti-patterns to watch for (Phase 2 additions to the architecture doc)

- **Adding fields to `SiteInputsV2` that aren't pergola or accessory data.** If a field is house/deck/opening info, it doesn't belong here — those are scene-only, not costing.
- **Storing pergola module grouping as a field.** It's derived from spatial adjacency. Period.
- **Re-introducing per-pergola-module solve loops** after 2B.1 lands. Solve is per-object.
- **A new bridge / adapter type** that converts between `WorkbenchProjectModel` and any other shape. There's one canonical shape; if you need to translate, build a derivation function (pure, named, tested), not a bridge class.

---

## How this doc retires

Phase 2 ships as PR-A2 through PR-D2 (or similar — name pattern set at first PR). When all four streams are complete and acceptance criteria pass, this doc gets archived into `docs/decision-log.md` as a single entry ("Phase 2 complete — link to PR list") and deleted from `docs/`. Live planning docs that hang around become misleading.

Phase 3 (multi-shell rollout — marketing self-design upgrade, sales tool, etc.) is a separate planning doc, written when Phase 2 is done.
