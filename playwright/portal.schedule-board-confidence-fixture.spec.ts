import { expect, test, type Page } from '@playwright/test';

const FIXTURE_PATH = '/qa/schedule-ops-fixture?view=board&scale=standard';
const GANTT_FIXTURE_PATH = '/qa/schedule-ops-fixture?view=gantt&scale=standard';

async function expectNoDocumentOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
}

async function cardOrder(page: Page, crewId: string): Promise<string[]> {
  return page.locator(`[data-board-lane-id="${crewId}"] [data-schedule-card-id]`).evaluateAll((cards) =>
    cards.map((card) => card.getAttribute('data-schedule-card-id') ?? ''),
  );
}

async function dragCardToIndex(page: Page, activeId: string, crewId: string, insertionIndex: number) {
  const source = page.locator(`[data-schedule-card-id="${activeId}"]`);
  const handle = source.getByRole('button', { name: /^Move / });
  const laneBody = page.locator(`[data-board-lane-body="${crewId}"]`);
  await expect(handle).toBeVisible();
  await laneBody.evaluate((lane) => { lane.scrollTop = lane.scrollHeight; });
  const destinationCards = laneBody.locator('[data-schedule-card-id]');
  const handleBox = await handle.boundingBox();
  const laneBox = await laneBody.boundingBox();
  expect(handleBox && laneBox).toBeTruthy();
  if (!handleBox || !laneBox) return;

  let targetY = laneBox.y + laneBox.height / 2;
  const destinationCount = await destinationCards.count();
  if (insertionIndex < destinationCount) {
    const targetBox = await destinationCards.nth(insertionIndex).boundingBox();
    expect(targetBox).toBeTruthy();
    if (targetBox) targetY = targetBox.y + Math.min(8, targetBox.height / 4);
  } else {
    targetY = laneBox.y + laneBox.height - 12;
  }

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 12, handleBox.y + handleBox.height / 2, { steps: 3 });
  await page.mouse.move(laneBox.x + laneBox.width / 2, targetY, { steps: 12 });
  await expect(page.locator('[data-board-drag-overlay="true"]')).toContainText(`position ${insertionIndex + 1}`);
  await page.mouse.up();
  await expect(page.locator('[data-board-drag-overlay="true"]')).toHaveCount(0);
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

