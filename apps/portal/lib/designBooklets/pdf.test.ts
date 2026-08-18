// @vitest-environment node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  createProjectDesignBookletDraft,
  createToniDesignBookletDraft,
  TONI_DESIGN_BOOKLET_ASSETS,
} from "./defaults";
import { getDesignBookletContentCatalog } from "./marketingContent";
import {
  createDesignBookletDrawingPage,
  createDesignBookletImagePage,
} from "./pageModel";
import {
  DESIGN_BOOKLET_PDF_PAGE_SIZE,
  designBookletPdfFilename,
  generateDesignBookletPdf,
} from "./pdf";
import { loadToniDesignBookletImages } from "./request";
import {
  DESIGN_BOOKLET_CONTENT_LAYOUT_IDS,
  DESIGN_BOOKLET_CONTENT_VARIANT_IDS,
  type DesignBookletDraft,
  type DesignBookletDrawingLayoutId,
} from "./types";

async function generateToniPdf(draft: DesignBookletDraft) {
  return generateDesignBookletPdf({
    draft,
    content: getDesignBookletContentCatalog(),
    images: await loadToniDesignBookletImages(draft),
  });
}

async function extractPdfPageText(bytes: Uint8Array): Promise<string[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: bytes.slice() });
  const document = await task.promise;
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      );
    }
  } finally {
    await document.destroy();
  }

  return pages;
}

function expectLandscapeA4Pages(document: PDFDocument) {
  for (const page of document.getPages()) {
    expect(page.getWidth()).toBeCloseTo(DESIGN_BOOKLET_PDF_PAGE_SIZE.width, 1);
    expect(page.getHeight()).toBeCloseTo(
      DESIGN_BOOKLET_PDF_PAGE_SIZE.height,
      1,
    );
  }
}

