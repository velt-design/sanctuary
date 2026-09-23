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
const source={databaseUrl:'postgres://unused',databaseSsl:false as const,token:'t'.repeat(32),sourceKey:'synthetic',connectionId:connection,environment:'test'};
const control={actor,property:'123',binding};
function request(action='refresh',signal?:AbortSignal){return new Request('https://portal.test/api/integrations/praxis/v1/marketing/ga4?action='+action+(action==='refresh'?'&start=2026-08-10&end=2026-08-11&comparisonStart=2026-08-08&comparisonEnd=2026-08-09&retain=true':''),{method:action==='delete'?'DELETE':'GET',signal,headers:{authorization:'Bearer '+source.token,'x-praxis-source-key':source.sourceKey,'x-praxis-connection-id':connection,'x-praxis-environment':'test'}});}
function dependencies(rotate=false){return {source:()=>source,control:()=>control,credentials:()=>({...control,propertyId:'123',vaultId,itemId,clientId:'synthetic',clientSecret:'synthetic',vaultToken:'synthetic'}),
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
it('delete between SQL read and delivery withholds the retained report',async()=>{await enable();const deps=dependencies();expect((await sanctuaryGa4Response(request(),deps)).status).toBe(200);deps.store=()=>async(action,op,_signal,input={})=>{const result=await command(action,op,input);if(action==='read')await command('delete');return result;};const response=await sanctuaryGa4Response(request('read'),deps);expect(response.status).toBe(503);expect(await response.text()).not.toContain('fetchedAt');});
it('source bearer change during Google effect withholds report and preserves quarantine',async()=>{await enable();const deps=dependencies();let changed=false;deps.source=()=>({...source,token:changed?'x'.repeat(32):source.token});deps.google=()=>({token:async()=>{changed=true;return {accessToken:'synthetic',scope,expiresIn:3600,refreshToken:'rotated-synthetic'}},property:async()=>{throw Error('must not execute')}});expect((await sanctuaryGa4Response(request(),deps)).status).toBe(503);await db.exec('reset role');const rows=(await db.query<{status:string,requires_write:boolean}>('select status,requires_write from private.sanctuary_ga4_operations')).rows;expect(rows[0]).toEqual({status:'uncertain',requires_write:true});});
