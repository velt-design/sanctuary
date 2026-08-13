import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260813000002_commercial_admin_action_idempotency.sql'),
  'utf8',
).toLowerCase();

describe('commercial admin action idempotency migration', () => {
  it('makes admin invoice creation and payment recording replay-safe', () => {
    expect(sql).toContain('project_payment_entries_client_intent_unique');
    expect(sql).toContain('deposit_invoices_admin_client_intent_unique');
    expect(sql).toContain('commercial_record_project_payment_entry');
    expect(sql).toContain('commercial_create_admin_invoice_idempotent');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('admin_creation_remaining_before_inc_gst_cents');
    expect(sql).toContain('admin_creation_remaining_after_inc_gst_cents');
    expect(sql).toContain('v_existing.admin_creation_planned_item_count');
  });
});
