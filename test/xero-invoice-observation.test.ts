// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
it('rejects stale observations and portal changes, preserves evidence and selects bounded refresh targets', async () => {
  const db = new PGlite(); const id = '11111111-1111-4111-8111-111111111111';
  try {
    await db.exec(`create schema private; create role anon; create role authenticated; create role service_role;
      create table private.xero_invoice_transfers(id uuid primary key,invoice_id uuid,tenant_id uuid,provider_invoice_id uuid);
      create table public.deposit_invoices(id uuid primary key,status text);
      create table private.xero_invoice_transfer_control(singleton boolean,tenant_id uuid);
      create table private.xero_invoice_requests(transfer_id uuid,body text);
      create table public.xero_payment_approvers(user_id uuid,revoked_at timestamptz);
      insert into private.xero_invoice_transfers values('${id}','${id}','${id}','${id}');
      insert into public.deposit_invoices values('${id}','OPEN');
      insert into private.xero_invoice_transfer_control values(true,'${id}');
      insert into private.xero_invoice_requests values('${id}','{"Invoices":[]}');
      insert into public.xero_payment_approvers values('${id}',null);`);
    const commands = readFileSync('supabase/migrations/20260914000003_xero_deposit_commands.sql', 'utf8');
    await db.exec(commands.slice(commands.indexOf('create function public.xero_require_payment_approver'), commands.indexOf('create function public.xero_approve_deposit_match')));
    await db.exec(readFileSync('supabase/migrations/20260914000013_xero_invoice_observations.sql', 'utf8'));
    const context = () => db.query<{ data: { generation: number } }>('select public.xero_invoice_observation_context($1,$1) data', [id]);
    const targets = () => db.query<{ data: string[] }>('select public.xero_invoice_observation_targets($1) data', [id]);
    expect((await targets()).rows[0].data).toEqual([id]);
    const first = (await context()).rows[0].data.generation; const second = (await context()).rows[0].data.generation;
    const result = { state: 'posted', reason: 'INVOICE_CONTENT_UNCHANGED', amountPaidCents: 0 };
    const save = (generation: number, value = result) => db.query('select public.xero_invoice_record_observation($1,$1,$2,$3,$4)', [id, generation, 'OPEN', JSON.stringify(value)]);
    await expect(save(first)).rejects.toThrow('XERO_OBSERVATION_CHANGED');
    await save(second); await save(second);
    expect((await db.query('select * from private.xero_invoice_observations')).rows).toHaveLength(1);
    await expect(save(second, { ...result, state: 'draft' })).rejects.toThrow('XERO_OBSERVATION_CHANGED');
    expect((await targets()).rows[0].data).toEqual([]);
    const third = (await context()).rows[0].data.generation;
    await db.exec("update public.deposit_invoices set status='VOID'");
    await expect(save(third)).rejects.toThrow('XERO_OBSERVATION_CHANGED');
    expect((await targets()).rows[0].data).toEqual([id]);
    expect((await db.query<{ data: unknown[] }>('select public.xero_finance_observations($1,array[$1]::uuid[]) data', [id])).rows[0].data).toEqual([]);
    await expect(db.exec('delete from private.xero_invoice_observations')).rejects.toThrow('append-only');
    await db.exec('update public.xero_payment_approvers set revoked_at=now()');
    await expect(db.query('select public.xero_finance_observations($1,array[$1]::uuid[])', [id])).rejects.toThrow('Payment approval permission is required');
  } finally { await db.close(); }
});
