// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  pdf: vi.fn(),
  prepare: vi.fn(),
  find: vi.fn(),
  read: vi.fn(),
  send: vi.fn(),
  from: vi.fn(),
  dispatch: vi.fn(),
  unfinished: vi.fn(),
}));
vi.mock("@/lib/commercial/emailIntent", () => ({
  commercialEmailFailure: vi.fn(),
  findCommercialEmailIntentByKey: mocks.find,
  findUnfinishedCommercialEmailIntent: mocks.unfinished,
  markCommercialEmailDispatching: mocks.dispatch,
  markCommercialEmailFailed: vi.fn(),
  markCommercialEmailFinalised: vi.fn(),
  markCommercialEmailProviderAccepted: vi.fn(),
  prepareCommercialEmailIntent: vi.fn(),
  prepareQuoteDeliveryEmailIntent: mocks.prepare,
  readCommercialEmailIntent: mocks.read,
}));
vi.mock("@/lib/emails/sendTransactionalEmail", () => ({
  sendTransactionalEmail: mocks.send,
}));
vi.mock("@/lib/projects/workItems/quoteCadenceReconciliation", () => ({
  reconcileQuoteDeliveryCadence: vi.fn(),
}));
vi.mock("@/lib/supabaseClient", () => ({
  supabaseServiceRole: { from: mocks.from },
}));
vi.mock("@/lib/quotes/acceptToken", () => ({
  generateAcceptToken: () => ({
    token: "synthetic-accepts-token",
    tokenHash: "synthetic-hash",
  }),
}));
vi.mock("./serverCore", () => ({
  getQuoteVersionDetail: mocks.detail,
  ensurePdfForSend: mocks.pdf,
  createFileArtifact: vi.fn(),
  ensureQuoteArtifacts: vi.fn(),
  insertAuditEvent: vi.fn(),
  insertSendLog: vi.fn(),
  updateProjectStage: vi.fn(),
}));
import {
  prepareStudioPackageEmail,
  readStudioPackageEmail,
  sendPreparedStudioPackageEmail,
  getPreparedQuoteDelivery,
  retryPreparedQuoteDelivery,
  sendQuote,
  resendQuote,
} from "./serverEmail";
const quote = "qv_10000000-0000-4000-8000-000000000001",
  project = "proj_10000000-0000-4000-8000-000000000002",
  financial = "10000000-0000-4000-8000-000000000003",
  booklet = "10000000-0000-4000-8000-000000000004",
  extra = "10000000-0000-4000-8000-000000000005";
const financialBytes = Buffer.from("%PDF-financial"),
  bookletBytes = Buffer.from("%PDF-booklet");
