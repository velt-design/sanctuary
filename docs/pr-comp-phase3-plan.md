# PR-COMP-PHASE3 — Composition-First House Authoring + Geometry Routing

**Drafted**: 2026-06-18. **Status**: planning. Phase 3 of the [house composition migration](house-composition-vision.md). Sits on top of [PR-COMP1](pr-comp1-plan.md) (composition geometry) and [PR-COMP-PHASE2](pr-comp-phase2-plan.md) (composition data model).

## 1. Goal

Make every new house form composition-first: `Add structure` populates `composition` alongside the legacy footprint polygon; the geometry router consumes composition (via `composeRoofFromComposition`) when present; house forms snap to each other in the plan; the free-form `Draw outline` UI is removed (legacy free-form forms keep rendering via the existing pipeline as a read-only path).

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

[`docs/design-workbench-architecture.md`](design-workbench-architecture.md) "House Input Is Composed, Not Drawn" — Phase 2 added the data model; Phase 3 makes it the AUTHORING model (every new form is composition-first) and the RENDER model (geometry router consumes composition data). After Phase 3, the only way to get a non-composition house form is to load a legacy free-form one — no new code path creates them.

### What alternatives were considered, and why rejected?

1. **Ship UX-only Phase 3 first (without geometry routing).** Tempting because the UX changes are smaller and lower-risk. *Rejected:* populating `composition` on new forms while the router still uses the legacy pipeline means we ship data nothing consumes. The composition data sits inert. Better to ship the loop end-to-end so the field has real consumers from day one.
2. **Add a separate "Rectangle tool" alongside `Add structure`.** User's earlier framing. *Rejected (per user clarification today):* `Add structure` already creates a rectangle the user can resize. No new tool needed — just modify `Add structure` to populate `composition` matching the rectangle.
3. **Snap house forms only at drag-start (single-shot align).** Cheaper than continuous snap. *Rejected:* the pergola-to-house snap is continuous (snap targets show during drag), so the workbench's UX vocabulary expects continuous snap. House-to-house snap should match that pattern for consistency.
4. **Hide `Draw outline` behind a "legacy mode" toggle instead of removing it.** *Rejected:* the vision explicitly retires free-form authoring. Keeping it behind a toggle creates two paths to maintain forever; removing it cleanly signals the direction.
5. **Migrate all existing free-form house forms to compositions on first load.** *Rejected:* per the vision, legacy data stays as-is. Compositions only land for forms authored after Phase 3.

### What does this consciously NOT try to do?

- **NOT add Join / Detach operations.** Phase 4 work — Phase 3 ships single-rectangle compositions only. Multi-rectangle compositions need the explicit join UX (multi-select + Join button), which is its own design conversation.
- **NOT build the unified-topology solver.** The stitched per-rectangle solver from PR-COMP1 is the v1 geometry. Single-rectangle composites render identically to the legacy single-rectangle path (both route to `buildRectangularRoof` on the same dimensions), so Phase 3 is a no-op visually for the most common case — it just changes the data shape under the hood.
- **NOT migrate legacy free-form house forms.** They keep rendering via the existing pipeline; no UI to edit their polygons (because Draw outline is gone) but they remain visible.
- **NOT change the rail's roof intent UX.** The per-rectangle `RectangleRoofIntent` shape mirrors the existing `HouseFormRoofIntentModel`; the rail's existing controls work unchanged for single-rectangle compositions.
- **NOT touch pergola/deck/opening snap.** House-to-house snap is added alongside the existing snap sources, not replacing them.

### Net tech debt: pay down or add?

Net pay-down by Phase 3 + 4 combined. Removes the `Draw outline` UI path (~200 LOC of polygon-drawing tooling becomes dead code). Adds the geometry router shim (~150 LOC) and the house-to-house snap extension (~80 LOC). Phase 3 alone is roughly neutral; the real LOC reduction comes when the legacy free-form solvers in `@sp/geometry` can eventually be deleted (years out, when zero legacy forms remain — Phase 6 in the vision).

## 3. The new model

