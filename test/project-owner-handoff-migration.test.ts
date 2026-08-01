// @vitest-environment node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260801_000001_project_owner_handoffs_and_enquiry_inactivity.sql'),
  'utf8',
);

const runtimeBootstrap = String.raw`
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;
create table public.portal_users (user_id uuid primary key, role text not null);
create function public.has_portal_access() returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
  select exists (select 1 from public.portal_users where user_id=auth.uid())
$$;
create function public.is_portal_admin() returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
  select exists (
    select 1 from public.portal_users where user_id=auth.uid() and role='admin'
  )
$$;
create table public.projects (
  id uuid primary key,
  name text not null,
  pipeline_stage text not null default 'NEW',
  archived_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.project_operational_states (
  project_id uuid primary key references public.projects(id),
  state text not null default 'ACTIVE',
  waiting_until timestamptz
);
create table public.project_owner_assignments (
  project_id uuid primary key references public.projects(id),
  owner_key text not null constraint project_owner_assignments_owner_key_check
    check (owner_key in ('jordan','jp','joe','bruce')),
  assigned_by uuid,
  assigned_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.project_command_audit (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  command_id uuid not null,
  event_sequence smallint not null default 0,
  event_type text not null,
  actor_user_id uuid,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default clock_timestamp(),
  unique(command_id,event_sequence)
);
create table public.project_notes (
  project_id uuid references public.projects(id), created_at timestamptz,
  updated_at timestamptz, deleted_at timestamptz
);
create table public.audit_events (
  project_id uuid references public.projects(id), created_at timestamptz
);
create table public.email_outbox (
  project_id uuid references public.projects(id), created_at timestamptz,
  sent_at timestamptz
);
create table public.tasks (
  project_id uuid references public.projects(id), created_at timestamptz,
  updated_at timestamptz, completed_at timestamptz
);
create table public.followup_tasks (
  project_id uuid references public.projects(id), created_at timestamptz,
  updated_at timestamptz, completed_at timestamptz
);
create table public.project_manual_actions (
  project_id uuid references public.projects(id), created_at timestamptz,
  updated_at timestamptz, completed_at timestamptz
);
create table public.project_state_events (
  project_id uuid references public.projects(id), occurred_at timestamptz,
  actor_kind text
);
create table public.project_work_item_events (
  project_id uuid references public.projects(id), occurred_at timestamptz,
  actor_kind text
);
create table public.project_confirmation_events (
  project_id uuid references public.projects(id), occurred_at timestamptz,
  recorded_at timestamptz, actor_kind text
);
create table public.project_work_items (
  project_id uuid references public.projects(id), origin text,
  created_at timestamptz, updated_at timestamptz, completed_at timestamptz,
  cancelled_at timestamptz, created_by uuid, updated_by uuid,
  completed_by uuid, cancelled_by uuid
);
create table public.estimates (
  project_id uuid references public.projects(id), created_at timestamptz,
  updated_at timestamptz
);
create table public.quotes (
  id uuid primary key, project_id uuid references public.projects(id),
  created_at timestamptz
);
create table public.quote_versions (
  quote_id uuid references public.quotes(id), created_at timestamptz,
  updated_at timestamptz, sent_at timestamptz
);
create table public.quote_send_logs (
  project_id uuid references public.projects(id), created_at timestamptz,
  sent_at timestamptz
);
create table public.deposit_invoices (
  project_id uuid references public.projects(id), created_at timestamptz,
  updated_at timestamptz, sent_at timestamptz
);
create table public.site_visit_events (
  project_id uuid references public.projects(id), created_at timestamptz,
  updated_at timestamptz
);
create table public.scheduled_jobs (
  job_id uuid references public.projects(id), created_at timestamptz,
  updated_at timestamptz, actual_start timestamptz, actual_finish timestamptz,
  client_update_ack_at timestamptz
);
create table public.design_package_requests (
  project_id uuid references public.projects(id), created_at timestamptz,
  updated_at timestamptz, requested_at timestamptz, started_at timestamptz,
  completed_at timestamptz, cancelled_at timestamptz
);
create table public.project_running_job_meta (
  project_id uuid references public.projects(id), created_at timestamptz,
  updated_at timestamptz, materials_ordered_at timestamptz,
  roofing_ordered_at timestamptz
);
create table public.file_artifacts (
  project_id uuid references public.projects(id), created_at timestamptz
);
create table public.enquiry_requests (
  project_id uuid references public.projects(id), created_at timestamptz,
  updated_at timestamptz
);
create table public.project_task_checks (
  project_id uuid references public.projects(id), completed_at timestamptz
);
`;

