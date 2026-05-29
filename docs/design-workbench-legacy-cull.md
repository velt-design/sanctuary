# Design Workbench Legacy Cull — Phase 1 Plan

**Status (2026-05-22): Phase 1 closed. Continuing work tracked in [Phase 2 Plan](design-workbench-phase-2-plan.md).**

Phase 1 shipped as PR-A through PR-G3c. The originally-planned PR-H ("final cleanup sweep") + PR-I ("ModelSpaceViewport fixture rot") turned out to be **superseded by Phase 2 work**: investigation in 2026-05-22 revealed that PR-H's deletion targets (`HouseFirst*` types, `legacyObjectFirstCompatibilityAdapter`, `hostHouseFormId`, `houseFootprintSideLocalToWorldPolygon`) are still load-bearing because Phase 1 PRs deliberately preserved them while migrating upstream consumers. Deleting them requires the consumer-side migration that IS Phase 2 (see § "Stream 2A" in the Phase 2 plan). PR-I is deferred until after the consumer-side migration stabilises the test fixtures.

**What Phase 1 actually delivered (final retrospective):**
- Object-first project model is the dominant runtime shape (`WorkbenchProjectModel`)
- Snap-derived pergola + deck attachments (`PergolaAttachment`, `DeckAttachment`)
- `attachment_side` retired from cost engine (replaced by `attachment_length_mm`)
- Scene composition lifted to project level (additional house forms built once per project)
- Plan references now use one canonical `house_reference:<formId>` per house form, including `house-main`
- Follow-up PR3: `WorkbenchSolvedModel.projectHouseGeometries` is now the project house registry feeding canonical references, host-excluded scene composition, shared host-house selection, and PlanViewport snap targets for every valid house form. Follow-up PR1 of the multi-object goal moved host house ids through raw/normalized geometry and deleted the portal scene-retag bridge. Follow-up PR2 added runtime-only object-first pergola solve sources so orphan pergolas no longer require fake persisted `inputs.modules[]` rows. Follow-up PR3 enabled rail Add Pergola to create freestanding object-first pergolas through that runtime path. Follow-up PR4 made non-active pergola context outlines selectable in plan through the same pergola-id routing. Follow-up PR5 made Plan Editor aggregate full solved plan bodies for every valid pergola id and let transient object-first mono pergolas build native edit state from solved in-memory config. Follow-up PR6 made 3D Review aggregate valid pergola scene bodies by `pergolaId` while keeping 3D read/select-only. Follow-up PR7 routes eligible workbench pergolas through the package-level `solveProject` boundary grouped by host house form; the per-pergola `RawGeometryModuleInput.houseContext` field is still the Phase 2 deletion target.
- Project-level decks/openings pre-pass (no per-pergola redundancy)
- `buildHouseModelConfig` decoupled from pergola context
- Email-quote path completely unchanged throughout

**What Phase 1 left for Phase 2:**
- Bridge deletion (`HouseFirst*` types, `legacyObjectFirstCompatibilityAdapter`)
- Per-object solve loop (the `workbenchSolvedModel` per-module loop still exists)
- Cost engine input migration (cost engine still consumes `CostInputsV1` via `costingPayload.ts`)
- Snapshot persistence migration (canonical shape lock-in)

The rest of this doc is **the working history** of Phase 1 — kept for reference until archived to the decision log.

---

**Scope**: this was the deletion roadmap for Phase 1 of the [Product North Star](design-workbench-architecture.md). Working document; entries got checked off as PRs shipped.

**Goal**: remove every legacy calculator-era pattern from the design workbench, so every object is a first-class spatial entity. Replace pergola-anchored coordinates, `attachmentSide` enums-as-position, primary-vs-additional special-casing, and the multi-shape (`houseFirst*` vs `objectFirst*`) draft duality.

**Constraint** (the only one): the marketing-site enquiry → automatic estimate email path must keep working end-to-end at every step. A thin temporary adapter from the new object model to the cost engine's current input shape preserves this throughout Phase 1.

**Updated 2026-05-22 (locked by user)**: workbench UX can break temporarily during Phase 1. Project model byte-identity is NOT a constraint. The goal is "clean foundation quickly", not "no regressions along the way".

**Discovered 2026-05-22 (trace report)**: the marketing-site enquiry → email path is **fully independent of the workbench**. It goes `apps/marketing/app/contact/page.tsx` → `/api/enquiry` → `calculateCostV1()` from `@sp/costing` → `sendCustomerAutoresponder()`. The workbench refactor cannot affect this path as long as `@sp/costing/calculateCostV1`, `CostInputsV1`, and `EnquiryPayload` shapes are preserved.

**Net constraint set for Phase 1 PRs:**
- Don't change `@sp/costing/calculateCostV1` signature or `CostInputsV1` shape
- Don't change `EnquiryPayload` shape (in `apps/marketing/emails/types.ts`)
- Don't change the marketing-site form contract (`apps/marketing/app/contact/page.tsx`)

That's it. Everything else inside `apps/portal/lib/drawings/`, `apps/portal/components/drawings/`, and `packages/geometry/` is fair game. **Test fixtures update alongside PRs; no byte-identity preservation needed.**

**Phase 1 vs Phase 2 boundary (important).** Phase 1 = restructuring inside the workbench (object-first model, snap-derived connections, deletion of legacy compat). Phase 2 = migrating the **cost engine input layer** from `inputs.modules` to solved geometry; this enables retiring the dual source-of-truth (`inputs.modules` + `objectFirst.houseAssembly`) for the primary form. **PRs that require Phase 2 work to ship cleanly must be split.** This was discovered during PR-B scoping (the original PR-B required Phase 2 to fully close N7); the rescoped PR-B does the largest Phase-1-only step. Each PR below has an explicit "Phase 2 dependencies" line.

