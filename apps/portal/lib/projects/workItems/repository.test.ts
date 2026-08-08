import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthoritativeProjectWorkQueue: vi.fn(),
}));

vi.mock("./teamQueue", () => ({
  getAuthoritativeProjectWorkQueue: mocks.getAuthoritativeProjectWorkQueue,
}));

import {
  applyProjectWorkDomainActions,
  getProjectWorkProjection,
  getProjectWorkQueue,
} from "./repository";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function query(data: unknown[]) {
  const result = Promise.resolve({ data, error: null });
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    order: vi.fn(() => builder),
    then: result.then.bind(result),
  };
  return builder;
}

function client(params: {
  archivedAt?: string | null;
  state?: "ACTIVE" | "WAITING" | "CLOSED";
  waitingUntil?: string | null;
  waitingReason?: string | null;
  closedOutcome?: string | null;
  ownerKey?: string | null;
  items?: Array<Record<string, unknown>>;
  confirmations?: Array<Record<string, unknown>>;
}) {
  const from = vi.fn((table: string) => {
    if (table === "projects") {
      return query([
        { id: PROJECT_ID, archived_at: params.archivedAt ?? null },
      ]);
    }
    if (table === "project_work_model_versions") {
      return query([{ model_version: 2 }]);
    }
    if (table === "project_operational_states") {
      return query([
        {
          state: params.state ?? "ACTIVE",
          waiting_until: params.waitingUntil ?? null,
          waiting_reason: params.waitingReason ?? null,
          closed_outcome: params.closedOutcome ?? null,
          row_version: 3,
        },
      ]);
    }
    if (table === "project_work_items") return query(params.items ?? []);
    if (table === "project_confirmation_events") {
      return query(params.confirmations ?? []);
    }
    if (table === "project_owner_assignments") {
      return query(params.ownerKey ? [{ owner_key: params.ownerKey }] : []);
    }
    throw new Error(`Unexpected table ${table}`);
  });
  return { from } as any;
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    project_id: PROJECT_ID,
    title: "Follow up by email",
    responsibility_area: "CUSTOMER",
    status: "OPEN",
    due_at: "2026-07-30T05:00:00.000Z",
    sla_breach_at: null,
    deadline_policy: "LEAD_FOLLOW_UP_V1",
    calendar_revision: "calendar-1",
    assignee_user_id: null,
    priority: "NORMAL",
    priority_reason: null,
    blocked_reason: null,
    origin: "AUTOMATION",
    source_type: "LEAD_CADENCE",
    source_key: `lead:follow-up:${PROJECT_ID}:v1`,
    series_key: `lead:${PROJECT_ID}:v1`,
    subject_kind: "PROJECT",
    subject_id: PROJECT_ID,
    row_version: 1,
    created_at: "2026-07-29T00:00:00.000Z",
    updated_at: "2026-07-29T00:00:00.000Z",
    completed_at: null,
    cancelled_at: null,
    outcome: null,
    cancellation_reason: null,
    ...overrides,
  };
}

