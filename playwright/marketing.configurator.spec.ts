import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const capture = process.env.MARKETING_CONFIGURATOR_CAPTURE === '1';
const evidenceDirectory = '/tmp/sanctuary-configurator-pr4-evidence';
const browserErrors = new WeakMap<Page, string[]>();

async function dismissConsent(page: Page) {
  const banner = page.locator('.consent-banner');
  const essentialOnly = banner.getByRole('button', { name: 'Essential only' });
  await expect(essentialOnly).toBeVisible();
  await essentialOnly.click();
  await expect(banner).toBeHidden();
}

async function assertNoHorizontalOverflowOrFixedCollision(page: Page) {
  const result = await page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>('[data-configurator-dock]');
    if (!dock) return { overflow: true, collisions: ['dock-missing'], bounds: null };
    const dockRect = dock.getBoundingClientRect();
    const collisions = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => element !== dock && !dock.contains(element))
      .filter((element) => {
        const style = getComputedStyle(element);
        if (
          style.position !== 'fixed'
          || style.display === 'none'
          || style.visibility === 'hidden'
          || Number.parseFloat(style.opacity || '1') === 0
          || style.pointerEvents === 'none'
        ) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0
          && rect.left < dockRect.right && rect.right > dockRect.left
          && rect.top < dockRect.bottom && rect.bottom > dockRect.top;
      })
      .map((element) => element.id || element.className || element.tagName);
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      collisions,
      bounds: {
        left: dockRect.left,
        right: dockRect.right,
        top: dockRect.top,
        bottom: dockRect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
    };
  });
  expect(result.overflow).toBe(false);
  expect(result.collisions).toEqual([]);
  expect(result.bounds).not.toBeNull();
  expect(result.bounds!.left).toBeGreaterThanOrEqual(0);
  expect(result.bounds!.right).toBeLessThanOrEqual(result.bounds!.viewportWidth);
  expect(result.bounds!.bottom).toBeLessThanOrEqual(result.bounds!.viewportHeight);
}

async function readCumulativeLayoutShift(page: Page): Promise<number> {
  return page.evaluate(() => Number(
    (window as typeof window & { __configuratorCls?: number }).__configuratorCls ?? 0,
  ));
}

test.beforeAll(async () => {
  if (capture) await mkdir(evidenceDirectory, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([]);
});

for (const width of [360, 390, 430]) {
  test(`empty dock appears after engagement without mobile overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      (window as typeof window & { __configuratorCls?: number }).__configuratorCls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!shift.hadRecentInput) {
            const metricsWindow = window as typeof window & { __configuratorCls?: number };
            metricsWindow.__configuratorCls = (metricsWindow.__configuratorCls ?? 0) + (shift.value ?? 0);
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
      window.localStorage.removeItem('sanctuary.pergola-config.v1');
      window.sessionStorage.removeItem('sanctuary.simple-cover-handoff.v1');
    });
    await page.goto('/pergolas-auckland');
    await dismissConsent(page);
    await page.evaluate(() => window.scrollTo(0, 140));
    const dock = page.locator('[data-configurator-dock]');
    await expect(dock).toHaveAttribute('data-configurator-state', 'empty');
    await expect(dock.getByRole('button', { name: 'Start designing' })).toHaveCSS('min-height', '54px');
    await expect(dock.locator('img, canvas')).toHaveCount(0);
    await assertNoHorizontalOverflowOrFixedCollision(page);
    expect(await readCumulativeLayoutShift(page)).toBeLessThanOrEqual(0.1);
    if (capture) {
      await page.screenshot({ path: `${evidenceDirectory}/eligible-empty-${width}.png` });
    }
  });
}

test('configured dock persists through route navigation and restores after refresh', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pergolas-auckland');
  await dismissConsent(page);
  await page.evaluate(() => window.scrollTo(0, 140));
  const dock = page.locator('[data-configurator-dock]');
  await dock.getByRole('button', { name: 'Start designing' }).click();
  await expect(dock).toHaveAttribute('data-configurator-state', 'configured');
  await expect(dock.locator('[data-configurator-save-status]')).toHaveAttribute(
    'data-configurator-save-status',
    'saved',
  );

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(dock).toBeHidden();
  await page.locator('#mobile-menu').getByRole('link', { name: 'Pergola options' }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(dock).toHaveAttribute('data-configurator-state', 'configured');
  await page.reload();
  await expect(dock).toHaveAttribute('data-configurator-state', 'configured');
  await expect(dock).toContainText('Pitched · 4.0 × 3.0 m · Clear acrylic');
  await expect(dock.locator('img, canvas')).toHaveCount(0);
  await assertNoHorizontalOverflowOrFixedCollision(page);
  if (capture) {
    await page.screenshot({ path: `${evidenceDirectory}/configured-restored-390.png` });
  }
});

test('focused form fields suppress the mobile dock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pergolas-auckland');
  await dismissConsent(page);
  await page.evaluate(() => window.scrollTo(0, 140));
  const dock = page.locator('[data-configurator-dock]');
  await expect(dock).toBeVisible();
  const nameField = page.getByRole('textbox', { name: 'Name Required' });
  await nameField.focus();
  await expect(dock).toBeHidden();
  await nameField.blur();
  await expect(dock).toBeVisible();
});

test('ineligible quote route keeps the dock absent even with a saved configuration', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pergolas-auckland');
  await dismissConsent(page);
  await page.evaluate(() => window.scrollTo(0, 140));
  await page.getByRole('button', { name: 'Start designing' }).click();
  await expect(page.locator('[data-configurator-save-status]')).toHaveAttribute(
    'data-configurator-save-status',
    'saved',
  );
  await page.goto('/quote/evidence');
  await expect(page.locator('[data-configurator-dock]')).toHaveCount(0);
  if (capture) {
    await page.screenshot({ path: `${evidenceDirectory}/ineligible-quote-390.png` });
  }
});

test('reset requires explicit confirmation', async ({ page }) => {
  await page.goto('/pergolas-auckland');
  await dismissConsent(page);
  await page.evaluate(() => window.scrollTo(0, 140));
  await page.getByRole('button', { name: 'Start designing' }).click();
  await expect(page.locator('[data-configurator-save-status]')).toHaveAttribute(
    'data-configurator-save-status',
    'saved',
  );
  const originalId = await page.evaluate(() => {
    const raw = window.localStorage.getItem('sanctuary.pergola-config.v1');
    return raw ? JSON.parse(raw).document.configurationId : null;
  });
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Start a new pergola? Your saved configuration on this device will be replaced.');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Reset' }).click();
  expect(await page.evaluate(() => {
    const raw = window.localStorage.getItem('sanctuary.pergola-config.v1');
    return raw ? JSON.parse(raw).document.configurationId : null;
  })).toBe(originalId);
});
