// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  rpc: vi.fn(),
  prepare: vi.fn(),
  read: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/api/staffApi", () => ({
  jsonOk: (value: unknown) => Response.json(value),
  jsonError: (error: string, status: number) =>
    Response.json({ error }, { status }),
}));
vi.mock("./clientPackageContext.server", () => ({
  studioPackageContext: mocks.context,
  packageRpc: mocks.rpc,
}));
vi.mock("@/lib/quotes/serverEmail", () => ({
  prepareStudioPackageEmail: mocks.prepare,
  readStudioPackageEmail: mocks.read,
  sendPreparedStudioPackageEmail: mocks.send,
}));
import { studioPackageDelivery } from "./clientPackageDelivery.server";
let draft: any;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.STUDIO_CLIENT_PACKAGE_PREPARE_ONLY = "1";
  draft = {
    revision: 5,
    documentId: "document",
    preparedIntentId: null,
    preparedRevision: null,
    value: {
      to: "sam@example.test",
      subject: "Your quote",
      message: "Please find your quote.",
      includeBooklet: false,
      renderFileIds: ["optional-render"],
      fileIds: [],
    },
  };
  mocks.context.mockResolvedValue({
    ok: true,
    id: { appId: "qv-test", uuid: "quote" },
    actorId: "actor",
    commercialRevision: 3,
  });
  mocks.rpc.mockImplementation(async (_context, name) =>
    name === "studio_client_package_read" ? draft : { state: "running" },
  );
  mocks.prepare.mockImplementation(async () => {
    draft = { ...draft, preparedIntentId: "intent", preparedRevision: 5 };
  });
  mocks.read.mockResolvedValue({
    id: "intent",
    status: "prepared",
    to: ["sam@example.test"],
    subject: "Your quote",
    attachmentNames: ["Financial.pdf"],
  });
});
const request = () =>
  new Request("http://localhost/prepare", {
    method: "POST",
    body: JSON.stringify({ revision: 5 }),
  });
it("accepts an ordinary email address and prepares an exact financial-only package without loose selected renders or provider sending", async () => {
  const response = await studioPackageDelivery(request(), "qv-test", "prepare");
  expect(response.status).toBe(200);
  expect(mocks.prepare).toHaveBeenCalledWith(
    "qv-test",
    expect.objectContaining({
      to: ["sam@example.test"],
      expectedCommercialRevision: 3,
      artifactIds: [],
      personalNote: "Please find your quote.",
    }),
    "actor",
  );
  expect(mocks.send).not.toHaveBeenCalled();
});
it("refuses pending selected booklet but lets an intentional quote-only package proceed", async () => {
  draft.value.includeBooklet = true;
  expect(
    (await studioPackageDelivery(request(), "qv-test", "prepare")).status,
  ).toBe(409);
  expect(mocks.prepare).not.toHaveBeenCalled();
  draft.value.includeBooklet = false;
  expect(
    (await studioPackageDelivery(request(), "qv-test", "prepare")).status,
  ).toBe(200);
});
it("enforces local prepare-only mode before any send or delivery-state operation", async () => {
  const response = await studioPackageDelivery(request(), "qv-test", "send");
  expect(response.status).toBe(409);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});
