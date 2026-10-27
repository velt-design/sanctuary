import { readFileSync } from 'node:fs';
export const salesEvidenceMigration='20261027024135_marketing_enquiry_sales_evidence';
export const salesSql=(name:string)=>readFileSync(`supabase/migrations/${name}.sql`,'utf8');
export const salesId=(n:number)=>`77777777-7777-4777-8777-${String(n).padStart(12,'0')}`;
export async function installMarketingSalesDb(db:{exec:(sql:string)=>Promise<unknown>}) {
 await db.exec(`create role anon;create role authenticated;create role service_role;create role sanctuary_praxis_reader;
 create schema auth;create schema private;create schema praxis_reporting;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
 create table public.portal_users(user_id uuid primary key,role text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select current_user::text$$;
 create function public.has_portal_access() returns boolean language sql stable as $$select exists(select 1 from public.portal_users where user_id=auth.uid() and role in ('staff','admin'))$$;
 create table contacts(id uuid primary key,name text,email text,phone text);
 create table projects(id uuid primary key,name text,contact_id uuid,site_address text,archived_at timestamptz,created_at timestamptz default '2026-09-01',pipeline_stage text default 'NEW');
 create table quotes(id uuid primary key,project_id uuid,quote_ref text,commercial_scope_id uuid);
 create table quote_versions(id uuid primary key,quote_id uuid,version_number integer,status text,created_at timestamptz,sent_at timestamptz,accepted_at timestamptz,total_inc_gst_cents integer);
 create table enquiry_requests(id uuid primary key,project_id uuid,created_at timestamptz,raw_payload jsonb,utm jsonb default '{}',page text,suburb text,message text);
 create table private.marketing_enquiry_deliveries(enquiry_request_id uuid primary key,draft_estimate jsonb);
 create table site_visit_events(project_id uuid,status text,confirmed_at timestamptz);
 create table deposit_invoices(id uuid primary key,project_id uuid,quote_id uuid,quote_version_id uuid,payment_term_position integer,status text,currency text,total_inc_gst_cents integer,paid_at timestamptz);
 create table project_payment_entries(id uuid primary key,project_id uuid,source_invoice_id uuid,entry_type text,occurred_at timestamptz,amount_inc_gst_cents integer,reverses_entry_id uuid references project_payment_entries(id));
 create unique index reversal_once on project_payment_entries(reverses_entry_id) where reverses_entry_id is not null;
 create table audit_events(id uuid primary key,type text,created_at timestamptz,payload jsonb);
 create table marketing_conversion_deliveries(id uuid primary key,audit_event_id uuid, status text default 'PENDING',attempt_count integer default 0,max_attempts integer default 8,lease_token uuid,lease_expires_at timestamptz,last_error_code text,updated_at timestamptz default now(),next_attempt_at timestamptz default now(),created_at timestamptz default now());
 create table xero_deposit_matches(invoice_id uuid,payment_entry_id uuid,project_id uuid,reversed_at timestamptz,amount_inc_gst_cents integer);
 create table project_operational_states(project_id uuid,state text,closed_outcome text);
 create table project_owner_assignments(project_id uuid,owner_key text);
 create table private.google_ads_suppressions(project_id uuid);
 insert into auth.users values('${salesId(90)}','jordan@sanctuarypergolas.co.nz',now(),null,null);
 insert into portal_users values('${salesId(90)}','staff');
 grant usage on schema public,auth to authenticated,anon,service_role;
 grant usage on schema praxis_reporting to sanctuary_praxis_reader;
 set test.uid='${salesId(90)}';`);
 await db.exec(salesSql('20260813000003_commercial_truth_invariants').split('create or replace function public.commercial_project_financial_truth')[0]);
 for(const name of ['20260917000003_configured_enquiry_qualification','20260917000004_enquiry_qualification_reassignment',
 '20261008000001_marketing_google_ads_source','20261008000002_marketing_commercial_performance','20261008000003_marketing_commercial_send_coverage'])await db.exec(salesSql(name));
 const claim=salesSql('20260730_000001_marketing_conversion_delivery').match(/create or replace function public\.marketing_conversion_delivery_claim\([\s\S]*?\$\$;/)?.[0];
 if(!claim)throw Error('Conversion claim baseline missing');await db.exec(claim);
 // Install the actual current report bodies; provider authorization is outside
 // this disposable fixture, never replaced in the migration or application.
 const campaign=salesSql('20261014000006_campaign_health').match(/create (?:or replace )?function public\.sanctuary_campaign_outcomes\([\s\S]*?\$\$;/)?.[0];
 if(!campaign)throw Error('Campaign reporting baseline missing');await db.exec(campaign);
 await db.exec(salesSql('20261015000002_launch_verification_reporting_exclusion'));
 await db.exec(salesSql('20261021020003_campaign_intake_evidence'));
 const currentCampaign=salesSql('20261022050013_creative_steady_inventory').match(/create or replace function public\.sanctuary_campaign_outcomes_without_intake\([\s\S]*?end \$\$;/)?.[0];
 if(!currentCampaign)throw Error('Current creative campaign owner missing');await db.exec(currentCampaign);
 // Provider authorization/inventory adapters are finite local fixtures. The
 // complete current campaign calculation and intake wrapper execute unchanged.
 await db.exec(`create table private.sanctuary_meta_operations(id uuid primary key,query jsonb);
 create function public.sanctuary_meta_command(uuid,text,text,text,uuid,text,text,uuid)returns jsonb language plpgsql as $$begin if $3<>'synthetic' then raise exception 'Fixture authority denied';end if;return '{}'::jsonb;end$$;
 create table public.meta_creative_execution(experiment uuid,plan jsonb);
 create function public.meta_creative_registered_ads()returns table(ad_id text,experiment uuid,campaign_id text,adset_id text)language sql as $$select null::text,null::uuid,null::text,null::text where false$$;
 create function public.meta_creative_steady_ads()returns jsonb language sql as $$select '[]'::jsonb$$;
 create function public.meta_creative_steady_enquiry(uuid)returns boolean language sql as $$select false$$;`);
 for(const name of ['20261020010001_outlook_site_visits','20261020010002_outlook_site_visits_address_match','20261020010003_outlook_site_visits_all_day',
 '20261020010004_site_visit_corrections','20261020010005_site_visit_staff_identity','20261014000001_advertising_scope_source',
 '20261021030001_designer_performance','20261021030002_designer_visit_detail_transaction','20261021040001_project_sales_designer',
 '20261021100001_designer_accepted_sales','20261022010001_designer_history_support','20261027010001_designer_visit_basis'])await db.exec(salesSql(name));
}
