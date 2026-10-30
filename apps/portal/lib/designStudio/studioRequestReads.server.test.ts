import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {loadCostingConfigV1,ACCESSORY_REVIEW_RATES,getDefaultInstalledSellingRates,snapshotCostingControlConfigV1} from '@sp/costing';
import {prepareStudioCreation} from './createPreparation';
import {projectStudioAuthoringView,createStudioAuthoringEdit,mergeStudioAuthoringEdit} from './authoringView';
import {addWebsitePergola} from './websiteComposition';
import {computeEstimateEditability} from '@/lib/estimates/editability';
import {mapEstimateDetail} from '@/lib/estimates/server';
import {studioDesignIdentity} from './studioDesignIdentity';
import {hashCostingControlConfig} from '@/lib/costing/configurationShared';
import {loadStudioAuthoringRequest} from './authoringRequest.server';
import {studioWebsitePriceRequest} from './websitePriceRequest.server';
import {startStudioOpeningPricing,studioPriceComposition} from './studioWebsitePricing.server';
import {resolvePortalTheme} from '@/lib/theme/resolve';

const mocks=vi.hoisted(()=>({auth:vi.fn(),client:vi.fn()}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:mocks.auth,jsonOk:(body:unknown)=>Response.json(body),jsonError:(error:string,status:number,_diagnostics:unknown,extra?:Record<string,unknown>)=>Response.json({error,...extra},{status})}));
vi.mock('@/lib/supabase/serverClient',()=>({getSupabaseServerAuth:mocks.client}));
vi.mock('@/lib/supabaseClient',()=>({supabaseServiceRole:new Proxy({},{get(){throw Error('No service-role fallback');}})}));
const project='10000000-0000-4000-8000-000000000001',estimate='20000000-0000-4000-8000-000000000001';
const ids={projectId:`proj_${project}`,estimateId:`est_${estimate}`};
type Query={table:string;fields:string;filters:Array<[string,unknown]>};
let row:any,body:any,version:any,publication:any,role:string,quotes:any[],logs:any[],themeSettings:any,themePreset:any,failure:string|null,failureCode:string,hold:((table:string,query:Query)=>Promise<void>)|null;
const queries:Query[]=[],publicationSignals:AbortSignal[]=[],childSignals:AbortSignal[]=[];
function fixture(){
 const made=prepareStudioCreation({mode:'blank',projectId:ids.projectId,designId:'request-read-proof',commercialScopeId:null});if(!made.ok)throw Error(made.message);
 const outputs=made.prepared.row.outputs,view=projectStudioAuthoringView({authored:outputs.studio_authored,spatial:outputs.drawing_object_first});if(!view.ok)throw Error(view.message);
 const edit=addWebsitePergola(createStudioAuthoringEdit(view.value),'pergola'),saved=mergeStudioAuthoringEdit({storedAuthored:outputs.studio_authored,storedSpatial:outputs.drawing_object_first,edit});if(!saved.ok)throw Error(saved.message);
 row={id:estimate,project_id:project,status:'draft',updated_at:'2026-10-22T10:00:00Z',created_at:'2026-10-20T01:02:03Z',internal_name:'  Courtyard  ',summary:{total:123},outputs:{...outputs,version:7,studio_authored:saved.value.authored,drawing_object_first:saved.value.spatial,privateProof:'never sent'}};
 const config=snapshotCostingControlConfigV1({...loadCostingConfigV1(),accessoryRates:ACCESSORY_REVIEW_RATES,installedSellingRates:getDefaultInstalledSellingRates()});
 version={id:'30000000-0000-4000-8000-000000000001',version_number:15,name:'Current test pricebook',purpose:'Synthetic request proof',status:'published',schema_version:config.schemaVersion,base_manifest_version:config.baseManifestVersion,based_on_version_id:null,config_json:config,content_hash:hashCostingControlConfig(config),created_at:'2026-10-22T00:00:00Z',created_by_email:'test@example.invalid',updated_at:'2026-10-22T00:00:00Z',updated_by_email:'test@example.invalid',published_at:'2026-10-22T00:00:00Z',published_by_email:'test@example.invalid',publish_note:'Synthetic test',publication_diff:[],publication_impact:[]};
 publication={current_version_id:version.id,version};
 body={designId:edit.designId,revision:edit.revision,composition:edit,requestKey:'exact-request'};
}
const client={from(table:string){
 const request:Query={table,fields:'',filters:[]};queries.push(request);
 const result=async(single=false)=>{
  if(hold)await hold(table,request);
  if(failure===table)return{data:null,error:{message:`${table} unavailable`,code:failureCode}};
  if(table==='estimates'){
   if(single)return{data:row,error:null};
   if(request.fields.includes('outputs->version'))return{data:[{id:estimate,created_at:row.created_at,version:row.outputs?.version}],error:null};
   // Supply a newer unrelated draft to expose accidental whole-project scope.
   return{data:[row,{id:'unrelated',status:'draft',created_at:'2026-10-22',outputs:{version:8}}],error:null};
  }
  if(table==='projects')return{data:{id:project,name:'Exact project'},error:null};
  if(table==='quote_versions')return{data:quotes.filter(q=>(request.filters.find(([k])=>k==='source_estimate_version_id')?.[1] as string[]).includes(q.source_estimate_version_id)),error:null};
  if(table==='quote_send_logs')return{data:logs,error:null};
  if(table==='costing_configuration_publication')return{data:publication,error:null};
  if(table==='costing_configuration_versions')return{data:version,error:null};
  if(table==='portal_user_theme_settings')return{data:themeSettings,error:null};
  if(table==='portal_user_theme_presets')return{data:themePreset,error:null};
  return{data:[],error:null};
 };
 const query={select(fields:string){request.fields=fields;return query;},eq(key:string,value:unknown){request.filters.push([key,value]);return query;},in(key:string,value:unknown){request.filters.push([key,value]);return query;},order(){return query;},abortSignal(signal:AbortSignal){(table==='costing_configuration_publication'?publicationSignals:childSignals).push(signal);return query;},maybeSingle(){return result(true);},single(){return result(true);},then(resolve:any,reject:any){return result().then(resolve,reject);}};
 return query;
}};
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','1');queries.length=0;publicationSignals.length=0;childSignals.length=0;fixture();role='staff';quotes=[];logs=[];failure=null;failureCode='TEMPORARY';hold=null;
 themeSettings=null;themePreset=null;mocks.auth.mockImplementation(async()=>({ok:true,session:{role,user:{id:'actor'}},supabase:client}));mocks.client.mockResolvedValue(client);
});