**Out of scope for Phase 1**:
- Rewriting the cost engine's pricing logic (that's Phase 2).
- Touching the marketing-site enquiry form HTML (it stays; only the backend adapter changes).
- Rhino/Vray export plumbing (separate project, built on top of the clean model).
- New UI features (rotation gestures, multi-pergola-per-house, etc.) — all paused until Phase 1 ships.

---

## Cull strategy legend

Every legacy site is one of:

- **DELETE** — pure legacy with no surviving consumer. Remove the file/function/field outright.
- **CONVERT** — the field exists at a boundary (persisted shape, public API, snapshot import). Replace its implementation with the new model; keep the name only if external systems read it.
- **PRESERVE** — required by the cost engine input layer (until Phase 2) or by legacy snapshot import. Mark explicitly; do not extend.

If a site is "PRESERVE", it must have a `// LEGACY-PHASE2:` comment in the code pointing to the cull plan so we can find them all later.

---

## Carry-forward from the existing audit (architecture doc rows 1–9)

The audit table in [design-workbench-architecture.md § "Legacy compat sites that violate the principle"](design-workbench-architecture.md) is the starting point. Status as of 2026-05-22 with cull strategy applied:

| # | Site | Original status | Phase 1 strategy |
|---|---|---|---|
| 1 | `packages/geometry/src/footprints.ts` — `resolveHouseFootprintFrame`, `houseFootprintSideLocalPointToWorld` (pergola-dim parameterised) | wip | **DELETE** the side-local converters once nothing reads them; house owns world-coord Polygon3 |
| 2 | `packages/geometry/src/normalize.ts` — deck handling in `buildHouseModelConfig` (hardcoded 1000×1000 frame, deck still references pergola attachment side) | wip | **CONVERT** — decks come in as world-coord polygons; remove the placeholder frame |
| 3 | `apps/portal/lib/drawings/state/objectWorkbenchDeckGeometry.ts` — `DeckHostEdgeFrame`, `resolveDeckGeometryHostEdgeId` (deck "host edge" as `AttachmentSide`) | pending | **DELETE** — deck host edge becomes an absolute house-wall id via snap reference (see new row N1) |
| 4 | `apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts` — `HouseFormFootprintModel.attachmentSide`, `OpeningObjectModel.wallId`, deck host references (pergola-relative side semantics in persisted shape) | wip | **CONVERT** — replace with absolute edge ids on the model. `attachmentSide` survives only as a derived UI label |
| 5 | `packages/geometry/src/applyAssemblyPosition.ts` — house transform routed through boundary | done | keep; this is the foundation the new model builds on |
| 6 | `packages/geometry/src/topProjection.ts` — `buildReferenceShapes` (one house/pergola) | done | keep; PR8c-iii extended via `buildHouseReferenceProjectionShape` |
| 7 | `packages/geometry/src/takeoff.ts` — `dimensionsFromOutline` | done | keep |
| 8 | `packages/geometry/src/contracts.ts` — `Assembly3D` singular semantics | done | keep |
| 9 | `apps/portal/lib/drawings/geometry/buildRawGeometryModuleInput.ts` — non-pergola objects wrapped into pergola's `houseContext` | pending | **CONVERT** — per-object raw inputs; geometry pipeline iterates per object, not per pergola module |

---

## New cull candidates discovered during PR5–PR11

These are the patterns I shipped or extended that were not in the original audit. Each is either a deletion target or an architectural debt to retire in Phase 1.

