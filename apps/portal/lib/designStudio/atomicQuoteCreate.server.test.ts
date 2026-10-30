import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),price:vi.fn(),trip:vi.fn(),verify:vi.fn(),mode:'new',committed:null as any,raw:null as any}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:mocks.auth,jsonOk:(body:unknown,status=200)=>Response.json(body,{status}),jsonError:(error:string,status:number)=>Response.json({error},{status})}));
vi.mock('@/lib/supabaseClient',()=>({getSupabaseServiceRole:()=>({rpc:mocks.rpc})}));
vi.mock('@/lib/costing/configurationShared',()=>({mapCostingConfigurationVersion:(row:any)=>row.config}));
vi.mock('@sp/costing/server',()=>({resolvePublishedCostingConfigurationRecordV1:(configuration:unknown)=>({config:configuration,provenance:{schemaVersion:'costing-provenance.v1',source:'published',versionNumber:2,versionId:'10000000-0000-4000-8000-000000000004',contentHash:'a'.repeat(64)}})}));
vi.mock('@/lib/estimates/loadProjectEstimateDetail',()=>({resolveEstimateVersionLabels:async()=>new Map([['10000000-0000-4000-8000-000000000003','V2']])}));
vi.mock('@/lib/queries/studioProject.server',()=>({loadStudioProjectName:async()=> 'Synthetic courtyard'}));
vi.mock('./studioTravelReceipt.server',()=>({verifyStudioTravelForProject:mocks.verify}));
vi.mock('./studioCommercialPricing.server',()=>({calculateStudioCommercialPricing:mocks.price}));
vi.mock('./studioTravelPlan',async load=>({...await load<typeof import('./studioTravelPlan')>(),studioTravelTripPlanIssue:mocks.trip}));
vi.mock('./quoteCustomerLines',()=>({studioCustomerQuoteLines:()=>[{description:'Synthetic quoted arrangement',qty:1,unitPriceIncGstCents:10000,lineTotalIncGstCents:10000,sortOrder:0}]}));
vi.mock('@/lib/quotes/pdf',()=>({generateQuotePdfBytes:async()=>new TextEncoder().encode('%PDF-synthetic'),quotePdfFilename:(ref:string,version:number)=>`${ref}-v${version}.pdf`}));
// This orchestration fixture uses deliberately mocked pricebook data. Full
// archive/resolver validation has its own real-configuration connected suite.
vi.mock('@/lib/costing/configurationArchive.server',()=>({packStudioFrozenConfiguration:async(value:unknown)=>value}));
import {unpackStudioFrozenAuditEvidence} from '@/lib/costing/auditArchive.server';
import {createStudioClientQuoteRequest} from './atomicQuoteCreate.server';
import {prepareStudioCreation} from './createPreparation';
import {mergeStudioAuthoringEdit,projectStudioAuthoringView,createStudioAuthoringEdit} from './authoringView';
import {studioClientDocumentFixture} from '../../../../test/fixtures/studio-client-documents';
const ids={projectId:'proj_10000000-0000-4000-8000-000000000001',estimateId:'est_10000000-0000-4000-8000-000000000003'},requestId='10000000-0000-4000-8000-000000000002',actor='10000000-0000-4000-8000-000000000005';
const made=prepareStudioCreation({mode:'blank',projectId:ids.projectId,designId:'document-fixture',commercialScopeId:null});if(!made.ok)throw Error(made.message);
const merged=mergeStudioAuthoringEdit({storedAuthored:made.prepared.row.outputs.studio_authored,storedSpatial:made.prepared.row.outputs.drawing_object_first,edit:studioClientDocumentFixture()});if(!merged.ok)throw Error(merged.message);
const outputs={studio_authored:merged.value.authored,drawing_object_first:merged.value.spatial},view=projectStudioAuthoringView({authored:outputs.studio_authored,spatial:outputs.drawing_object_first});if(!view.ok)throw Error(view.message);
function command(){const edit=createStudioAuthoringEdit(view.ok?view.value:never());edit.site.extrasAllowanceExGst='40';return{requestId,expectedUpdatedAt:'2026-10-28T00:00:00Z',expectedRevision:edit.revision,edit};}
function never():never{throw Error('fixture');}
function request(value:unknown=command()){return createStudioClientQuoteRequest(new Request('http://localhost/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)}),ids);}
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','1');vi.stubEnv('ENABLE_STUDIO_CLIENT_DOCUMENTS','1');mocks.mode='new';mocks.committed=null;
 mocks.raw={id:ids.estimateId.slice(4),project_id:ids.projectId.slice(5),outputs:structuredClone(outputs),updated_at:'2026-10-28T00:00:00Z',status:'draft'};
 mocks.verify.mockResolvedValue('12 Example Road, Auckland');mocks.trip.mockReturnValue(null);mocks.price.mockReturnValue({resolvedObjects:[],customerStandaloneSelections:[],breakdown:{},siteInputs:{},siteOutput:{},approvalRequirement:'neither',approvalIncGstCents:0});
 mocks.auth.mockResolvedValue({ok:true,session:{role:'staff',user:{id:actor,email:'test@example.com'}},supabase:{from:(table:string)=>{const chain:any={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({error:null,data:table==='estimates'?mocks.raw:{current_version_id:'10000000-0000-4000-8000-000000000004',version:{id:'10000000-0000-4000-8000-000000000004',config:{synthetic:true}}}})};return chain;}}});
 mocks.rpc.mockImplementation(async(name:string,args:any)=>{
  if(name==='studio_client_document_capability')return{data:mocks.mode!=='disabled',error:null};
  if(name==='studio_client_quote_create_replay')return{data:mocks.committed,error:mocks.mode==='conflict'?{message:'studio_quote_intent_conflict'}:null};
  if(name==='studio_client_quote_create'){
   if(mocks.mode==='stale')return{data:null,error:{message:'studio_publication_changed'}};
   expect(args.p_save.authored.revision).toBe(args.p_save.expectedRevision);
   expect(args.p_preparation.p_authored.revision).toBe(args.p_save.expectedRevision+1);
   expect(args.p_preparation.p_handoff.source.revision).toBe(args.p_preparation.p_authored.revision);
   expect(args.p_client_request).toEqual(command());
   const c=args.p_command;
   mocks.committed={versionRow:{id:'10000000-0000-4000-8000-000000000006',quote_id:'10000000-0000-4000-8000-000000000007',version_number:2,commercial_revision:1,status:'DRAFT',created_at:'2026-10-28T00:00:01Z',updated_at:'2026-10-28T00:00:01Z',source_estimate_version_id:c.p_source_estimate_version_id,client_intent_id:c.p_client_intent_id,pricing_source:c.p_pricing_source,pricing_source_metadata:c.p_pricing_source_metadata,total_inc_gst_cents:c.p_total_inc_gst_cents,total_ex_gst_cents:c.p_total_ex_gst_cents,gst_cents:c.p_gst_cents,payment_terms:c.p_payment_terms,quotes:{id:'10000000-0000-4000-8000-000000000007',project_id:ids.projectId.slice(5),quote_ref:'Q-SYNTHETIC'}},
    lineItems:c.p_line_items.map((line:any,index:number)=>({...line,id:`line-${index}`})),sendLogs:[],studioDesign:args.p_preparation.p_customer_view,estimateVersionLabel:'V2',saveReceipt:{revision:args.p_preparation.p_authored.revision,savedAt:'2026-10-28T00:00:01Z',alreadyExisted:false},savedView:args.p_preparation.p_handoff.source,sourceUpdatedAt:'2026-10-28T00:00:02Z',contact:{name:'Synthetic',email:'test@example.com'},project:{name:'Synthetic courtyard',siteAddress:'12 Example Road, Auckland'}};
   return{data:mocks.committed,error:null};
  }
  if(name==='studio_client_quote_store_pdf')return{data:'10000000-0000-4000-8000-000000000008',error:null};
  throw Error('Unexpected RPC');
 });
});
afterEach(()=>vi.unstubAllEnvs());
it('runs dirty Review source through canonical preparation, financial mapping, one atomic commit and PDF finalization',async()=>{
 const response=await request(),body=await response.json();expect(response.status).toBe(201);expect(body.quoteVersion.totals.totalIncGstCents).toBe(10000);expect(body.quoteVersion.studioDesign.snapshotId).toBe(requestId);expect(body.quotePdf.renderHash).toBe(body.quoteVersion.renderHash);
 expect(body.savedView.site.extrasAllowanceExGst).toBe('40');expect(body.sourceUpdatedAt).not.toBe(body.saveReceipt.savedAt);
 expect(mocks.rpc.mock.calls.filter(([name])=>name==='studio_client_quote_create')).toHaveLength(1);expect(mocks.rpc.mock.calls.some(([name])=>name==='studio_client_quote_prepare'||name==='commercial_quote_create_draft')).toBe(false);
});
it('returns the exact committed replay before an old source can fail merge, without another commit or booklet intent',async()=>{
 const first=await(await request()).json();mocks.raw={...mocks.raw,updated_at:'2026-10-28T00:00:02Z',outputs:{studio_authored:{...outputs.studio_authored,revision:88},drawing_object_first:outputs.drawing_object_first}};
 const response=await request(),second=await response.json();expect(response.status).toBe(201);expect(second.quoteVersion.id).toBe(first.quoteVersion.id);expect(second.quoteVersion.totals).toEqual(first.quoteVersion.totals);expect(second.quoteVersion.studioDesign).toEqual(first.quoteVersion.studioDesign);expect(mocks.rpc.mock.calls.filter(([name])=>name==='studio_client_quote_create')).toHaveLength(1);
});
it.each(['stale','conflict'])('refuses %s before any PDF artifact publication',async mode=>{
 mocks.mode=mode;expect((await request()).status).toBe(409);expect(mocks.rpc.mock.calls.some(([name])=>name==='studio_client_quote_store_pdf')).toBe(false);
});
it('does not prepare or commit after current actor access is refused',async()=>{
 mocks.auth.mockResolvedValue({ok:false,response:Response.json({error:'Unauthorized'},{status:401})});expect((await request()).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();
});
it('keeps the rollout dark outside admission and refuses supplied financial fields',async()=>{
 mocks.mode='disabled';expect((await request()).status).toBe(409);expect(mocks.rpc.mock.calls.some(([name])=>name==='studio_client_quote_create')).toBe(false);
 mocks.rpc.mockClear();expect((await request({...command(),totalIncGstCents:1})).status).toBe(422);expect(mocks.rpc).not.toHaveBeenCalled();
});

it('packs the actual fresh costing trace with canonical publication versionId while preserving configuration and financial authority',async()=>{
 const calculation={...mocks.price.getMockImplementation()!(),siteInputs:{pergolas:[{id:'synthetic'}]},siteOutput:{rows:Array.from({length:100},(_,index)=>({index,description:'Repeated synthetic cost trace',amount:12.34}))}};
 mocks.price.mockReturnValue(calculation);
 const response=await request();expect(response.status).toBe(201);
 const args=mocks.rpc.mock.calls.find(([name])=>name==='studio_client_quote_create')![1] as any,evidence=args.p_preparation.p_private_evidence;
 expect(evidence.audit).toMatchObject({schemaVersion:'studio_costing_audit_archive.v1',publicationId:'10000000-0000-4000-8000-000000000004',publicationContentHash:'a'.repeat(64)});expect(evidence).not.toHaveProperty('siteOutput');
 const decoded=await unpackStudioFrozenAuditEvidence(evidence);expect(decoded.siteInputs).toEqual(calculation.siteInputs);expect(decoded.siteOutput).toEqual(calculation.siteOutput);expect(decoded.configuration).toBe(evidence.configuration);expect(evidence.publication.versionId).toBe(args.p_preparation.p_publication_id);expect(evidence.publication).not.toHaveProperty('id');
});
