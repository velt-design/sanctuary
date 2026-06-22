# PR-COMP-PHASE2 — Composition Data Model in `HouseFormModel`

**Drafted**: 2026-06-18. **Status**: planning. Phase 2 of the [house composition migration](house-composition-vision.md). Sits on top of [PR-COMP1](pr-comp1-plan.md) (composition geometry primitives, shipped).

## 1. Goal

Add an optional `composition?: HouseComposition` field to `HouseFormModel` and make it survive workbench-draft round-trip (load → edit → save → reload). When present, downstream consumers can derive the composite footprint via `composeFootprintFromComposition` instead of using the legacy free-form polygon. **No geometry-routing change in this PR** — the roof solver still uses the legacy free-form path; composition-driven roof solving lands in Phase 3 alongside the rectangle-tool UX that produces compositions.

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

[`docs/design-workbench-architecture.md`](design-workbench-architecture.md) "House Input Is Composed, Not Drawn" — the principle says new house forms are compositions of rectangles + joins. PR-COMP1 shipped the geometry primitives; PR-COMP-PHASE2 makes the workbench data model carry composition data alongside (not replacing) the legacy footprint polygon. Phase 3 wires composition data into the geometry solver and provides UX to author it; Phase 4 adds Join/Detach.

### What alternatives were considered, and why rejected?

1. **Combine data model + geometry routing in one PR.** Original vision-doc framing. *Rejected:* there's no composition data to flow through the geometry router yet — Phase 3 is what produces compositions. Wiring the router now means writing code that's exercised only by hand-built test fixtures, not by real workbench state. Splits cleaner as two PRs: data model first (PR-COMP-PHASE2), geometry routing folded into Phase 3 when composition data starts flowing.
2. **Make `composition` REPLACE the existing footprint field on `HouseFormModel`.** *Rejected:* every existing house form has a footprint polygon. Forcing a migration to composition for legacy data breaks backward compat in Phase 2 — exactly the kind of "rip out the old before the new is ready" trap the vision explicitly avoids.
3. **Store composition outside `HouseFormModel` (e.g., a parallel `houseFormCompositionsById` map on `WorkbenchProjectModel`).** *Rejected:* harder to reason about — every consumer of `HouseFormModel` would need to also look up the parallel map. Co-locating the composition with the house form means one source of truth per form.
4. **Persist composition as a separate column in the database.** *Rejected:* the workbench draft already serialises to `estimate.outputs[ESTIMATE_DRAWING_OBJECT_FIRST_OUTPUT_KEY]` as JSON. Adding a new column would require migration; reusing the existing JSON blob is zero-migration and matches how every other house-form field is persisted.

### What does this consciously NOT try to do?

- **NOT route the roof solver through `composeRoofFromComposition`.** That's Phase 3 work — once designers can create compositions via the rectangle tool, we wire the solver to consume them.
- **NOT build any UX for composition authoring or editing.** Phase 3.
- **NOT add `Join` or `Detach` operations.** Phase 4.
- **NOT migrate any existing free-form house forms.** They keep their polygon footprint and use the legacy pipeline indefinitely. Per the vision, legacy data is read-only and not in scope for migration.
- **NOT validate composition coherence with the legacy footprint field.** If a house form has BOTH a composition AND a non-empty polygon, the polygon is treated as the source of truth (legacy compatibility). When Phase 3 produces composition-only house forms, the polygon field will be empty and consumers will derive it from composition.
- **NOT make composition required on new house forms.** Until Phase 3, every new house form continues to use the polygon path. Phase 3 flips the "rectangle tool creates a composition" switch.

### Net tech debt: pay down or add?

Net add, small. Adds ~50 LOC of types + serialisation + derivation helpers. Doesn't remove anything. The added code is structurally simple — one optional field, one round-trip test, one derivation helper. The infrastructure for compositions to flow through the workbench lands without committing to any of the downstream consumers yet (Phase 3 wires them).

## 3. The new model

### `HouseFormModel` shape change

```ts
// apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts

import type { HouseComposition } from "@sp/geometry";

export type HouseFormModel = {
  id: string;
  label: string;
  transform: HouseFormTransformModel;
  footprint: HouseFormFootprintModel;
  roofIntent: HouseFormRoofIntentModel;
  roofIntentAuthored?: boolean;
  storeyMode: CalculatorHouseStoreyMode;
  attachmentStrategy: CalculatorHouseAttachmentStrategy | null;
  eaveHeightM?: string | null;
  // ... other dimension fields ...

  /**
   * PR-COMP-PHASE2 (2026-06-18): authored composition for new house
   * forms produced by the Phase 3 rectangle tool. When present,
   * downstream consumers SHOULD prefer this over `footprint.polygon`
   * — composition carries explicit join + per-rectangle roof intent
   * data that the legacy polygon doesn't.
   *
   * Optional; absent on every legacy free-form house form. The
   * legacy `footprint` polygon remains the source of truth when
   * `composition` is absent.
   */
  composition?: HouseComposition | null;
};
```

### Persistence

