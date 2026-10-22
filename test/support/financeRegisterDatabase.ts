import { readFileSync } from 'node:fs';
import { createRevisedQuoteDatabase } from './revisedQuoteDatabase';
import { seedRevisedQuoteScenario, revisedQuoteIds as ids } from './revisedQuoteScenario';
import type { PGlite } from '@electric-sql/pglite';

export const financeActor = '90000000-0000-4000-8000-000000000001';
export const financeOpenInvoice = '40000000-0000-4000-8000-000000000004';
/** Synthetic schema supplement; financial command owners come from the existing
 * current-migration commercial harness, not replacements for financial logic. */
export async function createFinanceRegisterDatabase() {
  const db = await createRevisedQuoteDatabase();
  await db.exec(`
    create table public.portal_users(user_id uuid primary key,role text);
    alter table public.quotes add column internal_name text,add column created_at timestamptz default now(),
      add column updated_at timestamptz default now(),add column created_by text;
    alter table public.quote_versions add column sent_at timestamptz,add column delivery_prepared_at timestamptz;
    create table public.deposit_invoice_send_logs(id uuid primary key default gen_random_uuid(),deposit_invoice_id uuid,
      delivery_intent_id uuid,status text,created_at timestamptz default now(),sent_at timestamptz,next_retry_at timestamptz);
    create table public.quote_send_logs(id uuid primary key default gen_random_uuid(),quote_version_id uuid,status text,
      created_at timestamptz default now(),sent_at timestamptz);
    create table private.xero_payment_sync_status(invoice_id uuid,tenant_id uuid,state text,reason text,checked_at timestamptz);
    insert into auth.users(id) values('${financeActor}');
    insert into public.portal_users values('${financeActor}','admin');
    insert into public.xero_payment_approvers(user_id,granted_by) values('${financeActor}','Synthetic operator');
    create index finance_fixture_send_idx on public.deposit_invoice_send_logs(deposit_invoice_id,created_at desc);
    create index finance_fixture_quote_send_idx on public.quote_send_logs(quote_version_id,created_at desc);
  `);
  await db.exec(readFileSync('supabase/migrations/20261023000001_finance_register.sql', 'utf8'));
  return db;
}

export async function seedFinanceRegisterScenario(db: PGlite) {
  await seedRevisedQuoteScenario(db);
  // Read-only fixture rows preserve current schema constraints. Disabling the
  // issue-boundary trigger is confined to synthetic setup, never app behavior.
  await db.exec('alter table public.deposit_invoices disable trigger all');
  await db.query(`insert into public.deposit_invoices select (jsonb_populate_record(null::public.deposit_invoices,
    to_jsonb(i)||jsonb_build_object('id',$1::text,'status','OPEN','invoice_ref','INV-REGISTER','issue_command_id',null,
      'paid_at',null,'paid_by',null,'total_inc_gst_cents',10000,'total_ex_gst_cents',8696,'gst_cents',1304))).*
    from public.deposit_invoices i where i.id=$2`, [financeOpenInvoice, ids.topup]);
  await db.query(`insert into public.deposit_invoices select (jsonb_populate_record(null::public.deposit_invoices,
    to_jsonb(i)||jsonb_build_object('id',$1::text,'status','DRAFT','invoice_ref',null,'issue_date',null,'issue_command_id',null,
      'paid_at',null,'paid_by',null,'draft_revision',1))).*
    from public.deposit_invoices i where i.id=$2`, [ids.draft, ids.topup]);
  await db.exec('alter table public.deposit_invoices enable trigger all');
}

