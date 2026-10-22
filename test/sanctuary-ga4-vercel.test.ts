// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { sanctuaryGa4Response } from '../apps/portal/lib/marketingIntegrations/ga4/http';
const actor='10000000-0000-4000-8000-000000000001', connection='20000000-0000-4000-8000-000000000001';
const binding='a'.repeat(64), credentialBinding='c'.repeat(64), nonce='d'.repeat(64), scope='https://www.googleapis.com/auth/analytics.readonly';
const query={period:{start:'2026-08-10',end:'2026-08-11'},comparison:null};
let db:PGlite;
beforeEach(async()=>{
 db=new PGlite(); await db.exec(`create role anon;create role authenticated;create role service_role;create role praxis_reporting;
 create schema auth;create schema private;create schema praxis_reporting;create schema cron;
 create function cron.schedule(text,text,text)returns integer language sql as 'select 1';
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
 create table public.portal_users(user_id uuid primary key,role text);
 create table praxis_reporting.source_identity_v1(singleton boolean,source_key text,connection_id uuid,environment text);
 insert into auth.users values('${actor}',now(),null,null);insert into public.portal_users values('${actor}','staff');
 insert into praxis_reporting.source_identity_v1 values(true,'synthetic','${connection}','test');`);
 for(const path of ['20260923070001_sanctuary_ga4_reporting','20261021082853_ga4_v3_diagnostics','20261022013028_ga4_pre_token_settlement','20261022030852_ga4_vercel_credentials']) await db.exec(await readFile(`supabase/migrations/${path}.sql`,'utf8'));
 await db.exec(`insert into private.sanctuary_ga4_control(actor_id,property_id,binding_hash,vault_id,item_id,enabled,expires_at,source_key,connection_id,environment)
 values('${actor}','123','${binding}','${'a'.repeat(26)}','${'b'.repeat(26)}',true,now()+interval '1 day','synthetic','${connection}','test');`);
},30000);
afterEach(async()=>{vi.restoreAllMocks();await db.close();});
async function command(action:string,operation:string|null=null,input:{query?:unknown;step?:string;evidence?:unknown;payload?:string}={}) {
 return (await db.query<{r:Record<string,unknown>}>('select public.sanctuary_ga4_command($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)as r',
 [actor,'123',binding,'synthetic',connection,'test',action,operation,input.query===undefined?null:JSON.stringify(input.query),input.step??null,input.evidence===undefined?null:JSON.stringify(input.evidence),input.payload??null])).rows[0]!.r;
}
async function transfer(action:string,receipt?:object){return (await db.query<{r:object}>('select public.sanctuary_ga4_credential_transfer($1,$2,$3,$4,$5,$6,$7,$8,$9)as r',
 [actor,'123',binding,'synthetic',connection,'test',nonce,action,receipt?JSON.stringify(receipt):action==='begin'?JSON.stringify({vaultId:'a'.repeat(26),itemId:'b'.repeat(26)}):null])).rows[0]!.r;}
async function admit(){await db.exec(`update private.sanctuary_ga4_control c set credential_transfer=jsonb_build_object('state','admitted','nonceHash','${nonce}',
 'expiresAt',clock_timestamp()+interval '10 minutes','controlHash',encode(sha256(convert_to((to_jsonb(c)-'credential_transfer')::text,'UTF8')),'hex')) where singleton=true;`);}
async function cutover(){await admit();await transfer('begin');await transfer('install_begin');await transfer('installed',{credentialBinding,environmentId:'synthetic-environment'});
 await db.exec(`update private.sanctuary_ga4_control set credential_store='vercel',credential_binding='${credentialBinding}' where singleton=true`);}