test('keeps shared workload, attention, timing, and purposeful Gantt modes readable without server writes', async ({ page }) => {
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
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(GANTT_FIXTURE_PATH);
    await expect(page.locator('[aria-label="Gantt timeline"]')).toBeVisible();
    await expect(page.locator('[data-gantt-crew-id="fixture-crew-1"]')).toContainText('2 jobs · 6d forecast');
    await expect(page.locator('[data-gantt-schedule-item-id="fixture-schedule-0"]')).toContainText('3 issues');
    await expectNoDocumentOverflow(page);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GANTT_FIXTURE_PATH);
  await expect(page.locator('[data-gantt-schedule-item-id="fixture-schedule-9"] [role="button"]')).toContainText('Louvre 010');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(GANTT_FIXTURE_PATH);
  await expect(page.locator('[aria-label="Gantt timeline"]')).toHaveCount(0);
  await expect(page.locator('[aria-label="Crew schedule agenda"]')).toBeVisible();
  await expect(page.getByText('Read-only here. Open Board to safely move, reorder or unschedule work.')).toBeVisible();
  const compactJobLayout = await page.getByRole('button', { name: /^Open project / }).first().evaluate((button) => {
    const [body, metadata] = Array.from(button.children);
    const buttonRect = button.getBoundingClientRect();
    const bodyRect = body?.getBoundingClientRect();
    const metadataRect = metadata?.getBoundingClientRect();
    return {
      buttonWidth: buttonRect.width,
      bodyWidth: bodyRect?.width ?? 0,
      bodyBottom: bodyRect?.bottom ?? 0,
      metadataTop: metadataRect?.top ?? 0,
    };
  });
  expect(compactJobLayout.bodyWidth).toBeGreaterThan(compactJobLayout.buttonWidth * 0.8);
  expect(compactJobLayout.metadataTop).toBeGreaterThanOrEqual(compactJobLayout.bodyBottom - 1);
  await expectNoDocumentOverflow(page);

  await page.setViewportSize({ width: 720, height: 500 });
  await page.goto(GANTT_FIXTURE_PATH);
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expect(page.locator('[aria-label="Crew schedule agenda"]')).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
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

test('commits the exact indicated beginning, middle, end, and cross-crew order in memory only', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/staff/') && request.method() !== 'GET') writes.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(FIXTURE_PATH);
  await dragCardToIndex(page, 'fixture-schedule-10', 'fixture-crew-2', 0);
  expect(await cardOrder(page, 'fixture-crew-2')).toEqual(['fixture-schedule-10', 'fixture-schedule-1']);

  await page.goto(FIXTURE_PATH);
  await dragCardToIndex(page, 'fixture-unscheduled-18', 'fixture-crew-2', 1);
  expect(await cardOrder(page, 'fixture-crew-2')).toEqual([
    'fixture-schedule-1',
    'fixture-unscheduled-18',
    'fixture-schedule-10',
  ]);

  await page.goto(FIXTURE_PATH);
  await dragCardToIndex(page, 'fixture-unscheduled-18', 'fixture-crew-2', 2);
  expect(await cardOrder(page, 'fixture-crew-2')).toEqual([
    'fixture-schedule-1',
    'fixture-schedule-10',
    'fixture-unscheduled-18',
  ]);
  await expect(page.locator('[data-schedule-card-id="fixture-unscheduled-18"] [data-schedule-position="3"]')).toBeVisible();
  await expect(page.locator('[data-mutation-notice]')).toHaveCount(0);
  await expect(page.locator('[data-change-state]')).toHaveCount(0);

  await page.goto(FIXTURE_PATH);
  await dragCardToIndex(page, 'fixture-schedule-1', 'fixture-crew-3', 2);
  expect(await cardOrder(page, 'fixture-crew-2')).toEqual(['fixture-schedule-10']);
  expect(await cardOrder(page, 'fixture-crew-3')).toEqual([
    'fixture-schedule-2',
    'fixture-schedule-11',
    'fixture-schedule-1',
  ]);
  expect(writes).toEqual([]);
});

test('keeps placement gestures active during synthetic slow background persistence', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/staff/') && request.method() !== 'GET') writes.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${FIXTURE_PATH}&state=slow`);
  await expect(page.locator('[data-mutation-notice]')).toHaveCount(0);
  await expect(page.locator('[data-change-state]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Move / }).first()).toBeEnabled();

  await dragCardToIndex(page, 'fixture-unscheduled-18', 'fixture-crew-2', 2);
  expect(await cardOrder(page, 'fixture-crew-2')).toEqual([
    'fixture-schedule-1',
    'fixture-schedule-10',
    'fixture-unscheduled-18',
  ]);
  await dragCardToIndex(page, 'fixture-schedule-2', 'fixture-crew-1', 2);
  expect(await cardOrder(page, 'fixture-crew-1')).toEqual([
    'fixture-schedule-0',
    'fixture-schedule-9',
    'fixture-schedule-2',
  ]);
  expect(writes).toEqual([]);
});

for (const state of ['failed', 'stale'] as const) {
  test(`renders only the actionable ${state} card notice without a Schedule command`, async ({ page }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/staff/') && request.method() !== 'GET') writes.push(request.url());
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${FIXTURE_PATH}&state=${state}`);
    const card = page.locator(`[data-mutation-notice="${state === 'failed' ? 'error' : 'warning'}"]`);
    await expect(card).toBeVisible();
    const action = card.getByRole('button', { name: state === 'failed' ? 'Retry' : 'Refresh' });
    await expect(action).toBeVisible();
    if (state === 'stale') {
      await expect(
        page.locator('[data-board-lane-id="fixture-crew-1"]').getByRole('button', { name: /^Move / }).first(),
      ).toBeDisabled();
      await expect(page.locator('[data-board-lane-id="fixture-crew-2"]').getByRole('button', { name: /^Move / }).first()).toBeEnabled();
    }
    await action.click();
    await expect(page.locator('[data-mutation-notice]')).toHaveCount(0);
    expect(writes).toEqual([]);
  });
}