describe('Project owner handoff and Enquiry inactivity migration', () => {
  it('adds Ellen and Dave without automating phase changes', () => {
    expect(migration).toContain("owner_key in ('ellen','jordan','jp','joe','bruce','dave')");
    expect(migration).toContain("values (new.id, 'ellen'");
    expect(migration).toContain('active Enquiry projects must be owned by Ellen');
    expect(migration).not.toMatch(/update\s+public\.projects\s+set\s+pipeline_stage/i);
  });

  it('backfills only active, non-archived Enquiry ownership', () => {
    expect(migration).toContain("upper(btrim(coalesce(project.pipeline_stage::text, ''))) in");
    expect(migration).toContain("'NEW','CONTACTED'");
    expect(migration).toContain("coalesce(state.state, 'ACTIVE') in ('ACTIVE','WAITING')");
    expect(migration).toContain('project.archived_at is null');
    expect(migration).toContain('project_owner_enquiry_policy_backfilled');
  });

  it('keeps inactivity review read-only and evidence-backed', () => {
    expect(migration).toContain('project_enquiry_inactivity_report_v1');
    expect(migration).toContain("event.actor_kind = 'STAFF'");
    expect(migration).toContain("confirmation.actor_kind = 'STAFF'");
    expect(migration).toContain("item.origin = 'MANUAL'");
    expect(migration).toContain('protected_by_future_wait');
    expect(migration).toContain('evidence_fingerprint');
    expect(migration).not.toContain('project_enquiry_close_inactive');
  });

  it('keeps the report private to administrators and service operations', () => {
    expect(migration).toContain('not public.is_portal_admin()');
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toMatch(
      /grant execute on function public\.project_enquiry_inactivity_report_v1\([\s\S]*?\) to authenticated, service_role;/,
    );
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it('executes the owner policy and read-only report against a database', async () => {
    const database = new PGlite();
    const staleProjectId = '11111111-1111-4111-8111-111111111111';
    const recentProjectId = '22222222-2222-4222-8222-222222222222';
    try {
      await database.exec(runtimeBootstrap);
      await database.exec(migration);
      await database.exec(`
        set "request.jwt.claim.role"='service_role';
        insert into public.projects(id,name,pipeline_stage,created_at,updated_at)
        values
          ('${staleProjectId}','Stale Enquiry','NEW','2026-06-01T00:00:00Z','2026-06-01T00:00:00Z'),
          ('${recentProjectId}','Recently handled','CONTACTED','2026-06-01T00:00:00Z','2026-06-01T00:00:00Z');
        insert into public.project_operational_states(project_id,state)
        values ('${staleProjectId}','ACTIVE'),('${recentProjectId}','ACTIVE');
        insert into public.project_notes(project_id,created_at,updated_at)
        values ('${recentProjectId}','2026-07-25T00:00:00Z','2026-07-25T00:00:00Z');
      `);

      const owners = await database.query<{ owner_key: string }>(`
        select owner_key from public.project_owner_assignments
        where project_id in ('${staleProjectId}','${recentProjectId}')
        order by project_id
      `);
      expect(owners.rows).toEqual([{ owner_key: 'ellen' }, { owner_key: 'ellen' }]);

      const report = await database.query<{
        project_id: string;
        pipeline_stage: string;
        owner_key: string;
        last_activity_source: string;
      }>(`
        select project_id,pipeline_stage,owner_key,last_activity_source
        from public.project_enquiry_inactivity_report_v1(
          '2026-08-01T00:00:00Z', 30
        )
      `);
      expect(report.rows).toEqual([
        {
          project_id: staleProjectId,
          pipeline_stage: 'new',
          owner_key: 'ellen',
          last_activity_source: 'project_record',
        },
      ]);

      const project = await database.query<{ pipeline_stage: string }>(`
        select pipeline_stage from public.projects where id='${staleProjectId}'
      `);
      expect(project.rows[0]?.pipeline_stage).toBe('NEW');

      const adminId = '33333333-3333-4333-8333-333333333333';
      await database.exec(`
        set "request.jwt.claim.sub"='${adminId}';
        insert into public.portal_users(user_id,role) values ('${adminId}','admin');
      `);
      await expect(
        database.query(`
          select * from public.project_command_set_owner(
            '${staleProjectId}','jordan','44444444-4444-4444-8444-444444444444',null
          )
        `),
      ).rejects.toThrow(/must be owned by Ellen/i);

      await database.exec(`
        update public.projects set pipeline_stage='SITE_VISIT'
        where id='${staleProjectId}'
      `);
      const proposalHandoff = await database.query<{ owner_key: string }>(`
        select owner_key from public.project_command_set_owner(
          '${staleProjectId}',
          'jordan',
          '55555555-5555-4555-8555-555555555555',
          (select updated_at from public.project_owner_assignments where project_id='${staleProjectId}')
        )
      `);
      expect(proposalHandoff.rows[0]?.owner_key).toBe('jordan');

      await database.exec(`
        update public.projects set pipeline_stage='DEPOSIT'
        where id='${staleProjectId}'
      `);
      const deliveryHandoff = await database.query<{ owner_key: string }>(`
        select owner_key from public.project_command_set_owner(
          '${staleProjectId}',
          'dave',
          '66666666-6666-4666-8666-666666666666',
          (select updated_at from public.project_owner_assignments where project_id='${staleProjectId}')
        )
      `);
      expect(deliveryHandoff.rows[0]?.owner_key).toBe('dave');
    } finally {
      await database.close();
    }
  });
});