it.each(['DRAFT','SENT','ACCEPTED','DECLINED','SUPERSEDED','sent-log'])('retains canonical %s quote authority, current revision and display metadata',async state=>{
 quotes=[{id:'q1',source_estimate_version_id:estimate,status:state==='sent-log'?'DRAFT':state,sent_at:null,created_at:'2026-10-21T00:00:00Z',version_number:3,quotes:{quote_ref:'Q-17'}},{id:'foreign',source_estimate_version_id:'unrelated',status:'SENT',version_number:99}];
 logs=state==='sent-log'?[{quote_version_id:'q1',status:'SENT',sent_at:'2026-10-22T00:00:00Z'}]:[];
 const expected=computeEstimateEditability({quoteVersions:quotes.slice(0,1),sendLogs:logs});
 const result=await(await authoring()).json();
 expect(result.authoring.estimate.requiresNewRevision).toBe(true);expect(result.authoring.nextAction).toBe('create-revision');
 expect(result.authoring.identity).toEqual(studioDesignIdentity(mapEstimateDetail(row,'V7',expected),'Exact project'));
 expect((await price()).status).toBe(409);expect(queries.some(q=>q.table==='costing_configuration_versions')).toBe(false);
 expect(queries.some(q=>q.table==='costing_configuration_publication')).toBe(false);
});

it('does not import an unrelated estimate lock or project-wide active-draft decision',async()=>{
 quotes=[{id:'foreign',source_estimate_version_id:'unrelated',status:'SENT'}];
 const result=await(await authoring()).json();expect(result.authoring.estimate.requiresNewRevision).toBe(false);
 expect(result.authoring).not.toHaveProperty('isActiveDraft');expect((await price()).status).toBe(200);
 expect(mocks.client).not.toHaveBeenCalled();
});

it('preserves archived, malformed display and legacy authoring outcomes',async()=>{
 row.status='archived';row.created_at='invalid';row.internal_name=123;
 let result=await(await authoring()).json();expect(result.authoring.identity).toEqual(studioDesignIdentity(mapEstimateDetail(row,'V7',computeEstimateEditability({})),'Exact project'));
 expect(result.authoring.identity.createdAt).toBeNull();expect(result.authoring.nextAction).toBe('create-revision');expect((await price()).status).toBe(409);
 row.status='draft';delete row.outputs.studio_authored;
 result=await(await authoring()).json();expect(result.authoring.state).toBe('unavailable');expect(result.authoring.view).toBeNull();expect(result.authoring.reason).toContain('historical estimate');
});