| ID | Site | What it is | Strategy |
|---|---|---|---|
| **N1** | `apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts` — `ObjectFirstDeckDraft.hostHouseFormId` | Routing field I added in PR9 so decks could attach to non-primary forms. Bandaid: deck still stores side-local coords against the host polygon. | **DELETE** once decks store world-coord polygons + snap reference. The snap reference's `host.objectId` replaces it. |
| **N2** | `apps/portal/lib/drawings/state/houseFirstWorkbenchAdapter.ts` — `LEGACY_PRIMARY_HOUSE_FORM_ID` constant + every consumer | The primary-vs-additional distinction. Currently special-cased in `buildSharedHouse`, `buildAdditionalHouseFormFromDraft`, the per-form deck filter, `commitHouseFormTransformDelta`, and the rail "Add structure" wiring. | **DELETE** — primary becomes "just another form" per north star decision 1. Calculator-snapshot import converts to N forms with no priority. |
| **N3** | `apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.tsx` — old primary-skip guard in `onCommitMove` for `house_form` family (PR11) | Guard that prevented dragging the primary form. Removed in the primary-transform PR; raw geometry now consumes `HouseFormModel.transform` first. | **DONE / WATCH** — keep deleting any remaining primary-vs-added movement assumptions as N2 collapses |
| **N4** | `apps/portal/lib/drawings/state/buildHouseFormReferenceGeometry.ts` — freestanding house-form reference geometry | Former workaround for `buildHouseModel3DFromRawHouseInput` requiring a `pergolaContext` even for freestanding houses. The synthetic pergola context is gone, but the helper still uses fallback preset dimensions until house footprints are fully object-owned. | **DELETE/SIMPLIFY** with row 9 — once `buildHouseModel3DFromRawHouseInput` takes object-owned footprint geometry directly |
| **N5** | `apps/portal/lib/drawings/state/houseFirstWorkbenchModel.ts` — entire `houseFirst*` draft type family (`HouseFirstDeckDraft`, `HouseFirstOpeningDraft`, `HouseFirstRoofDraft`, `HouseFirstPergolaDraft`, `HouseFirstWorkbenchDraftCarrier`) | Legacy persisted shape. The action layer writes to `objectFirst`; a compat bridge converts to `houseFirst` for the read path. Two shapes for the same data. | **DELETE** — read path reads `objectFirst` directly; bridge retires; compat adapters in `state/compat/` and `legacyObjectFirstCompatibilityAdapter` go with it |
| **N6** | `apps/portal/lib/drawings/state/compat/objectWorkbenchCompatibilityModel.ts` and `legacyObjectFirstCompatibilityAdapter.ts` | The bridge between objectFirst and houseFirst draft shapes. | **DELETE** with N5 |
| **N7** | `apps/portal/lib/drawings/state/houseFirstWorkbenchAdapter.ts` — `buildSharedHouse` synthesising the primary from `CalculatorModuleInputs[]` | The entry point that creates the legacy primary form from pergola module data. | **CONVERT** — extract a one-shot adapter `buildObjectModelFromLegacySnapshot(snapshot) → ObjectFirstWorkbenchDraftVNext` used only at snapshot import. The synthesis-on-every-read goes away. |
| **N8** | `packages/geometry/src/normalize.ts` — `buildHouseModelConfig` freestanding short-circuit lifted in PR8b | The fact this short-circuit needed lifting was a signal; the underlying coupling (config carries pergola dims) remains. | **DELETE** the config field altogether once the geometry pipeline iterates per object |
| **N9** | `packages/geometry/src/viewer.ts` — `buildLayers` reads `assembly.house.model` from a single pergola | Each pergola module's scene only contains its own house. PR8d added "compose additional forms in" as a workaround at the portal layer. | **CONVERT** — scene builder iterates all project objects, not just per-pergola. Removes the per-pergola scene duplication of house objects. |
| **N10** | `apps/portal/lib/drawings/state/workbenchSolvedModel.ts` — `composeAdditionalHouseFormsIntoScene` (PR8d) | Portal-layer workaround that injects additional forms into each pergola scene. | **DELETE** with N9 |
| **N11** | `apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildHouseSnapTargets.ts` — single-house assumption | Snap targets are built from one house. Additional forms not visible to snap engine. | **CONVERT** — iterate all project objects (houses + pergolas + decks), emit snap targets per object |
| **N12** | `apps/portal/components/drawings/viewports/ModelSpaceViewport.tsx` — imports from `houseFirstWorkbenchModel` (`HouseFirstDeckDraft`, `WorkbenchHouseSelection`, `WorkbenchMode`) | Import-guard violation flagged 2026-05-21. The 8 stale-fixture failures sit on top of this. | **CONVERT** to object-first equivalents; allows the 8 fixture tests to migrate at the same time |
| **N13** | `apps/portal/lib/estimates/drawingEdits.ts` — `EstimateDrawingDraft.houseFirst` slot | Legacy persisted slot on the estimate draft. The new write path goes through `objectFirst` and deletes this on write (`updateEstimateDrawingObjectFirstWorkbenchDraft`). | **DELETE** the field from the type and clean up readers; the deletion-on-write logic is no longer needed |

This list is **not exhaustive**. As each PR lands, new candidates will surface; add them here before shipping the PR that exposes them.

---

## PR sequence (Phase 1)

Each PR is small enough to ship in 1–2 days. Dependencies are explicit. **No new features land between these PRs.**

### PR-A — Delete the bridge file, consolidate conversion as a private helper

**Scope adjusted 2026-05-22**: the original PR-A also tried to delete the `HouseFirst*` types, but those are deeply consumed (12 files). Type deletion shifts into PR-D / PR-E / PR-F where each adapter chain migrates naturally. PR-A focuses on removing the cross-file bridge indirection.

**Closes:** N6 fully, N13 partial (surfaces `EstimateDrawingDraft.houseFirst` for removal later).
**Does NOT close:** N5 (types stay — see PR-D/E/F).
**Touches:** `apps/portal/lib/drawings/state/compat/objectWorkbenchCompatibilityModel.ts` (delete), `apps/portal/lib/drawings/state/houseFirstWorkbenchAdapter.ts` (add private helper), `apps/portal/lib/drawings/state/legacyEstimateSnapshotAdapter.ts` (call adapter directly), `apps/portal/lib/drawings/state/houseFirstWorkbenchFixtures.ts`, `apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.ts`, tests that import the bridge.

**What changes:**
- Delete `buildObjectWorkbenchCompatibilityProjectModel` (the cross-file bridge wrapper) and its file.
- Move `buildObjectWorkbenchCompatibilityDraftFromObjectFirstDraft` logic from `legacyObjectFirstCompatibilityAdapter.ts` into a private helper inside `houseFirstWorkbenchAdapter.ts` (`deriveHouseFirstDraftViewFromObjectFirst`).
- `buildHouseFirstWorkbenchProjectModel` becomes the single entry point: it takes a draft, internally derives its houseFirst-shaped view from `draft.objectFirst.*`, then proceeds as today.
- Callers that used to call the bridge now call `buildHouseFirstWorkbenchProjectModel` directly with the same arguments (snapshot + draft).

**Risk:** behavior is byte-identical (same conversion, just relocated). The conversion logic stays alive — it just stops living in its own file. PR-D / PR-E / PR-F retire the conversion entirely when adapters migrate to consume the object-first types directly.

**Acceptance:** marketing-site enquiry email path unchanged. All 212 state tests pass byte-identical. All sanctuary fixtures produce byte-identical project models before vs. after. The 8 `ModelSpaceViewport` failures stay flat (separate cleanup, PR-I).

