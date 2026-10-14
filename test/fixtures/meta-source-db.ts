import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
export const metaFixtureId=(n:number)=>`44444444-4444-4444-8444-${String(n).padStart(12,'0')}`;
export interface MetaFixtureDb {exec(sql:string):Promise<unknown>;query<T>(sql:string,args?:unknown[]):Promise<{rows:T[]}>;close():Promise<void>}
/** Synthetic prerequisites, exact migration files. Native target must be disposable loopback. */
export async function metaFixtureDb():Promise<MetaFixtureDb>{
  const id=metaFixtureId;let db:MetaFixtureDb;
  const native=process.env.GOOGLE_ADS_NATIVE_TEST_URL;
  if(native){const url=new URL(native);if(url.hostname!=='127.0.0.1'||url.username!=='postgres'||url.pathname!=='/google_ads_fixture')throw Error('Disposable local database only');
    const client=postgres(native,{max:1});db={exec:sql=>client.unsafe(sql),query:async<T>(sql:string,args:unknown[]=[])=>({rows:await client.unsafe(sql,args.map(value=>typeof value==='string'&&/^[{[]/.test(value)?client.json(JSON.parse(value)):value) as never[]) as unknown as T[]}),close:()=>client.end()};
  }else db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.role() returns text language sql as $$select current_setting('test.role',true)$$;
    create function has_portal_access() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
    create table portal_users(user_id uuid,role text);
    create table contacts(id uuid primary key,email text,phone text);
    create table projects(id uuid primary key,contact_id uuid);
    create table quotes(id uuid primary key,project_id uuid);
    create table quote_versions(id uuid primary key,quote_id uuid,version_number int,status text,created_at timestamptz,accepted_at timestamptz,total_inc_gst_cents int);
    create table enquiry_requests(id uuid primary key,project_id uuid,created_at timestamptz,raw_payload jsonb);
    create table deposit_invoices(id uuid primary key,quote_id uuid,quote_version_id uuid,payment_term_position int,status text,currency text,total_inc_gst_cents int,paid_at timestamptz);
    create table project_payment_entries(id uuid primary key,source_invoice_id uuid,entry_type text,amount_inc_gst_cents int,occurred_at timestamptz,reverses_entry_id uuid);
    create table xero_deposit_matches(invoice_id uuid,payment_entry_id uuid,amount_inc_gst_cents int,reversed_at timestamptz);
    create table project_operational_states(project_id uuid,state text,closed_outcome text);
    insert into auth.users values('${id(90)}','jordan@sanctuarypergolas.co.nz',now(),null,null);
    insert into portal_users values('${id(90)}','admin');set test.uid='${id(90)}';set test.role='service_role';set test.staff='yes';`);
  await db.exec(`create schema praxis_reporting;create schema cron;
    create function cron.schedule(text,text,text) returns integer language sql as 'select 1';
    create table praxis_reporting.source_identity_v1(singleton boolean,source_key text,connection_id uuid,environment text);`);
  for(const file of ['20260923050001_sanctuary_meta_reporting.sql','20260923050002_sanctuary_meta_scoped_deletes.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260813000003_commercial_truth_invariants.sql','utf8').split('create or replace function public.commercial_project_financial_truth')[0]);
  for(const file of ['20261013000001_google_ads_source.sql','20261013000002_google_ads_commands.sql','20261013000003_google_ads_retraction_source_fence.sql','20261013000005_google_ads_current_generation_health.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
  // Retain the actual prior function for byte-for-byte output/fingerprint comparison.
  const definition=(await db.query<{definition:string}>("select pg_get_functiondef('private.google_ads_sources()'::regprocedure) definition")).rows[0].definition;
  await db.exec(definition.replace('private.google_ads_sources()','private.original_google_ads_sources()'));
  for(const file of ['20261014000001_advertising_scope_source.sql','20261014000002_meta_sale_source.sql','20261014000003_meta_sale_commands.sql','20261014000004_google_ads_disclosure_compatibility.sql','20261014000005_meta_credential_renewal.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
  return db;
}
