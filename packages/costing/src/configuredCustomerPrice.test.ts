import { describe, expect, it } from 'vitest';
import { calculateConfiguredCustomerPriceV1 } from './configuredCustomerPrice';
import { loadCostingConfigV1 } from './engine/config';
import { calculateSiteCostV1 } from './engine/calculate';
import { COSTING_CONTROL_PREVIEW_SCENARIOS_V1 } from './controlConfig';
const request = () => ({site:structuredClone(COSTING_CONTROL_PREVIEW_SCENARIOS_V1[0].inputs),config:loadCostingConfigV1(),footprintM2:18,level:'ground' as const,roofStyle:'pitched' as const});
describe('configured offer policy',()=>{
  it('removes design cost while preserving operational costs and installer allowance',()=>{
    const r=request();r.site.pricing_classification='bespoke';const before=JSON.stringify(r);
    const base=calculateSiteCostV1(r.site,r.config), result=calculateConfiguredCustomerPriceV1(r);
    expect(result.designAllowanceRemovedExGst).toBe(1200);
    expect(result.operationalOverheadExGst).toBe(base.overhead.ops_ex_gst);
    expect(result.protectedInstallationExGst).toBeGreaterThanOrEqual(base.install.totals.install_ex_gst);
    expect(result.protectedInstallationExGst).toBeGreaterThanOrEqual(1886.96);
    expect(JSON.stringify(r)).toBe(before);
    expect(calculateSiteCostV1(r.site,r.config)).toEqual(base);
  });
  it.each([['ground',30],['elevated',20]] as const)('enforces the %s area limit', (level,limit)=>{
    expect(()=>calculateConfiguredCustomerPriceV1({...request(),level,footprintM2:limit})).not.toThrow();
    expect(()=>calculateConfiguredCustomerPriceV1({...request(),level,footprintM2:limit+.001})).toThrow('limit');
  });
  it('refuses empty/multiple scopes and invalid area',()=>{
    const r=request();r.site.pergolas=[];
    expect(()=>calculateConfiguredCustomerPriceV1(r)).toThrow('one pergola');
    expect(()=>calculateConfiguredCustomerPriceV1({...request(),footprintM2:NaN})).toThrow('Invalid');
  });
});
