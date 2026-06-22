import {
  composeFootprintFromComposition,
  type HouseComposition,
  type Polygon3,
} from "@sp/geometry";

/**
 * PR-COMP-PHASE4a.2 (2026-06-18): derive the composition's union
 * polygon in the shape `buildHouseModel3DFromRawHouseInput` expects
 * (a `Polygon3`: CCW, orthogonal, mm coordinates, z=0 on every
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
