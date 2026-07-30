// @vitest-environment node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migration = readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260729_000002_project_work_items_v2.sql',
  ),
  'utf8',
);
const schemaCacheRepair = readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260729_000003_project_work_items_v2_schema_cache.sql',
  ),
  'utf8',
);
const legacyTaskRetirement = readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260730_000001_legacy_project_task_retirement.sql',
  ),
  'utf8',
);

const bootstrap = String.raw`
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  deleted_at timestamptz,
  banned_until timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := clock_timestamp(); return new; end
$$;
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.portal_users (
  user_id uuid primary key references auth.users(id),
  role text not null
);
create function public.has_portal_access() returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
  select exists (
    select 1 from public.portal_users where user_id = auth.uid()
  )
$$;
create function public.is_portal_admin() returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
  select exists (
    select 1 from public.portal_users
    where user_id = auth.uid() and role = 'admin'
  )
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id),
  name text not null,
  quote_ref text,
  region text,
  site_address text,
  pipeline_stage text not null default 'NEW',
  notes text,
  archived_at timestamptz,
  next_action text,
  next_action_type text,
  next_action_at timestamptz,
  next_action_date date,
  follow_up_date date,
  deposit_paid_date date,
  final_payment_date date,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();
create table public.project_owner_assignments (
  project_id uuid primary key references public.projects(id),
  owner_key text not null,
  updated_at timestamptz not null default clock_timestamp()
);
create table public.enquiry_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id),
  contact_id uuid references public.contacts(id),
  created_at timestamptz not null default clock_timestamp()
);
create table public.nz_holidays (
  date date primary key,
  name text not null,
  scope text not null,
  region text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.company_closures (
  date date primary key,
  name text not null,
  region text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.projects(id),
  status text,
  actual_finish date
);
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id)
);
create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id),
  version_number integer not null,
  status text not null,
  sent_at timestamptz,
  expires_at date
);
create table public.quote_send_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  quote_version_id uuid not null references public.quote_versions(id),
  status text not null,
  sent_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create table public.deposit_invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  status text not null
);
create table public.project_running_job_meta (
  project_id uuid primary key references public.projects(id) on delete cascade,
  lights_status text,
  notes text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create trigger project_running_job_meta_set_updated_at
before update on public.project_running_job_meta
for each row execute function public.set_updated_at();
create table public.project_task_checks (
  project_id uuid not null references public.projects(id) on delete cascade,
  task_key text not null,
  completed_at timestamptz not null default clock_timestamp(),
  completed_by uuid,
  primary key(project_id,task_key)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  type text not null,
  status text not null,
  title text not null,
  details text,
  due_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  completed_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);
create table public.followup_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  status text
);
create table public.followup_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.followup_plans(id),
  project_id uuid not null references public.projects(id),
  status text,
  due_at timestamptz
);
create table public.project_manual_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id)
);
create table public.project_action_controls (
  project_id uuid not null references public.projects(id),
  source_kind text not null,
  source_id uuid not null,
  primary key(source_kind,source_id)
);
create table public.project_primary_action_selections (
  project_id uuid primary key references public.projects(id)
);
create table public.project_action_versions (
  project_id uuid primary key references public.projects(id),
  version bigint not null default 0
);
create table public.project_command_audit (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  command_id uuid not null,
  event_sequence smallint not null default 0,
  event_type text not null,
  source_kind text,
  source_id uuid,
  actor_user_id uuid,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default clock_timestamp(),
  unique(command_id,event_sequence)
);
`;

