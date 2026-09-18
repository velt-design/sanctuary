import { expect, test, type Page } from '@playwright/test';

const next = async (page: Page, name: string) => { if(name.startsWith('Edit ') && !await page.getByRole('button',{name,exact:false}).isVisible()) await page.getByText('Edit design',{exact:true}).click(); await page.getByRole('button', { name, exact: false }).click(); };
async function toModel(page: Page) {
  await next(page, 'Choose your roof');
  await next(page, 'Set your size');
  await next(page, 'See your pergola');
  await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-mobile-step', 'explore');
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/enquiry', route => route.abort());
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: '2026-09-18T00:00:00.000Z', version: 1 })));
});

test('grouped sides apply deliberately, preserve refinements and survive review reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/configurator-preview?open=1'); await toModel(page);
  await next(page, 'Add sides & lighting'); await next(page, 'Sides & privacy');
  for (const name of ['Front 1', 'Front 2']) await page.getByRole('checkbox', { name: new RegExp(name) }).check();
  await expect(page.getByRole('status')).toContainText('2 openings selected');
  await next(page, 'Choose treatment');
  const image = page.locator('figure img');
  const bounds = await image.boundingBox();
  for (const name of ['Timber', 'Aluminium', 'Blind', 'Acrylic', 'Open']) {
    await page.getByRole('radio', { name, exact: true }).check();
    await image.evaluate((el: HTMLImageElement) => el.decode());
    expect(await image.boundingBox()).toEqual(bounds);
  }
  await page.getByRole('radio', { name: 'Timber', exact: true }).check();
  await next(page, 'Apply to 2 openings');
  await expect(page.locator('[data-side-panel-count]')).toHaveAttribute('data-side-panel-count', '2');
  await page.getByText('Refine individual sides', { exact: true }).click();
  await page.getByText('Refine your screen finish', { exact: true }).click();
  await page.getByRole('radio', { name: 'Horizontal', exact: true }).check();
  await next(page, 'Choose more sides');
  for (const name of ['Front 1', 'Left 1']) await page.getByRole('checkbox', { name: new RegExp(name) }).check();
  await next(page, 'Choose treatment');
  await expect(page.getByRole('heading', { name: 'Different finishes selected' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply to 2 openings' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Blind', exact: true }).check();
  await next(page, 'Back'); // browsing a choice must not write it
  await expect(page.getByRole('checkbox', { name: /Front 1.*Timber/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Left 1.*Open/ })).toBeChecked();
  await next(page, 'Choose treatment');
  await page.getByRole('radio', { name: 'Timber', exact: true }).check();
  await next(page, 'Apply to 2 openings');
  await expect(page.locator('[data-side-panel-count]')).toHaveAttribute('data-side-panel-count', '3');
  await page.getByText('Refine individual sides', { exact: true }).click();
  await page.getByText('Refine your screen finish', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Horizontal', exact: true })).toBeChecked();
  await next(page, 'Done'); await next(page, 'See your finished design'); await next(page, 'Review your design');
  await page.reload();
  await expect(page.locator('[data-design-portrait]')).toHaveAttribute('data-design-portrait', 'captured');
  await expect(page.getByRole('region', { name: 'Review your design', includeHidden: true })).toContainText('ThermoPine');
});

