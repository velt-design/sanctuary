import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {loadCostingConfigV1,ACCESSORY_REVIEW_RATES,getDefaultInstalledSellingRates,snapshotCostingControlConfigV1} from '@sp/costing';
import {hashCostingControlConfig} from '@/lib/costing/configurationShared';
import {prepareStudioCreation} from './createPreparation';
import {projectStudioAuthoringView,createStudioAuthoringEdit,mergeStudioAuthoringEdit} from './authoringView';
import {addWebsitePergola} from './websiteComposition';
import type {StudioWebsiteDesign} from './websiteDesign';
import {signStudioSelectedAddress,signStudioTravelReceipt} from './studioTravelReceipt.server';
import {studioTravelTotalCents} from './studioTravelAllowance';
import {studioTravelPlanForReceipt} from './studioTravelPlan';
vi.mock('@/lib/projects/siteAddress.server',()=>({readProjectSiteAddress:async()=>({site_address:'12 Example Road, Auckland, New Zealand'})}));
const mocks=vi.hoisted(()=>({auth:vi.fn(),detail:vi.fn()}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:mocks.auth,jsonOk:(body:unknown)=>Response.json(body),jsonError:(error:string,status:number)=>Response.json({error},{status})}));
vi.mock('./studioEstimateContext.server',()=>({loadStudioEstimateEditability:mocks.detail}));
import {studioWebsitePriceRequest} from './websitePriceRequest.server';
const projectId='proj_10000000-0000-4000-8000-000000000001',estimateId='est_10000000-0000-4000-8000-000000000002';
beforeEach(()=>{vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','1');mocks.detail.mockResolvedValue({isLocked:false,hasDraftQuotes:false,draftQuoteCount:0});});
afterEach(()=>vi.unstubAllEnvs());
function source(role:'admin'|'staff'){
 const made=prepareStudioCreation({mode:'blank',projectId,designId:'privacy-proof',commercialScopeId:null});if(!made.ok)throw Error(made.message);
 const outputs=made.prepared.row.outputs,view=projectStudioAuthoringView({authored:outputs.studio_authored,spatial:outputs.drawing_object_first});if(!view.ok)throw Error(view.message);
 const edit=addWebsitePergola(createStudioAuthoringEdit(view.value),'pergola');edit.site={travelExGst:'123'};
 const saved=mergeStudioAuthoringEdit({storedAuthored:outputs.studio_authored,storedSpatial:outputs.drawing_object_first,edit});if(!saved.ok)throw Error(saved.message);
 const data={id:estimateId.slice(4),project_id:projectId.slice(5),outputs:{studio_authored:saved.value.authored,drawing_object_first:saved.value.spatial},status:'draft'};
 const config=snapshotCostingControlConfigV1({...loadCostingConfigV1(),accessoryRates:ACCESSORY_REVIEW_RATES,installedSellingRates:getDefaultInstalledSellingRates()});
 const version={id:'published',version_number:15,name:'Private synthetic pricebook',purpose:'Privacy test',status:'published',schema_version:config.schemaVersion,base_manifest_version:config.baseManifestVersion,based_on_version_id:null,config_json:config,content_hash:hashCostingControlConfig(config),created_at:'2026-10-22T00:00:00Z',created_by_email:'test@example.invalid',updated_at:'2026-10-22T00:00:00Z',updated_by_email:'test@example.invalid',published_at:'2026-10-22T00:00:00Z',published_by_email:'test@example.invalid',publish_note:'Synthetic test',publication_diff:[],publication_impact:[]};
 const supabase={from:(table:string)=>{const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:table==='estimates'?data:{current_version_id:'published',version},error:null})};return query;}};
 mocks.auth.mockResolvedValue({ok:true,session:{role,user:{id:'actor'}},supabase});
 return {designId:edit.designId,revision:edit.revision,composition:edit,requestKey:'privacy-proof'};
}
it('keeps current engine costs exclusively in the authenticated admin response',async()=>{
 const send=(role:'admin'|'staff')=>studioWebsitePriceRequest(new Request('http://localhost/api/price',{method:'POST',body:JSON.stringify(source(role))}),{projectId,estimateId});
 const staff=await send('staff'),admin=await send('admin');expect(staff.status).toBe(200);expect(admin.status).toBe(200);
 const staffBody=await staff.json(),adminBody=await admin.json();expect(staffBody.amount).toBe(adminBody.amount);
 expect(staffBody.siteAssumptions).toEqual({access:'Normal',height:'Single storey',jobType:'Residential',pricingClassification:'Simple',approvalRequirement:'Neither'});
 expect(staffBody).not.toHaveProperty('internalCosts');expect(staffBody).not.toHaveProperty('siteOutput');
 expect(Object.keys(staffBody.installationEstimate)).toEqual(['siteDays']);expect(staffBody.installationEstimate.siteDays).toBeGreaterThan(0);
 expect(adminBody.internalCosts.travelExGst).toBe(123);expect(Object.keys(adminBody.internalCosts).sort()).toEqual(['crewHours','engineCostExGst','extrasExGst','installExGst','materialsExGst','overheadExGst','travelExGst']);
 expect(adminBody).not.toHaveProperty('siteOutput');expect(adminBody).not.toHaveProperty('config');
 const forged=await studioWebsitePriceRequest(new Request('http://localhost/api/price',{method:'POST',body:JSON.stringify({...source('staff'),role:'admin'})}),{projectId,estimateId});expect(forged.status).toBe(400);
});

