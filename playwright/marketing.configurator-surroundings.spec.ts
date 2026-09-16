import { expect, test } from '@playwright/test';

test('soffit quantities update with width and share the Plan positions', async ({ page }) => {
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  await page.getByRole('radio', { name: 'Soffit brackets', exact: true }).check();
  const viewport = page.locator('[data-bracket-count]');
  await expect(viewport).toHaveAttribute('data-bracket-count', '5');
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('7.5');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  await expect(viewport).toHaveAttribute('data-bracket-count', '6');
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.locator('[data-bracket-id]')).toHaveCount(6);
  await page.getByRole('radio', { name: 'Fascia', exact: true }).check();
  await expect(viewport).toHaveAttribute('data-bracket-count', '0');
  await expect(page.locator('[data-bracket-id]')).toHaveCount(0);
});

test('soffit is available through 4m, then changes to fascia with consistent pricing input', async ({ page }) => {
  const requests: { projectionMm: number; connection: string }[] = [];
  await page.route('**/api/simple-cover-price', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { ok: false, status: 'unavailable' } });
  });
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  const projection = page.getByRole('textbox', { name: 'Projection in metres' });
  await projection.fill('4.0'); await projection.press('Enter');
  const soffit = page.getByRole('radio', { name: 'Soffit brackets', exact: true });
  await expect(soffit).toBeEnabled(); await soffit.check();
  await expect(soffit).toBeChecked();
  await projection.fill('4.1'); await projection.press('Enter');
  await expect(soffit).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Fascia', exact: true })).toBeChecked();
  await expect(page.getByRole('status')).toContainText('Switched to fascia.');
  await expect(page.locator('[data-connection]')).toHaveAttribute('data-connection', 'fascia');
  await expect.poll(() => requests.some(input => input.projectionMm === 4100 && input.connection === 'fascia')).toBe(true);
  expect(requests.some(input => input.projectionMm > 4000 && input.connection === 'soffit')).toBe(false);
  await projection.fill('4.0'); await projection.press('Enter');
  await expect(soffit).toBeEnabled();
  await expect(page.getByRole('radio', { name: 'Fascia', exact: true })).toBeChecked();
  await soffit.check(); await expect(soffit).toBeChecked();
});

test('surroundings, connections and ground remain independent of camera and pricing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/simple-cover-price', route => route.fulfill({ status: 503, json: { ok: false, status: 'unavailable' } }));
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  const canvas = page.locator('canvas');
  const viewport = page.locator('[data-surroundings]');
  await expect(canvas).toHaveAttribute('data-camera', /position/);
  await expect(page.getByRole('region', { name: 'Estimated price' })).toContainText('Estimate unavailable');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -40);
  const camera = async () => JSON.parse((await canvas.getAttribute('data-camera'))!) as { position: number[]; target: number[]; zoom: number };
  const initial = await camera();
  const expectSameCamera = async () => {
    const current = await camera();
    current.position.forEach((value, i) => expect(value).toBeCloseTo(initial.position[i]!, 5));
    current.target.forEach((value, i) => expect(value).toBeCloseTo(initial.target[i]!, 5));
    expect(current.zoom).toBeCloseTo(initial.zoom, 7);
  };
  await expect(page.getByRole('checkbox', { name: 'Show surroundings' })).toBeChecked();
  await expect(viewport).toHaveAttribute('data-connection', 'facade');
  await expect(viewport).toHaveAttribute('data-level', 'ground');
  await page.getByRole('radio', { name: 'Soffit brackets', exact: true }).check();
  await expect(viewport).toHaveAttribute('data-connection', 'soffit');
  await page.getByRole('radio', { name: 'Elevated', exact: true }).check();
  await expect(viewport).toHaveAttribute('data-level', 'elevated');
  await page.getByRole('radio', { name: 'Fascia', exact: true }).check();
  await expect(viewport).toHaveAttribute('data-level', 'elevated');
  await expectSameCamera();
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.locator('[data-context="plan-surroundings"]')).toBeVisible();
  await expect(page.getByText('HOUSE CONNECTION', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Show surroundings' }).uncheck();
  await expect(page.locator('[data-context="plan-surroundings"]')).toHaveCount(0);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-surroundings', 'false');
  await expectSameCamera();
  await page.getByRole('checkbox', { name: 'Show surroundings' }).check();
  await expect(canvas).toHaveAttribute('data-house-opacity', '1.00');
  expect(errors).toEqual([]);
});

test('the house fades behind the pergola and returns at the front', async ({ page }) => {
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-house-opacity', '1.00');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .35, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .35 + box.height * .4, box.y + box.height * .5, { steps: 20 });
  await page.mouse.up();
  await expect.poll(async () => Number(await canvas.getAttribute('data-house-opacity'))).toBeLessThan(.15);
  await page.screenshot({ path: 'artifacts/configurator-preview/house-faded.png' });
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-house-opacity', '1.00');
});
