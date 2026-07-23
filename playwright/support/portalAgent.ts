import { expect, type Page } from '@playwright/test';

export {
  withPortalBrowserEvidence,
} from './portalBrowserEvidence';

interface OpenPortalPageOptions {
  heading?: string | RegExp;
  timeout?: number;
}

export interface PortalPageDebugExportPayload {
  version: number;
  pageId: string;
  route: string;
  capturedAt: string;
  selectedIds: Record<string, string | null>;
  serverState: Record<string, unknown>;
  clientState: Record<string, unknown>;
  diagnostics: Record<string, unknown>;
  scenario: unknown;
}

export async function openPortalPage(page: Page, route: string, options: OpenPortalPageOptions = {}) {
  const timeout = options.timeout ?? 60_000;

  await page.goto(route);

  const url = new URL(page.url());
  if (url.pathname.startsWith('/login')) {
    throw new Error(
      `Authenticated portal access reached /login while opening ${route}. Confirm PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD are valid for this portal environment.`,
    );
  }

  if (url.pathname.startsWith('/access-status')) {
    throw new Error(
      `Authenticated portal access reached /access-status while opening ${route}. Confirm the staff test account has an active staff or admin portal role.`,
    );
  }

  await expect(
    page
      .locator(
        'button[aria-label="Open portal navigation"]:visible, [data-portal-sidebar-rail="true"]:visible, [data-portal-sidebar-panel="true"]:visible, [aria-label="Portal navigation"]:visible',
      )
      .first(),
    `Expected authenticated portal shell chrome while opening ${route}.`,
  ).toBeVisible({ timeout });

  if (options.heading) {
    await expect(
      page.getByRole('heading', {
        name: options.heading,
        exact: typeof options.heading === 'string',
      }),
    ).toBeVisible({ timeout });
  }

  return url;
}

export async function expectVisiblePortalProject(page: Page) {
  const firstProjectLink = page.locator('a[href^="/staff/projects/proj_"]').first();
  await expect(
    firstProjectLink,
    'Authenticated portal access requires at least one project visible to the staff test account.',
  ).toBeVisible({ timeout: 60_000 });
}

export async function readPortalPageDebugExport(page: Page): Promise<PortalPageDebugExportPayload | null> {
  const locator = page.locator('[data-portal-debug-export="true"]').first();
  if ((await locator.count()) === 0) return null;

  const raw = await locator.textContent();
  if (!raw) return null;

  return JSON.parse(raw) as PortalPageDebugExportPayload;
}

export async function expectPortalDebugExport(
  page: Page,
  pageId: string,
): Promise<PortalPageDebugExportPayload> {
  const payload = await readPortalPageDebugExport(page);
  expect(payload, `Expected ${pageId} to expose a portal page debug export.`).not.toBeNull();
  expect(payload?.version, `${pageId} debug export version`).toBe(1);
  expect(payload?.pageId, `${pageId} debug export pageId`).toBe(pageId);
  expect(payload?.route, `${pageId} debug export route`).toMatch(/^\//);
  expect(payload?.capturedAt, `${pageId} debug export capturedAt`).toBeTruthy();
  expect(payload?.selectedIds, `${pageId} debug export selectedIds`).toBeTruthy();
  expect(payload?.serverState, `${pageId} debug export serverState`).toBeTruthy();
  expect(payload?.clientState, `${pageId} debug export clientState`).toBeTruthy();
  expect(payload?.diagnostics, `${pageId} debug export diagnostics`).toBeTruthy();
  return payload as PortalPageDebugExportPayload;
}
