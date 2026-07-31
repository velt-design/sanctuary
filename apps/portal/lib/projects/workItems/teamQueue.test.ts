import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectWorkQueueEntry } from "./types";

const modelBoundaryMocks = vi.hoisted(() => ({
  listProjectWorkModelV2Ids: vi.fn(),
}));

vi.mock("./modelBoundary", () => ({
  listProjectWorkModelV2Ids: modelBoundaryMocks.listProjectWorkModelV2Ids,
}));

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

  it("does not expose retired legacy-review work", () => {
    const result = composeProjectWorkQueue({
      durableEntries: [
        entry({
          sourceType: "LEGACY_REVIEW",
          sourceKey: `legacy-review:${PROJECT_UUID}`,
          title: "Review legacy project action",
        }),
      ],
      domainCandidates: [],
      limit: 200,
    });

    expect(result).toEqual([
      expect.objectContaining({
        projectId: PROJECT_ID,
        group: "needsTriage",
        actionKind: "needsTriage",
        title: "Legacy work needs review",
        sourceType: null,
        sourceKey: null,
        workItemId: null,
        href: `/staff/projects/${PROJECT_ID}?tab=activity`,
      }),
    ]);
    expect(result[0]?.reason).not.toMatch(/\b(?:call|site[\s_-]*visits?)\b/i);
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

function pagedRpc(params: {
  data?: Record<string, unknown>[];
  error?: Record<string, unknown> | null;
  completenessError?: Record<string, unknown> | null;
}) {
  const data = params.data ?? [];
  const error = params.error ?? null;
  const completenessError = params.completenessError ?? null;
  const range = vi.fn(async (from: number, to: number) => ({
    data: error ? null : data.slice(from, to + 1),
    error,
  }));
  const rpc = vi.fn((name: string) =>
    name === "staff_project_state_counts_v1"
      ? Promise.resolve({
          data: completenessError ? null : { totalCount: data.length },
          error: completenessError,
        })
      : { range },
  );
  return { rpc, range };
}

function durableRow(index: number): Record<string, unknown> {
  const projectUuid = `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`;
  return {
    project_id: projectUuid,
    project_name: `Mapped fixture ${index}`,
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
    work_item_id: `22222222-2222-4222-8222-${String(index).padStart(12, "0")}`,
    work_item_row_version: 4,
    source_type: "LEAD_CADENCE",
    source_key: `lead:first-email:${projectUuid}:v1`,
    subject_kind: "PROJECT",
    subject_id: projectUuid,
    repair_signal_id: null,
    repair_signal_row_version: null,
    state_row_version: 3,
  };
}

describe("getAuthoritativeProjectWorkQueue", () => {
  beforeEach(() => {
    modelBoundaryMocks.listProjectWorkModelV2Ids.mockReset();
    modelBoundaryMocks.listProjectWorkModelV2Ids.mockResolvedValue(new Set());
  });

  it("maps the richer V3 RPC contract and effective assignee metadata", async () => {
    const { rpc, range } = pagedRpc({
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
      p_limit: 5000,
    });
    expect(range).toHaveBeenCalledWith(0, 999);
  });

  it("pages the RPC so hosted response limits cannot truncate the queue", async () => {
    const { rpc, range } = pagedRpc({
      data: Array.from({ length: 1001 }, (_, index) => durableRow(index + 1)),
    });
    const supabase = {
      rpc,
      from: vi.fn(() => emptyProjectsQuery()),
    } as any;

    const result = await getAuthoritativeProjectWorkQueue(supabase);

    expect(result.entries).toHaveLength(1001);
    expect(new Set(result.entries.map((row) => row.projectId))).toHaveLength(1001);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(range.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("fails closed when the bounded queue inventory reaches its safe ceiling", async () => {
    const { rpc, range } = pagedRpc({
      data: Array.from({ length: 5000 }, (_, index) => durableRow(index + 1)),
    });
    const supabase = {
      rpc,
      from: vi.fn(() => emptyProjectsQuery()),
    } as any;

    await expect(getAuthoritativeProjectWorkQueue(supabase)).rejects.toThrow(
      /exceeded the safe 5000-row fetch limit/i,
    );
    expect(range).toHaveBeenCalledTimes(5);
  });

  it.each(["marker", "state"])(
    "fails closed when portfolio %s completeness is missing",
    async (missingKind) => {
      const { rpc } = pagedRpc({
        completenessError: {
          code: "P0001",
          message:
            `PROJECT_WORK_ROLLOUT_INCOMPLETE: project ${missingKind} is missing`,
        },
      });
      const supabase = {
        rpc,
        from: vi.fn(() => emptyProjectsQuery()),
      } as any;

      await expect(getAuthoritativeProjectWorkQueue(supabase)).rejects.toMatchObject({
        code: "PROJECT_WORK_INVENTORY_INCOMPLETE",
      });
    },
  );

  it("fails closed when the portfolio completeness payload is malformed", async () => {
    const { rpc: baseRpc } = pagedRpc({ data: [] });
    const rpc = vi.fn((name: string) =>
      name === "staff_project_state_counts_v1"
        ? Promise.resolve({ data: {}, error: null })
        : baseRpc(name),
    );
    const supabase = {
      rpc,
      from: vi.fn(() => emptyProjectsQuery()),
    } as any;

    await expect(getAuthoritativeProjectWorkQueue(supabase)).rejects.toMatchObject({
      code: "PROJECT_WORK_INVENTORY_INCOMPLETE",
    });
  });

  it("loads active V2 commercial candidates through direct model and state owners", async () => {
    modelBoundaryMocks.listProjectWorkModelV2Ids.mockResolvedValue(
      new Set([PROJECT_UUID]),
    );
    const stateEq = vi.fn().mockResolvedValue({
      data: [{ project_id: PROJECT_UUID, state: "ACTIVE" }],
      error: null,
    });
    const stateIn = vi.fn(() => ({ eq: stateEq }));
    const stateSelect = vi.fn((_selection: string) => ({ in: stateIn }));
    const projectOrder = vi.fn().mockResolvedValue({
      data: [{
        id: PROJECT_UUID,
        name: "Direct boundary fixture",
        pipeline_stage: "QUOTING",
        ownerAssignment: [],
        estimates: [],
        quotes: [],
      }],
      error: null,
    });
    const projectIs = vi.fn(() => ({ order: projectOrder }));
    const projectIn = vi.fn(() => ({ is: projectIs }));
    const projectSelect = vi.fn((_selection: string) => ({ in: projectIn }));
    const from = vi.fn((table: string) => {
      if (table === "project_operational_states") return { select: stateSelect };
      if (table === "projects") return { select: projectSelect };
      throw new Error(`Unexpected table ${table}`);
    });
    const { rpc } = pagedRpc({ data: [] });
    const supabase = {
      rpc,
      from,
    } as any;

    await expect(getAuthoritativeProjectWorkQueue(supabase)).resolves.toMatchObject({
      entries: [],
    });

    expect(stateSelect).toHaveBeenCalledWith("project_id,state");
    expect(stateIn).toHaveBeenCalledWith("project_id", [PROJECT_UUID]);
    expect(stateEq).toHaveBeenCalledWith("state", "ACTIVE");
    expect(projectIn).toHaveBeenCalledWith("id", [PROJECT_UUID]);
    const select = String(projectSelect.mock.calls[0]?.[0] ?? "");
    expect(select).not.toContain("project_work_model_versions");
    expect(select).not.toContain("project_operational_states");
  });

  it("rejects an actionable row without command concurrency metadata", async () => {
    const { rpc } = pagedRpc({
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
    });
    const supabase = {
      rpc,
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
    const { rpc } = pagedRpc({ error });
    const supabase = {
      rpc,
      from: vi.fn(() => emptyProjectsQuery()),
    } as any;

    await expect(
      getAuthoritativeProjectWorkQueue(supabase),
    ).rejects.toMatchObject(error);
  });
});
