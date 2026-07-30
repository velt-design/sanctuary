import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const FIXTURE_PATH = "/qa/design-booklet-workbench-fixture";

test.describe("design booklet workbench fixture", () => {
  test("previews every A4 page, reorders renders, and downloads the PDF", async ({
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
    await expect(workbench).toBeVisible();
    await expect(
      page.locator("[data-portal-sidebar-mode], [data-portal-mobile-top-bar]"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Build the booklet as a customer journey.",
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Roof form")).toHaveValue("pitched");
    await expect(page.getByLabel("Roofing choice")).toHaveValue("combination");

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

    for (let pageNumber = 1; pageNumber <= 6; pageNumber += 1) {
      await page
        .getByRole("navigation", { name: "Booklet pages" })
        .getByRole("button")
        .nth(pageNumber - 1)
        .click();
      const bookletPage = page.locator(`[data-booklet-page="${pageNumber}"]`);
      await expect(bookletPage).toBeVisible();
      const bounds = await bookletPage.boundingBox();
      expect(bounds).not.toBeNull();
      expect((bounds?.width ?? 0) / (bounds?.height ?? 1)).toBeCloseTo(
        297 / 210,
        2,
      );
      await bookletPage.screenshot({
        path: testInfo.outputPath(`booklet-page-${pageNumber}.png`),
      });
    }

    await page
      .locator('[data-render-slot="render-1"]')
      .getByRole("button", { name: "Make cover" })
      .click();
    await expect(page.locator('[data-render-slot="render-1"]')).toHaveAttribute(
      "data-cover-image",
      "true",
    );
    await expect(page.locator('[data-booklet-page="1"] img')).toHaveAttribute(
      "src",
      /booklet-toni-01\.png/,
    );

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("toni-design-booklet.pdf");
    const downloadPath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const bytes = await readFile(downloadPath);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(6);
    for (const pdfPage of pdf.getPages()) {
      expect(pdfPage.getWidth()).toBeCloseTo(841.89, 1);
      expect(pdfPage.getHeight()).toBeCloseTo(595.28, 1);
    }
    expect(unexpectedRequests).toEqual([]);
  });

  test("keeps controls and the scaled A4 preview usable on a narrow screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FIXTURE_PATH);

    await expect(page.getByLabel("Booklet controls")).toBeVisible();
    await expect(page.getByLabel("Landscape A4 booklet preview")).toBeVisible();
    await page
      .getByRole("navigation", { name: "Booklet pages" })
      .getByRole("button", { name: /Plan/ })
      .click();
    await expect(page.locator('[data-booklet-page="4"]')).toBeVisible();

    const hasHorizontalDocumentOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasHorizontalDocumentOverflow).toBe(false);
  });
});
