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

  it('filters non-UUID forecast rows before bulk forecast updates', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260414_000004_schedule_v2_assign_filter_non_uuid_forecasts.sql'),
      'utf8',
    );

    expect(source).toMatch(/v_uuid_pattern text := '\^\[0-9a-f\]\{8\}/i);
    expect(source).toMatch(/from jsonb_array_elements\(v_target_forecast_payload\)[\s\S]*where coalesce\(forecast_rows\.row_data->>'id', ''\) !~\* v_uuid_pattern/i);
    expect(source).toMatch(/from jsonb_array_elements\(v_target_forecast_payload\) with ordinality as forecast_elements\(row_data, ordinality\)/i);
    expect(source).toMatch(/cross join lateral jsonb_to_record\(forecast_elements\.row_data\) as forecast_rows\([\s\S]*id text,/i);
    expect(source).toMatch(/coalesce\(v_assignment\.forecast_start, v_initial_forecast_start\)/i);
    expect(source).toMatch(/where coalesce\(target_rows\.row_data->>'id', ''\) ~\* v_uuid_pattern/i);
    expect(source).toMatch(/where coalesce\(source_rows\.row_data->>'id', ''\) ~\* v_uuid_pattern/i);
    expect(source).toMatch(/from jsonb_to_recordset\(v_combined_forecast_payload\) as rows\(\s*id uuid/i);
    expect(source).toMatch(/contains non-UUID ids for existing scheduled job updates/i);
  });

  it('guards the assign RPC move return field for new assignments', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260414_000005_schedule_v2_assign_move_record_guard.sql'),
      'utf8',
    );
    const returnBlock = source.match(/return jsonb_build_object\([\s\S]*?\);/i)?.[0] ?? '';

    expect(source).toMatch(/v_return_source_crew_id uuid := null/i);
    expect(source).toMatch(/v_return_source_crew_id := v_move\.source_crew_id/i);
    expect(returnBlock).toMatch(/'source_crew_id', v_return_source_crew_id/i);
    expect(returnBlock).not.toMatch(/v_move\.source_crew_id/i);
    expect(source).toMatch(/where coalesce\(target_rows\.row_data->>'id', ''\) ~\* v_uuid_pattern/i);
    expect(source).toMatch(/where coalesce\(source_rows\.row_data->>'id', ''\) ~\* v_uuid_pattern/i);
    expect(source).toMatch(/cross join lateral jsonb_to_record\(forecast_elements\.row_data\) as forecast_rows\([\s\S]*id text,/i);
    expect(source).toMatch(/coalesce\(v_assignment\.forecast_start, v_initial_forecast_start\)/i);
    expect(source).toMatch(/notify pgrst, 'reload schema'/i);
  });

  it('filters non-UUID forecast rows for assign moves without raising', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260414_000006_schedule_v2_assign_move_forecast_filter.sql'),
      'utf8',
    );

    expect(source).toMatch(/v_uuid_pattern text := '\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$'/i);
    expect(source).toMatch(/from jsonb_array_elements\(v_target_forecast_payload\)[\s\S]*where coalesce\(forecast_rows\.row_data->>'id', ''\) !~\* v_uuid_pattern/i);
    expect(source).toMatch(/from jsonb_array_elements\(v_source_forecast_payload\)[\s\S]*where coalesce\(forecast_rows\.row_data->>'id', ''\) !~\* v_uuid_pattern/i);
    expect(source).toMatch(/where coalesce\(target_rows\.row_data->>'id', ''\) ~\* v_uuid_pattern/i);
    expect(source).toMatch(/where coalesce\(source_rows\.row_data->>'id', ''\) ~\* v_uuid_pattern/i);
    expect(source).toMatch(/from jsonb_to_recordset\(v_combined_forecast_payload\) as rows\(\s*id uuid/i);
    expect(source).not.toMatch(/forecast updates contain non-UUID ids for existing scheduled job updates/i);
    expect(source).toMatch(/'source_crew_id', v_return_source_crew_id/i);
    expect(source).toMatch(/notify pgrst, 'reload schema'/i);
  });
});
