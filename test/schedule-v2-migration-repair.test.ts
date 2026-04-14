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
});
