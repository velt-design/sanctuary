# PR-HR7 — Narrow-Return L Decomposition

**Drafted**: 2026-06-18. **Status**: planning. Targeted geometry-side fix for the bug class confirmed by [PR-HR6](pr-hr7-plan.md) and [PR-HR6b](pr-hr7-plan.md): asymmetric orthogonal L-footprints where one leg is small relative to the offset overhang. Two real customer fixtures captured today (Graham — Oratia v1 + v2) prove the pattern. Both fail topology partition; both currently quarantined in `CAPTURED_KNOWN_FAILURES`.

## 1. Goal

Route narrow-return L-footprints (one orthogonal leg ≤ 3m bordered by a long main edge ≥ 8m) through a **decomposed roof solver** that builds the main block as a hipped roof and the narrow leg as a flat-skillion sub-roof joined at the inside corner, so QA passes and the workbench renders a usable roof.

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

[`docs/design-workbench-architecture.md`](design-workbench-architecture.md) "Invalid geometry renders diagnostic geometry only." The current narrow-return L cases ARE invalid (both captured fixtures fail QA), so the workbench correctly refuses to commit. PR-HR7 reduces the set of inputs that fail QA without changing the gate — making more shapes valid is the only honest way to ship.

Also [`packages/geometry/src/house/README.md`](../packages/geometry/src/house/README.md): roof solvers must produce coverage-complete + semantic-valid topology. Today's two solvers (`buildEaveGraphJoinedHippedRoof` and `buildJoinedRectilinearHippedRoof`) both fail this contract on narrow-return L. Adding a third specialised solver is the targeted intervention.

### What alternatives were considered, and why rejected?

1. **Eave-polygon simplification before partition.** Collapse rounded chamfers near narrow legs back to clean orthogonal corners, then re-partition. *Rejected as primary path:* would fix v1 (which has 32-point eave from chamfering) but v2 has 6 clean source edges and still fails — the over-fragmentation happens IN the partition, not in eave construction. Might still be worth as a complementary later step, but doesn't close v2 on its own.
2. **New monolithic solver variant for narrow-return L.** Purpose-built single-pass solver that handles this aspect ratio. *Rejected:* "single-pass solve over the whole footprint" is the same shape as the two solvers that already fail; the bug class exists because the topology has two fundamentally different scales that don't compose in one partition. A third single-pass variant would likely hit the same wall.
3. **Heuristic: shorten the narrow leg before solving, restore the footprint after.** Cheap and dirty. *Rejected:* the renderable roof would correctly cover the shortened footprint but NOT the actual one — designers would see roof bodies that don't match the footprint they drew. Violates the visible-state principle.
4. **Tighter eave-offset repair loop (50mm → 10mm steps).** Currently steps `450 → 400 → 350 → ... → 0`. Try `450 → 440 → 430 → ... → 0`. *Rejected:* the repair loop ALREADY tries 0mm and fails (PR-HR6 verified this). The topology fails at every overhang value, not just 450.
5. **Decompose roof into main + extension (CHOSEN).** Detect narrow-return pattern, split footprint into "main block" (full rectangle) + "extension" (narrow piece), solve each independently, compose. *Why:* matches how a builder would design this roof in real life (the 2.4m-deep extension is too shallow for hipped — it gets a skillion). Each sub-solver works on a topology it ALREADY handles correctly. Composition logic is bounded (no new numerical-instability surface).

### What does this consciously NOT try to do?

- **NOT handle non-orthogonal footprints.** Custom angles stay out of scope; orthogonal coverage must be bulletproof first.
- **NOT generate valley / step-flashing at the inside-corner join.** Builder-grade roof cosmetics are out of scope for HR7. A "good enough" decomposed roof with clean ridge + skillion + eave geometry is the bar. Valley flashing is HR7b cosmetics.
- **NOT add a UI control for "extension roof type" (skillion vs flat vs hipped).** Skillion (mono-pitch falling away from the main block) is the safest default and matches the common construction reality. Designer override is a follow-up if customers request it.
- **NOT change `buildEaveGraphJoinedHippedRoof` or `buildJoinedRectilinearHippedRoof`.** Both are well-tested for the cases they handle. Adding a third solver alongside is lower-risk than modifying either.
- **NOT touch Plan viewport rendering.** The existing footprint outline + roof skeleton already shows the right shape in plan; the fix is geometry-only.
- **NOT remove HR6/HR6b's `CAPTURED_KNOWN_FAILURES` entries pre-emptively.** They're dropped only after the new solver makes the matrix tests pass.

