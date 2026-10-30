import {beforeEach,expect,it,vi} from 'vitest';
import {loadEstimateQuoteEditability,loadProjectEstimateFlowMaps} from './flow';
import {computeEstimateEditability} from './editability';
const auth=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/supabase/serverClient',()=>({getSupabaseServerAuth:auth}));
const rows=[{id:'base1',status:'draft',created_at:'2026-10-01',commercial_scope_id:null},{id:'base2',status:'draft',created_at:'2026-10-02',commercial_scope_id:null},{id:'add1',status:'draft',created_at:'2026-10-01',commercial_scope_id:'30000000-0000-4000-8000-000000000001'},{id:'add2',status:'draft',created_at:'2026-10-03',commercial_scope_id:'30000000-0000-4000-8000-000000000001'}];
const quotes=[{id:'q1',source_estimate_version_id:'base1',status:'DRAFT',sent_at:null,created_at:'2026-10-01',version_number:1,quotes:{quote_ref:'Q-1'}},{id:'q2',source_estimate_version_id:'add2',status:'DRAFT',sent_at:null,created_at:'2026-10-03',version_number:2,quotes:{quote_ref:'Q-2'}}];
const logs=[{quote_version_id:'q2',status:'SENT',sent_at:'2026-10-04T00:00:00Z',created_at:'2026-10-04'}];
const generations=[{estimate_id:'add2',quote_version_id:'old',created_at:'2026-10-04'},{estimate_id:'add2',quote_version_id:'q2',created_at:'2026-10-05'}];
const queries:Array<{table:string;fields:string;filters:Array<[string,unknown]>;order?:unknown}>=[];
let failure:string|null,code:string;
let pause:((table:string)=>Promise<void>)|null;
const signals:Array<{table:string;signal:AbortSignal}>=[];
const client={from(table:string){
 const entry={table,fields:'',filters:[] as Array<[string,unknown]>,order:undefined as unknown};queries.push(entry);
 const result=()=>({data:table==='estimates'?rows:table==='quote_versions'?quotes:table==='quote_send_logs'?logs:generations,error:failure===table?{message:table+' unavailable',code}:null});
 const query={select(fields:string){entry.fields=fields;return query;},eq(field:string,value:unknown){entry.filters.push([field,value]);return query;},in(field:string,value:unknown){entry.filters.push([field,value]);return query;},order(field:string,options:unknown){entry.order={field,options};return query;},abortSignal(signal:AbortSignal){signals.push({table,signal});return query;},then(resolve:any,reject:any){return (async()=>{if(pause)await pause(table);return result();})().then(resolve,reject);}};return query;
}};
beforeEach(()=>{queries.length=0;signals.length=0;pause=null;failure=null;code='TEMPORARY';auth.mockReset();auth.mockResolvedValue(client);});

it.each([false,true])('preserves full project flow and canonical editability with provided rows=%s',async provided=>{
 const actual=await loadProjectEstimateFlowMaps('project',provided?rows:undefined,client as any);
 expect(actual.activeDraftEstimateId).toBe('base2');
 expect([...actual.editabilityByEstimateId]).toEqual(rows.map(row=>[row.id,computeEstimateEditability({quoteVersions:quotes.filter(q=>q.source_estimate_version_id===row.id),sendLogs:row.id==='add2'?logs:[]})]));
 expect([...actual.flowByEstimateId]).toEqual([
  ['base1',{isActiveDraft:false,hasSentQuote:false,jobPackEligible:false,jobPackGeneratedAt:null,jobPackQuoteVersionId:null}],
  ['base2',{isActiveDraft:true,hasSentQuote:false,jobPackEligible:false,jobPackGeneratedAt:null,jobPackQuoteVersionId:null}],
  ['add1',{isActiveDraft:true,hasSentQuote:false,jobPackEligible:false,jobPackGeneratedAt:null,jobPackQuoteVersionId:null}],
  ['add2',{isActiveDraft:false,hasSentQuote:true,jobPackEligible:true,jobPackGeneratedAt:'2026-10-05',jobPackQuoteVersionId:'qv_q2'}],
 ]);
 expect(queries.map(q=>q.table)).toEqual([...(provided?[]:['estimates']),'quote_versions','quote_send_logs','job_pack_generations']);
 expect(queries.find(q=>q.table==='job_pack_generations')!.filters).toEqual([['estimate_id',rows.map(row=>row.id)]]);
 expect(auth).not.toHaveBeenCalled();
});

it('keeps empty input free of remote reads and uses caller-auth fallback only when omitted',async()=>{
 const empty=await loadProjectEstimateFlowMaps('project',[],client as any);expect(empty.activeDraftEstimateId).toBeNull();expect(empty.editabilityByEstimateId.size).toBe(0);expect(empty.flowByEstimateId.size).toBe(0);expect(queries).toHaveLength(0);
 await loadProjectEstimateFlowMaps('project',rows);expect(auth).toHaveBeenCalledExactlyOnceWith();
});

it.each(['quote_versions','quote_send_logs','job_pack_generations'])('preserves %s failure and dependency ordering',async table=>{
 failure=table;await expect(loadProjectEstimateFlowMaps('project',rows,client as any)).rejects.toThrow(table+' unavailable');
 expect(queries.map(q=>q.table)).toEqual(['quote_versions','quote_send_logs','job_pack_generations'].slice(0,['quote_versions','quote_send_logs','job_pack_generations'].indexOf(table)+1));
});

it.each(['PGRST204','42703'])('keeps legacy missing job-pack table handling for %s',async legacy=>{
 failure='job_pack_generations';code=legacy;const result=await loadProjectEstimateFlowMaps('project',rows,client as any);
 expect(result.activeDraftEstimateId).toBe('base2');expect(result.flowByEstimateId.get('add2')).toMatchObject({hasSentQuote:true,jobPackGeneratedAt:null,jobPackQuoteVersionId:null});
});

it('returns the same quote authority alone, without job-pack/flow reads or an implicit client',async()=>{
 const empty=await loadEstimateQuoteEditability([],client as any);expect(empty.size).toBe(0);expect(queries).toHaveLength(0);
 failure='job_pack_generations';const actual=await loadEstimateQuoteEditability(rows.map(row=>row.id),client as any);
 expect([...actual]).toEqual(rows.map(row=>[row.id,computeEstimateEditability({quoteVersions:quotes.filter(q=>q.source_estimate_version_id===row.id),sendLogs:row.id==='add2'?logs:[]})]));
 expect(queries.map(q=>q.table)).toEqual(['quote_versions','quote_send_logs']);expect(auth).not.toHaveBeenCalled();
});

it.each(['quote_versions','quote_send_logs'])('cancels the existing %s authority read with its supplied request signal',async table=>{
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});pause=current=>current===table?held:Promise.resolve();
 const controller=new AbortController(),pending=loadEstimateQuoteEditability(['base1','add2'],client as any,controller.signal);
 // Attach the rejection expectation before cancellation/settlement.
 const rejected=expect(pending).rejects.toThrow();
 for(let i=0;i<16;i++)await Promise.resolve();expect(signals.at(-1)).toEqual({table,signal:controller.signal});
 controller.abort();release();await rejected;
 expect(queries.map(query=>query.table)).toEqual(table==='quote_versions'?['quote_versions']:['quote_versions','quote_send_logs']);
});

it('refuses an already-aborted quote read without starting any query',async()=>{
 const controller=new AbortController();controller.abort();await expect(loadEstimateQuoteEditability(['base1'],client as any,controller.signal)).rejects.toThrow();expect(queries).toHaveLength(0);
});
