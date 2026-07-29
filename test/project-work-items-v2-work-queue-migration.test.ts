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
const v2MigrationTestSource = readFileSync(
  path.join(process.cwd(), "test/project-work-items-v2-migration.test.ts"),
  "utf8",
);
const bootstrapMatch = v2MigrationTestSource.match(
  /const bootstrap = String\.raw`([\s\S]*?)`;\r?\n\r?\ndescribe\(/,
);

if (!bootstrapMatch?.[1]) {
  throw new Error(
    "Could not extract the Project Work Items V2 PGlite bootstrap",
  );
}

const bootstrap = bootstrapMatch[1];

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const STAFF_ID = "12121212-1212-4212-8212-121212121212";
const CONTACT_ID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-07-29T02:00:00Z";

const PROJECTS = {
  overdue: "30000000-0000-4000-8000-000000000001",
  today: "30000000-0000-4000-8000-000000000002",
  upcoming: "30000000-0000-4000-8000-000000000003",
  blocked: "30000000-0000-4000-8000-000000000004",
  triage: "30000000-0000-4000-8000-000000000005",
  corrected: "30000000-0000-4000-8000-000000000006",
  legacy: "30000000-0000-4000-8000-000000000007",
  untouchedLegacy: "30000000-0000-4000-8000-000000000008",
  evidenceQuote: "30000000-0000-4000-8000-000000000009",
  evidenceInvoice: "30000000-0000-4000-8000-000000000010",
  evidenceDesign: "30000000-0000-4000-8000-000000000011",
  evidenceTask: "30000000-0000-4000-8000-000000000012",
  evidenceSchedule: "30000000-0000-4000-8000-000000000013",
} as const;

function quotedList(values: readonly string[]) {
  return values.map((value) => `'${value}'`).join(",");
}

describe("Project Work Queue V3 and reviewed legacy triage migration", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await database.waitReady;
    await database.exec(bootstrap);
    await database.exec(v2Migration);
    await database.exec(schemaCacheRepair);

    // The compact V2 bootstrap intentionally models only the columns needed by
    // its original test. Add the existing production columns read by the
    // classifier before exercising the new migration.
    await database.exec(`
      alter table public.project_running_job_meta
        add column if not exists materials_ordered_at timestamptz,
        add column if not exists roofing_ordered_at timestamptz;
      alter table public.followup_tasks
        add column if not exists type text,
        add column if not exists completed_at timestamptz;
      alter table public.project_manual_actions
        add column if not exists status text,
        add column if not exists completed_at timestamptz;
      create table if not exists public.design_package_requests (
        id uuid primary key default gen_random_uuid(),
        project_id uuid not null references public.projects(id),
        status text not null
      );
    `);

    await database.exec(workQueueMigration);
    await database.exec(workQueueMigration);
    await database.exec(`
      insert into auth.users(id,email)
      values
        ('${ADMIN_ID}','admin@example.invalid'),
        ('${STAFF_ID}','staff@example.invalid');
      insert into public.portal_users(user_id,role)
      values
        ('${ADMIN_ID}','admin'),
        ('${STAFF_ID}','staff');
      select set_config('request.jwt.claim.sub','${ADMIN_ID}',false);
      insert into public.contacts(id,name,email)
      values ('${CONTACT_ID}','Fixture Customer','customer@example.invalid');
    `);
  }, 60_000);

  afterAll(async () => {
    await database.close();
  });

  it("grants only the intended authenticated entry points", async () => {
    const privileges = await database.query<{
      routine: string;
      authenticated: boolean;
      anonymous: boolean;
      service: boolean;
    }>(`
      select
        routine,
        has_function_privilege('authenticated', routine, 'EXECUTE')
          as authenticated,
        has_function_privilege('anon', routine, 'EXECUTE') as anonymous,
        has_function_privilege('service_role', routine, 'EXECUTE') as service
      from unnest(array[
        'public.project_work_queue_v3(timestamptz,integer)',
        'public.project_confirmation_retraction_command(uuid,uuid,uuid,text)',
        'public.project_confirmation_retraction_review_command(uuid,uuid,bigint,uuid,text)',
        'public.project_work_classify_legacy_contacted_v1(date,integer,jsonb,text)',
        'public.project_work_migrate_legacy_contacted_v1(uuid,uuid,timestamptz,text,text,text,text,text,timestamptz,timestamptz,text)'
      ]) routine
      order by routine
    `);

    expect(privileges.rows).toHaveLength(5);
    expect(privileges.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authenticated: true,
          anonymous: false,
          service: false,
        }),
      ]),
    );
    expect(
      privileges.rows.every(
        (row) => row.authenticated && !row.anonymous && !row.service,
      ),
    ).toBe(true);

    const helperPrivileges = await database.query<{
      authenticated: boolean;
      anonymous: boolean;
      service: boolean;
    }>(`
      select
        has_function_privilege(
          'authenticated',
          'public.project_work_legacy_contacted_evidence_v1(uuid)',
          'EXECUTE'
        ) as authenticated,
        has_function_privilege(
          'anon',
          'public.project_work_legacy_contacted_evidence_v1(uuid)',
          'EXECUTE'
        ) as anonymous,
        has_function_privilege(
          'service_role',
          'public.project_work_legacy_contacted_evidence_v1(uuid)',
          'EXECUTE'
        ) as service
    `);
    expect(helperPrivileges.rows).toEqual([
      {
        authenticated: false,
        anonymous: false,
        service: false,
      },
    ]);
  });

  it("returns one authoritative row per project in operational queue groups", async () => {
    const queueProjectIds = [
      PROJECTS.overdue,
      PROJECTS.today,
      PROJECTS.upcoming,
      PROJECTS.blocked,
      PROJECTS.triage,
    ];
    for (const [index, projectId] of queueProjectIds.entries()) {
      await database.query(`
        select * from public.project_create_v2(
          '${projectId}',
          '${CONTACT_ID}',
          'Queue fixture ${index + 1}',
          null,
          'Auckland',
          null
        )
      `);
    }

    await database.exec(`
      select set_config('sanctuary.project_work_command','allowed',false);

      update public.project_work_items
      set
        due_at='2026-07-27T03:00:00Z',
        sla_breach_at=null,
        updated_at=clock_timestamp()
      where project_id='${PROJECTS.overdue}';
      insert into public.project_work_items(
        project_id,title,responsibility_area,status,due_at,deadline_policy,
        priority,origin,source_type,created_by,updated_by
      ) values (
        '${PROJECTS.overdue}','Later duplicate obligation','ADMIN','OPEN',
        '2026-07-31T03:00:00Z','MANUAL','NORMAL','MANUAL','MANUAL',
        '${ADMIN_ID}','${ADMIN_ID}'
      );

      update public.project_work_items
      set
        due_at='2026-07-29T04:00:00Z',
        sla_breach_at=null,
        updated_at=clock_timestamp()
      where project_id='${PROJECTS.today}';

      update public.project_work_items
      set
        due_at='2026-07-31T04:00:00Z',
        sla_breach_at=null,
        updated_at=clock_timestamp()
      where project_id='${PROJECTS.upcoming}';

      update public.project_work_items
      set
        status='BLOCKED',
        blocked_reason='Supplier information is required',
        due_at='2026-07-29T04:00:00Z',
        sla_breach_at=null,
        updated_at=clock_timestamp()
      where project_id='${PROJECTS.blocked}';

      update public.project_work_items
      set
        status='CANCELLED',
        cancelled_at=clock_timestamp(),
        cancelled_by='${ADMIN_ID}',
        cancellation_reason='Reviewed for triage test',
        updated_at=clock_timestamp()
      where project_id='${PROJECTS.triage}';

      select set_config('sanctuary.project_work_command','',false);
    `);

    const queue = await database.query<{
      project_id: string;
      queue_group: string;
      action_kind: string;
      title: string;
    }>(`
      select project_id,queue_group,action_kind,title
      from public.project_work_queue_v3('${NOW}',200)
      where project_id in (${quotedList(queueProjectIds)})
      order by project_id
    `);

    expect(queue.rows).toHaveLength(queueProjectIds.length);
    expect(new Set(queue.rows.map((row) => row.project_id)).size).toBe(
      queueProjectIds.length,
    );
    expect(queue.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          project_id: PROJECTS.overdue,
          queue_group: "overdue",
          action_kind: "WORK_ITEM",
        }),
        expect.objectContaining({
          project_id: PROJECTS.today,
          queue_group: "today",
          action_kind: "WORK_ITEM",
        }),
        expect.objectContaining({
          project_id: PROJECTS.upcoming,
          queue_group: "nextSevenBusinessDays",
          action_kind: "WORK_ITEM",
        }),
        expect.objectContaining({
          project_id: PROJECTS.blocked,
          queue_group: "blocked",
          action_kind: "WORK_ITEM",
          title: "Review blocked project work",
        }),
        expect.objectContaining({
          project_id: PROJECTS.triage,
          queue_group: "needsTriage",
          action_kind: "NEEDS_TRIAGE",
        }),
      ]),
    );
  });

  it("targets one confirmation repair signal and rejects a stale old signal", async () => {
    await database.query(`
      select * from public.project_create_v2(
        '${PROJECTS.corrected}',
        '${CONTACT_ID}',
        'Confirmation correction fixture',
        null,
        'Auckland',
        null
      )
    `);
    const firstConfirmation = await database.query<{
      result: { confirmation_event_id: string };
    }>(`
      select public.project_confirmation_command(
        '${PROJECTS.corrected}',
        '40000000-0000-4000-8000-000000000001',
        'RECORD_FIRST_ENQUIRY_EMAIL_SENT',
        '{"occurredAt":"2026-07-29T01:00:00Z"}'::jsonb
      ) as result
    `);
    const followUpConfirmation = await database.query<{
      result: { confirmation_event_id: string };
    }>(`
      select public.project_confirmation_command(
        '${PROJECTS.corrected}',
        '40000000-0000-4000-8000-000000000002',
        'RECORD_ENQUIRY_FOLLOW_UP_EMAIL_SENT',
        '{"occurredAt":"2026-07-29T01:30:00Z"}'::jsonb
      ) as result
    `);
    const firstConfirmationId =
      firstConfirmation.rows[0]?.result.confirmation_event_id;
    const followUpConfirmationId =
      followUpConfirmation.rows[0]?.result.confirmation_event_id;

    const firstCorrection = await database.query<{
      result: {
        replayed: boolean;
        review_required: boolean;
        retraction_event_id: string;
        repair_signal_id: string;
      };
    }>(`
      select public.project_confirmation_retraction_command(
        '${PROJECTS.corrected}',
        '40000000-0000-4000-8000-000000000003',
        '${firstConfirmationId}',
        'The first email was recorded against the wrong message'
      ) as result
    `);
    const newerCorrection = await database.query<{
      result: {
        replayed: boolean;
        review_required: boolean;
        retraction_event_id: string;
        repair_signal_id: string;
      };
    }>(`
      select public.project_confirmation_retraction_command(
        '${PROJECTS.corrected}',
        '40000000-0000-4000-8000-000000000004',
        '${followUpConfirmationId}',
        'The follow-up email was recorded against the wrong message'
      ) as result
    `);
    const firstSignalId = firstCorrection.rows[0]?.result.repair_signal_id;
    const newerSignalId = newerCorrection.rows[0]?.result.repair_signal_id;
    expect(firstCorrection.rows[0]?.result).toEqual(
      expect.objectContaining({
        replayed: false,
        review_required: true,
      }),
    );
    expect(newerCorrection.rows[0]?.result).toEqual(
      expect.objectContaining({
        replayed: false,
        review_required: true,
      }),
    );

    const events = await database.query<{
      event_kind: string;
      retracts_event_id: string | null;
      reason: string | null;
    }>(`
      select event_kind,retracts_event_id,reason
      from public.project_confirmation_events
      where project_id='${PROJECTS.corrected}'
      order by recorded_at,id
    `);
    expect(events.rows).toHaveLength(4);
    expect(events.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_kind: "RETRACTED",
          retracts_event_id: firstConfirmationId,
          reason: "The first email was recorded against the wrong message",
        }),
        expect.objectContaining({
          event_kind: "RETRACTED",
          retracts_event_id: followUpConfirmationId,
          reason: "The follow-up email was recorded against the wrong message",
        }),
      ]),
    );

    const queue = await database.query<{
      queue_group: string;
      action_kind: string;
      subject_kind: string | null;
      subject_id: string | null;
      repair_signal_id: string | null;
      repair_signal_row_version: number | null;
    }>(`
      select
        queue_group,
        action_kind,
        subject_kind,
        subject_id,
        repair_signal_id,
        repair_signal_row_version
      from public.project_work_queue_v3('${NOW}',200)
      where project_id='${PROJECTS.corrected}'
    `);
    expect(queue.rows).toEqual([
      {
        queue_group: "blocked",
        action_kind: "REPAIR",
        subject_kind: "CONFIRMATION_EVENT",
        subject_id: firstConfirmationId,
        repair_signal_id: firstSignalId,
        repair_signal_row_version: 1,
      },
    ]);

    const review = await database.query<{
      result: {
        project_id: string;
        repair_signal_id: string;
        signal_row_version: number;
        resolved_count: number;
        replayed: boolean;
        refresh_required: boolean;
      };
    }>(`
      select public.project_confirmation_retraction_review_command(
        '${PROJECTS.corrected}',
        '${firstSignalId}',
        1,
        '40000000-0000-4000-8000-000000000005',
        'Current work and lifecycle state were checked after correction'
      ) as result
    `);
    expect(review.rows[0]?.result).toEqual({
      project_id: PROJECTS.corrected,
      repair_signal_id: firstSignalId,
      signal_row_version: 2,
      resolved_count: 1,
      replayed: false,
      refresh_required: false,
    });

    const reviewedSignals = await database.query<{
      id: string;
      status: string;
      row_version: number;
    }>(`
      select id,status,row_version
      from public.project_work_repair_signals
      where id in ('${firstSignalId}','${newerSignalId}')
      order by first_detected_at,id
    `);
    expect(reviewedSignals.rows).toEqual([
      { id: firstSignalId, status: "RESOLVED", row_version: 2 },
      { id: newerSignalId, status: "OPEN", row_version: 1 },
    ]);

    const audit = await database.query<{
      event_type: string;
      reason: string | null;
      before_state: { id: string; status: string; row_version: number };
      after_state: { id: string; status: string; row_version: number };
    }>(`
      select event_type,reason,before_state,after_state
      from public.project_state_events
      where command_id='40000000-0000-4000-8000-000000000005'
    `);
    expect(audit.rows).toEqual([
      expect.objectContaining({
        event_type: "CONFIRMATION_RETRACTION_REVIEWED",
        reason:
          "Current work and lifecycle state were checked after correction",
        before_state: expect.objectContaining({
          id: firstSignalId,
          status: "OPEN",
          row_version: 1,
        }),
        after_state: expect.objectContaining({
          id: firstSignalId,
          status: "RESOLVED",
          row_version: 2,
        }),
      }),
    ]);

    const nextQueue = await database.query<{
      repair_signal_id: string | null;
      repair_signal_row_version: number | null;
      subject_id: string | null;
    }>(`
      select repair_signal_id,repair_signal_row_version,subject_id
      from public.project_work_queue_v3('${NOW}',200)
      where project_id='${PROJECTS.corrected}'
    `);
    expect(nextQueue.rows).toEqual([
      {
        repair_signal_id: newerSignalId,
        repair_signal_row_version: 1,
        subject_id: followUpConfirmationId,
      },
    ]);

    const reviewReplay = await database.query<{
      result: {
        repair_signal_id: string;
        signal_row_version: number;
        resolved_count: number;
        replayed: boolean;
      };
    }>(`
      select public.project_confirmation_retraction_review_command(
        '${PROJECTS.corrected}',
        '${firstSignalId}',
        1,
        '40000000-0000-4000-8000-000000000005',
        'Current work and lifecycle state were checked after correction'
      ) as result
    `);
    expect(reviewReplay.rows[0]?.result).toEqual(
      expect.objectContaining({
        repair_signal_id: firstSignalId,
        signal_row_version: 2,
        resolved_count: 1,
        replayed: true,
      }),
    );

    await expect(
      database.query(`
        select public.project_confirmation_retraction_review_command(
          '${PROJECTS.corrected}',
          '${firstSignalId}',
          1,
          '40000000-0000-4000-8000-000000000006',
          'Stale review must not resolve newer work'
        )
      `),
    ).rejects.toThrow(/CONFIRMATION_RETRACTION_REVIEW_STALE/i);

    const staleSafety = await database.query<{
      newer_status: string;
      newer_row_version: number;
      stale_events: number;
      stale_receipts: number;
    }>(`
      select
        (
          select status
          from public.project_work_repair_signals
          where id='${newerSignalId}'
        ) as newer_status,
        (
          select row_version
          from public.project_work_repair_signals
          where id='${newerSignalId}'
        ) as newer_row_version,
        (
          select count(*)::integer
          from public.project_state_events
          where command_id='40000000-0000-4000-8000-000000000006'
        ) as stale_events,
        (
          select count(*)::integer
          from public.project_command_receipts
          where command_id='40000000-0000-4000-8000-000000000006'
        ) as stale_receipts
    `);
    expect(staleSafety.rows).toEqual([
      {
        newer_status: "OPEN",
        newer_row_version: 1,
        stale_events: 0,
        stale_receipts: 0,
      },
    ]);
  });

  it("classifies without contact data and migrates only the reviewed project", async () => {
    await database.exec(`
      insert into public.projects(
        id,contact_id,name,pipeline_stage,follow_up_date,updated_at
      ) values
        (
          '${PROJECTS.legacy}','${CONTACT_ID}','Legacy reviewed fixture',
          'CONTACTED','2026-07-28','2026-07-29T00:00:00Z'
        ),
        (
          '${PROJECTS.untouchedLegacy}','${CONTACT_ID}','Legacy untouched fixture',
          'CONTACTED','2026-07-28','2026-07-29T00:30:00Z'
        );
    `);

    const classified = await database.query<{
      result: {
        projects: Array<Record<string, unknown>>;
        summary: Record<string, unknown>;
      };
    }>(`
      select public.project_work_classify_legacy_contacted_v1(
        '2026-07-29',50,null,'due'
      ) as result
    `);
    const reviewed = classified.rows[0]?.result.projects.find(
      (project) => project.projectId === PROJECTS.legacy,
    );
    expect(reviewed).toEqual(
      expect.objectContaining({
        projectId: PROJECTS.legacy,
        projectName: "Legacy reviewed fixture",
        pipelineStage: "contacted",
        recommendation: "MANUAL_CLASSIFICATION",
        evidenceFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    const evidenceFingerprint =
      typeof reviewed?.evidenceFingerprint === "string"
        ? reviewed.evidenceFingerprint
        : "";
    expect(JSON.stringify(classified.rows[0]?.result)).not.toMatch(
      /customerEmail|contactEmail|emailAddress|phone|contactId/i,
    );

    const migration = await database.query<{
      result: {
        disposition: string;
        operational_state: string;
        work_item_id: string;
        replayed: boolean;
      };
    }>(`
      select public.project_work_migrate_legacy_contacted_v1(
        '${PROJECTS.legacy}',
        '50000000-0000-4000-8000-000000000001',
        '2026-07-29T00:00:00Z',
        '${evidenceFingerprint}',
        'ACTIVE_WORK',
        'Reviewed individually and customer work remains active',
        'Email customer with the requested information',
        'CUSTOMER',
        '2026-07-30T04:00:00Z',
        null,
        null
      ) as result
    `);
    expect(migration.rows[0]?.result).toEqual(
      expect.objectContaining({
        disposition: "ACTIVE_WORK",
        operational_state: "ACTIVE",
        replayed: false,
      }),
    );

    const state = await database.query<{
      project_id: string;
      reason: string;
      state: string;
      source_type: string;
      origin: string;
    }>(`
      select
        model.project_id,
        model.reason,
        state.state,
        item.source_type,
        item.origin
      from public.project_work_model_versions model
      join public.project_operational_states state using(project_id)
      join public.project_work_items item using(project_id)
      where model.project_id='${PROJECTS.legacy}'
    `);
    expect(state.rows).toEqual([
      {
        project_id: PROJECTS.legacy,
        reason: "REVIEWED_MIGRATION",
        state: "ACTIVE",
        source_type: "LEGACY_REVIEW",
        origin: "REVIEWED_MIGRATION",
      },
    ]);

    const safety = await database.query<{
      untouched_markers: number;
      cadence_items: number;
      confirmation_events: number;
      followup_tasks: number;
      archived_projects: number;
    }>(`
      select
        (
          select count(*)::integer
          from public.project_work_model_versions
          where project_id='${PROJECTS.untouchedLegacy}'
        ) as untouched_markers,
        (
          select count(*)::integer
          from public.project_work_items
          where project_id in (
            '${PROJECTS.legacy}','${PROJECTS.untouchedLegacy}'
          )
            and source_type in ('LEAD_CADENCE','QUOTE_CADENCE')
        ) as cadence_items,
        (
          select count(*)::integer
          from public.project_confirmation_events
          where project_id in (
            '${PROJECTS.legacy}','${PROJECTS.untouchedLegacy}'
          )
        ) as confirmation_events,
        (
          select count(*)::integer
          from public.followup_tasks
          where project_id in (
            '${PROJECTS.legacy}','${PROJECTS.untouchedLegacy}'
          )
        ) as followup_tasks,
        (
          select count(*)::integer
          from public.projects
          where id in ('${PROJECTS.legacy}','${PROJECTS.untouchedLegacy}')
            and archived_at is not null
        ) as archived_projects
    `);
    expect(safety.rows[0]).toEqual({
      untouched_markers: 0,
      cadence_items: 0,
      confirmation_events: 0,
      followup_tasks: 0,
      archived_projects: 0,
    });
  });

  it("rejects stale related evidence and accepts a refreshed fingerprint", async () => {
    const evidenceProjects = [
      PROJECTS.evidenceQuote,
      PROJECTS.evidenceInvoice,
      PROJECTS.evidenceDesign,
      PROJECTS.evidenceTask,
      PROJECTS.evidenceSchedule,
    ];
    await database.exec(`
      insert into public.projects(
        id,contact_id,name,pipeline_stage,follow_up_date,updated_at
      ) values
        (
          '${PROJECTS.evidenceQuote}','${CONTACT_ID}','Quote evidence fixture',
          'CONTACTED','2026-07-28','2026-07-29T03:00:00Z'
        ),
        (
          '${PROJECTS.evidenceInvoice}','${CONTACT_ID}','Invoice evidence fixture',
          'CONTACTED','2026-07-28','2026-07-29T03:00:00Z'
        ),
        (
          '${PROJECTS.evidenceDesign}','${CONTACT_ID}','Design evidence fixture',
          'CONTACTED','2026-07-28','2026-07-29T03:00:00Z'
        ),
        (
          '${PROJECTS.evidenceTask}','${CONTACT_ID}','Task evidence fixture',
          'CONTACTED','2026-07-28','2026-07-29T03:00:00Z'
        ),
        (
          '${PROJECTS.evidenceSchedule}','${CONTACT_ID}','Schedule evidence fixture',
          'CONTACTED','2026-07-28','2026-07-29T03:00:00Z'
        );
    `);

    type EvidenceProject = {
      projectId: string;
      updatedAt: string;
      evidenceFingerprint: string;
      recommendation: string;
      evidence: Record<string, boolean>;
    };
    const classify = async () => {
      const classified = await database.query<{
        result: { projects: EvidenceProject[] };
      }>(`
        select public.project_work_classify_legacy_contacted_v1(
          '2026-07-29',100,null,'all'
        ) as result
      `);
      return new Map(
        classified.rows[0]?.result.projects
          .filter((project) =>
            evidenceProjects.includes(
              project.projectId as (typeof evidenceProjects)[number],
            ),
          )
          .map((project) => [project.projectId, project]),
      );
    };

    const initial = await classify();
    expect(initial.size).toBe(evidenceProjects.length);
    for (const projectId of evidenceProjects) {
      expect(initial.get(projectId)).toEqual(
        expect.objectContaining({
          projectId,
          recommendation: "MANUAL_CLASSIFICATION",
          evidenceFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
        }),
      );
    }

    await database.exec(`
      insert into public.quotes(id,project_id)
      values (
        '71000000-0000-4000-8000-000000000001',
        '${PROJECTS.evidenceQuote}'
      );
      insert into public.quote_versions(
        id,quote_id,version_number,status
      ) values (
        '72000000-0000-4000-8000-000000000001',
        '71000000-0000-4000-8000-000000000001',
        1,
        'DRAFT'
      );
      insert into public.deposit_invoices(id,project_id,status)
      values (
        '73000000-0000-4000-8000-000000000001',
        '${PROJECTS.evidenceInvoice}',
        'OPEN'
      );
      insert into public.design_package_requests(id,project_id,status)
      values (
        '74000000-0000-4000-8000-000000000001',
        '${PROJECTS.evidenceDesign}',
        'OPEN'
      );
      insert into public.tasks(
        id,project_id,type,status,title,idempotency_key
      ) values (
        '75000000-0000-4000-8000-000000000001',
        '${PROJECTS.evidenceTask}',
        'MANUAL',
        'OPEN',
        'Review related legacy task',
        'work-queue-evidence-task-1'
      );
      insert into public.scheduled_jobs(id,job_id,status)
      values (
        '76000000-0000-4000-8000-000000000001',
        '${PROJECTS.evidenceSchedule}',
        'SCHEDULED'
      );
    `);

    const unchangedProjects = await database.query<{ changed: number }>(`
      select count(*)::integer as changed
      from public.projects
      where id in (${quotedList(evidenceProjects)})
        and updated_at <> '2026-07-29T03:00:00Z'
    `);
    expect(unchangedProjects.rows).toEqual([{ changed: 0 }]);

    const staleCases = [
      {
        projectId: PROJECTS.evidenceQuote,
        commandId: "77000000-0000-4000-8000-000000000001",
      },
      {
        projectId: PROJECTS.evidenceInvoice,
        commandId: "77000000-0000-4000-8000-000000000002",
      },
      {
        projectId: PROJECTS.evidenceDesign,
        commandId: "77000000-0000-4000-8000-000000000003",
      },
      {
        projectId: PROJECTS.evidenceTask,
        commandId: "77000000-0000-4000-8000-000000000004",
      },
      {
        projectId: PROJECTS.evidenceSchedule,
        commandId: "77000000-0000-4000-8000-000000000005",
      },
    ] as const;
    for (const staleCase of staleCases) {
      const snapshot = initial.get(staleCase.projectId);
      expect(snapshot).toBeDefined();
      await expect(
        database.query(`
          select public.project_work_migrate_legacy_contacted_v1(
            '${staleCase.projectId}',
            '${staleCase.commandId}',
            '${snapshot?.updatedAt}',
            '${snapshot?.evidenceFingerprint}',
            'ACTIVE_TRIAGE',
            'Reviewed before related evidence changed'
          )
        `),
      ).rejects.toThrow(/LEGACY_CONTACTED_EVIDENCE_STALE/i);
    }

    const staleSafety = await database.query<{
      model_rows: number;
      state_rows: number;
      work_rows: number;
      event_rows: number;
      receipt_rows: number;
    }>(`
      select
        (
          select count(*)::integer
          from public.project_work_model_versions
          where project_id in (${quotedList(evidenceProjects)})
        ) as model_rows,
        (
          select count(*)::integer
          from public.project_operational_states
          where project_id in (${quotedList(evidenceProjects)})
        ) as state_rows,
        (
          select count(*)::integer
          from public.project_work_items
          where project_id in (${quotedList(evidenceProjects)})
        ) as work_rows,
        (
          select count(*)::integer
          from public.project_state_events
          where command_id in (
            ${quotedList(staleCases.map((entry) => entry.commandId))}
          )
        ) as event_rows,
        (
          select count(*)::integer
          from public.project_command_receipts
          where command_id in (
            ${quotedList(staleCases.map((entry) => entry.commandId))}
          )
        ) as receipt_rows
    `);
    expect(staleSafety.rows).toEqual([
      {
        model_rows: 0,
        state_rows: 0,
        work_rows: 0,
        event_rows: 0,
        receipt_rows: 0,
      },
    ]);

    const refreshed = await classify();
    const expectedEvidence = [
      [PROJECTS.evidenceQuote, "currentQuote"],
      [PROJECTS.evidenceInvoice, "currentInvoice"],
      [PROJECTS.evidenceDesign, "currentDesign"],
      [PROJECTS.evidenceTask, "openObligation"],
      [PROJECTS.evidenceSchedule, "currentSchedule"],
    ] as const;
    for (const [projectId, evidenceKey] of expectedEvidence) {
      const before = initial.get(projectId);
      const after = refreshed.get(projectId);
      expect(after?.evidenceFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(after?.evidenceFingerprint).not.toBe(before?.evidenceFingerprint);
      expect(after?.recommendation).toBe("ACTIVE_EVIDENCE");
      expect(after?.evidence[evidenceKey]).toBe(true);
    }

    const scheduleSnapshot = refreshed.get(PROJECTS.evidenceSchedule);
    const freshMigration = await database.query<{
      result: {
        project_id: string;
        disposition: string;
        operational_state: string;
        replayed: boolean;
      };
    }>(`
      select public.project_work_migrate_legacy_contacted_v1(
        '${PROJECTS.evidenceSchedule}',
        '78000000-0000-4000-8000-000000000001',
        '${scheduleSnapshot?.updatedAt}',
        '${scheduleSnapshot?.evidenceFingerprint}',
        'ACTIVE_TRIAGE',
        'Reviewed again after schedule evidence changed'
      ) as result
    `);
    expect(freshMigration.rows[0]?.result).toEqual(
      expect.objectContaining({
        project_id: PROJECTS.evidenceSchedule,
        disposition: "ACTIVE_TRIAGE",
        operational_state: "ACTIVE",
        replayed: false,
      }),
    );

    const freshSafety = await database.query<{
      schedule_markers: number;
      other_markers: number;
      schedule_states: number;
      schedule_events: number;
      schedule_receipts: number;
    }>(`
      select
        (
          select count(*)::integer
          from public.project_work_model_versions
          where project_id='${PROJECTS.evidenceSchedule}'
        ) as schedule_markers,
        (
          select count(*)::integer
          from public.project_work_model_versions
          where project_id in (
            '${PROJECTS.evidenceQuote}',
            '${PROJECTS.evidenceInvoice}',
            '${PROJECTS.evidenceDesign}',
            '${PROJECTS.evidenceTask}'
          )
        ) as other_markers,
        (
          select count(*)::integer
          from public.project_operational_states
          where project_id='${PROJECTS.evidenceSchedule}'
            and state='ACTIVE'
        ) as schedule_states,
        (
          select count(*)::integer
          from public.project_state_events
          where command_id='78000000-0000-4000-8000-000000000001'
        ) as schedule_events,
        (
          select count(*)::integer
          from public.project_command_receipts
          where command_id='78000000-0000-4000-8000-000000000001'
        ) as schedule_receipts
    `);
    expect(freshSafety.rows).toEqual([
      {
        schedule_markers: 1,
        other_markers: 0,
        schedule_states: 1,
        schedule_events: 1,
        schedule_receipts: 1,
      },
    ]);
  });

  it("enforces admin-only correction and reviewed migration at runtime", async () => {
    await database.exec(`
      select set_config('request.jwt.claim.sub','${STAFF_ID}',false)
    `);
    await expect(
      database.query(`
      select public.project_work_classify_legacy_contacted_v1(
        '2026-07-29',50,null,'due'
      )
    `),
    ).rejects.toThrow(/admin access required/i);
    await expect(
      database.query(`
      select public.project_work_migrate_legacy_contacted_v1(
        '${PROJECTS.untouchedLegacy}',
        '60000000-0000-4000-8000-000000000001',
        '2026-07-29T00:30:00Z',
        '0000000000000000000000000000000000000000000000000000000000000000',
        'ACTIVE_TRIAGE',
        'Staff must not run reviewed migration',
        null,null,null,null,null
      )
    `),
    ).rejects.toThrow(/admin access required/i);
    await expect(
      database.query(`
      select public.project_confirmation_retraction_review_command(
        '${PROJECTS.corrected}',
        '60000000-0000-4000-8000-000000000003',
        1,
        '60000000-0000-4000-8000-000000000002',
        'Staff must not resolve correction reviews'
      )
    `),
    ).rejects.toThrow(/admin access required/i);

    const queue = await database.query<{ project_id: string }>(`
      select project_id
      from public.project_work_queue_v3('${NOW}',200)
      limit 1
    `);
    expect(queue.rows.length).toBe(1);
    await database.exec(`
      select set_config('request.jwt.claim.sub','${ADMIN_ID}',false)
    `);
  });

  it("keeps the migration command singular and free of bulk or customer side effects", () => {
    const migrateFunction = workQueueMigration.slice(
      workQueueMigration.indexOf(
        "create or replace function public.project_work_migrate_legacy_contacted_v1",
      ),
      workQueueMigration.indexOf(
        "revoke all on function public.project_work_queue_v3",
      ),
    );
    expect(migrateFunction).toContain("p_project_id uuid");
    expect(migrateFunction).not.toMatch(
      /p_project_ids|uuid\[\]|jsonb_array_elements/i,
    );
    expect(migrateFunction).not.toMatch(
      /insert\s+into\s+public\.(followup_tasks|tasks|project_confirmation_events)/i,
    );
    expect(migrateFunction).not.toMatch(
      /update\s+public\.projects[\s\S]{0,300}archived_at\s*=/i,
    );
    expect(migrateFunction).not.toMatch(/send|email_outbox|resend/i);
  });
});
