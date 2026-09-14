// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
it('resumes unprepared/unused requests once, audits an expired unused window, and refuses uncertain work', async () => {
  const db = new PGlite(); const id = '11111111-1111-4111-8111-111111111111';
  try {
    await db.exec(`create schema private; create schema auth; create role anon; create role authenticated; create role service_role;
      create table auth.users(id uuid primary key);
      create table public.xero_payment_approvers(user_id uuid,revoked_at timestamptz);
      create table public.deposit_invoices(id uuid,status text);
      create table private.xero_invoice_transfers(id uuid primary key,invoice_id uuid,tenant_id uuid,job_id uuid,source_contact_id uuid,provider_invoice_id uuid);
      create table private.xero_invoice_transfer_control(singleton boolean,enabled boolean,tenant_id uuid,mapping_verified_at timestamptz,effective_tax_rate numeric);
      create table private.xero_customer_mappings(tenant_id uuid,portal_contact_id uuid,revoked_at timestamptz);
      create table public.background_jobs(id uuid,status text,kind text,execution_owner text,subject_id text,lease_token uuid,cancellation_requested_at timestamptz);
      create table public.background_job_effects(job_id uuid);
      create table retry_calls(job_id uuid,actor uuid);
      create function public.background_job_manual_retry(uuid,uuid) returns void language plpgsql as $$ begin
        insert into public.retry_calls values($1,$2); update public.background_jobs set status='queued' where id=$1; end $$;
      insert into public.xero_payment_approvers values('${id}',null);
      insert into auth.users values('${id}');
      insert into public.deposit_invoices values('${id}','OPEN');
      insert into private.xero_invoice_transfers values('${id}','${id}','${id}','${id}','${id}',null);
      insert into private.xero_invoice_transfer_control values(true,true,'${id}',now(),15);
      insert into private.xero_customer_mappings values('${id}','${id}',null);
      insert into public.background_jobs(id,status,kind,execution_owner,subject_id) values('${id}','needs_attention','xero_invoice_draft_v1','worker','${id}');`);
    const commands = readFileSync('supabase/migrations/20260914000003_xero_deposit_commands.sql', 'utf8');
    await db.exec(commands.slice(commands.indexOf('create function public.xero_require_payment_approver'), commands.indexOf('create function public.xero_approve_deposit_match')));
    await db.exec(readFileSync('supabase/migrations/20260914000012_xero_finance_resume.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/20260914000007_xero_invoice_frozen_requests.sql', 'utf8'));
    const mapping = readFileSync('supabase/migrations/20260914000011_xero_finance_mapping_commands.sql', 'utf8');
    const auditStart = mapping.indexOf('create function private.xero_mapping_event_immutable()');
    await db.exec(mapping.slice(auditStart, mapping.indexOf('revoke all', auditStart)));
    await db.exec(readFileSync('supabase/migrations/20260914000021_xero_unused_invoice_resume.sql', 'utf8'));
    const resume = () => db.query<{ result: { state: string } }>('select public.xero_finance_resume($1,$1,$1) result', [id]);
    expect((await resume()).rows[0].result.state).toBe('queued');
    expect((await resume()).rows[0].result.state).toBe('already_running');
    expect((await db.query('select * from retry_calls')).rows).toEqual([{ job_id: id, actor: id }]);
    await db.exec(`update public.background_jobs set status='needs_attention';
      insert into private.xero_invoice_requests(transfer_id,body,body_hash,created_at,window_started_at,expires_at)
      values('${id}','{}',encode(sha256(convert_to('{}','UTF8')),'hex'),now()-interval '10 minutes',now()-interval '10 minutes',now()-interval '5 minutes')`);
    const before = (await db.query('select body,body_hash,idempotency_key,created_at from private.xero_invoice_requests')).rows[0];
    await db.exec(`update public.background_jobs set lease_token='${id}'`);
    await expect(resume()).rejects.toThrow('XERO_RECONCILIATION_REQUIRED');
    await db.exec(`update public.background_jobs set lease_token=null; insert into public.background_job_effects values('${id}')`);
    await expect(resume()).rejects.toThrow('XERO_RECONCILIATION_REQUIRED');
    expect((await db.query('select * from private.xero_unused_window_renewals')).rows).toHaveLength(0);
    await db.exec('delete from public.background_job_effects');
    expect((await resume()).rows[0].result.state).toBe('queued');
    expect((await resume()).rows[0].result.state).toBe('already_running');
    expect((await db.query('select body,body_hash,idempotency_key,created_at from private.xero_invoice_requests')).rows[0]).toEqual(before);
    expect((await db.query('select * from private.xero_unused_window_renewals')).rows).toHaveLength(1);
    await db.exec("update public.background_jobs set status='needs_attention'");
    expect((await resume()).rows[0].result.state).toBe('queued');
    expect((await db.query('select * from private.xero_unused_window_renewals')).rows).toHaveLength(1);
    await expect(db.exec("update private.xero_invoice_requests set expires_at=expires_at+interval '1 second'")).rejects.toThrow('XERO_REQUEST_IMMUTABLE');
    await expect(db.exec('delete from private.xero_unused_window_renewals')).rejects.toThrow('append-only');
    await db.exec("update public.background_jobs set status='needs_attention'; update private.xero_invoice_requests set dispatch_started_at=now()");
    await expect(resume()).rejects.toThrow('XERO_RECONCILIATION_REQUIRED');
    await db.exec('update private.xero_invoice_transfer_control set enabled=false');
    await expect(resume()).rejects.toThrow('XERO_TRANSFER_DISABLED');
    await db.exec('update public.xero_payment_approvers set revoked_at=now()');
    await expect(resume()).rejects.toThrow('Payment approval permission is required');
    expect((await db.query('select * from retry_calls')).rows).toHaveLength(3);
  } finally { await db.close(); }
});
