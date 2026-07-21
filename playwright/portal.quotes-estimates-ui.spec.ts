import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  attachPortalBrowserEvidence,
  capturePortalEvidenceScreenshot,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from './support/portalBrowserEvidence';

const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const;

const evidenceDir = path.resolve(process.cwd(), 'artifacts/ui-foundation-quotes-estimates');
fs.mkdirSync(evidenceDir, { recursive: true });

const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();

test.describe.configure({ mode: 'serial' });

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (!evidence) return;
  await attachPortalBrowserEvidence(testInfo, page, evidence, { routeId: 'quotes-estimates-ui', label: testInfo.title });
});

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>('body *')).flatMap((element) => {
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.body) {
        const overflow = getComputedStyle(ancestor).overflowX;
        if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden' || overflow === 'clip') return [];
        ancestor = ancestor.parentElement;
      }
      const rect = element.getBoundingClientRect();
      return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1
        ? [{ tag: element.tagName, text: element.textContent?.trim().slice(0, 60), left: rect.left, right: rect.right }]
        : [];
    }).slice(0, 10),
  }));
  expect(dimensions.scrollWidth, `document overflow: ${JSON.stringify(dimensions.offenders)}`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectNoLegacyRoundedSurfaces(root: Locator) {
  const offenders = await root.locator('*:visible').evaluateAll((elements) => elements.flatMap((element) => {
    const style = getComputedStyle(element);
    const radius = Number.parseFloat(style.borderRadius);
    const rect = element.getBoundingClientRect();
    const isSmallCircle = Math.abs(rect.width - rect.height) < 1 && rect.width <= 24;
    if (!Number.isFinite(radius) || radius <= 4 || isSmallCircle || element.tagName.toLowerCase() === 'svg') return [];
    return [{ tag: element.tagName, className: element.className, radius: style.borderRadius }];
  }).slice(0, 20));
  expect(offenders).toEqual([]);
}

async function discoverCommercialRoute(page: Page) {
  await page.goto('/staff/projects');
  const projects = page.getByRole('region', { name: 'Projects list' });
  await expect(projects).toBeVisible({ timeout: 60_000 });
  await expect(projects.getByRole('status')).toHaveCount(0, { timeout: 60_000 });
  const hrefs = await projects.getByRole('link', { name: 'Open' }).evaluateAll((links) =>
    links.slice(0, 8).map((link) => (link as HTMLAnchorElement).href),
  );
  expect(hrefs.length, 'The authenticated browser account needs at least one active project.').toBeGreaterThan(0);

  let fallback = '';
  for (const href of hrefs) {
    const route = `${new URL(href).pathname}?tab=quotes`;
    fallback ||= route;
    await page.goto(route);
    await expect(page.getByRole('region', { name: 'Quotes' })).toBeVisible({ timeout: 60_000 });
    if (await page.locator('[data-quotes-view="list"] tbody tr').count()) return route;
  }
  return fallback;
}

async function openFresh(page: Page, route: string) {
  await page.goto('about:blank');
  await page.goto(route);
  await expect(page.locator('[data-quotes-view="list"], [data-quotes-view="detail"]')).toBeVisible({ timeout: 60_000 });
}

test('Quotes and estimate-version handoff are responsive and keyboard operable', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);
  const route = await discoverCommercialRoute(page);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFresh(page, route);
    await expect(page.getByRole('tab', { name: 'Quotes' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Create quote', exact: true })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(page.locator('[data-project-commercial-view="quotes"]:visible'));
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `quotes-index-${viewport.name}.png`),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 720, height: 500 });
  await openFresh(page, route);
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'quotes-index-720x500-zoom-200.png'),
    fullPage: true,
  });
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });

  await page.setViewportSize({ width: 390, height: 844 });
  await openFresh(page, route);
  const create = page.getByRole('button', { name: 'Create quote', exact: true });
  await create.focus();
  await create.click();
  const dialog = page.getByRole('dialog', { name: 'Create quote' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Select design version')).toBeVisible();
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(dialog);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'quote-create-estimate-version-390x844.png'),
    fullPage: false,
  });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(create).toBeFocused();

  const controlHeights = await page.locator('[data-project-commercial-view] button:visible, [data-project-commercial-view] a:visible').evaluateAll((elements) =>
    elements.map((element) => ({ label: element.textContent?.trim(), height: element.getBoundingClientRect().height })),
  );
  expect(controlHeights.filter((entry) => entry.label && entry.height < 43)).toEqual([]);

  expect(evidence.consoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});

