import { expect, test, type Page } from '@playwright/test';
import { projects } from '../apps/marketing/data/projects';

const representativeRoute = `/projects/${projects[0].slug}`;
const publicOrigin = 'https://www.sanctuarypergolas.co.nz';

async function dismissConsent(page: Page) {
  const essentialOnly = page.getByRole('button', { name: 'Essential only' });
  if (await essentialOnly.count() && await essentialOnly.isVisible()) {
    await essentialOnly.click();
  }
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.documentClientWidth);
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.bodyClientWidth);
}

test('projects index preserves a canonical collection route and legacy query selection', async ({ page }) => {
  await page.goto(`/projects?slug=${projects[3].slug}`);

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('Pergola projects and case studies');
  await expect(page.locator('[data-project-case-study]')).toHaveAttribute(
    'data-project-case-study',
    projects[3].slug,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${publicOrigin}/projects`,
  );

  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const parsedSchemas = schemas.flatMap((schema) => {
    const parsed = JSON.parse(schema);
    return Array.isArray(parsed) ? parsed : [parsed];
  });
  expect(parsedSchemas.some((schema) => schema['@type'] === 'CollectionPage')).toBe(true);
  expect(parsedSchemas.some((schema) => schema['@type'] === 'ItemList')).toBe(true);
});

test('every canonical project remains discoverable in the public sitemap', async ({ page }) => {
  await page.goto('/sitemap.xml');
  const sitemap = page.locator('body');

  for (const project of projects) {
    await expect(sitemap).toContainText(`${publicOrigin}/projects/${project.slug}`);
  }
});

test('every canonical project route has complete case-study structure, metadata, and a loaded hero', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  for (const project of projects) {
    await page.goto(`/projects/${project.slug}`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-project-case-study]')).toHaveAttribute(
      'data-project-case-study',
      project.slug,
    );
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(project.title);
    await expect(page).toHaveTitle(new RegExp(project.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${publicOrigin}/projects/${project.slug}`,
    );
    await expect(page.locator('.project-case-study__intro-copy')).toContainText(project.blurb);
    await expect(page.locator('.project-case-study__story')).toContainText(project.constraint);
    await expect(page.locator('.project-case-study')).toContainText(project.roofApproach);
    await expect(page.locator('.project-case-study__fact-list dt')).not.toHaveCount(0);
    expect(
      await page.locator('.project-case-study__fact-list dd').evaluateAll(
        (elements) => elements.every((element) => Boolean(element.textContent?.trim())),
      ),
    ).toBe(true);

    const hero = page.locator('.project-case-study__hero img');
    await expect(hero).toBeVisible();
    await expect.poll(
      () => hero.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    ).toBe(true);
  }

  expect(pageErrors).toEqual([]);
});

test('known data gaps are omitted instead of becoming invented or empty facts', async ({ page }) => {
  await page.goto('/projects/velskov-forest');
  await expect(page.locator('.project-case-study__fact-list')).not.toContainText('Completed');
  await expect(page.locator('.project-case-study__fact-list')).not.toContainText('Structure finish');
  await expect(page.locator('.project-case-study__fact-list')).not.toContainText('Configuration');

  await page.goto('/projects/tindalls-bay-pavilion');
  await expect(page.locator('.project-case-study__fact-list')).toContainText('Covered area');
  await expect(page.locator('.project-case-study__fact-list')).not.toContainText('Footprint');

  await page.goto('/projects/warkworth-outdoor-room');
  await expect(page.locator('.project-case-study__fact-list')).toContainText('Freestanding');
});

test('long project labels and partial dimensions remain readable at the minimum width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/projects/tindalls-bay-pavilion');
  await dismissConsent(page);

  await expect(page.locator('h1')).toHaveText('Tindalls Bay - Patio & Carport');
  await expect(page.locator('.project-navigator__trigger-title')).toHaveText(
    'Tindalls Bay - Patio & Carport',
  );
  await expect(page.locator('.project-case-study__fact-list')).toContainText('Covered area');
  await expect(page.locator('.project-case-study__fact-list')).not.toContainText('Dimensions');
  await expectNoPageOverflow(page);
});

