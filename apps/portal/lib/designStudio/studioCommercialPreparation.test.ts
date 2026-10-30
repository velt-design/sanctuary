import {afterEach,expect,it,vi} from 'vitest';
import {loadCostingConfigV1, ACCESSORY_REVIEW_RATES} from '@sp/costing';
import * as compositionOwner from './websiteComposition';
import * as eligibilityOwner from './websiteCompositionEligibility';
import {prepareStudioCreation} from './createPreparation';
import {projectStudioAuthoringView,createStudioAuthoringEdit,mergeStudioAuthoringEdit} from './authoringView';
import {studioPriceComposition} from './studioWebsitePricing.server';
import {applyStudioHouseEdit} from './houseEditing';
import {defaultSidePanel} from '@sp/configurator/website';
import {previewBlindOpenings} from '@sp/configurator/geometry';
import {calculateStudioCommercialPricing,prepareStudioCommercialPricing} from './studioCommercialPricing.server';
const config={...loadCostingConfigV1(),accessoryRates:structuredClone(ACCESSORY_REVIEW_RATES)};
function fixture(){
 const made=prepareStudioCreation({mode:'blank',projectId:'proj_10000000-0000-4000-8000-000000000001',designId:'preparation-proof',commercialScopeId:null});if(!made.ok)throw Error(made.message);
 const outputs=made.prepared.row.outputs,view=projectStudioAuthoringView({authored:outputs.studio_authored,spatial:outputs.drawing_object_first});if(!view.ok)throw Error(view.message);
 const edit=compositionOwner.addWebsitePergola(createStudioAuthoringEdit(view.value),'first');
 const merged=mergeStudioAuthoringEdit({storedAuthored:outputs.studio_authored,storedSpatial:outputs.drawing_object_first,edit});if(!merged.ok)throw Error(merged.message);
 return{edit,outputs:{...outputs,studio_authored:merged.value.authored,drawing_object_first:merged.value.spatial}};
}
afterEach(()=>vi.restoreAllMocks());
it('prepares the actual website composition and physical eligibility once across request preparation and commercial calculation',async()=>{
 const {edit,outputs}=fixture(),composition=vi.spyOn(compositionOwner,'websiteComposition'),eligibility=vi.spyOn(eligibilityOwner,'websiteCompositionPriceEligibility');
 const prepared=await studioPriceComposition(outputs,edit);if(!prepared.ok)throw Error(prepared.message);
 expect(prepared.preparedPricing.calculate(config).status).toBe('priced');
 expect(composition).toHaveBeenCalledTimes(1);expect(eligibility).toHaveBeenCalledTimes(1);
});

it.each(['attached-default','box-mixed-four-sides','gable','house'] as const)('retains every calculation field for %s and does not mutate its input',kind=>{
 let {edit}=fixture();
 const value=edit.objectOptions[0].values.websiteDesign as any;
 if(kind==='box-mixed-four-sides'){
  value.selection.roof.family='box';value.selection.roof.attachmentIntent='freestanding';value.selection.roof.finish={material:'combination',layout:'central',acrylicBays:2,profile:'corrugated',trayWidth:400,ceiling:'cedar-100'};edit.spatial.pergolas[0].family='box';
  const row=compositionOwner.websiteComposition(edit)[0];
  const openings=previewBlindOpenings(row.design!.input,row.design!.roof,row.geometryOptions);
  value.selection.roof.sidePanels=openings.map(opening=>defaultSidePanel(opening.id,'timber'));
  expect(new Set(openings.map(opening=>opening.side))).toEqual(new Set(['front','left','right','rear']));
 }
 if(kind==='gable'){value.selection.roof.family='gable';value.selection.roof.orientation='away';edit.spatial.pergolas[0].family='gable';}
 if(kind==='house'){
  const added=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'house'});if(!added.ok)throw Error(added.message);edit={...edit,spatial:added.spatial};
 }
 edit.site.travelExGst='125';edit.site.quoteDiscountPct='5';
 const before=structuredClone(edit),expected=calculateStudioCommercialPricing(edit,config),prepared=prepareStudioCommercialPricing(edit);
 expect(prepared.calculate(config)).toEqual(expected);expect(edit).toEqual(before);
});

