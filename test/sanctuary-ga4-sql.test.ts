// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, expect, it } from 'vitest';
const actor='10000000-0000-4000-8000-000000000001',connection='20000000-0000-4000-8000-000000000001',binding='a'.repeat(64);
const vaultId='a'.repeat(26),itemId='b'.repeat(26),scope='https://www.googleapis.com/auth/analytics.readonly';
const query={period:{start:'2026-08-10',end:'2026-08-11'},comparison:{start:'2026-08-08',end:'2026-08-09'}};
const intent={property:'123',queryHash:'c'.repeat(64),reportVersion:'sanctuary-ga4-v2',startDate:query.period.start,endDate:query.period.end,comparisonStart:query.comparison.start,comparisonEnd:query.comparison.end};
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
async function boundary(op:string,step:string,before:unknown={},after:unknown=before){await command('before',op,{step,evidence:before});await command('after',op,{step,evidence:after});}
async function credentials(op:string,rotate=false){
 await boundary(op,'vault_auth');await boundary(op,'vault_read',{vaultId,itemId},{vaultId,itemId,afterVersion:3});
 await boundary(op,'token_refresh',{}, {scope,expiresIn:3600,refreshRotated:rotate});await boundary(op,'property_read',{property:'123'});
 if(rotate)await boundary(op,'vault_write',{vaultId,itemId,beforeVersion:3},{vaultId,itemId,beforeVersion:3,afterVersion:4});
}
function report(){return {source:'ga4',property:'123',timezone:'Pacific/Auckland',fetchedAt:new Date().toISOString(),query,traffic:[],channels:[],landing:[],events:[],sessions:null,previousSessions:null,warnings:[]};}
async function ready(op:string,rotate=false){await credentials(op,rotate);const value=report(),payload=JSON.stringify(value),hash=createHash('sha256').update(payload).digest('hex');
 await boundary(op,'report_read',intent,{...intent,reportOutcome:'complete',resultHash:hash,rowCount:0,warningCount:0,timezone:value.timezone});
 await command('finish',op,{evidence:{outcome:'connected'}});return {payload,hash,value};}
