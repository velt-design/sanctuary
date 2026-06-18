import { composeFootprintFromComposition, type HouseComposition, type Polygon3 } from "@sp/geometry";
import type { CalculatorHouseFootprintPolygonPoint } from "@/lib/types/calculator";
import type { HouseFormModel } from "./objectFirstWorkbenchModel";

/**
 * PR-COMP-PHASE2 (2026-06-18): single derivation helper that
 * returns the canonical footprint polygon for a house form.
 *
 * When `composition` is present (Phase 3+ rectangle-tool forms),
 * derives the polygon from `composeFootprintFromComposition` and
 * converts mm → metres-as-strings (the workbench polygon vocabulary).
 *
 * When `composition` is absent (every legacy free-form house form),
 * returns the legacy `footprint.polygon` directly.
 *
 * Downstream consumers should call this instead of reading
 * `houseForm.footprint.polygon` directly — it isolates them from
 * the composition-vs-polygon distinction.
 *
 * Phase 2 ships this helper; consumer migration happens in Phase 3.
 */
export function deriveHouseFormFootprintPolygon(
  houseForm: HouseFormModel,
): CalculatorHouseFootprintPolygonPoint[] {
  if (!houseForm.composition) {
    return houseForm.footprint.polygon;
  }
  const polygonMm = composeFootprintFromComposition(houseForm.composition);
  return polygonMm.map((point) => ({
    alongM: mmToMetreString(point.x),
    depthM: mmToMetreString(point.y),
  }));
}

function mmToMetreString(mm: number): string {
  // Workbench polygon storage uses metres-as-strings. Match the
  // precision used by other normalisers (6 decimal places ≈ 0.001mm).
  const stable = Number((mm / 1000).toFixed(6));
  return String(Object.is(stable, -0) ? 0 : stable);
}

/**
 * PR-COMP-PHASE4a.2 (2026-06-18): derive the composition's union
 * polygon in the shape `buildHouseModel3DFromRawHouseInput` expects
 * (a `Polygon3` — CCW, orthogonal, mm coordinates, z=0 on every
 * vertex). Used by `houseFormGeometryInput.ts` in PR-COMP-PHASE4a.3
 * to substitute the union footprint for the preset-derived
 * footprint when a multi-rectangle composition is present.
 *
 * Returns `null` (signalling "use the legacy preset path") when:
 *   - composition is null / undefined / empty
 *   - composition has a single primitive (Phase 3.2's byte-equivalence
 *     invariant: single-rectangle composites must render identically
 *     to the legacy preset path; substituting the union is unnecessary
 *     and would risk drift)
 *   - `composeFootprintFromComposition` throws (defensive: a
 *     structurally-broken composition that slipped past normalisation
 *     falls back to the legacy path instead of crashing the pipeline)
 *
 * Returns the union `Polygon3` for compositions with 2+ primitives.
 * For fused-rectangle compositions (multiple primitives that union
 * into a single rectangle), `composeFootprintFromComposition` already
 * returns the merged rectangle; we don't second-guess that.
 */
export function deriveCompositionUnionPolygon3(
  composition: HouseComposition | null | undefined,
): Polygon3 | null {
  if (!composition) return null;
  if (composition.primitives.length <= 1) return null;
  try {
    return composeFootprintFromComposition(composition);
  } catch {
    return null;
  }
}