describe("design booklet PDF", () => {
  it("renders neutral placeholders when a new project has no images", async () => {
    const draft = createProjectDesignBookletDraft("Client AAA");
    const bytes = await generateDesignBookletPdf({
      draft,
      content: getDesignBookletContentCatalog(),
      images: {},
    });
    const document = await PDFDocument.load(bytes);

    expect(document.getPageCount()).toBe(5);
    expectLandscapeA4Pages(document);

    const outputDirectory = process.env.DESIGN_BOOKLET_OUTPUT_DIR?.trim();
    if (outputDirectory) {
      const absoluteDirectory = path.resolve(outputDirectory);
      await mkdir(absoluteDirectory, { recursive: true });
      await writeFile(
        path.join(
          absoluteDirectory,
          designBookletPdfFilename(draft.customerName),
        ),
        bytes,
      );
    }
  });

  it("renders the default Toni booklet as five numbered landscape A4 pages", async () => {
    const draft = createToniDesignBookletDraft();
    const bytes = await generateToniPdf(draft);
    const document = await PDFDocument.load(bytes);
    const pageText = await extractPdfPageText(bytes);

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(document.getPageCount()).toBe(5);
    expect(document.getTitle()).toContain("Toni");
    expectLandscapeA4Pages(document);
    expect(pageText[0]).toContain("Outdoor living concept");
    expect(pageText[0]).toContain("Pitched pergola");
    expect(pageText[0]).toContain("Combination roofing");
    expect(pageText[0]).toContain("01 / 05");
    expect(pageText[3]).toContain("0 1 / PLAN");
    expect(pageText[3]).toContain("PROPOSED ROOF PLAN");
    expect(pageText[3]).toContain("A-01");
    expect(pageText[3]).toContain("CONCEPT DESIGN - NOT FOR CONSTRUCTION");
    expect(pageText[3]).toContain("Pitched pergola");
    expect(pageText[3]).toContain("Combination roofing");
    expect(pageText[4]).toContain("Review the concept");
    expect(pageText[4]).toContain("Discuss this concept with Sanctuary");
    expect(pageText[4]).toContain("05 / 05");

    const outputDirectory = process.env.DESIGN_BOOKLET_OUTPUT_DIR?.trim();
    if (outputDirectory) {
      const absoluteDirectory = path.resolve(outputDirectory);
      await mkdir(absoluteDirectory, { recursive: true });
      await writeFile(
        path.join(
          absoluteDirectory,
          designBookletPdfFilename(draft.customerName),
        ),
        bytes,
      );
    }
  }, 30_000);

  it("renders the fixed cover and review as a two-page minimum", async () => {
    const draft = createToniDesignBookletDraft();
    draft.contentPages = [];

    const bytes = await generateToniPdf(draft);
    const document = await PDFDocument.load(bytes);
    const pageText = await extractPdfPageText(bytes);

    expect(document.getPageCount()).toBe(2);
    expectLandscapeA4Pages(document);
    expect(pageText[0]).toContain("01 / 02");
    expect(pageText[1]).toContain("Review the concept");
    expect(pageText[1]).toContain("02 / 02");
  }, 30_000);

  it("renders all 30 curated layout and framing combinations from the shared page contract", async () => {
    const draft = createToniDesignBookletDraft();
    draft.contentPages = [];
    const combinations = DESIGN_BOOKLET_CONTENT_LAYOUT_IDS.flatMap((layout) =>
      DESIGN_BOOKLET_CONTENT_VARIANT_IDS.map((variant) => ({
        layout,
        variant,
      })),
    );
    for (const [index, { layout, variant }] of combinations.entries()) {
      const page = createDesignBookletImagePage(
        draft.contentPages,
        {
          id: (["render-1", "render-2", "render-3"] as const)[index % 3],
          alt: `Content layout ${index + 1}`,
        },
        layout,
      );
      page.variant = variant;
      const demonstrateLargeType =
        variant === "gallery" && layout === "information-text";
      page.content = {
        ...page.content,
        eyebrow: "Design direction",
        headline: demonstrateLargeType
          ? "FORM"
          : `Content template ${index + 1}`,
        headlineScale: demonstrateLargeType ? 400 : 100,
        body: "Editable customer copy remains attached to the page while the selected template changes.",
        sections: [
          { heading: "Acrylic roof", body: "First material section." },
          {
            heading: "COLORSTEEL roof + timber ceiling",
            body: "Second material section.",
          },
        ],
      };
      page.images.forEach((image, imageIndex) => {
        image.caption = `View ${imageIndex + 1}`;
      });
      draft.contentPages.push(page);
    }

    const bytes = await generateToniPdf(draft);
    const document = await PDFDocument.load(bytes);
    const pageText = await extractPdfPageText(bytes);
    expect(document.getPageCount()).toBe(combinations.length + 2);
    expectLandscapeA4Pages(document);
    combinations.forEach(({ layout, variant }, index) => {
      if (layout.includes("story") || layout.includes("information")) {
        expect(pageText[index + 1]).toContain(
          variant === "gallery" && layout === "information-text"
            ? "FORM"
            : `Content template ${index + 1}`,
        );
      }
      expect(pageText[index + 1]).toContain("VIEW 1");
    });
    expect(pageText.at(-1)).toContain("Review the concept");

    const outputDirectory = process.env.DESIGN_BOOKLET_OUTPUT_DIR?.trim();
    if (outputDirectory) {
      const absoluteDirectory = path.resolve(outputDirectory);
      await mkdir(absoluteDirectory, { recursive: true });
      await writeFile(
        path.join(absoluteDirectory, "toni-content-variants.pdf"),
        bytes,
      );
    }
  }, 30_000);

  it("renders mixed drawing layouts and custom drawing titles in page order", async () => {
    const draft = createToniDesignBookletDraft();
    const layouts: DesignBookletDrawingLayoutId[] = [
      "one-large",
      "two-equal",
      "large-plus-two",
      "four-grid",
    ];
    draft.contentPages = [];
    for (const [index, layout] of layouts.entries()) {
      const page = createDesignBookletDrawingPage(draft.contentPages, {
        id: "plan",
        alt: TONI_DESIGN_BOOKLET_ASSETS.plan.alt,
      });
      page.layout = layout;
      page.pageTitle = `Architectural sheet ${index + 1}`;
      page.revision = String(index + 1).padStart(2, "0");
      page.issueDate = "2026-08-04";
      page.drawings[0].title = {
        kind: "custom",
        value: `Custom ${layout} detail`,
      };
      draft.contentPages.push(page);
    }

    const bytes = await generateToniPdf(draft);
    const document = await PDFDocument.load(bytes);
    const pageText = await extractPdfPageText(bytes);

    expect(document.getPageCount()).toBe(6);
    expectLandscapeA4Pages(document);
    layouts.forEach((layout, index) => {
      expect(pageText[index + 1]).toContain(
        `CUSTOM ${layout.toUpperCase()} DETAIL`,
      );
      expect(pageText[index + 1]).toContain(`ARCHITECTURAL SHEET ${index + 1}`);
      expect(pageText[index + 1]).toContain(
        `A-${String(index + 1).padStart(2, "0")}`,
      );
      expect(pageText[index + 1]).toContain("04 AUG 2026");
    });
    expect(pageText[4]).toContain("SECTION");
    expect(pageText[4]).toContain("ELEVATION");
    expect(pageText[4]).toContain("ISOMETRIC");
    expect(pageText[5]).toContain("06 / 06");

    const outputDirectory = process.env.DESIGN_BOOKLET_OUTPUT_DIR?.trim();
    if (outputDirectory) {
      const absoluteDirectory = path.resolve(outputDirectory);
      await mkdir(absoluteDirectory, { recursive: true });
      await writeFile(
        path.join(absoluteDirectory, "toni-drawing-layouts.pdf"),
        bytes,
      );
    }
  }, 30_000);

  it("uses a filesystem-safe customer filename", () => {
    expect(designBookletPdfFilename(" Toni & Family ")).toBe(
      "toni-family-design-booklet.pdf",
    );
  });

  it("embeds the selected original PDF page as vector content", async () => {
    const source = await PDFDocument.create();
    const sourceFont = await source.embedFont(StandardFonts.Helvetica);
    for (const label of ["SOURCE PAGE ONE", "SOURCE PAGE TWO"]) {
      const page = source.addPage([842, 595]);
      page.drawRectangle({
        x: 40,
        y: 40,
        width: 762,
        height: 515,
        borderColor: rgb(0.15, 0.2, 0.15),
        borderWidth: 2,
      });
      page.drawText(label, {
        x: 100,
        y: 300,
        size: 42,
        font: sourceFont,
      });
    }
    const sourceBytes = await source.save({ useObjectStreams: false });
    const draft = createToniDesignBookletDraft();
    const drawingPage = draft.contentPages.find(
      (page) => page.kind === "drawings",
    );
    if (!drawingPage || drawingPage.kind !== "drawings") {
      throw new Error("Expected the Toni drawing page.");
    }
    drawingPage.drawings[0].pdf = {
      assetId: "drawing-page-1-drawing-1-pdf",
      fileName: "architectural-package.pdf",
      pageNumber: 2,
      pageCount: 2,
    };

    const bytes = await generateDesignBookletPdf({
      draft,
      content: getDesignBookletContentCatalog(),
      images: await loadToniDesignBookletImages(draft),
      documents: {
        "drawing-page-1-drawing-1-pdf": { bytes: sourceBytes },
      },
    });
    const outputDirectory = process.env.DESIGN_BOOKLET_OUTPUT_DIR?.trim();
    if (outputDirectory) {
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(
        path.join(outputDirectory, "pdf-source-drawing-booklet.pdf"),
        bytes,
      );
    }
    const pageText = await extractPdfPageText(bytes);

    expect(pageText[3]).toContain("SOURCE PAGE TWO");
    expect(pageText[3]).not.toContain("SOURCE PAGE ONE");
    expect(pageText[3]).toContain("PROPOSED ROOF PLAN");
  }, 30_000);

  it("signals when valid long text is shortened to fit a page frame", async () => {
    const draft = createToniDesignBookletDraft();
    draft.projectTitle = "A".repeat(120);
    const drawingPage = draft.contentPages.find(
      (page) => page.kind === "drawings",
    );
    if (!drawingPage || drawingPage.kind !== "drawings") {
      throw new Error("Expected the Toni drawing page.");
    }
    drawingPage.layout = "large-plus-two";
    drawingPage.drawings[1].title = {
      kind: "custom",
      value: "W".repeat(80),
    };

    const bytes = await generateToniPdf(draft);
    const pageText = await extractPdfPageText(bytes);

    expect(pageText[0]).toContain("...");
    expect(pageText[3]).toContain("...");
  }, 30_000);
});