it.each(['authoring','price'] as const)('keeps %s denied, hidden, malformed and unavailable reads conservative',async kind=>{
 const send=kind==='authoring'?authoring:price;
 role='customer';expect((await send()).status).toBe(403);expect(queries).toHaveLength(0);
 role='staff';mocks.auth.mockResolvedValueOnce({ok:false,response:Response.json({error:'auth unavailable'},{status:401})});expect((await send()).status).toBe(401);expect(queries).toHaveLength(0);
 row.project_id='foreign';expect((await send()).status).toBe(404);expect(queries.some(q=>q.table==='quote_versions')).toBe(kind==='authoring');
 if(kind==='authoring')expect(childSignals.every(signal=>signal.aborted)).toBe(true);
 row.project_id=project;failure='estimates';expect((await send()).status).toBe(503);
 failure='quote_versions';expect((await send()).status).toBe(503);expect(queries.some(q=>q.table==='costing_configuration_versions')).toBe(false);
 // An unrelated job-pack failure is covered separately as an intentional
 // availability change; quote and send-log authority still fail closed.
 quotes=[{id:'q1',source_estimate_version_id:estimate,status:'DRAFT'}];
 failure='quote_send_logs';expect((await send()).status).toBe(503);
 expect(queries.some(q=>q.table==='costing_configuration_publication')).toBe(false);
});

it('refuses stale saved revision before quote reads or publication, and preserves pricing dependency failure',async()=>{
 body.revision++;expect((await price()).status).toBe(409);expect(queries.some(q=>q.table==='quote_versions')).toBe(false);expect(queries.some(q=>q.table==='costing_configuration_versions')).toBe(false);
 expect(queries.some(q=>q.table==='costing_configuration_publication')).toBe(false);
 body.revision--;failure='costing_configuration_publication';expect((await price()).status).toBe(503);expect(queries.some(q=>q.table==='costing_configuration_versions')).toBe(false);
});

it('starts independent authoring display/authority reads together and never returns readiness before authority',async()=>{
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});hold=table=>table==='quote_versions'?paused:Promise.resolve();
 let settled=false;const response=authoring().then(value=>{settled=true;return value;});
 for(let i=0;i<12;i++)await Promise.resolve();
 expect(queries.some(q=>q.table==='quote_versions')).toBe(true);expect(queries.some(q=>q.table==='projects')).toBe(true);expect(queries.some(q=>q.fields.includes('outputs->version'))).toBe(true);expect(settled).toBe(false);
 release();expect((await response).status).toBe(200);
});
it('starts all caller-RLS authoring reads together but withholds DTO and pricing until the exact target is verified',async()=>{
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});hold=(table,query)=>table==='estimates'&&query.filters.some(([key])=>key==='id')?paused:Promise.resolve();
 let settled=false;const response=opening().then(value=>{settled=true;return value;});
 for(let i=0;i<24;i++)await Promise.resolve();
 expect(queries.some(q=>q.table==='quote_versions')).toBe(true);expect(queries.some(q=>q.table==='projects')).toBe(true);expect(queries.some(q=>q.fields.includes('outputs->version'))).toBe(true);expect(settled).toBe(false);expect(queries.some(q=>q.table==='costing_configuration_publication')).toBe(false);
 release();const records=(await(await response).text()).trim().split('\n').map(line=>JSON.parse(line));expect(records[0].authoring.state).toBe('ready');expect(records[1].result.ok).toBe(true);
 expect(childSignals).toHaveLength(4);expect(childSignals.every(signal=>!signal.aborted)).toBe(true); // Includes current caller theme, after the same guard.
});

it.each(['foreign','failed'] as const)('keeps %s target precedence and cancels pending child reads without waiting for them',async outcome=>{
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});
 hold=(table,query)=>table==='estimates'&&query.filters.some(([key])=>key==='id')?Promise.resolve():paused;
 if(outcome==='foreign')row.project_id='foreign';else failure='estimates';
 const response=await opening();expect(response.status).toBe(outcome==='foreign'?404:503);
 expect(response.headers.get('content-type')).not.toContain('ndjson');expect(childSignals).toHaveLength(4);expect(childSignals.every(signal=>signal.aborted)).toBe(true);
 expect(queries.some(q=>q.table==='costing_configuration_publication')).toBe(false);
 release();for(let i=0;i<16;i++)await Promise.resolve();expect(queries.some(q=>q.table==='quote_send_logs')).toBe(false);
});

it('handles early child rejection but waits for target association and preserves its 404',async()=>{
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});
 hold=(table,query)=>table==='estimates'&&query.filters.some(([key])=>key==='id')?paused:Promise.resolve();
 failure='quote_versions';row.project_id='foreign';let settled=false;const response=opening().then(value=>{settled=true;return value;});
 for(let i=0;i<24;i++)await Promise.resolve();expect(settled).toBe(false);expect(queries.some(q=>q.table==='quote_versions')).toBe(true);
 release();expect((await response).status).toBe(404);expect(childSignals.every(signal=>signal.aborted)).toBe(true);
});

