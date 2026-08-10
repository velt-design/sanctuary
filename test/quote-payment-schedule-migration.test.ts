// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let sql = '';

describe('quote payment schedule migration', () => {
  beforeAll(async () => {
    sql = await readFile(resolve(process.cwd(), 'supabase/migrations/20260810_000002_quote_payment_schedules_and_invoice_payments.sql'), 'utf8');
  });

  it('freezes resolved quote terms and creates the first term on acceptance', () => {
    expect(sql).toContain('payment_terms jsonb');
    expect(sql).toContain("v_first_term := v_version.payment_terms->0");
    expect(sql).toContain("v_invoice_inc := (v_first_term->>'resolvedAmountIncGstCents')::integer");
    expect(sql).toContain('p_payment_terms jsonb');
  });

  it('supports multiple whole invoices and paid state without partial payments', () => {
    expect(sql).toContain("status in ('OPEN', 'PAID', 'VOID')");
    expect(sql).toContain('deposit_invoices_quote_version_term_active_unique');
    expect(sql).toContain('paid_at timestamptz');
    expect(sql).not.toContain('amount_paid');
  });

  it('keeps quote draft mutations service-role only', () => {
    expect(sql).toMatch(/revoke all on function public\.commercial_quote_create_draft\([\s\S]*?from public, anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.commercial_quote_update_draft\([\s\S]*?to service_role;/);
  });
});
