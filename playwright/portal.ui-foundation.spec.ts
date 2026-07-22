import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { capturePortalEvidenceScreenshot } from './support/portalBrowserEvidence';

const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const;
const evidenceDir = path.resolve(process.cwd(), 'artifacts/ui-foundation-hardening-final');
fs.mkdirSync(evidenceDir, { recursive: true });

async function capture(page: Page, route: string, viewport: string) {
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, `${route}-${viewport}.png`),
    fullPage: true,
  });
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
        ? [{ tag: element.tagName, className: element.className, parentClassName: element.parentElement?.className, text: element.textContent?.trim().slice(0, 80), left: rect.left, right: rect.right }]
        : [];
    }).sort((a, b) => b.right - a.right).slice(0, 12),
  }));
  expect(dimensions.scrollWidth, `document overflowed by ${dimensions.scrollWidth - dimensions.clientWidth}px: ${JSON.stringify(dimensions.offenders)}`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectMajorSectionsDoNotOverlap(page: Page) {
  const overlap = await page.locator('main[data-ui-foundation]:visible > section, main[data-ui-foundation]:visible > footer').evaluateAll((elements) => {
    const rects = elements.map((element) => element.getBoundingClientRect()).filter((rect) => rect.height > 0);
    return rects.some((rect, index) => index > 0 && rect.top < rects[index - 1].bottom - 1);
  });
  expect(overlap).toBe(false);
}

async function expectCoreControlsUncropped(page: Page) {
  const cropped = await page.locator('main[data-ui-foundation]:visible button:visible, main[data-ui-foundation]:visible input:visible, main[data-ui-foundation]:visible select:visible').evaluateAll((elements) => {
    const viewportWidth = document.documentElement.clientWidth;
    return elements.filter((element) => {
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.body) {
        const overflow = getComputedStyle(ancestor).overflowX;
        if (overflow === 'auto' || overflow === 'scroll') return false;
        ancestor = ancestor.parentElement;
      }
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > viewportWidth + 1;
    }).map((element) => (element as HTMLElement).outerHTML.slice(0, 120));
  });
  expect(cropped).toEqual([]);
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

async function contrastRatio(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const parse = (value: string) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
    const luminance = (rgb: number[]) => rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const style = getComputedStyle(element);
    const foreground = luminance(parse(style.color));
    const background = luminance(parse(style.backgroundColor));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
}

async function firstProjectDetailRoute(page: Page): Promise<string | null> {
  await page.goto('/staff/projects');
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.locator('main[data-projects-index-state]:visible')).toHaveAttribute(
    'data-projects-index-state',
    /^(fresh|refresh-failed|unavailable)$/,
  );
  const href = await page.locator('a', { hasText: 'Open' }).first().getAttribute('href').catch(() => null);
  return href ? new URL(href, page.url()).pathname : null;
}

async function openFresh(page: Page, route: string) {
  await page.goto('about:blank');
  await page.goto(route);
}

test.describe.configure({ mode: 'serial' });

test('foundation is responsive, semantic, keyboard-operable, and reduced-motion safe', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFresh(page, '/staff/ui-foundation');
    await expect(page.locator('main[data-ui-foundation]:visible')).toHaveCount(1);
    await expect(page.locator('h1:visible')).toHaveCount(1);
    await expectNoDocumentOverflow(page);
    await expectMajorSectionsDoNotOverlap(page);
    await expectCoreControlsUncropped(page);
    await capture(page, 'ui-foundation', viewport.name);
  }

  await page.setViewportSize({ width: 720, height: 500 });
  await openFresh(page, '/staff/ui-foundation');
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expectNoDocumentOverflow(page);
  await expectCoreControlsUncropped(page);
  await capture(page, 'ui-foundation', '720x500-zoom-200');
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });

  await page.setViewportSize({ width: 390, height: 844 });
  await openFresh(page, '/staff/ui-foundation');
  const mobileBar = page.locator('header').filter({ has: page.getByRole('button', { name: 'Open portal navigation' }) });
  await expect(mobileBar).toHaveCSS('height', '56px');
  await expect(mobileBar).toHaveCSS('background-color', 'rgb(11, 11, 10)');
  await expect(mobileBar).toHaveCSS('border-bottom-color', 'rgb(240, 90, 0)');
  const menuButton = page.getByRole('button', { name: 'Open portal navigation' });
  await menuButton.focus();
  await menuButton.click();
  await expect(page.locator('[data-drawer-panel]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-drawer-panel]')).toHaveCount(0);
  await expect(menuButton).toBeFocused();

  await page.setViewportSize({ width: 1280, height: 800 });
  await openFresh(page, '/staff/ui-foundation');
  const actionStates = page.locator('[class*="interactionTable"] button[data-visual-state]');
  for (let index = 0; index < await actionStates.count(); index += 1) {
    expect(await contrastRatio(actionStates.nth(index))).toBeGreaterThanOrEqual(4.5);
  }
  expect(await contrastRatio(page.locator('[class*="stageBadge"][data-stage="quoting"]').first())).toBeGreaterThanOrEqual(4.5);
  expect(await page.locator('a[aria-label="Projects"]').count()).toBeLessThanOrEqual(1);
  const destructiveTrigger = page.getByRole('button', { name: 'Open destructive confirmation' });
  await destructiveTrigger.click();
  const dialog = page.getByRole('dialog', { name: 'Delete project?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/Type/)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(destructiveTrigger).toBeFocused();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Creating' }).first().scrollIntoViewIfNeeded();
  const motion = await page.getByRole('button', { name: 'Creating' }).first().locator('svg').evaluate((element) => {
    const style = getComputedStyle(element);
    return { animationName: style.animationName, animationDuration: style.animationDuration };
  });
  expect(motion.animationName).toBe('none');
  expect(motion.animationDuration).toBe('0s');
  expect(consoleErrors).toEqual([]);
});

