import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { calculateReviewPrice, calculateConfiguratorPricing } from './configuratorReviewPrice';
import { calculateConfiguredCustomerPriceV1, loadCostingConfigV1 } from '@sp/costing';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';
const approved=JSON.parse(readFileSync('apps/marketing/lib/__fixtures__/approvedConfiguredPrices.json','utf8'));
it('preserves the recorded proposals except the documented mixed-roof takeoff correction',()=>{
  const rows=approved;
  expect(rows).toHaveLength(45);
  for(const row of rows){
    const draft:PreviewDraft={version:1,input:{widthMm:row.w*1000,projectionMm:row.p*1000,level:row.level,connection:'facade'},roof:{family:row.family,orientation:'parallel',infills:false,finish:{material:row.material,layout:'central',acrylicBays:2,profile:row.profile??'corrugated',trayWidth:row.trayWidth??400,ceiling:row.ceiling??'thermopine-100'}}};
    if (row.material !== 'combination') {
      expect(calculateReviewPrice(draft),JSON.stringify(row)).toMatchObject({status:'priced',amount:Math.round(row.proposed)});
      continue;
    }
    // The historical proposal used visible acrylic area and omitted split-roof
    // installation labour. Keep that evidence, not an artificially reduced rate.
    // Provenance: pricing-review-2026-09-11/adapter.ts and package-review.md.
    const config = loadCostingConfigV1();
    const corrected = calculateConfiguratorPricing(draft, config);
    expect(corrected.siteInputs!.pergolas[0].modules[0].mixed_roof).toEqual({
      mode:'acrylic_bays', acrylic_bays_by_plane:{main:2},
    });
    expect(corrected.base!.costingWarnings).toEqual([]);
    expect(corrected.estimate).toMatchObject({status:'priced',amount:18128,excluded:[]});
    const historicalSite = structuredClone(corrected.siteInputs!);
    historicalSite.pergolas[0].modules[0].mixed_roof = {
      mode:'area_override', acrylic_area_m2:3.5760679331494534,
    };
    const historical = calculateConfiguredCustomerPriceV1({site:historicalSite,config,
      footprintM2:18,level:'ground',roofStyle:'pitched'});
    expect(historical.price!.incGst).toBe(row.proposed);
    expect(historical.costingWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({message:expect.stringContaining('0 acrylic/joiner labour drivers')}),
    ]));
  }
});