describe("project work projection", () => {
  const now = new Date("2026-07-29T02:00:00.000Z");

  it("uses urgent durable work before a specialist action", async () => {
    const projection = await getProjectWorkProjection({
      supabase: client({
        items: [item({ due_at: "2026-07-28T05:00:00.000Z" })],
      }),
      projectUuid: PROJECT_ID,
      specialistAction: {
        kind: "specialist",
        key: "quote",
        title: "Prepare quote",
        reason: "Estimate ready",
        owner: "Commercial",
        expectedResult: "Draft quote created",
        href: "/quotes",
      },
      now,
    });

    expect(projection?.primaryAction).toMatchObject({
      kind: "workItem",
      dueState: "overdue",
      reason: "This work is overdue.",
      item: {
        projectId: `proj_${PROJECT_ID}`,
        title: "Follow up by email",
      },
    });
  });

  it("resolves explicit assignee, owner fallback, and unassigned state", async () => {
    const assigned = await getProjectWorkProjection({
      supabase: client({
        ownerKey: "jordan",
        items: [
          item({
            assignee_user_id: "33333333-3333-4333-8333-333333333333",
          }),
        ],
      }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(assigned?.openItems[0]?.effectiveAssignee).toEqual({
      kind: "staff",
      userId: "33333333-3333-4333-8333-333333333333",
    });

    const owner = await getProjectWorkProjection({
      supabase: client({ ownerKey: "jordan", items: [item()] }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(owner?.openItems[0]?.effectiveAssignee).toEqual({
      kind: "projectOwner",
      ownerKey: "jordan",
    });

    const unassigned = await getProjectWorkProjection({
      supabase: client({ items: [item()] }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(unassigned?.openItems[0]?.effectiveAssignee).toEqual({
      kind: "unassigned",
    });
  });

  it("surfaces a due waiting review but keeps future waiting quiet", async () => {
    const due = await getProjectWorkProjection({
      supabase: client({
        state: "WAITING",
        waitingUntil: "2026-07-29T01:00:00.000Z",
        waitingReason: "Customer asked us to wait",
      }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(due?.primaryAction).toMatchObject({
      kind: "stateReview",
      title: "Review waiting project",
      reason: "Customer asked us to wait",
    });

    const future = await getProjectWorkProjection({
      supabase: client({
        state: "WAITING",
        waitingUntil: "2026-08-05T05:00:00.000Z",
        waitingReason: "Customer asked us to wait",
      }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(future?.primaryAction).toMatchObject({
      kind: "none",
      title: "Project waiting",
    });
  });

  it("never presents closed or archived work as actionable", async () => {
    const closed = await getProjectWorkProjection({
      supabase: client({
        state: "CLOSED",
        closedOutcome: "LOST_NO_RESPONSE",
        items: [item()],
      }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(closed?.primaryAction).toMatchObject({
      kind: "none",
      title: "Project closed",
    });

    const archived = await getProjectWorkProjection({
      supabase: client({
        archivedAt: "2026-07-29T01:00:00.000Z",
        items: [item()],
      }),
      projectUuid: PROJECT_ID,
      now,
    });
    expect(archived?.primaryAction).toMatchObject({
      kind: "none",
      title: "Project archived",
    });
  });

  it("excludes a retracted confirmation while retaining current facts", async () => {
    const retractedId = "44444444-4444-4444-8444-444444444444";
    const currentId = "55555555-5555-4555-8555-555555555555";
    const projection = await getProjectWorkProjection({
      supabase: client({
        confirmations: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            event_kind: "RETRACTED",
            confirmation_type: "FIRST_ENQUIRY_EMAIL_SENT",
            subject_kind: "PROJECT",
            subject_id: PROJECT_ID,
            occurred_at: "2026-07-29T02:00:00.000Z",
            recorded_at: "2026-07-29T02:01:00.000Z",
            retracts_event_id: retractedId,
          },
          {
            id: retractedId,
            event_kind: "CONFIRMED",
            confirmation_type: "FIRST_ENQUIRY_EMAIL_SENT",
            subject_kind: "PROJECT",
            subject_id: PROJECT_ID,
            occurred_at: "2026-07-29T01:00:00.000Z",
            recorded_at: "2026-07-29T01:01:00.000Z",
            retracts_event_id: null,
          },
          {
            id: currentId,
            event_kind: "CONFIRMED",
            confirmation_type: "ENQUIRY_CUSTOMER_REPLY_RECEIVED",
            subject_kind: "PROJECT",
            subject_id: PROJECT_ID,
            occurred_at: "2026-07-29T00:00:00.000Z",
            recorded_at: "2026-07-29T00:01:00.000Z",
            retracts_event_id: null,
          },
        ],
      }),
      projectUuid: PROJECT_ID,
      now,
    });

    expect(projection?.confirmedFacts.map((fact) => fact.id)).toEqual([
      currentId,
    ]);
  });
});

describe("project work domain enrichment", () => {
  const now = new Date("2026-07-29T02:00:00.000Z");

  it("applies a specialist action to an already-loaded active projection", async () => {
    const projection = await getProjectWorkProjection({
      supabase: client({}),
      projectUuid: PROJECT_ID,
      now,
    });
    if (!projection) throw new Error("Expected V2 projection");

    const enriched = applyProjectWorkDomainActions(projection, {
      specialistAction: {
        kind: "specialist",
        key: "quote",
        title: "Prepare quote",
        reason: "Estimate ready",
        owner: "Commercial",
        expectedResult: "Draft quote created",
        href: "/quotes",
      },
    }, now);

    expect(enriched.primaryAction).toMatchObject({ kind: "specialist", title: "Prepare quote" });
  });

  it("does not make waiting work actionable", async () => {
    const projection = await getProjectWorkProjection({
      supabase: client({ state: "WAITING", waitingUntil: "2026-07-30T00:00:00.000Z" }),
      projectUuid: PROJECT_ID,
      now,
    });
    if (!projection) throw new Error("Expected V2 projection");

    expect(applyProjectWorkDomainActions(projection, {
      specialistAction: {
        kind: "specialist",
        key: "quote",
        title: "Prepare quote",
        reason: "Estimate ready",
        owner: "Commercial",
        expectedResult: "Draft quote created",
        href: null,
      },
    }, now)).toBe(projection);
  });
});

describe("project work queue repository boundary", () => {
  it("delegates to the authoritative team queue without deriving another view", async () => {
    const supabase = { rpc: vi.fn(), from: vi.fn() } as any;
    const options = {
      now: new Date("2026-07-29T02:00:00.000Z"),
      limit: 25,
    };
    const expected = {
      entries: [],
      generatedAt: options.now.toISOString(),
    };
    mocks.getAuthoritativeProjectWorkQueue.mockResolvedValueOnce(expected);

    await expect(getProjectWorkQueue(supabase, options)).resolves.toBe(
      expected,
    );
    expect(mocks.getAuthoritativeProjectWorkQueue).toHaveBeenCalledWith(
      supabase,
      options,
    );
  });
});
