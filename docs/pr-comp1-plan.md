# PR-COMP1 — Composition Geometry Primitives

**Drafted**: 2026-06-18. **Status**: planning. First implementation phase of the [house composition vision](house-composition-vision.md).

Builds the rectangle + valley primitives that the rest of the composition migration relies on. Lives entirely in `@sp/geometry`. No workbench wiring, no UX change. Tests prove the math works on the two captured Graham–Oratia fixtures + a representative set of synthetic compositions.

## 1. Goal

Ship a standalone composition-geometry library in `@sp/geometry` that takes an explicit `HouseComposition` (rectangles + joins + roof intent) and returns a valid `HouseRoofBuildResult` — covering the rectangle-union case (route to existing `buildRectangularRoof`) and the per-rectangle-plus-valley case (route to rectangle solver per piece, construct explicit valleys).

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

[`docs/design-workbench-architecture.md`](design-workbench-architecture.md) "Inputs are constrained-by-construction" (added in this PR's accompanying north-star edit). Also [`docs/house-composition-vision.md`](house-composition-vision.md) Architectural Rule 1: composition geometry lives in `@sp/geometry`, not the workbench.

### What alternatives were considered, and why rejected?

1. **Retrofit the existing `buildEaveGraphJoinedHippedRoof` / bent-spine wavefront to handle narrow-return L.** Rejected — PR-HR6 verified both solver paths fail on the Graham–Oratia aspect ratio, and the failures are in the topology partition itself, not in any layer above. Patching the partition is fragile (the existing 16-of-18 `partialOpenJoinedTopology.test.ts` fixes already took two phases of careful numerical work). Decomposition sidesteps the partition entirely.
2. **Decomposition-by-inference** (the original PR-HR7 framing). Detect narrow-return L in a free-form polygon and decompose internally. Rejected as primary path — the inference heuristic is a poor proxy for explicit designer intent; baking it in as the long-term solution entrenches the wrong input model. PR-COMP1 builds the explicit-decomposition primitives the inference path would have wrapped, just driven by explicit `HouseComposition` input from Phase 2+ instead of inferred from a polygon.
3. **Skillion for narrow extensions instead of hipped.** Rejected — would couple PR-COMP1 to a designer-facing decision ("which extensions get a hipped vs skillion roof?"). Per the composition vision, roof intent is per-composite and applies to every constituent. Per-constituent overrides are a known v1 limit; revisit if customers ask.
4. **In-workbench composition primitives** (live in `apps/portal/lib/drawings/state/`). Rejected — composition geometry is reusable by future tools (server-side reports, calculator V2, etc.). Living in `@sp/geometry` matches the package's role as the geometry source of truth.

### What does this consciously NOT try to do?

- **NOT add `HouseComposition` to `HouseFormModel`.** That's Phase 2. PR-COMP1 ships the geometry primitives only; nothing in `apps/portal` changes.
- **NOT add workbench UX for shape palette / snap / Join / Detach.** Phases 3 + 4.
- **NOT migrate legacy free-form house forms.** Per vision: legacy forms keep working via the existing solver; no migration tooling.
- **NOT delete `buildEaveGraphJoinedHippedRoof` or any existing solver.** Legacy free-form path continues to depend on them. Deletion is open-ended (Phase 6 in the vision; not on the roadmap).
- **NOT introduce per-constituent roof overrides.** Composite owns one roof intent for all constituents.
- **NOT handle rotated rectangles / curves / non-orthogonal primitives.** Primitive type is polymorphic to leave room; only `kind: 'axisAlignedRectangle'` is implemented.
- **NOT generate gutter / fascia / soffit at the inside-corner valley.** Valley geometry is a `HouseRoofFeature3D` line; the perimeter eave assembly already handles eaves continuously around the composite perimeter. Valley-specific drainage cosmetics (step flashing, internal gutter) are deferred to a follow-up if real customer cases need them.

### Net tech debt: pay down or add?

Net add, justified. Adds ~600 LOC of new composition primitives + tests. Doesn't remove anything yet (legacy solvers stay live for free-form forms). The added code is structurally simple — each module ≤ 200 LOC, pure functions, no shared mutable state — and the rectangle + valley primitives are reusable beyond this PR.

## 3. The new model

### Composition types

```ts
// packages/geometry/src/house/composition/types.ts (NEW)

export type AxisAlignedRectangle = {
  kind: 'axisAlignedRectangle';
  /** World-space origin (mm) of the rectangle's south-west corner. */
  originXMm: number;
  originYMm: number;
  widthMm: number;   // x-axis extent
  depthMm: number;   // y-axis extent
};

/**
 * Polymorphic primitive type. v1 only ships `axisAlignedRectangle`,
 * but the union shape leaves room for future primitives (rotated
 * rectangles, octagons, curves) without refactor.
 */
export type CompositionPrimitive =
  | AxisAlignedRectangle
  | { kind: 'unknown'; reserved: true };

/**
 * A join records which edge of which rectangle connects to which
 * edge of which other rectangle, with an optional offset along the
 * shared edge.
 */
export type CompositionJoin = {
  /** Index into the composition's `primitives` array. */
  fromPrimitiveIndex: number;
  /** Edge identifier on the from-primitive (north/south/east/west for a rectangle). */
  fromEdge: 'north' | 'south' | 'east' | 'west';
  toPrimitiveIndex: number;
  toEdge: 'north' | 'south' | 'east' | 'west';
  /**
   * Offset along the shared edge in mm. Zero means flush at the
   * from-edge's start. Used when two rectangles are joined with
   * one extending past the other (T / cross shapes).
   */
  offsetAlongEdgeMm: number;
};

export type HouseComposition = {
  primitives: CompositionPrimitive[];
  joins: CompositionJoin[];
};
```

### Public API

```ts
// packages/geometry/src/house/composition/index.ts (NEW)

/**
 * Validate a composition is structurally sound: every join's
 * referenced rectangles must geometrically share the named edges,
 * primitives must be axis-aligned rectangles (v1 limit), no
 * overlapping interiors.
 *
 * Returns `ok` or a typed error describing the violation.
 */
export function validateHouseComposition(
  composition: HouseComposition,
): { ok: true } | { ok: false; error: CompositionValidationError };

/**
 * Compute the union polygon (in world space, CCW, orthogonal) of
 * the composition's primitives. Pure derived output — does not
 * persist anywhere.
 */
export function composeFootprintFromComposition(
  composition: HouseComposition,
): Polygon3;

/**
 * Solve the composite roof. Routes to:
 *   - `buildRectangularRoof` on the merged dimensions if the union
 *     is itself a rectangle (fused-rectangle resolution);
 *   - per-rectangle `buildRectangularRoof` + explicit valley
 *     features at each inside corner otherwise.
 *
 * Returns the same `HouseRoofBuildResult` shape that existing
 * solvers return, so downstream consumers (`applyRoofQa`,
 * `buildHouseModel3D`) work unchanged.
 */
export function composeRoofFromComposition(input: {
  composition: HouseComposition;
  eaveHeightMm: number;
  roofIntent: HouseFormRoofIntentModel;
}): HouseRoofBuildResult;

/**
 * Derive composite-perimeter terminal ends (for Dutch-hip toggles).
 * Edges shared between rectangles via joins are excluded; outer
 * perimeter edges perpendicular to their rectangle's ridge axis are
 * included.
 */
export function deriveCompositeTerminalEnds(
  composition: HouseComposition,
  roofIntent: HouseFormRoofIntentModel,
): HouseTerminalEnd[];
```

### Resolution algorithm (composeRoofFromComposition internals)

```text
1. Compute union polygon P from composition.
2. If P has exactly 4 corners (i.e., P is a rectangle):
     a. Call buildRectangularRoof on P's bounding box dimensions.
     b. Apply Dutch-hip overrides per terminal ends.
     c. Return.
3. Otherwise (P has reflex corners → L / T / U / cross / etc.):
     a. For each primitive in composition:
          - Solve buildRectangularRoof on the primitive's dimensions.
          - Translate the resulting roof planes into world space at
            the primitive's origin.
     b. For each join in composition:
          - If the join is an inside-corner join (the rectangles
            meet at right angles forming a reflex perimeter corner):
              - Construct a valley feature: line from the inside
                corner up at the slope-intersection angle, ending
                at the ridge intersection point.
              - Trim each primitive's roof planes along the valley
                line.
              - Add the valley feature to the composite's
                roofFeatures.
          - Otherwise (collinear edge join — two rectangles in a
            row, fusable case):
              - Should have been caught by step 2; reaching here
                indicates a validation hole. Throw with a typed
                error so we know the resolution rule has a gap.
     c. Compose the trimmed roof planes + valley features into a
        single HouseRoofBuildResult.
     d. Stamp metadata: `roofGeometry: 'composed_rectangle_union'`,
        `roofTopologySolver: 'composition_per_rectangle_valleys'`.
     e. Return.
```

### Why this resolves the Graham–Oratia bug class

Both captured fixtures are L-shapes — non-rectangular unions. They route through branch 3:
- Main block (12.5m × 8m or 15m × 11m): solved by `buildRectangularRoof` → guaranteed valid.
- Extension (5.8m × 2.4m or 5.5m × 2.4m): solved by `buildRectangularRoof` → guaranteed valid.
- Inside corner: explicit valley feature constructed at the join point.

The aspect ratio that broke the partition solver doesn't matter, because there IS no partition step — just two independent rectangle solves and a deterministic valley.

## 4. File map

| File | Change | LOC est |
|---|---|---|
| `packages/geometry/src/house/composition/types.ts` | NEW. `AxisAlignedRectangle`, `CompositionPrimitive`, `CompositionJoin`, `HouseComposition`, `CompositionValidationError`. | ~80 |
| `packages/geometry/src/house/composition/validateHouseComposition.ts` | NEW. Structural validation. | ~120 |
| `packages/geometry/src/house/composition/composeFootprintFromComposition.ts` | NEW. Union polygon construction. | ~90 |
| `packages/geometry/src/house/composition/fusedRectangleDetector.ts` | NEW. Returns `{ fused: true, dimensions } \| { fused: false }`. | ~60 |
| `packages/geometry/src/house/composition/buildValleyFeature.ts` | NEW. Inside-corner valley geometry. | ~150 |
| `packages/geometry/src/house/composition/composeRoofFromComposition.ts` | NEW. The dispatch + assembly. | ~180 |
| `packages/geometry/src/house/composition/deriveCompositeTerminalEnds.ts` | NEW. Terminal-end derivation from composite perimeter. | ~100 |
| `packages/geometry/src/house/composition/index.ts` | NEW. Public API re-exports. | ~20 |
| `packages/geometry/src/house/composition/validateHouseComposition.test.ts` | NEW. Validation edge cases. | ~120 |
| `packages/geometry/src/house/composition/composeFootprintFromComposition.test.ts` | NEW. Union-polygon correctness across rectangle / L / T / U / cross. | ~100 |
| `packages/geometry/src/house/composition/fusedRectangleDetector.test.ts` | NEW. Fuse-yes / fuse-no boundary cases. | ~80 |
| `packages/geometry/src/house/composition/buildValleyFeature.test.ts` | NEW. Valley geometry against known-correct L / T fixtures. | ~140 |
| `packages/geometry/src/house/composition/composeRoofFromComposition.test.ts` | NEW. End-to-end: Graham–Oratia v1 + v2 as compositions → valid QA. Plus synthetic compositions for fused-rectangle and L/T/U/cross. | ~250 |
| `packages/geometry/src/house/composition/deriveCompositeTerminalEnds.test.ts` | NEW. Terminal derivation across composite shapes including Dutch-hip combinations. | ~150 |
| [`packages/geometry/src/index.ts`](../packages/geometry/src/index.ts) | Export the public composition API. | +6 |
| [`docs/decision-log.md`](decision-log.md) | New PR-COMP1 entry + index row. | +30 |

**Total**: ~1670 LOC including tests (>50% tests). Production source delta ~810 LOC.

## 5. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Valley geometry produces z-discontinuity at the join (visible render seam). | Med | Both primitives use the same `eaveHeightMm` (composite-level). Test asserts every valley endpoint matches the shared eave height + computed ridge height with `< 1e-6` tolerance. |
| Fused-rectangle detector has a hole (says "not fused" when the union actually IS a rectangle). | Med | Detector returns the merged bounding box; test asserts `union(primitives).boundingBox === composeFootprint(composition).boundingBox` for fused cases. Property test over random rectangle pairs. |
| Resolution falls through to branch 3 step b "should have been caught by step 2" — indicates a validation hole. | Low | Throws a typed error with the offending composition. Test exercises pathological cases (rectangles with overlapping interiors, zero-area rectangles) and asserts validation catches them BEFORE compose is called. |
| Composite roof solves but the result's `roofTopologyExpectedFaceCount` semantics break downstream `applyRoofQa`. | Med | Stamp `roofTopologyExpectedFaceCount = sumOfPrimitiveExpectedFaces + valleyCount`. `applyRoofQa` consumes this; doesn't care how it was computed. Add a viewer.test assertion that a composed roof passes QA the same as an equivalent rectangle would. |
| Public API surface is too small / wrong-shaped — Phase 2 needs functions we didn't ship. | Low-Med | The API is driven by what Phase 2 will call: solve, derive terminals, compose footprint. Listed above. Add additional exports as Phase 2 surfaces specific gaps. |
| `@sp/geometry` package bloat (already a large package). | Low | New code is ~810 LOC in a dedicated `composition/` subdirectory. Self-contained, no spread across existing files. |
| Test runtime explosion if synthetic composition coverage is large. | Low | Tests use specific named shapes, not exhaustive enumeration. The composition matrix (multi-open + variant counts) belongs in Phase 2's matrix test, not Phase 1. |

## 6. Acceptance criteria

- `npx vitest run packages/geometry/src/house/composition` — all new tests green.
- Graham–Oratia v1 + v2 captured fixtures, when expressed as `HouseComposition`, produce `roofQaStatus: 'valid'`. (Captured fixtures themselves stay in `CAPTURED_KNOWN_FAILURES` until Phase 2 wires the workbench to use compositions — Phase 1 is geometry-only.)
- `npx vitest run packages/geometry` — full package green; no regression on the 246 existing house-lane tests.
- `npx tsc -p packages/geometry/tsconfig.typecheck.json` clean.
- `npm run lint` clean.
- `npm --prefix apps/marketing run build` clean (HARD GATE — even though no marketing code touched, gate catches accidental cross-package imports).
- Public API exported from `packages/geometry/src/index.ts`.
- Decision-log entry + index row added.

## 7. Estimates

| Stage | LOC | Risk | Est time |
|---|---|---|---|
| Types + validation | ~200 | Low | 2-3 hrs |
| Footprint composition + fused-rectangle detector | ~150 | Low | 2-3 hrs |
| Valley feature construction | ~150 | Med (geometry numerical) | 3-4 hrs |
| Compose roof dispatch + assembly | ~180 | Med | 3-4 hrs |
| Terminal-end derivation | ~100 | Low | 1-2 hrs |
| Tests + decision-log | ~700 | Low | 4-5 hrs |
| **Total** | **~1670** | **Med** | **2-3 focused days** |

## 8. Sequencing

```text
PR-COMP1 (this) ──→ Phase 2 (data model in HouseFormModel)
                       │
                       └──→ Phase 3 (rectangle tool, draw removed)
                                │
                                └──→ Phase 4 (Join / Detach UX)
```

No upstream dependencies. Phase 1 doesn't require any workbench changes; Phase 2 depends on Phase 1.

## 9. What I'd push back on

- **The temptation to wire Phase 2 in the same PR.** Tempting because then designers see immediate benefit. Don't — the geometry primitives must be testable in isolation; any failure of the rectangle/valley math must be debuggable without workbench state in the way. Keep them in separate PRs.
- **The temptation to add valley drainage cosmetics (gutter inside the valley, step flashing).** Construction-realistic but optional for v1. Defer until a real customer case asks for it.
- **The temptation to delete `buildEaveGraphJoinedHippedRoof` now.** Even though the new path covers L/T/U/cross via composition, the legacy free-form polygons still use it. Don't touch.

## 10. CTA

Ready to execute? Say **"go comp1"** and I'll start with the types + validation, then the footprint composition, then valley + roof dispatch, then tests. I'll commit incrementally (types → footprint → valley → roof → tests) so you can pause at any point.