### PR-B — Collapse primary + additional form code paths (aggressive Option 2)

**Scope re-adjusted 2026-05-22 (post-permission)**: with workbench UX no longer a Phase 1 constraint, PR-B reverts to the aggressive round-trip approach. The primary form gets processed through the same `buildHouseFormFromDraft` pipeline as additional forms. The byte-identity divergence (primary's `attachmentKind` becomes `'freestanding'`, attachment zones temporarily disappear in the workbench) is acceptable — it gets restored by PR-F.

**Closes:** N2 partial (sets up `LEGACY_PRIMARY_HOUSE_FORM_ID` deletion in PR-C by collapsing the two builders).
**Does NOT close:** N7 (per-read synthesis stays — still runs `buildSharedHouse` once to derive the draft, then runs through the unified builder).
**Phase 2 dependencies:** None — the cost engine reads `inputs.modules.attachmentSide`/`attachmentStrategy`, which are unchanged by this PR.

**Touches:** `houseFirstWorkbenchAdapter.ts` (add `houseModelToObjectFirstHouseFormDraft` converter, refactor `buildHouseFirstWorkbenchProjectModel` to use one unified loop, rename `buildAdditionalHouseFormFromDraft` to `buildHouseFormFromDraft`).

**What changes:**
- `buildSharedHouse` still runs to derive the primary form's data from `CalculatorModuleInputs[]`.
- Its output (`HouseModel`) gets converted to `ObjectFirstHouseFormDraft` via a new helper.
- That draft, along with any authored additional forms, flows through `buildHouseFormFromDraft` (renamed from `buildAdditionalHouseFormFromDraft`).
- The two code paths inside the project-model builder collapse to one.
- Primary's `attachmentKind` becomes `'freestanding'` (since `buildHouseFormFromDraft` doesn't carry pergola context). Attachment zones for the primary disappear in the workbench → pergola attachment UI degrades. **PR-F restores this via snap references.**

**What temporarily breaks (acceptable per locked permission):**
- Workbench pergola attachment dragging on primary form (snap zones unavailable). Plan-view UX degrades until PR-F.
- Test fixtures that assert specific attachment zone IDs on the primary will fail and get updated alongside this PR.

**What does NOT break:**
- Email-quote path: `inputs.modules.attachmentSide`/`attachmentStrategy` are untouched; cost engine continues to read them.
- Persisted data: no schema changes.

**Acceptance:** email-quote path output unchanged (verify with email-trigger integration test). Affected test fixtures updated. The collapsed code path is visibly simpler in `buildHouseFirstWorkbenchProjectModel` (one form-building loop instead of two).

### PR-C — Delete `LEGACY_PRIMARY_HOUSE_FORM_ID` and the primary-vs-additional split

**Closes:** N2, N3, N4 (partial).
**Phase 2 dependencies:** None. The id literal goes away; the dual source-of-truth in `inputs.modules` + `objectFirst.houseAssembly` stays. Cost engine continues to read `inputs.modules` unchanged.
**Touches:** every consumer of `LEGACY_PRIMARY_HOUSE_FORM_ID` (`grep -r LEGACY_PRIMARY` first; expect 10–15 sites), `buildAdditionalHouseFormFromDraft` (gets merged with the primary path into one `buildHouseFormFromDraft` — done in PR-B), remaining movement assumptions around primary-vs-added forms, rail "Add structure" sourceHouseFormId logic.
**What changes:** one code path for all forms. The rail's "Add structure" button still works (clones the active form or the first form in the list). All forms are draggable. All forms participate in deck routing equally.

**Risk:** the rail's behavior should look identical to the user. Verify with the PR10 rail test that the button still produces a new form 10 m east.

**Acceptance:** rail test passes. Multi-form integration test in `houseFirstWorkbenchAdapter.test.ts` passes. Visual smoke test (load mono-standard, see one house; click "Add structure", see two houses, drag either one).

### PR-D — Decks store world-coord polygons + snap reference

