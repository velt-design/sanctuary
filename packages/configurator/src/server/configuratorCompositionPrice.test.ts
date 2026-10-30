import {it,expect} from 'vitest';
import {loadCostingConfigV1,ACCESSORY_REVIEW_RATES} from '@sp/costing';
import {DEFAULT_LIGHTING} from '../website/options/lightingSelection';
import type {WebsiteSubmittedDesignV1} from '../website/contracts';
import {calculateConfiguratorCompositionPricing} from './configuratorCompositionPrice';
import {calculateConfiguratorPricing} from './configuratorReviewPrice';
import {solvePergolaPreview} from '../geometry';
import {pergolaLightSites} from '@sp/geometry';
import {effectiveLightingLayout} from '../website/options/lightingSelection';
const config={...loadCostingConfigV1(),accessoryRates:structuredClone(ACCESSORY_REVIEW_RATES)};
function design(rafter:boolean):WebsiteSubmittedDesignV1{return {version:1,input:{widthMm:6000,projectionMm:3000,level:'ground',connection:'facade'},roof:{family:'mono',orientation:'parallel',infills:false,
 ...(rafter?{}:{finish:{material:'solid',profile:'corrugated',trayWidth:400,ceiling:'cedar-100',layout:'central',acrylicBays:2}}),
 lighting:{...DEFAULT_LIGHTING,...(rafter?{rafterAmount:'low',rafterCount:5}:{cedarCount:2,cedarPerSection:2,cedarPattern:'rows2'})}}};}
function calculation(a:boolean,b:boolean){const objects=[{objectId:'p1',name:'First',design:design(a)},{objectId:'p2',name:'Second',design:design(b)}];const result=calculateConfiguratorCompositionPricing(objects,config).estimate;if(result.status!=='priced')throw Error('Expected supported composition');expect(result.excluded).toEqual([]);return {result,objects};}
it('charges the same corrected Box spot quantity shown by canonical geometry while retaining saved lighting intent',()=>{
 const value=design(true);value.roof.family='box';value.roof.attachmentIntent='freestanding';
 const initial=solvePergolaPreview(value.input,value.roof).geometry!;
 value.roof.lighting={...DEFAULT_LIGHTING,rafterAmount:'medium',rafterCount:10,strips:pergolaLightSites(initial.assembly,initial.covering).strips.filter(s=>s.perimeter).map(s=>s.id)};
 const before=structuredClone(value),geometry=solvePergolaPreview(value.input,value.roof).geometry!,layout=effectiveLightingLayout(pergolaLightSites(geometry.assembly,geometry.covering),value.roof.lighting);
 expect(layout.rafters).toHaveLength(8);expect(layout.strips.filter(s=>s.rafter).map(s=>s.start.x)).toEqual([660,5340]);
 const result=calculateConfiguratorPricing(value,config).estimate;if(result.status!=='priced')throw Error('Expected priced canonical Box');
 expect(result.breakdown!.find(l=>l.label.startsWith('Rafter lighting'))!.label).toBe('Rafter lighting · 8 lights');
 expect(value).toEqual(before);expect(value.roof.lighting.rafterCount).toBe(10);
});
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

it('prices actual singleton ceiling intent even when its retained total is zero and no other accessories are selected',()=>{
 const value=design(false);value.input.widthMm=5600;value.roof.lighting={...DEFAULT_LIGHTING,cedarPerSection:4,cedarPattern:'rows2'};
 const before=structuredClone(value),geometry=solvePergolaPreview(value.input,value.roof).geometry!;
 const layout=effectiveLightingLayout(pergolaLightSites(geometry.assembly,geometry.covering),value.roof.lighting);expect(layout.cedar).toHaveLength(4);
 const result=calculateConfiguratorPricing(value,config).estimate;if(result.status!=='priced')throw Error('Expected priced singleton');
 expect(result.excluded).toEqual([]);expect(result.breakdown!.some(line=>line.label==='Ceiling downlights \u00b7 4 lights')).toBe(true);
 const without=structuredClone(value);without.roof.lighting={...DEFAULT_LIGHTING};const base=calculateConfiguratorPricing(without,config).estimate;if(base.status!=='priced')throw Error('Expected unlit fixture');
 const explicit=structuredClone(value);explicit.roof.lighting!.cedarCount=4;expect(calculateConfiguratorPricing(explicit,config).estimate).toEqual(result);
 expect(result.breakdown![0]).toEqual(base.breakdown![0]);expect(result.amount).toBeGreaterThan(base.amount);expect(value).toEqual(before);
});
