import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260721_000001_project_command_single_owner.sql'),
  'utf8',
);

describe('project command centre single-owner migration', () => {
  it('creates one assignment per project with the approved owner roster', () => {
    expect(sql).toMatch(/create table if not exists public\.project_owner_assignments\s*\(/i);
    expect(sql).toContain('project_id uuid primary key');
    expect(sql).toContain("owner_key in ('jordan','jp','joe','bruce')");
    expect(sql).toContain('alter table public.project_owner_assignments enable row level security');
    expect(sql).toContain('grant select on table public.project_owner_assignments to authenticated');
  });

  it('backfills deterministically without inventing an unknown owner', () => {
    expect(sql).toContain("case assignment.role when 'sales' then 0 when 'design' then 1 else 2 end");
    expect(sql).toContain('where owner_key is not null');
    expect(sql).toContain('where owner_rank = 1');
    expect(sql).toContain('on conflict (project_id) do nothing');
  });

  it('replaces the role writer with an idempotent admin-only owner command', () => {
    expect(sql).toContain('drop function if exists public.project_command_set_owner(uuid,text,uuid,uuid,timestamptz)');
    expect(sql).toMatch(/create or replace function public\.project_command_set_owner\([\s\S]*p_owner_key text[\s\S]*security definer/i);
    expect(sql).toContain("raise exception 'project owner change requires admin'");
    expect(sql).toContain("raise exception 'owner assignment changed' using errcode = '40001'");
    expect(sql).toContain("audit.event_type = 'project_owner_changed'");
    expect(sql).toContain("jsonb_build_object('ownerKey', p_owner_key)");
    expect(sql).toContain('pg_advisory_xact_lock');
  });
});
