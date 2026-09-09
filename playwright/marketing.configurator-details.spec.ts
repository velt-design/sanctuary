import { expect, test } from '@playwright/test';

test('hover details explain connections without changing the selected design or camera', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|shader|WebGL/i.test(message.text())) errors.push(message.text()); });
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-camera', /position/);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -40);
  await page.waitForTimeout(100);
  const camera = JSON.parse((await canvas.getAttribute('data-camera'))!) as { position: number[]; target: number[]; zoom: number };
  for (const label of ['Fascia', 'Soffit brackets', 'Facade']) {
    await page.getByRole('radio', { name: label, exact: true }).hover();
    const card = page.getByRole('dialog', { name: `${label} attachment detail` });
    await expect(card).toBeVisible();
    await expect(card.getByRole('img')).toBeVisible();
    await card.hover();
    await expect(card).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Facade', exact: true })).toBeChecked();
    const current = JSON.parse((await canvas.getAttribute('data-camera'))!) as typeof camera;
    current.position.forEach((value, index) => expect(value).toBeCloseTo(camera.position[index]!, 5));
    current.target.forEach((value, index) => expect(value).toBeCloseTo(camera.target[index]!, 5));
    expect(current.zoom).toBeCloseTo(camera.zoom, 8);
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test.describe('touch attachment details', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('tap opens a bounded card without selecting, including an unavailable attachment', async ({ page }) => {
    await page.goto('/configurator-preview');
    await page.getByRole('button', { name: 'Essential only', exact: true }).tap();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
    const details = page.getByRole('button', { name: 'About Soffit brackets attachment', exact: true });
    await details.tap();
    const card = page.getByRole('dialog', { name: 'Soffit brackets attachment detail' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('from underneath');
    await expect(page.getByRole('radio', { name: 'Facade', exact: true })).toBeChecked();
    let bounds = (await card.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    await page.getByRole('button', { name: 'Close attachment detail' }).tap();
    await expect(card).toHaveCount(0);
    const projection = page.getByRole('textbox', { name: 'Projection in metres' });
    await projection.fill('4.1'); await projection.press('Enter');
    await expect(page.getByRole('radio', { name: 'Soffit brackets', exact: true })).toBeDisabled();
    await details.tap(); await expect(card).toContainText('Available up to 4.0 m projection');
    await page.setViewportSize({ width: 667, height: 375 });
    bounds = (await card.boundingBox())!;
    await expect.poll(async () => { const b = (await card.boundingBox())!; return b.y + b.height; }).toBeLessThanOrEqual(375);
    await page.getByRole('button', { name: 'Close attachment detail' }).tap();
    await expect(card).toHaveCount(0);
  });
});
