import { describe, expect, it } from 'vitest';
import { loadCostingConfigV1 } from './engine/config';
import { calculateCostV1, calculateSiteCostV1 } from './engine/calculate';
import { COSTING_CONTROL_PREVIEW_SCENARIOS_V1 } from './controlConfig';
const config = (version='v2.8') => ({...loadCostingConfigV1(),appliedControlManifestVersion:version});
const site = () => structuredClone(COSTING_CONTROL_PREVIEW_SCENARIOS_V1[0].inputs);
const panel = {id:'side',location:'side' as const,acrylic_source:'sheet_panels' as const,panel_orientation:'vertical' as const,width_mode:'target_width' as const,support:{has_top:true,has_bottom:true,has_left:true,has_right:true,internal_support_mode:'none' as const},shape:{type:'rect' as const,width_m:2,height_m:2.4}};
describe('v2.8 owner pricing candidate',()=>{
  it('does not increase existing productive actions when only an acrylic side is added',()=>{
    const s=site();s.pricing_classification='simple';const before=calculateSiteCostV1(s,config());s.pergolas[0].modules[0].infills=[panel];const after=calculateSiteCostV1(s,config());
    const id=before.install.actions.find(a=>a.id.includes('frame.square_level_frame'))!.id;
    expect(after.install.actions.find(a=>a.id===id)?.cost_ex_gst).toBe(before.install.actions.find(a=>a.id===id)?.cost_ex_gst);
    expect(after.install.actions.some(a=>a.id.includes('infill.install_sheet_panels'))).toBe(true);
    expect(after.overhead.sales_ex_gst).toBe(0);
    expect(calculateSiteCostV1(s,config('v2.7')).overhead.sales_ex_gst).toBe(1200);
    s.pricing_classification='bespoke';expect(calculateSiteCostV1(s,config()).overhead.sales_ex_gst).toBe(1200);
  });
  it.each([[3,'pitched','50x50'],[4,'pitched','50x50'],[4.1,'pitched','80x50'],[6,'gable','50x50'],[8.2,'gable','80x50']] as const)('sizes solid rafters for %s m %s', (span,style,profile)=>{
    const m={...site().pergolas[0].modules[0],roof_material:'timber' as const,pergola_style:style,roof_span_m:span};
    const result=calculateCostV1(m,config());expect(result.inputs_normalized.rafter_profile).toBe(profile);
    expect(result.derived.timber_purlin_lines_per_plane).toBe(Math.ceil(Math.max(0,result.derived.timber_slope_len_per_plane_m*1000-200)/600)+1);
    expect(calculateCostV1(m,config('v2.7')).inputs_normalized.rafter_profile).toBe('80x50');
  });
  it('retains acrylic sizing and explicit staff overrides',()=>{
    const m={...site().pergolas[0].modules[0],roof_span_m:5};expect(calculateCostV1(m,config()).inputs_normalized.rafter_profile).toBe('150x50');
    expect(calculateCostV1({...m,roof_material:'timber',overrides:{rafter_profile:'100x50'}},config()).inputs_normalized.rafter_profile).toBe('100x50');
  });
});

it('uses standard fitting time for the new small rafters instead of custom fabrication',()=>{
  const m={...site().pergolas[0].modules[0],roof_material:'timber' as const,roof_span_m:3,pergola_style:'gable' as const};
  const current=calculateCostV1(m,config());
  const larger=calculateCostV1({...m,overrides:{rafter_profile:'80x50'}},config());
  const action=(r:typeof current)=>r.install.actions.find(a=>a.id==='rafters.install_rafter_gable')!;
  expect(action(current).minutes).toBe(action(larger).minutes);
});