### Net tech debt: pay down or add?

Net add, justified. Introduces one new solver file (~200 LOC) + one detection primitive (~100 LOC) + tests. Doesn't delete any existing solver — both stay as the primary dispatch for cases they handle. The compose-from-sub-roofs pattern is a new geometry primitive that could be reused later (e.g. for T-shapes with a narrow stem, or U-shapes with a narrow recess), so it's load-bearing infrastructure not just a one-off.

## 3. The new model

### Detection

```ts
// packages/geometry/src/house/narrowReturnDetection.ts (NEW)

/**
 * A "narrow return" is a polygon edge whose length is small relative
 * to the overhang AND is bordered by two perpendicular edges that
 * are both at least 8m long. This is the bug class PR-HR6/HR6b
 * captured: 2.4m extension off a 12-15m main block.
 */
export type NarrowReturnDetection = {
  /** Index of the short edge in the footprint polygon. */
  shortEdgeIndex: number;
  /** The two polygon vertices that bound the narrow extension. */
  extensionStart: Polygon3[number];
  extensionEnd: Polygon3[number];
  /** Width of the extension (= length of the short edge). */
  extensionWidthMm: number;
  /** Depth of the extension (perpendicular reach into the main block axis). */
  extensionDepthMm: number;
  /** The footprint subset that's the "main block" (extension removed). */
  mainBlockFootprint: Polygon3;
  /** The footprint subset that's just the extension (rectangle). */
  extensionFootprint: Polygon3;
};

export function detectNarrowReturn(input: {
  footprint: Polygon3;
  overhangMm: number;
}): NarrowReturnDetection | null;
```

### Decomposed solver

```ts
// packages/geometry/src/house/decomposedHippedRoof.ts (NEW)

/**
 * Build a hipped roof for narrow-return L footprints by solving the
 * main block + extension independently and composing.
 *
 * Main block: routed through the existing `buildRectangularRoof` if
 * the main block is a rectangle, else through
 * `buildEaveGraphJoinedHippedRoof` (which handles all currently-
 * passing L shapes).
 *
 * Extension: built as a flat skillion (mono-pitch) with the high
 * side aligned to the main block's eave height. The low side falls
 * away at the same pitch as the main block roof.
 *
 * Composition: roof planes from both, joined at the inside corner.
 * Join cosmetics (valley flashing, gutter step) are deferred to
 * HR7b; HR7 ships a "clean" decomposed roof.
 */
export function buildDecomposedHippedRoof(input: {
  footprint: Polygon3;
  eavePolygon: Polygon3;
  eaveHeightMm: number;
  roofPitchDeg: number;
  detection: NarrowReturnDetection;
}): HouseRoofBuildResult;
```

### Dispatch change

```ts
// packages/geometry/src/house/roofPrimary.ts (MOD around line 519)

// PR-HR7: try the existing solver first (covers all currently-
// passing cases). If QA fails AND the footprint matches the
// narrow-return pattern, retry through the decomposed solver
// before giving up.
let roof = hasOpenTerminalIntent
  ? buildJoinedRectilinearHippedRoof({...})
  : buildEaveGraphJoinedHippedRoof({...});

const qaAfterPrimary = applyRoofQa({roof: {...roof}, eavePolygon});
if (qaAfterPrimary.metadata?.roofQaStatus === 'valid') {
  return qaAfterPrimary;
}

// Narrow-return fallback (only for fully-hipped; open-hip + narrow-
// return is HR7-out-of-scope).
if (!hasOpenTerminalIntent) {
  const detection = detectNarrowReturn({
    footprint: input.sourceFootprint,
    overhangMm: eaveOverhangFromContext, // already in scope
  });
  if (detection) {
    const decomposed = buildDecomposedHippedRoof({
      footprint: input.sourceFootprint,
      eavePolygon: input.eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      roofPitchDeg: input.roofPitchDeg,
      detection,
    });
    const qaAfterDecomposed = applyRoofQa({
      roof: {
        ...decomposed,
        metadata: {
          ...decomposed.metadata,
          // Surface the approximation in the rail so designers know
          // the decomposed-narrow-return path was used.
          approximationReasons: ['decomposed_narrow_return'],
        },
      },
      eavePolygon: input.eavePolygon,
    });
    if (qaAfterDecomposed.metadata?.roofQaStatus === 'valid') {
      return qaAfterDecomposed;
    }
  }
}

// Both paths failed — return the primary result so the rail still
// shows the original failure code.
return qaAfterPrimary;
```