let rows: any[], intent: any;
const draft = {
  to: "qa@example.test",
  subject: "Your Sanctuary quote",
  message: "Hello Sam,\nPlease find your documents.\nThanks, Jordan",
  includeBooklet: true,
  renderFileIds: ["10000000-0000-4000-8000-000000000008"],
  fileIds: [],
};
const payload = () => ({
  intentId: "studio-package:test:1",
  expectedCommercialRevision: 3,
  to: [draft.to],
  subject: draft.subject,
  personalNote: draft.message,
  artifactIds: [booklet],
  studioPackage: {
    actorUserId: "10000000-0000-4000-8000-000000000006",
    revision: 2,
    documentId: "10000000-0000-4000-8000-000000000007",
    value: draft,
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PUBLIC_SITE_URL", "https://customer.example.test");
  vi.stubEnv('STUDIO_CLIENT_PACKAGE_PREPARE_ONLY','1');
  vi.stubEnv('STUDIO_CUSTOMER_EMAIL_ENABLED','');
  mocks.unfinished.mockResolvedValue(null);
  rows = [
    {
      id: booklet,
      filename: "Sanctuary-Design-Q-TEST-v1-variant.pdf",
      content_type: "application/pdf",
      size_bytes: bookletBytes.length,
      content_base64: bookletBytes.toString("base64"),
    },
  ];
  const detail = {
    id: quote,
    projectId: project,
    status: "DRAFT",
    commercialRevision: 3,
    isCurrentDraft: true,
    quoteRef: "Q-TEST",
    versionNumber: 1,
    depositPercent: 10,
    contact: { name: "Sam Test", email: draft.to },
    project: { name: "Synthetic garden", siteAddress: "Test address" },
    totals: {
      totalIncGstCents: 115000,
      totalExGstCents: 100000,
      gstCents: 15000,
    },
    lineItems: [
      {
        description: "Pergola",
        qty: 1,
        lineTotalIncGstCents: 115000,
        unitPriceIncGstCents: 115000,
      },
    ],
    sendLogs: [],
  };
  rows.push({
    id: financial,
    filename: "Q-TEST.pdf",
    content_type: "application/pdf",
    size_bytes: financialBytes.length,
    content_base64: financialBytes.toString("base64"),
  });
  mocks.detail.mockResolvedValue(detail);
  mocks.pdf.mockResolvedValue({
    fileUuid: financial,
    filename: "Q-TEST.pdf",
    content: financialBytes,
  });
  mocks.find.mockResolvedValue(null);
  mocks.from.mockImplementation(() => {
    const query = {
      select: () => query,
      eq: () => query,
      in: async (_key: string, ids: string[]) => ({
        data: rows.filter((row) => ids.includes(row.id)),
        error: null,
      }),
    };
    return query;
  });
  mocks.prepare.mockImplementation(async (input) => {
    intent = {
      id: "10000000-0000-4000-8000-000000000009",
      kind: "quote_send",
      subjectId: quote.slice(3),
      projectId: project.slice(5),
      status: "prepared",
      payloadHash: "a".repeat(64),
      protectedPayload: input.protectedPayload,
    };
    mocks.read.mockResolvedValue(intent);
    return intent;
  });
});
afterEach(()=>vi.unstubAllEnvs());
it('blocks the exact frozen package through direct and generic recovery without dispatch, provider, or another preparation',async()=>{
 await prepareStudioPackageEmail(quote,payload(),'actor');
 Object.assign(intent,{createdAt:new Date().toISOString(),attemptCount:0,providerIdempotencyExpiresAt:new Date(Date.now()+3600000).toISOString()});
 mocks.unfinished.mockResolvedValue(intent);
 const summary=await getPreparedQuoteDelivery(quote,'send');
 expect(summary).toMatchObject({canRetry:false,unavailableReason:'Sending is disabled during the Design Studio trial.'});
 await expect(retryPreparedQuoteDelivery(quote,'send',3,'actor')).rejects.toThrow('Design Studio trial');
 await expect(sendPreparedStudioPackageEmail(quote,intent.id,'actor')).rejects.toThrow('Design Studio trial');
 expect(mocks.prepare).toHaveBeenCalledTimes(1);expect(mocks.dispatch).not.toHaveBeenCalled();expect(mocks.send).not.toHaveBeenCalled();
});
it('fences direct send, resend and idempotent intent recovery by the immutable Studio quote view, preserving unrelated ordinary recovery',async()=>{
 const detail=await mocks.detail(),ordinary={intentId:'generic-ordinary-recovery',expectedCommercialRevision:3,to:[draft.to]};
 mocks.detail.mockResolvedValue({...detail,studioDesign:{schemaVersion:'studio_quote_snapshot.v2',snapshotId:'immutable-snapshot',contentHash:'b'.repeat(64)}});
 await expect(sendQuote(quote,ordinary,'actor')).rejects.toThrow('Design Studio trial');
 await expect(resendQuote(quote,ordinary,'actor')).rejects.toThrow('Design Studio trial');
 expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.pdf).not.toHaveBeenCalled();
 const finalised={id:'ordinary-finalised',subjectId:quote.slice(3),kind:'quote_send',status:'finalised',protectedPayload:{}} as any;
 mocks.find.mockResolvedValue(finalised);
 await expect(sendQuote(quote,ordinary,'actor')).rejects.toThrow('Design Studio trial');
 mocks.detail.mockResolvedValue(detail);
 await expect(sendQuote(quote,ordinary,'actor')).resolves.toEqual(detail);
 expect(mocks.dispatch).not.toHaveBeenCalled();expect(mocks.send).not.toHaveBeenCalled();
});
it("freezes canonical exact recipient/message/financial+booklet IDs/hashes without any provider dispatch or loose render", async () => {
  const summary = await prepareStudioPackageEmail(quote, payload(), "actor");
  expect(summary.status).toBe("prepared");
  expect(mocks.dispatch).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
  const frozen = mocks.prepare.mock.calls[0][0].protectedPayload;
  expect(frozen.to).toEqual([draft.to]);
  expect(frozen.subject).toBe(draft.subject);
  expect(frozen.text).toContain("Hello Sam,");
  expect(frozen.attachmentFileIds).toEqual([financial, booklet]);
  expect(frozen.attachmentHashes).toEqual(
    [financialBytes, bookletBytes].map((bytes) =>
      createHash("sha256").update(bytes).digest("hex"),
    ),
  );
  expect(frozen.html).not.toMatch(
    /<(?:strong|b)\b|font-weight\s*:\s*(?:bold|[6-9]00)|\u2014/i,
  );
  expect(frozen.text).not.toContain("\u2014");
  const read = await readStudioPackageEmail(quote, intent.id);
  expect(read.attachmentNames).toEqual(["Q-TEST.pdf", rows[0].filename]);
  expect(read.text).toContain("token=[redacted]");
  expect(read.html).toMatch(/token(?:=|&#x3D;)\[redacted\]/i);
  expect(read.html).not.toContain("synthetic-accepts-token");
  expect(frozen.text).toContain(rows[0].filename);
});
it("refuses missing files or aggregate extras over4MiB before creating a preparation", async () => {
  rows = [];
  await expect(
    prepareStudioPackageEmail(quote, payload(), "actor"),
  ).rejects.toThrow("unavailable");
  expect(mocks.prepare).not.toHaveBeenCalled();
  rows = [
    {
      id: booklet,
      filename: "Design.pdf",
      content_type: "application/pdf",
      size_bytes: 4 * 1024 * 1024,
      content_base64: Buffer.alloc(4 * 1024 * 1024).toString("base64"),
    },
    {
      id: extra,
      filename: "Site.pdf",
      content_type: "application/pdf",
      size_bytes: 1,
      content_base64: "YQ==",
    },
  ];
  await expect(
    prepareStudioPackageEmail(
      quote,
      { ...payload(), artifactIds: [booklet, extra] },
      "actor",
    ),
  ).rejects.toThrow("4MB");
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});
it("rejects obsolete quote revision and stale prepared sends without provider work", async () => {
  await expect(
    prepareStudioPackageEmail(
      quote,
      { ...payload(), expectedCommercialRevision: 2 },
      "actor",
    ),
  ).rejects.toThrow("changed");
  expect(mocks.pdf).not.toHaveBeenCalled();
  await prepareStudioPackageEmail(quote, payload(), "actor");
  const detail = await mocks.detail();
  mocks.detail.mockResolvedValue({ ...detail, commercialRevision: 4 });
  await expect(
    sendPreparedStudioPackageEmail(quote, intent.id, "actor"),
  ).rejects.toThrow("changed");
  expect(mocks.dispatch).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});