describe('Project Work Items V2 migration', () => {
  const database = new PGlite();
  const actorId = '11111111-1111-4111-8111-111111111111';
  const staffId = '10101010-1010-4010-8010-101010101010';
  const contactId = '22222222-2222-4222-8222-222222222222';
  const projectId = '33333333-3333-4333-8333-333333333333';

  beforeAll(async () => {
    await database.waitReady;
    await database.exec(bootstrap);
    await database.exec(migration);
    await database.exec(migration);
    await database.exec(schemaCacheRepair);
    await database.exec(schemaCacheRepair);
    await database.exec(`
      insert into auth.users(id,email)
      values
        ('${actorId}','admin@example.invalid'),
        ('${staffId}','staff@example.invalid');
      insert into public.portal_users(user_id,role)
      values
        ('${actorId}','admin'),
        ('${staffId}','staff');
      select set_config('request.jwt.claim.sub','${actorId}',false);
      insert into public.contacts(id,name,email)
      values ('${contactId}','Fixture Customer',null);
    `);
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it('applies atomically and initializes only governed new projects', async () => {
    const result = await database.query<{
      project: Record<string, unknown>;
      replayed: boolean;
    }>(`
      select * from public.project_create_v2(
        '${projectId}',
        '${contactId}',
        'Fixture Project',
        null,
        'Auckland',
        'Fixture Site'
      )
    `);
    expect(result.rows[0]?.project.id).toBe(projectId);
    expect(result.rows[0]?.replayed).toBe(false);

    const state = await database.query<{
      state: string;
      status: string;
      blocked_reason: string | null;
    }>(`
      select state.state,item.status,item.blocked_reason
      from public.project_operational_states state
      join public.project_work_items item using(project_id)
      where state.project_id='${projectId}'
    `);
    expect(state.rows).toEqual([expect.objectContaining({
      state: 'ACTIVE',
      status: 'BLOCKED',
      blocked_reason: 'Customer email address is missing',
    })]);
    const replay = await database.query<{ replayed: boolean }>(`
      select replayed from public.project_create_v2(
        '${projectId}',
        '${contactId}',
        'Fixture Project',
        null,
        'Auckland',
        'Fixture Site'
      )
    `);
    expect(replay.rows[0]?.replayed).toBe(true);
    const item = await database.query<{ id: string; row_version: number }>(`
      select id,row_version from public.project_work_items
      where project_id='${projectId}' and status='BLOCKED'
    `);
    await expect(database.query(`
      select public.project_work_item_command(
        '${projectId}',
        '77777777-7777-4777-8777-777777777777',
        'UNBLOCK',
        jsonb_build_object(
          'workItemId','${item.rows[0]?.id}',
          'expectedRowVersion',${item.rows[0]?.row_version}
        )
      )
    `)).rejects.toThrow(/LEAD_EMAIL_REQUIRED/);
    await expect(database.query(`
      select public.project_confirmation_command(
        '${projectId}',
        '37373737-3737-4737-8737-373737373737',
        'RECORD_FIRST_ENQUIRY_EMAIL_SENT',
        jsonb_build_object('occurredAt',clock_timestamp())
      )
    `)).rejects.toThrow(/LEAD_EMAIL_REQUIRED/);
  });

  it('does not treat an existing legacy project as a V2 create replay', async () => {
    const legacyReplayId = '30303030-3030-4030-8030-303030303030';
    await database.exec(`
      insert into public.projects(
        id,contact_id,name,quote_ref,region,site_address
      ) values (
        '${legacyReplayId}',
        '${contactId}',
        'Legacy replay fixture',
        'Q-LEGACY',
        'Auckland',
        'Legacy site'
      )
    `);
    await expect(database.query(`
      select * from public.project_create_v2(
        '${legacyReplayId}',
        '${contactId}',
        'Legacy replay fixture',
        'Q-LEGACY',
        'Auckland',
        'Legacy site'
      )
    `)).rejects.toThrow(/existing legacy projects cannot become V2/i);
    const marker = await database.query<{ marked: boolean }>(`
      select exists(
        select 1
        from public.project_work_model_versions
        where project_id='${legacyReplayId}'
      ) as marked
    `);
    expect(marker.rows[0]?.marked).toBe(false);
  });

  it('uses the current contact email for first-email confirmation and unblock', async () => {
    const emailGuardProjectId = '39393939-3939-4939-8939-393939393939';
    await database.exec(`
      select * from public.project_create_v2(
        '${emailGuardProjectId}',
        '${contactId}',
        'Email guard fixture',
        null,
        'Auckland',
        null
      );
      update public.contacts
      set email='customer@example.invalid'
      where id='${contactId}';
    `);
    const item = await database.query<{ id: string; row_version: number }>(`
      select id,row_version
      from public.project_work_items
      where project_id='${emailGuardProjectId}'
        and source_key='lead:first-email:${emailGuardProjectId}:v1'
    `);
    await database.query(`
      select public.project_work_item_command(
        '${emailGuardProjectId}',
        '40404040-4040-4040-8040-404040404040',
        'BLOCK',
        jsonb_build_object(
          'workItemId','${item.rows[0]?.id}',
          'expectedRowVersion',${item.rows[0]?.row_version},
          'reason','Waiting for a corrected project brief'
        )
      )
    `);
    await database.exec(`
      update public.contacts
      set email=null
      where id='${contactId}'
    `);
    const blocked = await database.query<{ row_version: number }>(`
      select row_version
      from public.project_work_items
      where id='${item.rows[0]?.id}'
    `);
    await expect(database.query(`
      select public.project_work_item_command(
        '${emailGuardProjectId}',
        '41414141-4141-4141-8141-414141414141',
        'UNBLOCK',
        jsonb_build_object(
          'workItemId','${item.rows[0]?.id}',
          'expectedRowVersion',${blocked.rows[0]?.row_version}
        )
      )
    `)).rejects.toThrow(/LEAD_EMAIL_REQUIRED/);
    await expect(database.query(`
      select public.project_confirmation_command(
        '${emailGuardProjectId}',
        '42424242-4242-4242-8242-424242424242',
        'RECORD_FIRST_ENQUIRY_EMAIL_SENT',
        jsonb_build_object('occurredAt',clock_timestamp())
      )
    `)).rejects.toThrow(/LEAD_EMAIL_REQUIRED/);
    await database.exec(`
      update public.contacts
      set email='customer@example.invalid'
      where id='${contactId}'
    `);
  });

  it('activates the marketing path only after its enquiry row exists', async () => {
    const marketingProjectId = '12121212-1212-4212-8212-121212121212';
    await database.exec(`
      insert into public.projects(id,contact_id,name)
      values ('${marketingProjectId}','${contactId}','Marketing fixture');
    `);
    const before = await database.query<{ marked: boolean }>(`
      select exists(
        select 1 from public.project_work_model_versions
        where project_id='${marketingProjectId}'
      ) as marked
    `);
    expect(before.rows[0]?.marked).toBe(false);
    await database.exec(`
      insert into public.enquiry_requests(project_id,contact_id)
      values ('${marketingProjectId}','${contactId}')
    `);
    const after = await database.query<{ marked: boolean }>(`
      select exists(
        select 1 from public.project_work_model_versions
        where project_id='${marketingProjectId}'
      ) as marked
    `);
    expect(after.rows[0]?.marked).toBe(true);

    const existingProjectId = '13131313-1313-4313-8313-131313131313';
    await database.exec(`
      insert into public.projects(id,contact_id,name,created_at)
      values (
        '${existingProjectId}',
        '${contactId}',
        'Existing fixture',
        '2025-01-01T00:00:00Z'
      );
      insert into public.enquiry_requests(project_id,contact_id)
      values ('${existingProjectId}','${contactId}');
    `);
    const existing = await database.query<{ marked: boolean }>(`
      select exists(
        select 1 from public.project_work_model_versions
        where project_id='${existingProjectId}'
      ) as marked
    `);
    expect(existing.rows[0]?.marked).toBe(false);
  });

  it('reconciles missing email and enforces semantic cadence completion', async () => {
    await database.exec(`
      update public.contacts
      set email='customer@example.invalid'
      where id='${contactId}'
    `);
    const unblocked = await database.query<{ status: string }>(`
      select status from public.project_work_items
      where project_id='${projectId}'
        and source_type='LEAD_CADENCE'
        and status in ('OPEN','BLOCKED')
    `);
    expect(unblocked.rows[0]?.status).toBe('OPEN');

    await database.query(`
      select public.project_confirmation_command(
        '${projectId}',
        '44444444-4444-4444-8444-444444444444',
        'RECORD_FIRST_ENQUIRY_EMAIL_SENT',
        '{"occurredAt":"2026-07-29T01:00:00Z"}'::jsonb
      )
    `);
    const cadence = await database.query<{ deadline_policy: string }>(`
      select deadline_policy from public.project_work_items
      where project_id='${projectId}' and status='OPEN'
    `);
    expect(cadence.rows[0]?.deadline_policy).toBe('LEAD_FOLLOW_UP_V1');
  });

  it('atomically replaces a decision review with explicit manual work', async () => {
    const replaceProjectId = '31313131-3131-4131-8131-313131313131';
    await database.exec(`
      select * from public.project_create_v2(
        '${replaceProjectId}',
        '${contactId}',
        'Review replacement fixture',
        null,
        'Auckland',
        null
      );
      select public.project_confirmation_command(
        '${replaceProjectId}',
        '32323232-3232-4232-8232-323232323232',
        'RECORD_FIRST_ENQUIRY_EMAIL_SENT',
        jsonb_build_object('occurredAt',clock_timestamp())
      );
      select public.project_confirmation_command(
        '${replaceProjectId}',
        '34343434-3434-4434-8434-343434343434',
        'RECORD_ENQUIRY_FOLLOW_UP_EMAIL_SENT',
        jsonb_build_object('occurredAt',clock_timestamp())
      );
    `);
    const review = await database.query<{ id: string; row_version: number }>(`
      select id,row_version
      from public.project_work_items
      where project_id='${replaceProjectId}'
        and deadline_policy='LEAD_CLOSE_REVIEW_V1'
        and status='OPEN'
    `);
    const replacementIntent = `
      select public.project_work_item_command(
        '${replaceProjectId}',
        '35353535-3535-4535-8535-353535353535',
        'REPLACE_REVIEW',
        jsonb_build_object(
          'workItemId','${review.rows[0]?.id}',
          'expectedRowVersion',${review.rows[0]?.row_version},
          'reason','Customer asked for more time',
          'title','Email customer after revised timing',
          'responsibilityArea','CUSTOMER',
          'dueAt','2026-08-05T05:00:00Z',
          'priority','NORMAL'
        )
      ) as result
    `;
    const replaced = await database.query<{
      result: {
        work_item_id: string;
        replaced_work_item_id: string;
        replayed: boolean;
      };
    }>(replacementIntent);
    expect(replaced.rows[0]?.result).toEqual(expect.objectContaining({
      replaced_work_item_id: review.rows[0]?.id,
      replayed: false,
    }));

    const items = await database.query<{
      title: string;
      status: string;
      cancellation_reason: string | null;
    }>(`
      select title,status,cancellation_reason
      from public.project_work_items
      where id in (
        '${review.rows[0]?.id}',
        '${replaced.rows[0]?.result.work_item_id}'
      )
      order by title
    `);
    expect(items.rows).toEqual([
      {
        title: 'Email customer after revised timing',
        status: 'OPEN',
        cancellation_reason: null,
      },
      {
        title: 'Review unresponsive enquiry',
        status: 'CANCELLED',
        cancellation_reason: 'Customer asked for more time',
      },
    ]);
    const events = await database.query<{ event_type: string }>(`
      select event_type
      from public.project_work_item_events
      where command_id='35353535-3535-4535-8535-353535353535'
      order by event_sequence
    `);
    expect(events.rows.map((row) => row.event_type)).toEqual([
      'CANCELLED',
      'CREATED',
    ]);

    const replay = await database.query<{
      result: { replayed: boolean };
    }>(replacementIntent);
    expect(replay.rows[0]?.result.replayed).toBe(true);
    const duplicateCount = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from public.project_work_items
      where project_id='${replaceProjectId}'
        and title='Email customer after revised timing'
    `);
    expect(duplicateCount.rows[0]?.count).toBe(1);

    await expect(database.query(`
      select public.project_work_item_command(
        '${replaceProjectId}',
        '36363636-3636-4636-8636-363636363636',
        'REPLACE_REVIEW',
        jsonb_build_object(
          'workItemId','${replaced.rows[0]?.result.work_item_id}',
          'expectedRowVersion',1,
          'reason','Invalid replacement target',
          'title','Should not exist',
          'responsibilityArea','ADMIN',
          'dueAt',clock_timestamp() + interval '1 day'
        )
      )
    `)).rejects.toThrow(/active lead or quote review/i);
  });

  it('keeps legacy writes available only for legacy projects', async () => {
    await expect(database.exec(`
      insert into public.tasks(
        project_id,type,status,title,idempotency_key
      ) values (
        '${projectId}','REVIEW_NEW_LEAD','OPEN','Legacy task','v2-blocked'
      )
    `)).rejects.toThrow(/LEGACY_PROJECT_WORK_WRITE_BLOCKED/);

    const legacyId = '55555555-5555-4555-8555-555555555555';
    await database.exec(`
      insert into public.projects(id,name) values ('${legacyId}','Legacy');
      insert into public.tasks(
        project_id,type,status,title,idempotency_key
      ) values (
        '${legacyId}','REVIEW_NEW_LEAD','OPEN','Legacy task','legacy-allowed'
      )
    `);
    const count = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from public.tasks where project_id='${legacyId}'
    `);
    expect(count.rows[0]?.count).toBe(1);

    await expect(database.exec(`
      update public.tasks
      set project_id='${projectId}'
      where idempotency_key='legacy-allowed'
    `)).rejects.toThrow(/LEGACY_PROJECT_WORK_WRITE_BLOCKED/);

    await database.exec(`
      begin;
      select set_config('sanctuary.legacy_v2_override','allowed',true);
      insert into public.tasks(
        project_id,type,status,title,idempotency_key
      ) values (
        '${projectId}','REVIEW_NEW_LEAD','OPEN',
        'V2 residue','v2-residue'
      );
      commit;
    `);
    await expect(database.exec(`
      delete from public.tasks where idempotency_key='v2-residue'
    `)).rejects.toThrow(/LEGACY_PROJECT_WORK_WRITE_BLOCKED/);
    await expect(database.exec(`
      update public.tasks
      set project_id='${legacyId}'
      where idempotency_key='v2-residue'
    `)).rejects.toThrow(/LEGACY_PROJECT_WORK_WRITE_BLOCKED/);
    await database.exec(`
      delete from public.tasks where idempotency_key='legacy-allowed'
    `);
    const legacyRemaining = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from public.tasks where project_id='${legacyId}'
    `);
    expect(legacyRemaining.rows[0]?.count).toBe(0);
  });

  it('requires admin for legacy archive changes without blocking other edits', async () => {
    const archiveGuardProjectId = '43434343-4343-4343-8343-434343434343';
    await database.exec(`
      insert into public.projects(id,contact_id,name)
      values (
        '${archiveGuardProjectId}',
        '${contactId}',
        'Archive guard fixture'
      );
      select set_config('request.jwt.claim.sub','${staffId}',false);
    `);
    try {
      await database.exec(`
        update public.projects
        set notes='Staff may still edit unrelated project details'
        where id='${archiveGuardProjectId}'
      `);
      await expect(database.exec(`
        update public.projects
        set archived_at=clock_timestamp()
        where id='${archiveGuardProjectId}'
      `)).rejects.toThrow(/archive changes require admin/i);
    } finally {
      await database.exec(`
        select set_config('request.jwt.claim.sub','${actorId}',false)
      `);
    }
    await database.exec(`
      update public.projects
      set archived_at=clock_timestamp()
      where id='${archiveGuardProjectId}';
      update public.projects
      set archived_at=null
      where id='${archiveGuardProjectId}'
    `);
    const project = await database.query<{
      archived_at: string | null;
      notes: string | null;
    }>(`
      select archived_at,notes
      from public.projects
      where id='${archiveGuardProjectId}'
    `);
    expect(project.rows[0]).toEqual({
      archived_at: null,
      notes: 'Staff may still edit unrelated project details',
    });
  });

  it('creates Running Jobs facts with expected version zero', async () => {
    const result = await database.query<{ result: { row_version: number } }>(`
      select public.project_running_job_fact_command(
        '${projectId}',
        '66666666-6666-4666-8666-666666666666',
        'materials_ordered',
        true,
        0
      ) as result
    `);
    expect(result.rows[0]?.result.row_version).toBe(1);
  });

  it('keeps browser roles read-only and reconciliation service-only', async () => {
    const grants = await database.query<{
      staff_command: boolean;
      staff_reconcile: boolean;
      service_reconcile: boolean;
      staff_item_select: boolean;
      staff_item_insert: boolean;
      staff_receipt_select: boolean;
      staff_repair_select: boolean;
      staff_repair_insert: boolean;
      staff_repair_command: boolean;
      service_repair_command: boolean;
      service_model_select: boolean;
      service_state_select: boolean;
    }>(`
      select
        has_function_privilege(
          'authenticated',
          'public.project_work_item_command(uuid,uuid,text,jsonb)',
          'EXECUTE'
        ) as staff_command,
        has_function_privilege(
          'authenticated',
          'public.project_work_item_reconcile(uuid,uuid,text,jsonb)',
          'EXECUTE'
        ) as staff_reconcile,
        has_function_privilege(
          'service_role',
          'public.project_work_item_reconcile(uuid,uuid,text,jsonb)',
          'EXECUTE'
        ) as service_reconcile,
        has_table_privilege(
          'authenticated','public.project_work_items','SELECT'
        ) as staff_item_select,
        has_table_privilege(
          'authenticated','public.project_work_items','INSERT'
        ) as staff_item_insert,
        has_table_privilege(
          'authenticated','public.project_command_receipts','SELECT'
        ) as staff_receipt_select,
        has_table_privilege(
          'authenticated','public.project_work_repair_signals','SELECT'
        ) as staff_repair_select,
        has_table_privilege(
          'authenticated','public.project_work_repair_signals','INSERT'
        ) as staff_repair_insert,
        has_function_privilege(
          'authenticated',
          'public.project_work_quote_repair_signal_command(uuid,uuid,text,uuid,text,text,text)',
          'EXECUTE'
        ) as staff_repair_command,
        has_function_privilege(
          'service_role',
          'public.project_work_quote_repair_signal_command(uuid,uuid,text,uuid,text,text,text)',
          'EXECUTE'
        ) as service_repair_command,
        has_table_privilege(
          'service_role','public.project_work_model_versions','SELECT'
        ) as service_model_select,
        has_table_privilege(
          'service_role','public.project_operational_states','SELECT'
        ) as service_state_select
    `);
    expect(grants.rows[0]).toEqual({
      staff_command: true,
      staff_reconcile: false,
      service_reconcile: true,
      staff_item_select: true,
      staff_item_insert: false,
      staff_receipt_select: false,
      staff_repair_select: true,
      staff_repair_insert: false,
      staff_repair_command: false,
      service_repair_command: true,
      service_model_select: true,
      service_state_select: true,
    });
  });

  it('runs state, queue, and integrity read models through their contracts', async () => {
    const stateProjectId = '14141414-1414-4414-8414-141414141414';
    await database.query(`
      select * from public.project_create_v2(
        '${stateProjectId}',
        '${contactId}',
        'State fixture',
        null,
        'Auckland',
        null
      )
    `);
    const waited = await database.query<{
      result: { row_version: number };
    }>(`
      select public.project_operational_state_command(
        '${stateProjectId}',
        '15151515-1515-4515-8515-151515151515',
        'WAIT',
        jsonb_build_object(
          'expectedRowVersion',1,
          'waitingUntil',clock_timestamp() + interval '10 days',
          'reason','Waiting for customer',
          'cancellationReason','Pause current work while waiting'
        )
      ) as result
    `);
    expect(waited.rows[0]?.result.row_version).toBe(2);
    const activated = await database.query<{
      result: { row_version: number };
    }>(`
      select public.project_operational_state_command(
        '${stateProjectId}',
        '16161616-1616-4616-8616-161616161616',
        'ACTIVATE',
        '{"expectedRowVersion":2}'::jsonb
      ) as result
    `);
    expect(activated.rows[0]?.result.row_version).toBe(3);

    const queue = await database.query<{ project_id: string }>(`
      select project_id from public.project_work_queue_v2(
        clock_timestamp(),
        200
      )
    `);
    expect(queue.rows.some((row) => row.project_id === projectId)).toBe(true);
    const report = await database.query<{
      report: { model_version: number; projection_consistent: boolean };
    }>(`
      select public.project_work_integrity_report_v2(
        '${projectId}'
      ) as report
    `);
    expect(report.rows[0]?.report).toEqual(expect.objectContaining({
      model_version: 2,
      projection_consistent: true,
    }));
  });

  it('returns at most one highest-ranked queue row per project', async () => {
    const queueProjectId = '18181818-1818-4818-8818-181818181818';
    await database.exec(`
      update public.contacts
      set email='customer@example.invalid'
      where id='${contactId}';
      select * from public.project_create_v2(
        '${queueProjectId}',
        '${contactId}',
        'Queue fixture',
        null,
        'Auckland',
        null
      );
      insert into public.project_owner_assignments(project_id,owner_key)
      values ('${queueProjectId}','jordan');
    `);
    await database.query(`
      select public.project_work_item_command(
        '${queueProjectId}',
        '19191919-1919-4919-8919-191919191919',
        'CREATE',
        jsonb_build_object(
          'title','Normal overdue work',
          'responsibilityArea','ADMIN',
          'dueAt',clock_timestamp() - interval '1 day'
        )
      )
    `);
    await database.query(`
      select public.project_work_item_command(
        '${queueProjectId}',
        '20202020-2020-4020-8020-202020202020',
        'CREATE',
        jsonb_build_object(
          'title','Critical future work',
          'responsibilityArea','ADMIN',
          'dueAt',clock_timestamp() + interval '2 days',
          'assigneeUserId','${actorId}',
          'priority','CRITICAL',
          'priorityReason','Fixture priority'
        )
      )
    `);
    const blocked = await database.query<{
      result: { work_item_id: string };
    }>(`
      select public.project_work_item_command(
        '${queueProjectId}',
        '21212121-2121-4121-8121-212121212121',
        'CREATE',
        jsonb_build_object(
          'title','Blocked exception',
          'responsibilityArea','ADMIN',
          'dueAt',clock_timestamp() - interval '2 days'
        )
      ) as result
    `);
    await database.query(`
      select public.project_work_item_command(
        '${queueProjectId}',
        '22222222-2222-4222-8222-222222222223',
        'BLOCK',
        jsonb_build_object(
          'workItemId','${blocked.rows[0]?.result.work_item_id}',
          'expectedRowVersion',1,
          'reason','Fixture blocker'
        )
      )
    `);

    const rows = await database.query<{
      title: string;
      queue_group: string;
      assignee_user_id: string | null;
      project_owner_key: string | null;
    }>(`
      select title,queue_group,assignee_user_id,project_owner_key
      from public.project_work_queue_v2(clock_timestamp(),500)
      where project_id='${queueProjectId}'
    `);
    expect(rows.rows).toEqual([{
      title: 'Critical future work',
      queue_group: 'nextSevenBusinessDays',
      assignee_user_id: actorId,
      project_owner_key: 'jordan',
    }]);
  });

  it('keeps waiting projects free of confirmation and reconciliation work', async () => {
    const inactiveProjectId = '23232323-2323-4323-8323-232323232323';
    const inactiveQuoteId = '24242424-2424-4424-8424-242424242424';
    const inactiveQuoteVersionId = '25252525-2525-4525-8525-252525252525';
    await database.exec(`
      select * from public.project_create_v2(
        '${inactiveProjectId}',
        '${contactId}',
        'Inactive fixture',
        null,
        'Auckland',
        null
      );
      insert into public.quotes(id,project_id)
      values ('${inactiveQuoteId}','${inactiveProjectId}');
      insert into public.quote_versions(
        id,quote_id,version_number,status,sent_at,expires_at
      ) values (
        '${inactiveQuoteVersionId}','${inactiveQuoteId}',1,'SENT',
        clock_timestamp(),'2026-08-31'
      );
      insert into public.quote_send_logs(
        project_id,quote_version_id,status,sent_at
      ) values (
        '${inactiveProjectId}','${inactiveQuoteVersionId}','SENT',
        clock_timestamp()
      );
      select public.project_operational_state_command(
        '${inactiveProjectId}',
        '26262626-2626-4626-8626-262626262626',
        'WAIT',
        jsonb_build_object(
          'expectedRowVersion',1,
          'waitingUntil',clock_timestamp() + interval '10 days',
          'reason','Waiting for customer',
          'cancellationReason','Pause current work while waiting'
        )
      );
    `);

    await expect(database.query(`
      select public.project_confirmation_command(
        '${inactiveProjectId}',
        '27272727-2727-4727-8727-272727272727',
        'RECORD_FIRST_ENQUIRY_EMAIL_SENT',
        jsonb_build_object('occurredAt',clock_timestamp())
      )
    `)).rejects.toThrow(/project must be Active/i);

    const reconciled = await database.query<{
      result: { inactive: boolean; cancelled_count: number };
    }>(`
      select public.project_work_item_reconcile(
        '${inactiveProjectId}',
        '28282828-2828-4828-8828-282828282828',
        'QUOTE_SENT',
        '{"quote_version_id":"${inactiveQuoteVersionId}"}'::jsonb
      ) as result
    `);
    expect(reconciled.rows[0]?.result).toEqual(expect.objectContaining({
      inactive: true,
      cancelled_count: 0,
    }));

    const quoteInvariant = await database.query<{
      active_count: number;
      confirmation_count: number;
      receipt_count: number;
    }>(`
      select
        (
          select count(*)::integer
          from public.project_work_items
          where project_id='${inactiveProjectId}'
            and status in ('OPEN','BLOCKED')
        ) as active_count,
        (
          select count(*)::integer
          from public.project_confirmation_events
          where project_id='${inactiveProjectId}'
        ) as confirmation_count,
        (
          select count(*)::integer
          from public.project_command_receipts
          where project_id='${inactiveProjectId}'
            and command_id='28282828-2828-4828-8828-282828282828'
        ) as receipt_count
    `);
    expect(quoteInvariant.rows[0]).toEqual({
      active_count: 0,
      confirmation_count: 0,
      receipt_count: 1,
    });

    await database.exec(`
      begin;
      select set_config('sanctuary.project_work_command','allowed',true);
      insert into public.project_work_items(
        project_id,title,responsibility_area,status,due_at,deadline_policy,
        priority,origin,source_type
      ) values (
        '${inactiveProjectId}','Corrupt active work','ADMIN','OPEN',
        clock_timestamp(),'MANUAL','NORMAL','MANUAL','MANUAL'
      );
      commit;
    `);
    const repaired = await database.query<{
      result: { inactive: boolean; cancelled_count: number };
    }>(`
      select public.project_work_item_reconcile(
        '${inactiveProjectId}',
        '29292929-2929-4929-8929-292929292929',
        'RECONCILE_PROJECT',
        '{}'::jsonb
      ) as result
    `);
    expect(repaired.rows[0]?.result).toEqual(expect.objectContaining({
      inactive: true,
      cancelled_count: 1,
    }));
    const repairedInvariant = await database.query<{ active_count: number }>(`
      select count(*)::integer as active_count
      from public.project_work_items
      where project_id='${inactiveProjectId}'
        and status in ('OPEN','BLOCKED')
    `);
    expect(repairedInvariant.rows[0]?.active_count).toBe(0);
  });

  it('derives quote cadence only from durable quote facts', async () => {
    const quoteId = '99999999-9999-4999-8999-999999999999';
    const quoteVersionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await database.exec(`
      insert into public.quotes(id,project_id)
      values ('${quoteId}','${projectId}');
      insert into public.quote_versions(
        id,quote_id,version_number,status,sent_at,expires_at
      ) values (
        '${quoteVersionId}','${quoteId}',1,'SENT',
        '2026-07-29T01:30:00Z','2026-08-31'
      );
      insert into public.quote_send_logs(
        project_id,quote_version_id,status,sent_at
      ) values (
        '${projectId}','${quoteVersionId}','SENT','2026-07-29T01:30:00Z'
      );
    `);
    await database.query(`
      select public.project_work_item_reconcile(
        '${projectId}',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'QUOTE_SENT',
        '{"quote_version_id":"${quoteVersionId}"}'::jsonb
      )
    `);
    const followUp = await database.query<{
      id: string;
      deadline_policy: string;
      status: string;
    }>(`
      select id,deadline_policy,status from public.project_work_items
      where source_key='quote:follow-up:${quoteVersionId}:v1'
    `);
    expect(followUp.rows[0]).toEqual(expect.objectContaining({
      deadline_policy: 'QUOTE_FOLLOW_UP_V1',
      status: 'OPEN',
    }));
    const leadCadence = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from public.project_work_items
      where project_id='${projectId}'
        and source_type='LEAD_CADENCE'
        and status in ('OPEN','BLOCKED')
    `);
    expect(leadCadence.rows[0]?.count).toBe(0);

    const openedRepair = await database.query<{
      result: {
        status: string;
        attempt_count: number;
        present: boolean;
        changed: boolean;
      };
    }>(`
      select public.project_work_quote_repair_signal_command(
        '${projectId}',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'QUOTE_SENT',
        '${quoteVersionId}',
        'OPEN',
        'QUOTE_CADENCE_SYNC_FAILED',
        'Quote sent, but its follow-up could not be refreshed.'
      ) as result
    `);
    expect(openedRepair.rows[0]?.result).toEqual(expect.objectContaining({
      status: 'OPEN',
      attempt_count: 1,
      present: true,
      changed: true,
    }));
    await expect(database.exec(`
      update public.project_work_repair_signals
      set error_message='Direct mutation is forbidden'
      where command_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    `)).rejects.toThrow(/service command/i);
    const repairQueue = await database.query<{
      title: string;
      queue_group: string;
      blocked_reason: string | null;
    }>(`
      select title,queue_group,blocked_reason
      from public.project_work_queue_v2(clock_timestamp(),500)
      where project_id='${projectId}'
    `);
    expect(repairQueue.rows).toEqual([{
      title: 'Repair quote follow-up sync',
      queue_group: 'blocked',
      blocked_reason: 'Quote sent, but its follow-up could not be refreshed.',
    }]);
    const repairReport = await database.query<{
      report: { open_repair_signals: number };
    }>(`
      select public.project_work_integrity_report_v2('${projectId}') as report
    `);
    expect(repairReport.rows[0]?.report.open_repair_signals).toBe(1);
    const resolvedRepair = await database.query<{
      result: { status: string; changed: boolean; resolved_count: number };
    }>(`
      select public.project_work_quote_repair_signal_command(
        '${projectId}',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'QUOTE_SENT',
        '${quoteVersionId}',
        'RESOLVE'
      ) as result
    `);
    expect(resolvedRepair.rows[0]?.result).toEqual(expect.objectContaining({
      status: 'RESOLVED',
      changed: true,
      resolved_count: 1,
    }));

    await database.exec(`
      update public.quote_versions
      set status='ACCEPTED'
      where id='${quoteVersionId}'
    `);
    await expect(database.query(`
      select public.project_confirmation_command(
        '${projectId}',
        '45454545-4545-4545-8545-454545454545',
        'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT',
        '{
          "occurredAt":"2026-07-29T02:00:00Z",
          "subjectKind":"QUOTE_VERSION",
          "subjectId":"${quoteVersionId}"
        }'::jsonb
      )
    `)).rejects.toThrow(/QUOTE_FOLLOW_UP_NOT_SENDABLE/);
    await database.exec(`
      update public.quote_versions
      set status='SENT'
      where id='${quoteVersionId}'
    `);
    await database.query(`
      select public.project_confirmation_command(
        '${projectId}',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT',
        '{
          "occurredAt":"2026-07-29T02:00:00Z",
          "subjectKind":"QUOTE_VERSION",
          "subjectId":"${quoteVersionId}"
        }'::jsonb
      )
    `);
    const review = await database.query<{ status: string }>(`
      select status from public.project_work_items
      where source_key='quote:outcome-review:${quoteVersionId}:v1'
    `);
    expect(review.rows[0]?.status).toBe('OPEN');

    await database.exec(`
      update public.quote_versions
      set status='ACCEPTED'
      where id='${quoteVersionId}'
    `);
    const confirmationReplay = await database.query<{
      result: { replayed: boolean };
    }>(`
      select public.project_confirmation_command(
        '${projectId}',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT',
        '{
          "occurredAt":"2026-07-29T02:00:00Z",
          "subjectKind":"QUOTE_VERSION",
          "subjectId":"${quoteVersionId}"
        }'::jsonb
      ) as result
    `);
    expect(confirmationReplay.rows[0]?.result.replayed).toBe(true);
    await database.query(`
      select public.project_work_item_reconcile(
        '${projectId}',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'QUOTE_OUTCOME',
        '{
          "quote_version_id":"${quoteVersionId}",
          "outcome":"ACCEPTED"
        }'::jsonb
      )
    `);
    const cancelled = await database.query<{ status: string }>(`
      select status from public.project_work_items
      where source_key='quote:outcome-review:${quoteVersionId}:v1'
    `);
    expect(cancelled.rows[0]?.status).toBe('CANCELLED');
  });

  it('makes V2 archive changes atomic and command-owned', async () => {
    await expect(database.exec(`
      update public.projects
      set archived_at=clock_timestamp()
      where id='${projectId}'
    `)).rejects.toThrow(/archive state requires the archive command/i);

    await database.query(`
      select public.project_work_item_command(
        '${projectId}',
        '46464646-4646-4646-8646-464646464646',
        'CREATE',
        jsonb_build_object(
          'title','Archive cancellation fixture',
          'responsibilityArea','ADMIN',
          'dueAt',clock_timestamp() + interval '1 day'
        )
      )
    `);
    const state = await database.query<{ row_version: number }>(`
      select row_version from public.project_operational_states
      where project_id='${projectId}'
    `);
    const archived = await database.query<{
      result: { row_version: number; cancelled_count: number };
    }>(`
      select public.project_work_archive_command(
        '${projectId}',
        '88888888-8888-4888-8888-888888888888',
        true,
        ${state.rows[0]?.row_version},
        'Fixture archive'
      ) as result
    `);
    expect(archived.rows[0]?.result.cancelled_count).toBeGreaterThan(0);
    const project = await database.query<{
      archived: boolean;
      active_items: number;
    }>(`
      select
        archived_at is not null as archived,
        (
          select count(*)::integer from public.project_work_items item
          where item.project_id=project.id
            and item.status in ('OPEN','BLOCKED')
        ) as active_items
      from public.projects project where project.id='${projectId}'
    `);
    expect(project.rows[0]).toEqual({ archived: true, active_items: 0 });
  });

  it('retires legacy task writes after preserving Running Jobs facts', async () => {
    const legacyProjectId = '91919191-9191-4191-8191-919191919191';
    const guardedV2ProjectId = '93939393-9393-4393-8393-939393939393';
    const reassignmentTargetProjectId =
      '94949494-9494-4494-8494-949494949494';
    await database.exec(`
      insert into public.projects(id,name)
      values
        ('${legacyProjectId}','Retirement fixture'),
        ('${guardedV2ProjectId}','Guarded V2 retirement fixture'),
        ('${reassignmentTargetProjectId}','Fact reassignment target');
      insert into public.project_task_checks(
        project_id,task_key,completed_at,completed_by
      )
      values
        (
          '${legacyProjectId}',
          'order_materials',
          '2026-07-30T00:00:00Z',
          '${actorId}'
        ),
        (
          '${guardedV2ProjectId}',
          'roofing_ordered',
          '2026-07-30T01:00:00Z',
          '${actorId}'
        );
      do $$
      begin
        perform set_config('sanctuary.project_work_command','allowed',true);
        insert into public.project_work_model_versions(
          project_id,model_version,cutover_by,reason
        )
        values (
          '${guardedV2ProjectId}',2,'${actorId}','ADMIN_REPAIR'
        );
        perform set_config('sanctuary.project_work_command','',true);
      end;
      $$;
      create or replace function public.project_command_action(
        uuid,uuid,text,jsonb
      )
      returns jsonb
      language sql
      as $$ select '{"committed":true}'::jsonb $$;
      grant execute on function public.project_command_action(
        uuid,uuid,text,jsonb
      ) to authenticated;
    `);

    await database.exec(legacyTaskRetirement);

    const backfilled = await database.query<{
      materials_ordered: boolean;
      row_version: number;
    }>(`
      select
        materials_ordered_at is not null as materials_ordered,
        row_version
      from public.project_running_job_meta
      where project_id='${legacyProjectId}'
    `);
    expect(backfilled.rows[0]).toEqual({
      materials_ordered: true,
      row_version: 1,
    });
    const guardedV2Backfill = await database.query<{
      roofing_ordered: boolean;
    }>(`
      select roofing_ordered_at is not null as roofing_ordered
      from public.project_running_job_meta
      where project_id='${guardedV2ProjectId}'
    `);
    expect(guardedV2Backfill.rows[0]?.roofing_ordered).toBe(true);

    const command = await database.query<{
      result: { value: boolean; row_version: number };
    }>(`
      select public.project_running_job_fact_command(
        '${legacyProjectId}',
        '92929292-9292-4292-8292-929292929292',
        'materials_ordered',
        false,
        1
      ) as result
    `);
    expect(command.rows[0]?.result).toEqual(
      expect.objectContaining({ value: false, row_version: 2 }),
    );

    await expect(database.exec(`
      update public.project_running_job_meta
      set materials_ordered_at=clock_timestamp()
      where project_id='${legacyProjectId}'
    `)).rejects.toThrow(/running-job facts require their command/i);

    await expect(database.exec(`
      update public.project_running_job_meta
      set project_id='${reassignmentTargetProjectId}'
      where project_id='${legacyProjectId}'
    `)).rejects.toThrow(/running-job facts require their command/i);

    await expect(database.exec(`
      delete from public.project_running_job_meta
      where project_id='${legacyProjectId}'
    `)).rejects.toThrow(/cannot be deleted directly/i);

    const privileges = await database.query<{
      action_execute: boolean;
      design_execute: boolean;
    }>(`
      select
        has_function_privilege(
          'authenticated',
          'public.project_command_action(uuid,uuid,text,jsonb)',
          'execute'
        ) as action_execute,
        has_function_privilege(
          'authenticated',
          'public.project_command_sync_design_task(uuid,text,text,text,text,timestamptz,text,jsonb)',
          'execute'
        ) as design_execute
    `);
    expect(privileges.rows[0]).toEqual({
      action_execute: false,
      design_execute: false,
    });

    await database.exec(`
      delete from public.projects where id='${legacyProjectId}'
    `);
    const cascade = await database.query<{ meta_count: number }>(`
      select count(*)::integer as meta_count
      from public.project_running_job_meta
      where project_id='${legacyProjectId}'
    `);
    expect(cascade.rows[0]?.meta_count).toBe(0);
  });
});

