import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('schedule v2 repair migrations', () => {
  it('backfills missing crew queue items without deleting schedule data', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260414_000002_schedule_v2_backfill_missing_queue_items.sql'),
      'utf8',
    );

    expect(source).toMatch(/from public\.scheduled_jobs sj/i);
    expect(source).toMatch(/not exists\s*\(\s*select 1\s*from public\.crew_schedule_items csi/i);
    expect(source).toMatch(/insert into public\.crew_schedule_items/i);
    expect(source).toMatch(/row_number\(\) over\s*\(\s*partition by sj\.crew_id/i);
    expect(source).toMatch(/crew_tail_positions\.max_position \+ orphaned_jobs\.repair_order/i);
    expect(source).not.toMatch(/\bdelete\s+from\s+public\.(scheduled_jobs|crew_schedule_items)\b/i);
    expect(source).not.toMatch(/\bupdate\s+public\.(scheduled_jobs|crew_schedule_items)\b/i);
  });

  it('persists initial forecast dates for newly assigned scheduled jobs', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260414_000003_schedule_v2_assign_new_job_initial_forecast.sql'),
      'utf8',
    );

    expect(source).toMatch(/from jsonb_to_record\(p_assignment\) as payload\([\s\S]*forecast_start date,[\s\S]*forecast_end_exclusive date/i);
    expect(source).toMatch(/insert into public\.scheduled_jobs \([\s\S]*forecast_start,[\s\S]*forecast_end_exclusive,[\s\S]*forecast_duration_days/i);
    expect(source).toMatch(/values \([\s\S]*v_assignment\.forecast_start,[\s\S]*v_assignment\.forecast_end_exclusive,[\s\S]*v_assignment\.forecast_duration_days/i);
    expect(source).toMatch(/notify pgrst, 'reload schema'/i);
  });
});
