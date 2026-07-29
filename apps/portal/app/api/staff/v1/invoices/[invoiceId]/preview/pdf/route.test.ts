import { beforeEach, describe, expect, it, vi } from "vitest";

const requireStaffSession = vi.fn();
const getDepositInvoicePdfPreview = vi.fn();
const INVOICE_ID = "inv_11111111-1111-4111-8111-111111111111";

vi.mock("@/lib/api/staffApi", () => ({
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { "content-type": "application/json" },
    }),
  requireStaffSession,
}));

vi.mock("@/lib/invoices/server", () => ({
  getDepositInvoicePdfPreview,
}));

describe("GET /api/staff/v1/invoices/[invoiceId]/preview/pdf", () => {
  beforeEach(() => {
    requireStaffSession.mockReset();
    getDepositInvoicePdfPreview.mockReset();
  });

  it("requires staff authentication", async () => {
    requireStaffSession.mockResolvedValue(null);
    const mod = await import("./route");
    const response = await mod.GET(
      new Request(
        `http://localhost/api/staff/v1/invoices/${INVOICE_ID}/preview/pdf`,
      ),
      { params: Promise.resolve({ invoiceId: INVOICE_ID }) },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getDepositInvoicePdfPreview).not.toHaveBeenCalled();
  });

  it("returns an inline private PDF without persisting an artifact", async () => {
    requireStaffSession.mockResolvedValue({
      user: { email: "staff@example.invalid" },
    });
    getDepositInvoicePdfPreview.mockResolvedValue({
      filename: "INV 1.pdf",
      bytes: new Uint8Array([37, 80, 68, 70]),
    });

    const mod = await import("./route");
    const response = await mod.GET(
      new Request(
        `http://localhost/api/staff/v1/invoices/${INVOICE_ID}/preview/pdf`,
      ),
      { params: Promise.resolve({ invoiceId: INVOICE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="INV-1.pdf"',
    );
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      37, 80, 68, 70,
    ]);
    expect(getDepositInvoicePdfPreview).toHaveBeenCalledOnce();
  });

  it("rejects malformed invoice IDs before rendering", async () => {
    requireStaffSession.mockResolvedValue({
      user: { email: "staff@example.invalid" },
    });
    const mod = await import("./route");

    const response = await mod.GET(
      new Request(
        "http://localhost/api/staff/v1/invoices/not-an-id/preview/pdf",
      ),
      { params: Promise.resolve({ invoiceId: "not-an-id" }) },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getDepositInvoicePdfPreview).not.toHaveBeenCalled();
  });
});
