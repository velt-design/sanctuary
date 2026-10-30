// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  pdf: vi.fn(),
  writes: [] as Array<{
    table: string;
    operation: string;
    value: Record<string, unknown>;
  }>,
  fileReads: [] as string[],
}));
vi.mock("@/lib/supabaseClient", () => ({
  supabaseServiceRole: {
    from: mocks.from,
    rpc: vi.fn(() => {
      throw Error("Unexpected RPC");
    }),
  },
}));
vi.mock("./pdf", () => ({
  generateQuotePdfBytes: mocks.pdf,
  quotePdfFilename: (ref: string, version: number) => `${ref}-v${version}.pdf`,
}));
vi.mock("./serverLoaders", () => ({
  loadEstimateLabels: vi.fn(async () => new Map()),
  loadEstimate: vi.fn(),
  loadProjectCustomerName: vi.fn(),
  loadQuoteFamilyByCommercialScope: vi.fn(),
}));
vi.mock("./studioCommit.server", () => ({
  loadStudioQuoteView: vi.fn(async () => undefined),
  commitQuoteWithStudioBinding: vi.fn(),
}));
vi.mock("../commercial/quoteDeliveryReadiness", () => ({
  loadQuoteDeliveryReadiness: vi.fn(async () => ({
    commercialWorkflowReady: true,
    unfinishedDelivery: null,
  })),
}));
vi.mock("../commercial/acceptQuote", () => ({
  acceptQuoteAndEnsureDepositInvoice: vi.fn(),
}));
vi.mock("@/lib/projects/workItems/quoteCadenceReconciliation", () => ({
  reconcileQuoteOutcomeCadence: vi.fn(),
}));
import {
  ensureQuoteArtifacts,
  ensurePdfForSend,
  downloadQuotePdf,
  getQuoteVersionDetail,
} from "./serverCore";
import {
  buildQuotePreviewBasePayload,
  buildQuoteRenderHash,
} from "./renderArtifacts";
const versionId = "10000000-0000-4000-8000-000000000001",
  projectId = "10000000-0000-4000-8000-000000000002",
  quoteId = "10000000-0000-4000-8000-000000000003",
  existingFileId = "10000000-0000-4000-8000-000000000004",
  replacementFileId = "10000000-0000-4000-8000-000000000006";
const appVersionId = `qv_${versionId}`,
  issuedBytes = Buffer.from("%PDF-existing-synthetic-issued-bytes");
