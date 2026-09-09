import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera', /position/);
});

test('desktop viewer stays complete while choices scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  const viewer = page.getByRole('region', { name: 'Pergola views' });
  const initial = (await viewer.boundingBox())!;
  expect(initial.y).toBeGreaterThan(80);
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
    expect((await viewer.boundingBox())!.height).toBeLessThanOrEqual(310);
    expect((await outline.boundingBox())!.width).toBeGreaterThan(115);
    await page.getByRole('button', { name: 'Expand view', exact: true }).click();
    expect((await viewer.boundingBox())!.height).toBeGreaterThanOrEqual(740);
    expect((await outline.boundingBox())!.width).toBeGreaterThan(280);
    await expect(page.getByRole('button', { name: 'Close expanded view', exact: true })).toBeInViewport();
    await expect(page.getByRole('link', { name: 'Sanctuary Pergolas home' })).toBeHidden();
    for (const axis of ['width', 'projection']) {
      const bounds = (await plan.locator(`[data-plan-dimension="${axis}"] rect`).boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    await page.getByRole('button', { name: 'Close expanded view', exact: true }).click();
    await expect(projection).toHaveValue('6.0');
    await expect(page.getByRole('radio', { name: 'Box perimeter', exact: true })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect((await viewer.boundingBox())!.height).toBeLessThanOrEqual(310);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });
}

test.describe('expanded touch gestures', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('orbit and pinch cannot scroll the expanded page; Done restores scrolling', async ({ page }) => {
    const canvas = page.locator('canvas');
    const camera = async () => JSON.parse((await canvas.getAttribute('data-camera'))!) as { position: number[]; zoom: number };
    const scroll = () => page.evaluate(() => document.body.scrollTop + window.scrollY);
    const client = await page.context().newCDPSession(page);
    const swipe = async (dx: number, dy: number) => {
      const box = (await canvas.boundingBox())!;
      const x = box.x + box.width * .45, y = box.y + box.height * .6;
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
      for (let i = 1; i <= 12; i++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 12, y: y + dy * i / 12, id: 0 }] });
        await page.waitForTimeout(16);
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await swipe(0, -100);
    await expect.poll(scroll).toBeGreaterThan(40);
    await expect.poll(async () => {
      const before = await scroll();
      await page.waitForTimeout(120); // Let native inertial scrolling settle before tapping a sticky control.
      return Math.abs(await scroll() - before);
    }).toBeLessThan(1);
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
    expect(await canvas.evaluate(el => getComputedStyle(el).touchAction)).toBe('pan-y');
    await swipe(0, -100);
    await expect.poll(scroll).toBeGreaterThan(positionBefore + 40);
  });
});
