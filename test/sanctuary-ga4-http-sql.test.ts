// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, expect, it } from 'vitest';
const actor='10000000-0000-4000-8000-000000000001',connection='20000000-0000-4000-8000-000000000001',binding='a'.repeat(64);
const vaultId='a'.repeat(26),itemId='b'.repeat(26),scope='https://www.googleapis.com/auth/analytics.readonly';
const query={period:{start:'2026-08-10',end:'2026-08-11'},comparison:{start:'2026-08-08',end:'2026-08-09'}};
let db:PGlite;
beforeEach(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create role praxis_reporting;
 create schema auth;create schema private;create schema praxis_reporting;create schema cron;
 create function cron.schedule(text,text,text)returns integer language sql as 'select 1';
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
 create table public.portal_users(user_id uuid primary key,role text);
 create table praxis_reporting.source_identity_v1(singleton boolean,source_key text,connection_id uuid,environment text);
 insert into auth.users values('${actor}',now(),null,null);insert into public.portal_users values('${actor}','staff');
 insert into praxis_reporting.source_identity_v1 values(true,'synthetic','${connection}','test');`);
 await db.exec(await readFile('supabase/migrations/20260923070001_sanctuary_ga4_reporting.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261021082853_ga4_v3_diagnostics.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261022013028_ga4_pre_token_settlement.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261022030852_ga4_vercel_credentials.sql','utf8'));
 await db.exec(`insert into private.sanctuary_ga4_control(actor_id,property_id,binding_hash,vault_id,item_id,expires_at,source_key,connection_id,environment)
 values('${actor}','123','${binding}','${vaultId}','${itemId}',now()+interval '1 day','synthetic','${connection}','test');`);
},30000);
afterEach(async()=>{await db.close();});
async function command(action:string,operation:string|null=null,input:{query?:unknown;step?:string;evidence?:unknown;payload?:string}={}) {
 return (await db.query<{r:Record<string,unknown>}>('select public.sanctuary_ga4_command($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)as r',
  [actor,'123',binding,'synthetic',connection,'test',action,operation,input.query===undefined?null:JSON.stringify(input.query),input.step??null,input.evidence===undefined?null:JSON.stringify(input.evidence),input.payload??null])).rows[0]!.r;
}
async function enable(){await db.exec('reset role;update private.sanctuary_ga4_control set enabled=true where singleton=true;set role service_role');}
async function claim(){return String((await command('claim',null,{query})).operation);}
function report(){return {source:'ga4',property:'123',timezone:'Pacific/Auckland',fetchedAt:new Date().toISOString(),query,traffic:[],channels:[],landing:[],events:[],sessions:null,previousSessions:null,warnings:[]};}
import { sanctuaryGa4Response } from '../apps/portal/lib/marketingIntegrations/ga4/http';
import { readGa4Report } from '../apps/portal/lib/marketingIntegrations/ga4/report/ga4';
import { acquisitionFixture, coreFixture } from '../apps/portal/lib/marketingIntegrations/ga4/report/diagnostics-fixture';
const source={databaseUrl:'postgres://unused',databaseSsl:false as const,token:'t'.repeat(32),sourceKey:'synthetic',connectionId:connection,environment:'test'};
const control={actor,property:'123',binding};
function request(action='refresh',signal?:AbortSignal){return new Request('https://portal.test/api/integrations/praxis/v1/marketing/ga4?action='+action+(action==='refresh'?'&start=2026-08-10&end=2026-08-11&comparisonStart=2026-08-08&comparisonEnd=2026-08-09&retain=true':''),{method:action==='delete'?'DELETE':'GET',signal,headers:{authorization:'Bearer '+source.token,'x-praxis-source-key':source.sourceKey,'x-praxis-connection-id':connection,'x-praxis-environment':'test'}});}
function dependencies(rotate=false){return {source:()=>source,control:()=>control,credentials:()=>({credentialStore:'vault' as const,...control,propertyId:'123',vaultId,itemId,clientId:'synthetic',clientSecret:'synthetic',vaultToken:'synthetic'}),
 store:()=>async(action:string,op:string|null,_signal:AbortSignal,input:object={})=>command(action,op,input),
 vault:()=>({authenticate:async()=>{},read:async()=>({refreshToken:'synthetic',version:3}),write:async()=>({version:4})}),
 google:()=>({token:async()=>({accessToken:'synthetic',scope,expiresIn:3600,...(rotate?{refreshToken:'rotated-synthetic'}:{})}),property:async()=>{}}),
 read:async()=>report(),business:async()=>{throw Error('synthetic unavailable')},delegation:()=>async()=>{},fetcher:fetch};}
it.each([false,true])('real HTTP to SQL succeeds and saved delivery survives lease expiry rotation=%s',async rotate=>{await enable();const deps=dependencies(rotate);let response=await sanctuaryGa4Response(request(),deps);expect(response.status).toBe(200);const body=await response.json();expect(body.report.business.status).toBe('unavailable');expect(body.resultHash).toBe(createHash('sha256').update(JSON.stringify(body.report)).digest('hex'));
 await db.exec(`reset role;update private.sanctuary_ga4_operations set expires_at=now()-interval '1 minute' where id='${body.operation}';set role service_role`);
 response=await sanctuaryGa4Response(request('read'),deps);expect(response.status).toBe(200);expect((await response.json()).resultHash).toBe(body.resultHash);
 expect((await sanctuaryGa4Response(request('delete'),deps)).status).toBe(200);expect((await (await sanctuaryGa4Response(request('read'),deps)).json()).status).toBe('missing');
});
it('lost rotating token response quarantines actual SQL and denies retry',async()=>{await enable();const deps=dependencies(true);deps.google=()=>({token:async()=>{throw Error('lost response')},property:async()=>{}});expect((await sanctuaryGa4Response(request(),deps)).status).toBe(503);await db.exec('reset role');expect((await db.query<{status:string}>('select status from private.sanctuary_ga4_operations')).rows[0].status).toBe('uncertain');await db.exec('set role service_role');await expect(claim()).rejects.toThrow('unresolved');});
it('settled report failure releases writer without uncertainty',async()=>{await enable();const deps=dependencies();deps.read=async()=>{throw Error('report unavailable')};expect((await sanctuaryGa4Response(request(),deps)).status).toBe(503);await db.exec('reset role');expect((await db.query<{status:string}>('select status from private.sanctuary_ga4_operations')).rows[0].status).toBe('report_failed');await db.exec('set role service_role');await claim();});
it.each(['read','authority'])('delete between SQL read and delivery withholds %s',async actionName=>{await enable();const deps=dependencies();expect((await sanctuaryGa4Response(request(),deps)).status).toBe(200);deps.store=()=>async(action,op,_signal,input={})=>{const result=await command(action,op,input);if(action==='read')await command('delete');return result;};const response=await sanctuaryGa4Response(request(actionName),deps);expect(response.status).toBe(503);expect(await response.text()).not.toContain('resultHash');});
it('authority shares actual read/deliver SQL audits and exposes only the exact saved revision',async()=>{
 await enable();const deps=dependencies();const original=await(await sanctuaryGa4Response(request(),deps)).json();
 const response=await sanctuaryGa4Response(request('authority'),deps),proof=await response.json();
 expect(response.status).toBe(200);expect(proof.schemaVersion).toBe('sanctuary.praxis.ga4.authority.v1');
 expect(proof.operation).toBe(original.operation);expect(proof.resultHash).toBe(original.resultHash);expect(proof).not.toHaveProperty('report');
 await db.exec('reset role');const events=(await db.query<{event:string}>('select event from private.sanctuary_ga4_events order by id desc limit 2')).rows;
 expect(events.map(row=>row.event)).toEqual(['deliver','read']);
});
it.each(['disabled','expired','staff','quarantine'])('authority preserves actual SQL denial: %s',async mode=>{
 await enable();const deps=dependencies();expect((await sanctuaryGa4Response(request(),deps)).status).toBe(200);
 await db.exec('reset role');
 await db.exec(mode==='disabled'?'update private.sanctuary_ga4_control set enabled=false where singleton=true':mode==='expired'?"update private.sanctuary_ga4_control set expires_at=now()+interval '30 seconds' where singleton=true":mode==='staff'?"update public.portal_users set role='customer'":"update private.sanctuary_ga4_operations set status='uncertain'");
 await db.exec('set role service_role');const response=await sanctuaryGa4Response(request('authority'),deps);
 expect(response.status).toBe(503);expect(await response.text()).not.toContain('resultHash');
});
it('source bearer change during Google effect withholds report and preserves quarantine',async()=>{await enable();const deps=dependencies();let changed=false;deps.source=()=>({...source,token:changed?'x'.repeat(32):source.token});deps.google=()=>({token:async()=>{changed=true;return {accessToken:'synthetic',scope,expiresIn:3600,refreshToken:'rotated-synthetic'}},property:async()=>{throw Error('must not execute')}});expect((await sanctuaryGa4Response(request(),deps)).status).toBe(503);await db.exec('reset role');const rows=(await db.query<{status:string,requires_write:boolean}>('select status,requires_write from private.sanctuary_ga4_operations')).rows;expect(rows[0]).toEqual({status:'uncertain',requires_write:true});});

function v3Request() { const original=request();const url=new URL(original.url);url.searchParams.set('reportVersion','sanctuary-ga4-v3');return new Request(url,original); }
function diagnosticDependencies(mode:'available'|'row_limit'|'limited'|'unexpected'='available') {
 const raw=acquisitionFixture(query);
 if(mode==='row_limit')raw.reports[0].rowCount=751;
 if(mode==='limited')raw.reports[1].metadata.subjectToThresholding=true;
 if(mode==='unexpected')raw.reports[0].dimensionHeaders[0].name='unexpected';
 const calls:number[]=[];
 const fetcher:typeof fetch=async(_url,init)=>{const size=JSON.parse(String(init?.body)).requests.length;calls.push(size);return Response.json(size===5?coreFixture(query):raw);};
 return {deps:{...dependencies(),read:readGa4Report,fetcher},calls};
}
it.each(['available','row_limit','limited'] as const)('actual HTTP/provider parser/completion SQL/read preserve v3 %s semantics',async mode=>{
 await enable();const {deps,calls}=diagnosticDependencies(mode),response=await sanctuaryGa4Response(v3Request(),deps);
 expect(response.status).toBe(200);const body=await response.json();expect(calls.sort()).toEqual([4,5]);
 expect(body.report.diagnostics.stages[0].count.value).toBe(37);expect(body.report.diagnostics.stages[0].count.previous).toBeNull();
 expect(body.report.diagnostics.acquisition.status).toBe(mode==='row_limit'?'unavailable':mode);
 if(mode==='row_limit')expect(body.report.diagnostics.acquisition).toEqual({status:'unavailable',reason:'row_limit'});
 if(mode==='limited')expect(body.report.diagnostics.acquisition.quality.comparisonsAllowed).toBe(false);
 const saved=await(await sanctuaryGa4Response(request('read'),deps)).json();expect(saved.report).toEqual(body.report);expect(saved.resultHash).toBe(body.resultHash);
 await db.exec('reset role');const operation=(await db.query<{requested_report_version:string,report_intent:{reportVersion:string},report_result:{rowCount:number}}>('select requested_report_version,report_intent,report_result from private.sanctuary_ga4_operations')).rows[0];
 expect(operation.requested_report_version).toBe('sanctuary-ga4-v3');expect(operation.report_intent.reportVersion).toBe('sanctuary-ga4-v3');
 expect(operation.report_result.rowCount).toBe(body.report.traffic.length+body.report.channels.length+body.report.landing.length+body.report.events.length+3+(mode==='row_limit'?0:body.report.diagnostics.acquisition.rows.length));
});
it('invalid acquisition retains fresh validated core through completion and saved SQL read',async()=>{
 await enable();const original=await(await sanctuaryGa4Response(request(),dependencies())).json();
 const {deps}=diagnosticDependencies('unexpected');const response=await sanctuaryGa4Response(v3Request(),deps);expect(response.status).toBe(200);const fresh=await response.json();
 expect(fresh.report.diagnostics.acquisition).toEqual({status:'unavailable',reason:'compatibility_unproven'});expect(fresh.report.diagnostics.stages[0].count.value).toBe(37);
 const saved=await(await sanctuaryGa4Response(request('read'),deps)).json();expect(saved.report).toEqual(fresh.report);expect(saved.resultHash).toBe(fresh.resultHash);expect(saved.operation).not.toBe(original.operation);
 await db.exec('reset role');const operations=(await db.query<{status:string}>('select status from private.sanctuary_ga4_operations order by created_at')).rows;
 expect(operations.map(row=>row.status)).toEqual(['completed','completed']);
});
it('SQL retained read rejects unavailable acquisition carrying hidden partial metric cells',async()=>{
 await enable();const {deps}=diagnosticDependencies('row_limit');expect((await sanctuaryGa4Response(v3Request(),deps)).status).toBe(200);
 await db.exec("reset role;update private.sanctuary_ga4_snapshot set payload=jsonb_set(payload::jsonb,'{diagnostics,acquisition,rows}','[]')::text;set role service_role");
 await expect(command('read')).rejects.toThrow('saved version');
});

it.each(['vault_auth','vault_read'])('pre-token %s failure preserves saved read and permits a separately admitted claim',async stage=>{
 await enable();const deps=dependencies();const saved=await(await sanctuaryGa4Response(request(),deps)).json();
 let tokenCalls=0;const google=deps.google;deps.google=()=>({...google(),token:async()=>{tokenCalls++;throw Error('must not execute')}});
 const vault=deps.vault;deps.vault=()=>({...vault(),...(stage==='vault_auth'?{authenticate:async()=>{throw Error('synthetic SDK failure')}}:{read:async()=>{throw Error('synthetic SDK failure')}})});
 expect((await sanctuaryGa4Response(request(),deps)).status).toBe(503);expect(tokenCalls).toBe(0);
 const retained=await(await sanctuaryGa4Response(request('read'),deps)).json();expect(retained.resultHash).toBe(saved.resultHash);expect(retained.operation).toBe(saved.operation);
 await db.exec('reset role');const failed=(await db.query<{status:string,pending_step:string}>('select status,pending_step from private.sanctuary_ga4_operations order by created_at desc limit 1')).rows[0];
 expect(failed).toEqual({status:'report_failed',pending_step:stage});await db.exec('set role service_role');await claim();
});
it('a late vault result cannot start Google after atomic pre-token settlement',async()=>{
 await enable();const deps=dependencies();let resolve!: (value:{refreshToken:string,version:number})=>void, entered!:()=>void;const waiting=new Promise<void>(done=>{entered=done});
 deps.vault=()=>({authenticate:async()=>{},read:()=>new Promise(done=>{resolve=done;entered()}),write:async()=>{throw Error('must not write')}});
 let tokenCalls=0;deps.google=()=>({token:async()=>{tokenCalls++;throw Error('must not execute')},property:async()=>{throw Error('must not execute')}});
 const response=sanctuaryGa4Response(request(),deps);await waiting;
 await db.exec('reset role');const op=(await db.query<{id:string}>('select id from private.sanctuary_ga4_operations')).rows[0].id;await db.exec('set role service_role');
 await command('finish',op,{evidence:{outcome:'report_failed'}});resolve({refreshToken:'synthetic-late',version:3});
 expect((await response).status).toBe(503);expect(tokenCalls).toBe(0);
 await db.exec('reset role');expect((await db.query<{status:string}>(`select status from private.sanctuary_ga4_operations where id='${op}'`)).rows[0].status).toBe('report_failed');
});
it('cancellation after a durable vault-read intent settles without executing that read or Google',async()=>{
 await enable();const deps=dependencies(),controller=new AbortController();let reads=0;
 const vault=deps.vault;deps.vault=()=>({...vault(),read:async()=>{reads++;throw Error('must not execute')}});
 deps.store=()=>async(action,op,_signal,input={})=>{const result=await command(action,op,input);if(action==='before'&&(input as {step?:string}).step==='vault_read')controller.abort();return result;};
 expect((await sanctuaryGa4Response(request('refresh',controller.signal),deps)).status).toBe(503);expect(reads).toBe(0);
 await db.exec('reset role');expect((await db.query<{status:string}>('select status from private.sanctuary_ga4_operations')).rows[0].status).toBe('report_failed');
});
