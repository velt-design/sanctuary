import { notFound } from "next/navigation";
import { renderDepositInvoiceEmail } from "@/lib/emails/invoice";
import type { DepositInvoiceArtifactPreview } from "@/lib/invoices/types";
import InvoiceArtifactPreviewFixtureClient from "./InvoiceArtifactPreviewFixtureClient";

const FIXTURE_INVOICE_ID = "inv_11111111-1111-4111-8111-111111111111";

export default async function InvoiceArtifactPreviewFixturePage() {
  if (process.env.ENABLE_PORTAL_QA_FIXTURES !== "1") notFound();

  const rendered = await renderDepositInvoiceEmail({
    to: ["customer@example.invalid"],
    subject: "Deposit invoice - INV-2026-0147",
    name: "Taylor Morgan",
    invoice_number: "INV-2026-0147",
    project_name: "Warkworth Courtyard",
    project_address: "18 Example Lane, Warkworth, Auckland",
    quote_number: "Q-2026-0084 v3",
    deposit_percent: "50%",
    source_quote_total_inc_gst: "$5,750.00",
    invoice_subtotal_ex_gst: "$2,500.00",
    invoice_gst: "$375.00",
    invoice_total_inc_gst: "$2,875.00",
    due_date: "8 Jul 2026",
    payment_reference: "INV-2026-0147",
    invoice_link: "https://preview.invalid/invoice/fixture?token=preview-only",
    payment_lines: [
      "Fixture bank-transfer instructions.",
      "Fixture account name.",
      "Fixture account number.",
      "Use the invoice number as the payment reference.",
    ],
    attachment_names: ["INV-2026-0147.pdf"],
    contact_email: "accounts@example.invalid",
  });

  const preview: DepositInvoiceArtifactPreview = {
    invoiceId: FIXTURE_INVOICE_ID,
    invoiceRef: "INV-2026-0147",
    subject: "Deposit invoice - INV-2026-0147",
    html: rendered.html,
    text: rendered.text ?? null,
    recipients: {
      to: ["customer@example.invalid"],
      cc: [],
      bcc: [],
    },
    attachmentNames: ["INV-2026-0147.pdf"],
    source: "prospective",
  };

  return <InvoiceArtifactPreviewFixtureClient preview={preview} />;
}