let row: Record<string, any>;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.writes.length = 0;
  mocks.fileReads.length = 0;
  vi.stubEnv("PUBLIC_SITE_URL", "https://customer.example.test");
  mocks.pdf.mockResolvedValue(Buffer.from("%PDF-replacement-synthetic-bytes"));
  row = {
    id: versionId,
    quote_id: quoteId,
    status: "SENT",
    version_number: 2,
    created_at: "2026-03-10T00:00:00.000Z",
    updated_at: "2026-03-11T00:00:00.000Z",
    sent_at: "2026-03-11T00:00:00.000Z",
    sent_by: "synthetic-staff",
    expires_at: "2026-04-10",
    commercial_revision: 1,
    is_current_draft: false,
    pricing_source: "manual",
    pricing_source_metadata: {},
    deposit_percent: 50,
    payment_terms: null,
    reference: "SYNTHETIC-REF",
    customer_name: "Sam Test",
    intro_text: "Synthetic quote introduction",
    terms_text: "Synthetic agreed terms",
    total_inc_gst_cents: 115000,
    total_ex_gst_cents: 100000,
    gst_cents: 15000,
    pdf_file_id: existingFileId,
    quotes: {
      id: quoteId,
      project_id: projectId,
      quote_ref: "Q-SYNTHETIC",
      internal_name: null,
      commercial_scope_id: null,
    },
  };
  mocks.from.mockImplementation((table: string) => {
    let operation = "read",
      value: any,
      id: string | undefined;
    const result = () => {
      if (operation === "update") {
        Object.assign(row, value);
        return { data: null, error: null };
      }
      if (operation === "insert")
        return {
          data: { id: replacementFileId, filename: value.filename },
          error: null,
        };
      if (table === "quote_versions") return { data: row, error: null };
      if (table === "quote_line_items")
        return {
          data: [
            {
              id: "10000000-0000-4000-8000-000000000005",
              description: "Synthetic pergola",
              qty: 1,
              unit_price_inc_gst_cents: 115000,
              line_total_inc_gst_cents: 115000,
              sort_order: 0,
            },
          ],
          error: null,
        };
      if (table === "quote_send_logs") return { data: [], error: null };
      if (table === "projects")
        return {
          data: {
            id: projectId,
            name: "Synthetic courtyard",
            site_address: "12 Example Road",
            region: "Auckland",
            quote_ref: "Q-SYNTHETIC",
            contacts: {
              name: "Sam Test",
              email: "sam@example.test",
              phone: null,
              address: "12 Example Road",
            },
          },
          error: null,
        };
      if (table === "file_artifacts") {
        mocks.fileReads.push(id!);
        return {
          data: {
            filename: "Q-SYNTHETIC-v2.pdf",
            content_base64: issuedBytes.toString("base64"),
          },
          error: null,
        };
      }
      throw Error(`Unexpected read ${table}`);
    };
    const query: any = {
      select: () => query,
      eq: (column: string, expected: string) => {
        if (column === "id") id = expected;
        return query;
      },
      order: () => query,
      single: async () => result(),
      maybeSingle: async () => result(),
      update: (input: any) => {
        operation = "update";
        value = input;
        mocks.writes.push({ table, operation, value: input });
        return query;
      },
      insert: (input: any) => {
        operation = "insert";
        value = input;
        mocks.writes.push({ table, operation, value: input });
        return query;
      },
      then: (resolve: any, reject: any) =>
        Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  });
});
afterEach(() => vi.unstubAllEnvs());
// Exact public625 hashes of the actual mapped synthetic rows. No Studio metadata existed in this wire identity.
const legacyHashes = {
  DRAFT: "e9e6ed3b90f56601ebee30b0450eadf2b8b6e41a548ee50c783ec6488ffb1240",
  SENT: "4959482e1159fe3195c30511a36cf6d7e1b1d7d7e401d3300106b787e4057ac9",
  ACCEPTED: "1304365f4b73af79483aa86b8c7797d6cdac76f8d14a06e405442c980d12c05c",
} as const;
it.each(["DRAFT", "SENT", "ACCEPTED"] as const)(
  "keeps the published %s preview, attachment download and send-preparation PDF identity",
  async (status) => {
    row.status = status;
    row.is_current_draft = status === "DRAFT";
    if (status === "DRAFT") {
      row.sent_at = null;
      row.sent_by = null;
    }
    row.render_hash = legacyHashes[status];
    const detail = await getQuoteVersionDetail(appVersionId);
    expect(detail).not.toBeNull();
    expect(buildQuoteRenderHash(detail!)).toBe(legacyHashes[status]);
    const previewBase = buildQuotePreviewBasePayload({
      detail: detail!,
      quoteAcceptUrl: "https://example.test/quote/preview",
      expiresAtLabel: "10 Apr 2026",
    });
    row.preview_base_payload = previewBase;
    const preview = await ensureQuoteArtifacts(appVersionId, null);
    expect(preview.cacheHit).toBe(true);
    expect(preview.previewBase).toEqual(previewBase);
    expect(preview.detail.pdfFileId).toBe(`file_${existingFileId}`);
    expect(mocks.fileReads).toEqual([]);
    const download = await downloadQuotePdf(appVersionId, null);
    expect(download.cacheHit).toBe(true);
    expect(Buffer.from(download.bytes)).toEqual(issuedBytes);
    const attachment = await ensurePdfForSend(preview.detail, null);
    expect(attachment).toEqual({
      fileUuid: existingFileId,
      filename: "Q-SYNTHETIC-v2.pdf",
      content: issuedBytes,
    });
    if (status !== "DRAFT") {
      const inline = await downloadQuotePdf(appVersionId, null, {
        forceRegenerateDraft: true,
      });
      expect(inline.cacheHit).toBe(true);
      expect(Buffer.from(inline.bytes)).toEqual(issuedBytes);
    }
    expect(mocks.fileReads.every((id) => id === existingFileId)).toBe(true);
    expect(row.pdf_file_id).toBe(existingFileId);
    expect(row.render_hash).toBe(legacyHashes[status]);
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(mocks.writes).toEqual([]);
  },
);
it("retains the intentional forced inline refresh for an ordinary current draft", async () => {
  row.status = "DRAFT";
  row.is_current_draft = true;
  row.sent_at = null;
  row.sent_by = null;
  row.render_hash = legacyHashes.DRAFT;
  const detail = await getQuoteVersionDetail(appVersionId);
  row.preview_base_payload = buildQuotePreviewBasePayload({
    detail: detail!,
    quoteAcceptUrl: "https://example.test/quote/preview",
  });
  const refreshed = await downloadQuotePdf(appVersionId, null, {
    forceRegenerateDraft: true,
  });
  expect(refreshed.cacheHit).toBe(false);
  expect(mocks.pdf).toHaveBeenCalledOnce();
  expect(row.pdf_file_id).toBe(replacementFileId);
  expect(mocks.writes.map((write) => [write.table, write.operation])).toEqual([
    ["file_artifacts", "insert"],
    ["quote_versions", "update"],
  ]);
});
