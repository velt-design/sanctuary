import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  attachPortalBrowserEvidence,
  capturePortalEvidenceScreenshot,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from './support/portalBrowserEvidence';

const evidenceDir = path.resolve(process.cwd(), 'artifacts/ui-foundation-header-search');
fs.mkdirSync(evidenceDir, { recursive: true });
const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();

test.describe.configure({ mode: 'serial' });

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (!evidence) return;
  await attachPortalBrowserEvidence(testInfo, page, evidence, {
    routeId: 'staff-header-search-pilot',
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

type PilotHeaderVariant = 'dashboard' | 'index' | 'detail';
type PilotHeaderLayout = 'inline' | 'stacked';

async function expectSharedHeaderGeometry(
  page: Page,
  variant: PilotHeaderVariant,
  expectedLayout: PilotHeaderLayout,
) {
  const header = page.locator(`[data-page-header-variant="${variant}"]:visible`);
  await expect(header).toHaveCount(1);
  const geometry = await header.evaluate((element) => {
    const rectFor = (selector: string) => {
      const child = element.querySelector<HTMLElement>(selector);
      if (!child) return null;
      const rect = child.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        centreX: rect.left + rect.width / 2,
        centreY: rect.top + rect.height / 2,
      };
    };
    return {
      row: rectFor('[data-page-header-row="true"]'),
      identity: rectFor('[data-page-header-identity="true"]'),
      utility: rectFor('[data-page-header-utility="true"]'),
      actions: rectFor('[data-page-header-actions="true"]'),
      actionContent: (() => {
        const actions = element.querySelector<HTMLElement>('[data-page-header-actions="true"]');
        if (!actions) return null;
        const rects = Array.from(actions.querySelectorAll<HTMLElement>('*'))
          .map((child) => child.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0);
        if (!rects.length) return null;
        return {
          left: Math.min(...rects.map((rect) => rect.left)),
          right: Math.max(...rects.map((rect) => rect.right)),
        };
      })(),
    };
  });

  expect(geometry.row).not.toBeNull();
  expect(geometry.identity).not.toBeNull();
  expect(geometry.utility).not.toBeNull();
  expect(geometry.actions).not.toBeNull();
  if (!geometry.row || !geometry.identity || !geometry.utility || !geometry.actions) return;

  expect(Math.abs(geometry.utility.centreX - geometry.row.centreX)).toBeLessThanOrEqual(2);
  expect(geometry.actionContent).not.toBeNull();
  if (geometry.actionContent) {
    expect(geometry.actionContent.left).toBeGreaterThanOrEqual(geometry.row.left - 1);
    expect(geometry.actionContent.right).toBeLessThanOrEqual(geometry.row.right + 1);
  }
  if (expectedLayout === 'inline') {
    const identityOverlap = Math.min(geometry.identity.bottom, geometry.utility.bottom)
      - Math.max(geometry.identity.top, geometry.utility.top);
    const actionsOverlap = Math.min(geometry.actions.bottom, geometry.utility.bottom)
      - Math.max(geometry.actions.top, geometry.utility.top);
    expect(identityOverlap).toBeGreaterThan(0);
    expect(actionsOverlap).toBeGreaterThan(0);
    return;
  }

  expect(geometry.utility.top).toBeGreaterThanOrEqual(geometry.identity.bottom - 1);
  expect(geometry.actions.top).toBeGreaterThanOrEqual(geometry.utility.bottom - 1);
}

async function waitForProjects(page: Page) {
  await page.goto('/staff/projects');
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.locator('main[data-projects-index-state]:visible')).toHaveAttribute(
    'data-projects-index-state',
    /^(fresh|refresh-failed|unavailable)$/,
  );
}

async function waitForPilotRoute(page: Page, route: string, variant: PilotHeaderVariant) {
  await page.goto(route);
  await expect(page.locator(`[data-page-header-variant="${variant}"]:visible`)).toHaveCount(1);
  if (variant === 'dashboard') {
    await expect(page.locator('[data-ui-foundation-consumer="dashboard"]:visible')).toHaveAttribute(
      'data-dashboard-state',
      /^(fresh|refresh-failed)$/,
    );
  } else if (variant === 'index') {
    await expect(page.locator('main[data-projects-index-state]:visible')).toHaveAttribute(
      'data-projects-index-state',
      /^(fresh|refresh-failed|unavailable)$/,
    );
  } else {
    await expect(page.locator('[data-project-snapshot-state]:visible')).toHaveAttribute(
      'data-project-snapshot-state',
      /^(fresh|refresh-failed|unavailable)$/,
    );
  }
}

