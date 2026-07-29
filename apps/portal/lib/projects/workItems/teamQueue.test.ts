import { describe, expect, it, vi } from "vitest";
import type { ProjectWorkQueueEntry } from "./types";
import {
  composeProjectWorkQueue,
  getAuthoritativeProjectWorkQueue,
  type ActiveProjectDomainCandidate,
} from "./teamQueue";

const PROJECT_UUID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = `proj_${PROJECT_UUID}`;

function entry(
  overrides: Partial<ProjectWorkQueueEntry> = {},
): ProjectWorkQueueEntry {
  return {
    projectId: PROJECT_ID,
    projectName: "Queue fixture",
    stage: "contacted",
    group: "nextSevenBusinessDays",
    actionKind: "workItem",
    title: "Email customer",
    reason: "This is the earliest current project obligation.",
    dueAt: "2026-07-31T04:00:00.000Z",
    priority: "NORMAL",
    blockedReason: null,
    effectiveAssignee: { kind: "unassigned" },
    workItemId: "22222222-2222-4222-8222-222222222222",
    workItemRowVersion: 2,
    stateRowVersion: 3,
    sourceType: "LEAD_CADENCE",
    sourceKey: `lead:follow-up:${PROJECT_UUID}:v1`,
    subjectKind: "PROJECT",
    subjectId: PROJECT_UUID,
    repairSignalId: null,
    repairSignalRowVersion: null,
    href: `/staff/projects/${PROJECT_ID}?tab=activity`,
    ...overrides,
  };
}

function candidate(
  params: {
    projectId?: string;
    recovery?: boolean;
    specialist?: boolean;
  } = {},
): ActiveProjectDomainCandidate {
  const projectId = params.projectId ?? PROJECT_ID;
  return {
    projectUuid: projectId.replace(/^proj_/, ""),
    projectId,
    projectName: `Candidate ${projectId}`,
    stage: "quoting",
    projectOwnerKey: "jordan",
    actions: {
      recoveryAction: params.recovery
        ? {
            kind: "recovery",
            key: `recovery:${projectId}`,
            title: "Recover quote delivery",
            reason: "The authoritative quote delivery record failed.",
            href: `/recover/${projectId}`,
          }
        : null,
      specialistAction: params.specialist
        ? {
            kind: "specialist",
            key: `specialist:${projectId}`,
            title: "Prepare the quote",
            reason: "The current estimate is ready.",
            owner: "Commercial",
            expectedResult: "A draft quote is created.",
            href: `/quote/${projectId}`,
          }
        : null,
    },
  };
}

describe("composeProjectWorkQueue", () => {
  it("keeps exactly the most urgent durable row for each project", () => {
    const result = composeProjectWorkQueue({
      durableEntries: [
        entry(),
        entry({
          group: "overdue",
          title: "Overdue customer email",
          dueAt: "2026-07-28T04:00:00.000Z",
        }),
      ],
      domainCandidates: [],
      limit: 200,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      projectId: PROJECT_ID,
      group: "overdue",
      title: "Overdue customer email",
    });
  });

  it("promotes recovery above durable work and links to the owning surface", () => {
    const result = composeProjectWorkQueue({
      durableEntries: [
        entry({
          group: "overdue",
          dueAt: "2026-07-28T04:00:00.000Z",
        }),
      ],
      domainCandidates: [candidate({ recovery: true })],
      limit: 200,
    });

    expect(result).toEqual([
      expect.objectContaining({
        projectId: PROJECT_ID,
        group: "blocked",
        actionKind: "recovery",
        title: "Recover quote delivery",
        href: `/recover/${PROJECT_ID}`,
        effectiveAssignee: {
          kind: "projectOwner",
          ownerKey: "jordan",
        },
        workItemId: null,
      }),
    ]);
  });

  it("uses a ready specialist action for quiet work but not urgent work", () => {
    const quiet = composeProjectWorkQueue({
      durableEntries: [
        entry({
          group: "needsTriage",
          actionKind: "needsTriage",
          title: "Needs triage",
          dueAt: null,
          priority: null,
          workItemId: null,
          workItemRowVersion: null,
          sourceType: null,
          sourceKey: null,
          subjectKind: null,
          subjectId: null,
        }),
      ],
      domainCandidates: [candidate({ specialist: true })],
      limit: 200,
    });
    expect(quiet[0]).toMatchObject({
      group: "today",
      actionKind: "specialist",
      title: "Prepare the quote",
      reason: "Ready now. The current estimate is ready.",
    });

    const urgent = composeProjectWorkQueue({
      durableEntries: [
        entry({
          group: "today",
          dueAt: "2026-07-29T04:00:00.000Z",
        }),
      ],
      domainCandidates: [candidate({ specialist: true })],
      limit: 200,
    });
    expect(urgent[0]).toMatchObject({
      group: "today",
      actionKind: "workItem",
      title: "Email customer",
    });
  });

  it("sorts by operational group and honours the result limit", () => {
    const ids = {
      blocked: "proj_30000000-0000-4000-8000-000000000001",
      today: "proj_30000000-0000-4000-8000-000000000002",
      overdue: "proj_30000000-0000-4000-8000-000000000003",
    };
    const result = composeProjectWorkQueue({
      durableEntries: [
        entry({
          projectId: ids.blocked,
          group: "blocked",
          actionKind: "needsTriage",
          blockedReason: "Waiting for supplier",
        }),
        entry({
          projectId: ids.today,
          group: "today",
          dueAt: "2026-07-29T04:00:00.000Z",
        }),
        entry({
          projectId: ids.overdue,
          group: "overdue",
          dueAt: "2026-07-28T04:00:00.000Z",
        }),
      ],
      domainCandidates: [],
      limit: 2,
    });

    expect(result.map((row) => row.projectId)).toEqual([
      ids.overdue,
      ids.today,
    ]);
  });
});

