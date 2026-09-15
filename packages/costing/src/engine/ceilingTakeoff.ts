import { CEILING_CATALOGUE, ceilingLengthSurcharge } from '../ceilingCatalogue';
import { isCostingManifestAtLeast } from '../manifestVersion';
import type { CostingConfigV1 } from './config';
import type { InputsNormalizedV1, DerivedV1, MaterialsLineV1 } from './types';

export function ceilingArea(inputs: InputsNormalizedV1, derived: DerivedV1): number {
  const area = derived.timber_area_m2;
  return inputs.structure_type === 'box_perimeter' ? area * Math.cos(derived.roof_pitch_deg_used * Math.PI / 180) : area;
}
/** Cut joins land on the standard calculator purlin support grid, never in a free span. */
export function ceilingStock(runM: number, supportCount = Math.ceil(Math.max(0, runM - .2) / .5) + 1): { lengthM: number; surcharge: number; cutM: number }[] {
  if (!Number.isFinite(runM) || runM <= 0 || !Number.isInteger(supportCount) || supportCount < 2) throw new Error('Invalid ceiling board run or supports.');
  const supports = Array.from({length: supportCount}, (_, i) => .1 + Math.max(0, runM - .2) * i / (supportCount - 1));
  const stock = [];
  let start = 0;
  while (runM - start > 1e-8) {
    const end = runM - start <= 4.8 + 1e-8 ? runM : supports.filter(position => position > start + 1e-8 && position - start <= 4.8 + 1e-8).at(-1);
    if (end === undefined) throw new Error('No supported ceiling join within available stock length.');
    const cutM = end - start;
    const lengthM = Math.round(Math.max(1.8, Math.ceil((cutM - 1e-8) / .3) * .3) * 10) / 10;
    stock.push({ lengthM, surcharge: ceilingLengthSurcharge(lengthM), cutM });
    start = end;
  }
  return stock;
}

/** Hip-corner wings have independent board runs and support grids. */
function ceilingRuns(inputs: InputsNormalizedV1, derived: DerivedV1, config: CostingConfigV1) {
  if (inputs.roof_type !== 'hip_corner') {
    return [{ area: ceilingArea(inputs, derived), run: inputs.structure_type === 'box_perimeter' ? derived.timber_run_per_plane_m : derived.timber_slope_len_per_plane_m, supports: derived.timber_purlin_lines_per_plane }];
  }
  const planes = derived.roof_planes;
  const mixed = inputs.mixed_roof;
  // Explicit bays locate acrylic on a wing; ridge strips follow each wing's length.
  // An area-only override has no location, so allocate it proportionally by area.
  const weights = planes.map(plane => mixed?.mode === 'acrylic_bays'
    ? (mixed.acrylic_bays_by_plane?.[plane.id] ?? 0) * plane.rafter_length_m
    : mixed?.mode === 'ridge_skylight'
      ? plane.roof_area_m2 / plane.rafter_length_m
      : plane.roof_area_m2);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const areas = planes.map((plane, index) => Math.max(0, plane.roof_area_m2 - (totalWeight > 0 ? derived.acrylic_area_m2 * weights[index] / totalWeight : 0)));
  const totalArea = areas.reduce((sum, area) => sum + area, 0);
  const horizontalFactor = inputs.structure_type === 'box_perimeter' ? Math.cos(derived.roof_pitch_deg_used * Math.PI / 180) : 1;
  return planes.map((plane, index) => ({
    area: totalArea > 0 ? areas[index] * derived.timber_area_m2 / totalArea * horizontalFactor : 0,
    run: plane.rafter_length_m * horizontalFactor,
    supports: Math.ceil(Math.max(0, plane.rafter_length_m - .2) / (isCostingManifestAtLeast(config, 2, 8) ? .6 : .5)) + 1,
  }));
}

export function ceilingMaterials(inputs: InputsNormalizedV1, derived: DerivedV1, config: CostingConfigV1): MaterialsLineV1[] {
  if (!inputs.ceiling) return [];
  if (!isCostingManifestAtLeast(config, 2, 7)) throw new Error('Publish a v2.7 costing configuration before pricing new ceiling options.');
  const option = CEILING_CATALOGUE[inputs.ceiling.option];
  const area = ceilingArea(inputs, derived);
  if (area <= 0) return [];
  const cover = option.coverMm / 1000;
  const plans = ceilingRuns(inputs, derived, config).filter(plane => plane.area > 0).map(plane => {
    const stock = ceilingStock(plane.run, plane.supports);
    const rows = Math.ceil(plane.area / (plane.run * cover) - 1e-8);
    const purchasedM = rows * stock.reduce((sum, item) => sum + item.lengthM, 0);
    const extra = Math.max(0, plane.area / cover * 1.1 - purchasedM);
    return { stock, rows, purchasedM, extra };
  });
  const rowsOut: MaterialsLineV1[] = [];
  const line = (id: string, qty: number, factor = 1, note = '') => {
    const item = config.materials.items.find(item => item.id === id);
    if (!item || !Number.isFinite(item.cost_ex_gst)) throw new Error('Missing ceiling pricebook rate: ' + id);
    const unitCost = Math.round(item.cost_ex_gst * factor * 100) / 100;
    const quantity = Math.round(qty * 100) / 100;
    rowsOut.push({ id, label: item.name, unit: item.unit, qty: quantity, unit_cost_ex_gst: unitCost, line_cost_ex_gst: Math.round(quantity * unitCost * 100) / 100, notes: note });
  };
  for (const band of [.1, .3]) {
    const quantity = plans.reduce((sum, plan) => sum + plan.rows * plan.stock.filter(item => item.surcharge === band).reduce((length, item) => length + item.lengthM, 0) + (band === .3 ? plan.extra : 0), 0);
    if (quantity > 0) line('ceiling.' + inputs.ceiling.option + '_lm', quantity, 1 + band, `${band * 100}% selected-length surcharge; joins over supports, offcuts included.`);
  }
  line('ceiling.coating_m2', plans.reduce((sum, plan) => sum + plan.purchasedM + plan.extra, 0) * cover, 1, 'Provisional factory coating allowance on purchased coverage.');
  line('ceiling.fixings_m2', area, 1, 'Provisional fixings and consumables.');
  return rowsOut;
}