test('shared header search works across Dashboard, Projects Index, and Project Detail', async ({ page }) => {
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));

  const liveResponse = await page.request.get('/api/staff/v1/search?q=an');
  expect(liveResponse.status()).toBe(200);
  const livePayload = await liveResponse.json();
  expect(Array.isArray(livePayload.projects)).toBe(true);
  expect(Array.isArray(livePayload.contacts)).toBe(true);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await waitForProjects(page);
  const projectDetailHref = await page.locator('a', { hasText: 'Open' }).first().getAttribute('href');
  test.skip(!projectDetailHref, 'Authenticated test account has no representative project.');

  const projectsGlobalSearch = page.getByRole('combobox', { name: 'Search projects and contacts' });
  await expect(projectsGlobalSearch).toBeVisible();
  await expect(page.getByRole('search', { name: 'Search and filter' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New project', exact: true })).toBeVisible();
  await expectSharedHeaderGeometry(page, 'index', 'inline');
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'projects-index-1440x1000.png'),
    fullPage: false,
  });

  await page.route('**/api/staff/v1/search?q=rem', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      query: 'rem',
      projects: [{
        kind: 'project',
        id: 'proj_search_result',
        href: projectDetailHref,
        name: 'Remuera Residence',
        reference: 'Q-2307',
        siteAddress: 'Remuera, Auckland',
        contactName: 'Alex Mason',
        stage: 'quoting',
        archived: false,
      }],
      contacts: [{
        kind: 'contact',
        id: 'ct_search_result',
        href: '/staff/contacts?q=rem',
        name: 'Remuera Client',
        email: 'client@example.com',
        phone: '021 555 0101',
        address: null,
      }],
      generatedAt: '2026-07-22T00:00:00.000Z',
    }),
  }));

  await page.goto('/dashboard');
  await expect(page.locator('[data-ui-foundation-consumer="dashboard"]:visible')).toHaveAttribute(
    'data-dashboard-state',
    /^(fresh|refresh-failed)$/,
  );
  await expectSharedHeaderGeometry(page, 'dashboard', 'inline');
  await page.keyboard.press('Control+k');
  const dashboardSearch = page.getByRole('combobox', { name: 'Search projects and contacts' });
  await expect(dashboardSearch).toBeFocused();
  await dashboardSearch.fill('rem');
  const results = page.getByRole('listbox', { name: 'Portal search results' });
  const resultsPanel = page.locator('[data-global-search-panel="true"]');
  await expect(results).toBeVisible();
  await expect(results.getByRole('option', { name: /Remuera Residence/ })).toBeVisible();
  await expect(results.getByRole('option', { name: /Remuera Client/ })).toBeVisible();
  await expect(resultsPanel.getByRole('link', { name: /View all matching projects/ })).toHaveAttribute('href', '/staff/projects?q=rem');
  await expect(resultsPanel.getByRole('link', { name: /View all matching contacts/ })).toHaveAttribute('href', '/staff/contacts?q=rem');
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'dashboard-search-results-1440x1000.png'),
    fullPage: false,
  });

  await dashboardSearch.press('ArrowDown');
  await expect(results.getByRole('option', { name: /Remuera Residence/ })).toHaveAttribute('aria-selected', 'true');
  await dashboardSearch.press('Enter');
  await expect(page).toHaveURL(new RegExp(projectDetailHref!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await expect(page.locator('[data-page-header-variant="detail"]:visible')).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'Search projects and contacts' })).toBeVisible();
  await expect(page.locator('ol[aria-label="Project stage"]:visible li')).toHaveCount(9);
  await expectSharedHeaderGeometry(page, 'detail', 'inline');
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'project-detail-1440x1000.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileSearch = page.getByRole('combobox', { name: 'Search projects and contacts' });
  await expect(mobileSearch).toBeVisible();
  await mobileSearch.fill('rem');
  await expect(page.getByRole('listbox', { name: 'Portal search results' })).toBeVisible();
  await expectSharedHeaderGeometry(page, 'detail', 'stacked');
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'project-detail-search-results-390x844.png'),
    fullPage: false,
  });
  await mobileSearch.press('Escape');
  await expect(page.locator('[data-global-search-panel="true"]')).toHaveCount(0);

  const actionableConsoleMessages = evidence.consoleMessages.filter(
    (message) => !(message.type === 'warning' && message.text.includes('was preloaded using link preload but not used')),
  );
  expect(actionableConsoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});

test('pilot headers wrap consistently at tablet, mobile, and 200% zoom', async ({ page }) => {
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await waitForProjects(page);
  const projectDetailHref = await page.locator('a', { hasText: 'Open' }).first().getAttribute('href');
  test.skip(!projectDetailHref, 'Authenticated test account has no representative project.');

  const routes: Array<{ id: string; route: string; variant: PilotHeaderVariant }> = [
    { id: 'dashboard', route: '/dashboard', variant: 'dashboard' },
    { id: 'projects-index', route: '/staff/projects', variant: 'index' },
    { id: 'project-detail', route: projectDetailHref!, variant: 'detail' },
  ];
  const wrappedViewports = [
    { name: '1024x900', width: 1024, height: 900 },
    { name: '390x844', width: 390, height: 844 },
  ] as const;

  for (const viewport of wrappedViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of routes) {
      await waitForPilotRoute(page, route.route, route.variant);
      await expectSharedHeaderGeometry(page, route.variant, 'stacked');
      await expectNoDocumentOverflow(page);
      await capturePortalEvidenceScreenshot(page, {
        path: path.join(evidenceDir, `${route.id}-centred-${viewport.name}.png`),
        fullPage: false,
      });
    }
  }

  await page.setViewportSize({ width: 720, height: 500 });
  for (const route of routes) {
    await waitForPilotRoute(page, route.route, route.variant);
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await expectSharedHeaderGeometry(page, route.variant, 'stacked');
    await expectNoDocumentOverflow(page);
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `${route.id}-centred-720x500-zoom-200.png`),
      fullPage: false,
    });
    await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  }

  expect(evidence.consoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});