it('cancels pending quote authority when the opening request is abandoned and never starts send logs or publication',async()=>{
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});hold=table=>table==='quote_versions'?paused:Promise.resolve();
 quotes=[{id:'q1',source_estimate_version_id:estimate,status:'SENT'}];
 const controller=new AbortController(),response=loadStudioAuthoringRequest(new Request('http://localhost/studio',{signal:controller.signal}),ids);
 for(let i=0;i<24;i++)await Promise.resolve();expect(childSignals.every(signal=>!signal.aborted)).toBe(true);
 controller.abort();expect(childSignals.every(signal=>signal.aborted)).toBe(true);release();expect((await response).status).toBe(503);
 expect(queries.some(q=>q.table==='quote_send_logs'||q.table==='costing_configuration_publication')).toBe(false);
});

it('skips send-log reads when canonical fresh quote history is empty',async()=>{
 expect((await authoring()).status).toBe(200);expect(queries.some(q=>q.table==='quote_versions')).toBe(true);expect(queries.some(q=>q.table==='quote_send_logs')).toBe(false);
});

it('keeps full sibling-label failure closed after a valid target and optional project-name failure nonfatal',async()=>{
 hold=(_table,query)=>query.fields.includes('outputs->version')?Promise.reject(Error('label metadata unavailable')):Promise.resolve();
 const failed=await opening();expect(failed.status).toBe(503);expect(queries.filter(q=>q.table==='costing_configuration_publication')).toHaveLength(1);
 hold=null;failure='projects';const result=await(await authoring()).json();expect(result.authoring.state).toBe('ready');expect(result.authoring.identity.projectName).toBeNull();
});

it('starts one opening publication after exact target while quote authority is pending, without returning the DTO early',async()=>{
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});hold=table=>table==='quote_versions'?paused:Promise.resolve();
 let settled=false;const response=opening().then(value=>{settled=true;return value;});for(let i=0;i<24;i++)await Promise.resolve();
 expect(queries.filter(q=>q.table==='costing_configuration_publication')).toHaveLength(1);expect(settled).toBe(false);
 release();const records=(await(await response).text()).trim().split('\n').map(line=>JSON.parse(line));expect(records[0].authoring.state).toBe('ready');expect(records[1].result.ok).toBe(true);
 expect(queries.filter(q=>q.table==='costing_configuration_publication')).toHaveLength(1);
});

it.each(['quoted','authority-error','oversized'])('retires a held speculative publication on %s without admitting pricing',async mode=>{
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});
 hold=table=>table==='costing_configuration_publication'?paused:table==='quote_versions'&&mode==='authority-error'?Promise.reject(Error('Quote authority unavailable')):Promise.resolve();
 if(mode==='quoted')quotes=[{id:'q1',source_estimate_version_id:estimate,status:'DRAFT'}];
 if(mode==='oversized')row.outputs.studio_authored.site.values.extrasAllowanceExGst='1'.repeat(1_000_001);
 const response=await opening();expect(response.status).toBe(mode==='authority-error'?503:200);expect(publicationSignals).toHaveLength(1);expect(publicationSignals[0].aborted).toBe(true);
 if(response.status===200){const records=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));expect(records[0].binding).toBeNull();expect(records[1].result.ok).toBe(false);}
 release();for(let i=0;i<12;i++)await Promise.resolve();
});

it('uses one fresh request publication snapshot during concurrent activation and reads the new publication on the next opening',async()=>{
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});hold=table=>table==='quote_versions'?paused:Promise.resolve();
 const first=opening();for(let i=0;i<32;i++)await Promise.resolve();expect(queries.filter(q=>q.table==='costing_configuration_publication')).toHaveLength(1);
 const previous=publication.current_version_id;version={...version,id:'30000000-0000-4000-8000-000000000002',version_number:16};publication={current_version_id:version.id,version};
 release();const older=(await(await first).text()).trim().split('\n').map(line=>JSON.parse(line));expect(older[1].result.price.publicationId).toBe(previous);
 hold=null;const latest=(await(await opening()).text()).trim().split('\n').map(line=>JSON.parse(line));expect(latest[1].result.price.publicationId).toBe(version.id);expect(queries.filter(q=>q.table==='costing_configuration_publication')).toHaveLength(2);
});

it('keeps the opening publication capability single-use and uninjectable by a later calculation',async()=>{
 const auth=await mocks.auth(),prepared=await studioPriceComposition(row.outputs,body.composition);if(!prepared.ok)throw Error('Fixture invalid');
 const capability=startStudioOpeningPricing(auth,new AbortController().signal),args={body,composition:prepared.composition,preparedPricing:prepared.preparedPricing,resolved:null};
 expect((await capability.calculate(args)).status).toBe(200);await expect(capability.calculate(args)).rejects.toThrow('retired');expect(queries.filter(q=>q.table==='costing_configuration_publication')).toHaveLength(1);
});

it('retains zero speculative publication reads for ordinary JSON authoring',async()=>{
 expect((await authoring()).status).toBe(200);expect(publicationSignals).toHaveLength(0);expect(queries.some(q=>q.table==='costing_configuration_publication')).toBe(false);
});

