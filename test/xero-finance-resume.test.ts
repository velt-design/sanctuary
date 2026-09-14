// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
it('resumes the same unprepared job once and refuses uncertain, disabled or ungranted work', async () => {
  const db = new PGlite(); const id = '11111111-1111-4111-8111-111111111111';
  try {
    await db.exec(`create schema private; create schema auth; create role anon; create role authenticated; create role service_role;
      create table public.xero_payment_approvers(user_id uuid,revoked_at timestamptz);
      create table public.deposit_invoices(id uuid,status text);
      create table private.xero_invoice_transfers(id uuid,invoice_id uuid,tenant_id uuid,job_id uuid,source_contact_id uuid,provider_invoice_id uuid);
      create table private.xero_invoice_transfer_control(singleton boolean,enabled boolean,tenant_id uuid,mapping_verified_at timestamptz,effective_tax_rate numeric);
      create table private.xero_invoice_requests(transfer_id uuid);
      create table private.xero_customer_mappings(tenant_id uuid,portal_contact_id uuid,revoked_at timestamptz);
      create table public.background_jobs(id uuid,status text,kind text,execution_owner text,subject_id text);
      create table public.background_job_effects(job_id uuid);
      create table retry_calls(job_id uuid,actor uuid);
      create function public.background_job_manual_retry(uuid,uuid) returns void language plpgsql as $$ begin
        insert into public.retry_calls values($1,$2); update public.background_jobs set status='queued' where id=$1; end $$;
      insert into public.xero_payment_approvers values('${id}',null);
      insert into public.deposit_invoices values('${id}','OPEN');
      insert into private.xero_invoice_transfers values('${id}','${id}','${id}','${id}','${id}',null);
      insert into private.xero_invoice_transfer_control values(true,true,'${id}',now(),15);
      insert into private.xero_customer_mappings values('${id}','${id}',null);
      insert into public.background_jobs values('${id}','needs_attention','xero_invoice_draft_v1','worker','${id}');`);
    const commands = readFileSync('supabase/migrations/20260914000003_xero_deposit_commands.sql', 'utf8');
    await db.exec(commands.slice(commands.indexOf('create function public.xero_require_payment_approver'), commands.indexOf('create function public.xero_approve_deposit_match')));
    await db.exec(readFileSync('supabase/migrations/20260914000012_xero_finance_resume.sql', 'utf8'));
    const resume = () => db.query<{ result: { state: string } }>('select public.xero_finance_resume($1,$1,$1) result', [id]);
    expect((await resume()).rows[0].result.state).toBe('queued');
    expect((await resume()).rows[0].result.state).toBe('already_running');
    expect((await db.query('select * from retry_calls')).rows).toEqual([{ job_id: id, actor: id }]);
    await db.exec(`update public.background_jobs set status='needs_attention'; insert into private.xero_invoice_requests values('${id}')`);
    await expect(resume()).rejects.toThrow('XERO_RECONCILIATION_REQUIRED');
    await db.exec('delete from private.xero_invoice_requests; update private.xero_invoice_transfer_control set enabled=false');
    await expect(resume()).rejects.toThrow('XERO_TRANSFER_DISABLED');
    await db.exec('update public.xero_payment_approvers set revoked_at=now()');
    await expect(resume()).rejects.toThrow('Payment approval permission is required');
    expect((await db.query('select * from retry_calls')).rows).toHaveLength(1);
  } finally { await db.close(); }
});