for (const viewport of [
  { name: 'wide desktop', width: 1440, height: 1000 },
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'compact desktop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 430, height: 932 },
  { name: 'small mobile', width: 390, height: 844 },
  { name: 'minimum mobile', width: 360, height: 800 },
]) {
  test(`project composition has no page overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(representativeRoute);
    await dismissConsent(page);
    await expect(page.locator('.project-case-study')).toBeVisible();
    await expectNoPageOverflow(page);

    if (viewport.width >= 900) {
      await expect(page.locator('.project-navigator__panel')).toBeVisible();
      await expect(page.locator('.project-navigator__trigger')).toBeHidden();
    } else {
      await expect(page.locator('.project-navigator__trigger')).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });
}

test('desktop navigator filters projects, remains sticky, and supports list keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(representativeRoute);
  await dismissConsent(page);

  const navigatorPanel = page.locator('.project-navigator__panel');
  const initialTop = (await navigatorPanel.boundingBox())?.y ?? 0;
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(async () => (await navigatorPanel.boundingBox())?.y ?? -1).toBeGreaterThan(80);
  expect((await navigatorPanel.boundingBox())?.y ?? 0).toBeLessThanOrEqual(initialTop);

  const activeProject = page.locator('.project-navigator__list a[aria-current="page"]');
  await activeProject.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.project-navigator__list a').nth(1)).toBeFocused();

  await page.locator('.project-navigator__filters select').first().selectOption('Commercial');
  const visibleLabels = page.locator('.project-navigator__list small');
  expect(await visibleLabels.count()).toBeGreaterThan(0);
  for (const label of await visibleLabels.allTextContents()) {
    expect(label).toContain('Commercial');
  }
});

test('mobile navigator is a focus-managed modal sheet with reversible scroll lock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(representativeRoute);
  await dismissConsent(page);

  const trigger = page.locator('.project-navigator__trigger');
  await trigger.click();
  const dialog = page.getByRole('dialog');

  await expect(dialog).toBeVisible();
  await expect(page.locator('.project-navigator__close')).toBeFocused();
  await expect(page.locator('html')).toHaveClass(/projects-navigator-open/);
  await expect(page.locator('body')).toHaveClass(/projects-navigator-open/);
  await expect.poll(async () => (await dialog.boundingBox())?.y ?? 900).toBeLessThan(200);

  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');

  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('html')).not.toHaveClass(/projects-navigator-open/);
  await expect(page.locator('body')).not.toHaveClass(/projects-navigator-open/);
});

test('technical detail, contextual links, related work, and circular project navigation remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(representativeRoute);
  await dismissConsent(page);

  const technical = page.locator('.project-case-study__technical details');
  await expect(technical).not.toHaveAttribute('open', '');
  await technical.locator('summary').click();
  await expect(technical).toHaveAttribute('open', '');
  await expect(technical.locator('.project-case-study__technical-grid')).toBeVisible();

  await expect(page.locator('.project-case-study__related-list a')).not.toHaveCount(0);
  await expect(page.locator('.project-case-study__pagination a')).toHaveCount(2);
  await expect(page.locator('.project-case-study__intro-actions a')).not.toHaveCount(0);
});

test('mobile gallery responds to a touch drag without moving the page sideways', async ({ browser }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL);
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(representativeRoute);
  await dismissConsent(page);

  const gallery = page.locator('.project-case-study__gallery');
  await gallery.scrollIntoViewIfNeeded();
  const box = await gallery.boundingBox();
  expect(box).not.toBeNull();

  const startX = (box?.x ?? 0) + Math.min((box?.width ?? 390) - 24, 340);
  const endX = startX - 220;
  const y = Math.max(150, Math.min(780, (box?.y ?? 150) + 240));
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: endX, y }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  await expect.poll(() => gallery.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expectNoPageOverflow(page);
  await context.close();
});

test('reduced-motion preference removes material project transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(representativeRoute);
  await dismissConsent(page);

  const duration = await page.locator('.project-navigator__panel').evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  const seconds = duration
    .split(',')
    .map((value) => value.trim())
    .map((value) => value.endsWith('ms')
      ? Number.parseFloat(value) / 1000
      : Number.parseFloat(value));
  expect(Math.max(...seconds)).toBeLessThanOrEqual(0.001);
});
