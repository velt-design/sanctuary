import { expect, test } from '@playwright/test';

const route = '/__foundation/marketing/evolution';

for (const width of [360, 390, 640, 768, 1440]) {
  test(`foundation studies are usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(route);
    await expect(page.getByRole('heading', { name: 'A quieter kind of presence.' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.getByRole('button', { name: 'Menu', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('background-color', 'rgb(248, 248, 245)');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Menu', exact: true }).first()).toBeFocused();
    await page.getByRole('button', { name: 'Menu', exact: true }).first().click();
    await page.getByRole('link', { name: '02 Choose a material' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#material-study')).toBeFocused();
    await page.getByRole('radio', { name: '02 Timber sarking' }).check();
    await expect(page.getByRole('heading', { name: 'Bring warmth overhead.' })).toBeVisible();
    await page.getByRole('radio', { name: 'Expressive', exact: true }).check();
    await expect(page.getByRole('radio', { name: '02 Timber sarking' })).toBeChecked();
    await page.getByText('What would we resolve together?', { exact: true }).click();
    await expect(page.getByText('Roof form, connection to the house', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Replay image arrival' }).click();
    await expect(page.locator('#project-image-study')).toBeInViewport();
    if (width <= 640) {
      const card = page.locator('#project-image-study [data-editorial-card]');
      await expect(card.locator('figure')).toHaveCSS('transform', 'none');
      const cardBox = await card.boundingBox();
      const mediaBox = await card.locator('figure').boundingBox();
      const copyBox = await card.locator('[data-editorial-card-content]').boundingBox();
      expect(mediaBox!.width).toBeGreaterThan(cardBox!.width * .95);
      expect(copyBox!.y).toBeGreaterThanOrEqual(mediaBox!.y + mediaBox!.height - 1);
    }
    await page.getByRole('link', { name: /WARKWORTH, AUCKLAND.*Explore the project/i }).click();
    await page.getByRole('button', { name: 'Next image in Warkworth project study' }).click();
    await expect(page.getByText('Image 2 of 2', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Previous image in Warkworth project study' }).click();
    await expect(page.getByText('Image 1 of 2', { exact: true })).toBeVisible();
    await expect.poll(() => page.locator('main').evaluate(el => el.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const controls = await page.locator('main button:visible').evaluateAll(elements => elements.map(el => ({ label: el.textContent, height: el.getBoundingClientRect().height })));
    expect(controls.filter(control => control.height < 44)).toEqual([]);
    await page.getByRole('radio', { name: 'Expressive', exact: true }).focus();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/marketing-foundation-evolution/studies-${width}.png`, fullPage: true });
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Quiet', exact: true })).toBeChecked();
    await expect(page.getByRole('radio', { name: '01 Acrylic roofing' })).toBeChecked();
  });
}

test('motion controls respect both manual and device reduction', async ({ page }) => {
  await page.goto(route);
  await page.getByRole('radio', { name: 'Expressive', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Reduce motion' }).check();
  await page.getByRole('button', { name: 'Menu', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toHaveCSS('animation-duration', '0s');
  await page.keyboard.press('Escape');
  await page.getByRole('checkbox', { name: 'Reduce motion' }).uncheck();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Menu', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toHaveCSS('animation-duration', '0s');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '01 Explore the work' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('link', { name: '03 Navigate with clarity' })).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Replay image arrival' }).click();
  await expect(page.locator('#project-image-study figure').first()).toHaveCSS('animation-duration', '0s');
});

test('catalogue exposes studies and server markup stays readable without JavaScript', async ({ browser, page }) => {
  await page.goto('/__foundation/marketing');
  await page.getByRole('link', { name: 'Explore the new foundation studies' }).click();
  await expect(page).toHaveURL(new RegExp(`${route}$`));
  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  await plain.goto(new URL(route, page.url()).href);
  await expect(plain.getByRole('heading', { name: 'A quieter kind of presence.' })).toBeVisible();
  await expect(plain.getByRole('link', { name: /Explore the project/i })).toBeVisible();
  await plain.getByText('What would we resolve together?', { exact: true }).click();
  await expect(plain.getByText('Roof form, connection to the house', { exact: false })).toBeVisible();
  await context.close();
});