### Add structure (modified)

`addHouseFormToObjectFirstDraft` (in [objectFirstWorkbenchAdapter.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchAdapter.ts)) gains a step: after constructing the new form, populate its `composition` with a single-rectangle `HouseComposition` derived from the form's footprint dimensions + roof intent.

```ts
// Pseudocode for the new step:
const compositionRectangle: AxisAlignedRectangle = {
  kind: "axisAlignedRectangle",
  originXMm: 0,
  originYMm: 0,
  widthMm: footprintWidthMm(nextForm),
  depthMm: footprintDepthMm(nextForm),
  roofIntent: convertHouseFormRoofIntent(nextForm.roofIntent),
};
nextForm.composition = { primitives: [compositionRectangle], joins: [] };
```

`convertHouseFormRoofIntent` is a small adapter from the workbench's `HouseFormRoofIntentModel` (form + material + primaryPitchDeg as string + …) to the geometry's `RectangleRoofIntent` (form + pitchDeg as number + …). The two shapes carry the same conceptual data with slightly different vocabularies.

Existing free-form house forms loaded from legacy drafts keep `composition: undefined` and use the legacy path unchanged.

### Geometry router

`buildHouseFormGeometryInputForForm` (in [houseFormGeometryInput.ts](../apps/portal/lib/drawings/state/houseFormGeometryInput.ts)) currently calls `buildHouseModel3DFromRawHouseInput`. Phase 3 adds a branch:

```ts
// Pseudocode:
if (houseForm.composition) {
  return buildHouseModel3DFromComposition({
    composition: houseForm.composition,
    eaveHeightMm,
    // … walls/eaves/openings derived from the composite footprint via existing helpers
  });
}
// Legacy path unchanged
return buildHouseFormGeometryInputForForm(houseForm);
```

`buildHouseModel3DFromComposition` is a new function in `@sp/geometry` (parallel to `buildHouseModel3DFromRawHouseInput`). It:
1. Computes the composite footprint via `composeFootprintFromComposition`
2. Builds walls/eaves/openings from the composite footprint using the same helpers `buildHouseModel3DFromRawHouseInput` uses (refactor those into a shared inner if needed)
3. Computes the roof via `composeRoofFromComposition` (from PR-COMP1)
4. Stitches the result into a `HouseModel3D`

The seam needs careful surgery — `buildHouseModel3DFromRawHouseInput` is monolithic. The cleanest approach is to factor out a shared "build everything except the roof" helper and call it from both paths.

### Remove Draw outline UI

The `Draw outline` tool is invoked from inside the workbench inspector / toolbar. Phase 3:
- Removes the UI affordance (button / menu entry)
- Removes the `drawOutlineMode` prop and related state from `WorkbenchViewportHost.tsx` / `DrawingWorkbench.tsx`
- Removes any keyboard shortcuts that triggered it
- Leaves the underlying polygon-edit machinery in place — legacy forms still need their polygons readable (HouseFormModel.footprint.polygon is the source of truth when composition is absent), just not editable from the UI

### House-to-house snap

