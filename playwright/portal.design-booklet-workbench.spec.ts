import { readFile } from "node:fs/promises";
import { expect, type Locator, test } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  DESIGN_BOOKLET_PRESENTATION,
  designBookletCssBaselineOffset,
} from "../apps/portal/lib/designBooklets/presentation";
import { DESIGN_BOOKLET_PAPER_SIZES } from "../apps/portal/lib/designBooklets/paperGeometry";

const FIXTURE_PATH = "/qa/design-booklet-workbench-fixture";
const presentation = DESIGN_BOOKLET_PRESENTATION;

async function expectPointRect(
  pageLocator: Locator,
  childLocator: Locator,
  expected: { x: number; top: number; width: number; height: number },
) {
  const pageBounds = await pageLocator.boundingBox();
  const childBounds = await childLocator.boundingBox();
  expect(pageBounds).not.toBeNull();
  expect(childBounds).not.toBeNull();
  if (!pageBounds || !childBounds) return;

  const pointScale = pageBounds.width / presentation.page.width;
  expect((childBounds.x - pageBounds.x) / pointScale).toBeCloseTo(
    expected.x,
    1,
  );
  expect((childBounds.y - pageBounds.y) / pointScale).toBeCloseTo(
    expected.top,
    1,
  );
  expect(childBounds.width / pointScale).toBeCloseTo(expected.width, 1);
  expect(childBounds.height / pointScale).toBeCloseTo(expected.height, 1);
}

async function extractPageText(bytes: Uint8Array, pageNumber: number) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: bytes.slice() });
  const document = await task.promise;
  try {
    const pdfPage = await document.getPage(pageNumber);
    const content = await pdfPage.getTextContent();
    return content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } finally {
    await document.destroy();
  }
}

