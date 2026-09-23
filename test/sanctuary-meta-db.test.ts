// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { sampleMetaReport } from '../apps/portal/lib/marketingIntegrations/meta/report';
const actor = '10000000-0000-4000-8000-000000000001', connection = '20000000-0000-4000-8000-000000000001', binding = 'a'.repeat(64);
it('executes source claim, every-page fences, retention, deletion and revocation with denied table/browser access', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create role praxis_reporting;
   create schema auth;create schema private;create schema praxis_reporting;create schema cron;
   create function cron.schedule(text,text,text) returns integer language sql as 'select 1';
   create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
   create table public.portal_users(user_id uuid primary key,role text);
   create table praxis_reporting.source_identity_v1(singleton boolean,source_key text,connection_id uuid,environment text);
   insert into auth.users values('${actor}',now(),null,null);insert into public.portal_users values('${actor}','staff');
   insert into praxis_reporting.source_identity_v1 values(true,'synthetic','${connection}','test');`);
  await db.exec(await readFile('supabase/migrations/20260923050001_sanctuary_meta_reporting.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20260923050002_sanctuary_meta_scoped_deletes.sql', 'utf8'));
  await db.exec(`insert into private.sanctuary_meta_control(actor_id,account_id,binding_hash,enabled,expires_at,source_key,connection_id,environment)
   values('${actor}','123','${binding}',true,now()+interval '1 day','synthetic','${connection}','test')`);
  const command = async (action: string, operation: string | null = null, query: string | null = null, step: string | null = null, payload: string | null = null) =>
   (await db.query<{r: Record<string, unknown>}>('select public.sanctuary_meta_command($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as r', [actor,'123',binding,'synthetic',connection,'test',action,operation,query,step,payload])).rows[0]!.r;
  for (const role of ['anon','authenticated','praxis_reporting']) {
   await db.exec(`set role ${role}`);await expect(command('read')).rejects.toThrow();await db.exec('reset role');
  }
  await db.exec('set role service_role');
  await expect(db.query('select * from private.sanctuary_meta_control')).rejects.toThrow();
  expect(await command('read')).toEqual({status:'missing'});
  const period = {start:'2026-08-01',end:'2026-08-07'}, query = JSON.stringify({...period,retain:true});
  const op = String((await command('claim', null, query)).operation);
  await expect(command('claim', null, query)).rejects.toThrow();
  await expect(command('complete',op,null,null,'{}')).rejects.toThrow();
  for (const step of ['identity_check','account_read','report_read']) {await command('before',op,null,step);await command('after',op,null,step);}
  const report = {...sampleMetaReport(period),fetchedAt:new Date().toISOString()};
  await command('complete',op,null,null,JSON.stringify(report));
  const read = await command('read');expect(read.operation).toBe(op);expect(JSON.parse(String(read.payload))).toEqual(report);
  const ephemeral=String((await command('claim',null,JSON.stringify({...period,retain:false}))).operation);
  for(const step of ['identity_check','account_read','report_read']){await command('before',ephemeral,null,step);await command('after',ephemeral,null,step);}
  expect((await command('complete',ephemeral,null,null,JSON.stringify({...report,fetchedAt:new Date().toISOString()}))).retained).toBe(false);
  expect((await command('read')).operation).toBe(op);
  await command('deliver',op);await command('deliver',ephemeral);
  await expect(command('complete',op,null,null,JSON.stringify(report))).rejects.toThrow();
  await db.exec('reset role;begin');
  await db.exec(`update private.sanctuary_meta_control set enabled=false;set local role service_role`);
  await db.exec('savepoint denied');await expect(command('read')).rejects.toThrow();await db.exec('rollback to denied');expect(await command('delete')).toEqual({status:'deleted'});await db.exec('rollback');
  for (const mutation of [`delete from public.portal_users`,`update auth.users set email_confirmed_at=null`, `update auth.users set banned_until=now()+interval '1 day'`,
    `update praxis_reporting.source_identity_v1 set source_key='other'`,`update private.sanctuary_meta_control set binding_hash='${'b'.repeat(64)}'`]) {
   await db.exec('reset role');await db.exec('begin');await db.exec(mutation);await db.exec('set local role service_role');await expect(command('read')).rejects.toThrow();await db.exec('rollback');
  }
  await db.exec('set role service_role');await command('delete');expect(await command('read')).toEqual({status:'missing'});
  await expect(command('deliver',op)).rejects.toThrow();await expect(command('deliver',ephemeral)).rejects.toThrow();
  const pending = String((await command('claim',null,query)).operation);
  for(const step of ['identity_check','account_read','report_read']){await command('before',pending,null,step);await command('after',pending,null,step);}
  await command('delete');await expect(command('complete',pending,null,null,JSON.stringify({...report,fetchedAt:new Date().toISOString()}))).rejects.toThrow();
  await db.exec('reset role');await expect(db.exec('delete from private.sanctuary_meta_events')).rejects.toThrow();
 } finally {await db.close();}
},30000);
