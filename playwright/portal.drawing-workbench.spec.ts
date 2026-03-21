import { test, expect, type Page } from '@playwright/test';

async function waitForProjectsList(page: Page) {
  const projectsRegion = page.getByRole('region', { name: 'Projects list' });

  await expect.poll(
    async () => {
      const rowCount = await projectsRegion.locator('tbody tr').count();
      if (rowCount > 0) return 'rows';

      const text = (await projectsRegion.textContent()) ?? '';
      return text.includes('Loading projects') ? 'loading' : 'settled';
    },
    {
      timeout: 60_000,
      message: 'Waiting for the portal projects list to finish loading.',
    }
  ).not.toBe('loading');

  return projectsRegion.locator('tbody tr');
}

async function openDrawingWorkbench(page: Page) {
  const explicitUrl = process.env.PORTAL_DRAWING_URL?.trim();
  if (explicitUrl) {
    await page.goto(explicitUrl);
    await expect(page.getByRole('tab', { name: 'Designs' })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('tab', { name: 'Designs' }).click();
    return;
  }

  await page.goto('/staff/projects');
  await expect(page.getByRole('heading', { name: 'All Projects' })).toBeVisible({ timeout: 60_000 });

  const rows = await waitForProjectsList(page);
  const count = await rows.count();
  if (count === 0) {
    throw new Error('No projects are available for the portal browser pass. Set PORTAL_DRAWING_URL or create a fixture project.');
  }

  const attempts = Math.min(count, 8);
  for (let index = 0; index < attempts; index += 1) {
    await rows.nth(index).click();
    await page.waitForLoadState('networkidle');

    const designsTab = page.getByRole('tab', { name: 'Designs' });
    await expect(designsTab).toBeVisible({ timeout: 30_000 });
    await designsTab.click();

    const hasWorkbench = await page.getByLabel('Drawing workbench').first().isVisible().catch(() => false);
    const hasEmptyDrawing = await page.getByText('No plan or section drawing is available for this design.').first().isVisible().catch(() => false);
    if (hasWorkbench || hasEmptyDrawing) {
      return;
    }

    await page.goto('/staff/projects');
    await expect(page.getByRole('heading', { name: 'All Projects' })).toBeVisible({ timeout: 30_000 });
    await waitForProjectsList(page);
  }

  throw new Error('Could not find a project with an accessible drawing workbench. Set PORTAL_DRAWING_URL to a known fixture page.');
}

test('drawing workbench model-space smoke', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize({ width: 1680, height: 1050 });
  await openDrawingWorkbench(page);

  const emptyDrawing = page.getByText('No plan or section drawing is available for this design.');
  if (await emptyDrawing.isVisible().catch(() => false)) {
    test.skip(true, 'The selected project has no drawing geometry available for a browser feel pass.');
  }

  await expect(page.getByLabel('Drawing workbench')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('tab', { name: 'Model Space' }).click();
  await expect(page.getByLabel('Plan model space viewport')).toBeVisible();

  if (await page.getByRole('button', { name: 'Zoom in' }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Reset view' }).click();
  }

  if (await page.getByRole('button', { name: 'Rotate +90' }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Rotate +90' }).click();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  }

  await page.getByRole('tab', { name: 'Sheet View' }).click();
  await expect(page.getByLabel('Plan view A3 drawing sheet')).toBeVisible();

  const rightRail = page.locator('[data-project-rail="right"][data-project-design-rail-active="true"]').first();
  await expect(rightRail).toBeVisible();
  await expect(rightRail.getByText('Model Configurator', { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      return await rightRail.evaluate((node) => getComputedStyle(node as HTMLElement).overflowY);
    })
    .toBe('auto');

  const sectionToggleBackground = await page.getByRole('tab', { name: 'Section' }).evaluate((node) => getComputedStyle(node).backgroundColor);
  const configuratorActionBackground = await page.getByRole('button', { name: 'Open full calculator' }).evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(configuratorActionBackground).toBe(sectionToggleBackground);

  await page.getByRole('tab', { name: 'Quotes' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Model configurator')).toHaveCount(0);
  await expect(page.getByLabel('Drawing workbench')).toHaveCount(0);

  expect(pageErrors, `Unexpected runtime errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
