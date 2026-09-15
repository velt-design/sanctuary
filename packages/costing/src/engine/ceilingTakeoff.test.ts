import { describe, it, expect } from 'vitest';
import { calculateCostV1 } from './calculate';
import { loadCostingConfigV1 } from './config';
import { snapshotCostingControlConfigV1, applyCostingControlConfigV1 } from '../controlConfig';
import { ceilingStock } from './ceilingTakeoff';
import type { CostInputsV1 } from './types';
const input: CostInputsV1 = { length_m: 5, roof_span_m: 4, post_cut_height_m: 2.4, pergola_style: 'pitched', roof_material: 'timber', extrusion_colour: 'Black', house_connection_type: 'facade', post_connection_type: 'deck_bracket', access: 'normal', height: 'single_storey', timber_roof_above_type: 'steel_corrugated' };
describe('ceiling integration', () => {
  it('keeps old selections on the existing cedar identity', () => {
    const result = calculateCostV1(input);
    expect(result.materials.lines.some(line => line.id === 'roofing-timber_cedar_sarking_wrc_110cover_12mm_lm')).toBe(true);
    expect(result.materials.lines.some(line => line.id.startsWith('ceiling.'))).toBe(false);
  });
  for (const style of ['pitched','gable','box_perimeter'] as const) for (const roof of ['timber','mixed'] as const) {
    it(`prices only the selected ceiling for ${style}/${roof}`, () => {
      const result = calculateCostV1({...input, pergola_style: style, roof_material: roof, roof_pitch_deg: style === 'gable' ? 25 : 3, ceiling: {option: 'thermopine-150'}, ...(roof === 'mixed' ? {mixed_roof: {mode:'area_override', acrylic_area_m2_override: 4}} : {})});
      expect(result.materials.lines.some(line => line.id === 'ceiling.thermopine-150_lm' && line.line_cost_ex_gst > 0)).toBe(true);
      expect(result.materials.lines.some(line => line.id.includes('110cover'))).toBe(false);
      expect(result.materials.lines.some(line => line.id === 'ceiling.coating_m2')).toBe(true);
      expect(result.install.actions.find(action => action.id === 'roof.install_timber_roof_m2')?.minutes).toBeGreaterThan(0);
    });
  }
  it('leaves historical published inputs unchanged and gates new selections', () => {
    const base=loadCostingConfigV1(); const control=snapshotCostingControlConfigV1(base); control.baseManifestVersion='v2.6';
    for(const key of Object.keys(control.materialRatesExGst)) if(key.startsWith('ceiling.')) delete control.materialRatesExGst[key];
    const historical=applyCostingControlConfigV1(base,control);
    expect(calculateCostV1(input,historical).totals).toEqual(calculateCostV1(input,base).totals);
    expect(()=>calculateCostV1({...input,ceiling:{option:'cedar-100'}},historical)).toThrow(/Publish/);
  });
  it('joins long boards on actual support positions and covers the complete run', () => {
    const run=9.7, count=20, stock=ceilingStock(run,count);
    expect(stock.reduce((sum,item)=>sum+item.cutM,0)).toBeCloseTo(run);
    let end=0; for(const item of stock.slice(0,-1)){end+=item.cutM;expect((end-.1)/((run-.2)/(count-1))).toBeCloseTo(Math.round((end-.1)/((run-.2)/(count-1))));}
    expect(stock.every(item=>item.lengthM<=4.8 && item.lengthM>=item.cutM-1e-8)).toBe(true);
  });
  for (const roof of ['timber', 'mixed'] as const) {
    it(`costs unequal hip-corner wings independently for ${roof}`, () => {
      const selected = { ...input, roof_material: roof, roof_pitch_deg: 3, ceiling: { option: 'cedar-150' as const } };
      const corner = calculateCostV1({ ...selected, length_m: 4.5, roof_span_m: 2, pergola_style: 'hip_corner', hip_corner: { length_b_m: 3, projection_b_m: 6 }, mixed_roof: { mode: 'acrylic_bays', acrylic_bays_by_plane: { A: 2, B: 1 } } });
      const wingA = calculateCostV1({ ...selected, length_m: 4.5, roof_span_m: 2, mixed_roof: { mode: 'acrylic_bays', acrylic_bays_by_plane: { main: 2 } } });
      const wingB = calculateCostV1({ ...selected, length_m: 3, roof_span_m: 6, mixed_roof: { mode: 'acrylic_bays', acrylic_bays_by_plane: { main: 1 } } });
      const ceilings = (result: typeof corner) => result.materials.lines.filter(line => line.id.startsWith('ceiling.'));
      for (const line of ceilings(corner)) {
        const expected = [...ceilings(wingA), ...ceilings(wingB)].filter(part => part.id === line.id && part.unit_cost_ex_gst === line.unit_cost_ex_gst).reduce((sum, part) => sum + part.qty, 0);
        expect(Math.abs(line.qty - expected)).toBeLessThanOrEqual(.011);
      }
      // The long wing must use joined stock with the 30% length-band rate.
      const longStock = ceilings(wingB).find(line => line.id === 'ceiling.cedar-150_lm' && line.notes?.startsWith('30%'))!;
      expect(longStock.qty).toBeGreaterThan(50);
      expect(ceilings(corner).find(line => line.unit_cost_ex_gst === longStock.unit_cost_ex_gst && line.id === longStock.id)!.qty).toBeGreaterThanOrEqual(longStock.qty);
      const swapped = calculateCostV1({ ...selected, length_m: 3, roof_span_m: 6, pergola_style: 'hip_corner', hip_corner: { length_b_m: 4.5, projection_b_m: 2 }, mixed_roof: { mode: 'acrylic_bays', acrylic_bays_by_plane: { A: 1, B: 2 } } });
      expect(ceilings(swapped)).toEqual(ceilings(corner));
    });
  }
  for (const mode of ['ridge_skylight', 'area_override'] as const) {
    it(`allocates ${mode} across unequal wings before selecting stock`, () => {
      const selected: CostInputsV1 = { ...input, roof_material: 'mixed', roof_pitch_deg: 3, ceiling: { option: 'thermopine-100' } };
      const corner = calculateCostV1({ ...selected, length_m: 4.5, roof_span_m: 2, pergola_style: 'hip_corner', hip_corner: { length_b_m: 3, projection_b_m: 6 }, mixed_roof: { mode, acrylic_area_m2: 6 } });
      const a = calculateCostV1({ ...selected, length_m: 4.5, roof_span_m: 2, mixed_roof: { mode, acrylic_area_m2: 2 } });
      const b = calculateCostV1({ ...selected, length_m: 3, roof_span_m: 6, mixed_roof: { mode, acrylic_area_m2: 4 } });
      for (const line of corner.materials.lines.filter(line => line.id.startsWith('ceiling.'))) {
        const expected = [...a.materials.lines, ...b.materials.lines].filter(part => part.id === line.id && part.unit_cost_ex_gst === line.unit_cost_ex_gst).reduce((sum, part) => sum + part.qty, 0);
        expect(Math.abs(line.qty - expected)).toBeLessThanOrEqual(.011);
      }
    });
  }
});
