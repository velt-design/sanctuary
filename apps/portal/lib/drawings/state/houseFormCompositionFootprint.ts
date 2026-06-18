import { composeFootprintFromComposition } from "@sp/geometry";
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
