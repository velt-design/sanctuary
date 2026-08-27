import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaffContext: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/api/staffApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/staffApi")>("@/lib/api/staffApi");
  return { ...actual, requireStaffContext: mocks.requireStaffContext };
});

vi.mock("@/lib/projects/enquiryAttachments/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/projects/enquiryAttachments/server")>(
    "@/lib/projects/enquiryAttachments/server",
  );
  return { ...actual, createProjectEnquiryAttachmentSignedUrl: mocks.createSignedUrl };
});

import { GET } from "./route";

const projectId = "proj_11111111-1111-4111-8111-111111111111";
const attachmentId = "22222222-2222-4222-8222-222222222222";
const supabase = { from: vi.fn(), storage: {} };

function request(disposition = "view") {
  return new Request(
    `http://localhost/api/staff/v1/projects/${projectId}/enquiry-attachments/${attachmentId}/open?disposition=${disposition}`,
    { headers: { "x-request-id": "req-file-open" } },
  );
}

const context = {
  params: Promise.resolve({ projectId, attachmentId }),
};

describe("GET project enquiry attachment open", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffContext.mockResolvedValue({
      ok: true,
      session: { user: { id: "staff-user" }, role: "staff" },
      supabase,
    });
    mocks.createSignedUrl.mockResolvedValue({
      signedUrl: "https://storage.example/signed-token",
      expiresInSeconds: 60,
    });
  });

  it.each([401, 403])("does not sign a URL when staff authorization returns %s", async (status) => {
    mocks.requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "Denied" }, { status }),
    });
    const response = await GET(request(), context);
    expect(response.status).toBe(status);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects unknown actions before reading or signing a file", async () => {
    const response = await GET(request("inline"), context);
    expect(response.status).toBe(400);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("issues a private temporary redirect only after staff verification", async () => {
    const response = await GET(request("download"), context);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://storage.example/signed-token");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-attachment-url-expires-in")).toBe("60");
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(supabase, {
      projectId,
      attachmentId,
      disposition: "download",
      actorUserId: "staff-user",
      requestId: "req-file-open",
    });
  });
});
