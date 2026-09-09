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
