import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  attachPortalBrowserEvidence,
  capturePortalEvidenceScreenshot,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from './support/portalBrowserEvidence';

const evidenceDir = path.resolve(process.cwd(), 'artifacts/ui-foundation-remaining-routes');
fs.mkdirSync(evidenceDir, { recursive: true });

const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();
const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '390x844', width: 390, height: 844 },
] as const;

test.describe.configure({ mode: 'serial' });

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (!evidence) return;
  await attachPortalBrowserEvidence(testInfo, page, evidence, {
    routeId: 'remaining-routes-foundation-ui',
    label: testInfo.title,
  });
});

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
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

async function openFoundationRoute(
  page: Page,
  route: string,
  heading: string,
  consumer: string,
) {
  await page.goto('about:blank');
  await page.goto(route);
  await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible({ timeout: 60_000 });
  const root = page.locator(`[data-ui-foundation-consumer="${consumer}"]:visible`).first();
  await expect(root).toBeVisible({ timeout: 60_000 });
  return root;
}

function expectCleanBrowserEvidence(evidence: PortalBrowserEvidence) {
  const actionableConsoleMessages = evidence.consoleMessages.filter(
    (message) => !(message.type === 'warning' && message.text.includes('was preloaded using link preload but not used')),
  );
  expect(actionableConsoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
}

test('New Project, Design Packages, and Running Jobs use the Foundation at desktop and mobile', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  const routes = [
    { route: '/staff/projects/new', heading: 'New Project', consumer: 'project-create', slug: 'project-create', waitsForDataset: false },
    { route: '/staff/projects/design-packages', heading: 'Drafting Queue', consumer: 'spreadsheet', slug: 'design-packages', waitsForDataset: true },
    { route: '/staff/projects/running-jobs', heading: 'Running Jobs', consumer: 'spreadsheet', slug: 'running-jobs', waitsForDataset: true },
  ] as const;

  for (const entry of routes) {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const root = await openFoundationRoute(page, entry.route, entry.heading, entry.consumer);
      if (entry.waitsForDataset) {
        await expect(root.getByText(/^Generated \d{4}-\d{2}-\d{2}/)).toBeVisible({ timeout: 60_000 });
      }
      await expectNoDocumentOverflow(page);
      await expectNoLegacyRoundedSurfaces(root);
      await capturePortalEvidenceScreenshot(page, {
        path: path.join(evidenceDir, `${entry.slug}-${viewport.name}.png`),
        fullPage: true,
      });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const createRoot = await openFoundationRoute(page, '/staff/projects/new', 'New Project', 'project-create');
  const revealContact = createRoot.getByRole('button', { name: 'Create new contact' });
  await revealContact.click();
  await expect(createRoot.getByRole('heading', { name: 'New contact' })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(createRoot);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'project-create-new-contact-390x844.png'),
    fullPage: true,
  });

  expectCleanBrowserEvidence(evidence);
});

test('Imports, Pricebook, and Access use hard-edge Foundation surfaces without mutating data', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  const routes = [
    { route: '/imports', heading: 'Imports', consumer: 'imports', slug: 'imports' },
    { route: '/pricebook', heading: 'Pricebook', consumer: 'pricebook', slug: 'pricebook' },
    { route: '/admin/access', heading: 'Access', consumer: 'admin-access', slug: 'access' },
  ] as const;

  for (const entry of routes) {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const root = await openFoundationRoute(page, entry.route, entry.heading, entry.consumer);
      await expectNoDocumentOverflow(page);
      await expectNoLegacyRoundedSurfaces(root);
      await capturePortalEvidenceScreenshot(page, {
        path: path.join(evidenceDir, `${entry.slug}-${viewport.name}.png`),
        fullPage: entry.slug !== 'pricebook',
      });
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  const pricebook = await openFoundationRoute(page, '/pricebook', 'Pricebook', 'pricebook');
  for (const tabName of ['Materials', 'Actions', 'Overheads']) {
    const tab = pricebook.getByRole('tab', { name: tabName, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    const panel = pricebook.getByRole('tabpanel', { name: tabName, exact: true });
    await expect(panel).toBeVisible();
    await expectNoLegacyRoundedSurfaces(panel);
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `pricebook-${tabName.toLowerCase()}-1440x1000.png`),
      fullPage: false,
    });
  }

  expectCleanBrowserEvidence(evidence);
});

test('Standalone quote and print URLs redirect to the canonical Commercial owner', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  await page.goto('/staff/projects');
  const projects = page.getByRole('region', { name: 'Projects list' });
  await expect(projects).toBeVisible({ timeout: 60_000 });
  await expect(projects.getByRole('status')).toHaveCount(0, { timeout: 60_000 });
  const projectHref = await projects.getByRole('link', { name: 'Open' }).first().getAttribute('href');
  expect(projectHref, 'The authenticated browser account needs at least one active project.').toBeTruthy();
  const projectId = new URL(projectHref as string, page.url()).pathname.split('/').filter(Boolean).at(-1);
  expect(projectId).toBeTruthy();

  const quoteId = 'route-review-quote';
  const quoteVersion = {
    id: quoteId,
    quoteId: 'route-review',
    projectId,
    quoteRef: 'Q-ROUTE-REVIEW',
    versionNumber: 1,
    status: 'DRAFT',
    depositPercent: 50,
    sourceEstimateVersionId: null,
    sourceEstimateVersionLabel: null,
    revisedFromQuoteVersionId: null,
    createdAt: '2026-07-21T00:00:00.000Z',
    createdBy: 'Browser review',
    sentAt: null,
    sentBy: null,
    expiresAt: null,
    reference: 'Canonical route review',
    customerName: 'Route Review',
    introText: '',
    termsText: '',
    totals: { totalIncGstCents: 0, totalExGstCents: 0, gstCents: 0 },
    pdfFileId: null,
    renderHash: null,
    lineItems: [],
    sendLogs: [],
    contact: { name: 'Route Review', email: '', phone: '' },
    project: { name: 'Route Review', siteAddress: '', region: '', quoteRef: 'Q-ROUTE-REVIEW' },
  };
  await page.route(`**/api/quotes/${quoteId}`, (route) => route.fulfill({ json: { quoteVersion } }));

  await page.goto(`/staff/projects/${projectId}/quotes/${quoteId}`);
  await expect(page).toHaveURL(new RegExp(`/staff/projects/${projectId}\\?tab=quotes&quoteId=${quoteId}$`));
  await expect(page.getByText('This module is not active yet.')).toHaveCount(0);
  await expect(page.locator('[data-quotes-view="detail"]')).toBeVisible({ timeout: 60_000 });

  await page.goto(`/staff/projects/${projectId}/quotes/${quoteId}/print`);
  await expect(page).toHaveURL(new RegExp(`/staff/projects/${projectId}\\?tab=quotes&quoteId=${quoteId}&quotePreview=1$`));
  await expect(page.getByText('This module is not active yet.')).toHaveCount(0);
  await expect(page.locator('[data-quotes-view="detail"]')).toBeVisible({ timeout: 60_000 });

  expectCleanBrowserEvidence(evidence);
});
