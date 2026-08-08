import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  getProjectWorkQueue: vi.fn(),
}));

vi.mock("@/lib/api/staffApi", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/staffApi")>(
      "@/lib/api/staffApi",
    );
  return { ...actual, requireStaffContext: mocks.requireStaffContext };
});

vi.mock("@/lib/projects/workItems/repository", () => ({
  getProjectWorkQueue: mocks.getProjectWorkQueue,
}));

import { GET } from "./route";

const SUPABASE = { from: vi.fn(), rpc: vi.fn() };
const PROJECT_ID = "proj_11111111-1111-4111-8111-111111111111";
const QUEUE = {
  entries: [
    {
      projectId: PROJECT_ID,
      projectName: "Internal fixture",
      stage: "contacted",
      group: "today",
      actionKind: "workItem",
      title: "Send first enquiry email",
      reason: "This project work is due today.",
      dueAt: "2026-08-03T05:00:00.000Z",
      priority: "NORMAL",
      blockedReason: null,
      effectiveAssignee: {
        kind: "projectOwner",
        ownerKey: "jordan",
      },
      workItemId: "22222222-2222-4222-8222-222222222222",
      workItemRowVersion: 2,
      stateRowVersion: 3,
      sourceType: "LEAD_CADENCE",
      sourceKey: "lead:first-email:11111111-1111-4111-8111-111111111111:v1",
      subjectKind: "PROJECT",
      subjectId: "11111111-1111-4111-8111-111111111111",
      href: `/staff/projects/${PROJECT_ID}?tab=activity`,
    },
  ],
  generatedAt: "2026-08-03T00:00:00.000Z",
};

function request(search = "") {
  return new Request(`http://localhost/api/staff/v1/work-items/queue${search}`, {
    headers: { "x-request-id": "req-team-queue" },
  });
}

describe("GET /api/staff/v1/work-items/queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-1" }, role: "staff" },
      supabase: SUPABASE,
    });
    mocks.getProjectWorkQueue.mockResolvedValue(QUEUE);
  });

  it("is private and auth-bound", async () => {
    mocks.requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.getProjectWorkQueue).not.toHaveBeenCalled();
  });

  it("returns the server-owned team queue contract unchanged", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-portal-request-id")).toBe("req-team-queue");
    expect(response.headers.get("server-timing")).toMatch(/auth;dur=[\d.]+.*work_queue;dur=[\d.]+/);
    await expect(response.json()).resolves.toEqual(QUEUE);
    expect(mocks.getProjectWorkQueue).toHaveBeenCalledWith(SUPABASE);
  });

  it("supports a bounded Dashboard projection without changing the full-queue contract", async () => {
    const response = await GET(request("?limit=5"));

    expect(response.status).toBe(200);
    expect(mocks.getProjectWorkQueue).toHaveBeenCalledWith(SUPABASE, { limit: 5 });
  });

  it.each(["0", "51", "1.5", "many"])("rejects invalid limit %s", async (limit) => {
    const response = await GET(request(`?limit=${limit}`));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_LIMIT" });
    expect(mocks.getProjectWorkQueue).not.toHaveBeenCalled();
  });

  it("maps an unavailable queue RPC to a retryable 503 contract", async () => {
    mocks.getProjectWorkQueue.mockRejectedValueOnce(
      Object.assign(new Error("function is not in the schema cache"), {
        code: "PGRST202",
      }),
    );

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "WORK_ITEMS_UNAVAILABLE",
    });
  });

  it.each([
    {
      code: "PGRST200",
      message:
        "Could not find a relationship between 'projects' and 'project_work_model_versions' in the schema cache",
    },
    {
      code: "PGRST205",
      message:
        "Could not find the table 'public.project_work_model_versions' in the schema cache",
    },
    {
      code: "PROJECT_WORK_INVENTORY_INCOMPLETE",
      message: "Project Work V2 inventory exceeded the authoritative read limit",
    },
  ])("maps unavailable queue error $code to the stable unavailable contract", async (failure) => {
    mocks.getProjectWorkQueue.mockRejectedValueOnce(
      Object.assign(new Error(failure.message), failure),
    );

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-portal-request-id")).toBe("req-team-queue");
    await expect(response.json()).resolves.toMatchObject({
      code: "WORK_ITEMS_UNAVAILABLE",
    });
  });

  it("maps unexpected database failures to the shared command error contract", async () => {
    mocks.getProjectWorkQueue.mockRejectedValueOnce(
      new Error("internal database detail"),
    );

    const response = await GET(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      code: "COMMAND_FAILED",
    });
  });
});
