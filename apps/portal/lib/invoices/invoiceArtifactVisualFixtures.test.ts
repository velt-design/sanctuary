// @vitest-environment node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateDepositInvoicePdfBytesWithLayout,
  type DepositInvoicePdfData,
} from "./pdf";

const SYNTHETIC_PAYMENT_LINES = [
  "Please make payment by bank transfer:",
  "Sanctuary Fixture Account",
  "Bank details: 00-0000-0000000-00",
  "Please include the invoice number",
] as const;

function fixture(
  overrides: Partial<DepositInvoicePdfData> = {},
): DepositInvoicePdfData {
  return {
    invoiceRef: "INV-2026-0147",
    quoteRef: "Q-2026-0084",
    quoteVersionNumber: 3,
    customerName: "Taylor Morgan",
    projectName: "Warkworth Courtyard",
    projectAddress: "18 Example Lane, Warkworth, Auckland",
    issueDate: "2026-07-01",
    dueDate: "2026-07-08",
    depositPercent: 50,
    quoteTotalIncGstCents: 575000,
    totalIncGstCents: 287500,
    totalExGstCents: 250000,
    gstCents: 37500,
    ...overrides,
  };
}

const visualFixtures: Array<{
  name: string;
  invoice: DepositInvoicePdfData;
  paymentLines: readonly string[];
}> = [
  {
    name: "01-standard",
    invoice: fixture(),
    paymentLines: SYNTHETIC_PAYMENT_LINES,
  },
  {
    name: "02-alternate-deposit",
    invoice: fixture({
      invoiceRef: "INV-2026-0212",
      depositPercent: 30,
      totalIncGstCents: 172500,
      totalExGstCents: 150000,
      gstCents: 22500,
    }),
    paymentLines: SYNTHETIC_PAYMENT_LINES,
  },
  {
    name: "03-long-identity",
    invoice: fixture({
      invoiceRef: "INV-2026-EXTENDED-REFERENCE-FOR-ARCHITECTURAL-PROJECT-0147",
      quoteRef: "Q-2026-EXTENDED-SOURCE-QUOTE-REFERENCE-0084",
      customerName:
        "A deliberately extended customer collective name for layout verification",
      projectName:
        "A deliberately extended courtyard and outdoor room project identity",
      projectAddress:
        "18 Deliberately Extended Example Lane, Warkworth township district, Auckland region",
    }),
    paymentLines: SYNTHETIC_PAYMENT_LINES,
  },
  {
    name: "04-multi-page-payment",
    invoice: fixture({ invoiceRef: "INV-2026-LONG-PAYMENT-0147" }),
    paymentLines: Array.from(
      { length: 48 },
      (_, index) =>
        `Fixture instruction ${index + 1}: synthetic payment guidance for deterministic layout verification only.`,
    ),
  },
];

const content = {
  version: 1 as const, billingName: 'Synthetic customer', billingEmail: 'customer@example.invalid',
  billingAddress: '18 Example Lane\nAuckland', notes: 'Synthetic fixture. No payment should be made.',
  items: [
    { id: 'structure', description: 'Pergola structure\nPowder coated frame, posts and roof.', qty: 1, unitPriceIncGstCents: 460000, lineTotalIncGstCents: 460000 },
    { id: 'installation', description: 'Installation and site finishing', qty: 2, unitPriceIncGstCents: 57500, lineTotalIncGstCents: 115000 },
  ],
};
visualFixtures.push(
  { name: '05-itemised-deposit', invoice: fixture({ contentSnapshot: content, invoiceKind: 'QUOTE_LINKED', paymentTermLabel: 'Initial payment', paymentTermCalculation: 'fixed' }), paymentLines: SYNTHETIC_PAYMENT_LINES },
  { name: '06-standalone', invoice: fixture({ contentSnapshot: content, invoiceKind: 'STANDALONE', quoteRef: '', quoteVersionNumber: 0, quoteTotalIncGstCents: 0,
    paymentTermLabel: 'Project work', paymentTermCalculation: 'fixed', totalIncGstCents: 575000, totalExGstCents: 500000, gstCents: 75000 }), paymentLines: SYNTHETIC_PAYMENT_LINES },
  { name: '07-long-itemised-scope', invoice: fixture({ invoiceKind: 'QUOTE_LINKED', contentSnapshot: { ...content,
    items: content.items.map((item) => ({ ...item, description: Array.from({ length: 20 }, (_, i) => `Specification ${i + 1}: ${item.description}`).join('\n') })) } }), paymentLines: SYNTHETIC_PAYMENT_LINES },
  { name: '08-draft-preview', invoice: fixture({ draft: true, invoiceRef: 'DRAFT', contentSnapshot: content, invoiceKind: 'QUOTE_LINKED' }), paymentLines: ['DRAFT — PREVIEW ONLY. Do not pay.'] },
);

describe("deposit invoice PDF visual fixtures", () => {
  it("renders deterministic, non-persistent invoice scenarios", async () => {
    const outputDir = process.env.INVOICE_ARTIFACT_OUTPUT_DIR?.trim();
    if (outputDir) await mkdir(outputDir, { recursive: true });

    for (const entry of visualFixtures) {
      const { bytes, layout } = await generateDepositInvoicePdfBytesWithLayout(
        entry.invoice,
        {
          paymentLines: entry.paymentLines,
        },
      );

      expect(bytes.byteLength).toBeGreaterThan(10_000);
      expect(
        layout.pages.every(
          (page) => (page.contentBottomY ?? Number.POSITIVE_INFINITY) >= 92,
        ),
      ).toBe(true);

      if (outputDir) {
        await writeFile(
          path.join(outputDir, `${entry.name}.pdf`),
          Buffer.from(bytes),
        );
      }
    }
  }, 15_000);
});
