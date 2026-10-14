// @vitest-environment node
import { beforeAll, beforeEach, afterEach, afterAll, expect, it } from 'vitest';
import { metaFixtureDb, metaFixtureId as id, type MetaFixtureDb } from './fixtures/meta-source-db';
import { sampleMetaReport } from '../apps/portal/lib/marketingIntegrations/meta/report';
import { metaSaleStatusSchema } from '../apps/portal/lib/marketingIntegrations/metaSales/contract';
let db:MetaFixtureDb;
const binding='c'.repeat(64),oldHash='a'.repeat(64),newHash='b'.repeat(64);
const identity=(capability='sales')=>({capability,actorId:id(90),appId:'123',principalId:'456',businessId:'789',targetId:'101',scopes:capability==='reports'?['ads_read','public_profile']:['public_profile'],vaultId:'a'.repeat(26),itemId:(capability==='reports'?'b':'c').repeat(26)});
const call=async(action:string,input:unknown={},operation:string|null=null,capability='sales')=>(await db.query<{v:any}>(
  'select public.meta_credential_command($1,$2,$3,$4,$5,$6) v',[id(90),capability,binding,action,operation,JSON.stringify(input)])).rows[0].v;
const begin=(purpose='renew',capability='sales')=>call('begin',{purpose,identity:identity(capability)},null,capability);
const current=async(capability='sales')=>(await db.query<any>('select * from private.meta_credentials where capability=$1',[capability])).rows[0];
async function rejects(action:()=>Promise<unknown>,pattern:string){await db.exec('savepoint failed');await expect(action()).rejects.toThrow(pattern);await db.exec('rollback to savepoint failed');}
async function provision(capability='sales'){
  if(capability==='sales')await db.exec("update private.meta_sale_control set credential_mode='vault',uploads_enabled=true,upload_mode='routine',consent_policy_approved=true,consent_effective_from=now(),allowed_consent_bases=array['user_choice'] where singleton=true");
  await db.query(`insert into private.meta_credentials(capability,actor_id,binding,identity,enabled,renewal_enabled,approval_expires_at,approval_ref,asset_verified_at,asset_evidence_ref,token_hash,vault_version,token_expires_at)
    values($1,$2,$3,$4,true,true,now()+interval '30 days','approved-synthetic',now(),'private-assignment-proof',$5,3,now()+interval '10 days')`,[capability,id(90),binding,JSON.stringify(identity(capability)),oldHash]);
}
async function pending(operation:string){await call('exchange_pending',{},operation);await call('vault_pending',{tokenHash:newHash,expiresAt:new Date(Date.now()+60*86400000).toISOString(),dataAccessExpiresAt:null},operation);}
const reportCommand=async(action:string,operation:string|null=null,query:string|null=null,step:string|null=null,payload:string|null=null)=>(await db.query<{v:any}>(
  'select public.sanctuary_meta_command($1,$2,$3,$4,$5,$6,$7,$8,$9::text,$10,$11::text) v',[id(90),'101',binding,'synthetic',id(91),'test',action,operation,query,step,payload])).rows[0].v;
beforeAll(async()=>{db=await metaFixtureDb();},30000);
beforeEach(async()=>{await db.exec(`begin;insert into praxis_reporting.source_identity_v1 values(true,'synthetic','${id(91)}','test');
  insert into private.sanctuary_meta_control(actor_id,account_id,binding_hash,enabled,expires_at,source_key,connection_id,environment)
    values('${id(90)}','101','${binding}',true,now()-interval '1 day','synthetic','${id(91)}','test');
  update private.meta_sale_control set actor_id='${id(90)}',dataset_id='101',binding_sha256='${binding}',credential_expires_at=now()-interval '1 day',assignment_verified_at=now() where singleton=true;`);});