test('Projects Index and Project Detail prove the foundation on real workflows', async ({ page }) => {
  const detailRoute = await firstProjectDetailRoute(page);
  await expect(page.locator('[data-page-header-variant="index"]:visible')).toHaveCount(1);
  await expect(page.getByRole('search', { name: 'Search and filter' })).toBeVisible();
  await expect(page.locator('[data-portal-sidebar-panel] > div')).toHaveCSS('background-color', 'rgb(11, 11, 10)');
  await expect(page.locator('[data-portal-sidebar-panel] a[aria-current="page"]').first().locator('..')).toHaveCSS(
    'border-left-color',
    'rgb(240, 90, 0)',
  );
  await expect(page.locator('main[data-projects-index-state] section[aria-label="Filters"]')).toHaveCSS('border-radius', '0px');
  await expect(page.locator('main[data-projects-index-state] section[aria-label="Projects list"]')).toHaveCSS('border-radius', '0px');
  await expectNoDocumentOverflow(page);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFresh(page, '/staff/projects');
    await expect(page.locator('[data-page-header-variant="index"]:visible')).toHaveCount(1);
    await expect(page.locator('main[data-projects-index-state]:visible')).toHaveAttribute(
      'data-projects-index-state',
      /^(fresh|refresh-failed|unavailable)$/,
    );
    await expectNoDocumentOverflow(page);
    await capture(page, 'projects-index', viewport.name);
  }

  test.skip(!detailRoute, 'Authenticated test account has no representative project.');
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFresh(page, detailRoute!);
    await expect(page.locator('[data-page-header-variant="detail"]:visible')).toHaveCount(1);
    await expect(page.locator('[data-project-snapshot-state]:visible')).toHaveAttribute(
      'data-project-snapshot-state',
      /^(fresh|refresh-failed|unavailable)$/,
    );
    await expect(page.locator('[data-command-centre-state]:visible')).not.toHaveAttribute(
      'data-command-centre-state',
      'pending',
    );
    await expect(page.locator('[data-project-status-details="true"]:visible')).toHaveCount(1);
    await expect(page.locator('ol[aria-label="Project stage"]:visible li')).toHaveCount(9);
    await expectNoDocumentOverflow(page);
    await capture(page, 'project-detail', viewport.name);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await openFresh(page, `${detailRoute!}?tab=estimates`);
  await expect(page.locator('[data-project-snapshot-state]:visible')).toHaveAttribute(
    'data-project-snapshot-state',
    /^(fresh|refresh-failed|unavailable)$/,
  );
  await expect(page.locator('[data-project-active-tab="estimates"]:visible')).toHaveCount(1);
  await expect(page.locator('[data-project-calculator="true"]:visible')).toHaveAttribute(
    'data-project-calculator-state',
    /^(ready|locked|invalid|error)$/,
  );
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(page.locator('[data-project-calculator="true"]:visible'));
  await capture(page, 'project-detail-calculator', '1440x1000');

  await openFresh(page, `${detailRoute!}?tab=quotes`);
  await expect(page.locator('[data-project-snapshot-state]:visible')).toHaveAttribute(
    'data-project-snapshot-state',
    /^(fresh|refresh-failed|unavailable)$/,
  );
  await expect(page.locator('[data-project-active-tab="quotes"]:visible')).toHaveCount(1);
  await expect(page.locator('[data-project-commercial-view="quotes"]:visible')).toHaveCount(1);
  await expect(page.getByText('Loading quotes…', { exact: true })).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(page.locator('[data-project-commercial-view="quotes"]:visible'));
  await capture(page, 'project-detail-commercial', '1440x1000');

  await openFresh(page, `${detailRoute!}?tab=invoices`);
  await expect(page.locator('[data-project-snapshot-state]:visible')).toHaveAttribute(
    'data-project-snapshot-state',
    /^(fresh|refresh-failed|unavailable)$/,
  );
  await expect(page.locator('[data-project-active-tab="invoices"]:visible')).toHaveCount(1);
  await expect(page.locator('[data-project-commercial-view="invoices"]:visible')).toHaveCount(1);
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(page.locator('[data-project-commercial-view="invoices"]:visible'));
  await capture(page, 'project-detail-invoices', '1440x1000');
});
