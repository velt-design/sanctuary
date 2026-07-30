import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260730_000001_marketing_conversion_delivery.sql',
  ),
  'utf8',
);

describe('marketing conversion delivery migration contract', () => {
  it('applies the outbox, trigger, backfill, and RPC grants atomically', () => {
    expect(migration.trimStart()).toMatch(/^--[\s\S]*?\nbegin;/i);
    expect(migration.trimEnd()).toMatch(/notify pgrst, 'reload schema';\s+commit;$/i);
  });

  it('queues only downstream lifecycle audit events and preserves nearby commits', () => {
    expect(migration).toContain('create table public.marketing_conversion_deliveries');
    expect(migration).toContain('audit_events_enqueue_marketing_conversion_delivery');
    expect(migration).toContain("'marketing.site_visit_booked'");
    expect(migration).toContain("'marketing.quote_accepted'");
    expect(migration).toContain("'marketing.deposit_received'");
    expect(migration).toContain("'marketing.project_lost'");
    expect(migration).not.toContain("'marketing.lead_submitted'");
    expect(migration).toContain("event.created_at >= now() - interval '72 hours'");
  });

  it('captures immutable database occurrence times without backfilling legacy terminal rows', () => {
    expect(migration).toContain(
      'add column if not exists deposit_received_at timestamptz null',
    );
    expect(migration).toContain(
      'add column if not exists confirmed_at timestamptz null',
    );
    expect(migration).toContain('projects_capture_deposit_received_at');
    expect(migration).toContain('site_visit_events_capture_confirmed_at');
    expect(migration.match(/then clock_timestamp\(\)/g)).toHaveLength(2);
    expect(migration).toContain('new.pipeline_stage::text');
    expect(migration).toContain('new.status::text');
    expect(migration).toContain(
      'new.deposit_received_at := old.deposit_received_at',
    );
    expect(migration).toContain('new.confirmed_at := old.confirmed_at');
    expect(migration).not.toMatch(
      /update\s+public\.projects[\s\S]*set\s+deposit_received_at/i,
    );
    expect(migration).not.toMatch(
      /update\s+public\.site_visit_events[\s\S]*set\s+confirmed_at/i,
    );
  });

  it('uses RLS, service-role-only RPCs and leased skip-locked claims', () => {
    expect(migration).toContain(
      'alter table public.marketing_conversion_deliveries enable row level security',
    );
    expect(migration).toMatch(/for update skip locked/i);
    expect(migration).toContain("status = 'PROCESSING'");
    expect(migration).toContain("last_error_code = 'MAX_ATTEMPTS_EXHAUSTED'");
    expect(migration).toContain(
      'where delivery.attempt_count >= delivery.max_attempts',
    );
    expect(migration).toContain(
      'where delivery.attempt_count < delivery.max_attempts',
    );
    expect(migration).toContain('and delivery.lease_token = p_lease_token');
    expect(migration).toContain(
      'grant execute on function public.marketing_conversion_delivery_claim(integer, integer)',
    );
    expect(migration).toContain(
      'grant execute on function public.marketing_conversion_delivery_complete(',
    );
    expect(migration).toContain('to service_role');
  });
});
