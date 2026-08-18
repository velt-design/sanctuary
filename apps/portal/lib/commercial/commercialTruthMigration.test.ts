// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260813000003_commercial_truth_invariants.sql',
);

let sql = '';

describe('commercial truth invariant migration', () => {
  beforeAll(async () => {
    sql = await readFile(migrationPath, 'utf8');
  });

  it('owns current accepted versions with accepted lifecycle tombstones', () => {
    expect(sql).toContain('commercial_current_accepted_quote_versions');
    expect(sql).toContain("version.status = 'ACCEPTED' or version.accepted_at is not null");
    expect(sql).toContain("ranked.lifecycle_rank = 1 and ranked.status = 'ACCEPTED'");
  });

  it('defines the project balance once from accepted scopes, ledger entries, and whole open invoices', () => {
    expect(sql).toContain('commercial_project_financial_truth');
    expect(sql).toContain('greatest(0, v_accepted - v_paid - v_open)');
    expect(sql).toContain('greatest(0, v_paid + v_open - v_accepted)');
  });

  it('serializes quote terminal states with invoice creation and preserves audit history', () => {
    expect(sql).toContain('commercial_mark_quote_superseded');
    expect(sql).toContain('commercial_mark_quote_declined');
    expect(sql).toContain("commercial-project-invoice:");
    expect(sql).toContain("'quote.superseded'");
    expect(sql).toContain("'quote.declined'");
    expect(sql).toContain("'invoice.voided:quote-superseded:' || v_invoice.id::text");
    expect(sql).toContain("invoice.quote_version_id = v_version.id and invoice.status = 'OPEN'");
    expect(sql).toContain('commercial_accept_quote_with_project_lock');
    expect(sql).toContain('Quote version is no longer the current accepted lifecycle version');
    expect(sql).toContain('Quote acceptance invoice exceeds the remaining job balance');
    expect(sql).toContain('invoice_quote_total_inc_gst_cents integer');
    expect(sql).toContain('v_invoice.invoice_ref');
    expect(sql).toContain('commercial_mark_invoice_paid_with_project_lock');
    expect(sql).toContain('commercial_void_open_invoice');
    expect(sql).toContain('commercial_replace_payment_allocations_with_project_lock');
    expect(sql).toContain('commercial_reverse_payment_entry_with_project_lock');
    expect(sql).toContain('commercial_mark_project_deposit_received');
    expect(sql).toContain('commercial_mark_project_paid');
    expect(sql).toMatch(/return query select true, v_paid_date;\s+return;/);
    expect(sql).toContain('revoke execute on function public.commercial_accept_quote_and_ensure_invoice');
  });

  it('prevents manual allocations from representing partial payment of an open invoice', () => {
    expect(sql).toContain('project_payment_allocations_no_open_invoice_partial');
    expect(sql).toContain('Mark the whole invoice paid or leave this payment unallocated');
  });

  it('reopens a whole paid invoice when its owned payment is reversed', () => {
    expect(sql).toContain("status = 'OPEN', paid_at = null");
    expect(sql).toContain("'invoice.payment_reversed'");
  });

  it('blocks stale accepted versions and job-wide over-invoicing by default', () => {
    expect(sql).toContain('Only the current accepted quote version can be invoiced');
    expect(sql).toContain('Invoice amount exceeds the remaining job balance');
    expect(sql).toContain('v_effective_before := least(v_truth.remaining_to_invoice_inc_gst_cents, v_scope_remaining)');
    expect(sql).toContain('revoke execute on function public.commercial_create_admin_invoice(');
    expect(sql).toContain('v_truth.open_invoice_inc_gst_cents - v_invoice.total_inc_gst_cents');
  });

  it('requires ledger settlement and no open invoices before completion', () => {
    const completionCommand = sql.slice(
      sql.indexOf('create or replace function public.commercial_complete_project_operational_state_command'),
      sql.indexOf('-- Keep the idempotency owner'),
    );

    expect(completionCommand).toContain('commercial_complete_project_operational_state_command');
    expect(completionCommand).toContain('open invoices remain unpaid or unvoided');
    expect(completionCommand).toContain('accepted commercial balance is not fully paid');
    expect(completionCommand).not.toContain('deposit_paid_date');
  });

  it('reopens a paid operational stage when later commercial truth becomes unsettled', () => {
    expect(sql).toContain('commercial_reopen_paid_project_if_unsettled');
    expect(sql).toContain("pipeline_stage = 'COMPLETED', final_payment_date = null");
    expect(sql).toContain('project_payment_entries_reconcile_paid_stage');
    expect(sql).toContain('deposit_invoices_reopen_reconcile_paid_stage');
    expect(sql).toContain('quote_versions_lifecycle_reconcile_paid_stage');
  });
});
