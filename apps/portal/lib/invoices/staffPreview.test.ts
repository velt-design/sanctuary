import { beforeEach, describe, expect, it, vi } from "vitest";

const renderDepositInvoiceEmail = vi.hoisted(() => vi.fn());

vi.mock("../emails/invoice", () => ({
  renderDepositInvoiceEmail,
}));

import {
  preparedDepositInvoicePreview,
  prospectiveDepositInvoicePreview,
} from "./staffPreview";

describe("staff invoice artifact preview", () => {
  beforeEach(() => {
    renderDepositInvoiceEmail.mockReset();
  });

  it("redacts a frozen customer token without changing the prepared envelope", () => {
    const preview = preparedDepositInvoicePreview({
      invoiceId: "inv_1",
      invoiceRef: "INV-2026-0147",
      attachmentNames: ["INV-2026-0147.pdf"],
      frozen: {
        sentAt: "2026-07-29T02:00:00.000Z",
        tokenHash: "hash",
        tokenExpiresAt: "2026-09-04T23:59:59.999Z",
        recipients: {
          to: ["customer@example.invalid"],
          cc: [],
          bcc: [],
        },
        subject: "Deposit invoice - INV-2026-0147",
        html: '<a href="https://example.invalid?token=customer-secret">View</a>',
        text: "https://example.invalid?token=customer-secret",
        attachmentFileIds: ["file-1"],
        actor: "staff@example.invalid",
      },
    });

    expect(preview.source).toBe("prepared");
    expect(preview.recipients.to).toEqual(["customer@example.invalid"]);
    expect(JSON.stringify(preview)).not.toContain("customer-secret");
    expect(preview.html).toContain("token=[redacted]");
  });

  it("uses the production email renderer for a prospective preview", async () => {
    renderDepositInvoiceEmail.mockResolvedValue({
      html: "<html>Invoice preview</html>",
      text: "Invoice preview",
    });

    const preview = await prospectiveDepositInvoicePreview({
      invoiceId: "inv_1",
      invoiceRef: "INV-2026-0147",
      quoteRef: "Q-2026-0092",
      quoteVersionNumber: 3,
      customerName: "Taylor Morgan",
      projectName: "Courtyard pergola",
      projectAddress: "12 Example Lane, Auckland",
      issueDate: "2026-07-29",
      dueDate: "2026-08-05",
      depositPercent: 50,
      quoteTotalIncGstCents: 2587500,
      totalIncGstCents: 1293750,
      totalExGstCents: 1125000,
      gstCents: 168750,
      recipients: { to: [], cc: [], bcc: [] },
      subject: "Deposit invoice - INV-2026-0147",
      invoiceLink: "https://preview.invalid?token=preview-only",
      paymentLines: ["Pay by bank transfer."],
      attachmentNames: ["INV-2026-0147.pdf"],
    });

    expect(preview.source).toBe("prospective");
    expect(renderDepositInvoiceEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice_number: "INV-2026-0147",
        payment_reference: "INV-2026-0147",
        invoice_total_inc_gst: "$12,937.50",
      }),
    );
  });
});