### Approximation surfacing

A successful decomposed roof gets stamped `approximationReasons: ['decomposed_narrow_return']`. The rail's `RoofValidationPanel` (PR-HR2) already renders an amber "approximate" panel for non-empty `approximationReasons` — designers see "Decomposed narrow return" and know the cosmetics may need a future cleanup. No new UI work needed.

## 4. PR sequence

Single PR. The detection + decomposition + dispatch are tightly coupled; splitting them just doubles the integration overhead. Join cosmetics (valley flashing, gutter step at the inside corner) are deferred to HR7b if customer feedback says they matter.

## 5. Per-PR file map

| File | Change | LOC est |
|---|---|---|
| `packages/geometry/src/house/narrowReturnDetection.ts` | NEW. `detectNarrowReturn()` + types. | ~120 |
| `packages/geometry/src/house/narrowReturnDetection.test.ts` | NEW. Detection edge cases (no false positives on rectangles / U / T / wide L; correct main+extension split for both captured Graham-Oratia shapes). | ~150 |
| `packages/geometry/src/house/decomposedHippedRoof.ts` | NEW. `buildDecomposedHippedRoof()` + sub-solver composition. | ~200 |
| `packages/geometry/src/house/decomposedHippedRoof.test.ts` | NEW. Both Graham-Oratia fixtures pass; z-continuity at join asserted; roof plane count + feature count + boundary closure. | ~180 |
| [`packages/geometry/src/house/roofPrimary.ts`](../packages/geometry/src/house/roofPrimary.ts) | Add fallback dispatch (~30L); preserves existing happy path. | +35 / -2 |
| [`packages/geometry/src/house/orthogonalRoofCoverageMatrix.test.ts`](../packages/geometry/src/house/orthogonalRoofCoverageMatrix.test.ts) | Remove both Graham-Oratia entries from `CAPTURED_KNOWN_FAILURES`. Add a synthetic narrow-return L variant to the multi-open matrix to lock the fix. | +8 / -25 |
| [`docs/decision-log.md`](decision-log.md) | New HR7 entry + index row. | +30 |
| [`packages/geometry/src/index.ts`](../packages/geometry/src/index.ts) | Export `detectNarrowReturn`, `buildDecomposedHippedRoof` so downstream tests can use them. | +2 |

**Total**: ~750 LOC including tests; production source delta ~360 LOC.

## 6. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Decomposed roof's z-values at the inside-corner join don't match → visible render seam at the eave. | Med | Force extension's high-side z to equal `eaveHeightMm` exactly. Unit test asserts `Math.abs(extensionHighZ - mainEaveZ) < 1e-6`. Visual snapshot via the workbench fixture loop after the fix lands. |
| Detection over-triggers on shapes that work today → routes them to the new (less-tested) solver. | Med | Strict bounds: `extensionWidth ≤ 3000mm AND mainBlockLongEdge ≥ 8000mm AND offsetEaveWouldSelfOverlap === true`. The full preset + custom matrix (75 cases) runs in CI and would catch over-routing immediately. |
| Decomposed roof breaks downstream consumers (walls, openings on the narrow-extension wall, gutter geometry, attachment edges). | Med-High | Output uses the same `HouseRoofBuildResult` shape; walls/openings are derived from the footprint independently in `walls.ts` and `houseOpenings.ts`, not from roof planes. Add a fixture test that puts an opening on the narrow-extension wall and asserts it still resolves correctly. |
| Skillion choice for the extension is wrong for some real-world shapes (e.g. designer wanted a hipped 3m extension). | Low | Skillion is the safest default in construction practice; the few customer cases where it's wrong can be reported and added to the matrix. PR-HR7c (future) can add a designer toggle if data justifies it. |
| The decomposed roof PASSES QA but the geometry is subtly wrong (slope angle off, wrong fall direction at the join). | Med | Numerical assertions in the unit test: extension fall direction matches `negative_y` (toward main block), pitch matches the input pitch, eave heights consistent. Visual snapshot via the captured Graham-Oratia fixture rendered through the workbench fixture loop. |
| HR3's amber-tint stops firing on Graham-Oratia → designers don't notice the "approximate" join cosmetics. | Low | `approximationReasons: ['decomposed_narrow_return']` keeps the validation status as `approximate` (not `valid`), so the amber `RoofValidationPanel` still fires and the rail explains why. |
| Extending the dispatch path makes `roofPrimary.ts` even bigger (already ~600L). | Low | Move the fallback block into a small helper inside `decomposedHippedRoof.ts` (`buildDecomposedHippedRoofIfApplicable`); the dispatch becomes a single function call. Net change to `roofPrimary.ts` is +5 LOC, not +35. |

