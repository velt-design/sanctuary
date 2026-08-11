// @vitest-environment node

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  buildDepositInvoiceArtifactViewModel,
  resolveDepositInvoicePaymentLines,
} from "./invoiceArtifactViewModel";
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

async function extractPdfPages(bytes: Uint8Array): Promise<
  Array<{
    text: string;
    items: Array<{ x: number; width: number; text: string }>;
  }>
> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .filter(
        (
          item,
        ): item is typeof item & {
          str: string;
          transform: number[];
          width: number;
        } => "str" in item && "transform" in item && "width" in item,
      )
      .map((item) => ({
        x: item.transform[4] ?? 0,
        width: item.width,
        text: item.str,
      }));
    pages.push({
      text: items
        .map((item) => item.text)
        .filter(Boolean)
        .join(" "),
      items,
    });
  }

  return pages;
}

describe("deposit invoice artifact view model", () => {
  it("preserves authoritative values while formatting presentation fields", () => {
    const viewModel = buildDepositInvoiceArtifactViewModel(
      fixture({ depositPercent: 37.5 }),
      SYNTHETIC_PAYMENT_LINES,
    );

    expect(viewModel.header.invoiceRef).toBe("INV-2026-0147");
    expect(viewModel.header.quoteRef).toBe("Q-2026-0084");
    expect(viewModel.dates.issue).toBe("1 Jul 2026");
    expect(viewModel.dates.due).toBe("8 Jul 2026");
    expect(viewModel.deposit.percent).toBe("37.5");
    expect(viewModel.totals).toEqual({
      quoteTotalIncGst: "$5,750.00",
      totalExGst: "$2,500.00",
      gst: "$375.00",
      totalIncGst: "$2,875.00",
    });
    expect(viewModel.payment.reference).toBe("INV-2026-0147");
    expect(viewModel.payment.lines).toEqual(SYNTHETIC_PAYMENT_LINES);
  });

  it("prefers the immutable invoice payment snapshot over later fallback details", () => {
    expect(
      resolveDepositInvoicePaymentLines(
        "Original account line\nOriginal reference instruction",
        ["Later account line"],
      ),
    ).toEqual(["Original account line", "Original reference instruction"]);
    expect(
      resolveDepositInvoicePaymentLines(null, ["Legacy fallback line"]),
    ).toEqual(["Legacy fallback line"]);
  }, 15_000);
});

describe("deposit invoice PDF", () => {
  it("renders the payment-ledger hierarchy and document metadata", async () => {
    const { bytes, layout } = await generateDepositInvoicePdfBytesWithLayout(
      fixture(),
      { paymentLines: SYNTHETIC_PAYMENT_LINES },
    );
    const [page] = await extractPdfPages(bytes);
    const document = await PDFDocument.load(bytes);

    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0]).toMatchObject({
      hasPageBackground: true,
      hasLeftRail: true,
      hasPaymentSummary: true,
      hasCalculation: true,
      paymentSegmentCount: 1,
    });
    expect(page?.text).toContain("Deposit invoice");
    expect(page?.text).toContain("AMOUNT DUE (INCL. GST)");
    expect(page?.text).toContain("$2,875.00");
    expect(page?.text).toContain("8 Jul 2026");
    expect(page?.text).toContain("PAYMENT REFERENCE");
    expect(page?.text).toContain("INV-2026-0147");
    expect(page?.text).toContain("Source quote total (incl. GST)");
    expect(page?.text).toContain("Q-2026-0084 v3");
    expect(document.getTitle()).toBe(
      "INV-2026-0147 - Deposit invoice - Sanctuary Pergolas",
    );
    expect(document.getAuthor()).toBe("Sanctuary Pergolas");
    expect(document.getSubject()).toBe(
      "Deposit invoice for quote Q-2026-0084 v3",
    );
  });

  it("wraps long customer, project, address, and reference content within A4", async () => {
    const longPhrase =
      "A deliberately extended customer artifact identity used to prove safe wrapping";
    const { bytes, layout } = await generateDepositInvoicePdfBytesWithLayout(
      fixture({
        invoiceRef:
          "INV-2026-EXTENDED-REFERENCE-FOR-ARCHITECTURAL-PROJECT-0147",
        quoteRef: "Q-2026-EXTENDED-SOURCE-QUOTE-REFERENCE-0084",
        customerName: `${longPhrase} customer collective`,
        projectName: `${longPhrase} courtyard and outdoor room`,
        projectAddress: `${longPhrase} street address, Warkworth township district, Auckland region`,
      }),
      { paymentLines: SYNTHETIC_PAYMENT_LINES },
    );
    const pages = await extractPdfPages(bytes);

    expect(layout.pages.length).toBeGreaterThanOrEqual(1);
    expect(
      layout.pages.every(
        (page) => (page.contentBottomY ?? CONTENT_BOTTOM_FALLBACK) >= 92,
      ),
    ).toBe(true);
    expect(pages.map((page) => page.text).join(" ")).toContain(
      "A deliberately extended customer artifact identity",
    );
    expect(
      pages.every((page) =>
        page.items.every(
          (item) =>
            !item.text ||
            (item.x >= 0 && item.x + Math.max(0, item.width) <= 596),
        ),
      ),
    ).toBe(true);
  });

  it("paginates extended payment instructions without dropping content", async () => {
    const paymentLines = Array.from(
      { length: 120 },
      (_, index) =>
        `Fixture instruction ${index + 1}: use only the synthetic review account and invoice reference shown in this deterministic artifact.`,
    );
    const { bytes, layout } = await generateDepositInvoicePdfBytesWithLayout(
      fixture(),
      { paymentLines },
    );
    const pages = await extractPdfPages(bytes);
    const text = pages.map((page) => page.text).join(" ");

    expect(layout.pages.length).toBeGreaterThan(2);
    expect(text).toContain("Fixture instruction 120");
    expect(text).toContain(`Page 1 of ${layout.pages.length}`);
    expect(text).toContain(
      `Page ${layout.pages.length} of ${layout.pages.length}`,
    );
    expect(
      layout.pages.every(
        (page) => (page.contentBottomY ?? CONTENT_BOTTOM_FALLBACK) >= 92,
      ),
    ).toBe(true);
    expect(
      layout.pages.reduce((count, page) => count + page.paymentSegmentCount, 0),
    ).toBeGreaterThan(2);
  });
});

const CONTENT_BOTTOM_FALLBACK = Number.POSITIVE_INFINITY;
