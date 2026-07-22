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
    routeId: 'staff-header-search',
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

function projectIdFromHref(href: string): string {
  return new URL(href, 'http://portal.local').pathname.split('/').filter(Boolean).at(-1) ?? '';
}

function escapedPathPattern(href: string): RegExp {
  return new RegExp(new URL(href, 'http://portal.local').pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

async function expectSearchRouteSettled(page: Page, href: string) {
  await expect(page.locator('[data-global-portal-search="true"]:visible')).toHaveAttribute(
    'data-global-portal-search-pathname',
    new URL(href, 'http://portal.local').pathname,
  );
  await expect(page.locator('[data-portal-route-progress="true"]')).toHaveCount(0);
  const projectState = page.locator('main[data-project-snapshot-state]:visible');
  if (await projectState.count()) {
    await expect(projectState).toHaveAttribute(
      'data-project-snapshot-state',
      /^(fresh|refresh-failed|unavailable)$/,
    );
  }
}

test('shared search handles project-to-project mouse, keyboard, current, and mobile navigation', async ({ page }) => {
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
  const openProjectLinks = page.locator('a', { hasText: 'Open' });
  const openProjectCount = await openProjectLinks.count();
  test.skip(openProjectCount < 2, 'Authenticated test account needs two representative projects.');
  const projectAHref = await openProjectLinks.nth(0).getAttribute('href');
  const projectBHref = await openProjectLinks.nth(1).getAttribute('href');
  test.skip(!projectAHref || !projectBHref, 'Representative project links are unavailable.');
  const projectAId = projectIdFromHref(projectAHref!);
  const projectBId = projectIdFromHref(projectBHref!);

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

  await page.route('**/api/staff/v1/search?*', (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? '';
    const target = query === 'switch' || query === 'mobile'
      ? { id: projectBId, href: projectBHref!, name: 'Switch to project B' }
      : { id: projectAId, href: projectAHref!, name: query === 'current' ? 'Current project A' : 'Return to project A' };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        query,
        projects: [{
          kind: 'project',
          id: target.id,
          href: target.href,
          name: target.name,
          reference: 'Q-2307',
          siteAddress: 'Auckland',
          contactName: 'Portal search regression',
          stage: 'quoting',
          archived: false,
        }],
        contacts: query === 'rem' ? [{
          kind: 'contact',
          id: 'ct_search_result',
          href: '/staff/contacts?q=rem',
          name: 'Remuera Client',
          email: 'client@example.com',
          phone: '021 555 0101',
          address: null,
        }] : [],
        generatedAt: '2026-07-22T00:00:00.000Z',
      }),
    });
  });

  await openProjectLinks.nth(0).click();
  await expect(page).toHaveURL(escapedPathPattern(projectAHref!));
  await expect(page.locator(`[data-project-id="${projectAId}"]:visible`)).toHaveCount(1);
  await expectSearchRouteSettled(page, projectAHref!);

  const projectASearch = page.getByRole('combobox', { name: 'Search projects and contacts' });
  await projectASearch.fill('switch');
  const switchResults = page.getByRole('listbox', { name: 'Portal search results' });
  const projectBOption = switchResults.getByRole('option', { name: /Switch to project B/ });
  await expect(projectBOption).toBeVisible();
  await projectBOption.click();
  await expect(page).toHaveURL(escapedPathPattern(projectBHref!));
  await expect(page.locator(`[data-project-id="${projectBId}"]:visible`)).toHaveCount(1);
  await expectSearchRouteSettled(page, projectBHref!);
  await expect(page.getByRole('combobox', { name: 'Search projects and contacts' })).toHaveValue('');

  const projectBSearch = page.getByRole('combobox', { name: 'Search projects and contacts' });
  await projectBSearch.fill('return');
  const returnResults = page.getByRole('listbox', { name: 'Portal search results' });
  await expect(returnResults.getByRole('option', { name: /Return to project A/ })).toBeVisible();
  await projectBSearch.press('ArrowDown');
  await expect(returnResults.getByRole('option', { name: /Return to project A/ })).toHaveAttribute('aria-selected', 'true');
  await projectBSearch.press('Enter');
  await expect(page).toHaveURL(escapedPathPattern(projectAHref!));
  await expect(page.locator(`[data-project-id="${projectAId}"]:visible`)).toHaveCount(1);
  await expectSearchRouteSettled(page, projectAHref!);

  const currentSearch = page.getByRole('combobox', { name: 'Search projects and contacts' });
  await currentSearch.fill('current');
  const currentOption = page.getByRole('listbox', { name: 'Portal search results' })
    .getByRole('option', { name: /Current project A/ });
  await expect(currentOption).toHaveAttribute('aria-current', 'page');
  await expect(currentOption).toContainText('Current');
  await currentOption.click();
  await expect(page).toHaveURL(escapedPathPattern(projectAHref!));
  await expect(currentSearch).toHaveValue('');
  await expect(page.locator('[data-global-search-panel="true"]')).toHaveCount(0);

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
  await expect(results.getByRole('option', { name: /Return to project A/ })).toBeVisible();
  await expect(results.getByRole('option', { name: /Remuera Client/ })).toBeVisible();
  await expect(resultsPanel.getByRole('link', { name: /View all matching projects/ })).toHaveAttribute('href', '/staff/projects?q=rem');
  await expect(resultsPanel.getByRole('link', { name: /View all matching contacts/ })).toHaveAttribute('href', '/staff/contacts?q=rem');
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'dashboard-search-results-1440x1000.png'),
    fullPage: false,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileSearch = page.getByRole('combobox', { name: 'Search projects and contacts' });
  await expect(mobileSearch).toBeVisible();
  await mobileSearch.fill('mobile');
  const mobileResults = page.getByRole('listbox', { name: 'Portal search results' });
  await expect(mobileResults).toBeVisible();
  await expectSharedHeaderGeometry(page, 'dashboard', 'stacked');
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'dashboard-search-results-390x844.png'),
    fullPage: false,
  });
  await mobileResults.getByRole('option', { name: /Switch to project B/ }).click();
  await expect(page).toHaveURL(escapedPathPattern(projectBHref!));
  await expect(page.locator(`[data-project-id="${projectBId}"]:visible`)).toHaveCount(1);
  await expectSearchRouteSettled(page, projectBHref!);
  await expectSharedHeaderGeometry(page, 'detail', 'stacked');
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'project-detail-after-mobile-search-390x844.png'),
    fullPage: false,
  });

  const actionableConsoleMessages = evidence.consoleMessages.filter(
    (message) => !(message.type === 'warning' && message.text.includes('was preloaded using link preload but not used')),
  );
  expect(actionableConsoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});

