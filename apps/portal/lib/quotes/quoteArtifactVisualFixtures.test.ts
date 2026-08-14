// @vitest-environment node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildQuotePreviewBasePayload,
  renderQuotePreviewFromBasePayload,
} from "./renderArtifacts";
import { generateQuotePdfBytes } from "./pdf";
import type { QuoteVersionDetail } from "./types";

function lineItem(
  id: string,
  description: string,
  amountCents: number,
  qty = 1,
) {
  return {
    id,
    description,
    qty,
    unitPriceIncGstCents: Math.round(amountCents / Math.max(qty, 1)),
    lineTotalIncGstCents: amountCents,
    sortOrder: Number(id.replace(/\D/g, "")) || 0,
  };
}

function fixture(
  id: string,
  overrides: Partial<QuoteVersionDetail> = {},
): QuoteVersionDetail {
  return {
    id,
    quoteId: `quote-${id}`,
    projectId: `project-${id}`,
    quoteRef: `Q-${id.toUpperCase()}`,
    versionNumber: 2,
    status: "SENT",
    updatedAt: "2026-07-01T00:00:00.000Z",
    commercialRevision: 1,
    isCurrentDraft: false,
    deliveryPreparedAt: null,
    pricingSource: "calculator_live",
    depositPercent: 50,
    sourceEstimateVersionId: `estimate-${id}`,
    sourceEstimateVersionLabel: "Estimate v2",
    revisedFromQuoteVersionId: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    createdBy: "fixture",
    sentAt: "2026-07-01T00:00:00.000Z",
    sentBy: "fixture",
    expiresAt: "2026-07-31",
    reference: `PROJECT-${id.toUpperCase()}`,
    customerName: "Taylor Morgan",
    introText:
      "Thank you for the opportunity to prepare this quote. The scope below reflects the project information currently agreed.",
    termsText: [
      "This quote is valid for 30 days from the issue date.",
      "A 50% deposit is required to confirm your booking.",
      "Lead times will be confirmed after acceptance.",
    ].join("\n"),
    totals: {
      totalIncGstCents: 575000,
      totalExGstCents: 500000,
      gstCents: 75000,
    },
    pdfFileId: null,
    renderHash: null,
    lineItems: [
      lineItem(
        "line-1",
        [
          "Courtyard pergola",
          "- Included: Custom-designed pergola, supplied and installed",
          "- Project delivery: Installation setup and project travel included in this item",
          "- Roof form: Pitched",
          "- Overall size: 6m x 3m",
          "- Roof covering: Acrylic roofing — admits natural light while adding overhead shelter",
          "- Frame finish: Matt black",
          "- Support posts: 2",
          "- Connection to home: Soffit brackets",
          "- Post foundations and fixings: Deck brackets",
        ].join("\n"),
        575000,
      ),
    ],
    sendLogs: [],
    contact: {
      name: "Taylor Morgan",
      email: "taylor@example.com",
      phone: "021 555 0101",
    },
    project: {
      name: "Warkworth Courtyard",
      siteAddress: "18 Example Lane, Warkworth, Auckland",
      region: "Auckland",
      quoteRef: null,
    },
    ...overrides,
  };
}

