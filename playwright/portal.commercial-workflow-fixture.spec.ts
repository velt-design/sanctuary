import { expect, test, type Page } from '@playwright/test';
import {
  attachPortalBrowserEvidence,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from './support/portalBrowserEvidence';

const scenarios = [
  {
    id: 'retryable',
    stateLabel: 'Initial send · failed',
    canRetry: true,
  },
  {
    id: 'needs-attention',
    stateLabel: 'Initial send · needs attention',
    canRetry: false,
  },
] as const;

const viewports = [
  { id: 'desktop', width: 1280, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
] as const;

const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();

test.describe.configure({ mode: 'serial' });

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (!evidence) return;
  await attachPortalBrowserEvidence(testInfo, page, evidence, {
    routeId: 'commercial-workflow-fixture',
    label: testInfo.title,
  });
});

test('prepared quote recovery is truthful, read-only and responsive', async ({
  page,
}, testInfo) => {
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  for (const scenario of scenarios) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(
        `/qa/commercial-workflow-fixture?scenario=${scenario.id}&modal=1`,
      );

      const fixture = page.locator(
        '[data-portal-qa-fixture="commercial-workflow"]',
      );
      await expect(fixture).toHaveAttribute(
        'data-fixture-scenario',
        scenario.id,
      );

      const dialog = page.getByRole('dialog', {
        name: 'Review prepared delivery',
      });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(scenario.stateLabel)).toBeVisible();
      await expect(dialog.getByLabel('Frozen plain-text email')).toHaveAttribute(
        'readonly',
        '',
      );
      const retry = dialog.getByRole('button', {
        name: 'Retry exact prepared delivery',
      });
      if (scenario.canRetry) {
        await expect(retry).toBeEnabled();
      } else {
        await expect(retry).toBeDisabled();
      }

      const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(
        overflow.clientWidth + 1,
      );

      if (viewport.id === 'mobile') {
        const undersized = await dialog
          .getByRole('button')
          .evaluateAll((buttons) =>
            buttons
              .map((button) => ({
                label: button.textContent?.trim(),
                height: button.getBoundingClientRect().height,
              }))
              .filter((button) => button.height < 44),
          );
        expect(undersized).toEqual([]);
      }

      await testInfo.attach(
        `prepared-delivery-${scenario.id}-${viewport.id}.png`,
        {
          body: await page.screenshot(),
          contentType: 'image/png',
        },
      );
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    '/qa/commercial-workflow-fixture?scenario=retryable&modal=0',
  );
  const trigger = page.getByRole('button', {
    name: 'Review prepared delivery',
  });
  await trigger.focus();
  await trigger.click();
  const close = page
    .getByRole('dialog', { name: 'Review prepared delivery' })
    .getByRole('button', { name: 'Close' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();

  expect(evidence.consoleMessages).toEqual([]);
  expect(
    evidence.failedRequests.filter(
      (request) => request.failureText !== 'net::ERR_ABORTED',
    ),
  ).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});