test('mobile controls stay simple, native slider works and lighting camera stays still', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/configurator-preview?open=1');
  await next(page, 'Choose your roof'); await next(page, 'Set your size');
  const position = await page.getByRole('radio', { name: 'Attached', exact: true }).boundingBox();
  const level = await page.getByRole('radio', { name: 'Ground', exact: true }).boundingBox();
  expect(position!.y).toBeLessThan(level!.y);
  const slider = page.getByRole('slider', { name: 'Width', exact: true });
  await expect(slider).toHaveCSS('opacity', '0');
  await slider.focus(); await slider.press('ArrowRight');
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('6.1');
  expect(await slider.evaluate(el => getComputedStyle(el.parentElement!, '::before').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await next(page, 'See your pergola'); await next(page, 'Add sides & lighting');
  await expect(page.getByRole('button', { name: /Lighting For evenings/ }).locator('svg')).toBeVisible();
  await next(page, 'Lighting');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera', /perspective/);
  const readCamera = () => page.locator('canvas').evaluate(el => {
    const value = JSON.parse(el.getAttribute('data-camera')!);
    return [...value.position, ...value.target, value.distance].map((n: number) => Math.round(n * 1000) / 1000);
  });
  const camera = await readCamera();
  for (const name of ['A gentle glow', 'More light', 'No lighting']) {
    await next(page, name);
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night', 'true');
    expect(await readCamera()).toEqual(camera);
    await expect(page.getByRole('group', { name: 'Choose view' })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Time of day' })).toHaveCount(0);
  }
  await next(page, 'Done'); await next(page, 'Continue without extras');
  await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night', 'false');
  await expect(page.getByRole('group', { name: 'Choose view' })).toHaveCount(0);
});

for (const [width, projection] of [[6, 3], [1.5, 6], [10, 1.5]]) test(`opening plan touch targets stay distinct for ${width}x${projection}`, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/configurator-preview?open=1');
  await next(page, 'Choose your roof'); await next(page, 'Set your size');
  for (const [name, value] of [['Width', width], ['Projection', projection]] as const) {
    const field = page.getByRole('textbox', { name: `${name} in metres` });
    await field.fill(String(value)); await field.press('Enter');
  }
  await next(page, 'See your pergola'); await next(page, 'Add sides & lighting'); await next(page, 'Sides & privacy');
  const labels = page.locator('[data-guided="true"] [class*="label"]');
  await expect(labels.first()).toBeVisible();
  await expect.poll(() => labels.evaluateAll(nodes => {
    const boxes = nodes.map(node => node.querySelector('rect')!.getBoundingClientRect());
    const svg = nodes[0].closest('svg')!.getBoundingClientRect();
    return nodes.every((node, index) => getComputedStyle(node).opacity === '1' && boxes[index].height >= 43.9
      && boxes[index].left >= svg.left && boxes[index].right <= svg.right && boxes[index].top >= svg.top && boxes[index].bottom <= svg.bottom)
      && boxes.every((a, i) => boxes.every((b, j) => i === j || a.right <= b.left + .1 || b.right <= a.left + .1 || a.bottom <= b.top + .1 || b.bottom <= a.top + .1));
  })).toBe(true);
  const left = page.getByRole('button', { name: 'Select Left 1 opening' });
  await left.focus(); await left.press('Enter');
  await expect(left).toHaveAttribute('aria-pressed', 'true');
  await next(page, 'Choose treatment');
  await expect(page.locator('[data-side-phase]')).toHaveAttribute('data-side-phase', 'finish');
});

test('lit design returns to daylight review with visible exclusions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/configurator-preview?open=1'); await toModel(page);
  for (const name of ['Add sides & lighting', 'Lighting', 'A gentle glow', 'Done', 'See your finished design']) await next(page, name);
  await page.waitForTimeout(1300);
  await next(page, 'Review your design');
  const colours = await page.locator('[data-mobile-step]').evaluate(async element => {
    const samples = new Set<string>();
    const start = performance.now();
    while (performance.now() - start < 2500) {
      samples.add(getComputedStyle(element).backgroundColor);
      await new Promise(requestAnimationFrame);
    }
    return [...samples];
  });
  expect(colours).toEqual(['rgb(241, 240, 235)']);
  const portrait = page.locator('[data-design-portrait]');
  await expect(portrait).toHaveAttribute('data-design-portrait', 'captured');
  await expect(portrait).toHaveAttribute('data-portrait-night', 'false');
  expect(await portrait.evaluate(el => getComputedStyle(el, '::before').opacity)).toBe('0');
  await expect(page.getByText(/Travel and site-specific work excluded/)).toBeVisible();
  await portrait.locator('img').evaluate((el: HTMLImageElement) => el.decode());
  await page.screenshot({ path: 'artifacts/mobile-configurator/pass4-review-night-corrected.png' });
});

