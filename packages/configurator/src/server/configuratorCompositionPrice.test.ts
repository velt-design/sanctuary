import {it,expect} from 'vitest';
import {loadCostingConfigV1,ACCESSORY_REVIEW_RATES} from '@sp/costing';
import {DEFAULT_LIGHTING} from '../website/options/lightingSelection';
import type {WebsiteSubmittedDesignV1} from '../website/contracts';
import {calculateConfiguratorCompositionPricing} from './configuratorCompositionPrice';
import {calculateConfiguratorPricing} from './configuratorReviewPrice';
const config={...loadCostingConfigV1(),accessoryRates:structuredClone(ACCESSORY_REVIEW_RATES)};
function design(rafter:boolean):WebsiteSubmittedDesignV1{return {version:1,input:{widthMm:6000,projectionMm:3000,level:'ground',connection:'facade'},roof:{family:'mono',orientation:'parallel',infills:false,
 ...(rafter?{}:{finish:{material:'solid',profile:'corrugated',trayWidth:400,ceiling:'cedar-100',layout:'central',acrylicBays:2}}),
 lighting:{...DEFAULT_LIGHTING,...(rafter?{rafterAmount:'low',rafterCount:5}:{cedarCount:2,cedarPerSection:2,cedarPattern:'rows2'})}}};}
function calculation(a:boolean,b:boolean){const objects=[{objectId:'p1',name:'First',design:design(a)},{objectId:'p2',name:'Second',design:design(b)}];const result=calculateConfiguratorCompositionPricing(objects,config).estimate;if(result.status!=='priced')throw Error('Expected supported composition');expect(result.excluded).toEqual([]);return {result,objects};}
it('charges one shared electrical connection for two actual ceiling-light product layouts',()=>{
 const {result,objects}=calculation(false,false),lines=result.breakdown!;
 expect(lines.filter(l=>l.label==='Lighting connection · whole design')).toHaveLength(1);
 expect(lines.filter(l=>l.label.includes('Ceiling downlights'))).toHaveLength(2);
 for(const object of objects){const single=calculateConfiguratorPricing(object.design,config).estimate;if(single.status!=='priced')throw Error('Expected singleton');const direct=single.breakdown!.find(l=>l.label.startsWith('Ceiling downlights'))!;expect(lines.find(l=>l.label===`${object.name} · ${direct.label}`)?.amount).toBe(direct.amount);}
});
it('does not add a shared connection when rafter startup is already included and preserves each rafter line',()=>{
 const mixed=calculation(true,false).result.breakdown!;
 expect(mixed.filter(l=>l.label.includes('Lighting connection'))).toHaveLength(0);
 expect(mixed.filter(l=>l.label.includes('Rafter lighting'))).toHaveLength(1);
 expect(mixed.filter(l=>l.label.includes('Ceiling downlights'))).toHaveLength(1);
 const rafters=calculation(true,true).result.breakdown!;
 expect(rafters.filter(l=>l.label.includes('Rafter lighting'))).toHaveLength(2);
 expect(rafters.filter(l=>l.label.includes('Lighting connection'))).toHaveLength(0);
});