test.describe("design booklet workbench fixture", () => {
  test("composes mixed pages and downloads the matching dynamic PDF", async ({
    page,
  }, testInfo) => {
    const unexpectedRequests: string[] = [];
    let pdfRequestCount = 0;
    page.on("request", (request) => {
      const url = request.url();
      if (/\/api\/qa\/design-booklet-workbench\/pdf/.test(url)) {
        pdfRequestCount += 1;
      }
      if (
        /\/(?:auth|rest|storage)\/v1\//i.test(new URL(url).pathname) ||
        /\/api\/staff\/v1\/(?:projects|tasks|work-items|quotes|estimates)/.test(
          url,
        )
      ) {
        unexpectedRequests.push(url);
      }
    });

    await page.goto(FIXTURE_PATH);
    const workbench = page.locator("[data-design-booklet-workbench]");
    const pageRail = page.getByRole("navigation", {
      name: "Booklet pages",
    });
    const railButtons = pageRail.locator("[data-booklet-page-select]");

    await expect(workbench).toBeVisible();
    await expect(
      page.locator("[data-portal-sidebar-mode], [data-portal-mobile-top-bar]"),
    ).toHaveCount(0);
    const details = page.locator("#booklet-details");
    await expect(details).not.toHaveAttribute("open", "");
    await expect(
      details.locator("summary").getByText("Outdoor living concept"),
    ).toBeVisible();
    await details.locator("summary").click();
    await expect(page.getByLabel("Roof form")).toHaveValue("pitched");
    await expect(page.getByLabel("Roofing choice")).toHaveValue("combination");
    await expect(page.getByLabel("Paper size")).toHaveValue("a4");
    await page.getByLabel("Paper size").selectOption("a3");
    await expect(
      page.getByRole("region", { name: "Landscape A3 booklet preview" }),
    ).toHaveAttribute("data-paper-size", "a3");
    await expect(
      details.locator("summary").getByText("Outdoor living concept"),
    ).toBeVisible();
    await details.locator("summary").click();
    await expect(railButtons).toHaveCount(5);
    await expect(railButtons.first()).toContainText("Cover");
    await expect(railButtons.last()).toContainText("Review");

    await page.getByRole("button", { name: "Add page" }).click();
    await page.getByRole("button", { name: /^Visual/ }).click();
    await expect(railButtons).toHaveCount(6);
    await expect(page.locator('[data-page-kind="image"]')).toBeVisible();

    await page.getByRole("button", { name: "Add page" }).click();
    await page.getByRole("button", { name: /^Drawing page/ }).click();
    await expect(railButtons).toHaveCount(7);
    await expect(page.locator('[data-page-kind="drawings"]')).toBeVisible();

    await page
      .getByRole("button", {
        name: /^One large \+ two small/,
      })
      .click();
    await page
      .getByRole("textbox", { name: "Sheet title" })
      .fill("Roof package");
    const firstDrawingEditor = page.locator('[data-drawing-editor-slot="1"]');
    await firstDrawingEditor.getByLabel("Drawing title").selectOption("custom");
    await firstDrawingEditor
      .getByRole("textbox", { name: "Custom title" })
      .fill("Roof section");
    const drawingPreview = page.locator('[data-page-kind="drawings"]');
    await expect(drawingPreview).toHaveAttribute(
      "data-drawing-preview",
      "instant-html",
    );
    await expect(drawingPreview.locator("canvas")).toHaveCount(0);
    await expect(drawingPreview.locator("figcaption")).toHaveCount(3);
    await expect(drawingPreview.locator("footer")).toHaveCount(1);
    expect(pdfRequestCount).toBe(0);
    await expect(page.locator("[data-drawing-editor-slot]")).toHaveCount(3);

    const addedDrawingCard = page.locator(
      '[data-composer-page="drawing-page-2"]',
    );
    await addedDrawingCard
      .getByRole("button", { name: "Move ROOF PACKAGE earlier" })
      .click();
    await expect(railButtons.nth(4)).toContainText("ROOF PACKAGE");

    const removedImageCard = page.locator(
      '[data-composer-page="image-page-2"]',
    );
    await removedImageCard.hover();
    await removedImageCard.getByRole("button", { name: /^Remove / }).click();
    await expect(railButtons).toHaveCount(6);
    await expect(railButtons.first()).toContainText("Cover");
    await expect(railButtons.last()).toContainText("Review");

    await expect
      .poll(async () =>
        page
          .locator("[data-design-booklet-workbench] img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);

    const finalPageCount = await railButtons.count();
    for (let pageIndex = 0; pageIndex < finalPageCount; pageIndex += 1) {
      await railButtons.nth(pageIndex).click();
      const bookletPage = page.locator(
        `[data-booklet-page="${pageIndex + 1}"]`,
      );
      await expect(bookletPage).toBeVisible();
      await expect(bookletPage).toHaveAttribute("data-paper-size", "a3");
      if ((await bookletPage.getAttribute("data-page-kind")) === "drawings") {
        await expect(bookletPage).toHaveAttribute(
          "data-drawing-preview",
          "instant-html",
        );
      }
      const bounds = await bookletPage.boundingBox();
      expect(bounds).not.toBeNull();
      expect((bounds?.width ?? 0) / (bounds?.height ?? 1)).toBeCloseTo(
        297 / 210,
        2,
      );
      await bookletPage.screenshot({
        path: testInfo.outputPath(`booklet-page-${pageIndex + 1}.png`),
      });
    }

    expect(pdfRequestCount).toBe(0);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("toni-design-booklet.pdf");
    const downloadPath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const bytes = await readFile(downloadPath);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(finalPageCount);
    for (const pdfPage of pdf.getPages()) {
      expect(pdfPage.getWidth()).toBe(DESIGN_BOOKLET_PAPER_SIZES.a3.width);
      expect(pdfPage.getHeight()).toBe(DESIGN_BOOKLET_PAPER_SIZES.a3.height);
    }
    const pageTexts = await Promise.all(
      Array.from({ length: finalPageCount }, (_, index) =>
        extractPageText(new Uint8Array(bytes), index + 1),
      ),
    );
    expect(pageTexts.some((text) => text.includes("ROOF PACKAGE"))).toBe(true);
    expect(pageTexts.some((text) => text.includes("ROOF SECTION"))).toBe(true);
    expect(pdfRequestCount).toBe(1);
    expect(unexpectedRequests).toEqual([]);
  });

  test("edits bullet copy and preserves it across A4/A3 preview and PDF output", async ({
    page,
  }, testInfo) => {
    let pdfRequestCount = 0;
    page.on("request", (request) => {
      if (/\/api\/qa\/design-booklet-workbench\/pdf/.test(request.url())) {
        pdfRequestCount += 1;
      }
    });

    await page.goto(FIXTURE_PATH);
    await page.getByRole("button", { name: "Add page" }).click();
    await page.getByRole("button", { name: /editable design intent/ }).click();
    const body = page.getByRole("textbox", { name: "Body copy" });
    await body.fill("Shade through summer\nShelter in winter");
    await body.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page
      .getByRole("button", { name: "Toggle bullets in Body copy" })
      .click();

    await expect(body).toHaveValue(
      "- Shade through summer\n- Shelter in winter",
    );
    const preview = page.locator('[data-page-kind="image"]:visible');
    await expect(preview.locator("[data-booklet-bullet-list] li")).toHaveCount(
      2,
    );
    await preview.screenshot({ path: testInfo.outputPath("bullets-a4.png") });
    expect(pdfRequestCount).toBe(0);

    await page.locator("#booklet-details > summary").click();
    await page.getByLabel("Paper size").selectOption("a3");
    await expect(body).toHaveValue(
      "- Shade through summer\n- Shelter in winter",
    );
    await expect(preview).toHaveAttribute("data-paper-size", "a3");
    await preview.screenshot({ path: testInfo.outputPath("bullets-a3.png") });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const download = await downloadPromise;
    const downloadPath = testInfo.outputPath("bullet-copy-booklet.pdf");
    await download.saveAs(downloadPath);
    const bytes = new Uint8Array(await readFile(downloadPath));
    const booklet = await PDFDocument.load(bytes);
    expect(booklet.getPages()[4].getWidth()).toBe(
      DESIGN_BOOKLET_PAPER_SIZES.a3.width,
    );
    expect(await extractPageText(bytes, 5)).toContain("Shade through summer");
    expect(pdfRequestCount).toBe(1);
  });

  test("previews a multi-page drawing PDF immediately and exports the selected source page", async ({
    page,
  }) => {
    let pdfRequestCount = 0;
    page.on("request", (request) => {
      if (/\/api\/qa\/design-booklet-workbench\/pdf/.test(request.url())) {
        pdfRequestCount += 1;
      }
    });
    const source = await PDFDocument.create();
    const font = await source.embedFont(StandardFonts.Helvetica);
    const first = source.addPage([842, 595]);
    first.drawText("SOURCE SHEET ONE", {
      x: 120,
      y: 300,
      size: 34,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    const second = source.addPage([842, 595]);
    second.drawText("SOURCE SHEET TWO", {
      x: 120,
      y: 300,
      size: 34,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    const sourceBytes = await source.save({ useObjectStreams: false });

    await page.goto(FIXTURE_PATH);
    await page.locator("#booklet-details > summary").click();
    await page.getByLabel("Paper size").selectOption("a3");
    await page.locator('[data-booklet-page-select="drawing-page-1"]').click();
    const firstDrawingEditor = page.locator('[data-drawing-editor-slot="1"]');
    await firstDrawingEditor.locator('input[type="file"]').setInputFiles({
      name: "architectural-set.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(sourceBytes),
    });

    await expect(
      firstDrawingEditor.getByText("architectural-set.pdf"),
    ).toBeVisible();
    const pageSelector = firstDrawingEditor.getByLabel("PDF page");
    await expect(pageSelector.locator("option")).toHaveCount(2);
    await pageSelector.selectOption("2");
    await expect(pageSelector).toHaveValue("2");
    await expect
      .poll(async () =>
        page
          .locator('[data-page-kind="drawings"] img')
          .first()
          .evaluate(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0,
          ),
      )
      .toBe(true);
    expect(pdfRequestCount).toBe(0);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const download = await downloadPromise;
    const downloadPath = test.info().outputPath("selected-source-page.pdf");
    await download.saveAs(downloadPath);
    const bytes = new Uint8Array(await readFile(downloadPath));
    const booklet = await PDFDocument.load(bytes);
    for (const pdfPage of booklet.getPages()) {
      expect(pdfPage.getWidth()).toBe(DESIGN_BOOKLET_PAPER_SIZES.a3.width);
      expect(pdfPage.getHeight()).toBe(DESIGN_BOOKLET_PAPER_SIZES.a3.height);
    }
    const texts = await Promise.all(
      Array.from({ length: booklet.getPageCount() }, (_, index) =>
        extractPageText(bytes, index + 1),
      ),
    );
    expect(texts.some((text) => text.includes("SOURCE SHEET TWO"))).toBe(true);
    expect(texts.some((text) => text.includes("SOURCE SHEET ONE"))).toBe(false);
    expect(pdfRequestCount).toBe(1);
  });

  test("keeps the complete A4 preview inside common desktop viewports", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1920, height: 1080, expectEditorFit: true },
      { width: 1440, height: 900, expectEditorFit: true },
      { width: 1366, height: 768, expectEditorFit: false },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(FIXTURE_PATH);

      const bookletPage = page.locator('[data-page-kind="cover"]:visible');
      await expect(bookletPage).toBeVisible();
      const bounds = await bookletPage.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect(bounds?.y ?? -1).toBeGreaterThanOrEqual(72);
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
        viewport.width,
      );
      expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(
        viewport.height,
      );
      expect((bounds?.width ?? 0) / (bounds?.height ?? 1)).toBeCloseTo(
        297 / 210,
        2,
      );

      const layout = await page.evaluate(() => {
        const rail = document.querySelector(
          'aside[aria-label="Booklet controls"]',
        );
        const preview = document.querySelector(
          'section[aria-label="Landscape A4 booklet preview"]',
        );
        const editor = document.querySelector("[data-selected-page-editor]");
        const pageNavigation = document.querySelector(
          'nav[aria-label="Booklet pages"]',
        );
        return {
          documentWidth: document.documentElement.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
          railOverflow:
            rail instanceof HTMLElement &&
            rail.scrollHeight > rail.clientHeight + 1,
          previewOverflow:
            preview instanceof HTMLElement &&
            (preview.scrollWidth > preview.clientWidth + 1 ||
              preview.scrollHeight > preview.clientHeight + 1),
          editorOverflow:
            editor instanceof HTMLElement &&
            editor.scrollHeight > editor.clientHeight + 1,
          pageNavigationOverflow:
            pageNavigation instanceof HTMLElement &&
            pageNavigation.scrollHeight > pageNavigation.clientHeight + 1,
        };
      });
      expect(layout.documentWidth).toBeLessThanOrEqual(viewport.width + 1);
      expect(layout.documentHeight).toBeLessThanOrEqual(viewport.height + 1);
      expect(layout.railOverflow).toBe(false);
      expect(layout.previewOverflow).toBe(false);
      expect(layout.pageNavigationOverflow).toBe(false);
      if (viewport.expectEditorFit) {
        expect(layout.editorOverflow).toBe(false);
      }
    }
  });

  test("keeps the composer and scaled A4 drawing preview usable on a narrow screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);

    await expect(page.getByLabel("Booklet controls")).toBeVisible();
    await expect(page.getByLabel("Landscape A4 booklet preview")).toBeVisible();
    await page
      .getByRole("navigation", { name: "Booklet pages" })
      .locator('[data-booklet-page-select="drawing-page-1"]')
      .click();
    await expect(page.locator('[data-page-kind="drawings"]')).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Sheet title" }),
    ).toHaveValue("PROPOSED ROOF PLAN");

    await page
      .locator('[data-composer-page="drawing-page-1"]')
      .getByRole("button")
      .first()
      .click();
    await page.getByRole("button", { name: /^Four-drawing grid/ }).click();
    await expect(page.locator("[data-drawing-editor-slot]")).toHaveCount(4);
    await expect(page.locator('[data-page-kind="drawings"]')).toHaveAttribute(
      "data-drawing-preview",
      "instant-html",
    );

    const hasHorizontalDocumentOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasHorizontalDocumentOverflow).toBe(false);
  });

  test("renders drawing sheets instantly from the shared A4/A3 geometry", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(FIXTURE_PATH);
    await page.locator("#booklet-details > summary").click();
    await page.getByLabel("Paper size").selectOption("a3");

    const pageRail = page.getByRole("navigation", {
      name: "Booklet pages",
    });
    await pageRail
      .locator('[data-booklet-page-select="drawing-page-1"]')
      .click();

    const drawingPage = page.locator('[data-page-kind="drawings"]');
    await expect(drawingPage).toBeVisible();
    await expect(drawingPage).toHaveAttribute("data-paper-size", "a3");
    await expect(drawingPage).toHaveAttribute(
      "data-drawing-preview",
      "instant-html",
    );
    await expect(drawingPage.locator("canvas")).toHaveCount(0);
    await expectPointRect(
      drawingPage,
      drawingPage.locator("main"),
      presentation.drawing.area,
    );
    await expectPointRect(drawingPage, drawingPage.locator("footer"), {
      x: presentation.drawing.titleBlock.x,
      top: presentation.drawing.titleBlock.top,
      width: presentation.drawing.titleBlock.width,
      height: presentation.drawing.titleBlock.height,
    });
    expect(presentation.drawing.area.top).toBeLessThanOrEqual(20);
    expect(
      presentation.drawing.area.height / presentation.page.height,
    ).toBeGreaterThan(0.74);

    await pageRail.locator('[data-booklet-page-select="review"]').click();
    const reviewPage = page.locator('[data-page-kind="review"]');
    await expect(reviewPage).toBeVisible();
    await expectPointRect(
      reviewPage,
      reviewPage.getByRole("figure"),
      presentation.review.image,
    );

    const reviewTitle = reviewPage.getByRole("heading", {
      name: "Review the concept",
      level: 2,
    });
    const pageBounds = await reviewPage.boundingBox();
    const titleBounds = await reviewTitle.boundingBox();
    expect(pageBounds).not.toBeNull();
    expect(titleBounds).not.toBeNull();
    if (!pageBounds || !titleBounds) return;

    const pointScale = pageBounds.width / presentation.page.width;
    expect((titleBounds.x - pageBounds.x) / pointScale).toBeCloseTo(
      presentation.review.copy.x,
      1,
    );
    expect((titleBounds.y - pageBounds.y) / pointScale).toBeCloseTo(
      presentation.review.title.baseline -
        designBookletCssBaselineOffset(
          presentation.review.title.size,
          presentation.review.title.lineHeight,
          "display",
        ),
      1,
    );
    expect(titleBounds.width / pointScale).toBeCloseTo(
      presentation.review.copy.width,
      1,
    );
    await expect(reviewPage).toHaveCSS("font-family", /Inter/i);
  });
});
