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
export function ceilingMaterials(inputs: InputsNormalizedV1, derived: DerivedV1, config: CostingConfigV1): MaterialsLineV1[] {
  if (!inputs.ceiling) return [];
  if (!isCostingManifestAtLeast(config, 2, 7)) throw new Error('Publish a v2.7 costing configuration before pricing new ceiling options.');
  const option = CEILING_CATALOGUE[inputs.ceiling.option];
  const area = ceilingArea(inputs, derived);
  if (area <= 0) return [];
  const run = inputs.structure_type === 'box_perimeter' ? derived.timber_run_per_plane_m : derived.timber_slope_len_per_plane_m;
  const stock = ceilingStock(run, derived.timber_purlin_lines_per_plane);
  const cover = option.coverMm / 1000;
  const rows = Math.ceil(area / (run * cover));
  const purchasedM = rows * stock.reduce((sum, item) => sum + item.lengthM, 0);
  const minimumWasteM = area / cover * 1.1;
  const extra = Math.max(0, minimumWasteM - purchasedM);
  const rowsOut: MaterialsLineV1[] = [];
  const line = (id: string, qty: number, factor = 1, note = '') => {
    const item = config.materials.items.find(item => item.id === id);
    if (!item || !Number.isFinite(item.cost_ex_gst)) throw new Error('Missing ceiling pricebook rate: ' + id);
    const unitCost = Math.round(item.cost_ex_gst * factor * 100) / 100;
    const quantity = Math.round(qty * 100) / 100;
    rowsOut.push({ id, label: item.name, unit: item.unit, qty: quantity, unit_cost_ex_gst: unitCost, line_cost_ex_gst: Math.round(quantity * unitCost * 100) / 100, notes: note });
  };
  for (const band of [.1, .3]) {
    const quantity = rows * stock.filter(item => item.surcharge === band).reduce((sum, item) => sum + item.lengthM, 0) + (band === .3 ? extra : 0);
    if (quantity > 0) line('ceiling.' + inputs.ceiling.option + '_lm', quantity, 1 + band, `${band * 100}% selected-length surcharge; joins over supports, offcuts included.`);
  }
  line('ceiling.coating_m2', Math.max(purchasedM, minimumWasteM) * cover, 1, 'Provisional factory coating allowance on purchased coverage.');
  line('ceiling.fixings_m2', area, 1, 'Provisional fixings and consumables.');
  return rowsOut;
}
