import { expect, test } from '@playwright/test';

import {
  attachPortalBrowserEvidence,
  expectVisiblePortalProject,
  installPortalBrowserEvidence,
  openPortalPage,
} from './support/portalAgent';

test.describe.configure({ mode: 'serial' });

test('authenticated portal runtime is ready for smoke and performance gates', async ({ page }, testInfo) => {
  const evidence = installPortalBrowserEvidence(page);

  try {
    await openPortalPage(page, '/dashboard', { heading: 'Dashboard' });
    await openPortalPage(page, '/staff/projects', { heading: 'Projects' });
    await expectVisiblePortalProject(page);

    await openPortalPage(page, '/staff/contacts', { heading: 'Contacts' });
    await openPortalPage(page, '/staff/schedule', { heading: 'Schedule' });

    const readiness = await page.evaluate(async () => {
      const response = await fetch('/api/staff/v1/schedule/readiness');
      const text = await response.text();
      return {
        status: response.status,
        requestId: response.headers.get('x-portal-request-id'),
        bodyText: text,
      };
    });

    expect(
      readiness.status,
      `Authenticated runtime preflight requires schedule readiness to return 200, got ${readiness.status}.\n${readiness.bodyText}`,
    ).toBe(200);
    expect(readiness.requestId, 'Schedule readiness should include x-portal-request-id for diagnostics.').toBeTruthy();

    let body: { ok?: boolean };
    try {
      body = JSON.parse(readiness.bodyText) as { ok?: boolean };
    } catch (error) {
      throw new Error(`Schedule readiness returned non-JSON body. Original error: ${String(error)}\n${readiness.bodyText}`);
    }

    expect(body.ok, `Authenticated runtime preflight requires schedule readiness ok: true.\n${readiness.bodyText}`).toBe(true);
  } finally {
    await attachPortalBrowserEvidence(testInfo, page, evidence);
  }
});
