import { describe, expect, it } from "vitest";
import { buildDepositInvoiceEmailInput } from "./emailPresentation";

describe("deposit invoice email presentation", () => {
  it("preserves the PDF view model totals, dates, references, and payment lines", () => {
    const input = buildDepositInvoiceEmailInput({
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
      recipients: {
        to: ["customer@example.invalid"],
        cc: [],
        bcc: [],
      },
      subject: "Deposit invoice - INV-2026-0147",
      invoiceLink: "https://example.invalid/invoice/fixture?token=preview-only",
      paymentLines: ["Pay by bank transfer.", "Use the invoice number."],
      referenceId: "Deposit for the accepted quote",
      attachmentNames: ["INV-2026-0147.pdf"],
    });

    expect(input).toMatchObject({
      invoice_number: "INV-2026-0147",
      quote_number: "Q-2026-0092 v3",
      deposit_percent: "50%",
      source_quote_total_inc_gst: "$25,875.00",
      invoice_subtotal_ex_gst: "$11,250.00",
      invoice_gst: "$1,687.50",
      invoice_total_inc_gst: "$12,937.50",
      due_date: "5 Aug 2026",
      payment_reference: "INV-2026-0147",
      payment_lines: ["Pay by bank transfer.", "Use the invoice number."],
      attachment_names: ["INV-2026-0147.pdf"],
    });
  });
});
