// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let sql = '';

describe('admin payment reconciliation migration', () => {
  beforeAll(async () => {
    sql = await readFile(resolve(process.cwd(), 'supabase/migrations/20260810000004_admin_payment_reconciliation.sql'), 'utf8');
  });

  it('adds an append-only job payment ledger and reversible allocations', () => {
    expect(sql).toContain('create table if not exists public.project_payment_entries');
    expect(sql).toContain('create table if not exists public.project_payment_allocations');
    expect(sql).toContain('commercial_replace_payment_allocations');
    expect(sql).toContain('commercial_reverse_payment_entry');
    expect(sql).toContain('Payment allocations are immutable; reverse and replace them');
    expect(sql).not.toContain('amount_paid');
  });

  it('records paid historical invoices as transferable job credit', () => {
    expect(sql).toMatch(/insert into public\.project_payment_entries[\s\S]*?from public\.deposit_invoices invoice[\s\S]*?where invoice\.status = 'PAID'/);
  });

  it('keeps whole invoice state and gates mutation RPCs to service role', () => {
    expect(sql).toContain("creation_mode in ('scheduled', 'next_stage', 'full_remaining', 'custom', 'split')");
    expect(sql).toMatch(/revoke all on function public\.commercial_create_admin_invoice[\s\S]*?from public, anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.commercial_reverse_payment_entry[\s\S]*?to service_role;/);
    expect(sql).toContain('project_payment_entries_audit_insert');
    expect(sql).toContain("'invoice.created:' || v_invoice_id::text");
  });
});