afterEach(async()=>db.exec('rollback'));afterAll(async()=>db.close());
it('installs without granting ongoing authority and preserves the expired legacy boundary',async()=>{
  expect((await db.query('select * from private.meta_credentials')).rows).toHaveLength(0);
  await rejects(()=>reportCommand('read'),'authority');await provision('reports');expect(await reportCommand('read')).toEqual({status:'missing'});
  expect((await current('reports')).ongoing_approved_at).toBeNull();
});
it('does not renew a healthy token early or touch its vault',async()=>{
  await provision();await db.exec("update private.meta_credentials set token_expires_at=now()+interval '26 days' where capability='sales'");
  expect(await begin()).toEqual({skip:true});expect((await db.query('select * from private.meta_credential_operations')).rows).toHaveLength(0);
});
it('will not automatically recover a known rejected replacement',async()=>{
  await provision();const run=await begin();await call('exchange_pending',{},run.operation);await call('quarantine',{},run.operation);await call('failed',{},run.operation);
  await rejects(()=>begin('reconcile'),'reconciliation');expect((await current()).state).toBe('REVIEW_REQUIRED');
});
it('preserves verified nonexpiring tokens without inventing an expiry or exchanging them',async()=>{
  await provision();await db.exec("update private.meta_credentials set token_expires_at=null where capability='sales';update private.meta_sale_control set credential_expires_at=null where singleton=true");
  expect(await begin()).toEqual({skip:true});const use=await begin('use');expect(use.expiresAt).toBeNull();await call('finish',{},use.operation);
  await db.exec("update private.meta_credentials set data_access_expires_at=now()-interval '1 minute' where capability='sales'");
  await rejects(()=>begin('use'),'expired');
});
it('a disabled source capability cannot use a token while independent renewal remains approved',async()=>{
  await provision();await db.exec("update private.meta_sale_control set uploads_enabled=false where singleton=true");
  await rejects(()=>begin('use'),'disabled');expect((await begin()).operation).toBeTruthy();
});
it('waits for an active source report and rejects a mismatched credential lease',async()=>{
  await provision('reports');await reportCommand('claim',null,JSON.stringify({start:'2026-08-01',end:'2026-08-07',retain:false}));
  await rejects(()=>begin('renew','reports'),'Source operation active');
});
it('keeps report and sale leases independent and exclusive within each capability',async()=>{
  await provision();await provision('reports');const sale=await begin('use');await rejects(()=>begin(),'busy');
  const report=await begin('use','reports');expect(report.operation).not.toBe(sale.operation);
  await call('finish',{},sale.operation);await call('finish',{},report.operation,'reports');expect(Number((await current()).revision)).toBe(1);
});
it.each(['approval','actor','asset','binding'] as const)('fences %s revocation between exchange and persistence without erasing uncertainty',async(change)=>{
  await provision();const run=await begin();await call('exchange_pending',{},run.operation);
  if(change==='approval')await db.exec("update private.meta_credentials set approval_expires_at=now()-interval '1 minute' where capability='sales'");
  if(change==='actor')await db.exec(`update portal_users set role='installer' where user_id='${id(90)}'`);
  if(change==='asset')await db.exec("update private.meta_credentials set asset_revoked_at=now() where capability='sales'");
  if(change==='binding')await db.exec(`update private.meta_sale_control set binding_sha256='${'d'.repeat(64)}' where singleton=true`);
  await rejects(()=>call('check',{},run.operation),'authority');expect((await current()).state).toBe('EXCHANGE_PENDING');expect((await current()).token_hash).toBe(oldHash);
});
it('recovers a lost exchange only against the original version and delays another exchange',async()=>{
  await provision();const run=await begin();await call('exchange_pending',{},run.operation);await call('failed',{},run.operation);
  await rejects(()=>begin('use'),'reconciliation');const recovery=await begin('reconcile');
  await rejects(()=>call('exchange_reconciled',{vaultVersion:4},recovery.operation),'Previous');
  await call('exchange_reconciled',{vaultVersion:3},recovery.operation);await call('finish',{},recovery.operation);
  expect(await begin()).toEqual({skip:true});expect(Number((await current()).revision)).toBe(1);
});
it('recovers a committed vault write after timeout without resubmitting or changing business generations',async()=>{
  await provision();const before=(await db.query<any>('select * from private.meta_sale_control')).rows[0];
  const run=await begin();await pending(run.operation);await call('failed',{},run.operation);await rejects(()=>begin('use'),'reconciliation');
  const recovery=await begin('reconcile');await rejects(()=>call('activate',{vaultVersion:3},recovery.operation),'version');
  await call('activate',{vaultVersion:4},recovery.operation);await call('finish',{},recovery.operation);
  const after=await current();expect(Number(after.revision)).toBe(2);expect(after.token_hash).toBe(newHash);expect(Number(after.generation)).toBe(1);
  expect((await db.query<any>('select * from private.meta_sale_control')).rows[0]).toEqual(before);
});
it('refuses expired leases and keeps the candidate for read-only reconciliation',async()=>{
  await provision();const run=await begin();await pending(run.operation);
  await db.exec(`update private.meta_credential_operations set expires_at=now()-interval '1 second' where id='${run.operation}'`);
  await rejects(()=>call('activate',{vaultVersion:4},run.operation),'lease');const recovered=await begin('reconcile');
  expect(recovered.candidateHash).toBe(newHash);expect(Number((await current()).revision)).toBe(1);
});
it('keeps the finite approval deadline unless ongoing revocable access was explicitly provisioned',async()=>{
  await provision();await db.exec("update private.meta_credentials set approval_expires_at=now()-interval '1 day' where capability='sales'");
  await rejects(()=>begin(),'authority');await db.exec("update private.meta_credentials set ongoing_approved_at=now() where capability='sales'");
  const run=await begin();expect(run.operation).toBeTruthy();
  await db.exec("update private.meta_credentials set enabled=false where capability='sales'");await rejects(()=>call('check',{},run.operation),'authority');
});
it('does not reset accepted, ready or uncertain sale records during same-identity renewal',async()=>{
  await provision();await db.exec(`insert into projects(id) values('${id(1)}');`);
  for(const [index,state] of ['ACCEPTED','READY','RETRY'].entries())await db.exec(`insert into quotes values('${id(index+2)}','${id(1)}');
    insert into private.meta_sales(quote_id,project_id,generation,source_fingerprint,payload,dataset_id,state,attempts,first_attempt_at,receipt_id)
    values('${id(index+2)}','${id(1)}',2,'${oldHash}','{"event_id":"synthetic-${index}","event_time":1,"value":99}','101','${state}',2,now()-interval '1 hour','retained-receipt');`);
  const before=(await db.query('select * from private.meta_sales order by quote_id')).rows;
  const run=await begin();await pending(run.operation);await call('activate',{vaultVersion:4},run.operation);await call('finish',{},run.operation);
  expect((await db.query('select * from private.meta_sales order by quote_id')).rows).toEqual(before);
});
it('preserves saved report bytes and original retention through exchange, purge and activation',async()=>{
  await provision('reports');const period={start:'2026-08-01',end:'2026-08-07'};
  const op=(await reportCommand('claim',null,JSON.stringify({...period,retain:true}))).operation;
  for(const step of ['identity_check','account_read','report_read']){await reportCommand('before',op,null,step);await reportCommand('after',op,null,step);}
  await reportCommand('complete',op,null,null,JSON.stringify({...sampleMetaReport(period),fetchedAt:new Date().toISOString()}));
  const before=(await db.query('select * from private.sanctuary_meta_snapshot')).rows;
  const run=await begin('renew','reports');await call('exchange_pending',{},run.operation,'reports');
  await db.exec('select public.sanctuary_meta_purge()');expect((await db.query('select * from private.sanctuary_meta_snapshot')).rows).toEqual(before);
  await call('vault_pending',{tokenHash:newHash,expiresAt:new Date(Date.now()+60*86400000).toISOString(),dataAccessExpiresAt:null},run.operation,'reports');
  await call('activate',{vaultVersion:4},run.operation,'reports');await call('finish',{},run.operation,'reports');
  expect((await reportCommand('read')).operation).toBe(op);expect((await db.query('select * from private.sanctuary_meta_snapshot')).rows).toEqual(before);
});
it('denies cross-capability identity, direct table access and audit deletion',async()=>{
  await provision();await rejects(()=>call('begin',{purpose:'use',identity:identity('reports')}),'identity');
  await begin('use');
  await db.exec('set local role service_role');await rejects(()=>db.exec('select * from private.meta_credentials'),'permission');await db.exec('reset role');
  await rejects(()=>db.exec("delete from private.meta_credential_events where capability='sales'"),'append only');
});
it('exposes uncertainty and finite authorization without exposing credential fingerprints or identifiers',async()=>{
  await provision();const run=await begin();await pending(run.operation);await call('failed',{},run.operation);
  const health=metaSaleStatusSchema.parse((await db.query<{v:any}>('select public.meta_sale_staff_read() v')).rows[0].v).credentials!;
  expect(health.sales?.state).toBe('RECONCILIATION_REQUIRED');expect(health.sales?.approvalEndsAt).toBeTruthy();
  expect(JSON.stringify(health)).not.toContain(oldHash);expect(JSON.stringify(health)).not.toContain(identity().itemId);
});