**Closes:** N1, N5 (deck part — deletes `HouseFirstDeckDraft` type), audit rows 2, 3, 4 (deck part).
**Phase 2 dependencies:** **Potentially.** If the cost engine reads deck-related fields from `inputs.modules` (e.g., deck preset dims for material costing), the new world-coord deck position needs to be readable by it. Verify before starting: grep for cost engine deck reads. If yes, scope PR-D to "model + read path migration", leave a thin compat shim that synthesises the legacy deck fields from the new world-coord shape for the cost engine. The shim retires in Phase 2.
**Touches:** `ObjectFirstDeckDraft` (delete `hostHouseFormId`, `hostEdgeId`-as-`AttachmentSide`; add `position` + `localOutline` + `snapReference`), `objectWorkbenchDeckGeometry.ts` (delete `DeckHostEdgeFrame`), `houseFirstDeckAdapter.ts` (rebuild around world polygons), `normalize.ts` deck handling (remove placeholder frame), `addSharedHouseDeck` action (default position from active form's wall midpoint via snap).

**Risk:** biggest PR. Decks today have ~6 fields tied to `AttachmentSide`. The snap engine needs to surface wall edges for ALL forms (overlaps with N11). Plan: do N11 first as PR-D.1, then deck migration as PR-D.2.

**Acceptance:** existing single-form fixtures render decks identically. Dragging a deck from one form's wall to another form's wall produces a snap reference to the new form. The PR9 test still passes (semantics: deck routed to correct form), but the implementation uses snap references instead of `hostHouseFormId`.

### PR-E — [MERGED INTO PR-F, 2026-05-22]

**Scope-check 2026-05-22 (skipped after grep)**: scoping found that the opening data model is already mostly where the architecture wants it (`hostEdgeId: string | null` carries an absolute wall edge id; `sourceFormId` carries the host form id). The real migration work — deleting the legacy `wallId: WallOpeningHostSide` enum — lives in the **geometry pipeline consumers** (10 files in `packages/geometry/` + `apps/portal/lib/drawings/geometry/` + `apps/portal/lib/drawings/views/plan/`). Those consumers naturally migrate as part of PR-F (snap-driven attachment) and PR-G (per-object geometry).

**PR-E is therefore folded into PR-F + PR-G.** No standalone PR. The cull audit rows that PR-E was meant to close (N5 opening-part, audit row 4 opening-part) get closed by PR-F + PR-H instead.

**Lesson for the cull plan**: PR-E's over-scoping was caught by the "blast-radius grep before coding" step in CLAUDE.md's gate. Process is doing what it's designed to do.

### PR-F — Pergola attachment becomes a real snap reference + retire `attachment_side` from cost engine ✅ SHIPPED 2026-05-22

**Scope expanded 2026-05-22 (after user pushback on Q2 during scoping)**: original PR-F planned a Phase 1 compat shim that synthesised `attachment_side` from the new snap reference, deferring cost engine input migration to Phase 2. User asked "do we even need this at all?" — investigation showed `attachment_side` is only used inside `derive.ts:508-510` as a 2-bit selector for "is the long or short side attached" — used to compute `attachmentLengthMm`. Cleaner end state: replace `attachment_side` with `attachment_length_mm` directly. The cardinal-side concept disappears entirely from costing. **This is the first Phase 2 chunk — cost engine input migration, scoped to one field.**

**Closes:** N5 partial (pergola + roof parts), audit row 4 (pergola part), opening parts that PR-E was folded into.
**Does NOT close:** the `HouseFirst*` type deletions (deferred to PR-H once all readers migrate).
**Phase 2 dependencies:** N/A — PR-F IS the cost engine input migration for the `attachment_side → attachment_length_mm` field. Other Phase 2 work (cost engine reading from solved geometry instead of `inputs.modules`) remains future.

**Touches (shipped 2026-05-22):**
- `packages/costing/src/engine/types.ts` — `CostInputsV1` + output type ✅
- `packages/costing/src/engine/derive.ts` — input normalization, usage, output all switched to `attachment_length_mm` ✅
- `packages/costing/src/engine/calculate.test.ts` — test now exercises `attachment_length_mm: 6000` vs `3000` ✅
- `apps/portal/lib/estimates/costingPayload.ts` — bridge derives `attachment_length_mm` from legacy `attachmentSide` + `lengthM`/`projectionM` via new `deriveAttachmentLengthMm` helper ✅
- `apps/portal/lib/estimates/costingPayload.test.ts` — tests now assert mm values, freestanding → null ✅
- `apps/portal/lib/drawings/state/pergolaAttachment.ts` — new `connectionKindFromAttachment()` helper ✅
- `apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts` — `resolvePergolaConnectionKind` now prefers `pergola.attachment` (downstream `objectWorkbenchInspectorModel:411` + `drawingWorkbenchStore:340` inherit the change because they read from the resolved status) ✅

**Scope trimmed:** `pergolaAttachmentResolver.ts` migration deferred to PR-G/H where the entire `houseFirstWorkbenchAdapter` pipeline (the resolver's only caller) is replaced. Refactoring the resolver in PR-F would be churn: its inputs/outputs feed legacy `PergolaModel.attachment` consumers that PR-G/H deletes wholesale.

**What changes:**
- Cost engine: `attachment_length_mm: number | null` replaces `attachment_side`. When null, defaults to `length_m * 1000` (preserves current behavior for marketing-form enquiries which never set `attachment_side`).
- Cost engine output: `attachment_side` removed (no production consumers; only test snapshots referenced it).
- Workbench cost payload: derives `attachment_length_mm` from `pergola.attachment.host.edgeId` + form's wall graph (the edge's length). Freestanding pergolas: null → defaults to lengthMm.
- 5 workbench UI/state reads of `connectionKind` migrate to read `attachment.spatialKind` first, falling back to legacy `connectionKind` when `attachment` is absent.
- `pergolaAttachmentResolver.ts` accepts `PergolaAttachment` as input (when present) and synthesises the legacy fields it needs for warning emission.
- Action layer keeps dual writes (legacy + new) for now — full legacy-field deletion is PR-H.

**What temporarily breaks (acceptable per locked Phase 1 permission):**
- Pergolas without a populated `attachment.host.edgeId` (i.e., legacy-loaded pergolas before the snap commit wiring lands in PR-F-2 follow-up) will fall back to lengthMm for `attachment_length_mm` regardless of whether they were originally attached to the long or short side. **Cost may differ for left/right-attached legacy pergolas** until the user re-snaps them. Workaround: existing estimates re-snap on next drag. Email-quote path unaffected (marketing form was always 'rear').
- `myEdgeIndex` stays 0 for legacy-migrated pergolas (acceptable per Q3 — a pergola with no host is freestanding, and `myEdgeIndex` only matters once snap commits write it explicitly).

**Acceptance:**
- Email-quote tests pass (6/6).
- Cost engine test that exercised `attachment_side` updated to exercise `attachment_length_mm`; same bracket count assertions hold for `attachment_length_mm = projection_m * 1000` (mimics old `'left'`/`'right'`) vs `attachment_length_mm = length_m * 1000` (mimics `'rear'`/`'front'`). ✅
- Workbench: rear/front-attached pergola estimates produce identical cost. Left/right-attached estimates produce identical cost ONLY for pergolas that have been re-snapped after PR-F (acceptable per locked permission).
- `resolvePergolaConnectionKind` prefers `attachment` over legacy `connectionKind` field (downstream inspector/status/store reads inherit the change). ✅
- `pergolaAttachmentResolver` deferred to PR-G/H (out of scope — see "Scope trimmed" above).

**Sizing**: ~2.5 days.

**Follow-up (PR-F-2 or rolled into PR-G):** snap engine wiring — `PlanViewport` commit path calls `pergolaAttachmentFromSnap()` to populate `attachment.host.myEdgeIndex` properly. Without this, re-snaps from drag don't fully populate the new shape (current dual-write pattern covers it via legacy field migration on next read). **Shipped as PR-G1 (2026-05-22).**

### PR-G1 — Snap-commit wiring follow-up (PR-F-2) ✅ SHIPPED 2026-05-22

**Closes:** the PR-F follow-up flagged above ("snap engine wiring — `PlanViewport` commit path calls `pergolaAttachmentFromSnap()` to populate `attachment.host.myEdgeIndex` properly").

**Phase 2 dependencies:** None.

**Touches:**
- `apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.tsx:564-606` — the Move-tool pergola commit handler. When `request.snap` is present, derives a `PergolaAttachment` via `pergolaAttachmentFromSnap` (same edgeKind→family routing as the edge-drag handler in `commitOutlineEdit.ts`) and writes it alongside `position` via `commitSharedPergolaEdgeDragResult`.

**What changes:** Move-tool drags that end on a snap target now write the full attachment shape (`spatialKind`, `method`, `host.objectFamily`, `host.objectId`, `host.edgeId`, `host.myEdgeIndex`) instead of only writing `position`. The edge-drag handler already did this — Move tool was the missing path. Undo intentionally leaves the new attachment in place (MoveCommand's inverse delivers `snap: null`, the action's `attachment === undefined` no-op runs). Acceptable per Phase 1 permission.

**Acceptance:**
- Typecheck clean ✅
- Email-quote tests pass (6/6) ✅
- One pre-existing failure in `DesignWorkbenchEstimateClient.test.tsx` "clears them when reverted" — confirmed not caused by PR-G1 (fails identically with PR-G1 stashed).

### PR-G2 — `buildHouseModel3DFromRawHouseInput` drops omnibus `pergolaContext` ✅ SHIPPED 2026-05-22

**Closes:** N4 fully (synthetic pergola context in the house-form reference geometry builder deleted). Partial N8 (the dead-weight underside fields no longer flow through pergola context, but the `connectionType`/`attachmentSide` params in `buildHouseModelConfig` remain until PR-G3 restructures deck-positioning).

**Phase 2 dependencies:** None. Cost engine doesn't call `buildHouseModel3DFromRawHouseInput`; this is purely a workbench-internal pipeline refactor.

**Touches:**
- `packages/geometry/src/houseModel.ts:826-991` — deleted omnibus `HouseModel3DPergolaContext` type. Introduced focused `HouseModel3DPergolaAttachment` containing only the genuine pergola-relationship fields (`connectionType`, `attachmentSide`, `attachmentEdge`, `datum`, `pergolaLengthMm`, `pergolaProjectionMm`). `buildHouseModel3DFromRawHouseInput` now takes per-field params for house-intrinsic data (`footprint`, `housePosition`, `soffitDepthMm`, the three underside heights) and a single nullable `pergolaAttachment` for the relationship data. `null` => freestanding; the function internally substitutes a stub datum + `connectionType: 'freestanding'` + `attachmentSide: 'rear'`.
- `packages/geometry/src/index.ts:44` — export renamed from `HouseModel3DPergolaContext` to `HouseModel3DPergolaAttachment`.
- `apps/portal/lib/drawings/state/buildHouseFormReferenceGeometry.ts` — synthetic pergolaContext stub block deleted. Function now calls `buildHouseModel3DFromRawHouseInput({ rawHouse, footprint, pergolaAttachment: null })`.
- `packages/geometry/src/houseModel.test.ts:3071-3142` — both attached + freestanding tests updated to new call shape.

**What changes:** additional house forms (multi-form scenes — sleepouts, granny flats) no longer fabricate stub `pergolaLengthMm`, `pergolaProjectionMm`, `datum`, and zero-valued underside heights. The freestanding case is now first-class: pass `pergolaAttachment: null`. The attached case keeps the same fields it always needed, but in a clearly-named sub-object so its purpose is obvious at call sites.

**Acceptance:**
- Typecheck clean ✅
- Geometry suite: 352/352 passed ✅
- Portal workbench: 468 passed + 6 PR-B-era skips (no new failures) ✅
- Email-quote tests: 6/6 ✅
- `composeAdditionalHouseFormsIntoScene` (audit row N10) untouched — deferred to PR-G3 where the per-pergola scene loop becomes per-project.

### PR-G3a — Scene lifting: project-level additional house models ✅ SHIPPED 2026-05-22

**Closes:** N9 (viewer's scene builder now iterates project-level additional house models, not just the active pergola's host). N10 (portal-layer `composeAdditionalHouseFormsIntoScene` workaround deleted; geometry build moved to a single project-level pass).

**Phase 2 dependencies:** None. Cost engine doesn't read solved scenes; this is a pure workbench-internal scene-composition fix. Verified via scope investigation: `apps/marketing/app/api/enquiry/route.ts:5` imports only `calculateCostV1` from `@sp/costing`, and `packages/costing/src/engine/calculate.ts:549` iterates `inputs.modules[]` without touching `WorkbenchSolvedModule`.

**Touches:**
- `packages/geometry/src/viewer.ts` — `buildLayers(assembly, additionalHouseModels)` and `buildViewerSceneModel(assembly, options?)` now accept an optional `additionalHouseModels: ReadonlyArray<HouseModel3D>`. Iterated inside `buildLayers`; each renders with `attachmentTarget: null` (additional forms aren't pergola-attached). Second arg is optional → all 30+ existing geometry-package test call sites stay valid.
- `packages/geometry/src/index.ts` — new `BuildViewerSceneModelOptions` type export.
- `apps/portal/lib/drawings/state/workbenchSolvedModel.ts` —
  - Deleted `composeAdditionalHouseFormsIntoScene` (O(M×F) per-module workaround, ~26 lines).
  - New `buildProjectNonHostHouseModels(projectModel)` runs ONCE at the top of `buildWorkbenchSolvedModel` and returns the list of non-host `HouseModel3D`s.
  - `buildSolvedModule` accepts `projectHouseModels`; `buildViewerSceneFromSolvedGeometry` threads it to `buildViewerSceneModel` via the geometry package's `additionalHouseModels` option.
  - Dropped unused imports (`buildHouseModelSceneObjects`, `ViewerSceneObject`); added `HouseModel3D` import.

**What changes:** Multi-form scenes (sleepouts, granny flats alongside a pergola) used to rebuild additional-form geometry **once per pergola module** (O(M×F) work). Now built once per project, shared across all modules. Same visual output, identical fixture-test results — the viewer's `house` layer still includes the additional forms, just composed inside the scene builder instead of patched in afterwards.

**What temporarily breaks:** Nothing observed. Scope investigation found no tests asserting per-module duplicate house geometry; all 468 workbench tests + 352 geometry tests pass unchanged.

**Acceptance:**
- Typecheck clean ✅
- Geometry suite: 352/352 ✅
- Portal workbench: 468 passed + 6 PR-B-era skips, no new failures ✅
- Email-quote tests: 6/6 ✅

### PR-G3b — Project-level decks/openings pre-pass ✅ SHIPPED 2026-05-22

**Closes:** audit row 9 in production-path spirit. The workbench solve no longer remaps the same project-level decks/openings once per pergola module; it computes them once at the top of `buildWorkbenchSolvedModel` and threads pre-built arrays through to the per-module raw-input builder. The deeper structural split (a separate `RawGeometryProjectInput` type distinct from `RawGeometryModuleInput`, with geometry consumers reading decks/openings from the project type) is deferred until the geometry package's `buildHouseModelConfig` is also restructured (see PR-G3c).

**Phase 2 dependencies:** None confirmed (per PR-G3a + PR-G3b scope investigations). Cost engine reads `CostInputsV1` per module without touching `RawGeometryModuleInput`.

**Touches:**
- `apps/portal/lib/drawings/geometry/buildRawGeometryModuleInput.ts` — `buildRawGeometryModuleInput` gains optional `projectDecks` + `projectOpenings` params. When passed, used directly; when omitted, falls back to internal `mapDecks(projectModel)` / `mapOpenings(projectModel)` (test-convenience default). New exported helpers `mapProjectDecks` / `mapProjectOpenings` so the workbench can compute once.
- `apps/portal/lib/drawings/geometry/deriveWorkbenchGeometry.ts` — accepts the same pair of optional params and forwards them through to `buildRawGeometryModuleInput`.
- `apps/portal/lib/drawings/state/workbenchSolvedModel.ts` — `buildWorkbenchSolvedModel` pre-computes `projectDecks` + `projectOpenings` once before the per-module loop; `buildSolvedModule` accepts the pair and threads to `deriveWorkbenchGeometry`.
- `objectWorkbenchGeometryEditAdapterCore.ts` (single-call site) keeps using the internal fallback (only one call, not a loop — no gain from threading).

**What changes:** projects with M pergola modules used to call `mapDecks(projectModel)` and `mapOpenings(projectModel)` M times — same input, same output, all wasted. Now called once per project. The geometry package's downstream readers (`normalize.ts:533` for decks, `normalize.ts:653` for openings) see the same data shape.

**Acceptance:**
- Typecheck clean ✅
- Geometry suite: 352/352 ✅
- Portal workbench: 468 passed + 6 PR-B-era skips, no new failures ✅
- Email-quote tests: 6/6 ✅

### PR-G3c — `buildHouseModelConfig` drops `connectionType`/`attachmentSide` params ✅ SHIPPED 2026-05-22

**Closes:** remaining N8 — `buildHouseModelConfig` no longer accepts pergola-context inputs. The function is now pure house data: footprint, eave heights, raw house context, and a pre-resolved `attachmentStrategy`. Both upstream consumers of the function resolve `attachmentStrategy` themselves (the logic that needed `connectionType` for fallback now lives at the caller, where `connectionType` already exists).

**Phase 2 dependencies:** None. Cost engine doesn't call `buildHouseModelConfig`.

**Touches:**
- `packages/geometry/src/normalize.ts`:
  - `buildHouseModelConfig` signature drops `connectionType` and `attachmentSide`. Gains `attachmentStrategy: HouseAttachmentStrategy` (pre-resolved by caller).
  - Internal `deckFrame` now standardizes on `'rear'` (matches the post-Stage-4.5 standardization already used for position-set decks). Legacy un-migrated decks that were attached to a non-rear pergola decode against the standardized frame instead of the host's attachmentSide — they re-migrate to position-based on first edit.
  - Output `attachmentStrategy` field is the passed-in pre-resolved value (no internal `resolveHouseAttachmentStrategy` call).
  - `resolveHouseAttachmentStrategy` exported so the other caller can reuse the same fallback logic.
  - In-file caller (`normalizeGeometryConfig`) passes the already-resolved `houseAttachmentStrategy` (computed at lines 835-838) directly.
- `packages/geometry/src/houseModel.ts`:
  - `buildHouseModel3DFromRawHouseInput` pre-resolves `attachmentStrategy` via `resolveHouseAttachmentStrategy(rawHouse.attachmentStrategy ?? null, connectionType)` and passes through.
  - Imports `resolveHouseAttachmentStrategy` alongside `buildHouseModelConfig`.
- `packages/geometry/src/normalize.test.ts`:
  - "LEGACY (no position): deck shifts when host attachmentSide changes — known coupling" test renamed to "LEGACY (no position): deck stays put when host attachmentSide changes — PR-G3c decoupling". Assertion flipped from `not.toBeCloseTo` to `toBeCloseTo` — the legacy coupling is intentionally gone.

**What changes:** `buildHouseModelConfig` is now genuinely house-only. Audit row N8's "config carries pergola dims" coupling is closed at this entry point (downstream `HouseModelConfig` consumers still read `houseContext.attachmentStrategy` etc., but those flow from the cleaner inputs).

**What temporarily breaks (acceptable per Phase 1 permission):** Legacy un-migrated decks attached to non-rear sides decode against a standardized `'rear'` frame instead of their original attachmentSide. Visible as a one-time shift in plan/3D viewport rendering for unedited decks; first edit re-migrates the deck to its first-class `position` field and locks the world coords in.

**Acceptance:**
- Typecheck clean ✅
- Geometry suite: 352/352 (legacy-coupling test updated to assert the decoupling) ✅
- Portal workbench: 468 passed + 6 PR-B-era skips, no new failures ✅
- Email-quote tests: 6/6 ✅

### PR-H — Final cleanup sweep: delete `houseFirstWorkbenchModel.ts`, retire compat namespace, geometry pruning

**Closes:** N5 (final cleanup of model file once all types unused), N13 fully (`EstimateDrawingDraft.houseFirst` slot deleted), audit row 1 (`houseFootprintSideLocalToWorldPolygon` deletion).
**Phase 2 dependencies:** None — this is pure cleanup of dead-after-PR-D/E/F surface.
**Prereqs:** PR-D, PR-E, PR-F all shipped (those PRs delete the individual `HouseFirst*` types as their adapters migrate).
**Touches:** delete `houseFirstWorkbenchModel.ts` once the file is empty / only type aliases remain, delete `state/compat/` directory if empty, delete `houseFootprintSideLocalToWorldPolygon` and friends from `footprints.ts`, delete `EstimateDrawingDraft.houseFirst` field, delete any `LEGACY_PRIMARY_HOUSE_FORM_ID` references that survived earlier PRs.
**What changes:** the legacy namespace is gone. Search for `houseFirst` and `LEGACY_PRIMARY` should return zero hits outside of historical decision-log entries.

**Risk:** the previous PRs should have made every consumer of these types either delete or migrate. This PR is the cleanup sweep that verifies nothing depended on them via dead-code paths.

**Acceptance:** `grep -r "houseFirst\|LEGACY_PRIMARY" apps/portal packages` returns empty. All tests pass. Marketing-site enquiry email still works.

### PR-I — Fix the `ModelSpaceViewport` failures (now unblocked)

**Closes:** N12, the 8 stale-fixture failures from the 2026-05-21 decision log entry.
**Phase 2 dependencies:** None.
**Touches:** `ModelSpaceViewport.tsx` (now imports object-first types only after PR-H), the `as unknown as Parameters<typeof buildPlanViewModel>[0]` casts in `ModelSpaceViewport.test.tsx`.
**What changes:** legacy imports gone, `objectWorkbenchOverlayInput` migrated.

**Risk:** small. This was deferred because the underlying types were in flux.

**Acceptance:** 8 viewport tests green. 0 import-guard failures. Test signal fully clean for the first time since PR8b.

---

## Acceptance criteria for Phase 1 (all of PR-A through PR-I shipped)

- `grep -r "LEGACY_PRIMARY\|houseFirst\|hostHouseFormId" apps/portal packages` returns empty (outside docs / historical decision-log entries).
- Marketing-site enquiry → email path verified end-to-end with a test fixture. **This is the only user-facing output that must be preserved.**
- Multi-form integration tests pass with snap-driven attachment (no `hostHouseFormId` field).
- Test signal clean: 0 unexpected failures across `apps/portal` + `packages` (fixtures updated alongside PRs, not preserved as byte-identical).
- The architecture doc's "Legacy compat sites" audit table has all rows marked `[done]`.

**Explicitly NOT required:**
- Byte-identical project models against legacy fixtures (the byte-identity rule was self-imposed and is retired).
- Workbench UX continuity during Phase 1 (rebuilt cleanly on the new foundation as part of PR-F + PR-G).

---

## How to use this doc

- Each PR proposal must cite which row(s) of this plan it closes (e.g., "PR-D — closes N1 + audit rows 2,3,4").
- New legacy patterns discovered mid-PR get added to the "New cull candidates" table with a fresh `N##` id before the PR ships.
- This doc retires when Phase 1 ships. At that point it gets archived in `docs/decision-log.md` as a single entry ("Phase 1 cull complete — link to PR list") and deleted from `docs/`. We do not keep dead working docs.