describe('Project Work Items V2 source contract', () => {
  it('keeps service reconciliation private and browser writes command-only', () => {
    expect(migration).toContain(
      'grant execute on function public.project_work_item_reconcile',
    );
    expect(migration).toMatch(
      /grant execute on function public\.project_work_item_reconcile\([\s\S]*?\) to service_role;/,
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all)[^;]*project_work_items[^;]*authenticated/i,
    );
    expect(migration).toContain('LEGACY_PROJECT_WORK_WRITE_BLOCKED');
  });

  it('repairs project relationships and reloads PostgREST after commit', () => {
    expect(schemaCacheRepair).toContain(
      "conrelid = 'public.project_work_model_versions'::regclass",
    );
    expect(schemaCacheRepair).toContain(
      "conrelid = 'public.project_operational_states'::regclass",
    );
    expect(schemaCacheRepair.match(/and conkey = array\[/g)?.length).toBeGreaterThanOrEqual(4);
    expect(schemaCacheRepair.match(/and confkey = array\[/g)?.length).toBeGreaterThanOrEqual(4);
    expect(schemaCacheRepair).toContain("and confdeltype = 'c'");
    expect(schemaCacheRepair).toContain(
      "conname = 'project_work_model_versions_project_id_fkey'",
    );
    expect(schemaCacheRepair).toContain(
      "conname = 'project_operational_states_project_id_fkey'",
    );
    expect(schemaCacheRepair).toMatch(
      /commit;\s*[\s\S]*notify pgrst, 'reload schema';\s*$/i,
    );
  });
});