async function claim(){return String((await command('claim',null,{query,evidence:{reportVersion:'sanctuary-ga4-v2',credentialStore:'vercel',credentialBinding}})).operation);}
const credential={credentialStore:'vercel',credentialBinding};
async function boundary(op:string,step:string,before:object={},after=before){await command('before',op,{step,evidence:before});await command('after',op,{step,evidence:after});}
async function row(){return (await db.query<{v:Record<string,unknown>}>('select to_jsonb(c) v from private.sanctuary_ga4_control c')).rows[0]!.v;}
async function seedSaved(){const payload=JSON.stringify({source:'ga4',property:'123',timezone:'Pacific/Auckland',fetchedAt:new Date().toISOString(),query,traffic:[],channels:[],landing:[],events:[],sessions:null,previousSessions:null,warnings:[]});
 const hash=createHash('sha256').update(payload).digest('hex');
 const op=(await db.query<{id:string}>(`insert into private.sanctuary_ga4_operations(actor_id,generation,deletion_epoch,binding_hash,query,status,result_hash,expires_at)
 values($1,1,0,$2,$3,'completed',$4,now()-interval '1 minute') returning id`,[actor,binding,JSON.stringify(query),hash])).rows[0]!.id;
 await db.query(`insert into private.sanctuary_ga4_snapshot(operation_id,generation,binding_hash,payload,result_hash,fetched_at,expires_at)
 values($1,1,$2,$3,$4,$5,$5::timestamptz+interval '168 hours')`,[op,binding,payload,hash,JSON.parse(payload).fetchedAt]);return {op,payload,hash};}