Currently `snapSources.house: WorkbenchProjectHouseSnapSource[]` (in [workbenchSolvedProjectArtifact.ts](../apps/portal/lib/drawings/state/workbenchSolvedProjectArtifact.ts)) is consumed by pergola drag. Phase 3 extends it so house-form drag (in PlanViewport, when a house is selected and being moved) snaps to OTHER house forms' eave edges. The mechanics:
- During a house-form drag, query the snap sources MINUS the form being dragged
- Compute candidate snap positions where the dragged form's edges would align with other forms' edges
- Show snap preview chrome (matches pergola's existing snap visualization style)
- On drop, commit the snapped transform

The snap respects both edge-to-edge alignment AND corner-to-corner alignment.

## 4. File map

| File | Change | LOC est |
|---|---|---|
| `apps/portal/lib/drawings/state/objectFirstWorkbenchAdapter.ts` | `addHouseFormToObjectFirstDraft` populates `composition`. New `houseFormRoofIntentToRectangleRoofIntent()` adapter. | +60 |
| `apps/portal/lib/drawings/state/objectFirstWorkbenchAdapter.test.ts` (extend) | New tests: Add structure produces composition; cloning preserves composition; legacy forms (no composition) still work. | +80 |
| `packages/geometry/src/house/buildHouseModel3DFromComposition.ts` (NEW) | New `@sp/geometry` entry point for composition-driven house models. | +120 |
| `packages/geometry/src/house/buildHouseModel3DFromComposition.test.ts` (NEW) | Tests: single-rectangle composition produces the same `HouseModel3D` shape as the legacy path on identical input; multi-rectangle composition (fused) routes correctly; multi-rectangle stitched produces composite with correct wall/eave perimeter. | +180 |
| `packages/geometry/src/house/houseModel.ts` (refactor) | Factor out a shared "walls + eaves + envelope" helper that both `buildHouseModel3DFromRawHouseInput` and `buildHouseModel3DFromComposition` call. Public API unchanged. | +50 / -40 |
| `packages/geometry/src/index.ts` | Export the new entry point. | +3 |
| `apps/portal/lib/drawings/state/houseFormGeometryInput.ts` | Dispatch on `composition` presence. | +20 |
| `apps/portal/lib/drawings/state/houseFormGeometryInput.test.ts` (extend) | Tests: composition-bearing form routes to new path; legacy form routes to existing path. | +60 |
| `apps/portal/components/drawings/workbench/WorkbenchViewportHost.tsx` | Remove `drawOutlineRequestId` / `drawOutlineMode` / `drawOutlineSeedPolygon` props + related state propagation. | -25 |
| `apps/portal/components/drawings/workbench/DrawingWorkbench.tsx` | Same removals. | -25 |
| `apps/portal/components/drawings/rail/` (relevant inspector files) | Remove `Draw outline` button + menu entry + related field errors. | -40 |
| `apps/portal/lib/drawings/state/workbenchSolvedProjectArtifact.ts` | Snap sources now include house-form-perimeter edges from ALL house forms (not just pergola targets). | +30 |
| `apps/portal/components/drawings/viewports/PlanViewport/` (interaction layer) | Wire house-form drag to query snap sources + apply snap preview + commit snapped transform. | +120 |
| `apps/portal/components/drawings/viewports/PlanViewport/canvas/snapPreview.tsx` (or equivalent) | Render snap preview chrome for house-to-house alignment. | +60 |
| Snap interaction tests | New tests: house-to-house edge snap; corner snap; no-self-snap. | +120 |
| [docs/decision-log.md](decision-log.md) | New PR-COMP-PHASE3 entry + index row. | +30 |

**Total**: ~960 LOC. Production source delta ~430 LOC (much of which is removal of Draw outline). Tests ~440 LOC.

## 5. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Single-rectangle composition produces a different render than the equivalent legacy single-rectangle form (visual regression for new house forms). | Med | Both paths route to `buildRectangularRoof` on the same dimensions. Add a test that takes the SAME input + roof intent through both paths and asserts the resulting `roofPlanes` / `roofFeatures` are byte-equivalent. |
| `buildHouseModel3DFromComposition` produces walls/eaves that differ subtly from `buildHouseModel3DFromRawHouseInput` because they're built from different code paths. | High | The factor-out step is the mitigation: both entry points call the SAME shared helper for walls/eaves/envelope. Only the roof differs (which is the whole point of the new path). |
| Removing Draw outline breaks edits on existing legacy free-form house forms that designers were mid-edit on. | Low | Legacy forms with `composition: undefined` retain their persisted polygon and render correctly. They're no longer editable via Draw outline, but their geometry stays intact. If a designer NEEDS to edit a legacy form, they'd delete + recreate as composition. |
| House-to-house snap performance — N^2 edge comparison as the number of house forms grows. | Low | Cap snap query at ~10 house forms before degrading to AABB-only. Current projects have 1-3 house forms; the cap is room-to-grow. |
| Snap preview chrome conflicts visually with pergola snap preview when both are active. | Low | Family-aware snap preview: house-snap shows only when a house is dragged; pergola-snap shows only when a pergola is dragged. Mutually exclusive UI states. |
| The geometry router branches in `houseFormGeometryInput` but downstream consumers (`HouseFormGeometryInputResult.diagnostics`) expect the legacy diagnostics shape. | Med | The composition path produces the same `HouseFormGeometryInputResult` shape; diagnostics fields default to "ok" / `composition_path` for fields that don't apply to the new path. Add explicit test asserting diagnostics shape. |
| `houseFormRoofIntentToRectangleRoofIntent` loses information (e.g., openGableEndIds → startCap/endCap mapping). | Med | The mapping is well-defined: per-end open_gable IDs translate to `startCap` / `endCap` choices using the same logic the legacy `buildHippedHouseRoof` already uses (`openGableEndIds.includes('start')` → `startCap: 'open_gable'`). Unit test asserts round-trip. |

## 6. Acceptance criteria

- Portal typecheck clean.
- Geometry typecheck clean.
- Lint clean (including docs-guard).
- `composeRoofFromComposition` is invoked when a house form has `composition`; legacy `buildHouseModel3DFromRawHouseInput` invoked otherwise.
- `Add structure` produces a composition-bearing house form (verified by test).
- Existing single-rectangle house forms render identically pre- and post-PR (verified by snapshot equivalence test).
- `Draw outline` button / menu / shortcut absent from the workbench UI (verified by component test).
- Legacy free-form house forms still render correctly (composition absent → legacy path runs).
- House-to-house snap demonstrably aligns one form's edge to another's during drag (verified by interaction test).
- `marketing` build clean (HARD GATE — no marketing changes expected, but the gate catches accidental cross-app imports).
- Decision-log entry + index row.

## 7. Estimates

| Stage | LOC | Risk | Est time |
|---|---|---|---|
| `Add structure` populates composition + adapter | ~140 | Low | 2-3 hrs |
| `buildHouseModel3DFromComposition` + walls/eaves refactor | ~190 | Med (the surgical part) | 5-7 hrs |
| Geometry router dispatch + tests | ~80 | Low | 2-3 hrs |
| Remove `Draw outline` UI (multiple files) | ~90 removed | Low | 2-3 hrs |
| House-to-house snap (interaction + preview + tests) | ~330 | Med (interaction state is the tricky bit) | 6-8 hrs |
| Decision-log + integration testing + lint | ~30 | Low | 1-2 hrs |
| **Total** | **~960 (incl. tests)** | **Med** | **2-3 focused days** |

## 8. Sequencing

```text
PR-COMP-PHASE2 (shipped) ──→ PR-COMP-PHASE3 (this) ──→ Phase 4 (Join/Detach UX)
                                    │
                                    └──→ PR-COMP-UNIFIED (independent geometry investment)
```

Phase 3 unblocks Phase 4 (which needs `Add structure` to be producing compositions in order to compose them via Join).

## 9. What I'd push back on

- **The temptation to ship the geometry router separately from the UX.** UX-only Phase 3 means populating `composition` on new forms while the router still ignores it — composition data sits inert. Better to ship the loop closed even though it makes the PR bigger.
- **The temptation to do the unified-topology solve in Phase 3 to "finally fix" Hip+Hip L composites.** That's PR-COMP-UNIFIED, a separate (and bigger) investment. Phase 3 ships the stitched per-rectangle solver from PR-COMP1; multi-rectangle composites render as approximate via the existing amber-tint diagnostic.
- **The temptation to migrate legacy free-form forms.** Vision is explicit: legacy stays as-is.

## 10. CTA

Say **"go phase 3"** to execute. I'll commit incrementally — stage by stage so you can pause:
  1. `Add structure` produces composition (smallest unit, safe to ship alone)
  2. Geometry router (composition consumed)
  3. Remove Draw outline UI
  4. House-to-house snap

Or say **"split phase 3"** if you'd rather land each stage as its own commit/PR with separate gates.
