import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260722_000005_estimate_cost_actuals.sql'),
  'utf8',
).toLowerCase();

describe('estimate actual-cost migration', () => {
  it('creates one estimate-owned calibration record with non-negative cost constraints', () => {
    expect(migrationSql).toContain('estimate_id uuid primary key references public.estimates(id) on delete cascade');
    for (const field of [
      'materials_ex_gst',
      'install_ex_gst',
      'overhead_ex_gst',
      'travel_ex_gst',
      'extras_ex_gst',
      'crew_hours',
    ]) {
      expect(migrationSql, field).toContain(`check (${field} >= 0)`);
    }
  });

  it('keeps reads and writes staff/RLS protected without delete access', () => {
    expect(migrationSql).toContain('grant select, insert, update on table public.estimate_cost_actuals to authenticated');
    expect(migrationSql).not.toContain('grant delete');
    expect(migrationSql).not.toContain('to anon');
    expect(migrationSql).toContain('alter table public.estimate_cost_actuals enable row level security');
    expect(migrationSql).toContain('using (public.has_portal_access())');
    expect(migrationSql).toContain('updated_by = auth.uid()');
  });
});
