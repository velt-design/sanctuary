import {describe, expect, it} from 'vitest';
import {loadCostingConfigV1, ACCESSORY_REVIEW_RATES} from '@sp/costing';
import {calculateConfiguratorCompositionPricing} from '@sp/configurator/server';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '../drawings/state/objectFirstWorkbenchModel';
import {addWebsitePergola, websiteComposition} from './websiteComposition';
import {calculateStudioCommercialPricing} from './studioCommercialPricing.server';
import {parseStudioAuthoringEdit, type StudioAuthoringEdit} from './authoringView';
import { previewBlindOpenings, solvePergolaPreview } from '@sp/configurator/geometry';
import { defaultBlind, defaultSidePanel, DEFAULT_LIGHTING, perimeterLedPreset } from '@sp/configurator/website';
import { pergolaLightSites } from '@sp/geometry';
import { websiteProductPhysical } from './websiteProductPhysical';
import { websiteEligibilityEnvelope } from './websiteEligibilityEnvelope';
const config={...loadCostingConfigV1(),accessoryRates:structuredClone(ACCESSORY_REVIEW_RATES)};
function fixture(){
 const edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'commercial-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
 return addWebsitePergola(edit,'first');
}
describe('Studio complete job pricing',()=>{
 it('prices the exact new Box LED member lengths while retaining saved explicit perimeter IDs',()=>{
  const edit=fixture(),value=edit.objectOptions[0].values.websiteDesign as any;value.selection.roof.family='box';value.selection.roof.attachmentIntent='freestanding';edit.spatial.pergolas[0].family='box';
  const row=websiteComposition(edit)[0],geometry=solvePergolaPreview(row.design!.input,row.design!.roof,row.geometryOptions).geometry!,sites=pergolaLightSites(geometry.assembly,geometry.covering).strips;
  const ids=perimeterLedPreset(sites);value.selection.roof.lighting={...DEFAULT_LIGHTING,strips:ids};
  const length=sites.filter(s=>ids.includes(s.id)).reduce((sum,s)=>sum+Math.hypot(s.end.x-s.start.x,s.end.y-s.start.y,s.end.z-s.start.z)/1000,0);
  const price=calculateStudioCommercialPricing(edit,config);expect(price.breakdown.some(line=>line.label===`LED strips · ${length.toFixed(1)} m`)).toBe(true);
  value.selection.roof.lighting.strips=['box-left','box-rafter-0-0'];const historical=calculateStudioCommercialPricing(edit,config),original=structuredClone(value);
  const restored=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(edit)));if(!restored.ok)throw Error(restored.message);expect(calculateStudioCommercialPricing(restored.value,config)).toEqual(historical);expect(value).toEqual(original);
 });
 it('prices every independent side through actual accessory geometry and retains rear selection through safe JSON reload',()=>{
  const edit=fixture(),value=edit.objectOptions[0].values.websiteDesign as any;
  value.selection.roof.attachmentIntent='freestanding';value.selection.roof.family='box';edit.spatial.pergolas[0].family='box';
  let row=websiteComposition(edit)[0];const openings=previewBlindOpenings(row.design!.input,row.design!.roof,row.geometryOptions);
  expect(new Set(openings.map(o=>o.side))).toEqual(new Set(['front','left','right','rear']));
  const base=calculateStudioCommercialPricing(edit,config);
  value.selection.roof.blinds=openings.map(o=>defaultBlind(o.id));
  const blindPrice=calculateStudioCommercialPricing(edit,config);
  expect(blindPrice.amount).toBeGreaterThan(base.amount);
  expect(blindPrice.breakdown.filter(line=>line.label.includes('Ziptrak'))).toHaveLength(openings.length);
  expect(blindPrice.breakdown.some(line=>line.label.includes('Rear 1'))).toBe(true);
  row=websiteComposition(edit)[0];const blindPhysical=websiteProductPhysical(row,true);
  expect(blindPhysical.collisionFaces.some(face=>face.id.includes('rear-1of2'))).toBe(true);
  value.selection.roof.blinds=[];value.selection.roof.sidePanels=openings.map(o=>defaultSidePanel(o.id,'timber'));
  const fixedPrice=calculateStudioCommercialPricing(edit,config);expect(fixedPrice.amount).toBeGreaterThan(base.amount);
  row=websiteComposition(edit)[0];const physical=websiteProductPhysical(row,true),geometry=solvePergolaPreview(row.design!.input,row.design!.roof,row.geometryOptions).geometry!;
  expect(physical.points.every(p=>[p.x,p.y,p.z].every(Number.isFinite))).toBe(true);
  expect(physical.collisionFaces.some(face=>face.id==='cover-or-accessory')).toBe(true);
  const envelope=websiteEligibilityEnvelope(row.design!,geometry,row.geometryOptions);
  expect(envelope.every(p=>[p.x,p.y,p.z].every(Number.isFinite))).toBe(true);
  const reopened=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(edit)));if(!reopened.ok)throw Error(reopened.message);
  expect(reopened.value.objectOptions).toEqual(edit.objectOptions);
  expect(calculateStudioCommercialPricing(reopened.value,config)).toEqual(fixedPrice);
 });
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