it('captures only the prepared current snapshot and takes each fresh config without re-preparing geometry',()=>{
 const {edit}=fixture(),added=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'house'});if(!added.ok)throw Error(added.message);edit.spatial=added.spatial;
 const original=structuredClone(edit),expected=calculateStudioCommercialPricing(edit,config),prepared=prepareStudioCommercialPricing(edit);
 const composition=vi.spyOn(compositionOwner,'websiteComposition'),eligibility=vi.spyOn(eligibilityOwner,'websiteCompositionPriceEligibility');
 // All caller-owned paths can change after preparation, including the exposed inspection copy.
 edit.site.travelExGst='999';edit.site.websiteJoins={bad:'caller-change'};edit.spatial.pergolas=[];edit.objectOptions=[];edit.spatial.houseAssembly!.houseForms[0].roofIntent.primaryPitchDeg='bad';
 prepared.composition[0].object.label='Changed inspection label';prepared.composition[0].design!.input.widthMm=1234;
 const first=prepared.calculate(config);expect(first).toEqual(expected);
 first.resolvedObjects[0].design!.input.widthMm=1234;first.resolvedObjects[0].object.label='Changed returned label';
 const changedConfig=structuredClone(config);changedConfig.commercialPolicy.customer_pricing.multiplier=1.5;
 const fresh=prepared.calculate(changedConfig);expect(fresh.amount).not.toBe(expected.amount);
 expect(composition).not.toHaveBeenCalled();expect(eligibility).not.toHaveBeenCalled();
 expect(fresh).toEqual(calculateStudioCommercialPricing(original,changedConfig));
 expect(prepared.calculate(config)).toEqual(expected);expect(Object.isFrozen(prepared)).toBe(true);
});

it.each(['invalid-number','missing-option','invalid-join','empty'] as const)('preserves ordinary and prepared refusal for %s',kind=>{
 const {edit}=fixture();
 if(kind==='invalid-number')(edit.objectOptions[0].values.websiteDesign as any).rawDimensions.widthMm='-';
 if(kind==='missing-option')edit.objectOptions=[];
 if(kind==='invalid-join')edit.site.websiteJoins={schemaVersion:'website_joins.v1',joins:[{broken:true}]};
 if(kind==='empty'){edit.spatial.pergolas=[];edit.objectOptions=[];}
 let expected='';try{calculateStudioCommercialPricing(edit,config);}catch(error){expected=(error as Error).message;}
 expect(expected).not.toBe('');expect(()=>prepareStudioCommercialPricing(edit).calculate(config)).toThrow(expected);
});

it('retains website unsupported-first422 and ordinary composition-first refusal differences',async()=>{
 const {edit,outputs}=fixture();edit.spatial.openings.push({id:'window',label:'Window',kind:'window',panelCount:null,hostWallId:null,widthM:'1',heightM:'1',sillHeightM:'1',offsetAlongWallM:'0'});
 (edit.objectOptions[0].values.websiteDesign as any).rawDimensions.widthMm='-';
 const result=await studioPriceComposition(outputs,edit);
 expect(result).toEqual({ok:false,message:'This design contains scope not supported by configured pricing.',status:422});
 expect(()=>calculateStudioCommercialPricing(edit,config)).toThrow('Enter a positive whole millimetre value for width.');
});

it('keeps ordinary house-first validation and website house calculation errors after preparation',()=>{
 const {edit}=fixture(),added=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'house'});if(!added.ok)throw Error(added.message);edit.spatial=added.spatial;
 edit.spatial.houseAssembly!.houseForms[0].position={originXMm:'0',originYMm:'0',rotationDeg:'wrong'};
 expect(()=>calculateStudioCommercialPricing(edit,config)).toThrow(/house/i);
 expect(()=>prepareStudioCommercialPricing(edit).calculate(config)).toThrow(/house/i);
});
