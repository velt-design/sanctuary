import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rpc: vi.fn(),
  service: vi.fn(),
  visible: true,
  reads: vi.fn(),
}));
vi.mock("@/lib/api/staffApi", () => ({
  requireStaffContext: mocks.auth,
  jsonOk: (value: unknown) => Response.json(value),
  jsonError: (error: string, status: number) =>
    Response.json({ error }, { status }),
}));
vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseServiceRole: mocks.service,
}));
import { studioPackageDocument } from "./clientPackageDocument.server";
const quote = "qv_10000000-0000-4000-8000-000000000001",
  document = "10000000-0000-4000-8000-000000000002",
  project = "10000000-0000-4000-8000-000000000003";
beforeEach(() => {
  vi.resetAllMocks();
  process.env.ENABLE_PORTAL_DESIGN_STUDIO = "1";
  mocks.visible = true;
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    abortSignal: () => chain,
    maybeSingle: async () => {
      mocks.reads();
      return {
        error: null,
        data: mocks.visible
          ? {
              id: quote.slice(3),
              commercial_revision: 1,
              quotes: { project_id: project },
            }
          : null,
      };
    },
  };
  mocks.auth.mockResolvedValue({
    ok: true,
    session: {
      role: "staff",
      user: { id: "10000000-0000-4000-8000-000000000004" },
    },
    supabase: { from: () => chain },
  });
  mocks.service.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({
    error: null,
    data: {
      documentId: document,
      snapshotId: "base",
      packageRevision: 5,
      state: "ready",
      file: {
        filename: "Design.pdf",
        contentBase64: Buffer.from("%PDF-exact").toString("base64"),
      },
    },
  });
});
const url = `http://localhost/document?download=1&documentId=${document}&revision=5`;
it("proves exact caller quote visibility before service use and refuses unsupported role/origin with no privileged operations", async () => {
  mocks.visible = false;
  expect((await studioPackageDocument(new Request(url), quote)).status).toBe(
    404,
  );
  expect(mocks.service).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.auth.mockResolvedValueOnce({
    ok: true,
    session: { role: "viewer", user: { id: "actor" } },
  });
  expect((await studioPackageDocument(new Request(url), quote)).status).toBe(
    403,
  );
  expect(mocks.service).not.toHaveBeenCalled();
  mocks.visible = true;
  expect(
    (
      await studioPackageDocument(
        new Request(url, { headers: { origin: "https://other.example" } }),
        quote,
      )
    ).status,
  ).toBe(403);
  expect(mocks.service).not.toHaveBeenCalled();
});
it("requires expected identity/revision and echoes the exact atomic RPC identity on actual preview bytes", async () => {
  expect(
    (
      await studioPackageDocument(
        new Request("http://localhost/document?download=1"),
        quote,
      )
    ).status,
  ).toBe(409);
  expect(mocks.rpc).not.toHaveBeenCalled();
  const response = await studioPackageDocument(new Request(url), quote);
  expect(response.status).toBe(200);
  expect(response.headers.get("X-Studio-Document-Id")).toBe(document);
  expect(response.headers.get("X-Studio-Package-Revision")).toBe("5");
  expect(await response.text()).toBe("%PDF-exact");
  expect(mocks.rpc.mock.calls[0]).toEqual([
    "studio_client_package_document",
    expect.objectContaining({
      p_quote_version_id: quote.slice(3),
      p_document_id: document,
      p_expected_revision: 5,
      p_download: true,
      p_retry: false,
    }),
  ]);
});
it("refuses a two-window stale request and routes retries through the same expected desired identity fence", async () => {
  mocks.rpc.mockResolvedValueOnce({
    error: { message: "studio_package_stale" },
    data: null,
  });
  expect((await studioPackageDocument(new Request(url), quote)).status).toBe(
    409,
  );
  await studioPackageDocument(
    new Request(url.replace("download=1&", ""), { method: "POST" }),
    quote,
  );
  expect(mocks.rpc.mock.calls.at(-1)?.[1]).toMatchObject({
    p_document_id: document,
    p_expected_revision: 5,
    p_retry: true,
    p_download: false,
  });
});