/** Independent synthetic jobs avoid one job's free credit tainting every row. */
export async function seedFinanceRegisterPreviewCases(db: PGlite) {
  await db.exec(`
    create temp table preview_cases as select gen_random_uuid() project_id,gen_random_uuid() invoice_id,gen_random_uuid() entry_id,kind
      from unnest(array['Partial receipt','Project credit to check','Failed send','Delivery pending']) kind;
    insert into public.projects(id,name) select project_id,'Synthetic '||kind||' job' from preview_cases;
    alter table public.deposit_invoices disable trigger all;
    insert into public.deposit_invoices select (jsonb_populate_record(null::public.deposit_invoices,to_jsonb(i)||jsonb_build_object(
      'id',c.invoice_id,'project_id',c.project_id,'invoice_ref',case c.kind when 'Partial receipt' then 'INV-PARTIAL' when 'Project credit to check' then 'INV-CREDIT' when 'Failed send' then 'INV-SEND-FAILED' else 'INV-SEND-PENDING' end,
      'customer_name','Synthetic '||c.kind,'project_name','Synthetic '||c.kind||' job','due_date',current_date-14,'issue_command_id',null,
      'sent_at',case when c.kind in ('Partial receipt','Project credit to check') then now()-interval '20 days' end,
      'total_inc_gst_cents',100000,'total_ex_gst_cents',86957,'gst_cents',13043))).*
      from public.deposit_invoices i cross join preview_cases c where i.invoice_ref='INV-REGISTER';
    alter table public.deposit_invoices enable trigger all;
    insert into public.project_payment_entries(id,project_id,entry_type,amount_inc_gst_cents,occurred_at,created_by)
      select entry_id,project_id,'PAYMENT',case when kind='Partial receipt' then 40000 else 10000 end,now(),'Synthetic fixture'
      from preview_cases where kind in ('Partial receipt','Project credit to check');
    insert into public.xero_deposit_matches(id,tenant_id,receipt_id,contact_id,project_id,invoice_id,payment_entry_id,amount_inc_gst_cents,receipt_date,evidence_fingerprint,approved_by)
      select gen_random_uuid(),'${financeActor}',gen_random_uuid(),gen_random_uuid(),project_id,invoice_id,entry_id,40000,current_date,repeat('a',64),'${financeActor}'
      from preview_cases where kind='Partial receipt';
    insert into public.deposit_invoice_send_logs(deposit_invoice_id,status,created_at)
      select invoice_id,'FAILED',now() from preview_cases where kind='Failed send';
    insert into private.commercial_email_intents(intent_key,kind,subject_id,project_id,payload_hash,protected_payload,status,
      provider_idempotency_key,provider_idempotency_expires_at)
      select 'deposit-invoice-send:'||invoice_id,'deposit_invoice_send',invoice_id,project_id,repeat('a',64),'{}','dispatching',
        'synthetic-'||invoice_id,now()+interval '1 day' from preview_cases where kind='Delivery pending';
    create temp table preview_quotes as select gen_random_uuid() project_id,gen_random_uuid() quote_id,kind
      from unnest(array['Accepted with draft revision','Awaiting with draft revision','Expired','Declined','Prepared delivery']) kind;
    insert into public.projects(id,name) select project_id,'Synthetic '||kind||' job' from preview_quotes;
    insert into public.quotes(id,project_id,quote_ref) select quote_id,project_id,
      case kind when 'Expired' then 'Q-EXPIRED' when 'Declined' then 'Q-DECLINED' when 'Accepted with draft revision' then 'Q-AGREED' when 'Prepared delivery' then 'Q-PREPARED' else 'Q-AWAITING' end from preview_quotes;
    insert into public.quote_versions(quote_id,version_number,status,customer_name,total_inc_gst_cents,total_ex_gst_cents,gst_cents,accepted_at,sent_at,expires_at,is_current_draft,delivery_prepared_at,created_at)
      select quote_id,1,case when kind='Accepted with draft revision' then 'ACCEPTED' when kind='Declined' then 'DECLINED' when kind='Prepared delivery' then 'DRAFT' else 'SENT' end,
        'Synthetic '||kind,500000,434783,65217,case when kind='Accepted with draft revision' then now() end,
        case when kind<>'Prepared delivery' then now()-interval '10 days' end,
        case when kind='Expired' then current_date-2 else current_date+10 end,kind='Prepared delivery',
        case when kind='Prepared delivery' then now()-interval '1 hour' end,now()-interval '12 days' from preview_quotes;
    insert into public.quote_versions(quote_id,version_number,status,customer_name,total_inc_gst_cents,total_ex_gst_cents,gst_cents,is_current_draft)
      select quote_id,2,'DRAFT','Synthetic '||kind,600000,521739,78261,true from preview_quotes where kind like '%draft revision';
    insert into private.commercial_email_intents(intent_key,kind,subject_id,project_id,payload_hash,protected_payload,status,
      provider_idempotency_key,provider_idempotency_expires_at,provider_message_id)
      select 'quote-send:'||v.id||':synthetic-prepared','quote_send',v.id,q.project_id,repeat('a',64),'{}','provider_accepted',
        'synthetic-prepared-'||v.id,now()+interval '1 day','synthetic-provider-message' from public.quote_versions v
      join preview_quotes q on q.quote_id=v.quote_id where q.kind='Prepared delivery';
    update public.quote_versions v set delivery_prepared_at=now()-interval '1 hour',created_at=now()-interval '2 hours' from preview_quotes q
      where q.quote_id=v.quote_id and q.kind='Awaiting with draft revision' and v.version_number=2;
    insert into private.commercial_email_intents(intent_key,kind,subject_id,project_id,payload_hash,protected_payload,status,
      provider_idempotency_key,provider_idempotency_expires_at,provider_message_id)
      select 'quote-send:'||v.id||':synthetic-revision','quote_send',v.id,q.project_id,repeat('a',64),'{}','provider_accepted',
        'synthetic-revision-'||v.id,now()+interval '1 day','synthetic-revision-message' from public.quote_versions v
      join preview_quotes q on q.quote_id=v.quote_id where q.kind='Awaiting with draft revision' and v.version_number=2;
  `);
}
