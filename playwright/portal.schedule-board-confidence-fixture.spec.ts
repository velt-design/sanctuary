import { expect, test, type Page } from '@playwright/test';

const FIXTURE_PATH = '/qa/schedule-ops-fixture?view=board&scale=standard';

async function expectNoDocumentOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
}

test.describe.configure({ mode: 'serial' });

test('keeps Board confidence controls operational across realistic widths without server writes', async ({ page }) => {
  const staffWrites: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/staff/') && request.method() !== 'GET') staffWrites.push(request.url());
  });

  for (const viewport of [
    { width: 1600, height: 1000 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(FIXTURE_PATH);
    await expect(page.locator('[data-portal-qa-fixture="schedule-ops"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Schedule operational context' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Move / }).first()).toBeVisible();
    await expectNoDocumentOverflow(page);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(FIXTURE_PATH);
  const actionsTrigger = page.getByRole('button', { name: /^Job actions for / }).first();
  await actionsTrigger.click();
  const panel = page.getByRole('dialog', { name: /^Job actions for / });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Plan and timing' })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Job progress' })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Customer' })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Exceptions' })).toBeVisible();
  await expect(panel.getByRole('button', { name: /Extend \+[12] day/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(actionsTrigger).toBeFocused();

  await page.setViewportSize({ width: 720, height: 500 });
  await page.goto(FIXTURE_PATH);
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expectNoDocumentOverflow(page);
  expect(staffWrites).toEqual([]);
});

test('shows a stable pointer destination while the source card stays anchored', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(FIXTURE_PATH);
  const sourceHandle = page.getByRole('complementary', { name: 'Unscheduled jobs' }).getByRole('button', { name: /^Move / }).first();
  const sourceCard = sourceHandle.locator('xpath=ancestor::*[@data-schedule-card-id][1]');
  const targetLane = page.locator('[data-board-lane-body]').nth(1);
  const before = await sourceCard.boundingBox();
  const handleBox = await sourceHandle.boundingBox();
  const targetBox = await targetLane.boundingBox();
  expect(before && handleBox && targetBox).toBeTruthy();
  if (!before || !handleBox || !targetBox) return;

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 12, handleBox.y + handleBox.height / 2, { steps: 3 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + Math.min(80, targetBox.height / 2), { steps: 10 });

  const overlay = page.locator('[data-board-drag-overlay="true"]');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText(/Drop (at the end of|in) /);
  await expect(overlay).toHaveAttribute('data-valid', 'true');
  const during = await sourceCard.boundingBox();
  expect(during?.x).toBeCloseTo(before.x, 0);
  expect(during?.y).toBeCloseTo(before.y, 0);
  await page.mouse.up();
  await expect(overlay).toHaveCount(0);
});

for (const state of ['checking', 'reviewing', 'saving', 'reconciling', 'saved', 'restored', 'verified'] as const) {
  test(`renders the ${state} card outcome without a Schedule command`, async ({ page }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/staff/') && request.method() !== 'GET') writes.push(request.url());
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${FIXTURE_PATH}&state=${state}`);
    const card = page.locator(`[data-change-state="${state}"]`);
    await expect(card).toBeVisible();
    if (['checking', 'reviewing', 'saving', 'reconciling'].includes(state)) {
      await expect(page.getByText('Synthetic schedule change in progress.')).toBeVisible();
      await expect(card.getByRole('button', { name: /^Job actions for / })).toBeDisabled();
    }
    expect(writes).toEqual([]);
  });
}
