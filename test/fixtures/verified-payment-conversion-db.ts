import { readFileSync } from 'node:fs';
import { prepareXeroPaymentDatabase } from '../../scripts/xero-payment-db-fixture.mjs';

export const paymentConversionMigration = 'migrations/20261102000001_verified_payment_conversion_events.sql';
export const paymentSql = (name: string) => readFileSync(`supabase/${name}`, 'utf8').replace(/\r/g, '');
export const paymentId = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;
export type PaymentDatabase = {
  exec(sql: string): Promise<unknown>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

function functionSql(source: string, name: string) {
  const start = source.indexOf(`create function private.${name}(`);
  if (start < 0) throw Error(`Missing test-policy owner ${name}`);
  return source.slice(start, source.indexOf('\n$$;', start) + 4);
}

/** Actual financial commands/outbox with explicit synthetic schema prerequisites. */
export async function preparePaymentConversions(db: PaymentDatabase) {
  await prepareXeroPaymentDatabase((sql: string) => db.exec(sql), paymentSql);
  await db.exec(`create table public.enquiry_requests(id uuid primary key,project_id uuid,created_at timestamptz not null default now(),
    raw_payload jsonb not null default '{}',utm jsonb not null default '{}');
    create index enquiry_requests_project_created on public.enquiry_requests(project_id,created_at,id);
    create table public.project_operational_states(project_id uuid primary key,state text,closed_outcome text);
    create table public.site_visit_events(id uuid primary key,status text);
    create table private.project_sales_outcomes(project_id uuid primary key,outcome text);
    create index audit_events_project_type on public.audit_events(project_id,type);
    create index quotes_project on public.quotes(project_id);
    create index quote_versions_family on public.quote_versions(quote_id,version_number desc);
    create index payment_allocations_project on public.project_payment_allocations(project_id);
    create index deposit_invoices_family on public.deposit_invoices(quote_id);
    create index payment_reversal on public.project_payment_entries(reverses_entry_id);`);
  const policy = paymentSql('migrations/20261027024135_marketing_enquiry_sales_evidence.sql');
  await db.exec(functionSql(policy, 'marketing_test_project'));
  await db.exec(functionSql(policy, 'marketing_test_enquiry'));
  await db.exec(paymentSql('migrations/20260730_000001_marketing_conversion_delivery.sql'));
}

export async function seedPaymentProject(db: PaymentDatabase, project = 1, family = project, accepted = true) {
  const id = paymentId;
  await db.exec(`insert into public.projects(id,name) values('${id(project)}','Synthetic payment project') on conflict do nothing;
    insert into public.enquiry_requests(id,project_id,created_at,raw_payload) values('${id(1000 + project)}','${id(project)}',now()-interval '1 day',
      '{"email":"private@example.test","attribution":{"analyticsClientId":"123.456","consent":{"analytics":true,"marketing":true},"utm":{"utm_source":"synthetic"},"clickIds":{"gclid":"never-copy-this"}}}') on conflict do nothing;
    insert into public.quotes(id,project_id,quote_ref) values('${id(family)}','${id(project)}','SYNTHETIC-${family}');
    insert into public.quote_versions(id,quote_id,version_number,status,accepted_at,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms)
    values('${id(2000 + family)}','${id(family)}',1,'${accepted ? 'ACCEPTED' : 'SENT'}',${accepted ? 'now()' : 'null'},20001,17392,2609,
      '[{"id":"deposit","resolvedAmountIncGstCents":10001},{"id":"final","resolvedAmountIncGstCents":10000}]');
    insert into public.deposit_invoices(id,project_id,quote_id,quote_version_id,quote_ref,quote_version_number,invoice_ref,status,
      quote_total_inc_gst_cents,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_term_id,payment_term_label,payment_term_position)
    values('${id(3000 + family)}','${id(project)}','${id(family)}','${id(2000 + family)}','SYNTHETIC-${family}',1,'SYNTHETIC-INV-${family}','OPEN',
      20001,10001,8697,1304,'deposit','Initial payment',1);`);
}