it('waits for quote authority before reading current publication or calculating',async()=>{
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});hold=table=>table==='quote_versions'?paused:Promise.resolve();
 const response=price();for(let i=0;i<16;i++)await Promise.resolve();
 expect(queries.some(q=>q.table==='quote_versions')).toBe(true);expect(queries.some(q=>q.table==='costing_configuration_publication')).toBe(false);expect(queries.some(q=>q.table==='costing_configuration_versions')).toBe(false);
 release();expect((await response).status).toBe(200);
});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
const authoring=()=>loadStudioAuthoringRequest(new Request('http://localhost/studio'),ids);
const price=()=>studioWebsitePriceRequest(new Request('http://localhost/price',{method:'POST',body:JSON.stringify(body)}),ids);

it('correlates successful and refused authoring responses with a server-owned ID without changing their bodies',async()=>{
 const ready=await loadStudioAuthoringRequest(new Request('http://localhost/studio',{headers:{'x-portal-request-id':'private-incoming-header'}}),ids);
 expect(ready.headers.get('x-portal-request-id')).toBeTruthy();expect(ready.headers.get('x-portal-request-id')).not.toBe('private-incoming-header');
 expect(ready.headers.get('server-timing')).toMatch(/^total;dur=\d+\.\d$/);
 expect((await ready.json()).authoring.state).toBe('ready');
 mocks.auth.mockResolvedValueOnce({ok:false,response:Response.json({error:'Denied'},{status:401})});
 const denied=await authoring();expect(denied.status).toBe(401);expect(denied.headers.get('x-portal-request-id')).toBeTruthy();expect(await denied.json()).toEqual({error:'Denied'});
});

it.each(['json','denied','missing','caught'] as const)('records one payload-free %s result only when server diagnostics are enabled',async kind=>{
 vi.stubEnv('STUDIO_REQUEST_DIAGNOSTICS','1');const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 if(kind==='denied')mocks.auth.mockResolvedValueOnce({ok:false,response:Response.json({error:'Denied'},{status:401})});
 if(kind==='missing')row.project_id='foreign';
 if(kind==='caught')mocks.auth.mockRejectedValueOnce(Error('private credential customer data'));
 const response=await authoring();expect(response.status).toBe({json:200,denied:401,missing:404,caught:503}[kind]);
 expect(warn).toHaveBeenCalledOnce();const [prefix,summary]=warn.mock.calls[0];
 expect(prefix).toBe('[portal]');expect(summary).toMatchObject({event:'studio.request_diagnostics',requestId:response.headers.get('x-portal-request-id'),route:'/api/projects/[projectId]/estimates/[estimateId]/studio',method:'GET',status:response.status,outcome:kind==='caught'?'failure':'response'});
 expect(summary.stages[0]).toMatchObject({stage:'guard',state:kind==='caught'?'rejected':'settled'});
 expect(summary.startedAtUtc).toMatch(/^\d{4}-\d{2}-\d{2}T/);expect(summary.stages.every((stage:{startMs:number;durationMs:number})=>stage.startMs>=0&&stage.durationMs>=0)).toBe(true);
 expect(summary.stages.length).toBeLessThanOrEqual(9);
 expect(JSON.stringify(summary)).not.toMatch(/private credential|Courtyard|Exact project|actor|10000000|20000000|privateProof|requestKey/);
 if(kind==='caught')expect(await response.json()).toEqual({error:'Saved design is temporarily unavailable. Please retry.',code:'STUDIO_AUTHORING_UNAVAILABLE'});
});

it('does not enable detailed logging from request headers and keeps default responses correlated',async()=>{
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 const response=await loadStudioAuthoringRequest(new Request('http://localhost/studio',{headers:{'STUDIO_REQUEST_DIAGNOSTICS':'1','x-portal-request-id':'private-caller-token'}}),ids);
 expect(response.status).toBe(200);expect(response.headers.get('x-portal-request-id')).toBeTruthy();expect(response.headers.get('x-portal-request-id')).not.toBe('private-caller-token');expect(warn).not.toHaveBeenCalled();
});