The workbench draft normalisation layer (`normalizeObjectFirstWorkbenchDraftVNext`, called by `buildWorkbenchDraftEstimateUpdatePayload` in [DesignWorkbenchEstimateClient.tsx:72-84](../apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.tsx#L72-L84)) needs to preserve `composition` on round-trip. Concretely:

- Serialisation: include `composition` in the JSON output if present
- Deserialisation: read `composition` if present in the JSON; default to `undefined` if not (every legacy draft)
- Defensive validation: when reading, run `validateHouseComposition` and treat any error as "composition missing" (don't crash on bad data; fall back to legacy polygon)

### Derivation helper

```ts
// apps/portal/lib/drawings/state/houseFormCompositionFootprint.ts (NEW)

import { composeFootprintFromComposition } from "@sp/geometry";
import type { HouseFormModel } from "./objectFirstWorkbenchModel";
import type { CalculatorHouseFootprintPolygonPoint } from "@/lib/types/calculator";

/**
 * Returns the composite footprint polygon for a house form. When
 * `composition` is present, derives the polygon from composition
 * via `composeFootprintFromComposition`. Otherwise returns the
 * legacy `footprint.polygon` directly.
 *
 * Lets downstream consumers ignore the composition vs polygon
 * distinction — they just call this and get the right polygon for
 * the form's authored data.
 */
export function deriveHouseFormFootprintPolygon(
  houseForm: HouseFormModel,
): CalculatorHouseFootprintPolygonPoint[];
```

This helper makes it safe for Phase 3 (and beyond) to migrate to composition-first consumers without breaking legacy free-form forms.

## 4. File map

| File | Change | LOC est |
|---|---|---|
| [apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts) | Add optional `composition?: HouseComposition \| null` to `HouseFormModel`. | +12 |
| Workbench draft normalisation (`normalizeObjectFirstWorkbenchDraftVNext` — locate exact file) | Preserve `composition` on serialise / deserialise. Defensive validation on read. | +25 |
| `apps/portal/lib/drawings/state/houseFormCompositionFootprint.ts` (NEW) | `deriveHouseFormFootprintPolygon()` helper. | +35 |
| `apps/portal/lib/drawings/state/houseFormCompositionFootprint.test.ts` (NEW) | Round-trip + derivation tests. Composition-present case derives from `composeFootprintFromComposition`; composition-absent case returns legacy polygon. | +90 |
| Workbench draft normalisation test | Round-trip a `HouseFormModel` with `composition` — verify it survives normalise. Round-trip without `composition` — verify legacy path still works. | +60 |
| [docs/decision-log.md](decision-log.md) | New PR-COMP-PHASE2 entry + index row. | +20 |

**Total**: ~240 LOC including tests. Production source delta ~75 LOC.

## 5. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Existing tests on `HouseFormModel` break because `composition` is a new field they didn't construct. | Med | Field is **optional** (`composition?: ...`). Existing test fixtures that omit it remain valid. No fixture update required. |
| Workbench draft round-trip drops `composition` silently because the normaliser doesn't know about it. | Med | Add `composition` to the normaliser explicitly + add a round-trip test that asserts it survives. |
| Bad composition data in a legacy draft (e.g., corrupted JSON) crashes the workbench on load. | Low | Defensive validation: run `validateHouseComposition` on read; on any error, log and fall back to `undefined`. Test exercises corrupt-data path. |
| Downstream consumers (`houseFormGeometryInput`) see the new field and try to use it before Phase 3 wires it. | Low | Phase 2 ships only the data model + derivation helper. No downstream consumer is modified to consume `composition` — they all keep the legacy path. Phase 3 changes consumer behaviour. |
| The polygon derived from `composeFootprintFromComposition` doesn't match what existing consumers expect (point ordering, mm units, etc.). | Low | `composeFootprintFromComposition` already returns CCW orthogonal mm polygons matching `Polygon3` shape. The helper converts `Polygon3` to `CalculatorHouseFootprintPolygonPoint[]` (mm → metres-as-strings). Tests verify the round-trip. |

## 6. Acceptance criteria

- Portal typecheck clean.
- Geometry typecheck clean.
- Lint clean.
- New `houseFormCompositionFootprint.test.ts` green — covers composition-present derivation, composition-absent legacy path, invalid composition fall-back.
- Workbench draft normalisation test green — covers round-trip with and without `composition`.
- No regression on existing workbench / drawings / state tests.
- `HouseComposition` is exported via `@sp/geometry` (already shipped in PR-COMP1).
- Decision-log entry + index row added.
- No designer-visible change on the live workbench.

## 7. Estimates

| Stage | LOC | Risk | Est time |
|---|---|---|---|
| Add `composition` field to `HouseFormModel` | ~12 | Low | 20 min |
| Locate + update workbench draft normaliser | ~25 | Med (need to find the right file) | 60-90 min |
| `deriveHouseFormFootprintPolygon` helper + tests | ~125 | Low | 60-90 min |
| Round-trip tests on normalisation | ~60 | Low | 30-45 min |
| Decision-log + lint + verification | ~20 | Low | 30 min |
| **Total** | **~240** | **Low** | **~4 hours** |

Small PR. The biggest unknown is finding the workbench draft normaliser cleanly.

## 8. Sequencing

```text
PR-COMP1 (shipped) ──→ PR-COMP-PHASE2 (this) ──→ Phase 3 (rectangle tool + geometry routing)
                                                       │
                                                       └──→ Phase 4 (Join/Detach UX)
```

Phase 2 unblocks Phase 3 (which needs `composition` on `HouseFormModel` to write into). No further upstream dependencies.

## 9. What I'd push back on

- **The temptation to wire the geometry router in this PR.** Tempting because the data model + wiring "feel like one piece." Don't — wiring is exercised only by hand-built fixtures until Phase 3 produces real compositions. Wiring without real data is testing in a vacuum.
- **The temptation to validate composition coherence with the legacy polygon field.** "If both are present, they should agree." Don't — Phase 2 is plumbing; if a future bug ever produces both, that's a debugging signal not a thing to enforce defensively. Just document: composition is the source of truth when present.
- **The temptation to migrate any existing house forms.** Vision is explicit: legacy data stays as-is forever.

## 10. CTA

Say **"go phase 2"** to start. I'll execute incrementally — add field → update normaliser → add helper → write tests → decision log → commit. Single PR; ~4 hours of focused work.
