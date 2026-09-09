import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera', /position/);
});

test('desktop viewer stays complete while choices scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  const viewer = page.getByRole('region', { name: 'Pergola views' });
  const initial = (await viewer.boundingBox())!;
  expect(initial.y).toBeGreaterThan(12);
  expect(initial.y).toBeLessThan(65);
  expect(initial.y + initial.height).toBeLessThanOrEqual(900);
  await page.getByRole('region', { name: 'Estimated price' }).scrollIntoViewIfNeeded();
  expect((await viewer.boundingBox())!.y).toBeCloseTo(initial.y, 0);
  await expect(page.getByRole('button', { name: 'Plan', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Fit view', exact: true })).toBeInViewport();
  await expect(page.getByRole('region', { name: 'Estimated price' })).toBeInViewport();
});

for (const width of [360, 390]) {
  test(`mobile ${width}: compact edit, expanded plan and return keep the design`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 360 ? 740 : 844 });
    await page.getByRole('radio', { name: 'Box perimeter', exact: true }).check();
    const projection = page.getByRole('textbox', { name: 'Projection in metres' });
    await projection.fill('6.0');
    await projection.press('Enter');
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    const viewer = page.getByRole('region', { name: 'Pergola views' });
    const plan = page.getByRole('img', { name: /Pergola plan/ });
    const outline = plan.locator(':scope > polygon').first();
    expect((await viewer.boundingBox())!.height).toBeGreaterThan(320);
    expect((await viewer.boundingBox())!.height).toBeLessThan(410);
    expect((await outline.boundingBox())!.width).toBeGreaterThan(115);
    await page.getByRole('button', { name: 'Expand view', exact: true }).click();
    expect((await viewer.boundingBox())!.height).toBeGreaterThanOrEqual(720);
    expect((await outline.boundingBox())!.width).toBeGreaterThan(280);
    await expect(page.getByRole('button', { name: 'Close expanded view', exact: true })).toBeInViewport();
    await expect(page.getByRole('dialog', { name: 'Design your pergola', exact: true })).toBeVisible();
    for (const axis of ['width', 'projection']) {
      const bounds = (await plan.locator(`[data-plan-dimension="${axis}"] rect`).boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Design your pergola', exact: true })).toBeVisible();
    await expect(projection).toHaveValue('6.0');
    await expect(page.getByRole('radio', { name: 'Box perimeter', exact: true })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect((await viewer.boundingBox())!.height).toBeGreaterThan(320);
    expect((await viewer.boundingBox())!.height).toBeLessThan(410);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    await page.getByRole('button', { name: /Continue designing/ }).click();
    await expect(projection).toHaveValue('6.0');
    await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
}

test('launcher follows the page and reopening preserves the explored camera and choices', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 65, box.y + box.height / 2 - 30, { steps: 10 });
  await page.mouse.up();
  const camera = JSON.parse((await canvas.getAttribute('data-camera'))!);
  await page.getByRole('region', { name: 'Estimated price' }).scrollIntoViewIfNeeded();
  const choices = page.getByRole('complementary', { name: 'Your pergola choices' });
  const choicesScroll = await choices.evaluate(el => el.scrollTop);
  await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.mouse.move(180, 420);
  await page.mouse.wheel(0, 420);
  await expect.poll(() => page.evaluate(() => document.body.scrollTop)).toBeGreaterThan(100);
  await expect.poll(async () => {
    const before = await page.evaluate(() => document.body.scrollTop);
    await page.waitForTimeout(120);
    return Math.abs(await page.evaluate(() => document.body.scrollTop) - before);
  }).toBeLessThan(1);
  const pageScroll = await page.evaluate(() => document.body.scrollTop);
  const launcher = page.getByRole('button', { name: /Continue designing/ });
  await expect(launcher).toBeInViewport();
  await launcher.click();
  await expect(canvas).toBeVisible();
  await expect.poll(async () => JSON.parse((await canvas.getAttribute('data-camera'))!).zoom).toBeCloseTo(camera.zoom, 6);
  expect(JSON.parse((await canvas.getAttribute('data-camera'))!).position).toEqual(camera.position);
  expect(await choices.evaluate(el => el.scrollTop)).toBeCloseTo(choicesScroll, 0);
  const panel = (await page.getByRole('dialog', { name: 'Design your pergola', exact: true }).boundingBox())!;
  expect(panel.x).toBe(8); expect(panel.y).toBe(8);
  expect(panel.width).toBe(374); expect(panel.height).toBe(828);
  await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  expect(await page.evaluate(() => document.body.scrollTop)).toBeCloseTo(pageScroll, 0);
});

test('short landscape keeps the complete viewer beside scrolling choices', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  const viewer = page.getByRole('region', { name: 'Pergola views' });
  const choices = page.getByRole('complementary', { name: 'Your pergola choices' });
  const before = (await viewer.boundingBox())!;
  expect(before.height).toBeGreaterThan(300);
  expect((await choices.boundingBox())!.x).toBeGreaterThan(before.x + before.width - 1);
  await page.getByRole('region', { name: 'Estimated price' }).scrollIntoViewIfNeeded();
  expect((await viewer.boundingBox())!.y).toBe(before.y);
  expect(await choices.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
});

test.describe('expanded touch gestures', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('orbit and pinch stay with the viewer; only the choices scroll', async ({ page }) => {
    const canvas = page.locator('canvas');
    const camera = async () => JSON.parse((await canvas.getAttribute('data-camera'))!) as { position: number[]; zoom: number };
    const scroll = () => page.evaluate(() => document.body.scrollTop + window.scrollY);
    const client = await page.context().newCDPSession(page);
    const swipe = async (dx: number, dy: number, target = canvas) => {
      const box = (await target.boundingBox())!;
      const x = box.x + box.width * .45, y = box.y + box.height * .6;
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
      for (let i = 1; i <= 12; i++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 12, y: y + dy * i / 12, id: 0 }] });
        await page.waitForTimeout(16);
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const originalScroll = await scroll();
    const initialCamera = await camera();
    await swipe(0, -100);
    await expect.poll(async () => (await camera()).position).not.toEqual(initialCamera.position);
    expect(await scroll()).toBeCloseTo(originalScroll, 0);
    const expand = page.getByRole('button', { name: 'Expand view', exact: true });
    await expand.scrollIntoViewIfNeeded();
    const positionBefore = await scroll();
    await expand.click();
    await expect(page.getByRole('button', { name: 'Close expanded view', exact: true })).toBeVisible();
    expect(await canvas.evaluate(el => getComputedStyle(el).touchAction)).toBe('none');
    expect(await canvas.evaluate(el => getComputedStyle(el.closest('[data-expanded]')!).touchAction)).toBe('none');
    const expandedScroll = await scroll();
    for (const [dx, dy] of [[70, -100], [0, 100], [-70, 0]]) {
      const before = await camera();
      await swipe(dx, dy);
      await expect.poll(async () => (await camera()).position).not.toEqual(before.position);
      expect(await scroll()).toBeCloseTo(expandedScroll, 0);
    }
    const box = (await canvas.boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const zoom = (await camera()).zoom;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 30, y, id: 0 }, { x: x + 30, y, id: 1 }] });
    for (let i = 1; i <= 10; i++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 30 - i * 3, y, id: 0 }, { x: x + 30 + i * 3, y, id: 1 }] });
      await page.waitForTimeout(16);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await camera()).zoom).toBeGreaterThan(zoom);
    expect(await scroll()).toBeCloseTo(expandedScroll, 0);
    await page.getByRole('button', { name: 'Close expanded view', exact: true }).click();
    expect(await scroll()).toBeCloseTo(positionBefore, 0);
    expect(await canvas.evaluate(el => getComputedStyle(el).touchAction)).toBe('none');
    const choices = page.getByRole('complementary', { name: 'Your pergola choices' });
    const viewerY = (await canvas.boundingBox())!.y;
    await page.getByRole('region', { name: 'Estimated price' }).scrollIntoViewIfNeeded();
    expect(await choices.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
    const choicesBeforeTouch = await choices.evaluate(el => el.scrollTop);
    await swipe(0, 100, choices);
    await expect.poll(() => choices.evaluate(el => el.scrollTop)).toBeLessThan(choicesBeforeTouch - 30);
    expect((await canvas.boundingBox())!.y).toBeCloseTo(viewerY, 0);
    expect(await scroll()).toBeCloseTo(positionBefore, 0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Design your pergola', exact: true })).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });
});

for (const width of [390, 1440]) {
  test('dimension entry selects on first click and uses the Simple pergola range at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const number = page.getByRole('textbox', { name: 'Width in metres', exact: true });
    await number.click();
    expect(await number.evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!)).toBe(3);
    await page.keyboard.type('7.2');
    await number.press('Enter');
    await expect(number).toHaveValue('7.2');
    const range = page.getByRole('slider', { name: 'Width', exact: true });
    await expect(range).toHaveValue('7200');
    expect((await range.boundingBox())!.height).toBeGreaterThanOrEqual(width < 600 ? 72 : 44);
    await range.focus();
    await range.press('ArrowRight');
    await expect(number).toHaveValue('7.3');
    await page.getByRole('radio', { name: 'Elevated', exact: true }).check();
    await expect(page.getByText('First-floor deck · shown 2.7 m above ground.')).toBeVisible();
    await expect(page.locator('fieldset').filter({has: page.getByText('Roof style', {exact:true})}).locator('svg')).toHaveCount(0);
    await page.getByRole('button', { name: 'Fit view', exact: true }).click();
    await page.screenshot({ path: 'artifacts/configurator-preview/controls-' + width + '.png' });
  });
}
