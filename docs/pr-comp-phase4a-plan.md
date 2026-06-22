# PR-COMP-PHASE4a — Multi-Rectangle Geometry + Detach Action

**Drafted**: 2026-06-18. **Status**: planning. First half of Phase 4 of the [house composition migration](house-composition-vision.md). Sits on top of [PR-COMP-PHASE3](pr-comp-phase3-plan.md) (composition is populated, consumed for single-rectangle, snap is wired).

## 1. Goal

Make multi-rectangle compositions render correctly end-to-end (walls/eaves/openings/roof all derived from the composition's union footprint) and ship a pure `detachHouseFormAtSeam` primitive in `@sp/geometry` that the seam-icon UX in PR-COMP-PHASE4b will call. No designer-visible UI in 4a — invisible infrastructure that unblocks 4b.

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

[`docs/house-composition-vision.md`](house-composition-vision.md) architectural rule 3 — "Join and Detach are pure functions" — and rule 5 — "Terminal end ids are deterministic from the composite perimeter." Phase 3 closed the single-rectangle loop; 4a is what makes the multi-rectangle loop work. Until 4a lands, no PR can author a multi-rectangle composite and trust that it renders correctly, which means Join (4b) has nowhere to land its output.

### What alternatives were considered, and why rejected?

1. **Ship Detach UX in 4a alongside the geometry.** Per the user UX conversation, a small icon on every internal seam triggers Detach. *Rejected (for 4a):* nothing currently authors a multi-rectangle composite, so the icons would never appear in any production project until 4b ships. Shipping orphaned UI in 4a then immediately depending on it in 4b doubles the review surface for no benefit. UX lands in 4b alongside Join, where both icons share the seam-position math.
2. **Build a dedicated `buildHouseModel3DFromComposition` parallel to `buildHouseModel3DFromRawHouseInput`.** Cleaner code separation. *Rejected:* doubles the wall/eave/opening code path forever; we'd then need to keep them in sync. The Phase 3.2 pattern (legacy pipeline + composition-driven swap) is the lighter touch and stays consistent with what's already shipped.
3. **Ship only the geometry pipeline in 4a, defer the pure `detachHouseFormAtSeam` function to 4b.** Smallest possible 4a. *Rejected:* the pure function is small (~40 LOC + tests), has zero UI dependency, and writing it now lets 4b be a pure UX PR (icon + click handler + dispatch). Splitting the geometric Detach from the visual Detach keeps each PR's concern single.
4. **Detach the entire composite at once (all seams break, N rectangles emit).** Vision-doc-compatible. *Rejected in favor of per-seam detach:* the seam-icon UX implies per-seam — one icon per internal join, click breaks just that seam. Per-seam detach is also a strict superset (clicking every icon in sequence = exploding the composite), so we can express the simpler operation in terms of the per-seam one without ever needing a separate "explode" path.

### What does this consciously NOT try to do?

- **NOT ship the seam-icon UI.** That's 4b's job. 4a is invisible infrastructure.
- **NOT ship the Join operation.** Same — 4b. 4a only handles Detach because Detach is the half that requires multi-rectangle geometry to already work.
- **NOT touch the unified-topology roof solver.** Phase 3 ships the stitched per-rectangle solver from PR-COMP1; 4a inherits it. Multi-rectangle composites render via the stitched path with the existing amber-tint diagnostic for non-fused composites. PR-COMP-UNIFIED is the dedicated investment if/when designers demand the proper Hip+Hip L topology.
- **NOT migrate existing legacy free-form forms to compositions.** Vision is explicit: legacy stays as-is.
- **NOT change the rail's inspector for composites.** A composite-aware rail (e.g. listing constituent rectangles, per-rectangle roof intent edit, etc.) is its own design conversation. Phase 4a renders composites correctly but the rail treats them as one house form — same controls, single roof intent applied to all rectangles.

### Net tech debt: pay down or add?

Net add, but justified by closing a half-built loop. Phase 3.2 already left a Phase-4 TODO in `swapRoofFromComposition` ("Phase 4 swaps walls/eaves for multi-rectangle composites"); 4a is what discharges that debt. The `detachHouseFormAtSeam` primitive adds ~50 LOC of new pure-function code, but the geometry-pipeline change is a substitution (composition's union polygon replaces preset-derived polygon), not a parallel path — so the long-term maintenance surface barely grows.

## 3. The new model

### Geometry pipeline change

`buildHouseFormGeometryInputForForm` (Phase 3.2 introduced the dispatch) currently:
```ts
const legacyModel = buildHouseModel3DFromRawHouseInput({ rawHouse, footprint, ... });
const model = houseForm.composition
  ? swapRoofFromComposition({ houseForm, legacyModel, composition })  // ROOF only
  : legacyModel;
```

4a extends the swap with a `swapFootprintFromComposition` step that runs FIRST (before `buildHouseModel3DFromRawHouseInput`) and substitutes the composition's union polygon for the preset-derived footprint when the composition has 2+ primitives:

```ts
// Phase 4a addition (pseudo-code):
const compositionUnion = houseForm.composition && houseForm.composition.primitives.length > 1
  ? composeFootprintFromComposition(houseForm.composition)
  : null;
const footprintForLegacy = compositionUnion
  ? buildFootprintFromCompositionUnion(compositionUnion)  // wrap polygon in legacy shape
  : rawGeometry.footprint;
const legacyModel = buildHouseModel3DFromRawHouseInput({
  rawHouse: rawGeometry.rawHouse,
  footprint: footprintForLegacy,
  pergolaAttachment: null,
});
// Phase 3.2 roof swap continues unchanged
const model = houseForm.composition
  ? swapRoofFromComposition({ houseForm, legacyModel, composition: houseForm.composition })
  : legacyModel;
```

Single-rectangle composites (`primitives.length === 1`) skip the swap and use the legacy preset footprint — byte-equivalent to Phase 3.2 (and verified by the existing equivalence test).

### Pure `detachHouseFormAtSeam` primitive

New export in `@sp/geometry/house/composition`:

```ts
export type DetachResult =
  | { ok: true; partitions: HouseComposition[] }
  | { ok: false; error: 'invalid_join_index' | 'composition_disconnects_into_more_than_two' };

export function detachHouseFormAtSeam(input: {
  composition: HouseComposition;
  joinIndex: number;
}): DetachResult;
```

Algorithm: build the primitive adjacency graph from `composition.joins`, remove the join at `joinIndex`, run connected-components on the remaining graph. Returns one `HouseComposition` per connected component. For a 2-primitive composite with 1 join, returns 2 single-primitive compositions. For a 3-primitive composite with 2 joins, removing the middle join returns 2 compositions (1+2 primitives).

The error union is closed so callers exhaustively handle the 2 failure modes. `composition_disconnects_into_more_than_two` is reserved for future N-primitive composites where one seam might not exist as a single connectivity link — for v1's 2- and 3-primitive composites it can't fire, but the type leaves room.

### What 4a does NOT add to the contract

- No `joinHouseForms` — 4b's job
- No workbench action wiring (`useObjectWorkbenchActions` is untouched)
- No selection-state changes
- No UI components

## 4. File map

| File | Change | LOC |
|---|---|---|
| `packages/geometry/src/house/composition/detachHouseFormAtSeam.ts` (NEW) | Pure function; adjacency-graph BFS; returns partitioned compositions | +120 |
| `packages/geometry/src/house/composition/detachHouseFormAtSeam.test.ts` (NEW) | Tests: 2-primitive split, 3-primitive chain split (front/middle/back joins), invalid index, output validates via `validateHouseComposition` | +180 |
| [packages/geometry/src/house/composition/index.ts](../packages/geometry/src/house/composition/index.ts) | Export `detachHouseFormAtSeam` + `DetachResult` | +3 |
| [apps/portal/lib/drawings/state/houseFormGeometryInput.ts](../apps/portal/lib/drawings/state/houseFormGeometryInput.ts) | Insert composition-footprint substitution step before `buildHouseModel3DFromRawHouseInput`; gated on `composition.primitives.length > 1` | +60 |
| [apps/portal/lib/drawings/state/houseFormCompositionRender.test.ts](../apps/portal/lib/drawings/state/houseFormCompositionRender.test.ts) | New tests: hand-author a 2-primitive L composition, verify walls follow the union polygon (not any single rectangle), verify byte-equivalence preserved for single-rectangle path | +120 |
| [apps/portal/lib/drawings/state/houseFormCompositionFootprint.ts](../apps/portal/lib/drawings/state/houseFormCompositionFootprint.ts) | Add `buildLegacyFootprintFromCompositionUnion(composition)` helper — wraps the union polygon in the legacy `HouseFootprintLikeInput` shape so `buildHouseModel3DFromRawHouseInput` consumes it as-is | +40 |
| Companion test for the helper | Tests: single-rectangle pass-through, L-shape composition union, T-shape, fused-rectangle composition (production should never see this, but defensive) | +80 |
| [docs/decision-log.md](decision-log.md) | New PR-COMP-PHASE4a entry + index row | +30 |

**Total**: ~630 LOC. Production source delta ~220 LOC; tests ~380 LOC; docs ~30 LOC.

## 5. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| The composition's union polygon (returned by `composeFootprintFromComposition`) doesn't match the shape the legacy wall builder expects (vertex ordering, winding, closure convention). | Med | The helper file (`buildLegacyFootprintFromCompositionUnion`) is the seam. Tests assert the union polygon has the same winding + closure as a preset-derived L footprint; if it doesn't, normalize inside the helper. Risk surfaces in the unit tests before reaching the integration path. |
| Inside corners on the union polygon (L / T / U) break the legacy wall builder. | Low | Legacy wall builder already handles L / T / U preset footprints — that path has been live for the entire project's lifetime. The union polygon is the same shape category, just authored via composition instead of preset params. |
| Single-rectangle composites silently change their wall output because the substitution gate (`primitives.length > 1`) flips for some edge case. | Low | The existing Phase 3.2 byte-equivalence test (`houseFormCompositionRender.test.ts`) pins single-rectangle behaviour. The 4a gate is `> 1` (strict), so single-rectangle composites can never enter the new branch. Test stays green = invariant holds. |
| `detachHouseFormAtSeam` produces partitions whose `joins[].fromPrimitiveIndex` / `toPrimitiveIndex` still reference the original composite's indexing instead of the new partition's. | High (easy bug to write) | The function MUST renumber `primitiveIndex` fields in each partition to match the partition's new `primitives` array. Tests assert `validateHouseComposition` returns `ok: true` on every partition — that catches stale indices because the validator checks index bounds. |
| Openings on a composite house form get orphaned when the geometry pipeline rebuilds walls from a different footprint. | Med | Openings live on `houseForm.openings` (or equivalent) and are positioned in form-local coordinates. The composition union polygon shares the same form-local origin as the preset footprint did, so openings continue to project onto whichever wall they were anchored to. Add a focused test: hand-author a composite with an opening on a wall that exists in both the legacy preset polygon and the union polygon; verify the opening still renders. |
| Inspector / rail action for "Remove this house form" silently breaks when applied to a composite because the assembly's `removeSharedHouseForm` flow assumes a single-rectangle form. | Low | `removeSharedHouseForm` operates on the form's `id`, not its composition. The composite IS still one form with one id; removal works at the assembly level. Verify with an existing state-lane test. |
| The roof swap (Phase 3.2's `swapRoofFromComposition`) on a multi-rectangle composite generates plane ids that collide with each other (rectangles share `idSuffix: 'rectN'`). | Already handled | `composeRoofFromComposition` already appends `--rect1`, `--rect2`, etc. ids per primitive (`solveSingleRectangle` line 168). No new collision risk. |

## 6. Acceptance criteria

- Portal typecheck clean.
- Geometry typecheck clean.
- ESLint clean.
- Docs-guard clean.
- All existing state-lane tests stay green (518 + new ones for 4a).
- Geometry-lane tests stay green; new `detachHouseFormAtSeam.test.ts` ships ≥8 tests covering: 2-primitive split, 3-primitive chain (front / middle / back joins), invalid join index, partition validates cleanly via `validateHouseComposition`, output preserves per-rectangle roof intent, index renumbering correctness.
- New integration test: hand-authored 2-primitive L composition produces wall segments along the union polygon, not along any single constituent rectangle (verified by wall count and segment positions).
- Phase 3.2 byte-equivalence test stays green (single-rectangle compositions unchanged).
- Marketing build clean (HARD GATE — no marketing changes expected, but the gate catches accidental cross-app imports).
- Decision-log entry + index row.

## 7. Sequencing within 4a

Three incremental commits, gates between each (same pattern as Phase 3.1 → 3.4):

```text
4a.1  →  4a.2  →  4a.3
```

- **4a.1 — `detachHouseFormAtSeam` pure function.** Geometry package only. Adjacency graph + BFS + partition assembly + tests. No portal touch. Smallest, lowest-risk first.
- **4a.2 — `buildLegacyFootprintFromCompositionUnion` helper.** Portal-side seam between composition module and legacy wall builder. Pure function + tests. Doesn't change runtime behaviour yet — just exposes the shape conversion.
- **4a.3 — geometry pipeline substitution.** Wires 4a.2 into `houseFormGeometryInput.ts` so multi-rectangle compositions actually render via the union polygon. Integration test for the L-composite hand-authored case. The behaviour-changing commit.

After 4a.3 ships, multi-rectangle composites authored in tests (or hand-poked via DevTools) render correctly; nothing in any production project changes because no production form has a multi-rectangle composition yet. 4b adds the Join icon that creates them and the Detach icon that calls into 4a.1.

## 8. What I'd push back on

- **The temptation to bundle the Detach UX into 4a "since it's a small icon".** Per the orphaned-UI argument above, the icons in 4a would never appear in any project until 4b ships Join. Spending review surface on UI that nobody can trigger is wasted; the seam-position math + icon rendering + hit-testing all belong in 4b where they share infrastructure with the Join icon.
- **The temptation to ALSO write the unified-topology roof solver in 4a.** Multi-rectangle composites in 4a render via the existing stitched per-rectangle solver from PR-COMP1, with the amber-tint diagnostic for non-fused composites. That's a known limitation; PR-COMP-UNIFIED is the dedicated investment if customers demand it. Don't conflate the unified-topology work with the routine "wire composition through the pipeline" work.

## 9. CTA

Say **"go 4a"** to execute the three commits in order. Or **"split 4a"** if you'd rather the three sub-commits land as separate PRs with independent gates.

If you want to talk through the geometry pipeline change in more detail first (specifically the `composeFootprintFromComposition` → legacy footprint shape conversion in 4a.2), say **"walk me through 4a.2"** and I'll deep-dive that step before any code lands.
