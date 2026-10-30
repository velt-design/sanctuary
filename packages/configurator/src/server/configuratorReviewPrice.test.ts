import {describe,it,expect} from 'vitest';
import {loadCostingConfigV1,ACCESSORY_REVIEW_RATES} from '@sp/costing';
import type {WebsiteSubmittedDesignV1} from '../website/contracts';
import {calculateConfiguratorPricing} from './configuratorReviewPrice';
import {calculateConfiguratorCompositionPricing} from './configuratorCompositionPrice';
const current={...loadCostingConfigV1(),accessoryRates:structuredClone(ACCESSORY_REVIEW_RATES)};
function draft(family:'mono'|'gable'|'box',material:'acrylic'|'solid'|'combination'):WebsiteSubmittedDesignV1{return {version:1,input:{widthMm:6000,projectionMm:3000,level:'ground',connection:'facade'},roof:{family,orientation:'parallel',infills:false,finish:{material,layout:'central',acrylicBays:2,profile:'corrugated',trayWidth:400,ceiling:'thermopine-100'}}};}
describe('published Standard eligibility shared by website and Studio',()=>{
 it.each(['mono','gable','box'] as const)('keeps historical classification and applies released policy for %s',family=>{
  for(const material of ['acrylic','solid','combination'] as const){const design=draft(family,material);
   for(const version of ['v2.8','v2.9','v2.10']){const config={...current,appliedControlManifestVersion:version},result=calculateConfiguratorPricing(design,config);
    expect(result.estimate.status).toBe('priced');expect(result.siteInputs?.pricing_classification).toBe(version==='v2.10'||family==='mono'&&material==='acrylic'?'simple':'bespoke');
    expect(calculateConfiguratorCompositionPricing([{objectId:'a',name:'First',design}],config)).toEqual(result);
   }
  }
 });
 it.each(['ground','elevated'] as const)('keeps exact %s area boundary before Standard request',level=>{
  const design=draft('gable','solid');design.input={...design.input,level,widthMm:level==='ground'?6000:5000,projectionMm:level==='ground'?5000:4000};
  expect(calculateConfiguratorPricing(design,current).siteInputs?.pricing_classification).toBe('simple');
  design.input.widthMm+=1;expect(calculateConfiguratorPricing(design,current)).toMatchObject({estimate:{status:'custom'}});
 });
 it('uses returned per-object classification for mixed-family aggregate and its protected floors',()=>{
  const objects=[{objectId:'a',name:'First',design:draft('mono','acrylic')},{objectId:'b',name:'Second',design:draft('gable','solid')}];
  for(const version of ['v2.9','v2.10']){const config={...current,appliedControlManifestVersion:version};const result=calculateConfiguratorCompositionPricing(objects,config);
   expect(result.estimate.status).toBe('priced');expect(result.siteInputs?.pricing_classification).toBe(version==='v2.10'?'simple':'bespoke');
   const reordered=calculateConfiguratorCompositionPricing([...objects].reverse(),config).estimate; if(result.estimate.status!=='priced'||reordered.status!=='priced')throw Error('Expected priced composition'); expect(reordered.amount).toBe(result.estimate.amount);
  }
 });
});