function emptyProjectsQuery() {
  const builder: any = {
    select: vi.fn(() => builder),
    is: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return builder;
}

describe("getAuthoritativeProjectWorkQueue", () => {
  it("maps the richer V3 RPC contract and effective assignee metadata", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          project_id: PROJECT_UUID,
          project_name: "Mapped fixture",
          pipeline_stage: "CONTACTED",
          queue_group: "today",
          action_kind: "WORK_ITEM",
          title: "Send first enquiry email",
          reason: "This project work is due today.",
          due_at: "2026-07-29T04:00:00.000Z",
          priority: "NORMAL",
          blocked_reason: null,
          assignee_user_id: null,
          project_owner_key: "jordan",
          work_item_id: "22222222-2222-4222-8222-222222222222",
          work_item_row_version: 4,
          source_type: "LEAD_CADENCE",
          source_key: `lead:first-email:${PROJECT_UUID}:v1`,
          subject_kind: "PROJECT",
          subject_id: PROJECT_UUID,
          repair_signal_id: null,
          repair_signal_row_version: null,
          state_row_version: 3,
        },
      ],
      error: null,
    });
    const projects = emptyProjectsQuery();
    const supabase = {
      rpc,
      from: vi.fn(() => projects),
    } as any;
    const now = new Date("2026-07-29T02:00:00.000Z");

    const result = await getAuthoritativeProjectWorkQueue(supabase, {
      now,
      limit: 25,
    });

    expect(result.generatedAt).toBe(now.toISOString());
    expect(result.entries).toEqual([
      expect.objectContaining({
        projectId: PROJECT_ID,
        projectName: "Mapped fixture",
        stage: "contacted",
        group: "today",
        actionKind: "workItem",
        workItemRowVersion: 4,
        stateRowVersion: 3,
        sourceType: "LEAD_CADENCE",
        effectiveAssignee: {
          kind: "projectOwner",
          ownerKey: "jordan",
        },
      }),
    ]);
    expect(rpc).toHaveBeenCalledWith("project_work_queue_v3", {
      p_now: now.toISOString(),
      p_limit: 500,
    });
    expect(projects.range).toHaveBeenCalledWith(0, 499);
  });

  it("rejects an actionable row without command concurrency metadata", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            project_id: PROJECT_UUID,
            project_name: "Invalid fixture",
            pipeline_stage: "CONTACTED",
            queue_group: "today",
            action_kind: "WORK_ITEM",
            title: "Send first enquiry email",
            reason: "This project work is due today.",
            due_at: "2026-07-29T04:00:00.000Z",
            priority: "NORMAL",
            blocked_reason: null,
            assignee_user_id: null,
            project_owner_key: null,
            work_item_id: null,
            work_item_row_version: null,
            state_row_version: 1,
          },
        ],
        error: null,
      }),
      from: vi.fn(() => emptyProjectsQuery()),
    } as any;

    await expect(getAuthoritativeProjectWorkQueue(supabase)).rejects.toThrow(
      /missing command metadata/i,
    );
  });

  it("propagates the RPC schema error for route-level availability mapping", async () => {
    const error = {
      code: "PGRST202",
      message: "function is not in the schema cache",
    };
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error }),
      from: vi.fn(() => emptyProjectsQuery()),
    } as any;

    await expect(
      getAuthoritativeProjectWorkQueue(supabase),
    ).rejects.toMatchObject(error);
  });
});
