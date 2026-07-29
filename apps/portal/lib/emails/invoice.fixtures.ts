import type { DepositInvoiceEmailInput } from "./invoice";

const sharedFixture = {
  to: ["customer@example.invalid"],
  name: "Taylor Morgan",
  invoice_number: "INV-2026-0147",
  project_name: "Warkworth Courtyard",
  project_address: "18 Example Lane, Warkworth, Auckland",
  quote_number: "Q-2026-0084 v2",
  deposit_percent: "50%",
  source_quote_total_inc_gst: "$11,500.00",
  invoice_subtotal_ex_gst: "$5,000.00",
  invoice_gst: "$750.00",
  invoice_total_inc_gst: "$5,750.00",
  due_date: "5 Aug 2026",
  payment_reference: "INV-2026-0147",
  invoice_link:
    "https://preview.invalid/invoice/invoice-fixture?token=visual-fixture&source=email",
  payment_lines: [
    "Payment details for deterministic fixture rendering only.",
    "Account name: [fixture account]",
    "Account number: [fixture account number]",
    "Please include your invoice number as the payment reference.",
  ],
  personal_note_html:
    "Thank you for confirming the project. Reply if you would like to discuss any part of this invoice.",
  personal_note_text:
    "Thank you for confirming the project. Reply if you would like to discuss any part of this invoice.",
  contact_email: "accounts@example.invalid",
  reference_id: "PROJECT-FIXTURE-0147",
  attachment_names: ["INV-2026-0147.pdf"],
} satisfies DepositInvoiceEmailInput;

export const DEPOSIT_INVOICE_EMAIL_VISUAL_FIXTURES: ReadonlyArray<{
  name: string;
  input: DepositInvoiceEmailInput;
}> = [
  {
    name: "01-standard",
    input: sharedFixture,
  },
  {
    name: "02-long-identity",
    input: {
      ...sharedFixture,
      name: "Alexandra and Christopher Morgan-Williams",
      invoice_number: "INV-2026-0147-LONG-REFERENCE",
      project_name:
        "Northern Courtyard Pergola and Outdoor Living Transformation",
      project_address:
        "1848 Long Example Road, Warkworth, Auckland 0985, Aotearoa New Zealand",
      quote_number: "Q-2026-0084-LONG-CUSTOMER-REFERENCE v12",
      payment_reference: "INV-2026-0147-LONG-REFERENCE",
      reference_id: "PROJECT-FIXTURE-LONG-REFERENCE-0147",
      attachment_names: ["INV-2026-0147-LONG-REFERENCE.pdf"],
    },
  },
];