it('preserves saved body, authority, generation and original operation across finite transfer and cutover',async()=>{
 const saved=await seedSaved(),before=await row();await admit();
 await expect(command('claim',null,{query})).rejects.toThrow('transfer unresolved');
 for(const action of ['begin','check','install_begin','installed']){await transfer(action,action==='installed'?{credentialBinding,environmentId:'synthetic-environment'}:undefined);
  expect((await command('read')).payload).toBe(saved.payload);await command('deliver',saved.op);}
 await expect(command('claim',null,{query})).rejects.toThrow('transfer unresolved');
 await db.exec(`update private.sanctuary_ga4_control set credential_store='vercel',credential_binding='${credentialBinding}' where singleton=true`);
 const after=await row(); expect(after.generation).toBe(before.generation);expect(after.binding_hash).toBe(before.binding_hash);
 expect((await command('read')).resultHash).toBe(saved.hash);await command('deliver',saved.op);
 await expect(command('claim',null,{query})).rejects.toThrow('credential authority changed');
 const op=await claim();await expect(command('before',op,{step:'vault_auth',evidence:{}})).rejects.toThrow('vault mode');
 await expect(command('before',op,{step:'credential_read',evidence:{...credential,credentialBinding:'e'.repeat(64)}})).rejects.toThrow('evidence mismatch');
});
it.each(['pending','settled'])('fences a failed Vercel read (%s) before Google with original pending evidence retained',async state=>{
 await cutover();const op=await claim();await command('before',op,{step:'credential_read',evidence:credential});
 if(state==='settled')await command('after',op,{step:'credential_read',evidence:credential});
 await command('finish',op,{evidence:{outcome:'report_failed'}});
 await expect(command('after',op,{step:'credential_read',evidence:credential})).rejects.toThrow('Invalid GA4 boundary');
 await expect(command('before',op,{step:'token_refresh',evidence:{}})).rejects.toThrow('Invalid GA4 boundary');
 await expect(command('finish',op,{evidence:{outcome:'uncertain'}})).rejects.toThrow('already final');
 expect((await db.query<{pending_step:string|null}>('select pending_step from private.sanctuary_ga4_operations where id=$1',[op])).rows[0]!.pending_step).toBe(state==='pending'?'credential_read':null);
 await claim();
});
it.each(['pending','rotated'])('preserves token uncertainty quarantine (%s) and old snapshot bytes',async state=>{
 const saved=await seedSaved();await cutover();const op=await claim();await boundary(op,'credential_read',credential);
 await command('before',op,{step:'token_refresh',evidence:{}});
 if(state==='rotated')await command('after',op,{step:'token_refresh',evidence:{scope,expiresIn:3600,refreshRotated:true}});
 await expect(command('finish',op,{evidence:{outcome:'report_failed'}})).rejects.toThrow('unresolved');
 await expect(command('before',op,{step:'property_read',evidence:{property:'123'}})).rejects.toThrow('out of order');
 await command('finish',op,{evidence:{outcome:'uncertain'}});await expect(claim()).rejects.toThrow('writer unresolved');
 expect((await db.query<{payload:string}>('select payload from private.sanctuary_ga4_snapshot')).rows[0]!.payload).toBe(saved.payload);
 await expect(command('read')).rejects.toThrow('quarantined');
});
it('keeps expired/uncertain transfer single-use and refuses Stop or concurrent-operation drift',async()=>{
 await admit();await transfer('begin');await transfer('unconfirmed');await expect(transfer('begin')).rejects.toThrow('already attempted');
 await db.exec(`update private.sanctuary_ga4_control set credential_transfer=jsonb_set(credential_transfer,'{expiresAt}',to_jsonb((now()-interval '1 hour')::text)) where singleton=true`);
 await expect(command('claim',null,{query})).rejects.toThrow('transfer unresolved');
 await expect(transfer('check')).rejects.toThrow('authority changed');
 await db.exec(`update private.sanctuary_ga4_control set enabled=false where singleton=true`);
 await expect(transfer('installed',{credentialBinding,environmentId:'synthetic-environment'})).rejects.toThrow('authority changed');
});
it('rejects cutover without exact receipt or while a prior executor exists',async()=>{
 const op=String((await command('claim',null,{query})).operation);await admit();await expect(transfer('begin')).rejects.toThrow('authority changed');
 await command('finish',op,{evidence:{outcome:'report_failed'}});await transfer('begin');await transfer('install_begin');
 await expect(transfer('installed',{credentialBinding,environmentId:'synthetic',refreshToken:'forbidden'})).rejects.toThrow('receipt');
 await transfer('installed',{credentialBinding,environmentId:'synthetic'});
 await expect(db.exec(`update private.sanctuary_ga4_control set credential_store='vercel',credential_binding='${'e'.repeat(64)}' where singleton=true`)).rejects.toThrow('cutover unavailable');
});
it('HTTP composition uses Vercel credentials, saves and delivers without constructing the vault',async()=>{
 await cutover();await db.exec('set role service_role');
 const source={databaseUrl:'unused',databaseSsl:false as const,token:'t'.repeat(32),sourceKey:'synthetic',connectionId:connection,environment:'test'};
 const control={actor,property:'123',binding},vault=vi.fn(()=>{throw Error('Vault must not be constructed');});
 const deps={source:()=>source,control:()=>control,credentials:()=>({...control,propertyId:'123',credentialStore:'vercel' as const,credentialBinding,refreshToken:'synthetic-refresh',clientId:'synthetic',clientSecret:'synthetic'}),
 store:()=>async(action:string,op:string|null,_signal:AbortSignal,input:object={})=>command(action,op,input),vault,
 google:()=>({token:async()=>({accessToken:'synthetic-access',scope,expiresIn:3600}),property:async()=>{}}),
 read:async()=>({source:'ga4' as const,property:'123',timezone:'Pacific/Auckland',fetchedAt:new Date().toISOString(),query,traffic:[],channels:[],landing:[],events:[],sessions:null,previousSessions:null,warnings:[]}),
 business:async()=>{throw Error('unavailable');},delegation:()=>async()=>{},fetcher:fetch};
 const request=(action:string)=>new Request('https://portal.test/api/integrations/praxis/v1/marketing/ga4?action='+action+(action==='refresh'?'&start=2026-08-10&end=2026-08-11&retain=true':''),
 {headers:{authorization:'Bearer '+source.token,'x-praxis-source-key':source.sourceKey,'x-praxis-connection-id':connection,'x-praxis-environment':'test'}});
 const response=await sanctuaryGa4Response(request('refresh'),deps);expect(response.status).toBe(200);expect(vault).not.toHaveBeenCalled();
 const saved=await response.json();const authority=await sanctuaryGa4Response(request('authority'),deps);expect(authority.status).toBe(200);expect((await authority.json()).resultHash).toBe(saved.resultHash);
});