const visualFixtures: Array<{ name: string; quote: QuoteVersionDetail }> = [
  {
    name: "01-simple",
    quote: fixture("simple", {
      introText: null,
      termsText: "This quote is valid for 30 days.",
    }),
  },
  {
    name: "02-standard",
    quote: fixture("standard"),
  },
  {
    name: "03-discount",
    quote: fixture("discount", {
      lineItems: [
        lineItem(
          "line-1",
          "Courtyard pergola\n- Included: Custom-designed pergola, supplied and installed\n- Roof covering: Acrylic roofing — admits natural light while adding overhead shelter",
          575000,
        ),
        lineItem("line-2", "Project discount", -57500),
      ],
      totals: {
        totalIncGstCents: 517500,
        totalExGstCents: 450000,
        gstCents: 67500,
      },
    }),
  },
  {
    name: "04-multi-page",
    quote: fixture("multi", {
      lineItems: Array.from({ length: 22 }, (_, index) =>
        lineItem(
          `line-${index + 1}`,
          [
            `Pergola module ${index + 1}`,
            "- Project-specific frame and roof specification",
            "- Installation allowance",
          ].join("\n"),
          57500,
        ),
      ),
      totals: {
        totalIncGstCents: 1265000,
        totalExGstCents: 1100000,
        gstCents: 165000,
      },
    }),
  },
  {
    name: "05-long-description",
    quote: fixture("long-description", {
      lineItems: [
        lineItem(
          "line-1",
          [
            "Custom pergola",
            ...Array.from(
              { length: 95 },
              (_, index) =>
                `- Detail ${index + 1}: project-specific specification`,
            ),
          ].join("\n"),
          575000,
        ),
      ],
    }),
  },
  {
    name: "06-long-terms",
    quote: fixture("long-terms", {
      termsText: Array.from(
        { length: 55 },
        (_, index) =>
          `Term ${index + 1}: This condition records a representative project allowance and customer responsibility.`,
      ).join("\n"),
    }),
  },
  {
    name: "07-value-led-scope",
    quote: fixture("value-led-scope", {
      lineItems: [
        lineItem(
          "line-1",
          [
            "Courtyard pergola",
            "- Included: Custom-designed pergola, supplied and installed",
            "- Roof form: Pitched",
            "- Overall size: 6m x 3m",
            "- Roof covering: Acrylic roofing — admits natural light while adding overhead shelter",
            "- Frame finish: Matt black",
            "- Support posts: 2",
            "- Connection to home: Soffit brackets",
            "- Post foundations and fixings: Deck brackets",
          ].join("\n"),
          575000,
        ),
        lineItem(
          "line-2",
          [
            "Pool blind",
            "- Included: Custom-sized blind system",
            "- System: Omni",
            "- Dimensions: 2,000mm wide × 2,400mm drop",
            "- Fabric: Fine mesh",
            "- Operation: Motorised",
            "- Roll cover: Flashing — 2m charged at $44/m; $88.00 incl GST",
          ].join("\n"),
          187050,
        ),
        lineItem(
          "line-3",
          [
            "Courtyard integrated rafter lighting",
            "- Included: Rafter-integrated lighting package and installation labour",
            "- Lights: 8 rafter lights",
            "- Drivers: 1",
            "- Control: Dimming included",
          ].join("\n"),
          255000,
        ),
        lineItem(
          "line-4",
          [
            "Design, engineering and consent documentation",
            "- Included: Additional design and documentation allowance required to support the pergola through the building consent process",
            "- Structural engineering calculations",
            "- Engineer's PS1 documentation",
            "- Full shop drawing set for the pergola structure",
            "- Consent documentation support",
            "- Responses to council RFIs relating to the pergola structure",
            "- Builder's PS3 on completion",
            "- Coordination with the engineer, as required",
          ].join("\n"),
          575000,
        ),
        lineItem(
          "line-5",
          [
            "Custom infills for existing pergola",
            "- Included: Custom-made acrylic infills, supplied and installed",
            "- Frame finish: Matt black",
            "- Side wall: 2.4m × 1.2m; quantity 2",
            "- Scope boundary: Existing pergola structure excluded",
          ].join("\n"),
          230000,
        ),
        lineItem(
          "line-6",
          [
            "Additional aluminium — supply only",
            "- Frame finish: Matt black",
            "- 2 × 6m lengths: 100 × 100 post",
            "- Scope boundary: Materials supplied; installation excluded",
          ].join("\n"),
          86250,
        ),
        lineItem(
          "line-7",
          [
            "Project delivery and site setup",
            "- Installation setup for this project",
            "- Travel to and from the project site",
          ].join("\n"),
          115000,
        ),
      ],
      totals: {
        totalIncGstCents: 2023300,
        totalExGstCents: 1759391,
        gstCents: 263909,
      },
    }),
  },
];

describe("quote artifact visual fixtures", () => {
  it("renders deterministic PDF and email scenarios without persistence", async () => {
    const outputDir = process.env.QUOTE_ARTIFACT_OUTPUT_DIR?.trim();
    if (outputDir) await mkdir(outputDir, { recursive: true });

    for (const entry of visualFixtures) {
      const bytes = await generateQuotePdfBytes(entry.quote);
      expect(bytes.byteLength).toBeGreaterThan(10_000);
      if (outputDir) {
        await writeFile(
          path.join(outputDir, `${entry.name}.pdf`),
          Buffer.from(bytes),
        );
      }
    }

    const emailQuote = visualFixtures.at(-1)!.quote;
    const base = buildQuotePreviewBasePayload({
      detail: emailQuote,
      quoteAcceptUrl:
        "https://preview.invalid/quote/standard?token=visual-fixture",
      expiresAtLabel: "31 Jul 2026",
      logoUrl: "http://127.0.0.1:3000/images/email-logo.png",
    });
    const email = await renderQuotePreviewFromBasePayload(base, {
      to: ["taylor@example.com"],
      subject: "Your Sanctuary quote",
      personalNote:
        "Thanks for meeting with us. Please reply if you would like to discuss any part of the scope.",
      attachmentNames: ["Planning set.pdf"],
    });

    expect(email.html).toContain("Review and accept quote");
    expect(email.html).toContain("$20,233.00");
    expect(email.text).toContain("$20,233.00");
    expect(email.text).toContain("token=visual-fixture");
    if (outputDir) {
      await writeFile(
        path.join(outputDir, "08-email.html"),
        email.html,
        "utf8",
      );
      await writeFile(
        path.join(outputDir, "08-email.txt"),
        email.text ?? "",
        "utf8",
      );
    }
  }, 15_000);
});