test('shared headers wrap consistently at tablet, mobile, and 200% zoom', async ({ page }) => {
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await waitForProjects(page);
  const projectLinks = page.locator('a', { hasText: 'Open' });
  const projectLinkCount = await projectLinks.count();
  const projectDetailHref = projectLinkCount ? await projectLinks.nth(0).getAttribute('href') : null;
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

  const actionableConsoleMessages = evidence.consoleMessages.filter(
    (message) => !(message.type === 'warning' && message.text.includes('was preloaded using link preload but not used')),
  );
  expect(actionableConsoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});

test('shared search header is present across adopted staff and admin routes', async ({ page }) => {
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/staff/contacts');
  await expect(page.locator('[data-page-header-identity="true"] h1:visible')).toContainText('Contacts');
  const contactLinks = page.locator('a[href^="/staff/contacts/"]:not([href="/staff/contacts/new"])');
  const contactLinkCount = await contactLinks.count();
  const contactDetailHref = contactLinkCount ? await contactLinks.nth(0).getAttribute('href') : null;

  const routes = [
    { id: 'contacts', href: '/staff/contacts', title: 'Contacts' },
    ...(contactDetailHref ? [{ id: 'contact-detail', href: contactDetailHref, title: null }] : []),
    { id: 'new-contact', href: '/staff/contacts/new', title: 'New Contact' },
    { id: 'new-project', href: '/staff/projects/new', title: 'New Project' },
    { id: 'schedule', href: '/staff/schedule', title: 'Schedule' },
    { id: 'drafting-queue', href: '/staff/projects/design-packages', title: 'Drafting Queue' },
    { id: 'running-jobs', href: '/staff/projects/running-jobs', title: 'Running Jobs' },
    { id: 'imports', href: '/admin/imports', title: 'Imports' },
    { id: 'pricebook', href: '/pricebook', title: 'Pricebook' },
    { id: 'access', href: '/admin/access', title: 'Access' },
  ];

  for (const route of routes) {
    await page.goto(route.href);
    if (route.title) {
      await expect(page.locator('[data-page-header-identity="true"] h1:visible')).toContainText(route.title);
    } else {
      await expect(page.locator('[data-page-header-identity="true"] h1:visible')).toBeVisible();
    }
    await expect(page.getByRole('combobox', { name: 'Search projects and contacts' })).toBeVisible();
    await expect(page.locator('[data-page-header-utility="true"]:visible')).toHaveCount(1);
    await expectNoDocumentOverflow(page);

    if (['contacts', 'schedule', 'drafting-queue'].includes(route.id)) {
      await capturePortalEvidenceScreenshot(page, {
        path: path.join(evidenceDir, `${route.id}-shared-search-1440x1000.png`),
        fullPage: false,
      });
    }
  }

  await page.goto('/staff/contacts');
  await expect(page.getByRole('search', { name: 'Search and filter' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'New Contact', exact: true })).toBeVisible();
  await page.goto('/staff/schedule');
  await expect(page.getByRole('button', { name: 'Board', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gantt', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Site visits', exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    { id: 'contacts', href: '/staff/contacts' },
    { id: 'schedule', href: '/staff/schedule' },
    { id: 'drafting-queue', href: '/staff/projects/design-packages' },
    { id: 'access', href: '/admin/access' },
  ]) {
    await page.goto(route.href);
    await expect(page.getByRole('combobox', { name: 'Search projects and contacts' })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `${route.id}-shared-search-390x844.png`),
      fullPage: false,
    });
  }

  const actionableConsoleMessages = evidence.consoleMessages.filter(
    (message) => !(message.type === 'warning' && message.text.includes('was preloaded using link preload but not used')),
  );
  expect(actionableConsoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});
