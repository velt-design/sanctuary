import {beforeEach,expect,it,vi} from 'vitest';
import {reviewStudioSavedRequest} from './reviewRequest.server';
const mocks=vi.hoisted(()=>({auth:vi.fn(),estimate:vi.fn(),quote:vi.fn(),from:vi.fn(),rows:null as any,select:vi.fn(),eq:vi.fn(),limit:vi.fn(),projection:vi.fn()}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:mocks.auth,jsonOk:(body:unknown)=>Response.json(body),jsonError:(error:string,status:number)=>Response.json({error},{status})}));
vi.mock('./studioReviewEstimateContext.server',()=>({loadStudioReviewEstimateContext:async(client:unknown,request:Request,project:string,target:string)=>{const estimate=await mocks.estimate(`proj_${project}`,`est_${target}`);return estimate?{state:'ready',estimate,versionLabels:new Map(),projectName:'TEST project',theme:{},legacyDraft:{data:Array.isArray(mocks.rows)?mocks.rows.filter((row:any)=>Object.hasOwn(row.pricing_source_metadata??{},'studioQuoteDraft')):mocks.rows,error:null}}:{state:'missing'};},loadStudioReviewReference:async(client:unknown,request:Request,project:string,target:string)=>mocks.estimate(`proj_${project}`,`est_${target}`)}));
vi.mock('@/lib/quotes/server',()=>({getQuoteVersionDetail:mocks.quote}));
vi.mock('./savedReview',()=>({buildSavedEstimateReview:mocks.projection}));
vi.mock('@/lib/queries/studioProject.server',()=>({loadStudioProjectName:async()=> 'TEST project'}));
vi.mock('./studioDesignIdentity',()=>({studioDesignIdentity:()=>({projectName:'TEST project'})}));
vi.mock('./websiteBrief.server',()=>({projectStudioWebsiteBrief:()=>null}));
const p='10000000-0000-4000-8000-000000000001',e='10000000-0000-4000-8000-000000000002',q='10000000-0000-4000-8000-000000000003';
const ids={projectId:`proj_${p}`,estimateId:`est_${e}`};
const estimate={id:ids.estimateId,projectId:ids.projectId,commercialScopeId:'scope',commercialScopeKind:'base',editability:{isLocked:false,hasDraftQuotes:true,draftQuoteCount:1},calculatorSnapshot:{outputs:{studio_authored:{}}}};
function row(patch={}){return {id:q,status:'DRAFT',version_number:2,source_estimate_version_id:e,pricing_source_metadata:{},quotes:{project_id:p,commercial_scope_id:'scope',quote_ref:'Q-TEST'},...patch};}
beforeEach(()=>{
 vi.resetAllMocks();process.env.ENABLE_PORTAL_DESIGN_STUDIO='1';mocks.rows=[row()];
 let historical=false;const chain:any={abortSignal:()=>chain,not:()=>{historical=true;return chain;},is:()=>{historical=false;return chain;},select:mocks.select,eq:mocks.eq,order:()=>chain,limit:mocks.limit,maybeSingle:async()=>({data:Array.isArray(mocks.rows)?mocks.rows[0]:mocks.rows,error:null})};
 mocks.select.mockReturnValue(chain);mocks.eq.mockReturnValue(chain);mocks.limit.mockImplementation(async()=>({data:Array.isArray(mocks.rows)?mocks.rows.filter((row:any)=>historical?Object.hasOwn(row.pricing_source_metadata??{},'studioQuoteDraft'):!Object.hasOwn(row.pricing_source_metadata??{},'studioQuoteDraft')):mocks.rows,error:null}));mocks.from.mockReturnValue(chain);
 mocks.auth.mockResolvedValue({ok:true,session:{role:'staff',user:{id:'server-actor'}},supabase:{from:mocks.from}});mocks.estimate.mockResolvedValue(estimate);
 mocks.quote.mockResolvedValue({id:`qv_${q}`,projectId:ids.projectId,sourceEstimateVersionId:ids.estimateId,commercialScopeId:'scope',commercialScopeKind:'base'});
 mocks.projection.mockImplementation(({quote})=>({estimate:{id:ids.estimateId,projectId:ids.projectId},quote:quote?{id:quote.id}:null}));
});
async function get(query='',framed=false){return reviewStudioSavedRequest(new Request(`http://localhost/studio-review${query}`,{headers:framed?{accept:'application/x-sanctuary-studio-review+json'}:{}}),ids);}
it('returns only exact caller-associated modern quote links, without a privileged discovery read',async()=>{
 const response=await get(),body=await response.json();expect(response.status).toBe(200);expect(body.relatedQuotes).toEqual([{id:`qv_${q}`,status:'DRAFT',label:'Q-TEST · v2'}]);expect(body.quoteDocument).toBeUndefined();expect(mocks.quote).not.toHaveBeenCalled();expect(mocks.eq).toHaveBeenCalledWith('source_estimate_version_id',e);expect(mocks.eq).toHaveBeenCalledWith('quotes.project_id',p);expect(mocks.limit).toHaveBeenCalledWith(20);expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it.each([{quotes:{project_id:'foreign',commercial_scope_id:'scope'}},{source_estimate_version_id:p},{quotes:{project_id:p,commercial_scope_id:'foreign'}}])('refuses a mismatched discovery row before exposing its link',async patch=>{mocks.rows=[row(patch)];const response=await get();expect(response.status).toBe(404);expect(mocks.quote).not.toHaveBeenCalled();expect(await response.text()).not.toContain(q);});
it('uses the privileged frozen detail only after exact caller association and rechecks all returned identities',async()=>{
 const response=await get(`?quoteVersionId=qv_${q}`),body=await response.json();expect(response.status).toBe(200);expect(body.quoteDocument.id).toBe(`qv_${q}`);expect(mocks.quote).toHaveBeenCalledWith(`qv_${q}`);
 mocks.quote.mockResolvedValue({...body.quoteDocument,sourceEstimateVersionId:'est-foreign'});expect((await get(`?quoteVersionId=qv_${q}`)).status).toBe(404);
});
it('does not read business rows on a fresh access denial',async()=>{mocks.auth.mockResolvedValue({ok:false,response:Response.json({error:'Unauthorized'},{status:401})});expect((await get()).status).toBe(401);expect(mocks.from).not.toHaveBeenCalled();expect(mocks.estimate).not.toHaveBeenCalled();});
it('retains historical unsupported/ambiguous draft refusals instead of treating them as modern quote links',async()=>{mocks.rows=[row({pricing_source_metadata:{studioQuoteDraft:'future'}})];expect((await get()).status).toBe(409);mocks.rows=[row({pricing_source_metadata:{studioQuoteDraft:'studio_quote_draft.v1'}}),row({id:p,pricing_source_metadata:{studioQuoteDraft:'studio_quote_draft.v1'}})];expect((await get()).status).toBe(409);});
it('does not expose raw thrown errors',async()=>{mocks.estimate.mockRejectedValue(Error('private-secret-customer'));const response=await get();expect(response.status).toBe(503);expect(await response.text()).not.toContain('private-secret');});

it('reuses the exact authorised public composition and saved metadata, preserving only the validated preparation binding',async()=>{
 const {prepareStudioCreation}=await import('./createPreparation'),{projectStudioAuthoringView}=await import('./authoringView'),actual=await vi.importActual<typeof import('./savedReview')>('./savedReview');
 const made=prepareStudioCreation({mode:'blank',projectId:ids.projectId,designId:'review-input-source',commercialScopeId:null});if(!made.ok)throw Error(made.message);
 const outputs=made.prepared.row.outputs,view=projectStudioAuthoringView({authored:outputs.studio_authored,spatial:outputs.drawing_object_first});if(!view.ok)throw Error(view.message);
 outputs.studio_quote_handoff={schemaVersion:'studio_quote_snapshot.v1',snapshotId:'10000000-0000-4000-8000-000000000004',contentHash:'a'.repeat(64),source:view.value,lines:[{description:'Fixture design',qty:1,unitPriceIncGstCents:100,lineTotalIncGstCents:100,sortOrder:0}],totalIncGstCents:100,approvalRequirement:'neither',approvalIncGstCents:0};
 mocks.rows=[];mocks.estimate.mockResolvedValue({...estimate,createdAt:'2026-10-01T00:00:00Z',status:'draft',versionLabel:'V1',updatedAt:'2026-10-27T01:02:03Z',editability:{isLocked:false,hasDraftQuotes:false,draftQuoteCount:0},calculatorSnapshot:{outputs}});mocks.projection.mockImplementation(actual.buildSavedEstimateReview);
 const response=await get(),body=await response.json();expect(response.status).toBe(200);expect(body.review.estimate.updatedAt).toBe('2026-10-27T01:02:03Z');expect(body.review.websiteComposition).toEqual(view.value);expect(body.review.preparedQuote).toEqual({snapshotId:'10000000-0000-4000-8000-000000000004',contentHash:'a'.repeat(64)});expect(mocks.estimate).toHaveBeenCalledOnce();expect(mocks.estimate).toHaveBeenCalledWith(ids.projectId,ids.estimateId);expect(body.review).not.toHaveProperty('calculatorSnapshot');expect(body.review).not.toHaveProperty('outputs');
});

it('keeps the ordinary JSON payload exact while the explicit representation adds fresh scope and quote identity',async()=>{
 const query=`?quoteVersionId=qv_${q}`,ordinary=await (await get(query)).json(),response=await get(query,true),frame=await response.json();
 expect(frame.response).toEqual(ordinary);expect(frame.scope).toEqual({actorId:'server-actor',role:'staff',projectId:ids.projectId,estimateId:ids.estimateId});expect(frame.quoteVersionId).toBe(`qv_${q}`);expect(frame.presentation).toEqual({theme:{}});expect(response.headers.get('content-type')).toBe('application/x-sanctuary-studio-review+json');expect(mocks.auth.mock.calls[0]).toHaveLength(1);expect(mocks.auth.mock.calls[1][1]).toBe(true);
});
it('uses protected fallback only for an authorised oversized valid quote representation, retaining plain JSON capability',async()=>{
 const detail=await mocks.quote();mocks.quote.mockResolvedValue({...detail,introText:'x'.repeat(8*1024*1024)});
 const response=await get(`?quoteVersionId=qv_${q}`,true);expect(response.status).toBe(413);expect(response.headers.get('x-studio-review-fallback')).toBe('protected');expect((await get(`?quoteVersionId=qv_${q}`)).status).toBe(200);
 mocks.auth.mockResolvedValue({ok:false,accessKind:'no_access',response:Response.json({error:'Unauthorized'},{status:401})});const denied=await get('',true);expect(denied.status).toBe(401);expect(denied.headers.get('x-studio-access-state')).toBe('no_access');expect(denied.headers.get('x-studio-review-fallback')).toBeNull();
});


it('retains supported historical draft through the actual producer and bounded reader without privileged detail',async()=>{
 const {readStudioReviewOpening}=await import('./studioReviewOpeningTransport');
 mocks.rows=[row({pricing_source_metadata:{studioQuoteDraft:'studio_quote_draft.v1'}})];
 for(const explicit of [false,true]){
  const response=await get(explicit?('?quoteVersionId=qv_'+q):'',true),framed=await response.clone().json();
  expect(response.status).toBe(200);expect(framed.response.studioDraft).toEqual({quoteVersionId:'qv_'+q});expect(framed.response.quoteDocument).toBeUndefined();expect(mocks.quote).not.toHaveBeenCalled();
  vi.stubGlobal('fetch',vi.fn(async()=>response));
  try{await expect(readStudioReviewOpening('/review',{projectId:ids.projectId,estimateId:ids.estimateId,quoteVersionId:explicit?'qv_'+q:null},new AbortController().signal)).resolves.toEqual(framed);}
  finally{vi.unstubAllGlobals();}
 }
});