it.each(['success','publication-error','cancel'] as const)('correlates the actual %s stream terminal once, without holding first authoring for price',async kind=>{
 vi.stubEnv('STUDIO_REQUEST_DIAGNOSTICS','1');const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});hold=table=>table==='costing_configuration_publication'?paused:Promise.resolve();
 if(kind==='publication-error')failure='costing_configuration_publication';
 const response=await opening(),header=response.headers.get('server-timing'),reader=response.body!.getReader();
 expect(JSON.parse(new TextDecoder().decode((await reader.read()).value)).kind).toBe('authoring');expect(warn).not.toHaveBeenCalled();
 await new Promise(resolve=>setTimeout(resolve,0));
 if(kind==='cancel')await reader.cancel();
 release();
 if(kind!=='cancel')expect(JSON.parse(new TextDecoder().decode((await reader.read()).value)).result.ok).toBe(kind==='success');
 expect((await reader.read()).done).toBe(true);reader.releaseLock();await new Promise(resolve=>setTimeout(resolve,0));
 expect(response.headers.get('server-timing')).toBe(header);expect(warn).toHaveBeenCalledOnce();
 const summary=warn.mock.calls[0][1];expect(summary).toMatchObject({requestId:response.headers.get('x-portal-request-id'),status:200,outcome:{success:'price-response','publication-error':'price-error',cancel:'reader-canceled'}[kind]});
 expect(summary.stages.map((entry:{stage:string})=>entry.stage)).toEqual(expect.arrayContaining(['guard','target','quote-authority','version-metadata','project-display','theme','projection','price-preparation','price-calculation']));
 expect(JSON.stringify(summary)).not.toMatch(/privateProof|actor|requestKey|Courtyard|pricebook|publicationId/);
});

it('keeps canonical authority and wire results when the diagnostic sink throws',async()=>{
 vi.stubEnv('STUDIO_REQUEST_DIAGNOSTICS','1');vi.spyOn(console,'warn').mockImplementation(()=>{throw Error('Broken local sink');});
 const response=await opening(),records=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
 expect(response.status).toBe(200);expect(records).toHaveLength(2);expect(records[0].authoring.state).toBe('ready');expect(records[1].result.ok).toBe(true);
 expect(queries.filter(query=>query.table==='costing_configuration_publication')).toHaveLength(1);
});

it('retains optional send-log and user-preset reads inside their canonical aggregate stages',async()=>{
 vi.stubEnv('STUDIO_REQUEST_DIAGNOSTICS','1');const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 quotes=[{id:'q1',source_estimate_version_id:estimate,status:'DRAFT'}];logs=[{quote_version_id:'q1',status:'SENT'}];
 themeSettings={preset_id:null,user_preset_id:'test-preset',overrides:{}};
 themePreset={id:'test-preset',user_id:'actor',name:'Private preset label',tokens:resolvePortalTheme().tokens};
 const response=await opening(),records=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
 expect(records[0].authoring.nextAction).toBe('create-revision');expect(records[1].result.ok).toBe(false);
 expect(queries.some(query=>query.table==='quote_send_logs')).toBe(true);expect(queries.some(query=>query.table==='portal_user_theme_presets')).toBe(true);
 const summary=warn.mock.calls[0][1];expect(summary.stages.filter((entry:{stage:string})=>entry.stage==='theme'||entry.stage==='quote-authority')).toHaveLength(2);
 expect(JSON.stringify(summary)).not.toMatch(/Private preset|test-preset|q1|actor/);expect(warn).toHaveBeenCalledOnce();
});

it.each(['authoring','price'] as const)('uses one verified target and only its canonical quote authority for %s',async kind=>{
 const response=await(kind==='authoring'?authoring():price());expect(response.status).toBe(200);
 const reads=queries.filter(q=>q.table==='estimates'&&q.filters.some(([key])=>key==='id'));
 expect(reads).toHaveLength(1);
 expect(queries.find(q=>q.table==='quote_versions')!.filters).toEqual([['source_estimate_version_id',[estimate]]]);
 expect(queries.some(q=>q.table==='estimates'&&q.fields==='id, status, created_at, commercial_scope_id')).toBe(false);
 if(kind==='price')expect(queries.filter(q=>q.table==='estimates')).toHaveLength(1);
 else{const result=await response.json();expect(result.authoring).toMatchObject({state:'ready',nextAction:'edit',estimate:{versionLabel:'V7',requiresNewRevision:false},identity:{internalName:'Courtyard',projectName:'Exact project',createdAt:row.created_at,history:'working'}});expect(JSON.stringify(result)).not.toContain('privateProof');}
});

it.each(['authoring','price'] as const)('does not make %s depend on unrelated job-pack history availability',async kind=>{
 failure='job_pack_generations';
 const response=await(kind==='authoring'?authoring():price());
 expect(response.status).toBe(200);
 expect(queries.some(q=>q.table==='job_pack_generations')).toBe(false);
 expect(queries.find(q=>q.table==='quote_versions')!.filters).toEqual([['source_estimate_version_id',[estimate]]]);
});

