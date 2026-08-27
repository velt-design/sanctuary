import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  listProjectEnquiryAttachments: vi.fn(),
}));

vi.mock("@/lib/api/staffApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/staffApi")>("@/lib/api/staffApi");
  return { ...actual, requireStaffContext: mocks.requireStaffContext };
});

vi.mock("@/lib/projects/enquiryAttachments/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/projects/enquiryAttachments/server")>(
    "@/lib/projects/enquiryAttachments/server",
  );
  return { ...actual, listProjectEnquiryAttachments: mocks.listProjectEnquiryAttachments };
});

import { GET } from "./route";

const projectId = "proj_11111111-1111-4111-8111-111111111111";
const supabase = { from: vi.fn() };

function request() {
  return new Request(`http://localhost/api/staff/v1/projects/${projectId}/enquiry-attachments`, {
    headers: { "x-request-id": "req-files-list" },
  });
}

describe("GET project enquiry attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: "staff-user" }, role: "staff" },
      supabase,
    });
    mocks.listProjectEnquiryAttachments.mockResolvedValue([]);
  });

  it.each([401, 403])("does not inspect files when staff authorization returns %s", async (status) => {
    mocks.requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "Denied" }, { status }),
    });
    const response = await GET(request(), { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.listProjectEnquiryAttachments).not.toHaveBeenCalled();
  });

  it("returns only safe file metadata from the staff-scoped reader", async () => {
    mocks.listProjectEnquiryAttachments.mockResolvedValueOnce([{
      id: "22222222-2222-4222-8222-222222222222",
      filename: "plan.pdf",
      contentType: "application/pdf",
      sizeBytes: 500,
      submittedAt: "2026-08-27T00:00:00Z",
    }]);
    const response = await GET(request(), { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.attachments[0]).not.toHaveProperty("storagePath");
    expect(mocks.listProjectEnquiryAttachments).toHaveBeenCalledWith(supabase, projectId);
  });
});
