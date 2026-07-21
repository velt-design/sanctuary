import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260720_000008_project_command_centre_stage2.sql'),
  'utf8',
);

describe('project command centre Stage 2 migration', () => {
  it('promotes source tasks and creates every canonical record', () => {
    for (const table of [
      'tasks',
      'followup_plans',
      'followup_tasks',
      'project_role_assignments',
      'project_manual_actions',
      'project_action_controls',
      'project_primary_action_selections',
      'project_command_audit',
      'project_action_versions',
    ]) {
      expect(sql).toMatch(new RegExp(`create table if not exists public\\.${table}\\s*\\(`, 'i'));
    }
    expect(sql).toContain('alter table public.tasks add column if not exists updated_at');
    expect(sql).toContain('alter table public.followup_tasks add column if not exists updated_at');
  });

  it('allows portal reads but withholds direct canonical writes', () => {
    for (const table of [
      'tasks',
      'followup_plans',
      'followup_tasks',
      'project_role_assignments',
      'project_manual_actions',
      'project_action_controls',
      'project_primary_action_selections',
      'project_command_audit',
      'project_action_versions',
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on public.${table} from anon, authenticated`);
      expect(sql).toContain(`grant select on public.${table} to authenticated`);
    }
  });

  it('keeps commands security-definer, idempotent and optimistic', () => {
    expect(sql).toMatch(/create or replace function public\.project_command_set_owner[\s\S]*security definer/i);
    expect(sql).toMatch(/create or replace function public\.project_command_action[\s\S]*security definer/i);
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('where command_id = p_command_id');
    expect(sql).toContain('command id was already used for a different command');
    expect(sql).toContain("raise exception 'owner assignment changed' using errcode = '40001'");
    expect(sql).toContain("raise exception 'action changed' using errcode = '40001'");
    expect(sql).toContain("raise exception 'available project actions changed' using errcode = '40001'");
    expect(sql).toContain('tasks_bump_project_action_version');
    expect(sql).toContain('command must target the current primary action');
    expect(sql).toContain('project_command_outranking_hash');
    expect(sql).toContain('has_selection_conflict := current_outranking_hash');
    expect(sql).toContain("and not (actor_role='admin' and p_command='resolve_conflict')");
    expect(sql).toContain("if next_count >= 3 and reason_value is null");
    expect(sql).toContain("if actor_role <> 'admin' then raise exception 'admin access required'");
  });

  it('backfills only active, unambiguous owners and leaves estimating uninferred', () => {
    expect(sql).toContain('au.deleted_at is null');
    expect(sql).toContain('au.banned_until is null or au.banned_until <= now()');
    expect(sql).toContain('having count(distinct dpr.assigned_designer)=1');
    expect(sql).not.toMatch(/select[^;]+['"]estimating['"]/i);
    expect(sql).toContain('Creator/author/sender fields are intentionally excluded');
  });

  it('makes the legacy project fields an internal transactional Auckland projection', () => {
    expect(sql).toContain("next_action_date=(p_due_at at time zone 'Pacific/Auckland')::date");
    expect(sql).toContain("follow_up_date=(p_due_at at time zone 'Pacific/Auckland')::date");
    expect(sql).toContain('revoke all on function public.project_command_sync_projection(uuid,text,text,timestamptz) from public, anon, authenticated, service_role');
    expect(sql).toContain('perform public.project_command_sync_projection');
    expect(sql).toContain('tasks_refresh_project_action_projection');
    expect(sql).toContain('followup_tasks_refresh_project_action_projection');
    expect(sql).not.toContain('grant execute on function public.project_command_sync_projection');
  });

  it('keeps design-package task writes behind a narrow staff command', () => {
    expect(sql).toMatch(/create or replace function public\.project_command_sync_design_task[\s\S]*security definer/i);
    expect(sql).toContain("p_idempotency_key not like 'design\\_request:'");
    expect(sql).toContain('grant execute on function public.project_command_sync_design_task');
  });
});
