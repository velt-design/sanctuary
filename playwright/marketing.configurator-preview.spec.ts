import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/simple-cover-price', async (route) => {
    const input = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, status: 'priced', input, price: { fromIncGst: input.widthMm * 2, currency: 'NZD' }, configuration: { versionNumber: 1 } } });
  });
});

test('views, controls and shared pricing request; no indexing', async ({ page }) => {
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('[data-geometry-status]')).toHaveAttribute('data-geometry-status', /ready|review_required/);
  await expect(page.locator('[data-rafter-count]')).toHaveAttribute('data-rafter-count', '11');
  await expect(page.locator('[data-post-count]')).toHaveAttribute('data-post-count', '3');
  await expect(page.getByRole('region', { name: 'Estimated price' })).toContainText('$12,000');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(750); // Allow GPU compilation and the initial camera fit to settle for visual evidence.
  await page.screenshot({ path: 'artifacts/configurator-preview/desktop-3d.png', fullPage: true });
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.getByRole('img', { name: /Pergola plan/ })).toBeVisible();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.1');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  await expect(page.getByRole('img', { name: /Pergola plan, 5.1 m/ })).toBeVisible();
  await expect(page.locator('[data-rafter-count]')).toHaveAttribute('data-rafter-count', '9');
  await expect(page.locator('svg [data-member-id^="rafter-"]')).toHaveCount(9);
  await expect(page.getByRole('region', { name: 'Estimated price' })).toContainText('$10,200');
  await page.screenshot({ path: 'artifacts/configurator-preview/desktop-plan.png', fullPage: true });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(750);
  await expect(page.getByRole('button', { name: '3D', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Elevation', exact: true })).toHaveCount(0);
  await page.locator('canvas').dispatchEvent('webglcontextlost');
  await expect(page.getByRole('img', { name: /Pergola plan/ })).toBeVisible();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('1');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('1.5');
  await expect(page.getByRole('img', { name: /Pergola plan, 1.5 m/ })).toBeVisible();
  await expect(page.locator('[data-rafter-count]')).toHaveAttribute('data-rafter-count', '4');
  await expect(page.locator('[data-post-count]')).toHaveAttribute('data-post-count', '2');
});

test('mobile layout and pricing failure keep plan usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/simple-cover-price', (route) => route.fulfill({ status: 503, json: { ok: false, status: 'unavailable' } }));
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  await expect(page.getByRole('region', { name: 'Estimated price' })).toContainText('Estimate unavailable');
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.getByRole('img', { name: /Pergola plan/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('region', { name: 'Estimated price' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Retry estimate' })).toBeVisible();
  await page.waitForTimeout(500); // Let the consent closing transition release mobile scroll lock.
  await page.screenshot({ path: 'artifacts/configurator-preview/mobile-controls.png' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/configurator-preview/mobile-plan.png' });
});


test('camera continuity, intentional fit and reset, and front starting angle', async ({ page }) => {
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-camera', /position/);
  const camera = async () => JSON.parse((await canvas.getAttribute('data-camera'))!) as {position: number[]; target: number[]; distance: number};
  const direction = (value: Awaited<ReturnType<typeof camera>>) => value.position.map((n, i) => (n - value.target[i]!) / value.distance);
  const initial = await camera();
  expect(direction(initial)[0]).toBeGreaterThan(0);
  expect(direction(initial)[1]).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /Explore 3D|Lock view/ })).toHaveCount(0);
  await page.waitForTimeout(100);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .45, box.y + box.height * .4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .5, { steps: 15 });
  await page.mouse.up();
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await camera()).distance).not.toBe(initial.distance);
  const chosen = await camera();
  expect(direction(chosen)).not.toEqual(direction(initial));
  for (const [name, value] of [['Width in metres', '5.1'], ['Projection in metres', '4.2']]) {
    await page.getByRole('textbox', { name }).fill(value!);
    await page.getByRole('textbox', { name }).press('Enter');
    await expect(page.getByRole('textbox', { name })).toHaveValue(value!);
  }
  const resized = await camera();
  direction(resized).forEach((n, i) => expect(n).toBeCloseTo(direction(chosen)[i]!, 5));
  expect(resized.distance).toBeCloseTo(chosen.distance, 8);
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(canvas).toBeHidden();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.9');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const returned = await camera();
  direction(returned).forEach((n, i) => expect(n).toBeCloseTo(direction(chosen)[i]!, 5));
  expect(returned.distance).toBeCloseTo(chosen.distance, 8);
  await expect(page.getByRole('button', { name: /Explore 3D|Lock view/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  const fitted = await camera();
  direction(fitted).forEach((n, i) => expect(n).toBeCloseTo(direction(chosen)[i]!, 5));
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect.poll(async () => direction(await camera())[0]).toBeGreaterThan(0);
  await expect.poll(async () => direction(await camera())[1]).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /Explore 3D|Lock view/ })).toHaveCount(0);
});

