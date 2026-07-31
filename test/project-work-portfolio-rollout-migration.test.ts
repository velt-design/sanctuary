// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const v2Migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260729_000002_project_work_items_v2.sql",
  ),
  "utf8",
);
const schemaCacheRepair = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260729_000003_project_work_items_v2_schema_cache.sql",
  ),
  "utf8",
);
const workQueueMigration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260729_000004_project_work_queue_and_legacy_triage.sql",
  ),
  "utf8",
);
const portfolioMigration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260731000002_project_work_portfolio_rollout.sql",
  ),
  "utf8",
);
const v2MigrationTestSource = readFileSync(
  path.join(process.cwd(), "test/project-work-items-v2-migration.test.ts"),
  "utf8",
);
const bootstrapMatch = v2MigrationTestSource.match(
  /const bootstrap = String\.raw`([\s\S]*?)`;\r?\n\r?\ndescribe\(/,
);

if (!bootstrapMatch?.[1]) {
  throw new Error("Could not extract the Project Work Items V2 bootstrap");
}

const bootstrap = bootstrapMatch[1];

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const CONTACT_ID = "22222222-2222-4222-8222-222222222222";
const PROJECTS = {
  newLead: "40000000-0000-4000-8000-000000000001",
  contacted: "40000000-0000-4000-8000-000000000002",
  siteVisit: "40000000-0000-4000-8000-000000000003",
  quoting: "40000000-0000-4000-8000-000000000004",
  sent: "40000000-0000-4000-8000-000000000005",
  deposit: "40000000-0000-4000-8000-000000000006",
  scheduled: "40000000-0000-4000-8000-000000000007",
  completed: "40000000-0000-4000-8000-000000000008",
  paid: "40000000-0000-4000-8000-000000000009",
  archived: "40000000-0000-4000-8000-000000000010",
  partialMarker: "40000000-0000-4000-8000-000000000011",
  partialState: "40000000-0000-4000-8000-000000000012",
  transition: "40000000-0000-4000-8000-000000000013",
  manualWork: "40000000-0000-4000-8000-000000000014",
  partialNewWaiting: "40000000-0000-4000-8000-000000000015",
  legacyReview: "40000000-0000-4000-8000-000000000016",
  existingV2Contacted: "40000000-0000-4000-8000-000000000017",
  existingV2Paid: "40000000-0000-4000-8000-000000000018",
  existingV2Prohibited: "40000000-0000-4000-8000-000000000019",
} as const;

const stageFixtures = [
  [PROJECTS.contacted, "CONTACTED", "Review enquiry progress", "CUSTOMER"],
  [PROJECTS.siteVisit, "SITE_VISIT", "Review proposal progress", "CUSTOMER"],
  [PROJECTS.quoting, "QUOTING", "Review proposal progress", "COMMERCIAL"],
  [PROJECTS.sent, "SENT", "Review proposal outcome", "COMMERCIAL"],
  [PROJECTS.deposit, "DEPOSIT", "Review confirmed project", "ADMIN"],
  [PROJECTS.scheduled, "SCHEDULED", "Review delivery progress", "OPERATIONS"],
  [
    PROJECTS.completed,
    "COMPLETED",
    "Review completion and payment",
    "ADMIN",
  ],
] as const;

async function applyProjectWorkMigrationsThroughQueue(database: PGlite) {
  await database.exec(bootstrap);
  await database.exec(v2Migration);
  await database.exec(schemaCacheRepair);
  await database.exec(`
    alter table public.projects
      add column if not exists deposit_amount_cents integer,
      add column if not exists portal_search_document text
        not null default '';
    alter table public.contacts
      add column if not exists portal_search_document text
        not null default '';
    alter table public.project_running_job_meta
      add column if not exists materials_ordered_at timestamptz,
      add column if not exists roofing_ordered_at timestamptz;
    alter table public.followup_tasks
      add column if not exists type text,
      add column if not exists completed_at timestamptz;
    alter table public.project_manual_actions
      add column if not exists status text,
      add column if not exists completed_at timestamptz;
    alter table public.quote_versions
      drop constraint if exists quote_versions_quote_id_fkey;
    alter table public.quote_versions
      add constraint quote_versions_quote_id_fkey
      foreign key (quote_id)
      references public.quotes(id)
      on delete cascade;
    create table if not exists public.design_package_requests (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references public.projects(id),
      status text not null
    );
  `);
  await database.exec(workQueueMigration);
}

describe("Project Work portfolio rollout migration", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await database.waitReady;
    await applyProjectWorkMigrationsThroughQueue(database);
    await database.exec(`
      create or replace function public.project_command_action(
        p_project_id uuid,
        p_command_id uuid,
        p_command text,
        p_payload jsonb
      )
      returns jsonb
      language sql
      as $function$
        select '{}'::jsonb
      $function$;
      grant execute on function public.project_command_action(
        uuid,uuid,text,jsonb
      ) to authenticated, service_role;
    `);
    await database.exec(`
      insert into auth.users(id,email)
      values ('${ADMIN_ID}','admin@example.invalid');
      insert into public.portal_users(user_id,role)
      values ('${ADMIN_ID}','admin');
      select set_config('request.jwt.claim.sub','${ADMIN_ID}',false);
      insert into public.contacts(
        id,name,email,phone,portal_search_document
      )
      values (
        '${CONTACT_ID}',
        'Fixture Customer',
        'customer@example.invalid',
        '021 555 0101',
        'fixture customer customer@example.invalid 0215550101'
      );

      insert into public.projects(
        id,contact_id,name,pipeline_stage,region,site_address,notes,
        archived_at,portal_search_document
      )
      values
        (
          '${PROJECTS.newLead}','${CONTACT_ID}','Existing new lead','NEW',
          'Auckland','1 New Street','new-note',null,'existing new lead'
        ),
        (
          '${PROJECTS.contacted}','${CONTACT_ID}','Contacted fixture',
          'CONTACTED','Auckland','2 Contacted Street','contacted-note',
          null,'contacted fixture'
        ),
        (
          '${PROJECTS.siteVisit}','${CONTACT_ID}','Site Visit fixture',
          'SITE_VISIT','Auckland','3 Site Street','site-note',null,
          'site visit fixture'
        ),
        (
          '${PROJECTS.quoting}','${CONTACT_ID}','Quoting fixture','QUOTING',
          'Auckland','4 Quote Street','quoting-note',null,'quoting fixture'
        ),
        (
          '${PROJECTS.sent}','${CONTACT_ID}','Sent fixture','SENT',
          'Auckland','5 Sent Street','sent-note',null,'sent fixture'
        ),
        (
          '${PROJECTS.deposit}','${CONTACT_ID}','Deposit fixture','DEPOSIT',
          'Auckland','6 Deposit Street','deposit-note',null,'deposit fixture'
        ),
        (
          '${PROJECTS.scheduled}','${CONTACT_ID}','Scheduled fixture',
          'SCHEDULED','Auckland','7 Scheduled Street','scheduled-note',
          null,'scheduled fixture'
        ),
        (
          '${PROJECTS.completed}','${CONTACT_ID}','Completed fixture',
          'COMPLETED','Auckland','8 Completed Street','completed-note',
          null,'completed fixture'
        ),
        (
          '${PROJECTS.paid}','${CONTACT_ID}','Paid fixture','PAID',
          'Auckland','9 Paid Street','paid-note',null,'paid fixture'
        ),
        (
          '${PROJECTS.archived}','${CONTACT_ID}','Archived fixture','CONTACTED',
          'Auckland','10 Archive Street','archive-note',
          '2026-07-01T00:00:00Z','archived fixture'
        ),
        (
          '${PROJECTS.partialMarker}','${CONTACT_ID}','Partial marker',
          'CONTACTED','Auckland',null,'partial-marker-note',null,
          'partial marker'
        ),
        (
          '${PROJECTS.partialState}','${CONTACT_ID}','Partial state','SENT',
          'Auckland',null,'partial-state-note',null,'partial state'
        ),
        (
          '${PROJECTS.transition}','${CONTACT_ID}','Transition fixture',
          'CONTACTED','Auckland',null,'transition-note',null,
          'transition fixture'
        ),
        (
          '${PROJECTS.manualWork}','${CONTACT_ID}','Manual work fixture',
          'CONTACTED','Auckland',null,'manual-work-note',null,
          'manual work fixture'
        ),
        (
          '${PROJECTS.partialNewWaiting}','${CONTACT_ID}',
          'Partial New Waiting','NEW','Auckland',null,
          'partial-new-waiting-note',null,'partial new waiting'
        ),
        (
          '${PROJECTS.legacyReview}','${CONTACT_ID}',
          'Legacy review fixture','CONTACTED','Auckland',null,
          'legacy-review-note',null,'legacy review fixture'
        ),
        (
          '${PROJECTS.existingV2Contacted}','${CONTACT_ID}',
          'Existing V2 Contacted','CONTACTED','Auckland',null,
          'existing-v2-contacted-note',null,'existing v2 contacted'
        ),
        (
          '${PROJECTS.existingV2Paid}','${CONTACT_ID}',
          'Existing V2 Paid','PAID','Auckland',null,
          'existing-v2-paid-note',null,'existing v2 paid'
        ),
        (
          '${PROJECTS.existingV2Prohibited}','${CONTACT_ID}',
          'Existing V2 prohibited work','CONTACTED','Auckland',null,
          'existing-v2-prohibited-note',null,'existing v2 prohibited'
        );

      insert into public.projects(
        contact_id,name,pipeline_stage,region,portal_search_document
      )
      select
        '${CONTACT_ID}',
        'Bulk queue ' || series::text,
        'CONTACTED',
        'Auckland',
        'bulk queue ' || series::text
      from generate_series(1,510) series;

      select set_config('sanctuary.project_work_command','allowed',false);
      insert into public.project_work_model_versions(
        project_id,model_version,cutover_at,cutover_by,reason
      )
      values
        (
          '${PROJECTS.partialMarker}',
          2,
          '2026-07-30T00:00:00Z',
          null,
          'ADMIN_REPAIR'
        ),
        (
          '${PROJECTS.legacyReview}',
          2,
          '2026-07-29T00:00:00Z',
          null,
          'REVIEWED_MIGRATION'
        ),
        (
          '${PROJECTS.existingV2Contacted}',
          2,
          '2026-07-29T01:00:00Z',
          null,
          'NEW_PROJECT'
        ),
        (
          '${PROJECTS.existingV2Paid}',
          2,
          '2026-07-29T02:00:00Z',
          null,
          'NEW_PROJECT'
        ),
        (
          '${PROJECTS.existingV2Prohibited}',
          2,
          '2026-07-29T03:00:00Z',
          null,
          'NEW_PROJECT'
        );
      insert into public.project_operational_states(
        project_id,state,waiting_until,waiting_reason,row_version
      )
      values
        ('${PROJECTS.partialState}','ACTIVE',null,null,1),
        (
          '${PROJECTS.partialNewWaiting}',
          'WAITING',
          '2026-08-31T00:00:00Z',
          'Preexisting wait',
          1
        ),
        ('${PROJECTS.legacyReview}','ACTIVE',null,null,1),
        ('${PROJECTS.existingV2Contacted}','ACTIVE',null,null,1),
        ('${PROJECTS.existingV2Paid}','ACTIVE',null,null,1),
        ('${PROJECTS.existingV2Prohibited}','ACTIVE',null,null,1);
      insert into public.project_work_items(
        project_id,title,responsibility_area,status,due_at,deadline_policy,
        priority,origin,source_type,source_key,subject_kind,subject_id,
        created_at,updated_at
      )
      values (
        '${PROJECTS.legacyReview}',
        'Review migrated legacy task',
        'CUSTOMER',
        'OPEN',
        '2026-07-25T05:00:00Z',
        'MANUAL',
        'NORMAL',
        'REVIEWED_MIGRATION',
        'LEGACY_REVIEW',
        'legacy-review:${PROJECTS.legacyReview}:fixture',
        'PROJECT',
        '${PROJECTS.legacyReview}',
        '2026-07-20T00:00:00Z',
        '2026-07-20T00:00:00Z'
      ), (
        '${PROJECTS.existingV2Prohibited}',
        'Call customer about old quote',
        'CUSTOMER',
        'OPEN',
        '2026-07-25T05:00:00Z',
        'MANUAL',
        'NORMAL',
        'MANUAL',
        'MANUAL',
        null,
        'PROJECT',
        '${PROJECTS.existingV2Prohibited}',
        '2026-07-20T00:00:00Z',
        '2026-07-20T00:00:00Z'
      );
      select set_config('sanctuary.project_work_command','',false);

      insert into public.project_task_checks(
        project_id,task_key,completed_at,completed_by
      )
      values (
        '${PROJECTS.scheduled}',
        'materials_ordered',
        '2026-07-20T01:00:00Z',
        '${ADMIN_ID}'
      );
    `);

    await database.exec(portfolioMigration);
    await database.exec(portfolioMigration);
  }, 120_000);

  afterAll(async () => {
    await database.close();
  });

  it("marks every pre-rollout project, converges partial rows, and replays without duplication", async () => {
    const result = await database.query<{
      projects: number;
      markers: number;
      states: number;
      rollout_markers: number;
      rollout_timestamps: number;
      rollout_events: number;
      rollout_event_timestamps: number;
      rollout_ledgers: number;
      rollout_ledger_projects: number;
      duplicate_sources: number;
    }>(`
      select
        (select count(*)::int from public.projects) as projects,
        (
          select count(*)::int
          from public.project_work_model_versions
        ) as markers,
        (
          select count(*)::int
          from public.project_operational_states
        ) as states,
        (
          select count(*)::int
          from public.project_work_model_versions
          where reason='PORTFOLIO_ROLLOUT'
        ) as rollout_markers,
        (
          select count(distinct cutover_at)::int
          from public.project_work_model_versions
          where reason='PORTFOLIO_ROLLOUT'
        ) as rollout_timestamps,
        (
          select count(*)::int
          from public.project_state_events
          where event_type='PORTFOLIO_ROLLOUT_APPLIED'
        ) as rollout_events,
        (
          select count(distinct occurred_at)::int
          from public.project_state_events
          where event_type='PORTFOLIO_ROLLOUT_APPLIED'
        ) as rollout_event_timestamps,
        (
          select count(*)::int
          from public.project_work_portfolio_rollouts
          where rollout_key='project-work-v2-portfolio-20260731'
        ) as rollout_ledgers,
        (
          select initial_project_count::int
          from public.project_work_portfolio_rollouts
          where rollout_key='project-work-v2-portfolio-20260731'
        ) as rollout_ledger_projects,
        (
          select count(*)::int
          from (
            select source_key
            from public.project_work_items
            where source_key is not null
            group by source_key
            having count(*) > 1
          ) duplicate
        ) as duplicate_sources
    `);

    expect(result.rows[0]?.markers).toBe(result.rows[0]?.projects);
    expect(result.rows[0]?.states).toBe(result.rows[0]?.projects);
    expect(result.rows[0]?.rollout_markers).toBeGreaterThan(500);
    expect(result.rows[0]?.rollout_timestamps).toBe(1);
    expect(result.rows[0]?.rollout_events).toBe(result.rows[0]?.projects);
    expect(result.rows[0]?.rollout_event_timestamps).toBe(1);
    expect(result.rows[0]?.rollout_ledgers).toBe(1);
    expect(result.rows[0]?.rollout_ledger_projects).toBe(
      result.rows[0]?.projects,
    );
    expect(result.rows[0]?.duplicate_sources).toBe(0);

    const partials = await database.query<{
      project_id: string;
      marker_reason: string;
      state: string;
    }>(`
      select
        model.project_id,
        model.reason as marker_reason,
        state.state
      from public.project_work_model_versions model
      join public.project_operational_states state
        on state.project_id=model.project_id
      where model.project_id in (
        '${PROJECTS.partialMarker}',
        '${PROJECTS.partialState}',
        '${PROJECTS.partialNewWaiting}'
      )
      order by model.project_id
    `);
    expect(partials.rows).toEqual([
      {
        project_id: PROJECTS.partialMarker,
        marker_reason: "ADMIN_REPAIR",
        state: "ACTIVE",
      },
      {
        project_id: PROJECTS.partialState,
        marker_reason: "PORTFOLIO_ROLLOUT",
        state: "ACTIVE",
      },
      {
        project_id: PROJECTS.partialNewWaiting,
        marker_reason: "PORTFOLIO_ROLLOUT",
        state: "WAITING",
      },
    ]);
    const waitingLead = await database.query<{
      status: string;
      cancellation_reason: string;
    }>(`
      select status,cancellation_reason
      from public.project_work_items
      where project_id='${PROJECTS.partialNewWaiting}'
        and source_type='LEAD_CADENCE'
    `);
    expect(waitingLead.rows).toEqual([
      {
        status: "CANCELLED",
        cancellation_reason: "Preexisting operational state is not Active",
      },
    ]);
  });

  it("uses the lead initializer for NEW and exact stage review mappings elsewhere", async () => {
    const lead = await database.query<{
      title: string;
      source_type: string;
      deadline_policy: string;
      due_matches: boolean;
      sla_matches: boolean;
    }>(`
      select
        item.title,
        item.source_type,
        item.deadline_policy,
        item.due_at = public.project_work_items_add_open_hours(
          model.cutover_at,2,'Auckland'
        ) as due_matches,
        item.sla_breach_at = public.project_work_items_add_open_hours(
          model.cutover_at,4,'Auckland'
        ) as sla_matches
      from public.project_work_items item
      join public.project_work_model_versions model
        on model.project_id=item.project_id
      where item.project_id='${PROJECTS.newLead}'
    `);
    expect(lead.rows).toEqual([
      {
        title: "Send first enquiry email",
        source_type: "LEAD_CADENCE",
        deadline_policy: "LEAD_FIRST_EMAIL_V1",
        due_matches: true,
        sla_matches: true,
      },
    ]);

    const stageRows = await database.query<{
      project_id: string;
      title: string;
      responsibility_area: string;
      source_type: string;
      deadline_policy: string;
      due_matches: boolean;
    }>(`
      select
        item.project_id,
        item.title,
        item.responsibility_area,
        item.source_type,
        item.deadline_policy,
        item.due_at = public.project_work_items_add_business_days_due(
          model.cutover_at,5,'Auckland'
        ) as due_matches
      from public.project_work_items item
      join public.project_work_model_versions model
        on model.project_id=item.project_id
      where item.project_id in (
        ${stageFixtures.map(([id]) => `'${id}'`).join(",")}
      )
        and item.status='OPEN'
      order by item.project_id
    `);
    expect(stageRows.rows).toEqual(
      stageFixtures.map(([projectId, , title, responsibilityArea]) => ({
        project_id: projectId,
        title,
        responsibility_area: responsibilityArea,
        source_type: "STAGE_REVIEW",
        deadline_policy: "STAGE_REVIEW_V1",
        due_matches: true,
      })),
    );

    const prohibited = await database.query<{ count: number }>(`
      select count(*)::int as count
      from public.project_work_items
      where status in ('OPEN','BLOCKED')
        and (
          public.project_work_title_is_prohibited_v1(title)
          or public.project_work_title_is_prohibited_v1(source_key)
          or public.project_work_title_is_prohibited_v1(series_key)
        )
    `);
    expect(prohibited.rows[0]?.count).toBe(0);
  });

  it("applies fresh current-stage policy to projects that were already fully V2", async () => {
    const paid = await database.query<{
      state: string;
      outcome: string | null;
      rollout_events: number;
    }>(`
      select
        state.state,
        state.closed_outcome as outcome,
        (
          select count(*)::int
          from public.project_state_events event
          where event.project_id=state.project_id
            and event.event_type='PORTFOLIO_ROLLOUT_APPLIED'
        ) as rollout_events
      from public.project_operational_states state
      where state.project_id='${PROJECTS.existingV2Paid}'
    `);
    expect(paid.rows).toEqual([
      { state: "CLOSED", outcome: "COMPLETE", rollout_events: 1 },
    ]);

    const reviews = await database.query<{
      project_id: string;
      title: string;
      due_matches_rollout: boolean;
    }>(`
      select
        item.project_id,
        item.title,
        item.due_at = public.project_work_items_add_business_days_due(
          rollout.occurred_at,5,'Auckland'
        ) as due_matches_rollout
      from public.project_work_items item
      join public.project_state_events rollout
        on rollout.project_id=item.project_id
        and rollout.event_type='PORTFOLIO_ROLLOUT_APPLIED'
      where item.project_id in (
        '${PROJECTS.existingV2Contacted}',
        '${PROJECTS.existingV2Prohibited}'
      )
        and item.source_type='STAGE_REVIEW'
        and item.status='OPEN'
      order by item.project_id
    `);
    expect(reviews.rows).toEqual([
      {
        project_id: PROJECTS.existingV2Contacted,
        title: "Review enquiry progress",
        due_matches_rollout: true,
      },
      {
        project_id: PROJECTS.existingV2Prohibited,
        title: "Review enquiry progress",
        due_matches_rollout: true,
      },
    ]);

    const retired = await database.query<{
      status: string;
      cancellation_reason: string | null;
    }>(`
      select status,cancellation_reason
      from public.project_work_items
      where project_id='${PROJECTS.existingV2Prohibited}'
        and title='Call customer about old quote'
    `);
    expect(retired.rows).toEqual([
      {
        status: "CANCELLED",
        cancellation_reason:
          "Call or Site Visit work retired by portfolio rollout",
      },
    ]);
  });

  it("keeps every future direct project insert inside the V2 invariant", async () => {
    const insertedId = "40000000-0000-4000-8000-000000000020";
    await database.exec(`
      insert into public.projects(
        id,contact_id,name,pipeline_stage,region,portal_search_document
      )
      values (
        '${insertedId}',
        '${CONTACT_ID}',
        'Post-rollout direct import',
        'SENT',
        'Auckland',
        'post rollout direct import'
      )
    `);

    const beforeReplay = await database.query<{
      marker_reason: string;
      state: string;
      title: string;
      status: string;
      source_key: string;
      row_version: number;
      rollout_events: number;
    }>(`
      select
        model.reason as marker_reason,
        state.state,
        item.title,
        item.status,
        item.source_key,
        item.row_version,
        (
          select count(*)::int
          from public.project_state_events event
          where event.project_id=project.id
            and event.event_type='PORTFOLIO_ROLLOUT_APPLIED'
        ) as rollout_events
      from public.projects project
      join public.project_work_model_versions model
        on model.project_id=project.id
      join public.project_operational_states state
        on state.project_id=project.id
      join public.project_work_items item
        on item.project_id=project.id
        and item.status='OPEN'
      where project.id='${insertedId}'
    `);
    expect(beforeReplay.rows).toEqual([
      {
        marker_reason: "NEW_PROJECT",
        state: "ACTIVE",
        title: "Review proposal outcome",
        status: "OPEN",
        source_key: `stage-review:${insertedId}:insert:v1`,
        row_version: 1,
        rollout_events: 0,
      },
    ]);

    await database.exec(portfolioMigration);
    const afterReplay = await database.query<{
      source_key: string;
      status: string;
      row_version: number;
      count: number;
    }>(`
      select
        min(source_key) as source_key,
        min(status) as status,
        min(row_version)::int as row_version,
        count(*)::int as count
      from public.project_work_items
      where project_id='${insertedId}'
    `);
    expect(afterReplay.rows).toEqual([
      {
        source_key: `stage-review:${insertedId}:insert:v1`,
        status: "OPEN",
        row_version: 1,
        count: 1,
      },
    ]);
  });

  it("rejects prohibited work even when an authenticated caller bypasses the HTTP route", async () => {
    await expect(
      database.query(`
        select public.project_work_item_command(
          '${PROJECTS.existingV2Contacted}',
          '51515151-5151-4515-8515-515151515151',
          'CREATE',
          jsonb_build_object(
            'title','Call customer',
            'responsibilityArea','CUSTOMER',
            'dueAt',clock_timestamp() + interval '1 day'
          )
        )
      `),
    ).rejects.toThrow(/PROHIBITED_PROJECT_WORK/i);

    const prohibited = await database.query<{ count: number }>(`
      select count(*)::int as count
      from public.project_work_items
      where project_id='${PROJECTS.existingV2Contacted}'
        and status in ('OPEN','BLOCKED')
        and public.project_work_title_is_prohibited_v1(title)
    `);
    expect(prohibited.rows[0]?.count).toBe(0);
  });

  it("retires active legacy review work and starts a fresh stage review once", async () => {
    const legacy = await database.query<{
      status: string;
      cancellation_reason: string | null;
      cancellation_events: number;
    }>(`
      select
        item.status,
        item.cancellation_reason,
        (
          select count(*)::int
          from public.project_work_item_events event
          where event.work_item_id=item.id
            and event.event_type='CANCELLED'
            and event.reason='Legacy review retired by portfolio rollout'
        ) as cancellation_events
      from public.project_work_items item
      where item.project_id='${PROJECTS.legacyReview}'
        and item.source_type='LEGACY_REVIEW'
    `);
    expect(legacy.rows).toEqual([
      {
        status: "CANCELLED",
        cancellation_reason: "Legacy review retired by portfolio rollout",
        cancellation_events: 1,
      },
    ]);

    const stageReview = await database.query<{
      title: string;
      status: string;
      source_key: string;
      due_matches_fresh_entry: boolean;
    }>(`
      select
        item.title,
        item.status,
        item.source_key,
        item.due_at = public.project_work_items_add_business_days_due(
          item.created_at,5,'Auckland'
        ) as due_matches_fresh_entry
      from public.project_work_items item
      where item.project_id='${PROJECTS.legacyReview}'
        and item.source_type='STAGE_REVIEW'
    `);
    expect(stageReview.rows).toEqual([
      {
        title: "Review enquiry progress",
        status: "OPEN",
        source_key:
          `stage-review:${PROJECTS.legacyReview}:rollout:v1`,
        due_matches_fresh_entry: true,
      },
    ]);

    const legacyId = await database.query<{ id: string; row_version: number }>(`
      select id,row_version::int as row_version
      from public.project_work_items
      where project_id='${PROJECTS.legacyReview}'
        and source_type='LEGACY_REVIEW'
    `);
    await expect(
      database.query(`
        select public.project_work_item_command(
          '${PROJECTS.legacyReview}',
          '52525252-5252-4525-8525-525252525252',
          'REOPEN',
          jsonb_build_object(
            'workItemId','${legacyId.rows[0]?.id}',
            'expectedRowVersion',${legacyId.rows[0]?.row_version},
            'dueAt',clock_timestamp() + interval '1 day',
            'reason','Attempt to reopen retired work'
          )
        )
      `),
    ).rejects.toThrow(/RETIRED_PROJECT_WORK/i);

    const stillRetired = await database.query<{
      status: string;
      row_version: number;
    }>(`
      select status,row_version::int as row_version
      from public.project_work_items
      where project_id='${PROJECTS.legacyReview}'
        and source_type='LEGACY_REVIEW'
    `);
    expect(stillRetired.rows).toEqual([
      {
        status: "CANCELLED",
        row_version: legacyId.rows[0]?.row_version,
      },
    ]);
  });

  it("makes PAID complete, keeps archived effective state, and creates no work for either", async () => {
    const rows = await database.query<{
      project_id: string;
      state: string;
      closed_outcome: string | null;
      archived: boolean;
      work_count: number;
    }>(`
      select
        project.id as project_id,
        state.state,
        state.closed_outcome,
        project.archived_at is not null as archived,
        (
          select count(*)::int
          from public.project_work_items item
          where item.project_id=project.id
        ) as work_count
      from public.projects project
      join public.project_operational_states state
        on state.project_id=project.id
      where project.id in ('${PROJECTS.paid}','${PROJECTS.archived}')
      order by project.id
    `);
    expect(rows.rows).toEqual([
      {
        project_id: PROJECTS.paid,
        state: "CLOSED",
        closed_outcome: "COMPLETE",
        archived: false,
        work_count: 0,
      },
      {
        project_id: PROJECTS.archived,
        state: "ACTIVE",
        closed_outcome: null,
        archived: true,
        work_count: 0,
      },
    ]);

    await database.exec(`
      update public.projects
      set pipeline_stage='SCHEDULED'
      where id='${PROJECTS.paid}'
    `);
    const reopened = await database.query<{
      state: string;
      outcome: string | null;
      title: string;
    }>(`
      select state.state,state.closed_outcome as outcome,item.title
      from public.project_operational_states state
      join public.project_work_items item
        on item.project_id=state.project_id
        and item.status='OPEN'
        and item.source_type='STAGE_REVIEW'
      where state.project_id='${PROJECTS.paid}'
    `);
    expect(reopened.rows).toEqual([
      {
        state: "ACTIVE",
        outcome: null,
        title: "Review delivery progress",
      },
    ]);
  });

  it("replaces only stage review work on a real stage change", async () => {
    await database.exec(`
      update public.projects
      set pipeline_stage='QUOTING'
      where id='${PROJECTS.transition}';
    `);
    const first = await database.query<{
      title: string;
      status: string;
      source_type: string;
    }>(`
      select title,status,source_type
      from public.project_work_items
      where project_id='${PROJECTS.transition}'
      order by created_at,id
    `);
    expect(first.rows).toEqual([
      {
        title: "Review enquiry progress",
        status: "CANCELLED",
        source_type: "STAGE_REVIEW",
      },
      {
        title: "Review proposal progress",
        status: "OPEN",
        source_type: "STAGE_REVIEW",
      },
    ]);

    await database.exec(`
      select set_config('sanctuary.project_work_command','allowed',false);
      insert into public.project_work_items(
        project_id,title,responsibility_area,status,due_at,deadline_policy,
        priority,origin,source_type,subject_kind,subject_id
      )
      values (
        '${PROJECTS.transition}',
        'Preserve manual obligation',
        'ADMIN',
        'OPEN',
        '2026-08-31T05:00:00Z',
        'MANUAL',
        'NORMAL',
        'MANUAL',
        'MANUAL',
        'PROJECT',
        '${PROJECTS.transition}'
      );
      select set_config('sanctuary.project_work_command','',false);
      update public.projects
      set pipeline_stage='SENT'
      where id='${PROJECTS.transition}';
    `);
    const second = await database.query<{
      manual_open: number;
      stage_open: number;
      stage_cancelled: number;
    }>(`
      select
        count(*) filter (
          where source_type='MANUAL' and status='OPEN'
        )::int as manual_open,
        count(*) filter (
          where source_type='STAGE_REVIEW' and status='OPEN'
        )::int as stage_open,
        count(*) filter (
          where source_type='STAGE_REVIEW' and status='CANCELLED'
        )::int as stage_cancelled
      from public.project_work_items
      where project_id='${PROJECTS.transition}'
    `);
    expect(second.rows).toEqual([
      {
        manual_open: 1,
        stage_open: 0,
        stage_cancelled: 2,
      },
    ]);
  });

  it("reopens only the automatic PAID closure when moving away", async () => {
    await database.exec(`
      update public.projects
      set pipeline_stage='PAID'
      where id='${PROJECTS.manualWork}';
      update public.projects
      set pipeline_stage='SCHEDULED'
      where id='${PROJECTS.manualWork}';
    `);
    const reopened = await database.query<{
      state: string;
      outcome: string | null;
      review_title: string;
    }>(`
      select
        state.state,
        state.closed_outcome as outcome,
        item.title as review_title
      from public.project_operational_states state
      join public.project_work_items item
        on item.project_id=state.project_id
        and item.status='OPEN'
        and item.source_type='STAGE_REVIEW'
      where state.project_id='${PROJECTS.manualWork}'
    `);
    expect(reopened.rows).toEqual([
      {
        state: "ACTIVE",
        outcome: null,
        review_title: "Review delivery progress",
      },
    ]);

    await database.exec(`
      update public.projects
      set pipeline_stage='PAID'
      where id='${PROJECTS.manualWork}';
      select set_config('sanctuary.project_work_command','allowed',false);
      update public.project_operational_states
      set
        state='CLOSED',
        closed_outcome='CANCELLED',
        row_version=row_version+1
      where project_id='${PROJECTS.manualWork}';
      select set_config('sanctuary.project_work_command','',false);
      update public.projects
      set pipeline_stage='SCHEDULED'
      where id='${PROJECTS.manualWork}';
    `);
    const preserved = await database.query<{
      state: string;
      outcome: string;
      open_work: number;
    }>(`
      select
        state.state,
        state.closed_outcome as outcome,
        (
          select count(*)::int
          from public.project_work_items item
          where item.project_id=state.project_id
            and item.status in ('OPEN','BLOCKED')
        ) as open_work
      from public.project_operational_states state
      where state.project_id='${PROJECTS.manualWork}'
    `);
    expect(preserved.rows).toEqual([
      { state: "CLOSED", outcome: "CANCELLED", open_work: 0 },
    ]);
  });

  it("preserves legacy rows read-only and backfills Running Jobs facts", async () => {
    const evidence = await database.query<{
      legacy_rows: number;
      materials_ordered_at: string | null;
    }>(`
      select
        (
          select count(*)::int
          from public.project_task_checks
          where project_id='${PROJECTS.scheduled}'
        ) as legacy_rows,
        materials_ordered_at::text
      from public.project_running_job_meta
      where project_id='${PROJECTS.scheduled}'
    `);
    expect(evidence.rows[0]?.legacy_rows).toBe(1);
    expect(evidence.rows[0]?.materials_ordered_at).toContain("2026-07-20");

    await expect(
      database.exec(`
        update public.project_task_checks
        set completed_at=clock_timestamp()
        where project_id='${PROJECTS.scheduled}'
      `),
    ).rejects.toThrow(/LEGACY_PROJECT_WORK_WRITE_BLOCKED/);

    const privileges = await database.query<{
      action_execute: boolean;
      design_execute: boolean;
      classify_execute: boolean;
      migrate_execute: boolean;
      anon_classify_execute: boolean;
      anon_migrate_execute: boolean;
      service_classify_execute: boolean;
      service_migrate_execute: boolean;
    }>(`
      select
        coalesce(has_function_privilege(
          'authenticated',
          to_regprocedure(
            'public.project_command_action(uuid,uuid,text,jsonb)'
          ),
          'EXECUTE'
        ),false) as action_execute,
        coalesce(has_function_privilege(
          'authenticated',
          to_regprocedure(
            'public.project_command_sync_design_task('
              || 'uuid,text,text,text,text,timestamptz,text,jsonb)'
          ),
          'EXECUTE'
        ),false) as design_execute,
        coalesce(has_function_privilege(
          'authenticated',
          to_regprocedure(
            'public.project_work_classify_legacy_contacted_v1('
              || 'date,integer,jsonb,text)'
          ),
          'EXECUTE'
        ),false) as classify_execute,
        coalesce(has_function_privilege(
          'authenticated',
          to_regprocedure(
            'public.project_work_migrate_legacy_contacted_v1('
              || 'uuid,uuid,timestamptz,text,text,text,text,text,'
              || 'timestamptz,timestamptz,text)'
          ),
          'EXECUTE'
        ),false) as migrate_execute,
        coalesce(has_function_privilege(
          'anon',
          to_regprocedure(
            'public.project_work_classify_legacy_contacted_v1('
              || 'date,integer,jsonb,text)'
          ),
          'EXECUTE'
        ),false) as anon_classify_execute,
        coalesce(has_function_privilege(
          'anon',
          to_regprocedure(
            'public.project_work_migrate_legacy_contacted_v1('
              || 'uuid,uuid,timestamptz,text,text,text,text,text,'
              || 'timestamptz,timestamptz,text)'
          ),
          'EXECUTE'
        ),false) as anon_migrate_execute,
        coalesce(has_function_privilege(
          'service_role',
          to_regprocedure(
            'public.project_work_classify_legacy_contacted_v1('
              || 'date,integer,jsonb,text)'
          ),
          'EXECUTE'
        ),false) as service_classify_execute,
        coalesce(has_function_privilege(
          'service_role',
          to_regprocedure(
            'public.project_work_migrate_legacy_contacted_v1('
              || 'uuid,uuid,timestamptz,text,text,text,text,text,'
              || 'timestamptz,timestamptz,text)'
          ),
          'EXECUTE'
        ),false) as service_migrate_execute
    `);
    expect(privileges.rows).toEqual([
      {
        action_execute: false,
        design_execute: false,
        classify_execute: false,
        migrate_execute: false,
        anon_classify_execute: false,
        anon_migrate_execute: false,
        service_classify_execute: false,
        service_migrate_execute: false,
      },
    ]);
  });

  it("returns explicit operational/effective states and supports state and phase-stage filters", async () => {
    const active = await database.query<{
      result: {
        rows: Array<{
          id: string;
          pipeline_stage: string;
          operational_state: string;
          effective_state: string;
        }>;
        totalCount: number;
      };
    }>(`
      select public.staff_projects_index_v2(
        'all','','all','all',current_date,1,100,'name_asc',
        'ACTIVE',array['QUOTING','SENT']
      ) as result
    `);
    expect(active.rows[0]?.result.rows.length).toBeGreaterThan(0);
    expect(
      active.rows[0]?.result.rows.every(
        (row) =>
          row.operational_state === "ACTIVE" &&
          row.effective_state === "ACTIVE" &&
          ["QUOTING", "SENT"].includes(row.pipeline_stage),
      ),
    ).toBe(true);

    const archived = await database.query<{
      result: {
        rows: Array<{
          id: string;
          operational_state: string;
          effective_state: string;
        }>;
      };
    }>(`
      select public.staff_projects_index_v2(
        'all','','all','all',current_date,1,50,'newest',
        'ARCHIVED',null
      ) as result
    `);
    expect(archived.rows[0]?.result.rows).toEqual([
      expect.objectContaining({
        id: PROJECTS.archived,
        operational_state: "ACTIVE",
        effective_state: "ARCHIVED",
      }),
    ]);
  });

  it("counts all effective states server-side and enforces intended grants", async () => {
    const counts = await database.query<{
      counts: Record<string, number>;
    }>(`
      select public.staff_project_state_counts_v1() as counts
    `);
    expect(counts.rows[0]?.counts.totalCount).toBeGreaterThan(500);
    expect(counts.rows[0]?.counts.ARCHIVED).toBe(1);
    expect(counts.rows[0]?.counts.CLOSED).toBeGreaterThanOrEqual(1);
    expect(
      (counts.rows[0]?.counts.ACTIVE ?? 0) +
        (counts.rows[0]?.counts.WAITING ?? 0) +
        (counts.rows[0]?.counts.CLOSED ?? 0) +
        (counts.rows[0]?.counts.ARCHIVED ?? 0),
    ).toBe(counts.rows[0]?.counts.totalCount);

    const grants = await database.query<{
      routine: string;
      authenticated: boolean;
      anonymous: boolean;
      service: boolean;
    }>(`
      select
        routine,
        has_function_privilege('authenticated',routine,'EXECUTE')
          as authenticated,
        has_function_privilege('anon',routine,'EXECUTE') as anonymous,
        has_function_privilege('service_role',routine,'EXECUTE') as service
      from unnest(array[
        'public.staff_projects_index_v2(text,text,text,text,date,integer,integer,text,text,text[])',
        'public.staff_project_state_counts_v1()',
        'public.project_work_apply_stage_entry_v1(uuid,text,text,timestamptz,uuid,text,text)'
      ]) routine
      order by routine
    `);
    expect(grants.rows).toEqual([
      {
        routine:
          "public.project_work_apply_stage_entry_v1(uuid,text,text,timestamptz,uuid,text,text)",
        authenticated: false,
        anonymous: false,
        service: false,
      },
      {
        routine: "public.staff_project_state_counts_v1()",
        authenticated: true,
        anonymous: false,
        service: false,
      },
      {
        routine:
          "public.staff_projects_index_v2(text,text,text,text,date,integer,integer,text,text,text[])",
        authenticated: true,
        anonymous: false,
        service: true,
      },
    ]);
  });

  it("returns more than 500 queue rows when the caller requests them", async () => {
    const queue = await database.query<{ count: number }>(`
      select count(*)::int as count
      from public.project_work_queue_v3(clock_timestamp(),5000)
    `);
    expect(queue.rows[0]?.count).toBeGreaterThan(500);
  });

  it("fails a stage review atomically when calendar coverage is unavailable", async () => {
    const before = await database.query<{ id: string }>(`
      select id
      from public.project_work_items
      where project_id='${PROJECTS.contacted}'
        and source_type='STAGE_REVIEW'
        and status='OPEN'
    `);
    await expect(
      database.query(`
        select public.project_work_apply_stage_entry_v1(
          '${PROJECTS.contacted}',
          'CONTACTED',
          'QUOTING',
          '2028-01-03T00:00:00Z',
          '50000000-0000-4000-8000-000000000001',
          'stage-review:${PROJECTS.contacted}:calendar-test:v1',
          'SYSTEM'
        )
      `),
    ).rejects.toThrow(/BUSINESS_CALENDAR_UNAVAILABLE/);
    const after = await database.query<{ id: string }>(`
      select id
      from public.project_work_items
      where project_id='${PROJECTS.contacted}'
        and source_type='STAGE_REVIEW'
        and status='OPEN'
    `);
    expect(after.rows).toEqual(before.rows);
  });

  it("keeps the existing admin hard-delete path valid for V2 rows and repair signals", async () => {
    const projectId = "60000000-0000-4000-8000-000000000001";
    const quoteId = "60000000-0000-4000-8000-000000000002";
    const quoteVersionId = "60000000-0000-4000-8000-000000000003";
    await database.exec(`
      insert into public.projects(
        id,contact_id,name,pipeline_stage,region,portal_search_document
      )
      values (
        '${projectId}',
        '${CONTACT_ID}',
        'Hard delete V2 fixture',
        'CONTACTED',
        'Auckland',
        'hard delete v2 fixture'
      );
      insert into public.quotes(id,project_id)
      values ('${quoteId}','${projectId}');
      insert into public.quote_versions(
        id,quote_id,version_number,status
      )
      values ('${quoteVersionId}','${quoteId}',1,'DRAFT');
      select set_config(
        'sanctuary.project_work_repair_signal',
        'allowed',
        false
      );
      insert into public.project_work_repair_signals(
        project_id,
        source_event,
        quote_version_id,
        command_id,
        status,
        error_code,
        error_message
      )
      values (
        '${projectId}',
        'QUOTE_SENT',
        '${quoteVersionId}',
        '60000000-0000-4000-8000-000000000004',
        'OPEN',
        'DELETE_FIXTURE',
        'Disposable hard-delete regression'
      );
      select set_config(
        'sanctuary.project_work_repair_signal',
        '',
        false
      );
    `);

    const before = await database.query<{
      markers: number;
      states: number;
      items: number;
      repair_signals: number;
    }>(`
      select
        (
          select count(*)::int
          from public.project_work_model_versions
          where project_id='${projectId}'
        ) as markers,
        (
          select count(*)::int
          from public.project_operational_states
          where project_id='${projectId}'
        ) as states,
        (
          select count(*)::int
          from public.project_work_items
          where project_id='${projectId}'
        ) as items,
        (
          select count(*)::int
          from public.project_work_repair_signals
          where project_id='${projectId}'
        ) as repair_signals
    `);
    expect(before.rows).toEqual([
      {
        markers: 1,
        states: 1,
        items: 1,
        repair_signals: 1,
      },
    ]);

    // The production route deletes quotes first to clear quote-version
    // references, then deletes the project in a second command.
    await database.exec(`
      delete from public.quotes where project_id='${projectId}'
    `);
    const afterQuoteDelete = await database.query<{ count: number }>(`
      select count(*)::int as count
      from public.project_work_repair_signals
      where project_id='${projectId}'
    `);
    expect(afterQuoteDelete.rows[0]?.count).toBe(0);

    await database.exec(`
      delete from public.projects where id='${projectId}'
    `);
    const afterProjectDelete = await database.query<{
      projects: number;
      markers: number;
      states: number;
      items: number;
      item_events: number;
      state_events: number;
      receipts: number;
    }>(`
      select
        (
          select count(*)::int from public.projects
          where id='${projectId}'
        ) as projects,
        (
          select count(*)::int from public.project_work_model_versions
          where project_id='${projectId}'
        ) as markers,
        (
          select count(*)::int from public.project_operational_states
          where project_id='${projectId}'
        ) as states,
        (
          select count(*)::int from public.project_work_items
          where project_id='${projectId}'
        ) as items,
        (
          select count(*)::int from public.project_work_item_events
          where project_id='${projectId}'
        ) as item_events,
        (
          select count(*)::int from public.project_state_events
          where project_id='${projectId}'
        ) as state_events,
        (
          select count(*)::int from public.project_command_receipts
          where project_id='${projectId}'
        ) as receipts
    `);
    expect(afterProjectDelete.rows).toEqual([
      {
        projects: 0,
        markers: 0,
        states: 0,
        items: 0,
        item_events: 0,
        state_events: 0,
        receipts: 0,
      },
    ]);
  });

  it("keeps an initially empty rollout closed when future projects arrive", async () => {
    const emptyDatabase = new PGlite();
    const contactId = "61000000-0000-4000-8000-000000000001";
    const projectId = "61000000-0000-4000-8000-000000000002";
    try {
      await emptyDatabase.waitReady;
      await applyProjectWorkMigrationsThroughQueue(emptyDatabase);
      await emptyDatabase.exec(portfolioMigration);
      await emptyDatabase.exec(`
        insert into public.contacts(
          id,name,email,portal_search_document
        )
        values (
          '${contactId}',
          'Empty rollout customer',
          'empty-rollout@example.invalid',
          'empty rollout customer'
        );
        insert into public.projects(
          id,contact_id,name,pipeline_stage,region,portal_search_document
        )
        values (
          '${projectId}',
          '${contactId}',
          'Post-empty-rollout project',
          'SENT',
          'Auckland',
          'post empty rollout project'
        );
      `);

      const beforeReplay = await emptyDatabase.query<{
        initial_project_count: number;
        marker_reason: string;
        cutover_at: string;
        source_key: string;
        row_version: number;
        rollout_events: number;
      }>(`
        select
          rollout.initial_project_count::int as initial_project_count,
          model.reason as marker_reason,
          model.cutover_at::text as cutover_at,
          item.source_key,
          item.row_version::int as row_version,
          (
            select count(*)::int
            from public.project_state_events event
            where event.project_id=project.id
              and event.event_type='PORTFOLIO_ROLLOUT_APPLIED'
          ) as rollout_events
        from public.projects project
        join public.project_work_model_versions model
          on model.project_id=project.id
        join public.project_work_items item
          on item.project_id=project.id
        cross join public.project_work_portfolio_rollouts rollout
        where project.id='${projectId}'
          and rollout.rollout_key='project-work-v2-portfolio-20260731'
      `);
      expect(beforeReplay.rows).toEqual([
        expect.objectContaining({
          initial_project_count: 0,
          marker_reason: "NEW_PROJECT",
          source_key: `stage-review:${projectId}:insert:v1`,
          row_version: 1,
          rollout_events: 0,
        }),
      ]);

      await emptyDatabase.exec(portfolioMigration);
      const afterReplay = await emptyDatabase.query<{
        rollout_ledgers: number;
        cutover_at: string;
        source_key: string;
        row_version: number;
        rollout_events: number;
      }>(`
        select
          (
            select count(*)::int
            from public.project_work_portfolio_rollouts
            where rollout_key='project-work-v2-portfolio-20260731'
          ) as rollout_ledgers,
          model.cutover_at::text as cutover_at,
          item.source_key,
          item.row_version::int as row_version,
          (
            select count(*)::int
            from public.project_state_events event
            where event.project_id=project.id
              and event.event_type='PORTFOLIO_ROLLOUT_APPLIED'
          ) as rollout_events
        from public.projects project
        join public.project_work_model_versions model
          on model.project_id=project.id
        join public.project_work_items item
          on item.project_id=project.id
        where project.id='${projectId}'
      `);
      expect(afterReplay.rows).toEqual([
        {
          rollout_ledgers: 1,
          cutover_at: beforeReplay.rows[0]?.cutover_at,
          source_key: `stage-review:${projectId}:insert:v1`,
          row_version: 1,
          rollout_events: 0,
        },
      ]);
    } finally {
      await emptyDatabase.close();
    }
  }, 120_000);

  it("fails index/count reads clearly if a project is missing rollout state", async () => {
    const missingId = "40000000-0000-4000-8000-000000009999";
    await database.exec(`
      insert into public.projects(
        id,contact_id,name,pipeline_stage,portal_search_document
      )
      values (
        '${missingId}','${CONTACT_ID}','Missing rollout state','CONTACTED',
        'missing rollout state'
      )
    `);
    await database.exec(`
      select set_config('sanctuary.project_work_command','allowed',false);
      delete from public.project_operational_states
      where project_id='${missingId}';
      select set_config('sanctuary.project_work_command','',false);
    `);
    const fact = await database.query<{
      result: { fact: string; value: boolean; row_version: number };
    }>(`
      select public.project_running_job_fact_command(
        '${missingId}',
        '50000000-0000-4000-8000-000000000002',
        'materials_ordered',
        true,
        0
      ) as result
    `);
    expect(fact.rows[0]?.result).toMatchObject({
      fact: "materials_ordered",
      value: true,
      row_version: 1,
    });
    await expect(
      database.query(`
        select public.staff_projects_index_v2()
      `),
    ).rejects.toThrow(/PROJECT_WORK_ROLLOUT_INCOMPLETE/);
    await expect(
      database.query(`
        select public.staff_project_state_counts_v1()
      `),
    ).rejects.toThrow(/PROJECT_WORK_ROLLOUT_INCOMPLETE/);
  });
});
