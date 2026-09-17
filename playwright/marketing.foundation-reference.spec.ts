import { expect, test } from '@playwright/test';

const root = '/__foundation/marketing/evolution';
for (const width of [360, 390, 768, 1440]) {
  for (const surface of ['project', 'product']) {
    test(`${surface} reference at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/api/enquiry', route => route.abort());
      await page.goto(`${root}/${surface}`);
      await expect(page.locator('h1')).toHaveText(surface === 'project' ? 'Warkworth Outdoor Room' : 'Gable pergola');
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect.poll(() => page.locator('main img').first().evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      if (width <= 760) {
        await page.getByRole('button', { name: 'Menu', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(250, 250, 246)');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
      }
      if (surface === 'project') {
        await page.getByRole('link', { name: 'Discover the project' }).click();
        await expect(page.getByRole('heading', { name: 'A room beside the house.' })).toBeInViewport();
        await page.getByText('Structure & finish', { exact: true }).last().click();
        await expect(page.getByText('Engineering PS1 provided', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Next image in Warkworth outdoor room' }).click();
        await expect(page.getByText('Image 2 of 7', { exact: true })).toBeVisible();
      } else {
        await page.getByRole('link', { name: 'Explore roof approaches' }).click();
        await page.getByRole('radio', { name: /02 Solid/ }).check();
        await expect(page).toHaveURL(/roof=solid/);
        await expect(page.getByText('Solid roofing', { exact: true })).toBeVisible();
        await page.getByText('Installation and maintenance', { exact: true }).click();
        await expect(page.getByText(/Cleaning and inspection follow/)).toBeVisible();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `artifacts/marketing-foundation-evolution/reference-${surface}-${width}.png`, fullPage: true });
      const cta = page.getByRole('link', { name: surface === 'project' ? 'Send your project brief' : 'Discuss a gable pergola' });
      await cta.click();
      await expect(page).toHaveURL(new RegExp(`/contact\\?.*source_${surface}=${surface === 'project' ? 'warkworth-outdoor-room' : 'gable'}`));
      await expect(page.locator('#contact-form')).toBeVisible();
      await page.goBack();
      await expect(page.locator('h1')).toHaveText(surface === 'project' ? 'Warkworth Outdoor Room' : 'Gable pergola');
      if (surface === 'product') await expect(page.getByRole('radio', { name: /02 Solid/ })).toBeChecked();
    });
  }
}

test('settings and roof exploration survive cross-page navigation and reload', async ({ page }) => {
  await page.goto(`${root}/product`);
  await page.getByRole('radio', { name: /03 Combination/ }).check();
  await page.getByText('Review settings', { exact: true }).click();
  await page.getByRole('radio', { name: 'Expressive', exact: true }).check();
  await page.getByRole('radio', { name: 'Split', exact: true }).check();
  await page.getByText('Review settings', { exact: true }).click();
  await page.getByRole('link', { name: 'Explore Warkworth Outdoor Room' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-composition', 'split');
  await expect(page.locator('main')).toHaveAttribute('data-motion', 'expressive');
  await page.getByRole('link', { name: /Explore gable pergolas/i }).click();
  await expect(page.getByRole('radio', { name: /03 Combination/ })).toBeChecked();
  await page.reload();
  await expect(page.getByRole('radio', { name: /03 Combination/ })).toBeChecked();
  await page.getByRole('radio', { name: /01 Acrylic/ }).press('ArrowRight');
  await expect(page.getByRole('radio', { name: /02 Solid/ })).toBeChecked();
});

test('project compositions retain readable mobile and desktop geometry', async ({ page }) => {
  for (const width of [390, 1440]) for (const composition of ['editorial', 'split']) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${root}/project?composition=${composition}`);
    const title = await page.locator('h1').boundingBox();
    const image = await page.locator('main figure').first().boundingBox();
    expect(title!.x).toBeGreaterThanOrEqual(0);
    expect(title!.x + title!.width).toBeLessThanOrEqual(width);
    if (width === 390 || composition === 'editorial') expect(image!.y).toBeGreaterThan(title!.y + title!.height);
    else expect(image!.x).toBeGreaterThan(title!.x + title!.width);
    await expect.poll(() => page.locator('main img').first().evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: `artifacts/marketing-foundation-evolution/composition-${composition}-${width}.png` });
  }
});

test('reference reduced motion, short viewport and menu keyboard boundary', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${root}/product?motion=expressive`);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('animation-duration', '0s');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link', { name: 'Start your project' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('radio', { name: /03 Combination/ }).check();
  await expect(page.locator('main')).toHaveAttribute('data-motion', 'expressive');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('reference product keeps roof information and disclosures available without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}${root}/product`);
  await expect(page.getByRole('heading', { name: 'Gable pergola', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: /03 Combination/ })).toBeHidden();
  await expect(page.getByText(/^Combination: Solid and acrylic roof zones/)).toBeVisible();
  await page.getByText('Installation and maintenance', { exact: true }).click();
  await expect(page.getByText(/Cleaning and inspection follow/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Explore Warkworth Outdoor Room/ })).toBeVisible();
  await context.close();
});

test('mobile roof comparison keeps all choices beside the visible result', async ({ page }) => {
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${root}/product`);
    const options = page.getByRole('group', { name: 'Compare roof approaches' });
    await options.scrollIntoViewIfNeeded();
    for (const name of [/01 Acrylic/, /02 Solid/, /03 Combination/]) {
      await page.getByRole('radio', { name }).check();
      await expect(page.getByRole('radio', { name }).locator('..')).toHaveCSS('background-color', 'rgb(24, 26, 23)');
      const label = await page.getByRole('radio', { name }).locator('..').locator('span').nth(1).boundingBox();
      expect(label!.height).toBeLessThan(25);
      const controls = await options.boundingBox();
      const image = await page.locator('#roof-approaches figure').boundingBox();
      expect(controls!.height).toBeLessThan(120);
      expect(image!.y - (controls!.y + controls!.height)).toBeLessThan(35);
      expect(image!.y).toBeLessThan(700);
    }
    await expect(page.getByRole('heading', { name: 'Resolve the whole picture.' })).toBeVisible();
    await page.screenshot({ path: `artifacts/marketing-foundation-evolution/roof-corrected-${width}.png` });
  }
});

test('editorial fact rules meet and specifications retain full-width rows', async ({ page }) => {
  for (const width of [360, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${root}/project?composition=editorial&motion=quiet`);
    const rail = page.locator('main dl').first();
    const cells = await rail.locator(':scope > div').evaluateAll(elements => elements.map(el => {
      const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    }));
    const columns = width <= 760 ? 2 : 4;
    for (let i = 1; i < cells.length; i++) {
      if (i % columns) expect(Math.abs(cells[i].x - cells[i - 1].right)).toBeLessThan(1);
      else expect(Math.abs(cells[i].y - cells[i - columns].bottom)).toBeLessThan(1);
    }
    const facts = page.locator('#project-details dl');
    const configurationLabel = await facts.getByText('Configuration', { exact: true }).boundingBox();
    expect(configurationLabel!.height).toBeLessThan(20);
    const bounds = await facts.boundingBox();
    for (const row of await facts.locator(':scope > div').all()) {
      const box = await row.boundingBox();
      expect(Math.abs(box!.width - bounds!.width)).toBeLessThan(1);
      await expect(row).toHaveCSS('margin-right', '0px');
      await expect(row).toHaveCSS('border-right-width', '0px');
    }
    await facts.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/marketing-foundation-evolution/editorial-details-${width}.png` });
    await rail.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/marketing-foundation-evolution/editorial-rules-${width}.png` });
  }
});
