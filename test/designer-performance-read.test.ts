// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { designerReportSchema } from '../apps/portal/lib/marketingPerformance/designerContract';
import { designerPerformance } from '../apps/portal/lib/marketingPerformance/designer';
import { reviewedVisit } from '../apps/portal/lib/siteVisits/reviewedVisit';
const db=new PGlite(),id=(n:number)=>`66666666-6666-4666-8666-${String(n).padStart(12,'0')}`,staff=id(90),binding='a'.repeat(64);
const file=(name:string)=>readFileSync(`supabase/migrations/${name}.sql`,'utf8');
async function read(){return designerReportSchema.parse((await db.query<{v:unknown}>("select public.marketing_designer_performance_read('2026-09-01','2026-09-30') v")).rows[0].v);}
beforeAll(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
    create table public.portal_users(user_id uuid primary key,role text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select current_user::text$$;
    create function public.has_portal_access() returns boolean language sql stable as $$select exists(select 1 from public.portal_users where user_id=auth.uid() and role in ('staff','admin'))$$;
    create table contacts(id uuid primary key,name text,email text,phone text);
    create table projects(id uuid primary key,name text,contact_id uuid,site_address text,archived_at timestamptz);
    create table quotes(id uuid primary key,project_id uuid,quote_ref text,commercial_scope_id uuid);
    create table quote_versions(id uuid primary key,quote_id uuid,version_number integer,status text,created_at timestamptz,sent_at timestamptz,accepted_at timestamptz,total_inc_gst_cents integer);
    create table enquiry_requests(id uuid primary key,project_id uuid,created_at timestamptz,raw_payload jsonb);
    create table deposit_invoices(id uuid primary key,quote_id uuid,payment_term_position integer,status text,currency text,total_inc_gst_cents integer,paid_at timestamptz);
    create table xero_deposit_matches(invoice_id uuid,payment_entry_id uuid,reversed_at timestamptz,amount_inc_gst_cents integer);
    create table project_payment_entries(id uuid primary key,source_invoice_id uuid,entry_type text,occurred_at timestamptz,amount_inc_gst_cents integer,reverses_entry_id uuid);
    create table project_operational_states(project_id uuid,state text,closed_outcome text);
    create table private.google_ads_suppressions(project_id uuid);
    insert into auth.users values('${staff}','jordan@sanctuarypergolas.co.nz',now(),null,null);
    insert into portal_users values('${staff}','staff');
    insert into contacts values('${id(2)}','Private contact','private@example.test','+640000000');
    insert into projects values('${id(1)}','Synthetic project','${id(2)}','Private address',null);
    insert into quotes values('${id(3)}','${id(1)}','DEMO',null),('${id(4)}','${id(1)}','DEMO-ADDON','${id(40)}');
    insert into quote_versions values('${id(5)}','${id(3)}',1,'ACCEPTED','2026-09-05','2026-09-05','2026-09-06',1900000),('${id(6)}','${id(4)}',1,'ACCEPTED','2026-09-05','2026-09-05','2026-09-06',300000);
    insert into deposit_invoices values('${id(7)}','${id(3)}',1,'OPEN','NZD',200000,null),('${id(8)}','${id(4)}',1,'PAID','NZD',300000,'2026-09-10');
    insert into project_payment_entries values('${id(9)}','${id(7)}','PAYMENT','2026-09-08',50000,null);
    insert into xero_deposit_matches values('${id(7)}','${id(9)}',null,50000);
    insert into enquiry_requests values('${id(10)}','${id(1)}','2026-08-01','{"email":"private@example.test","secret":"never return"}');
    grant usage on schema public,auth to authenticated,anon,service_role;
    set test.uid='${staff}';`);
  for(const name of ['20261020010001_outlook_site_visits','20261020010002_outlook_site_visits_address_match','20261020010003_outlook_site_visits_all_day','20261020010004_site_visit_corrections','20261020010005_site_visit_staff_identity'])await db.exec(file(name));
  await db.exec(file('20260813000003_commercial_truth_invariants').split('create or replace function public.commercial_project_financial_truth')[0]);
  await db.exec(file('20261014000001_advertising_scope_source'));
  await db.exec(file('20261021030001_designer_performance'));
  await db.exec(`update private.outlook_calendar_control set enabled=true,binding='${binding}',last_success=now(),range_start='2026-10-01',range_end='2026-12-31' where singleton;
    insert into private.site_visit_staff_identities values('${binding}','designer@example.test','jordan');`);
  const payload={subject:'Private title',startsAt:'2026-09-03T00:00:00Z',endsAt:'2026-09-03T01:00:00Z',kind:'visit',staff:[{name:'Private staff alias',email:'designer@example.test'}],customerEmails:['private@example.test'],address:'Private address',cancelled:false,duplicate:false,reviewReasons:[],isAllDay:false};
  await db.query(`insert into private.outlook_calendar_visits(id,source_key,payload,starts_at,ends_at,project_id,seen_operation) values($1,'test',$2,'2026-09-03','2026-09-03 01:00Z',$3,$4)`,[id(11),JSON.stringify(payload),id(1),id(12)]);
  await db.exec(`insert into private.site_visit_details(id,source_visit_id,details,basis,created_by,updated_by,reviewed_source)
    select id,id,'{"purpose":"initial","status":"attended"}','Synthetic fixture only','${staff}','${staff}',private.site_visit_material_source(v) from private.outlook_calendar_visits v;
    insert into private.site_visit_details(id,project_id,details,basis,created_by,updated_by) values('${id(13)}','${id(1)}','{"purpose":"measurement","status":"attended","timing":{"mode":"unknown","date":null,"time":null,"endTime":null},"staff":[{"name":"Jordan","email":null,"staffId":"jordan"}]}','Synthetic fixture only','${staff}','${staff}');`);
},30000);
afterAll(()=>db.close());
it('runs the actual source helpers, retains out-of-window visits and strips private contact/source payloads',async()=>{
 const r=await read();expect(r.visits).toHaveLength(2);expect(r.visits.find(v=>v.id===id(11))).toMatchObject({staff:['jordan'],purpose:'initial',day:'2026-09-03',status:'attended',questions:0});
 expect(r.visits.find(v=>v.id===id(13))!.day).toBeNull();expect(JSON.stringify(r)).not.toMatch(/private@example|Private title|Private address|Private staff|raw_payload|secret|sourceUrl/);
 expect(designerPerformance(r).total.outcomes[0].paid).toHaveLength(1);expect(designerPerformance(r).total.outcomes[0].paid[0].valueCents).toBe(1900000);
});
it('enforces owner and direct-table boundaries including revoked staff and anonymous roles',async()=>{
 await db.exec('set role authenticated');expect((await read()).visits.length).toBe(2);
 await expect(db.query('select * from private.site_visit_details')).rejects.toThrow();
 await db.exec('reset role;begin');try{await db.exec(`update auth.users set banned_until=now()+interval '1 day' where id='${staff}'`);await expect(read()).rejects.toThrow('Developer access');}finally{await db.exec('rollback');}
 await db.exec('set role anon');await expect(read()).rejects.toThrow('permission denied');await db.exec('reset role');
});
it('agrees with the effective correction for unknown timing, identity and source-change conflicts',async()=>{
 await db.exec('begin');try{
  await db.exec(`update private.site_visit_details set details=details||'{"timing":{"mode":"unknown","date":null,"time":null,"endTime":null}}' where id='${id(11)}'`);
  const r=await read();const raw=(await db.query<{v:any}>(`select private.outlook_calendar_visit_json(v) v from private.outlook_calendar_visits v`)).rows[0].v;
  const effective=reviewedVisit(raw);expect(effective.timing?.date).toBeNull();expect(r.visits.find(v=>v.id===id(11))!.day).toBeNull();
  await db.exec(`update private.outlook_calendar_visits set payload=jsonb_set(payload,'{address}','"Changed address"') where id='${id(11)}'`);
  const changed=await read();expect(changed.visits.find(v=>v.id===id(11))!.changed).toBe(true);expect(designerPerformance(changed).total.outcomes).toEqual([]);
 }finally{await db.exec('rollback');}
});
it('uses current accepted-family value, partial first deposit, reversals and missing payment dates honestly',async()=>{
 await db.exec('begin');try{
  await db.exec(`insert into quote_versions values('${id(20)}','${id(3)}',2,'ACCEPTED','2026-09-12','2026-09-12','2026-09-12',2100000)`);
  let r=await read();expect(r.scopes.find(s=>s.id===id(3))!.valueCents).toBe(2100000);expect(designerPerformance(r).total.outcomes[0].paid).toHaveLength(1);
  await db.exec(`insert into project_payment_entries values('${id(21)}',null,'REVERSAL','2026-09-15',-50000,'${id(9)}')`);
  r=await read();expect(r.scopes.find(s=>s.id===id(3))!.paidAt).toBeNull();expect(designerPerformance(r).total.outcomes[0].paid).toHaveLength(0);
  await db.exec(`update deposit_invoices set status='PAID',paid_at=null where id='${id(7)}'`);r=await read();expect(r.scopes.find(s=>s.id===id(3))!.paymentEvidence).toBe(true);expect(designerPerformance(r).total.outcomes).toEqual([]);
 }finally{await db.exec('rollback');}
});
it('supports an exact safe correction read outside agenda range; hidden and wrong-project records stay inaccessible',async()=>{
 const single=async(project:string|null=null)=>(await db.query<{v:any}>('select public.outlook_site_visit_detail_read($1,$2) v',[id(11),project])).rows[0].v;
 expect((await single()).events).toHaveLength(1);expect((await single(id(99))).events).toEqual([]);
 await db.exec('begin');try{await db.exec(`update private.outlook_calendar_visits set hidden=true where id='${id(11)}'`);expect((await single()).events).toEqual([]);}finally{await db.exec('rollback');}
});
it('rejects oversized evidence rather than publishing a partial cohort and never mutates source records',async()=>{
 const before=(await db.query('select * from private.site_visit_details')).rows;await read();expect((await db.query('select * from private.site_visit_details')).rows).toEqual(before);
 await db.exec('begin');try{await db.exec(`insert into quotes select gen_random_uuid(),'${id(1)}','BOUND',null from generate_series(1,5000)`);await expect(read()).rejects.toThrow('limit reached');}finally{await db.exec('rollback');}
});
