// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
it('saves verified mapping once, keeps transfers disabled, and rejects changed identity or tax', async () => {
  const db = new PGlite(); const id = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`create schema private; create schema auth; create role anon; create role authenticated; create role service_role;
      create table auth.users(id uuid primary key); create table public.projects(id uuid primary key);
      create table private.xero_invoice_transfer_control(singleton boolean primary key,enabled boolean default false,tenant_id uuid,account_code text,tax_type text,mapping_verified_at timestamptz);
      insert into private.xero_invoice_transfer_control(singleton) values(true);
      create table private.xero_invoice_transfers(id uuid,invoice_id uuid,source_contact_id uuid);
      create table private.xero_invoice_requests(transfer_id uuid);
      create table private.xero_customer_mappings(tenant_id uuid,portal_contact_id uuid,xero_contact_id uuid,verified_at timestamptz,verified_by uuid,revoked_at timestamptz,primary key(tenant_id,portal_contact_id));`);
    await db.exec(readFileSync('supabase/tests/xero_invoice_bootstrap.sql', 'utf8'));
    await db.exec(`alter table public.deposit_invoices add column customer_name text;
      insert into auth.users values('${id}'); insert into public.contacts values('${id}');
      insert into public.projects(id,contact_id) values('${id}','${id}');
      insert into public.deposit_invoices(id,project_id,status,invoice_ref) values('${id}','${id}','OPEN','INV-TEST');
      insert into public.xero_payment_approvers(user_id,granted_by) values('${id}','Synthetic');`);
    const commands = readFileSync('supabase/migrations/20260914000003_xero_deposit_commands.sql', 'utf8');
    await db.exec(commands.slice(commands.indexOf('create function public.xero_require_payment_approver'), commands.indexOf('create function public.xero_approve_deposit_match')));
    await db.exec(readFileSync('supabase/migrations/20260914000011_xero_finance_mapping_commands.sql', 'utf8'));
    const proof = { contact: { id, name: 'Synthetic', email: '' }, account: { id, code: '475', name: 'Custom sales', defaultTaxType: 'TAX001' }, tax: { type: 'TAX001', name: 'Custom GST', effectiveRate: 15 } };
    const save = (command = id, source = id, value = proof) => db.query('select public.xero_finance_save_mapping($1,$2,$3,$4,$5,$6)', [command, id, id, id, source, JSON.stringify(value)]);
    await save(); await save();
    expect((await db.query('select * from private.xero_finance_mapping_events')).rows).toHaveLength(1);
    expect((await db.query('select enabled,account_code from private.xero_invoice_transfer_control')).rows[0]).toEqual({ enabled: false, account_code: '475' });
    await expect(save(other, other)).rejects.toThrow('XERO_MAPPING_CHANGED');
    await expect(save(other, id, { ...proof, tax: { ...proof.tax, effectiveRate: 10 } })).rejects.toThrow('XERO_TAX_MAPPING_REVIEW_REQUIRED');
    await expect(db.exec('delete from private.xero_finance_mapping_events')).rejects.toThrow('append-only');
    await db.exec(`insert into private.xero_invoice_transfers(id,invoice_id,source_contact_id) values('${other}','${id}','${id}');
      insert into private.xero_invoice_requests values('${other}'); update public.deposit_invoices set gst_cents=0;`);
    await expect(db.exec(`insert into private.xero_invoice_requests values('${other}')`)).rejects.toThrow('XERO_TAX_MAPPING_REVIEW_REQUIRED');
    await db.exec('delete from private.xero_invoice_transfers');
    await db.exec(`insert into private.xero_invoice_transfers(id,invoice_id,source_contact_id) values('${id}','${id}',null)`);
    await expect(save(other)).rejects.toThrow('XERO_MAPPING_CONTEXT_UNAVAILABLE');
  } finally { await db.close(); }
});