test('Quote detail preserves canonical status, sticky actions, and unsaved protection', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);
  const route = await discoverCommercialRoute(page);
  const mockQuote = {
    id: 'mock-quote-version',
    quoteId: 'mock-quote',
    projectId: 'mock-project',
    quoteRef: 'Q-2026-1042',
    versionNumber: 3,
    status: 'DRAFT',
    depositPercent: 50,
    sourceEstimateVersionId: 'mock-estimate-version',
    sourceEstimateVersionLabel: 'Design v3',
    revisedFromQuoteVersionId: null,
    createdAt: '2026-07-20T01:00:00.000Z',
    createdBy: 'QA reviewer',
    sentAt: null,
    sentBy: null,
    expiresAt: '2026-08-20',
    reference: 'Rear pergola',
    customerName: 'Alex Morgan',
    introText: 'Thank you for the opportunity to quote this project.',
    termsText: 'Standard Sanctuary terms apply.',
    totals: { totalIncGstCents: 2860000, totalExGstCents: 2600000, gstCents: 260000 },
    pdfFileId: null,
    renderHash: null,
    lineItems: [
      {
        id: 'mock-line-1',
        description: 'Custom aluminium pergola — supply and installation',
        qty: 1,
        unitPriceIncGstCents: 2860000,
        lineTotalIncGstCents: 2860000,
        sortOrder: 0,
      },
    ],
    sendLogs: [],
    contact: { name: 'Alex Morgan', email: 'alex@example.com', phone: '021 555 0142' },
    project: { name: 'Rear pergola', siteAddress: '42 Harbour Road', region: 'Auckland', quoteRef: 'Q-2026-1042' },
  };
  await page.route('**/api/quotes/mock-quote-version', (requestRoute) => requestRoute.fulfill({ json: { quoteVersion: mockQuote } }));
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFresh(page, `${route}&quoteId=mock-quote-version`);
  const detail = page.getByRole('region', { name: 'Quote detail' });
  await expect(detail).toBeVisible();
  await expect(detail.getByLabel('Page actions')).toBeVisible();
  await expect(detail.getByText(/Draft|Sent|Accepted|Declined/, { exact: true }).first()).toBeVisible();
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(detail);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'quote-detail-1280x800.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(detail);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'quote-detail-390x844.png'),
    fullPage: true,
  });

  const draftReference = detail.locator('input[placeholder="Optional reference"]');
  if (await draftReference.count()) {
    await draftReference.fill(`${await draftReference.inputValue()} review`);
    let prompted = false;
    page.once('dialog', async (browserDialog) => {
      prompted = true;
      expect(browserDialog.type()).toBe('confirm');
      await browserDialog.dismiss();
    });
    await detail.getByRole('button', { name: /Back/ }).click();
    expect(prompted).toBe(true);
    await expect(detail).toBeVisible();
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await detail.getByLabel('Page actions').evaluate((element) => {
    const style = getComputedStyle(element);
    return { animationDuration: style.animationDuration, transitionDuration: style.transitionDuration };
  });
  expect(motion.animationDuration.split(',').every((duration) => duration.trim() === '0s')).toBe(true);
  expect(motion.transitionDuration.split(',').every((duration) => duration.trim() === '0s')).toBe(true);

  expect(evidence.consoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});
