import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });

const families = [
  ['/', '[data-project-evidence]'],
  ['/pergola-guides', '[data-guide-card]'],
  ['/products', '[data-product-option-gateway] li'],
  ['/products', 'a[aria-label^="View project:"]'],
  ['/products/pergolas/gable', 'li:has(a[aria-label^="Read guide:"])'],
  ['/products/pergolas/gable', 'div[class*="bridgeGrid"]'],
  ['/products', 'a[aria-label^="Explore "]'],
  ['/projects', '[data-project-card]'],
  ['/acrylic-roof-pergolas-auckland', '.acrylic-project-card'],
] as const;

for (const width of [390, 1440]) {
  test(`whole-card hit areas, keyboard and responsive layout at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [route, selector] of families) {
      await page.goto(route);
      const card = page.locator(selector).first();
      await expect(card).toBeVisible();
      const link = card.locator('a').first();
      const target = await card.evaluate(el => el.matches('a') ? el.getAttribute('href') : el.querySelector('a')?.getAttribute('href'));
      expect(target, `${route} ${selector}`).toBeTruthy();
      expect(await card.locator('a,button,input,select,textarea,[tabindex="0"]').count()).toBe(await card.evaluate(el => el.matches('a')) ? 0 : 1);
      // Real pointer dispatch: the extended native anchor must receive all three clicks.
      await page.evaluate(() => {
        (window as any).__cardClicks = [];
        document.addEventListener('click', e => {
          e.preventDefault();
          (window as any).__cardClicks.push((e.target as Element).closest('a')?.getAttribute('href'));
        }, true);
      });
      for (const point of [[.15, .15], [.5, .55], [.92, .95]]) {
        const box = await card.boundingBox();
        await card.click({ position: { x: box!.width * point[0], y: box!.height * point[1] } });
      }
      expect(await page.evaluate(() => (window as any).__cardClicks)).toEqual([target, target, target]);
      const anchor = await card.evaluate(el => el.matches('a')) ? card : link;
      await page.keyboard.press('Tab');
      await anchor.focus();
      await expect(anchor).toBeFocused();
      expect(await anchor.evaluate(el => [getComputedStyle(el).outlineStyle, getComputedStyle(el, '::before').outlineStyle].some(x => x === 'solid'))).toBe(true);
      const focusedHitArea = await anchor.evaluate(el => {
        const pseudo = getComputedStyle(el, '::before');
        return el.className.includes('hitLink') ? { width: parseFloat(pseudo.width), height: parseFloat(pseudo.height) } : null;
      });
      if (focusedHitArea) {
        const bounds = await card.boundingBox();
        expect(focusedHitArea.width).toBeGreaterThanOrEqual(bounds!.width - 2.1);
        expect(focusedHitArea.height).toBeGreaterThanOrEqual(bounds!.height - 2.1);
      }
      await page.keyboard.press('Tab');
      expect(await card.evaluate(el => el.contains(document.activeElement))).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  });
}

for (const analytics of [false, true]) {
  test(`homepage image click preserves context and analytics consent=${analytics}`, async ({ page }) => {
    await page.route('https://www.googletagmanager.com/**', route => route.abort());
    await page.addInitScript(allowed => {
      localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: allowed, marketing: false, updatedAt: new Date().toISOString(), version: 1 }));
      (window as any).dataLayer = [];
    }, analytics);
    await page.goto('/?project=bespoke', { waitUntil: 'domcontentloaded' });
    const card = page.locator('[data-project-evidence]').first();
    const anchor = card.locator('a');
    const href = await anchor.getAttribute('href');
    await page.evaluate(() => document.addEventListener('click', e => e.preventDefault(), true));
    await card.click({ position: { x: 30, y: 30 } });
    const events = await page.evaluate(() => ((window as any).dataLayer ?? []).filter((e: any) => e.event === 'project_view_click'));
    expect(events).toHaveLength(analytics ? 1 : 0);
    expect(href).toContain('/projects/');
    expect(href).toContain('project=bespoke');
    if (analytics) { expect(events[0].source_component).toBe('project_card'); expect(events[0].project_direction).toBe('bespoke'); }
  });
}

test('native navigation, new tab, no-JS and separate continuation control', async ({ browser, page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  const card = page.locator('[data-project-evidence]').first();
  const href = await card.locator('a').getAttribute('href');
  const popupPromise = page.context().waitForEvent('page');
  await card.click({ position: { x: 25, y: 25 }, modifiers: ['Control'] });
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup).toHaveURL(new RegExp(new URL(href!, page.url()).pathname));
  await popup.close();
  await card.click({ position: { x: 25, y: 25 } });
  await expect(page).toHaveURL(new RegExp(new URL(href!, page.url()).pathname));
  await page.goBack();
  await expect(page.locator('[data-project-evidence]').first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/products');
  const bar = page.getByRole('complementary', { name: 'Your pergola design' });
  await expect(bar.locator('a svg[aria-hidden="true"]')).toBeVisible();
  await bar.getByRole('button', { name: 'Dismiss design bar' }).click();
  await expect(bar).toHaveCount(0);
  await expect(page).toHaveURL(/\/products$/);
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const plain = await context.newPage();
  await plain.goto('/pergola-guides');
  const guide = plain.locator('[data-guide-card]').first();
  const destination = await guide.locator('a').getAttribute('href');
  await guide.click({ position: { x: 20, y: 20 } });
  await expect(plain).toHaveURL(new RegExp(destination!));
  await context.close();
});

test('configurator decorative SVG arrows stay inline and retain mobile actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
  await page.route('**/api/configurator-price', route => route.fulfill({ json: { status: 'disabled' } }));
  await page.goto('/configurator-preview?open=1');
  const expand = page.getByRole('button', { name: 'Expand view', exact: true });
  await expect(expand.locator('svg[aria-hidden="true"]')).toBeVisible();
  await expand.click();
  await expect(page.getByRole('button', { name: 'Close expanded view', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Close expanded view', exact: true }).click();
  await page.getByRole('button', { name: '2 Personalise', exact: true }).click();
  for (const name of ['Roof & ceiling', 'Sides & privacy', 'Lighting']) {
    const option = page.getByRole('button', { name: new RegExp(`^${name}`) });
    await expect(option.locator('strong svg[aria-hidden="true"]')).toBeAttached();
    const inline = await option.locator('strong svg').evaluate(el => {
      const icon = el.getBoundingClientRect();
      const text = el.closest('strong')!.getBoundingClientRect();
      return getComputedStyle(el).display === 'inline-block' && icon.top >= text.top - 1 && icon.bottom <= text.bottom + 1;
    });
    expect(inline).toBe(true);
  }
  await page.getByRole('button', { name: /^Roof & ceiling/ }).click();
  await expect(page.getByRole('button', { name: /Back to Personalise/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /Back to Personalise/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Make it yours.' })).toBeVisible();
  expect(await page.locator('body').textContent()).not.toContain('↗');
});
