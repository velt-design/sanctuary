// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { financeOutcome, financeReviewSchema } from '../apps/portal/lib/xero/financeReview';

it('reads partial receipts without double counting allocations and refuses revoked finance access', async () => {
  const db = new PGlite();
  const actor = '11111111-1111-4111-8111-111111111111';
  const invoice = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`create schema private; create schema auth; create role anon; create role authenticated; create role service_role;
      create table auth.users(id uuid primary key); create table public.projects(id uuid primary key);
      create table private.xero_invoice_transfers(id uuid,invoice_id uuid,job_id uuid,provider_invoice_id uuid,last_verified_at timestamptz);
      create table public.background_jobs(id uuid,status text,error_code text);`);
    await db.exec(readFileSync('supabase/tests/xero_invoice_bootstrap.sql', 'utf8'));
    await db.exec(`alter table public.deposit_invoices add column customer_name text,add column project_name text,
      add column quote_version_id uuid,add column payment_term_id text;
      create table public.project_payment_allocations(payment_entry_id uuid,project_id uuid,standalone_invoice_id uuid,
        quote_version_id uuid,payment_term_id text,amount_inc_gst_cents int,reversed_at timestamptz);
      create table public.xero_deposit_matches(payment_entry_id uuid,invoice_id uuid,amount_inc_gst_cents int,reversed_at timestamptz);
      create table public.project_payment_entries(id uuid,project_id uuid,amount_inc_gst_cents int,entry_type text,reverses_entry_id uuid);
      insert into auth.users values('${actor}'); insert into public.projects(id) values('${actor}');
      insert into public.xero_payment_approvers(user_id,granted_by) values('${actor}','Test');
      insert into public.deposit_invoices(id,project_id,status,invoice_ref,total_inc_gst_cents) values('${invoice}','${actor}','OPEN','INV-TEST',1000);`);
    const commands = readFileSync('supabase/migrations/20260914000003_xero_deposit_commands.sql', 'utf8');
    await db.exec(commands.slice(commands.indexOf('create function public.xero_require_payment_approver'), commands.indexOf('create function public.xero_approve_deposit_match')));
    await db.exec(readFileSync('supabase/migrations/20260914000010_xero_finance_review.sql', 'utf8'));
    const review = async () => financeReviewSchema.parse((await db.query<{ data: unknown }>('select public.xero_finance_review($1) data', [actor])).rows[0].data);
    await db.exec(`insert into public.xero_deposit_matches values('${actor}','${invoice}',400,null)`);
    expect(financeOutcome((await review()).rows[0]).remainingCents).toBe(600);
    await db.exec(`insert into public.project_payment_allocations(payment_entry_id,project_id,standalone_invoice_id,amount_inc_gst_cents)
      values('${actor}','${actor}','${invoice}',400)`);
    expect((await review()).rows[0].recordedCents).toBe(400);
    await db.exec('update public.project_payment_allocations set reversed_at=now(); update public.xero_deposit_matches set reversed_at=now()');
    expect(financeOutcome((await review()).rows[0]).remainingCents).toBe(1000);
    await db.exec("update public.deposit_invoices set status='PAID'");
    expect(financeOutcome((await review()).rows[0])).toMatchObject({ remainingCents: null, attention: true, label: 'Check payment history' });
    await db.exec(`update public.deposit_invoices set status='OPEN';
      insert into public.project_payment_entries values('${actor}','${actor}',500,'PAYMENT',null)`);
    expect(financeOutcome((await review()).rows[0])).toMatchObject({ remainingCents: null, label: 'Assign existing project receipts before chasing payment' });
    await db.exec('update public.xero_payment_approvers set revoked_at=now()');
    await expect(review()).rejects.toThrow('Payment approval permission is required');
  } finally { await db.close(); }
});