it('is default disabled, grants only RPCs and rejects inactive or changed actors/source',async()=>{
 await db.exec('set role service_role');await expect(claim()).rejects.toThrow('authority');
 await expect(db.query('select * from private.sanctuary_ga4_control')).rejects.toThrow();
 for(const role of ['anon','authenticated','praxis_reporting']){await db.exec(`reset role;set role ${role}`);await expect(command('read')).rejects.toThrow();}
 await enable();for(const mutation of [`delete from public.portal_users where user_id='${actor}'`,`update auth.users set email_confirmed_at=null where id='${actor}'`,`update auth.users set banned_until=now()+interval '1 day' where id='${actor}'`,`update praxis_reporting.source_identity_v1 set source_key='other' where singleton=true`]){
  await db.exec('reset role;begin');await db.exec(mutation);await db.exec('set local role service_role');await expect(command('read')).rejects.toThrow('actor or source');await db.exec('rollback');
 }
});
it.each([false,true])('persists exact complete report and seven-day retention, rotation=%s',async rotate=>{
 await enable();const op=await claim(),saved=await ready(op,rotate);
 expect(await command('complete',op,{payload:saved.payload})).toEqual({status:'completed',operation:op});
 const read=await command('read');expect(read.resultHash).toBe(saved.hash);expect(JSON.parse(String(read.payload))).toEqual(saved.value);
 expect(Date.parse(String(read.expiresAt))-Date.parse(saved.value.fetchedAt)).toBe(7*86400000);
 await command('deliver',op);await expect(command('complete',op,{payload:saved.payload})).rejects.toThrow();
 // The writer lease expires in two minutes; a saved report remains deliverable for seven days.
 await db.exec(`reset role;update private.sanctuary_ga4_operations set expires_at=now()-interval '1 minute' where id='${op}';set role service_role`);
 await command('read');await command('deliver',op);
 await command('delete');expect(await command('read')).toEqual({status:'missing'});await expect(command('deliver',op)).rejects.toThrow();
 await db.exec('reset role');await expect(db.exec('delete from private.sanctuary_ga4_events where id>0')).rejects.toThrow('append only');
});
it('does not resurrect a report after deletion between ready and completion',async()=>{
 await enable();const op=await claim(),saved=await ready(op);await command('delete');
 await expect(command('complete',op,{payload:saved.payload})).rejects.toThrow('not ready');
 await command('finish',op,{evidence:{outcome:'report_failed'}});expect(await command('read')).toEqual({status:'missing'});await claim();
});
it.each(['vault_auth','vault_read','token_refresh','property_read','vault_write'])('quarantines unresolved %s even after expiry, disabling, deletion and re-enabling',async step=>{
 await enable();const op=await claim();
 if(step!=='vault_auth')await boundary(op,'vault_auth');
 if(!['vault_auth','vault_read'].includes(step))await boundary(op,'vault_read',{vaultId,itemId},{vaultId,itemId,afterVersion:3});
 if(['property_read','vault_write'].includes(step))await boundary(op,'token_refresh',{}, {scope,expiresIn:3600,refreshRotated:true});
 if(step==='vault_write')await boundary(op,'property_read',{property:'123'});
 const evidence=step==='vault_read'?{vaultId,itemId}:step==='property_read'?{property:'123'}:step==='vault_write'?{vaultId,itemId,beforeVersion:3}:{};
 await command('before',op,{step,evidence});await expect(command('finish',op,{evidence:{outcome:'report_failed'}})).rejects.toThrow('unresolved');
 await db.exec(`reset role;update private.sanctuary_ga4_operations set expires_at=now()-interval '1 minute' where id='${op}';update private.sanctuary_ga4_control set enabled=false where singleton=true;set role service_role`);
 await command('finish',op,{evidence:{outcome:'uncertain'}});await command('delete');await enable();
 await expect(claim()).rejects.toThrow('writer unresolved');await expect(command('read')).rejects.toThrow('quarantined');
});
it('an expired unfinished lease blocks a second writer even without finish uncertain',async()=>{
 await enable();const op=await claim();await db.exec(`reset role;update private.sanctuary_ga4_operations set expires_at=now()-interval '1 minute' where id='${op}';set role service_role`);
 await expect(claim()).rejects.toThrow('writer unresolved');
});
it('allows unavailable report recovery only after credential results settled and caps six attempts',async()=>{
 await enable();for(let i=0;i<6;i++){const op=await claim();await credentials(op);await boundary(op,'report_read',intent,{...intent,reportOutcome:'unavailable'});
  await expect(command('finish',op,{evidence:{outcome:'connected'}})).rejects.toThrow();await command('finish',op,{evidence:{outcome:'report_failed'}});}
 await expect(claim()).rejects.toThrow('read limit');
});
it('rejects null, unordered, secret-bearing and wrong identity/version evidence',async()=>{
 await enable();const op=await claim();await expect(command('before',op,{step:'token_refresh',evidence:{}})).rejects.toThrow();
 await expect(command('before',op,{step:'vault_auth'})).rejects.toThrow();
 await expect(command('before',op,{step:'vault_auth',evidence:{accessToken:'synthetic-secret'}})).rejects.toThrow();await boundary(op,'vault_auth');
 await expect(command('before',op,{step:'vault_read',evidence:{vaultId,itemId:'c'.repeat(26)}})).rejects.toThrow('vault mismatch');
 await boundary(op,'vault_read',{vaultId,itemId},{vaultId,itemId,afterVersion:3});await command('before',op,{step:'token_refresh',evidence:{}});
 await expect(command('after',op,{step:'token_refresh',evidence:{scope:'invalid',expiresIn:3600,refreshRotated:false}})).rejects.toThrow('scope mismatch');
 await expect(command('after',op,{step:'token_refresh',evidence:{scope,expiresIn:3600,refreshRotated:null}})).rejects.toThrow();
 await command('after',op,{step:'token_refresh',evidence:{scope,expiresIn:3600,refreshRotated:true}});await boundary(op,'property_read',{property:'123'});
 await expect(command('before',op,{step:'report_read',evidence:intent})).rejects.toThrow('out of order');
 await command('before',op,{step:'vault_write',evidence:{vaultId,itemId,beforeVersion:3}});
 await expect(command('after',op,{step:'vault_write',evidence:{vaultId,itemId,beforeVersion:3,afterVersion:3}})).rejects.toThrow('version mismatch');
});
it('validates queries, complete payload/hash and invalidates saved data on authority changes',async()=>{
 await enable();for(const invalid of [null,{}, {...query,extra:true}, {...query,comparison:query.period},{period:{start:'2026-02-30',end:'2026-03-01'},comparison:null}])await expect(command('claim',null,{query:invalid})).rejects.toThrow();
 const op=await claim(),saved=await ready(op);
 await expect(command('complete',op,{payload:JSON.stringify({...saved.value,property:'456'})})).rejects.toThrow('association');
 await command('complete',op,{payload:saved.payload});await db.exec('reset role;update private.sanctuary_ga4_control set enabled=false where singleton=true;set role service_role');
 await expect(command('read')).rejects.toThrow('authority');await command('delete');await enable();expect(await command('read')).toEqual({status:'missing'});
});
it('accepts absent comparison as JSON null but rejects omitted or malformed comparison evidence',async()=>{
 await enable();const noComparison={...query,comparison:null};
 const op=String((await command('claim',null,{query:noComparison})).operation);await credentials(op);
 const noComparisonIntent={...intent,comparisonStart:null,comparisonEnd:null};
 await expect(command('before',op,{step:'report_read',evidence:{...noComparisonIntent,comparisonStart:undefined}})).rejects.toThrow();
 await expect(command('before',op,{step:'report_read',evidence:intent})).rejects.toThrow();
 const value={...report(),query:noComparison},payload=JSON.stringify(value),hash=createHash('sha256').update(payload).digest('hex');
 await boundary(op,'report_read',noComparisonIntent,{...noComparisonIntent,reportOutcome:'complete',resultHash:hash,rowCount:0,warningCount:0,timezone:value.timezone});
 await command('finish',op,{evidence:{outcome:'connected'}});await command('complete',op,{payload});expect((await command('read')).operation).toBe(op);
});
it('purges expired snapshots without releasing credential quarantine',async()=>{
 await enable();const op=await claim(),saved=await ready(op);await command('complete',op,{payload:saved.payload});
 await db.exec(`reset role;update private.sanctuary_ga4_snapshot set fetched_at=now()-interval '8 days',expires_at=now()-interval '1 day' where singleton=true;set role service_role`);
 expect((await db.query<{n:number}>('select public.sanctuary_ga4_purge() as n')).rows[0]!.n).toBe(1);
 expect(await command('read')).toEqual({status:'missing'});
 const uncertain=await claim();await command('before',uncertain,{step:'vault_auth',evidence:{}});await command('finish',uncertain,{evidence:{outcome:'uncertain'}});
 await db.query('select public.sanctuary_ga4_purge()');await expect(claim()).rejects.toThrow('writer unresolved');
});
it('keeps explicit ongoing authority while enforcing report retention and revocation generations',async()=>{
 await db.exec("update private.sanctuary_ga4_control set expires_at='infinity' where singleton=true");
 await enable();const op=await claim(),saved=await ready(op);await command('complete',op,{payload:saved.payload});
 const first=await command('read');expect(Date.parse(String(first.expiresAt))-Date.parse(saved.value.fetchedAt)).toBe(7*86400000);
 // Move the stored clocks forward relative to now without sleeping: a completed
 // writer is old, while its replacement report still has one day of retention.
 await db.exec(`reset role;update private.sanctuary_ga4_operations set created_at=now()-interval '120 days',expires_at=now()-interval '120 days'+interval '120 seconds' where id='${op}';
 update private.sanctuary_ga4_snapshot set fetched_at=now()-interval '6 days',expires_at=now()+interval '1 day' where singleton=true;set role service_role`);
 expect((await command('read')).status).toBe('available');await command('deliver',op);
 await db.exec("reset role;update private.sanctuary_ga4_snapshot set fetched_at=now()-interval '8 days',expires_at=now()-interval '1 day' where singleton=true;set role service_role");
 await db.query('select public.sanctuary_ga4_purge()');expect(await command('read')).toEqual({status:'missing'});
 await expect(command('deliver',op)).rejects.toThrow('delivery unavailable');
 const next=await claim(),pending=await ready(next);
 await db.exec('reset role;update private.sanctuary_ga4_control set enabled=false where singleton=true;set role service_role');
 await expect(command('read')).rejects.toThrow('authority');await expect(command('complete',next,{payload:pending.payload})).rejects.toThrow('authority');
 await enable();await expect(command('complete',next,{payload:pending.payload})).rejects.toThrow('authority expired');
 await command('finish',next,{evidence:{outcome:'report_failed'}});await claim();
});
it('keeps finite validation authority expiry effective',async()=>{
 await enable();const op=await claim(),saved=await ready(op);await command('complete',op,{payload:saved.payload});
 await db.exec("reset role;update private.sanctuary_ga4_control set expires_at=now()+interval '30 seconds' where singleton=true;set role service_role");
 await expect(claim()).rejects.toThrow('authority');await expect(command('read')).rejects.toThrow('authority');
 await expect(command('deliver',op)).rejects.toThrow('authority');await command('delete');
});