it('returns fresh canonical days without approving pending, legacy or stale automatic travel, then prices the matching plan',async()=>{
 vi.stubEnv('STUDIO_TRAVEL_SIGNING_KEY','ab'.repeat(32));
 const payload=source('staff'),edit=payload.composition;
 (edit.objectOptions[0].values.websiteDesign as unknown as StudioWebsiteDesign).rawDimensions={widthMm:'6000',projectionMm:'4000'};
 const destinationCanonical='12 Example Road, Auckland, New Zealand';
 edit.site={travelExGst:'54.15',siteAddressProof:signStudioSelectedAddress({projectId,destinationCanonical,placeId:'fixture_place'}),travelAllowance:{mode:'pending'}};
 const send=async()=>{const response=await studioWebsitePriceRequest(new Request('http://localhost/api/price',{method:'POST',body:JSON.stringify(payload)}),{projectId,estimateId});expect(response.status).toBe(200);return response.json();};
 const pending=await send();expect(pending).toMatchObject({status:'unavailable',amount:null,installationEstimate:{siteDays:3}});expect(pending).not.toHaveProperty('internalCosts');
 const receipt=signStudioTravelReceipt({projectId,destinationCanonical,placeId:'fixture_place',drivingCostPerRoundTripCents:5415,overnightEligible:false});
 const plan=studioTravelPlanForReceipt(edit.site.travelAllowance,receipt,pending.installationEstimate.siteDays);
 edit.site.travelAllowance={...plan,plannedRoundTrips:'1'};
 expect(await send()).toMatchObject({status:'unavailable',amount:null,installationEstimate:{siteDays:3}});
 const {tripCountSource:_,...legacy}=plan;edit.site.travelAllowance={...legacy,plannedRoundTrips:'1'};
 expect(await send()).toMatchObject({status:'unavailable',reason:'Confirm return trips for this existing travel plan.'});
 edit.site.travelAllowance=plan;edit.site.travelExGst=(studioTravelTotalCents(plan)/100).toFixed(2);
 expect(await send()).toMatchObject({status:'priced',installationEstimate:{siteDays:3}});
 edit.site.travelAllowance={...plan,tripCountSource:'manual',plannedRoundTrips:'2'};edit.site.travelExGst='108.30';
 expect(await send()).toMatchObject({status:'priced'});
});

it('returns the current effective site assumptions with explicit staff choices, without pricing internals',async()=>{
 const payload=source('staff');payload.composition.site={...payload.composition.site,access:'hard',height:'two_storey',jobType:'commercial',pricingClassification:'bespoke'};
 const response=await studioWebsitePriceRequest(new Request('http://localhost/api/price',{method:'POST',body:JSON.stringify(payload)}),{projectId,estimateId});expect(response.status).toBe(200);
 const body=await response.json();expect(body.siteAssumptions).toMatchObject({access:'Difficult',height:'Two storey',jobType:'Commercial',pricingClassification:'Bespoke'});expect(body).not.toHaveProperty('siteInputs');expect(body).not.toHaveProperty('config');
});
