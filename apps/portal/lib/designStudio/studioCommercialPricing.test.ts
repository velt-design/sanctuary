import {describe, expect, it} from 'vitest';
import {loadCostingConfigV1, ACCESSORY_REVIEW_RATES} from '@sp/costing';
import {calculateConfiguratorCompositionPricing} from '@sp/configurator/server';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '../drawings/state/objectFirstWorkbenchModel';
import {addWebsitePergola, websiteComposition} from './websiteComposition';
import {calculateStudioCommercialPricing} from './studioCommercialPricing.server';
import {parseStudioAuthoringEdit, type StudioAuthoringEdit} from './authoringView';
const config={...loadCostingConfigV1(),accessoryRates:structuredClone(ACCESSORY_REVIEW_RATES)};
function fixture(){
 const edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'commercial-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
 return addWebsitePergola(edit,'first');
}
describe('Studio complete job pricing',()=>{
 it('retains the public configured price without staff overrides',()=>{
  const edit=fixture(),objects=websiteComposition(edit);
  const shared=calculateConfiguratorCompositionPricing(objects.map(row=>({objectId:row.object.id,name:row.object.label,design:row.design!,geometryOptions:row.geometryOptions})),config);
  expect(shared.estimate.status).toBe('priced');
  expect(calculateStudioCommercialPricing(edit,config).amount).toBe(shared.estimate.status==='priced'?shared.estimate.amount:NaN);
 });
 it('prices retained staff inputs and discount through save/reload with one shared job',()=>{
  const edit=addWebsitePergola(fixture(),'second');
  edit.site={access:'hard',height:'two_storey',jobType:'commercial',pricingClassification:'bespoke',approvalRequirement:'engineering_required',travelExGst:'125',extrasAllowanceExGst:'250',quoteDiscountPct:'5'};
  const priced=calculateStudioCommercialPricing(edit,config);
  expect(priced.siteInputs.travel_ex_gst).toBe(125);
  expect(priced.siteInputs.extras_allowance_ex_gst).toBe(250);
  expect(priced.siteInputs.pergolas).toHaveLength(2);
  expect(priced.siteInputs.pergolas.every(p=>p.modules.every(m=>m.access==='hard'&&m.height==='two_storey'))).toBe(true);
  const restored=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(edit)));
  if(!restored.ok)throw Error(restored.message);
  expect(calculateStudioCommercialPricing(restored.value,config).amount).toBe(priced.amount);
  expect(priced.breakdown.filter(l=>l.label==='Engineering allowance')).toHaveLength(1);
  expect(priced.amount).toBeCloseTo(priced.breakdown.reduce((sum,line)=>sum+line.amount,0),2);
 });
 it('preserves visible white frame selection in the costing module',()=>{
  const edit=fixture();(edit.objectOptions[0].values.websiteDesign as any).selection.roof.frameFinish='white';
  const price=calculateStudioCommercialPricing(edit,config);
  expect(price.siteInputs.pergolas[0].modules[0].extrusion_colour).toBe('White');
 });
 it('fails closed for malformed site fields and unresolved added items',()=>{
  const edit=fixture();edit.site.travelExGst='not a cost';
  expect(()=>calculateStudioCommercialPricing(edit,config)).toThrow(/travel/);
  edit.site={blinds:{items:[{id:'blind',system:'ZIPTRAK',fabric:'MESH',widthMm:'',coverLengthMm:'3000',motorised:'NONE',rollCover:'NONE'}]}};
  expect(()=>calculateStudioCommercialPricing(edit,config)).toThrow(/blind width/);
 });
});