test('mobile size controls remain usable beside the pinned model', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera', /position/);
  const initialModel = (await page.locator('canvas').boundingBox())!;
  expect(initialModel.y).toBeLessThan(220);
  expect(initialModel.height).toBeGreaterThan(140);
  expect((await page.getByRole('region', { name: 'Pergola views' }).boundingBox())!.height).toBeGreaterThan(350);
  expect((await page.getByRole('region', { name: 'Pergola views' }).boundingBox())!.height).toBeLessThan(410);
  const initialSize = (await page.getByRole('textbox', { name: 'Width in metres' }).boundingBox())!;
  expect(initialSize.y + initialSize.height).toBeLessThan(844);
  for (const name of ['Width', 'Projection']) {
    const slider = page.getByRole('slider', { name, exact: true });
    await slider.click({ position: { x: 75, y: 16 } });
    await expect(page.getByRole('textbox', { name: `${name} in metres` })).toHaveValue((Number(await slider.inputValue()) / 1000).toFixed(1));
    const model = (await page.locator('canvas').boundingBox())!;
    const control = (await slider.boundingBox())!;
    expect(model.y).toBeGreaterThanOrEqual(64);
    expect(model.y + model.height).toBeLessThan(control.y);
    expect(control.y + control.height).toBeLessThanOrEqual(844);
  }
  await page.screenshot({ path: 'artifacts/configurator-preview/mobile-size-controls.png' });
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.getByRole('img', { name: /Pergola plan/ })).toBeVisible();
  await page.getByRole('radio', { name: 'Soffit brackets', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Soffit brackets', exact: true })).toBeChecked();
  await page.screenshot({ path: 'artifacts/configurator-preview/mobile-plan-controls.png' });
});

test('Plan labels follow the active size control and clear after leaving it', async ({ page }) => {
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  const plan = page.getByRole('img', { name: /Pergola plan/ });
  await expect(plan.getByText('HOUSE CONNECTION', { exact: true })).toBeVisible();
  await expect(plan.getByText('FRONT EDGE', { exact: true })).toBeVisible();
  const widthLabel = page.locator('[data-plan-dimension="width"]');
  const projectionLabel = page.locator('[data-plan-dimension="projection"]');
  const width = page.getByRole('slider', { name: 'Width', exact: true });
  await width.focus(); await width.press('ArrowRight');
  await expect(widthLabel).toHaveAttribute('data-active', 'true');
  await expect(widthLabel).toHaveAttribute('aria-label', 'Width 6.1 m');
  const projection = page.getByRole('slider', { name: 'Projection', exact: true });
  await projection.focus(); await projection.press('ArrowRight');
  await expect(projectionLabel).toHaveAttribute('data-active', 'true');
  await expect(projectionLabel).toHaveAttribute('aria-label', 'Projection 3.1 m');
  await expect(widthLabel).toHaveAttribute('data-active', 'false');
  await page.getByRole('checkbox', { name: 'Show surroundings' }).focus();
  await expect(projectionLabel).toHaveAttribute('data-active', 'false');
});


test('3D dimension feedback tracks edits and clears after leaving a size control', async ({ page }) => {
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera', /position/);
  const initialCamera = await page.locator('canvas').getAttribute('data-camera');
  const width = page.getByRole('slider', { name: 'Width', exact: true });
  await width.focus();
  await expect(page.getByRole('img', { name: 'Width 6.0 m', exact: true })).toBeVisible();
  await expect(page.locator('[data-dimension="width"] path').first()).toHaveAttribute('d', /M .+ L /);
  expect(await page.locator('canvas').getAttribute('data-camera')).toBe(initialCamera);
  await width.press('ArrowRight');
  await expect(page.getByRole('img', { name: 'Width 6.1 m', exact: true })).toBeVisible();
  await expect(page.locator('[data-dimension="width"] path').first()).toHaveAttribute('d', /M .+ L /);
  await page.screenshot({ path: 'artifacts/configurator-preview/desktop-width-feedback.png' });
  const projection = page.getByRole('slider', { name: 'Projection', exact: true });
  await projection.focus();
  await projection.press('ArrowRight');
  await expect(page.getByRole('img', { name: 'Projection 3.1 m', exact: true })).toBeVisible();
  await expect(page.locator('[data-dimension="width"]')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/configurator-preview/desktop-projection-feedback.png' });
  await page.getByRole('button', { name: 'Fit view', exact: true }).focus();
  await expect(page.locator('[data-dimension]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await width.focus();
  await expect(page.getByRole('img', { name: /Pergola plan/ })).toBeVisible();
  await expect(page.locator('[data-dimension]')).toHaveCount(0);
});

test.describe('direct touch exploration', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('rotation in both directions and pinch zoom stay within the fixed viewer', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/configurator-preview');
    await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-camera', /position/);
    const client = await page.context().newCDPSession(page);
    const camera = async () => JSON.parse((await canvas.getAttribute('data-camera'))!) as { position: number[]; zoom: number };
    const swipe = async (dx: number, dy: number) => {
      const box = (await canvas.boundingBox())!;
      const x = box.x + box.width * .45, y = box.y + box.height * .5;
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
      for (let i = 1; i <= 12; i++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 12, y: y + dy * i / 12, id: 0 }] });
        await page.waitForTimeout(16);
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const initial = await camera();
    await swipe(100, 0);
    await expect.poll(async () => (await camera()).position).not.toEqual(initial.position);
    const scrollBefore = await page.evaluate(() => document.body.scrollTop + window.scrollY);
    await swipe(0, -120);
    expect(await page.evaluate(() => document.body.scrollTop + window.scrollY)).toBeCloseTo(scrollBefore, 0);
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
    expect(errors).toEqual([]);
  });
});