it('retains the complete real-canonical292 price response',async()=>{
 const response=await price();expect(response.status).toBe(200);
 expect(await response.json()).toMatchInlineSnapshot(`
   {
     "amount": 10848,
     "basis": "Published configured offer and selected staff site inputs. Existing house excluded.",
     "breakdown": [
       {
         "amount": 10848,
         "detail": "Current draft pricebook and configured-job policy, including protected base installation.",
         "label": "Pergola, roof & ceiling",
         "provisional": false,
       },
     ],
     "designId": "request-read-proof",
     "installationEstimate": {
       "siteDays": 3,
     },
     "pricingDigest": "8d02c701df1ae098cda3faec805c686ab513b78c25989dcc260e79a9b850b35f",
     "publicationContentHash": "f580f4ed56bcea78327b865a472653dd425f7e8a48c002faf6b714123bb66dc2",
     "publicationId": "30000000-0000-4000-8000-000000000001",
     "requestKey": "exact-request",
     "revision": 1,
     "selectionDigest": "1e30cead281b51de01505375167dcb781374c1408c48a019f305e7a91dfe07ef",
     "siteAssumptions": {
       "access": "Normal",
       "approvalRequirement": "Neither",
       "height": "Single storey",
       "jobType": "Residential",
       "pricingClassification": "Simple",
     },
     "status": "priced",
     "versionNumber": 15,
   }
 `);
});
it('reads one fresh publication and exact version in one caller-scoped REST request',async()=>{
 expect((await price()).status).toBe(200);
 expect(queries.filter(q=>['costing_configuration_publication','costing_configuration_versions'].includes(q.table))).toHaveLength(1);
 expect(queries.find(q=>q.table==='costing_configuration_publication')).toEqual({table:'costing_configuration_publication',fields:'current_version_id,version:costing_configuration_versions(*)',filters:[['singleton',true]]});
 expect(mocks.client).not.toHaveBeenCalled();
});
it.each(['missing-row','missing-pointer','missing-child','null-child','array-child','mismatched-id','malformed-row','draft','bad-hash','incompatible-config','read-error'])(
 'fails closed for current publication %s',async kind=>{
  if(kind==='missing-row')publication=null;
  if(kind==='missing-pointer')publication.current_version_id=null;
  if(kind==='missing-child')delete publication.version;
  if(kind==='null-child')publication.version=null;
  if(kind==='array-child')publication.version=[version];
  if(kind==='mismatched-id')publication.version={...version,id:'foreign'};
  if(kind==='malformed-row')delete version.name;
  if(kind==='draft')version.status='draft';
  if(kind==='bad-hash')version.content_hash='0'.repeat(64);
  if(kind==='incompatible-config'){version.config_json={...version.config_json,schemaVersion:'unsupported'};version.content_hash=hashCostingControlConfig(version.config_json);}
  if(kind==='read-error')failure='costing_configuration_publication';
  const response=await price();expect(response.status).toBe(503);
  expect(await response.json()).toEqual({error:['missing-row','missing-pointer','read-error'].includes(kind)?'Published pricing is unavailable. Your design is kept.':'Could not calculate this design. Your selections are kept.'});
  expect(queries.some(q=>q.table==='costing_configuration_versions')).toBe(false);
 });
it('resolves a fresh changed pointer and canonical provenance on the next request',async()=>{
 const first=await(await price()).json();
 version={...version,id:'30000000-0000-4000-8000-000000000002',version_number:16};
 publication={current_version_id:version.id,version};
 const second=await(await price()).json();
 expect(second).toMatchObject({status:'priced',amount:first.amount,publicationId:version.id,versionNumber:16,publicationContentHash:first.publicationContentHash,selectionDigest:first.selectionDigest});
 expect(second.pricingDigest).not.toBe(first.pricingDigest);
 expect(queries.filter(q=>q.table==='costing_configuration_publication')).toHaveLength(2);
 expect(queries.some(q=>q.table==='costing_configuration_versions')).toBe(false);
});
it('does not publish a price before the single fresh publication read completes',async()=>{
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});hold=table=>table==='costing_configuration_publication'?paused:Promise.resolve();
 let settled=false;const response=price().then(result=>{settled=true;return result;});
 await vi.waitFor(()=>expect(queries.some(q=>q.table==='costing_configuration_publication')).toBe(true));expect(settled).toBe(false);
 release();expect((await response).status).toBe(200);
});

it('delivers public authoring before a held initial price in one fresh request',async()=>{
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});hold=table=>table==='costing_configuration_publication'?paused:Promise.resolve();
 const response=await loadStudioAuthoringRequest(new Request('http://localhost/studio',{headers:{accept:'application/x-sanctuary-studio-opening+ndjson'}}),ids);
 expect(response.headers.get('content-type')).toContain('application/x-sanctuary-studio-opening+ndjson');
 const reader=response.body!.getReader(),first=JSON.parse(new TextDecoder().decode((await reader.read()).value));
 expect(first).toMatchObject({kind:'authoring',authoring:{state:'ready',nextAction:'edit'}});
 expect(JSON.stringify(first)).not.toContain('privateProof');
 expect(mocks.auth).toHaveBeenCalledTimes(1);
 expect(queries.filter(q=>q.table==='costing_configuration_publication')).toHaveLength(1);
 release();const rest=JSON.parse(new TextDecoder().decode((await reader.read()).value));
 expect(rest).toMatchObject({kind:'price',result:{ok:true,price:{status:'priced'}}});
 expect(queries.filter(q=>q.table==='estimates'&&q.filters.some(([key])=>key==='id'))).toHaveLength(1);
 expect(queries.filter(q=>q.table==='quote_versions')).toHaveLength(1);
 expect(queries.filter(q=>q.table==='costing_configuration_publication')).toHaveLength(1);
 expect((await reader.read()).done).toBe(true);reader.releaseLock();
});

