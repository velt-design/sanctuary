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

const evidenceDir = path.resolve(process.cwd(), 'artifacts/ui-foundation-contacts');
fs.mkdirSync(evidenceDir, { recursive: true });

function unexpectedConsoleMessages(evidence: PortalBrowserEvidence) {
  return evidence.consoleMessages.filter((message) => !(
    message.type === 'warning' &&
    message.text.includes('was preloaded using link preload but not used within a few seconds')
  ));
}

async function openFresh(page: Page, route: string) {
  await page.goto('about:blank');
  await page.goto(route);
}

async function capture(page: Page, route: string, viewport: string, fullPage = true) {
  await capturePortalEvidenceScreenshot(page, { path: path.join(evidenceDir, `${route}-${viewport}.png`), fullPage });
}

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
    roots: Array.from(document.body.children).map((element) => {
      const rect = element.getBoundingClientRect();
      return { tag: element.tagName, className: element.className, left: rect.left, right: rect.right, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
    }),
    wide: Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((element) => element.scrollWidth > element.clientWidth + 1).slice(0, 12).map((element) => ({
      tag: element.tagName,
      className: element.className,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
    })),
    visibleRootWidth: Array.from(document.body.children).reduce((width, element) => {
      const rect = element.getBoundingClientRect();
      return Math.max(width, rect.right - Math.min(0, rect.left));
    }, document.body.scrollWidth),
  }));
  expect(dimensions.scrollWidth, `document overflow: ${JSON.stringify({ visibleRootWidth: dimensions.visibleRootWidth, offenders: dimensions.offenders, roots: dimensions.roots, wide: dimensions.wide })}`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectNoLegacyRoundedSurfaces(root: Locator) {
  const offenders = await root.locator('*:visible').evaluateAll((elements) => elements.flatMap((element) => {
    const style = getComputedStyle(element);
    const radius = Number.parseFloat(style.borderRadius);
    const rect = element.getBoundingClientRect();
    const isSmallCircle = Math.abs(rect.width - rect.height) < 1 && rect.width <= 24;
    const isFoundationSwitch = typeof element.className === 'string' && element.className.includes('switchTrack');
    if (!Number.isFinite(radius) || radius <= 4 || isSmallCircle || isFoundationSwitch || element.tagName.toLowerCase() === 'svg') return [];
    return [{ tag: element.tagName, className: element.className, radius: style.borderRadius }];
  }).slice(0, 20));
  expect(offenders).toEqual([]);
}

test.describe.configure({ mode: 'serial' });
const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (!evidence) return;
  await attachPortalBrowserEvidence(testInfo, page, evidence, { routeId: 'contacts-ui', label: testInfo.title });
});

test('Contacts index and create routes are responsive and keyboard-operable', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFresh(page, '/staff/contacts');
    await expect(page.locator('[data-page-header-variant="index"]:visible')).toHaveCount(1);
    await expect(page.locator('main[data-contacts-index-state]:visible')).toHaveAttribute(
      'data-contacts-index-state',
      /^(fresh|refresh-failed|unavailable)$/,
    );
    await expect(page.getByRole('search', { name: 'Search and filter' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(page.locator('main[data-contacts-index-state]:visible'));
    await capture(page, 'contacts-index', viewport.name);

    await openFresh(page, '/staff/contacts/new');
    await expect(page.locator('[data-page-header-variant="detail"]:visible')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Contact details' })).toBeVisible();
    await expect(page.getByLabel('Name *')).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(page.locator('main:visible'));
    await capture(page, 'contact-new', viewport.name);
  }

  await page.setViewportSize({ width: 720, height: 500 });
  await openFresh(page, '/staff/contacts');
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expectNoDocumentOverflow(page);
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toBeVisible();
  await capture(page, 'contacts-index', '720x500-zoom-200');
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });

  await page.setViewportSize({ width: 390, height: 844 });
  await openFresh(page, '/staff/contacts/new');
  const name = page.getByLabel('Name *');
  await name.focus();
  await expect(name).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Email')).toBeFocused();
  const controlHeights = await page.locator('main button:visible, main a:visible').evaluateAll((elements) =>
    elements.map((element) => ({ label: element.textContent?.trim(), height: element.getBoundingClientRect().height })),
  );
  expect(controlHeights.filter((entry) => entry.label && entry.height < 43)).toEqual([]);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await page.getByRole('button', { name: 'Create Contact' }).evaluate((element) => {
    const style = getComputedStyle(element);
    return { animationDuration: style.animationDuration, transitionDuration: style.transitionDuration };
  });
  expect(motion.animationDuration.split(',').every((duration) => duration.trim() === '0s')).toBe(true);
  expect(motion.transitionDuration.split(',').every((duration) => duration.trim() === '0s')).toBe(true);
  expect(unexpectedConsoleMessages(evidence)).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});

test('Contacts detail and CSV review preserve real workflow interactions', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  await page.setViewportSize({ width: 1280, height: 800 });
  await openFresh(page, '/staff/contacts');
  await expect(page.locator('main[data-contacts-index-state]:visible')).toHaveAttribute(
    'data-contacts-index-state',
    /^(fresh|refresh-failed|unavailable)$/,
  );
  const firstContactHref = await page.getByRole('link', { name: 'Open' }).first().getAttribute('href').catch(() => null);

  const importTrigger = page.getByRole('button', { name: 'Import CSV' });
  await importTrigger.focus();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'contacts-review.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,email,phone\nReview Only,review-only@example.test,0210000000'),
  });
  const dialog = page.getByRole('dialog', { name: 'Import contacts from CSV' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Review Only')).toBeVisible();
  await expect(dialog.getByRole('switch', { name: /Merge blanks/ })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(dialog);
  await capture(page, 'contacts-import', '1280x800', false);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(importTrigger).toBeFocused();

  test.skip(!firstContactHref, 'Authenticated test account has no representative contact.');
  const detailRoute = new URL(firstContactHref!, page.url()).pathname;
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFresh(page, detailRoute);
    await expect(page.locator('[data-page-header-variant="detail"]:visible')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Contact info' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(page.locator('main:visible'));
    await capture(page, 'contact-detail', viewport.name);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await openFresh(page, detailRoute);
  const edit = page.getByRole('button', { name: 'Edit' });
  await edit.focus();
  await expect(edit).toBeFocused();
  await edit.click();
  await expect(page.getByLabel('Contact name')).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();
  expect(unexpectedConsoleMessages(evidence)).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});
