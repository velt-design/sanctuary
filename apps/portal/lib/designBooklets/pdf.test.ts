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
import { DESIGN_BOOKLET_PAPER_SIZES } from "./paperGeometry";
import { DESIGN_BOOKLET_BULLET_GEOMETRY } from "./editorialText";
import {
  DESIGN_BOOKLET_CONTENT_LAYOUT_IDS,
  DESIGN_BOOKLET_CONTENT_VARIANT_IDS,
  type DesignBookletDraft,
  type DesignBookletDrawingLayoutId,
  type DesignBookletPaperSizeId,
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

async function extractPdfPageTextPositions(
  bytes: Uint8Array,
  pageNumber: number,
) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: bytes.slice() });
  const document = await task.promise;
  try {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items.flatMap((item) =>
      "str" in item
        ? [{ text: item.str, x: item.transform[4], y: item.transform[5] }]
        : [],
    );
  } finally {
    await document.destroy();
  }
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

function expectExactPaperSizePages(
  document: PDFDocument,
  paperSize: DesignBookletPaperSizeId,
) {
  const expected = DESIGN_BOOKLET_PAPER_SIZES[paperSize];
  for (const page of document.getPages()) {
    expect(page.getWidth()).toBe(expected.width);
    expect(page.getHeight()).toBe(expected.height);
  }
}

function representativeDraft(paperSize: DesignBookletPaperSizeId) {
  const draft = createToniDesignBookletDraft();
  draft.paperSize = paperSize;
  draft.contentPages = [];
  for (const [index, layout] of [
    "visual-framed",
    "story-image-left",
    "gallery-grid-four",
    "information-text",
  ].entries()) {
    const page = createDesignBookletImagePage(
      draft.contentPages,
      { id: "render-1", alt: `Representative image ${index + 1}` },
      layout as (typeof DESIGN_BOOKLET_CONTENT_LAYOUT_IDS)[number],
    );
    page.content.headline = `Representative ${layout}`;
    page.content.body =
      "Shared booklet geometry preserves this page content.\n- Clear customer priorities\n- Consistent printed detail";
    page.images.forEach((image, imageIndex) => {
      image.caption = `View ${imageIndex + 1}`;
    });
    draft.contentPages.push(page);
  }
  draft.contentPages.push(
    createDesignBookletDrawingPage(draft.contentPages, {
      id: "plan",
      alt: TONI_DESIGN_BOOKLET_ASSETS.plan.alt,
    }),
  );
  return draft;
}

describe("design booklet PDF", () => {
  it.each(["a4", "a3"] as const)(
    "renders representative %s Cover, Visual, Story, Gallery, Information, Drawing and Review pages at exact dimensions",
    async (paperSize) => {
      const draft = representativeDraft(paperSize);
      const bytes = await generateToniPdf(draft);
      const document = await PDFDocument.load(bytes);
      const pageText = await extractPdfPageText(bytes);

      expect(document.getPageCount()).toBe(7);
      expectExactPaperSizePages(document, paperSize);
      expect(pageText[0]).toContain("Outdoor living concept");
      expect(pageText[2]).toContain("Representative story-image-left");
      expect(pageText[3]).toContain("VIEW 4");
      expect(pageText[4]).toContain("Representative information-text");
      expect(pageText[5]).toContain("CONCEPT DRAWINGS");
      expect(pageText[6]).toContain("Review the concept");

      const outputDirectory = process.env.DESIGN_BOOKLET_OUTPUT_DIR?.trim();
      if (outputDirectory) {
        const absoluteDirectory = path.resolve(outputDirectory);
        await mkdir(absoluteDirectory, { recursive: true });
        await writeFile(
          path.join(
            absoluteDirectory,
            `sanctuary-design-booklet-${paperSize}.pdf`,
          ),
          bytes,
        );
      }
    },
    60_000,
  );

  it.each(["a4", "a3"] as const)(
    "renders %s bullet copy with the shared scaled hanging indent",
    async (paperSize) => {
      const draft = representativeDraft(paperSize);
      const storyPage = draft.contentPages.find(
        (page) => page.kind === "image" && page.layout === "story-image-left",
      );
      if (!storyPage || storyPage.kind !== "image") {
        throw new Error("Expected a representative story page.");
      }
      storyPage.content.body =
        "A short introduction\n- Shade through summer\n- Shelter in winter";
      const informationPage = draft.contentPages.find(
        (page) => page.kind === "image" && page.layout === "information-text",
      );
      if (!informationPage || informationPage.kind !== "image") {
        throw new Error("Expected a representative information page.");
      }
      informationPage.layout = "information-material-split";
      informationPage.content.sections[0].body =
        "- Hardwood lining\n- Warm natural finish";

      const bytes = await generateToniPdf(draft);
      const positions = await extractPdfPageTextPositions(bytes, 3);
      const sectionPositions = await extractPdfPageTextPositions(bytes, 5);
      const marker = positions.find((item) => item.text.includes("\u2022"));
      const firstItem = positions.find((item) =>
        item.text.includes("Shade through summer"),
      );
      const scale =
        DESIGN_BOOKLET_PAPER_SIZES[paperSize].width /
        DESIGN_BOOKLET_PDF_PAGE_SIZE.width;

      expect(marker).toBeDefined();
      expect(firstItem).toBeDefined();
      expect((firstItem?.x ?? 0) - (marker?.x ?? 0)).toBeCloseTo(
        DESIGN_BOOKLET_BULLET_GEOMETRY.textInset * scale,
        1,
      );
      expect(firstItem?.y).toBeCloseTo(marker?.y ?? 0, 1);
      const sectionMarker = sectionPositions.find((item) =>
        item.text.includes("\u2022"),
      );
      const sectionItem = sectionPositions.find((item) =>
        item.text.includes("Hardwood lining"),
      );
      expect(sectionMarker).toBeDefined();
      expect((sectionItem?.x ?? 0) - (sectionMarker?.x ?? 0)).toBeCloseTo(
        DESIGN_BOOKLET_BULLET_GEOMETRY.textInset * scale,
        1,
      );
    },
    60_000,
  );

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

  it("prints intentional booklet-title line breaks as separate cover lines", async () => {
    const draft = createToniDesignBookletDraft();
    draft.projectTitle = "Outdoor living\nconcept";
    const bytes = await generateToniPdf(draft);
    const outputDirectory = process.env.DESIGN_BOOKLET_OUTPUT_DIR?.trim();
    if (outputDirectory) {
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(
        path.join(outputDirectory, "toni-multiline-title-booklet.pdf"),
        bytes,
      );
    }
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({ data: bytes.slice() });
    const document = await task.promise;

    try {
      const cover = await document.getPage(1);
      const content = await cover.getTextContent();
      const firstLine = content.items.find(
        (item) => "str" in item && item.str === "Outdoor living",
      );
      const secondLine = content.items.find(
        (item) => "str" in item && item.str === "concept",
      );
      if (
        !firstLine ||
        !("str" in firstLine) ||
        !secondLine ||
        !("str" in secondLine)
      ) {
        throw new Error("Expected both explicit cover-title lines in the PDF.");
      }
      expect(firstLine.transform[5]).toBeGreaterThan(secondLine.transform[5]);
    } finally {
      await document.destroy();
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
  }, 60_000);

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
