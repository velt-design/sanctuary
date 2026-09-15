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
});