## 7. Acceptance criteria

- Portal + marketing + geometry typecheck clean.
- `npm run lint` clean (including docs-guard).
- `npx vitest run packages/geometry/src/house` shows 246+ tests green (current baseline) PLUS the new HR7 detection + decomposition test files PLUS both Graham-Oratia captured fixtures NOW PASSING (dropped from `CAPTURED_KNOWN_FAILURES`).
- `npx vitest run packages/geometry/src/viewer.test.ts` green (regression check on the HR3 diagnostic-render flow — should now fire for FEWER cases, not break).
- Marketing build HARD GATE clean.
- Manual verification on local dev: load both Graham-Oratia footprints in the workbench, confirm 3D shows a valid hipped main block + skillion extension (NOT amber-tinted), confirm the rail shows an "approximate" panel with code `decomposed_narrow_return` (not "invalid").
- Decision-log entry + index row added for PR-HR7.

## 8. Estimates

| PR | LOC | Risk | Est time |
|---|---|---|---|
| PR-HR7 (atomic) | ~750 (incl. tests) | Med (geometry numerical; downstream consumer ripple) | **1-2 focused days** |
| PR-HR7b (deferred — valley cosmetics) | ~200 | Low | 4-6 hrs |

PR-HR7c (designer toggle for extension roof type) is opportunity-driven, not scheduled.

## 9. Sequencing

```text
PR-HR7 ──→ designers unblocked on Graham-Oratia class
   │
   └─→ HR7b (valley cosmetics) ──→ HR7c (designer toggle, if needed)
```

No upstream dependencies. The PR-HR2/HR1/HR4/HR3 infrastructure is in place and provides the verification surface (RoofValidationPanel, matrix, captured fixtures).

## 10. What I'd push back on

- **The temptation to also handle valley/flashing at the join in this PR.** Roof cosmetics get hairy fast; one valley feature drags in step-flashing, sealing details, and downstream solid composition. Ship the decomposed roof first, get designer feedback on what's actually missing, then iterate. HR7b can do valleys if the gap turns out to matter.
- **The framing that "the old solvers should be fixed."** Both single-pass solvers (`buildEaveGraphJoinedHippedRoof`, bent-spine wavefront) fail on this aspect-ratio class because they try to compute the topology in one pass over a footprint that has two fundamentally different scales. Decomposing IS the fix — it acknowledges that the main block and the narrow extension are conceptually separate roofs and should be solved separately. "Fix the partition" is the wrong lens.
- **The temptation to widen the detection beyond narrow-return L.** Some U-shapes and T-shapes might benefit from similar decomposition, but proving that requires fresh captured fixtures. Limiting HR7 to the L case keeps the blast radius small.

## 11. CTA

Ready to execute? Say **"go HR7"** and I'll start with the detection primitive + tests, then the decomposition solver, then the dispatch change. I'll commit incrementally (detection → decomposition → dispatch) so you can pause at any point if the work surfaces something unexpected.

Or — if you want a quick spike first (build just `detectNarrowReturn` + unit tests, see if the detection bounds are obviously right before investing in the solver), say **"spike detection first"** and I'll ship just that part as PR-HR7-spike.
