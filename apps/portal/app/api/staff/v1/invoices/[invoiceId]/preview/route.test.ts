import { beforeEach, describe, expect, it, vi } from "vitest";

const requireStaffSession = vi.fn();
const getDepositInvoiceArtifactPreview = vi.fn();
const INVOICE_ID = "inv_11111111-1111-4111-8111-111111111111";

vi.mock("@/lib/api/staffApi", () => ({
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { "content-type": "application/json" },
    }),
  jsonOk: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  requireStaffSession,
}));

vi.mock("@/lib/invoices/server", () => ({
  getDepositInvoiceArtifactPreview,
}));

describe("GET /api/staff/v1/invoices/[invoiceId]/preview", () => {
  beforeEach(() => {
    requireStaffSession.mockReset();
    getDepositInvoiceArtifactPreview.mockReset();
  });

  it("requires a staff session before loading protected preview content", async () => {
    requireStaffSession.mockResolvedValue(null);
    const mod = await import("./route");
    const response = await mod.GET(
      new Request(
        `http://localhost/api/staff/v1/invoices/${INVOICE_ID}/preview`,
      ),
      { params: Promise.resolve({ invoiceId: INVOICE_ID }) },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getDepositInvoiceArtifactPreview).not.toHaveBeenCalled();
  });

  it("returns a private no-store preview with no raw customer token", async () => {
    requireStaffSession.mockResolvedValue({
      user: { email: "staff@example.invalid" },
    });
    getDepositInvoiceArtifactPreview.mockResolvedValue({
      invoiceId: INVOICE_ID,
      invoiceRef: "INV-1",
      subject: "Deposit invoice - INV-1",
      html: '<a href="?token=[redacted]">View invoice</a>',
      text: "?token=[redacted]",
      recipients: { to: ["customer@example.invalid"], cc: [], bcc: [] },
      attachmentNames: ["INV-1.pdf"],
      source: "prepared",
    });

    const mod = await import("./route");
    const response = await mod.GET(
      new Request(
        `http://localhost/api/staff/v1/invoices/${INVOICE_ID}/preview`,
      ),
      { params: Promise.resolve({ invoiceId: INVOICE_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body.preview.source).toBe("prepared");
    expect(JSON.stringify(body)).not.toContain("customer-secret");
  });

  it("rejects malformed invoice IDs before the protected data owner", async () => {
    requireStaffSession.mockResolvedValue({
      user: { email: "staff@example.invalid" },
    });
    const mod = await import("./route");

    const response = await mod.GET(
      new Request("http://localhost/api/staff/v1/invoices/not-an-id/preview"),
      { params: Promise.resolve({ invoiceId: "not-an-id" }) },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getDepositInvoiceArtifactPreview).not.toHaveBeenCalled();
  });
});
