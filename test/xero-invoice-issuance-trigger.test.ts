// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getBackgroundJobDefinition } from '@sp/jobs';
import { mapIssuedInvoiceToXeroDraft, type IssuedInvoiceForXero, type XeroInvoiceMapping } from '../apps/portal/lib/xero/invoiceDraftMapping';

let db: PGlite;
const project = '11111111-1111-4111-8111-111111111111';
const tenant = '22222222-2222-4222-8222-222222222222';
async function count() {
  return Number((await db.query<{ count: string }>('select count(*) from private.xero_invoice_transfers')).rows[0].count);
}

describe('Xero issuance capture boundary', () => {
  beforeAll(async () => {
    db = new PGlite();
    // Test the production trigger and transaction semantics. The enqueue adapter
    // records its arguments; real PGMQ and lease behaviour require the jobs DB suite.
    await db.exec(`
      create schema private; create schema auth;
      create role anon; create role authenticated; create role service_role;
      create table auth.users(id uuid primary key);
      insert into auth.users values ('${tenant}');
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create type public.background_job_rollout_mode as enum ('disabled','legacy','shadow','worker_cohort','worker_enabled');
      create type public.background_job_execution_owner as enum ('legacy','shadow','worker');
      create type public.background_job_effect_state as enum ('prepared','dispatch_started','provider_accepted','finalised','uncertain','failed');
      create table public.contacts(id uuid primary key);
      insert into public.contacts values ('${project}');
      create table public.projects(id uuid primary key,contact_id uuid references public.contacts(id));
      insert into public.projects values ('${project}','${project}');
      create table public.deposit_invoices(id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id), status text,
        invoice_ref text default 'INV-TEST',currency text default 'NZD',invoice_kind text default 'QUOTE_LINKED',
        issue_date date default '2026-09-14',due_date date default '2026-09-21',quote_ref text default 'Q-TEST',payment_term_label text default 'Deposit',
        total_inc_gst_cents int default 115,total_ex_gst_cents int default 100,gst_cents int default 15,content_snapshot jsonb);
      create table public.background_job_kinds(kind text primary key,contract_version int,handler_owner text,max_attempts int,
        timeout_seconds int,concurrency_class text,has_external_side_effect boolean,required_effect_kinds text[],
        cancellation_allowed boolean,default_rollout_mode public.background_job_rollout_mode,active boolean,allowed_effect_kinds text[]);
      create table public.background_jobs(id uuid primary key default gen_random_uuid(),kind text,intent_key text unique,payload jsonb,
        lease_owner text default 'test-worker',lease_token uuid default '${tenant}',lease_expires_at timestamptz default now()+interval '1 hour',
        status text default 'running',contract_version int default 1,execution_owner text default 'worker',cancellation_requested_at timestamptz,
        subject_type text,subject_id text,project_id uuid,queue_message_id bigint default 1,attempt_count int default 1,current_phase text);
      create table public.background_job_effects(id uuid primary key default gen_random_uuid(),job_id uuid references public.background_jobs(id),
        effect_key text,effect_kind text,state public.background_job_effect_state,payload_hash text,provider_name text,
        provider_idempotency_key text,provider_idempotency_expires_at timestamptz,provider_message_id text,
        created_at timestamptz default now(),updated_at timestamptz default now(),provider_accepted_at timestamptz,finalised_at timestamptz,
        unique(job_id,effect_kind),unique(provider_name,provider_message_id));
      create table public.background_job_events(job_id uuid,event_type text);
      create function private.background_job_insert_event(uuid,bigint,text,text,text,text,int,text,uuid,text,jsonb)
      returns void language plpgsql as $$ begin
        if current_setting('test.finalise_failure',true)='yes' then raise exception 'Synthetic audit failure'; end if;
        insert into public.background_job_events values ($1,$3);
      end $$;
      create function public.background_job_record_effect_checkpoint(uuid,text,uuid,text,text,public.background_job_effect_state,text,text,text,timestamptz,text,jsonb)
      returns public.background_job_effects language plpgsql as $$ declare r public.background_job_effects; begin
        insert into public.background_job_effects(job_id,effect_key,effect_kind,state,payload_hash,provider_name,provider_idempotency_key,provider_idempotency_expires_at)
          values($1,$4,$5,$6,$7,$8,$9,$10) on conflict(job_id,effect_kind) do update set state=excluded.state returning * into r;
        if $6='dispatch_started' then update public.background_jobs set status='dispatching' where id=$1; end if;
        return r;
      end $$;
      create function private.background_job_enqueue_core(text,int,text,text,uuid,uuid,text,smallint,text,jsonb,timestamptz,
        public.background_job_rollout_mode,public.background_job_execution_owner,text)
      returns public.background_jobs language plpgsql as $$ declare r public.background_jobs; begin
        if current_setting('test.enqueue_failure',true) = 'yes' then raise exception 'Synthetic enqueue failure'; end if;
        insert into public.background_jobs(kind,intent_key,payload,subject_type,subject_id,project_id) values ($1,$9,$10,$3,$4,$5) returning * into r; return r;
      end $$;
    `);
    await db.exec(readFileSync(path.resolve('supabase/migrations/20260914000005_xero_invoice_transfer_intents.sql'), 'utf8'));
    const lifecycle = readFileSync(path.resolve('supabase/migrations/20260720_000003_background_job_lifecycle.sql'), 'utf8');
    await db.exec(lifecycle.slice(lifecycle.indexOf('create or replace function private.background_job_lock_owned('),
      lifecycle.indexOf('create or replace function private.background_job_archive_canonical(')));
    await db.exec(readFileSync(path.resolve('supabase/migrations/20260914000006_xero_invoice_context.sql'), 'utf8'));
    await db.exec(readFileSync(path.resolve('supabase/migrations/20260914000007_xero_invoice_frozen_requests.sql'), 'utf8'));
    const readFunction = (source: string, name: string) => {
      const start = source.indexOf(`create or replace function ${name}(`);
      if (start < 0) throw new Error('Missing test SQL owner');
      return source.slice(start, source.indexOf('$$;', start) + 3);
    };
    const foundation = readFileSync(path.resolve('supabase/migrations/20260720_000001_background_job_foundation.sql'), 'utf8');
    const effects = readFileSync(path.resolve('supabase/migrations/20260720_000007_background_job_provider_reconciliation.sql'), 'utf8');
    await db.exec(readFunction(effects, 'public.background_job_effect_transition_allowed'));
    await db.exec(readFunction(foundation, 'public.background_job_effects_before_update'));
    await db.exec('create trigger effect_guard before update on public.background_job_effects for each row execute function public.background_job_effects_before_update()');
    await db.exec(readFileSync(path.resolve('supabase/migrations/20260914000008_xero_invoice_dispatch.sql'), 'utf8'));
  });
  afterAll(async () => { await db?.close(); });

  it('aligns the new database kind with package policy and remains disabled', async () => {
    const row = (await db.query('select * from public.background_job_kinds')).rows[0];
    const definition = getBackgroundJobDefinition('xero_invoice_draft_v1');
    expect(row).toMatchObject({ kind: definition.kind, contract_version: definition.payloadContractVersion,
      handler_owner: definition.handlerOwner, max_attempts: definition.retry.maxAttempts,
      timeout_seconds: definition.timeoutMs / 1000, concurrency_class: definition.concurrencyClass,
      has_external_side_effect: true, allowed_effect_kinds: [...definition.allowedEffectCheckpoints],
      required_effect_kinds: [...definition.requiredEffectCheckpoints], cancellation_allowed: false,
      default_rollout_mode: 'disabled' });
    expect((await db.query('select enabled from private.xero_invoice_transfer_control')).rows[0].enabled).toBe(false);
  });

  it('does not capture history when activated, nor unissued drafts or payment changes', async () => {
    await db.exec(`insert into public.deposit_invoices(project_id,status) values ('${project}','OPEN')`);
    await db.exec(`update private.xero_invoice_transfer_control set enabled=true,tenant_id='${tenant}';
      update public.deposit_invoices set status='PAID';
      insert into public.deposit_invoices(project_id,status) values ('${project}','DRAFT');`);
    expect(await count()).toBe(0);
  });

  it('captures draft issuance once and uses only bounded job identity', async () => {
    await db.exec(`begin; update public.deposit_invoices set status='OPEN' where status='DRAFT';`);
    expect(await count()).toBe(0);
    await db.exec('commit');
    expect(await count()).toBe(1);
    const row = (await db.query<{ payload: Record<string, unknown> }>('select payload from public.background_jobs')).rows[0];
    expect(Object.keys(row.payload).sort()).toEqual(['contractVersion', 'invoiceId', 'tenantId', 'transferId']);
    expect(row.payload).toMatchObject({ contractVersion: 1, tenantId: tenant });
    await db.exec("update public.deposit_invoices set status='PAID'");
    expect(await count()).toBe(1);
  });

  it('captures direct legacy issuance but skips an invoice voided before commit', async () => {
    await db.exec(`begin; insert into public.deposit_invoices(project_id,status) values ('${project}','OPEN');
      update public.deposit_invoices set status='VOID' where status='OPEN'; commit;`);
    expect(await count()).toBe(1);
    await db.exec(`insert into public.deposit_invoices(project_id,status) values ('${project}','OPEN')`);
    expect(await count()).toBe(2);
  });

  it('rolls issuance back if its durable enqueue cannot commit', async () => {
    const before = (await db.query('select count(*) from public.deposit_invoices')).rows[0].count;
    await db.exec("begin; select set_config('test.enqueue_failure','yes',true)");
    await db.exec(`insert into public.deposit_invoices(project_id,status) values ('${project}','OPEN')`);
    await expect(db.exec('commit')).rejects.toThrow('Synthetic enqueue failure');
    await db.exec('rollback');
    expect((await db.query('select count(*) from public.deposit_invoices')).rows[0].count).toBe(before);
    expect(await count()).toBe(2);
  });

  it('denies browser and service-role direct access to control and transfer rows', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const result = await db.query<{ allowed: boolean }>(`select has_table_privilege($1,'private.xero_invoice_transfers','SELECT')
        or has_table_privilege($1,'private.xero_invoice_transfer_control','UPDATE') as allowed`, [role]);
      expect(result.rows[0].allowed).toBe(false);
    }
  });

  it('requires verified mappings and uses the contact frozen at issuance', async () => {
    const job = (await db.query<{ id: string }>('select id from public.background_jobs limit 1')).rows[0].id;
    await expect(db.query('select public.xero_invoice_transfer_context($1,$2)', [job, tenant])).rejects.toThrow('XERO_MAPPING_REQUIRED');
    await db.exec(`update private.xero_invoice_transfer_control set account_code='200',tax_type='OUTPUT2',mapping_verified_at=now();
      insert into private.xero_customer_mappings values ('${tenant}','${project}','${tenant}',now(),'${tenant}',null);
      update public.projects set contact_id=null;`);
    const value = (await db.query<{ result: { mapping: { contactId: string }; invoice: { totalIncGstCents: number } } }>(
      'select public.xero_invoice_transfer_context($1,$2) as result', [job, tenant])).rows[0].result;
    expect(value.mapping.contactId).toBe(tenant);
    expect(value.invoice.totalIncGstCents).toBe(115);
  });

  it('refuses stale leases, disabled transfers, wrong subjects and revoked customer mappings', async () => {
    const job = (await db.query<{ id: string }>('select id from public.background_jobs limit 1')).rows[0].id;
    await expect(db.query('select public.xero_invoice_transfer_context($1,$2)', [job, project])).rejects.toThrow(/lease/);
    await db.exec(`update public.background_jobs set lease_expires_at=now()-interval '1 second' where id='${job}'`);
    await expect(db.query('select public.xero_invoice_transfer_context($1,$2)', [job, tenant])).rejects.toThrow(/lease/);
    await db.exec(`update public.background_jobs set lease_expires_at=now()+interval '1 hour' where id='${job}';
      update private.xero_invoice_transfer_control set enabled=false;`);
    await expect(db.query('select public.xero_invoice_transfer_context($1,$2)', [job, tenant])).rejects.toThrow('XERO_TRANSFER_DISABLED');
    await db.exec(`update private.xero_invoice_transfer_control set enabled=true;
      update public.background_jobs set subject_type='quote' where id='${job}'`);
    await expect(db.query('select public.xero_invoice_transfer_context($1,$2)', [job, tenant])).rejects.toThrow('XERO_JOB_NOT_AUTHORISED');
    await db.exec(`update public.background_jobs set subject_type='invoice' where id='${job}';
      update private.xero_customer_mappings set revoked_at=now()`);
    await expect(db.query('select public.xero_invoice_transfer_context($1,$2)', [job, tenant])).rejects.toThrow('XERO_MAPPING_REQUIRED');
  });

  it('freezes the mapped issued request once and refuses changed amounts or accounting identity', async () => {
    await db.exec('update private.xero_customer_mappings set revoked_at=null');
    const job = (await db.query<{ id: string }>('select id from public.background_jobs limit 1')).rows[0].id;
    const context = (await db.query<{ result: { invoice: IssuedInvoiceForXero; mapping: XeroInvoiceMapping } }>(
      'select public.xero_invoice_transfer_context($1,$2) as result', [job, tenant])).rows[0].result;
    const draft = mapIssuedInvoiceToXeroDraft(context.invoice, context.mapping);
    const prepare = (value: unknown) => db.query<{ result: Record<string, unknown> }>(
      'select public.xero_invoice_prepare_request($1,$2,$3,$4) as result', [job, tenant, tenant, JSON.stringify({ Invoices: [value] })]);
    await expect(prepare({ ...draft, Status: 'AUTHORISED' })).rejects.toThrow('XERO_REQUEST_INVALID');
    await expect(prepare({ ...draft, Contact: { ContactID: project } })).rejects.toThrow('XERO_REQUEST_INVALID');
    await expect(prepare({ ...draft, LineItems: [{ ...draft.LineItems[0], UnitAmount: 2, LineAmount: 2 }] }))
      .rejects.toThrow('XERO_REQUEST_TOTAL_MISMATCH');
    const first = (await prepare(draft)).rows[0].result;
    const retry = (await prepare(draft)).rows[0].result;
    expect(retry).toEqual(first);
    expect(first.body).toBe(JSON.stringify({ Invoices: [draft] }));
    expect(first.bodyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.idempotencyKey).toMatch(/^sp-xero:/);
    expect(first.dispatchStarted).toBe(false);
    await expect(prepare({ ...draft, Reference: 'Changed' })).rejects.toThrow('XERO_REQUEST_CHANGED');
    expect((await db.query('select count(*) from private.xero_invoice_requests')).rows[0].count).toBe(1);
    await expect(db.exec("update private.xero_invoice_requests set body='{}'")).rejects.toThrow('XERO_REQUEST_IMMUTABLE');
    await expect(db.exec("update private.xero_invoice_requests set expires_at=expires_at+interval '1 minute'"))
      .rejects.toThrow('XERO_REQUEST_IMMUTABLE');
    await expect(db.exec('delete from private.xero_invoice_requests')).rejects.toThrow('XERO_REQUEST_IMMUTABLE');
  });

  it('binds dispatch to the current mapping and atomically finalises verified read recovery', async () => {
    const job = (await db.query<{ id: string }>('select id from public.background_jobs limit 1')).rows[0].id;
    await db.exec("update private.xero_invoice_transfer_control set account_code='201'");
    await expect(db.query('select public.xero_invoice_begin_dispatch($1,$2)', [job, tenant])).rejects.toThrow('XERO_MAPPING_CHANGED');
    await db.exec("update private.xero_invoice_transfer_control set account_code='200'");
    const frozen = (await db.query<{ result: { body: string; bodyHash: string; dispatchStarted: boolean } }>(
      'select public.xero_invoice_begin_dispatch($1,$2) as result', [job, tenant])).rows[0].result;
    expect(frozen.dispatchStarted).toBe(true);
    const proof = { invoiceId: tenant, draft: JSON.parse(frozen.body).Invoices[0], totalCents: 115, taxCents: 15, subtotalCents: 100 };
    const finalise = (value = proof) => db.query('select public.xero_invoice_finalise($1,$2,$3,$4)', [job, tenant, frozen.bodyHash, value]);
    await expect(finalise({ ...proof, totalCents: 116 })).rejects.toThrow('XERO_VERIFICATION_MISMATCH');
    await db.exec("update public.background_job_effects set state='uncertain'; select set_config('test.finalise_failure','yes',false)");
    await expect(finalise()).rejects.toThrow('Synthetic audit failure');
    expect((await db.query('select finalised_at from private.xero_invoice_requests')).rows[0].finalised_at).toBe(null);
    expect((await db.query('select state from public.background_job_effects')).rows[0].state).toBe('uncertain');
    await db.exec("select set_config('test.finalise_failure','no',false)");
    await finalise();
    expect((await db.query('select state from public.background_job_effects')).rows[0].state).toBe('finalised');
    expect((await db.query('select provider_invoice_id from private.xero_invoice_requests')).rows[0].provider_invoice_id).toBe(tenant);
    expect((await db.query('select count(*) from public.background_job_events')).rows[0].count).toBe(2);
    await finalise();
    expect((await db.query('select count(*) from public.background_job_events')).rows[0].count).toBe(2);
    await expect(finalise({ ...proof, invoiceId: project })).rejects.toThrow('XERO_INVOICE_ID_CONFLICT');
  });
});
