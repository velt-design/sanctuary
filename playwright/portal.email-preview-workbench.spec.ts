import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { capturePortalEvidenceScreenshot } from './support/portalBrowserEvidence';

const evidenceDir = path.resolve(
  process.cwd(),
  'artifacts/email-preview-workbench',
);
fs.mkdirSync(evidenceDir, { recursive: true });

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
}

async function expectEmailFramesHealthy(page: Page, expectedCount: number) {
  await expect(page.locator('iframe')).toHaveCount(expectedCount);
  const emailFrames = page.frames().filter((frame) => frame.parentFrame());
  expect(emailFrames).toHaveLength(expectedCount);
  for (const frame of emailFrames) {
    await expect(frame.locator('body')).toBeVisible();
    await expect
      .poll(
        () =>
          frame.locator('img').first().evaluate(
            (image) =>
              image instanceof HTMLImageElement
              && image.complete
              && image.naturalWidth > 0,
          ),
        { message: 'email project image should finish loading' },
      )
      .toBe(true);
    const geometry = await frame.locator('html').evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      hasImage: Boolean(element.querySelector('img')),
      hasButton: Boolean(element.querySelector('.spx-button')),
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.hasImage).toBe(true);
    expect(geometry.hasButton).toBe(true);
  }
}

async function capture(page: Page, name: string, fullPage = true) {
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, `${name}.png`),
    fullPage,
  });
}

test('email design workbench is responsive and keeps preview overflow contained', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  const viewports = [
    { name: 'desktop-1440', width: 1440, height: 1000 },
    { name: 'laptop-1024', width: 1024, height: 900 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-390', width: 390, height: 844 },
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/qa/email-preview-workbench-fixture');
    await expect(
      page.getByRole('heading', {
        name: 'Enquiry email workbench',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId('email-preview-canvas')).toHaveAttribute(
      'data-preview-mode',
      'compare',
    );
    await expect(
      page.getByText('Tindalls Bay - Patio & Carport', { exact: true }),
    ).toBeVisible();
    await expectEmailFramesHealthy(page, 3);
    await expectNoDocumentOverflow(page);
    if (viewport.width === 390) {
      const segmentHeights = await page
        .locator('[data-segment-value]')
        .evaluateAll((segments) =>
          segments.map((segment) => segment.getBoundingClientRect().height),
        );
      expect(Math.min(...segmentHeights)).toBeGreaterThanOrEqual(44);
    }
    await capture(page, `after-${viewport.name}`, viewport.width === 1440);
    if (viewport.width !== 1440) {
      const canvas = page.getByTestId('email-preview-canvas');
      await canvas.evaluate((element) =>
        element.scrollIntoView({ block: 'start' }),
      );
      await expect(canvas).toBeInViewport();
      await capture(page, `after-${viewport.name}-canvas`, false);
    }
  }

  expect(consoleErrors).toEqual([]);
});

test('focus, theme, viewport, zoom and delivery confirmation remain synchronized', async ({
  page,
}) => {
  let simulatedSendCount = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST'
      && new URL(request.url()).pathname === '/api/qa/email-preview-workbench'
    ) {
      simulatedSendCount += 1;
    }
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/qa/email-preview-workbench-fixture');
  await expectEmailFramesHealthy(page, 3);

  const selectedSend = page.getByRole('button', {
    name: 'Send Editorial Refined',
  });
  await selectedSend.click();
  const cancel = page.getByRole('button', { name: 'Cancel' });
  await expect(cancel).toBeFocused();
  await cancel.click();
  await expect(selectedSend).toBeFocused();

  await page.locator('[data-segment-value="focus"]').click();
  await page.locator('[data-layout-choice="image-led"]').click();
  await page.locator('[data-segment-value="dark"]').click();
  await page.locator('[data-segment-value="mobile"]').click();
  await page.locator('[data-segment-value="75"]').click();

  const canvas = page.getByTestId('email-preview-canvas');
  await expect(canvas).toHaveAttribute('data-preview-mode', 'focus');
  await expect(canvas).toHaveAttribute('data-preview-viewport', 'mobile');
  await expect(canvas).toHaveAttribute('data-preview-theme', 'dark');
  await expectEmailFramesHealthy(page, 1);
  await expect(page.locator('iframe')).toHaveAttribute(
    'title',
    'Image-led mobile dark enquiry email preview',
  );
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', '');
  await expect(page.locator('iframe')).toHaveAttribute(
    'srcdoc',
    /sp-preview-dark/,
  );

  await page.getByRole('button', { name: 'Send Image-led' }).click();
  await expect(page.getByText('Send Image-led?')).toBeVisible();
  expect(simulatedSendCount).toBe(0);
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(simulatedSendCount).toBe(0);

  await page.getByRole('button', { name: 'Send all 3' }).click();
  await expect(page.getByText('Send all 3 alternatives?')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm send' }).click();
  await expect(page.getByText('3 alternatives accepted')).toBeVisible();
  expect(simulatedSendCount).toBe(3);

  await expectNoDocumentOverflow(page);
  await capture(page, 'after-focus-image-led-mobile-dark');
});