test('review retains live design when snapshot capture is unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
      if (type === 'image/webp') throw new Error('Capture unavailable');
      return original.call(this, type, quality);
    };
  });
  await page.goto('/configurator-preview?open=1'); await toModel(page);
  await next(page, 'Add sides & lighting'); await next(page, 'Continue without extras'); await next(page, 'Review your design');
  await expect(page.locator('[data-design-portrait] canvas')).toBeVisible();
  await page.waitForTimeout(1800);
  await expect(page.locator('[data-design-portrait]')).toHaveAttribute('data-design-portrait', 'preview');
  await expect(page.getByRole('button', { name: 'Enquire', exact: true })).toBeVisible();
  await page.locator('[data-mobile-step]').getByRole('button', { name: 'Explore your design' }).click();
  await expect(page.getByRole('heading', { name: 'Picture yourself here.' })).toBeVisible();
});

test('guided site choices, visual sides and open review breakdown', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/configurator-preview?open=1');
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  await page.getByRole('radio', { name: 'Extending', exact: true }).check();
  await page.getByRole('radio', { name: 'Parallel', exact: true }).check();
  await page.screenshot({ path: 'artifacts/mobile-configurator/pass4-shape.png' });
  await next(page, 'Choose your roof');
  await page.getByRole('radio', { name: 'Solid', exact: true }).check();
  await page.getByAltText('Warm timber ceiling beneath a solid pergola roof, viewed from below').evaluate((image: HTMLImageElement) => image.decode());
  await page.screenshot({ path: 'artifacts/mobile-configurator/pass3-solid.png' });
  await next(page, 'Set your size');
  await expect(page.getByRole('group', { name: 'Choose view' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Time of day' })).toHaveCount(0);
  await expect(page.locator('[data-mobile-footprint]')).toBeVisible();
  await page.getByRole('radio', { name: 'Elevated', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Extending', exact: true })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Elevated', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Freestanding', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Freestanding', exact: true })).toBeChecked();
  await expect(page.locator('[data-mobile-footprint] > rect')).toHaveCount(6);
  await page.getByRole('radio', { name: 'Attached', exact: true }).check();
  await page.getByRole('radio', { name: 'Ground', exact: true }).check();
  await page.getByRole('radio', { name: 'Ground', exact: true }).evaluate(el => el.closest('[class*="content"]')!.scrollTop = 0);
  await page.screenshot({ path: 'artifacts/mobile-configurator/pass4-size.png' });
  await next(page, 'See your pergola');
  await next(page, 'Back');
  await expect(page.locator('[data-mobile-footprint]')).toBeVisible();
  await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night', 'false');
  await next(page, 'See your pergola'); await next(page, 'Add sides & lighting'); await next(page, 'Sides & privacy');
  await expect(page.getByRole('button', { name: 'Choose treatment' })).toBeDisabled();
  await page.getByRole('button', { name: 'Select Front 1 opening', exact: true }).click();
  await page.screenshot({ path: 'artifacts/mobile-configurator/pass4-opening.png' });
  await next(page, 'Choose treatment');
  await page.getByRole('radio', { name: 'Timber', exact: true }).check();
  await next(page, 'Apply to 1 opening');
  await expect(page.locator('[data-side-panel-count]')).toHaveAttribute('data-side-panel-count', '1');
  await page.getByText('Refine individual sides', { exact: true }).click();
  await page.getByText('Refine your screen finish', { exact: true }).click();
  await page.getByRole('radio', { name: 'Horizontal', exact: true }).check();
  await page.getByText('Refine your screen finish', { exact: true }).click();
  await next(page, 'Choose more sides');
  await page.getByRole('button', { name: 'Select Front 2 opening', exact: true }).click();
  await next(page, 'Choose treatment');
  await page.getByRole('radio', { name: 'Blind', exact: true }).check();
  await next(page, 'Apply to 1 opening');
  await expect(page.locator('[data-blind-count]')).toHaveAttribute('data-blind-count', '1');
  await next(page, 'Choose more sides');
  await page.getByRole('button', { name: 'Select Front 1 opening', exact: true }).click();
  await next(page, 'Choose treatment');
  await expect(page.getByRole('radio', { name: 'Timber', exact: true })).toBeChecked();
  await next(page, 'Apply to 1 opening');
  await page.getByText('Refine individual sides', { exact: true }).click();
  await page.getByText('Refine your screen finish', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Horizontal', exact: true })).toBeChecked();
  await page.getByText('Refine your screen finish', { exact: true }).click();
  await page.locator('[data-side-phase]').evaluate(el => el.closest('[class*="content"]')!.scrollTop = 0);
  await page.screenshot({ path: 'artifacts/mobile-configurator/pass4-sides.png' });
  await next(page, 'Done'); await next(page, 'See your finished design');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera', /perspective/);
  await page.screenshot({ path: 'artifacts/mobile-configurator/pass4-finished.png' });
  await next(page, 'Review your design');
  await expect(page.locator('[data-design-portrait]')).toHaveAttribute('data-design-portrait', 'captured');
  const portraitBefore = await page.getByAltText('Your configured pergola, with your selected roof and sides').getAttribute('src');
  const breakdown = page.getByRole('region', { name: 'Your price breakdown', exact: true });
  await expect(breakdown).toBeVisible();
  await expect(breakdown.locator('dl')).toBeVisible();
  await expect(page.getByText('See price breakdown · including GST', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/mobile-configurator/pass4-review.png' });
  await next(page, 'Edit Size & structure');
  await expect(page.getByRole('radio', { name: 'Attached', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Ground', exact: true })).toBeChecked();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('4.8');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  await next(page, 'Return to review');
  await expect(breakdown.locator('dl')).toBeVisible();
  await expect(page.locator('[data-design-portrait]')).toHaveAttribute('data-design-portrait', 'captured');
  await expect(page.getByAltText('Your configured pergola, with your selected roof and sides')).not.toHaveAttribute('src', portraitBefore!);
  await page.reload();
  await expect(page.locator('[data-design-portrait]')).toHaveAttribute('data-design-portrait', 'captured');
});

for (const width of [360, 390, 430]) test(`guided choices, model, review and direct edits at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 360 ? 640 : 844 });
  await page.goto('/configurator-preview?open=1');
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'House connection' })).not.toBeVisible();
  await next(page, 'Choose your roof');
  await page.getByRole('radio', { name: 'Combination', exact: true }).check();
  await next(page, 'Set your size');
  const widthField = page.getByRole('textbox', { name: 'Width in metres' });
  await widthField.fill('5.4'); await widthField.press('Enter');
  await expect(page.getByRole('button', { name: 'See your pergola' })).toBeInViewport();
  await next(page, 'See your pergola');
  await expect(page.getByRole('group', { name: 'Choose view' })).toHaveCount(0);
  await expect(page.locator('[data-view]')).toHaveAttribute('data-view', '3D');
  await expect(page.locator('[data-family="gable"]')).toHaveAttribute('data-roof-material', 'combination');
  await next(page, 'More design options');
  await page.getByRole('radio', { name: 'Freestanding', exact: true }).check();
  await next(page, 'Done');
  await expect(page.locator('[data-view]')).toHaveAttribute('data-view', '3D');
  await next(page, 'Add sides & lighting');
  await next(page, 'Continue without extras');
  await expect(page.getByRole('heading', { name: 'Picture yourself here.' })).toBeVisible();
  await next(page, 'Review your design');
  await expect(page.getByRole('region', { name: 'Review your design', includeHidden: true })).toContainText('5.4 × 3.0 m');
  await expect(page.getByRole('region', { name: 'Review your design', includeHidden: true })).toContainText('Freestanding');
  await next(page, 'Edit Size & structure');
  await widthField.fill('5.8'); await widthField.press('Enter');
  await next(page, 'Return to review');
  await expect(page.getByRole('region', { name: 'Review your design', includeHidden: true })).toContainText('5.8 × 3.0 m');
  await page.reload();
  await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-mobile-step', 'review');
  await expect(page.getByRole('region', { name: 'Review your design', includeHidden: true })).toContainText('5.8 × 3.0 m');
  await expect(page.getByRole('button', { name: 'Enquire', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({ path: `artifacts/mobile-configurator/review-${width}.png` });
  await page.getByRole('button', { name: 'Enquire', exact: true }).click();
  await expect(page).toHaveURL(/configurator-preview/);
  await expect(page.getByRole('button', { name: 'Enquire about this design', exact: true })).toBeVisible();
});

test('optional lighting, side editor, automatic views, reset and cross-visit recovery', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/configurator-preview?open=1'); await toModel(page);
  await next(page, 'Add sides & lighting');
  await next(page, 'Sides & privacy');
  await page.getByRole('button', { name: 'Select Front 1 opening', exact: true }).click();
  await next(page, 'Choose treatment');
  await page.getByRole('radio', { name: 'Timber', exact: true }).check();
  await next(page, 'Apply to 1 opening');
  await next(page, 'Done');
  await next(page, 'Lighting');
  await page.getByText('Fine-tune lighting & LED strips', { exact: true }).click();
  await next(page, 'Rafter lights');
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('[data-view]')).toHaveAttribute('data-view', '3D');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Low/ }).click();
  await expect(page.locator('[data-light-rafter-count]')).not.toHaveAttribute('data-light-rafter-count', '0');
  await next(page, 'Done'); await next(page, 'See your finished design');
  await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night', 'false');
  await expect(page.locator('[data-side-panel-count]')).toHaveAttribute('data-side-panel-count', '1');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera', /perspective/);
  await expect.poll(() => page.locator('[data-view]').evaluate(el => Number((el as HTMLElement).style.getPropertyValue('--night-amount')))).toBe(0);
  await page.screenshot({ path: 'artifacts/mobile-configurator/finished.png' });
  // A fresh tab has no session draft: local recovery retains design and journey.
  const fresh = await context.newPage(); await fresh.setViewportSize({ width: 390, height: 844 });
  await fresh.goto('/configurator-preview?open=1');
  await expect(fresh.locator('[data-mobile-step]')).toHaveAttribute('data-mobile-step', 'finished');
  await expect(fresh.locator('[data-side-panel-count]')).toHaveAttribute('data-side-panel-count', '1');
  await next(fresh, 'Review your design');
  await next(fresh, 'Start a new design'); await next(fresh, 'Keep this design');
  await expect(fresh.getByRole('region', { name: 'Review your design', includeHidden: true })).toContainText('ThermoPine screening');
  await next(fresh, 'Start a new design'); await fresh.getByRole('button', { name: 'Start new design', exact: true }).click();
  await expect(fresh.getByRole('radio', { name: 'Pitched', exact: true })).toBeChecked();
  await toModel(fresh); await next(fresh, 'Add sides & lighting'); await next(fresh, 'Lighting');
  await expect(fresh.getByRole('region', { name: 'Choose lighting' })).toBeVisible();
});

test('automatic 3D remains available for long and narrow designs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/configurator-preview?open=1');
  await next(page, 'Choose your roof'); await next(page, 'Set your size');
  for (const [widthMetres, projection] of [['8', '2'], ['3', '6']]) {
    const widthField = page.getByRole('textbox', { name: 'Width in metres' });
    const depthField = page.getByRole('textbox', { name: 'Projection in metres' });
    await widthField.fill(widthMetres); await widthField.press('Enter');
    await depthField.fill(projection); await depthField.press('Enter');
    await next(page, 'See your pergola');
      for (const width of [360, 390, 430]) {
      await page.setViewportSize({ width, height: 740 });
      await expect(page.locator('[data-view]')).toHaveAttribute('data-view', '3D');
    }
    await page.getByRole('button', { name: 'Back', exact: true }).click();
  }
});

test('roof switches with saved lights keep the intro stable and notices contextual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/configurator-preview?open=1'); await toModel(page);
  await next(page, 'Add sides & lighting'); await next(page, 'Lighting');
  await page.getByText('Fine-tune lighting & LED strips', { exact: true }).click();
  await next(page, 'Rafter lights');
  await page.getByRole('button', { name: /^High/ }).click();
  await next(page, 'Done');
  for (let index = 0; index < 4; index++) await page.getByRole('button', { name: 'Back', exact: true }).click();
  const positions = async () => Promise.all([
    page.getByRole('group', { name: 'Roof shape', exact: true }),
    page.locator('figure'),
    page.getByLabel('Continue your design', { exact: true }),
  ].map(async locator => { const box = (await locator.boundingBox())!; return { y: box.y, height: box.height }; }));
  const initial = await positions();
  for (const name of ['Gable', 'Box perimeter', 'Pitched']) {
    await page.getByRole('radio', { name, exact: true }).check();
    await expect(page.getByText(/Some lights no longer fit/)).not.toBeVisible();
    await expect.poll(positions).toEqual(initial);
  }
  await page.screenshot({ path: 'artifacts/mobile-configurator/stable-shape.png' });
  await toModel(page); await next(page, 'Add sides & lighting');
  await expect(page.getByText(/Some lights no longer fit/)).toBeVisible();
});

test('simple lighting layouts work across materials and can replace custom strips', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/configurator-preview?open=1');
  for (const material of ['Acrylic', 'Solid', 'Combination']) {
    await next(page, 'Choose your roof');
    await page.getByRole('radio', { name: material, exact: true }).check();
    await next(page, 'Set your size'); await next(page, 'See your pergola');
    await next(page, 'Add sides & lighting'); await next(page, 'Lighting');
    await page.getByRole('button', { name: /^A gentle glow/ }).click();
    await expect(page.getByRole('button', { name: /^A gentle glow/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('region', { name: 'Choose lighting' }).getByRole('status')).not.toHaveText('0 lights · 0 LED strips');
    await page.getByRole('button', { name: /^More light/ }).click();
    await expect(page.getByRole('button', { name: /^More light/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByText('Fine-tune lighting & LED strips', { exact: true }).click();
    await page.getByRole('button', { name: /^LED strips/ }).click();
    await page.getByRole('button', { name: material === 'Solid' ? 'Outer perimeter' : 'All rafters', exact: true }).click();
    await expect(page.locator('[data-light-strip-count]')).not.toHaveAttribute('data-light-strip-count', '0');
    await page.getByRole('button', { name: /^A gentle glow/ }).click();
    await expect(page.locator('[data-light-strip-count]')).toHaveAttribute('data-light-strip-count', '0');
    await page.getByRole('button', { name: /^No lighting/ }).click();
    await expect(page.getByRole('region', { name: 'Choose lighting' }).getByRole('status')).toHaveText('0 lights · 0 LED strips');
    await page.getByRole('button', { name: /^A gentle glow/ }).click();
    await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night', 'true');
    await expect(page.getByRole('group', { name: 'Time of day' })).toHaveCount(0);
    await next(page, 'Done'); await next(page, 'See your finished design');
    await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night', 'false');
    await expect(page.getByRole('checkbox', { name: 'Show surroundings' })).not.toBeVisible();
    await next(page, 'Review your design');
    await expect(page.getByText('Edit design', { exact: true })).toBeVisible();
    await next(page, 'Start a new design'); await page.getByRole('button', { name: 'Start new design', exact: true }).click();
  }
});

test('normal homepage entry, keyboard focus and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('radio', { name: /Design your pergola/ }).click();
  await expect(page.getByRole('heading', { name: 'Find your shape.' })).toBeFocused();
  const footer = page.getByLabel('Continue your design', { exact: true });
  expect((await footer.boundingBox())!.height).toBeLessThan(100);
  await next(page, 'Choose your roof');
  await expect(page.getByRole('heading', { name: 'Light, shade, or both?' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Design your pergola' })).not.toBeVisible();
  await page.getByRole('link', { name: /Continue designing|Start designing/ }).first().click();
  await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-mobile-step', 'roof');
});





test('mobile finish shares a snapshot and sends inline with validation and retry', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Isolated transport: no customer enquiry leaves the browser. HTTP preview lacks randomUUID.
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'randomUUID', { value: () => '00000000-0000-4000-8000-000000000001', configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (url: string) => { sessionStorage.setItem('test-share-link', url); } }, configurable: true });
  });
  const submissions: { customerDesign: { input: { widthMm: number } }; submissionId: string }[] = [];
  await page.route('**/api/enquiry', async route => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({ status: submissions.length === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(submissions.length === 1 ? { ok: false, error: 'Test service unavailable' } : { ok: true }) });
  });
  await page.goto('/configurator-preview?open=1'); await toModel(page);
  await next(page, 'Add sides & lighting'); await next(page, 'Continue without extras'); await next(page, 'Review your design');
  await page.getByRole('button', { name: 'Share design', exact: true }).click();
  const link = await page.evaluate(() => sessionStorage.getItem('test-share-link'));
  expect(link).toContain('#design=');
  await page.getByRole('button', { name: 'Enquire', exact: true }).click();
  await next(page, 'Enquire about this design');
  await expect(page.locator('#contact-name')).toHaveAttribute('aria-invalid', 'true');
  expect(submissions).toHaveLength(0);
  await page.locator('#contact-name').fill('Test Customer');
  await page.locator('#contact-suburb').fill('Test suburb');
  await page.locator('#contact-email').fill('test@example.com');
  await next(page, 'Edit Size & structure');
  const width = page.getByRole('textbox', { name: 'Width in metres', exact: true });
  await width.fill('5.2'); await width.press('Enter'); await next(page, 'Return to review');
  await expect(page.locator('#contact-name')).toHaveValue('Test Customer');
  await next(page, 'Enquire about this design');
  await expect(page.getByText('Test service unavailable', { exact: true })).toBeVisible();
  await next(page, 'Enquire about this design');
  await expect(page.getByRole('heading', { name: 'Design saved. Enquiry sent.' })).toBeVisible();
  expect(submissions).toHaveLength(2);
  expect(submissions[1].customerDesign.input.widthMm).toBe(5200);
  expect(submissions[1].submissionId).toBe(submissions[0].submissionId);
  const reopened = await context.newPage();
  await reopened.setViewportSize({ width: 390, height: 844 });
  await reopened.goto(link!);
  await expect(reopened.getByRole('region', { name: 'Your pergola review' })).toContainText('6.0 × 3.0');
  await reopened.close();
  await next(page, 'Edit Size & structure');
  await width.fill('5.4'); await width.press('Enter'); await next(page, 'Return to review');
  await expect(page.getByRole('heading', { name: 'Design saved. Enquiry sent.' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enquire about this design' })).toBeVisible();
});

test('mobile size uses a quiet footprint and reveals 3D next', async ({ page }) => {
  await page.setViewportSize({width:360,height:800});
  await page.goto('/configurator-preview?open=1');
  await next(page,'Choose your roof');await next(page,'Set your size');
  const plan=page.locator('[data-mobile-footprint]');
  await expect(plan).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);
  const original=await plan.boundingBox();
  for(const [width,projection] of [[6,3],[1.5,6],[10,1.5]]) {
    for(const [name,value] of [['Width',width],['Projection',projection]] as const){const field=page.getByRole('textbox',{name:`${name} in metres`});await field.fill(String(value));await field.press('Enter');}
    await expect(plan).toHaveAttribute('aria-label',new RegExp(`width ${width.toFixed(1)} m, projection ${projection.toFixed(1)} m`));
    expect((await plan.boundingBox())!.height).toBe(original!.height);
    expect(await plan.evaluate(svg=>{const bounds=svg.getBoundingClientRect();return [...svg.querySelectorAll('text')].every(t=>{const r=t.getBoundingClientRect();return r.left>=bounds.left&&r.right<=bounds.right&&r.top>=bounds.top&&r.bottom<=bounds.bottom;});})).toBe(true);
  }
  await page.getByRole('radio',{name:'Freestanding',exact:true}).check();await expect(plan.locator('[data-house-edge]')).toHaveCount(0);
  await page.getByRole('radio',{name:'Attached',exact:true}).check();await expect(plan.locator('[data-house-edge]')).toHaveCount(1);
  await next(page,'See your pergola');await expect(page.locator('canvas')).toBeVisible();await expect(page.locator('[data-view]')).toHaveAttribute('data-view','3D');
});
