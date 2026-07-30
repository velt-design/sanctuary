import { readFile } from "node:fs/promises";
import { expect, type Locator, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import {
  DESIGN_BOOKLET_PRESENTATION,
  designBookletCssBaselineOffset,
} from "../apps/portal/lib/designBooklets/presentation";

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

test.describe("design booklet workbench fixture", () => {
  test("composes mixed pages and downloads the matching dynamic PDF", async ({
    page,
  }, testInfo) => {
    const unexpectedRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
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
    await expect(
      page.getByRole("heading", {
        name: "Build the booklet around the design.",
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Roof form")).toHaveValue("pitched");
    await expect(page.getByLabel("Roofing choice")).toHaveValue("combination");
    await expect(railButtons).toHaveCount(5);
    await expect(railButtons.first()).toContainText("Cover");
    await expect(railButtons.last()).toContainText("Review");

    await page.getByRole("button", { name: "Add image page" }).click();
    await expect(railButtons).toHaveCount(6);
    await expect(page.locator('[data-page-kind="image"]')).toBeVisible();

    await page.getByRole("button", { name: "Add drawing page" }).click();
    await expect(railButtons).toHaveCount(7);
    await expect(page.locator('[data-page-kind="drawings"]')).toBeVisible();

    await page
      .getByRole("button", {
        name: /^One large \+ two small/,
      })
      .click();
    const firstDrawingEditor = page.locator('[data-drawing-editor-slot="1"]');
    await firstDrawingEditor.getByLabel("Drawing title").selectOption("custom");
    await firstDrawingEditor
      .getByRole("textbox", { name: "Custom title" })
      .fill("Roof section");
    await expect(
      page.locator(
        '[data-page-kind="drawings"] [data-drawing-slot="1"] figcaption',
      ),
    ).toHaveText("Roof section");
    await expect(
      page.locator('[data-page-kind="drawings"] [data-drawing-slot]'),
    ).toHaveCount(3);

    const addedDrawingCard = page.locator(
      '[data-composer-page="drawing-page-2"]',
    );
    await addedDrawingCard
      .getByRole("button", { name: "Move Drawings 2 earlier" })
      .click();
    await expect(railButtons.nth(4)).toContainText("Drawings 2");

    await page
      .locator('[data-composer-page="image-page-2"]')
      .getByRole("button", { name: /^Remove / })
      .click();
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
      expect(pdfPage.getWidth()).toBeCloseTo(841.89, 1);
      expect(pdfPage.getHeight()).toBeCloseTo(595.28, 1);
    }
    expect(unexpectedRequests).toEqual([]);
  });

  test("keeps the complete A4 preview inside common desktop viewports", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(FIXTURE_PATH);

      const bookletPage = page.locator('[data-page-kind="cover"]');
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
        };
      });
      expect(layout.documentWidth).toBeLessThanOrEqual(viewport.width + 1);
      expect(layout.documentHeight).toBeLessThanOrEqual(viewport.height + 1);
      expect(layout.railOverflow).toBe(true);
      expect(layout.previewOverflow).toBe(false);
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

    await page
      .locator('[data-composer-page="drawing-page-1"]')
      .getByRole("button")
      .first()
      .click();
    await page.getByRole("button", { name: /^Four-drawing grid/ }).click();
    await expect(
      page.locator('[data-page-kind="drawings"] [data-drawing-slot]'),
    ).toHaveCount(4);

    const hasHorizontalDocumentOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasHorizontalDocumentOverflow).toBe(false);
  });

  test("uses the shared PDF point geometry and matching font baselines in the browser preview", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(FIXTURE_PATH);

    const pageRail = page.getByRole("navigation", {
      name: "Booklet pages",
    });
    await pageRail
      .getByRole("button", { name: "04 Drawings 1", exact: true })
      .click();

    const drawingPage = page.locator('[data-page-kind="drawings"]');
    await expect(drawingPage).toBeVisible();
    await expectPointRect(
      drawingPage,
      drawingPage.getByRole("main"),
      presentation.drawing.area,
    );

    await pageRail
      .getByRole("button", { name: "05 Review", exact: true })
      .click();
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
