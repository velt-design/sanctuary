import { expect, test, type Page } from "@playwright/test";
import {
  attachPortalBrowserEvidence,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from "./support/portalBrowserEvidence";

const viewports = [
  { id: "desktop", width: 1280, height: 900 },
  { id: "mobile", width: 390, height: 844 },
] as const;

const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();

test.describe.configure({ mode: "serial" });

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (!evidence) return;
  await attachPortalBrowserEvidence(testInfo, page, evidence, {
    routeId: "invoice-artifact-preview-fixture",
    label: testInfo.title,
  });
});

test("invoice artifacts remain truthful, read-only and responsive", async ({
  page,
}, testInfo) => {
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/qa/invoice-artifact-preview-fixture");

    const fixture = page
      .locator('[data-portal-qa-fixture="invoice-artifact-preview"]')
      .first();
    await expect(fixture).toBeVisible();
    await fixture.getByRole("button", { name: "Preview invoice" }).click();

    const dialog = page.getByRole("dialog", {
      name: "Preview invoice INV-2026-0147",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Deposit invoice - INV-2026-0147"),
    ).toBeVisible();
    await expect(dialog.getByText("customer@example.invalid")).toBeVisible();
    await expect(
      dialog.getByText(
        "This uses the delivery renderer with an inert customer link.",
        { exact: false },
      ),
    ).toBeVisible();

    const pdfFrame = dialog.getByTitle("Invoice INV-2026-0147 PDF preview");
    await expect(pdfFrame).toHaveAttribute(
      "src",
      "/api/qa/invoice-artifact-preview/pdf",
    );
    await testInfo.attach(`invoice-preview-${viewport.id}-pdf.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });

    await dialog.getByRole("button", { name: "Email desktop" }).click();
    const desktopEmail = dialog.getByTitle(
      "Invoice INV-2026-0147 desktop email preview",
    );
    await expect(desktopEmail).toBeVisible();
    await expect(desktopEmail).toHaveAttribute(
      "srcdoc",
      /preview\.invalid\/invoice\/fixture/,
    );
    await expect(
      page
        .frameLocator(
          'iframe[title="Invoice INV-2026-0147 desktop email preview"]',
        )
        .locator(".email-title"),
    ).toBeVisible();
    await testInfo.attach(`invoice-preview-${viewport.id}-email.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });

    await dialog.getByRole("button", { name: "Email narrow" }).click();
    await expect(
      dialog.getByTitle("Invoice INV-2026-0147 narrow email preview"),
    ).toBeVisible();
    await expect(
      page
        .frameLocator(
          'iframe[title="Invoice INV-2026-0147 narrow email preview"]',
        )
        .locator(".email-title"),
    ).toBeVisible();
    await testInfo.attach(`invoice-preview-${viewport.id}-email-narrow.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });

    await dialog.getByRole("button", { name: "Plain text" }).click();
    await expect(
      dialog.getByText(
        "https://preview.invalid/invoice/fixture?token=preview-only",
        { exact: false },
      ),
    ).toBeVisible();

    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

    if (viewport.id === "mobile") {
      const undersized = await dialog
        .getByRole("button")
        .evaluateAll((buttons) =>
          buttons
            .map((button) => ({
              label: button.textContent?.trim(),
              height: button.getBoundingClientRect().height,
              width: button.getBoundingClientRect().width,
            }))
            .filter((button) => button.height < 44 || button.width < 44),
        );
      expect(undersized).toEqual([]);
    }

    await testInfo.attach(`invoice-preview-${viewport.id}-plain-text.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/qa/invoice-artifact-preview-fixture");
  const trigger = page
    .locator('[data-portal-qa-fixture="invoice-artifact-preview"]')
    .first()
    .getByRole("button", { name: "Preview invoice" });
  await trigger.focus();
  await trigger.click();
  await expect(
    page.getByRole("dialog", {
      name: "Preview invoice INV-2026-0147",
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  expect(evidence.consoleMessages).toEqual([]);
  expect(
    evidence.failedRequests.filter(
      (request) => request.failureText !== "net::ERR_ABORTED",
    ),
  ).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});
