import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminContext: vi.fn(),
  recordProjectLostConversion: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/api/adminApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/adminApi")>(
    "@/lib/api/adminApi",
  );
  return { ...actual, requireAdminContext: mocks.requireAdminContext };
});

vi.mock("@/lib/projects/workItems/lostConversion", () => ({
  recordProjectLostConversion: mocks.recordProjectLostConversion,
}));

import { GET, POST } from "./route";

const PROJECT_UUID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const COMMAND_ID = "22222222-2222-4222-8222-222222222222";
const CHILD_COMMAND_ID = "33333333-3333-4333-8333-333333333333";
const REPORT_AS_OF = "2026-08-01T00:00:00.000Z";
const ACTIVITY_AT = "2026-05-01T00:00:00.000Z";
const FINGERPRINT = "a".repeat(32);
const SUPABASE = { rpc: mocks.rpc };

function post(body: Record<string, unknown>) {
  return new Request(
    "http://localhost/api/admin/project-work/inactive-enquiries",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function validBody() {
  return {
    commandId: COMMAND_ID,
    reportAsOf: REPORT_AS_OF,
    inactiveDays: 30,
    candidates: [
      {
        projectId: PROJECT_ID,
        evidenceFingerprint: FINGERPRINT,
        lastActivityAt: ACTIVITY_AT,
        lastActivitySource: "project_note",
      },
    ],
  };
}

describe("inactive Enquiry review admin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminContext.mockResolvedValue({
      ok: true,
      supabase: SUPABASE,
      session: { role: "admin", user: { id: "admin-1" } },
    });
    mocks.recordProjectLostConversion.mockResolvedValue(undefined);
  });

  it("returns the exact read-only report with protected rows excluded from the eligible count", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          project_id: PROJECT_UUID,
          project_name: "Stale Enquiry",
          pipeline_stage: "new",
          operational_state: "ACTIVE",
          waiting_until: null,
          owner_key: "ellen",
          last_activity_at: ACTIVITY_AT,
          last_activity_source: "project_note",
          inactive_for_days: 92,
          protected_by_future_wait: false,
          evidence_fingerprint: FINGERPRINT,
        },
        {
          project_id: "44444444-4444-4444-8444-444444444444",
          project_name: "Waiting Enquiry",
          pipeline_stage: "contacted",
          operational_state: "WAITING",
          waiting_until: "2026-08-10T00:00:00.000Z",
          owner_key: "ellen",
          last_activity_at: ACTIVITY_AT,
          last_activity_source: "email",
          inactive_for_days: 92,
          protected_by_future_wait: true,
          evidence_fingerprint: "b".repeat(32),
        },
      ],
      error: null,
    });

    const response = await GET(
      new Request("http://localhost/api/admin/project-work/inactive-enquiries"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "project_enquiry_inactivity_report_v1",
      expect.objectContaining({ p_inactive_days: 30 }),
    );
    await expect(response.json()).resolves.toMatchObject({
      inactiveDays: 30,
      candidateCount: 1,
      candidates: [
        { projectId: PROJECT_ID, protectedByFutureWait: false },
        { protectedByFutureWait: true },
      ],
    });
  });

  it("rejects an empty or malformed approval list before the RPC", async () => {
    const response = await POST(post({ ...validBody(), candidates: [] }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("submits only fingerprinted candidates and records each committed Lost outcome", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        command_id: COMMAND_ID,
        report_as_of: REPORT_AS_OF,
        revalidated_at: "2026-08-01T00:01:00.000Z",
        inactive_days: 30,
        closed_count: 1,
        replayed: false,
        projects: [
          {
            project_id: PROJECT_UUID,
            command_id: CHILD_COMMAND_ID,
            row_version: 4,
            cancelled_count: 2,
          },
        ],
      },
      error: null,
    });

    const response = await POST(post(validBody()));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("project_enquiry_bulk_close_v1", {
      p_command_id: COMMAND_ID,
      p_report_as_of: REPORT_AS_OF,
      p_inactive_days: 30,
      p_candidates: [
        {
          project_id: PROJECT_UUID,
          evidence_fingerprint: FINGERPRINT,
          last_activity_at: ACTIVITY_AT,
          last_activity_source: "project_note",
        },
      ],
    });
    expect(mocks.recordProjectLostConversion).toHaveBeenCalledWith({
      supabase: SUPABASE,
      projectId: PROJECT_UUID,
      commandId: CHILD_COMMAND_ID,
      outcome: "LOST_NO_RESPONSE",
      replayed: false,
    });
    await expect(response.json()).resolves.toMatchObject({
      command: { id: COMMAND_ID, committed: true, replayed: false },
      result: {
        closedCount: 1,
        projects: [
          { projectId: PROJECT_ID, rowVersion: 4, cancelledCount: 2 },
        ],
      },
    });
  });

  it("maps changed evidence to a refresh-required conflict", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "40001", message: "STALE_REVIEW" },
    });
    const response = await POST(post(validBody()));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("Refresh and review"),
    });
  });
});
