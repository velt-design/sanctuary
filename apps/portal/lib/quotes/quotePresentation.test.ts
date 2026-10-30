// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { generateQuotePdfBytesWithLayout } from "./pdf";
import { buildQuoteRenderHash } from "./renderArtifacts";
import { buildPdfQuoteViewModel } from "./quotePdfViewModel";
import {
  quotePresentationVersion,
  SANCTUARY_QUOTE_PRESENTATION_VERSION,
} from "./quotePresentation";
import { wrapText } from "./pdfText";
import type { QuoteVersionDetail } from "./types";

function fixture(): QuoteVersionDetail {
  return {
    id: "qv_refinement",
    quoteId: "quote_refinement",
    projectId: "project_refinement",
    quoteRef: "Q-0123",
    versionNumber: 2,
    status: "DRAFT",
    updatedAt: "2026-10-29T00:00:00Z",
    commercialRevision: 1,
    isCurrentDraft: true,
    deliveryPreparedAt: null,
    pricingSource: "calculator_live",
    depositPercent: 50,
    sourceEstimateVersionId: "estimate_refinement",
    sourceEstimateVersionLabel: "V2",
    createdAt: "2026-10-29T00:00:00Z",
    sentAt: null,
    sentBy: null,
    expiresAt: "2026-11-28",
    reference: null,
    customerName: null,
    introText: "Thank you for the opportunity to quote.",
    termsText:
      "The quote is valid for 30 days.\nInstallation follows approval of the agreed design.\nSupplier rates and fitting times need confirmation.",
    totals: {
      totalIncGstCents: 1150000,
      totalExGstCents: 1000000,
      gstCents: 150000,
    },
    pdfFileId: null,
    lineItems: Array.from({ length: 4 }, (_, index) => ({
      id: `line-${index}`,
      description: `Pergola ${index + 1}\nSize: 6000 x 4000 mm\nRoof: Acrylic`,
      qty: 1,
      unitPriceIncGstCents: 287500,
      lineTotalIncGstCents: 287500,
      sortOrder: index,
    })),
    sendLogs: [],
    contact: { name: "Test client", email: "client@example.com", phone: null },
    project: {
      name: "Synthetic courtyard",
      siteAddress: "12 Example Road, Auckland",
      region: null,
      quoteRef: null,
    },
    studioDesign: {
      schemaVersion: "studio_quote_snapshot.v2",
      documentMode: "separate_v1",
      snapshotId: "synthetic-refinement",
      contentHash: "a".repeat(64),
      designId: "synthetic",
      revision: 8,
      publicationVersion: 2,
      images: [],
      selections: [],
      quotePresentationVersion: SANCTUARY_QUOTE_PRESENTATION_VERSION,
    },
  };
}

async function textOf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const text: string[] = [];
  for (let index = 1; index <= document.numPages; index++) {
    const page = await document.getPage(index),
      content = await page.getTextContent();
    text.push(
      content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
    );
  }
  await document.destroy();
  return text.join(" ").replace(/\s+/g, " ");
}

