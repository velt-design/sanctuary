import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),configuration:vi.fn(),verify:vi.fn(),price:vi.fn(),trip:vi.fn(),enabled:true}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:mocks.auth,jsonOk:(body:unknown)=>Response.json(body),jsonError:(error:string,status:number)=>Response.json({error},{status})}));
vi.mock('@/lib/supabaseClient',()=>({getSupabaseServiceRole:()=>({rpc:mocks.rpc})}));
vi.mock('@/lib/costing/configurationResolver',()=>({getCostingConfigurationVersionById:mocks.configuration}));
vi.mock('@/lib/costing/configurationShared',()=>({mapCostingConfigurationVersion:(row:{config:unknown})=>row.config}));
vi.mock('@sp/costing/server',()=>({resolvePublishedCostingConfigurationRecordV1:(configuration:unknown)=>({config:configuration,provenance:{versionNumber:2,id:'10000000-0000-4000-8000-000000000004'}})}));
vi.mock('@/lib/estimates/loadProjectEstimateDetail',()=>({resolveEstimateVersionLabels:async()=>new Map([['10000000-0000-4000-8000-000000000003','V2']])}));
vi.mock('@/lib/queries/studioProject.server',()=>({loadStudioProjectName:async()=> 'Synthetic courtyard'}));
vi.mock('./studioTravelReceipt.server',()=>({verifyStudioTravelForProject:mocks.verify}));
vi.mock('./studioCommercialPricing.server',()=>({calculateStudioCommercialPricing:mocks.price}));
vi.mock('./studioTravelPlan',()=>({studioTravelTripPlanIssue:mocks.trip}));
vi.mock('./studioInstallationEstimate',()=>({studioInstallationEstimate:()=>({siteDays:3})}));
vi.mock('./quoteCustomerLines',()=>({studioCustomerQuoteLines:()=>[{description:'Synthetic quoted arrangement',qty:1,unitPriceIncGstCents:10000,lineTotalIncGstCents:10000,sortOrder:0}]}));
import {prepareStudioQuoteRequest} from './quotePrepare.server';
import {prepareStudioCreation} from './createPreparation';
import {mergeStudioAuthoringEdit,projectStudioAuthoringView} from './authoringView';
import {studioClientDocumentFixture} from '../../../../test/fixtures/studio-client-documents';
const ids={projectId:'proj_10000000-0000-4000-8000-000000000001',estimateId:'est_10000000-0000-4000-8000-000000000003'},snapshotId='10000000-0000-4000-8000-000000000002';
const made=prepareStudioCreation({mode:'blank',projectId:ids.projectId,designId:'document-fixture',commercialScopeId:null});if(!made.ok)throw Error(made.message);
const merged=mergeStudioAuthoringEdit({storedAuthored:made.prepared.row.outputs.studio_authored,storedSpatial:made.prepared.row.outputs.drawing_object_first,edit:studioClientDocumentFixture()});if(!merged.ok)throw Error(merged.message);
const outputs={studio_authored:merged.value.authored,drawing_object_first:merged.value.spatial},view=projectStudioAuthoringView({authored:outputs.studio_authored,spatial:outputs.drawing_object_first});if(!view.ok)throw Error(view.message);
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','1');vi.stubEnv('ENABLE_STUDIO_CLIENT_DOCUMENTS','1');mocks.enabled=true;
 mocks.configuration.mockResolvedValue({synthetic:'published immutable configuration'});mocks.verify.mockResolvedValue('12 Example Road, Auckland');mocks.trip.mockReturnValue(null);mocks.price.mockReturnValue({resolvedObjects:[],customerStandaloneSelections:[],breakdown:{},siteInputs:{},siteOutput:{},approvalRequirement:'neither',approvalIncGstCents:0});
 mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==='studio_client_document_capability'?mocks.enabled:{snapshot_id:snapshotId}}));
 mocks.auth.mockResolvedValue({ok:true,session:{role:'staff',user:{id:'10000000-0000-4000-8000-000000000005'}},supabase:{from:(table:string)=>{const chain:any={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({error:null,data:table==='estimates'?{id:ids.estimateId.slice(4),project_id:ids.projectId.slice(5),outputs,updated_at:'2026-10-28T00:00:00Z',status:'draft'}:{current_version_id:'10000000-0000-4000-8000-000000000004',version:{id:'10000000-0000-4000-8000-000000000004',config:{synthetic:'published immutable configuration'}}}})};return chain;}}});
});
afterEach(()=>vi.unstubAllEnvs());
function request(source:unknown=view.ok?view.value:null){return prepareStudioQuoteRequest(new Request('http://localhost/studio-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:snapshotId,source,documentMode:'separate_v1'})}),ids);}
it('freezes real canonical geometry/configuration under the freshly checked source and financial authority without image inputs',async()=>{
 const response=await request(),body=await response.json();expect(response.status).toBe(200);expect(body.documentMode).toBe('separate_v1');expect(body.totalIncGstCents).toBe(10000);
 const command=mocks.rpc.mock.calls.find(c=>c[0]==='studio_client_quote_prepare')![1];expect(command.p_customer_view).toMatchObject({schemaVersion:'studio_quote_snapshot.v2',documentMode:'separate_v1',images:[]});expect(command.p_drawing_source.designVersionLabel).toBe('V2');expect(command.p_drawing_source.revision).not.toBe(2);expect(command.p_drawing_source.products).toHaveLength(2);expect(command.p_drawing_source.products[1].assembly.family).toBe('gable');expect(command.p_drawing_source.houses[0].model.roofFlashings.length).toBeGreaterThan(0);
 expect(command.p_customer_view.quotePresentationVersion).toBe('sanctuary-quote.v3');expect(command.p_drawing_source.layoutVersion).toBe('studio-booklet-layout.v4');
 expect(command.p_drawing_source.contentHash).toBe(body.contentHash);expect(command.p_private_evidence.configuration).toEqual({synthetic:'published immutable configuration'});expect(command.p_customer_view).not.toHaveProperty('configuration');expect(command.p_customer_view).not.toHaveProperty('drawing_source');expect(mocks.verify).toHaveBeenCalledWith(expect.anything(),ids.projectId,expect.anything(),expect.any(AbortSignal),true);expect(mocks.trip).toHaveBeenCalledWith(undefined,3);
 const repeat=await (await request()).json();expect(repeat.contentHash).toBe(body.contentHash);
 expect(mocks.configuration).not.toHaveBeenCalled();
});
it('refuses a stale source, stale travel/day authority and an unadmitted project before freezing any document',async()=>{
 expect((await request({...view.ok?view.value:{},revision:99})).status).toBe(409);expect(mocks.rpc.mock.calls.some(c=>c[0]==='studio_client_quote_prepare')).toBe(false);
 mocks.trip.mockReturnValue({message:'Review fresh site days'});expect((await request()).status).toBe(422);expect(mocks.rpc.mock.calls.some(c=>c[0]==='studio_client_quote_prepare')).toBe(false);
 mocks.enabled=false;expect((await request()).status).toBe(409);
});
it('refuses the legacy image quote path in server-controlled staff trial without weakening default explicit scope',async()=>{
 vi.stubEnv('STUDIO_DOCUMENT_STAFF_TRIAL_ENABLED','true');
 const response=await prepareStudioQuoteRequest(new Request('http://localhost/studio-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:snapshotId,source:view.ok?view.value:null,images:[]})}),ids);
 expect(response.status).toBe(409);expect(mocks.rpc).not.toHaveBeenCalled();
 expect((await request()).status).toBe(200);
});
it('preserves an image-free financial quote for an accessory-only source without inventing a drawing page',async()=>{
 const auth=await mocks.auth(),original=auth.supabase.from;
 const emptyOutputs=made.prepared.row.outputs;
 const emptyView=projectStudioAuthoringView({authored:emptyOutputs.studio_authored,spatial:emptyOutputs.drawing_object_first});
 if(!emptyView.ok)throw Error(emptyView.message);
 auth.supabase.from=(table:string)=>{const chain=original(table),read=chain.maybeSingle;chain.maybeSingle=async()=>{
  const result=await read();if(table==='estimates')result.data.outputs=emptyOutputs;return result;
 };return chain;};
 const response=await request(emptyView.value);expect(response.status).toBe(200);
 const command=mocks.rpc.mock.calls.find(c=>c[0]==='studio_client_quote_prepare')![1];
 expect(command.p_customer_view).toMatchObject({schemaVersion:'studio_quote_snapshot.v2',documentMode:'separate_v1',images:[]});
 expect(command.p_drawing_source).toMatchObject({layoutVersion:'studio-booklet-layout.v4',products:[],pageManifest:[]});
 expect(command.p_handoff.totalIncGstCents).toBe(10000);
});

it('starts fresh estimate/publication reads together and refuses a mismatched joined publication without preparing',async()=>{
 const auth=await mocks.auth();const original=auth.supabase.from;
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let started=false;
 auth.supabase.from=(table:string)=>{const chain=original(table),read=chain.maybeSingle;chain.maybeSingle=async()=>{
   if(table==='estimates')await gate;
   if(table==='costing_configuration_publication'){started=true;release();}
   const result=await read();if(table==='costing_configuration_publication')result.data.version.id='mismatched';return result;
 };return chain;};
 const response=await request();expect(started).toBe(true);expect(response.status).toBe(422);
 expect(mocks.rpc.mock.calls.some(c=>c[0]==='studio_client_quote_prepare')).toBe(false);
});