const opening=()=>loadStudioAuthoringRequest(new Request('http://localhost/studio',{headers:{accept:'application/x-sanctuary-studio-opening+ndjson'}}),ids);
it.each(['staff','admin'])('keeps streamed %s pricing identical to the ordinary canonical composition POST',async currentRole=>{
 role=currentRole;const response=await opening(),records=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
 body.requestKey=records[0].binding.requestKey;
 const ordinary=await(await price()).json();expect(records[1].result).toEqual({ok:true,price:ordinary});
 expect(JSON.stringify(records)).not.toContain('privateProof');expect(records[1].result.price.internalCosts!==undefined).toBe(role==='admin');
});
it.each(['archived','quoted','legacy'])('keeps %s authoring available without an initial price, retiring any speculative quote-case read',async mode=>{
 if(mode==='archived')row.status='archived';
 if(mode==='quoted')quotes=[{id:'q1',source_estimate_version_id:estimate,status:'DRAFT'}];
 if(mode==='legacy')delete row.outputs.studio_authored;
 const records=(await(await opening()).text()).trim().split('\n').map(line=>JSON.parse(line));
 expect(records).toHaveLength(2);expect(records[0].binding).toBeNull();expect(records[1].result.ok).toBe(false);
 expect(queries.filter(q=>q.table==='costing_configuration_publication')).toHaveLength(mode==='quoted'?1:0);
});
it('keeps stream authoring usable on fresh publication failure and does not reuse a previous publication on retry',async()=>{
 failure='costing_configuration_publication';const records=(await(await opening()).text()).trim().split('\n').map(line=>JSON.parse(line));
 expect(records[0].authoring.state).toBe('ready');expect(records[1].result.ok).toBe(false);
 failure=null;version={...version,id:'30000000-0000-4000-8000-000000000002',version_number:16};publication={current_version_id:version.id,version};
 body.requestKey=records[0].binding.requestKey;expect(await(await price()).json()).toMatchObject({publicationId:version.id,versionNumber:16});
 expect(queries.filter(q=>q.table==='costing_configuration_publication')).toHaveLength(2);
});
it('denies stream auth before reads and missing targets before response frames, cancelling speculative caller-RLS reads',async()=>{
 role='customer';expect((await opening()).status).toBe(403);expect(queries).toHaveLength(0);
 role='staff';mocks.auth.mockResolvedValueOnce({ok:false,response:Response.json({error:'Denied'},{status:401})});expect((await opening()).status).toBe(401);expect(queries).toHaveLength(0);
 row.project_id='foreign';const missing=await opening();expect(missing.status).toBe(404);expect(missing.headers.get('content-type')).not.toContain('ndjson');expect(queries.some(q=>q.table==='quote_versions')).toBe(true);expect(childSignals.every(signal=>signal.aborted)).toBe(true);
});
it('keeps oversized optional price input out of the tail while preserving ordinary public authoring',async()=>{
 row.outputs.studio_authored.site.values.extrasAllowanceExGst='1'.repeat(1_000_001);
 const records=(await(await opening()).text()).trim().split('\n').map(line=>JSON.parse(line));
 expect(records[0]).toMatchObject({kind:'authoring',scope:{actorId:'actor',role:'staff'},authoring:{state:'ready'},binding:null});
 expect(records[0].authoring.view.site.extrasAllowanceExGst).toHaveLength(1_000_001);expect(records[1].result.ok).toBe(false);
 expect(queries.filter(q=>q.table==='costing_configuration_publication')).toHaveLength(1);
});

it('propagates stream cancellation to its actual current-publication query without emitting a late price',async()=>{
 let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});hold=table=>table==='costing_configuration_publication'?paused:Promise.resolve();
 const response=await opening(),reader=response.body!.getReader();await reader.read();await new Promise(resolve=>setTimeout(resolve,0));expect(publicationSignals).toHaveLength(1);expect(publicationSignals[0].aborted).toBe(false);
 await reader.cancel();expect(publicationSignals[0].aborted).toBe(true);release();await new Promise(resolve=>setTimeout(resolve,0));expect((await reader.read()).done).toBe(true);reader.releaseLock();
});
