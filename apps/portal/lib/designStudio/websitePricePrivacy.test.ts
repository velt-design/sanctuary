import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {loadCostingConfigV1,ACCESSORY_REVIEW_RATES,getDefaultInstalledSellingRates} from '@sp/costing';
import {prepareStudioCreation} from './createPreparation';
import {projectStudioAuthoringView,createStudioAuthoringEdit,mergeStudioAuthoringEdit} from './authoringView';
import {addWebsitePergola} from './websiteComposition';
const mocks=vi.hoisted(()=>({auth:vi.fn(),detail:vi.fn(),version:vi.fn(),published:vi.fn()}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:mocks.auth,jsonOk:(body:unknown)=>Response.json(body),jsonError:(error:string,status:number)=>Response.json({error},{status})}));
vi.mock('@/lib/estimates/loadProjectEstimateDetail',()=>({loadProjectEstimateDetail:mocks.detail}));
vi.mock('@/lib/costing/configurationResolver',()=>({getCostingConfigurationVersionById:mocks.version}));
vi.mock('@sp/costing/server',()=>({resolvePublishedCostingConfigurationRecordV1:mocks.published}));
import {studioWebsitePriceRequest} from './websitePriceRequest.server';
const projectId='proj_10000000-0000-4000-8000-000000000001',estimateId='est_10000000-0000-4000-8000-000000000002';
beforeEach(()=>{vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','1');mocks.detail.mockResolvedValue({id:estimateId,projectId,status:'draft',editability:{isLocked:false,hasDraftQuotes:false,draftQuoteCount:0}});mocks.published.mockReturnValue({config:{...loadCostingConfigV1(),accessoryRates:ACCESSORY_REVIEW_RATES,installedSellingRates:getDefaultInstalledSellingRates()},provenance:{versionNumber:15,contentHash:'a'.repeat(64)}});});
afterEach(()=>vi.unstubAllEnvs());
function source(role:'admin'|'staff'){
 const made=prepareStudioCreation({mode:'blank',projectId,designId:'privacy-proof',commercialScopeId:null});if(!made.ok)throw Error(made.message);
 const outputs=made.prepared.row.outputs,view=projectStudioAuthoringView({authored:outputs.studio_authored,spatial:outputs.drawing_object_first});if(!view.ok)throw Error(view.message);
 const edit=addWebsitePergola(createStudioAuthoringEdit(view.value),'pergola');edit.site={travelExGst:'123'};
 const saved=mergeStudioAuthoringEdit({storedAuthored:outputs.studio_authored,storedSpatial:outputs.drawing_object_first,edit});if(!saved.ok)throw Error(saved.message);
 const data={outputs:{studio_authored:saved.value.authored,drawing_object_first:saved.value.spatial},status:'draft'};
 const supabase={from:(table:string)=>{const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:table==='estimates'?data:{current_version_id:'published'},error:null})};return query;}};
 mocks.auth.mockResolvedValue({ok:true,session:{role,user:{id:'actor'}},supabase});
 return {designId:edit.designId,revision:edit.revision,composition:edit,requestKey:'privacy-proof'};
}
it('keeps current engine costs exclusively in the authenticated admin response',async()=>{
 const send=(role:'admin'|'staff')=>studioWebsitePriceRequest(new Request('http://localhost/api/price',{method:'POST',body:JSON.stringify(source(role))}),{projectId,estimateId});
 const staff=await send('staff'),admin=await send('admin');expect(staff.status).toBe(200);expect(admin.status).toBe(200);
 const staffBody=await staff.json(),adminBody=await admin.json();expect(staffBody.amount).toBe(adminBody.amount);
 expect(staffBody.siteAssumptions).toEqual({access:'Normal',height:'Single storey',jobType:'Residential',pricingClassification:'Simple',approvalRequirement:'Neither'});
 expect(staffBody).not.toHaveProperty('internalCosts');expect(staffBody).not.toHaveProperty('siteOutput');
 expect(adminBody.internalCosts.travelExGst).toBe(123);expect(Object.keys(adminBody.internalCosts).sort()).toEqual(['crewHours','engineCostExGst','extrasExGst','installExGst','materialsExGst','overheadExGst','travelExGst']);
 expect(adminBody).not.toHaveProperty('siteOutput');expect(adminBody).not.toHaveProperty('config');
 const forged=await studioWebsitePriceRequest(new Request('http://localhost/api/price',{method:'POST',body:JSON.stringify({...source('staff'),role:'admin'})}),{projectId,estimateId});expect(forged.status).toBe(400);
});

it('returns the current effective site assumptions with explicit staff choices, without pricing internals',async()=>{
 const payload=source('staff');payload.composition.site={...payload.composition.site,access:'hard',height:'two_storey',jobType:'commercial',pricingClassification:'bespoke'};
 const response=await studioWebsitePriceRequest(new Request('http://localhost/api/price',{method:'POST',body:JSON.stringify(payload)}),{projectId,estimateId});expect(response.status).toBe(200);
 const body=await response.json();expect(body.siteAssumptions).toMatchObject({access:'Difficult',height:'Two storey',jobType:'Commercial',pricingClassification:'Bespoke'});expect(body).not.toHaveProperty('siteInputs');expect(body).not.toHaveProperty('config');
});
