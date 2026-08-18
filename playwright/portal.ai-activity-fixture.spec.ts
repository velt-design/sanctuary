import { expect, test, type Page } from '@playwright/test';
import {
  attachPortalBrowserEvidence,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from './support/portalBrowserEvidence';

const viewports = [
  { id: 'desktop', width: 1440, height: 1000 },
  { id: 'mobile', width: 390, height: 844 },
] as const;

const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (!evidence) return;
  await attachPortalBrowserEvidence(testInfo, page, evidence, {
    routeId: 'ai-activity-fixture',
    label: testInfo.title,
  });
});

test('synthetic AI activity is safe, read-only and responsive', async ({ page }, testInfo) => {
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/qa/ai-activity-fixture');

    const fixture = page.locator('[data-portal-qa-fixture="ai-activity"]');
    await expect(fixture).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI Activity', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Activity timeline' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Approval evidence' })).toBeVisible();
    await expect(page.getByText('Synthetic task recorded with no external effect.')).toBeVisible();
    await expect(fixture.locator('form')).toHaveCount(0);
    await expect(fixture.locator('button')).toHaveCount(0);

    const safeBoundary = await fixture.evaluate((element) => ({
      text: element.textContent ?? '',
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(safeBoundary.scrollWidth).toBeLessThanOrEqual(safeBoundary.clientWidth + 1);
    expect(safeBoundary.text).not.toContain('service_role');
    expect(safeBoundary.text).not.toContain('private.ai_task_payloads');
    expect(safeBoundary.text).not.toContain('requested_by_user_id');

    await testInfo.attach(`ai-activity-${viewport.id}.png`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  }

  expect(evidence.consoleMessages).toEqual([]);
  expect(evidence.failedRequests).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});