describe("frozen Sanctuary quote presentation", () => {
  it("requires the explicit known marker, keeps old hashes and makes a distinct new artifact", () => {
    const quote = fixture(),
      legacy = structuredClone(quote);
    delete legacy.studioDesign!.quotePresentationVersion;
    expect(quotePresentationVersion(legacy.studioDesign)).toBe("legacy");
    const originalHash = buildQuoteRenderHash(legacy);
    expect(buildQuoteRenderHash(structuredClone(legacy))).toBe(originalHash);
    expect(buildQuoteRenderHash(quote)).not.toBe(originalHash);
    expect(() =>
      quotePresentationVersion({
        ...quote.studioDesign!,
        quotePresentationVersion: "unknown",
      } as any),
    ).toThrow();
    expect(() =>
      quotePresentationVersion({
        ...quote.studioDesign!,
        schemaVersion: "studio_quote_snapshot.v1",
      } as any),
    ).toThrow();
    expect(() => quotePresentationVersion({...quote.studioDesign!,documentMode:undefined} as any)).toThrow();
    expect(() =>
      buildQuoteRenderHash({
        ...quote,
        studioDesign: {
          ...quote.studioDesign!,
          quotePresentationVersion: "unknown",
        } as any,
      }),
    ).toThrow();
  });

  it("fits an ordinary four-line quote with clean rules, whole payment and all three terms on one readable page", async () => {
    const quote = fixture(),
      original = structuredClone(quote),
      result = await generateQuotePdfBytesWithLayout(quote);
    expect(result.layout.pages).toHaveLength(1);
    const page = result.layout.pages[0];
    expect(page.hasLeftRail).toBe(false);
    for (const row of page.rowHeadingBounds!)
      expect(row.precedingRuleY - row.topY).toBeGreaterThanOrEqual(4);
    expect(
      page.paymentBlock!.bottomY - page.termsHeadingY!,
    ).toBeGreaterThanOrEqual(20);
    expect(page.contentBottomY).toBeGreaterThanOrEqual(76);
    const text = await textOf(result.bytes),
      model = buildPdfQuoteViewModel(quote);
    for (const term of model.terms) expect(text).toContain(term);
    for (const item of model.items)
      for (const value of [
        item.heading,
        item.qtyText,
        item.unitPrice,
        item.amount,
      ])
        expect(text).toContain(value);
    for (const amount of Object.values(model.totals))
      expect(text).toContain(amount);
    expect(text).toContain(model.deposit.nextStep);
    expect(text).toContain("Unit prices and amounts include GST");
    expect(text).not.toContain("\u2014");
    expect(quote).toEqual(original);
  });

  // Multi-page financial stress coverage includes native rendering and PDF text extraction.
  it("flows long names, many scope rows, negative adjustments and lengthy terms without clipping or dropping financial text", async () => {
    const quote = fixture();
    quote.project.name = "A carefully named courtyard ".repeat(10);
    quote.lineItems = Array.from({ length: 24 }, (_, index) => ({
      ...quote.lineItems[0],
      id: `line-${index}`,
      description: `Pergola section ${index + 1}\nSupplier qualification and installation scope ${"retained selection ".repeat(10)}`,
      sortOrder: index,
    }));
    quote.lineItems.push({
      ...quote.lineItems[0],
      id: "discount",
      description: "Approved discount",
      qty: 1,
      unitPriceIncGstCents: -11500,
      lineTotalIncGstCents: -11500,
      sortOrder: 25,
    });
    quote.termsText = Array.from(
      { length: 8 },
      (_, i) =>
        `Condition ${i + 1}: ${"Complete agreed customer term. ".repeat(20)}`,
    ).join("\n");
    const result = await generateQuotePdfBytesWithLayout(quote),
      text = await textOf(result.bytes),
      model = buildPdfQuoteViewModel(quote);
    expect(result.layout.pages.length).toBeGreaterThan(2);
    expect(
      result.layout.pages.every(
        (page) => !page.hasLeftRail && page.contentBottomY! >= 76,
      ),
    ).toBe(true);
    expect(text).toContain("Pergola section 24");
    expect(text).toContain("Approved discount");
    expect(text).toContain("-$115.00");
    expect(text).toContain("Condition 8:");
    expect(text).toContain(model.deposit.nextStep);
    expect(
      result.layout.pages.filter((page) => page.totalsBounds),
    ).toHaveLength(1);
    expect(
      result.layout.pages.find((page) => page.totalsBounds)?.paymentBlock,
    ).toBeDefined();
  }, 20_000);

  it("preserves empty scope rendering and the existing zero-total payment refusal", async () => {
    const quote = fixture();
    quote.lineItems = [];
    const result = await generateQuotePdfBytesWithLayout(quote);
    const text = await textOf(result.bytes);
    expect(text).toContain("$11,500.00");
    expect(text).not.toContain("NaN");
    expect(result.layout.pages.every((page) => !page.hasLeftRail)).toBe(true);
    expect(
      result.layout.pages.filter((page) => page.totalsBounds),
    ).toHaveLength(1);
    quote.totals = { totalIncGstCents: 0, totalExGstCents: 0, gstCents: 0 };
    await expect(generateQuotePdfBytesWithLayout(quote)).rejects.toThrow(
      "Remove percentage terms",
    );
    delete quote.studioDesign!.quotePresentationVersion;
    await expect(generateQuotePdfBytesWithLayout(quote)).rejects.toThrow(
      "Remove percentage terms",
    );
  });
});

it("wraps original paragraphs and overlong tokens within the actual font measure", async () => {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  const token = "VeryLongUnbrokenIdentifier".repeat(6),
    result = wrapText(font, `A short paragraph\n\n${token}`, 10, 100);
  expect(result).toContain("");
  expect(result.slice(2).join("").replace(/\s/g, "")).toBe(token);
  expect(result.every((line) => font.widthOfTextAtSize(line, 10) <= 100)).toBe(
    true,
  );
});
