// @vitest-environment node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260730_000001_legacy_project_task_retirement.sql',
  ),
  'utf8',
);

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), 'utf8');
}

describe('legacy project-task retirement migration', () => {
  it('preserves historical rows while freezing authenticated task-check writes', () => {
    expect(migration).toContain('from public.project_task_checks task');
    expect(migration).toContain('insert into public.project_running_job_meta');
    expect(migration).toContain(
      "set_config('sanctuary.running_job_fact_command', 'allowed', true)",
    );
    expect(migration).toContain(
      'revoke insert, update, delete on table public.project_task_checks',
    );
    expect(migration).toContain('create policy project_task_checks_staff_select');
    expect(migration).not.toMatch(/drop\s+table[^;]*project_task_checks/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.project_task_checks/i);
  });

  it('makes specialist Running Jobs facts available to every project', () => {
    const commandStart = migration.indexOf(
      'create or replace function public.project_running_job_fact_command',
    );
    const commandEnd = migration.indexOf(
      'revoke insert, update, delete on table public.project_task_checks',
    );
    const command = migration.slice(commandStart, commandEnd);

    expect(commandStart).toBeGreaterThan(-1);
    expect(command).toContain("'RUNNING_JOB_FACT'");
    expect(command).toContain("'RUNNING_JOB_FACT_SET'");
    expect(command).toContain('p_expected_row_version');
    expect(command).not.toContain('project_work_items_assert_v2');
  });

  it('keeps parent project cascades usable without allowing direct evidence deletes', () => {
    expect(migration).toContain(
      'create or replace function public.project_work_items_append_only_guard()',
    );
    expect(migration).toMatch(
      /tg_op = 'DELETE' and not exists \([\s\S]*?from public\.projects project[\s\S]*?project\.id = old\.project_id/,
    );
    expect(migration).toContain(
      "raise exception '% is append-only', tg_table_name",
    );
    expect(migration).toContain(
      "raise exception 'running-job fact rows cannot be deleted directly'",
    );
    expect(migration).toContain(
      'old.project_id is distinct from new.project_id',
    );
  });

  it('retires the two legacy task command entrypoints', () => {
    expect(migration).toContain(
      'revoke execute on function public.project_command_action(',
    );
    expect(migration).toContain(
      'revoke execute on function public.project_command_sync_design_task(',
    );
  });
});

describe('retired runtime ownership', () => {
  it.each([
    'apps/portal/lib/runningJobs/server.ts',
    'apps/portal/lib/runningJobs/writeOps.ts',
    'apps/portal/lib/commercial/acceptQuote.ts',
    'apps/portal/lib/invoices/server.ts',
  ])('%s no longer reads or writes project_task_checks', (file) => {
    expect(source(file)).not.toContain('project_task_checks');
  });
});
