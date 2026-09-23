// @vitest-environment node
// Paired migration proof uses this repository's existing disposable PostgreSQL
// dependency; no runtime or package dependency between the applications.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
it.skipIf(!process.env.VELT_META_MIGRATION_ROOT)('preserves Velt Stop for reads and permits only audited source deletion',async()=>{
 const db=new PGlite(),id='10000000-0000-4000-8000-000000000001',hash='a'.repeat(64);
 try{
  await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
   create table auth.users(id uuid primary key);insert into auth.users values('${id}');
   create function auth.uid() returns uuid language sql as 'select null::uuid';
   create table public.velt_connection_controls(owner_id uuid primary key,stopped boolean,generation bigint);
   create table public.velt_connection_operations(owner_id uuid,provider text,kind text,inbox_query jsonb,started_at timestamptz default clock_timestamp());
   create function public.velt_connection_event_immutable() returns trigger language plpgsql as $$begin raise exception 'immutable';end$$;
   insert into public.velt_connection_controls values('${id}',false,1);`);
  const root=process.env.VELT_META_MIGRATION_ROOT!;
  let original=await readFile(join(root,'supabase/migrations/202609160002_portal_customer_reads.sql'),'utf8');
  // Bring the historical allowlist to the exact pre-pilot baseline. The complete
  // current-schema chain remains an additional release gate.
  original=original.replaceAll("('customers','context','receipts','summary')","('customers','context','receipts','summary','marketing','overview','workload','specialist-workload','finance-history','briefing','finance-position')");
  await db.exec(original);
  await db.exec(await readFile(join(root,'supabase/migrations/202609230005_sanctuary_meta_reads.sql'),'utf8'));
  await db.exec(await readFile(join(root,'supabase/migrations/202609230006_meta_migration_authority.sql'),'utf8'));
  await db.exec(`insert into public.velt_meta_source_controls(owner_id,source)values('${id}','sanctuary')`);
  const command=async(kind:string,stage:string,op:string|null=null)=>(await db.query<{id:string}>('select public.velt_portal_read_command($1,$2,$3,$4,$5,$6,$7) as id',[id,hash,hash,kind,stage,op,stage==='completed'?hash:null])).rows[0]!.id;
  await db.exec('set role service_role');const op=await command('marketing/meta-refresh','claimed');await command('marketing/meta-refresh','vault',op);await command('marketing/meta-refresh','http',op);
  const authority=async()=>(await db.query<{allowed:boolean}>('select public.velt_meta_source_authority($1,$2,$3,$4) as allowed',[id,op,hash,hash])).rows[0]!.allowed;
  expect(await authority()).toBe(true);
  await db.exec(`reset role;update public.velt_connection_controls set stopped=true,generation=2;set role service_role`);
  expect(await authority()).toBe(false);
  await expect(command('marketing/meta-refresh','completed',op)).rejects.toThrow();
  await command('marketing/meta-refresh','failed',op);
  for(const kind of ['marketing/meta','customers','marketing','finance-position'])await expect(command(kind,'claimed')).rejects.toThrow();
  const deletion=await command('marketing/meta-delete','claimed');for(const stage of ['vault','http','completed'])await command('marketing/meta-delete',stage,deletion);
  await expect(command('marketing/meta','completed',deletion)).rejects.toThrow();
  await db.exec('reset role;set role authenticated');await expect(command('marketing/meta-delete','claimed')).rejects.toThrow();
  await db.exec('reset role');expect((await db.query('select * from public.velt_portal_read_events where operation_id=$1',[deletion])).rows).toHaveLength(4);
  await expect(db.exec(`insert into public.velt_connection_operations(owner_id,provider)values('${id}','meta')`)).rejects.toThrow();
  await db.exec(`update public.velt_meta_source_controls set source='direct'`);
  expect((await db.query<{s:{sourceMayRetain:boolean}}>('select public.velt_meta_source_state($1) as s',[id])).rows[0]!.s.sourceMayRetain).toBe(true);
  // The approved customer correspondence pool remains separate from shared reads.
  for(let i=0;i<20;i++)await db.exec(`insert into public.velt_connection_operations(owner_id,provider,kind,inbox_query)values('${id}','outlook','inbox','{"inboxVersion":"sanctuary-outlook-customer-v1"}')`);
  // Five direct claims plus the one source claim exhaust the same six-read cap.
  for(let i=0;i<5;i++)await db.exec(`insert into public.velt_connection_operations(owner_id,provider)values('${id}','meta')`);
  await expect(db.exec(`insert into public.velt_connection_operations(owner_id,provider)values('${id}','meta')`)).rejects.toThrow();
 }finally{await db.close();}
},30000);
