import { test, expect, type Page } from '@playwright/test';

function expectNoUnexpectedRuntimeErrors(pageErrors: string[]) {
  const unexpectedErrors = pageErrors.filter(
    (message) => message.trim() !== 'Error creating WebGL context.',
  );
  expect(
    unexpectedErrors,
    `Unexpected runtime errors: ${unexpectedErrors.join(' | ')}`,
  ).toEqual([]);
}

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

    const hasWorkbench = await page.getByRole('region', { name: 'Drawing workbench' }).first().isVisible().catch(() => false);
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

async function maybeApplyMovedHouse3DContext(page: Page): Promise<boolean> {
  const houseWidth = page.getByLabel('House width (m)').first();
  if (!(await houseWidth.isVisible().catch(() => false))) {
    return false;
  }

  const pergolaFamily = page.getByLabel('Pergola family').first();
  if (await pergolaFamily.isVisible().catch(() => false)) {
    await pergolaFamily.selectOption('gable').catch(() => undefined);
  }

  await page.getByLabel('Roof length (m)').first().fill('5').catch(() => undefined);
  await page.getByLabel('Roof span (m)').first().fill('5').catch(() => undefined);
  await page.getByLabel('Roof pitch (deg)').first().fill('20').catch(() => undefined);

  const houseConnection = page.getByLabel('House connection').first();
  if (await houseConnection.isVisible().catch(() => false)) {
    await houseConnection.selectOption('fascia').catch(() => undefined);
  }

  const attachmentSide = page.getByLabel('Attachment side').first();
  if (await attachmentSide.isVisible().catch(() => false)) {
    await attachmentSide.selectOption('front').catch(() => undefined);
  }

  const attachmentStrategy = page.getByLabel('Attachment strategy').first();
  if (await attachmentStrategy.isVisible().catch(() => false)) {
    await attachmentStrategy.selectOption('fascia_under_gutter').catch(() => undefined);
  }

  await page.getByLabel('House roof pitch (deg)').first().fill('20').catch(() => undefined);
  await page.getByLabel('Eave overhang (mm)').first().fill('1000').catch(() => undefined);

  await houseWidth.fill('8');
  await page.getByLabel('House offset X (m)').first().fill('-1').catch(() => undefined);
  await page.getByLabel('Facade setback (m)').first().fill('0.4').catch(() => undefined);
  await page.getByLabel('Footprint band depth (m)').first().fill('1.8').catch(() => undefined);
  const footprintMode = page.getByLabel('House footprint mode').first();
  if (await footprintMode.isVisible().catch(() => false)) {
    await footprintMode.selectOption('preset').catch(() => undefined);
  }
  const footprintPreset = page.getByLabel('House footprint').first();
  if (await footprintPreset.isVisible().catch(() => false)) {
    await footprintPreset.selectOption('u_shape').catch(() => undefined);
    await page.getByLabel('Left leg run (m)').first().fill('5').catch(() => undefined);
    await page.getByLabel('Right leg run (m)').first().fill('5').catch(() => undefined);
  }
  await houseWidth.blur();
  return true;
}

async function expectContained3DCanvas(page: Page) {
  const viewport = page.getByLabel('3D geometry verification viewport');
  const shell = page.getByTestId('geometry-3d-canvas-shell');
  const canvas = shell.locator('[data-testid="geometry-3d-canvas"], canvas').first();
  const diagnostics = page.getByTestId('geometry-3d-viewport-diagnostics');

  await expect(viewport).toBeVisible({ timeout: 30_000 });
  await expect(shell).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(diagnostics).toHaveAttribute('data-finite-bounds', 'true');

  await expect
    .poll(
      async () => {
        const shellBox = await shell.boundingBox();
        const canvasBox = await canvas.boundingBox();
        if (!shellBox || !canvasBox) return 'missing';
        const contained =
          canvasBox.x >= shellBox.x - 1 &&
          canvasBox.y >= shellBox.y - 1 &&
          canvasBox.x + canvasBox.width <= shellBox.x + shellBox.width + 1 &&
          canvasBox.y + canvasBox.height <= shellBox.y + shellBox.height + 1 &&
          canvasBox.width <= shellBox.width + 1 &&
          canvasBox.height <= shellBox.height + 1;
        return contained ? 'contained' : `${JSON.stringify({ shellBox, canvasBox })}`;
      },
      {
        timeout: 10_000,
        message: 'Waiting for the 3D canvas to remain inside its viewport shell.',
      }
    )
    .toBe('contained');

  const viewportSize = page.viewportSize();
  const canvasBox = await canvas.boundingBox();
  if (viewportSize && canvasBox) {
    expect(canvasBox.width).toBeLessThanOrEqual(viewportSize.width);
    expect(canvasBox.height).toBeLessThanOrEqual(viewportSize.height);
  }

  await expect(viewport).not.toContainText(/NaN|Infinity/);
}

async function expectTopProjectionPlanParity(page: Page) {
  const planSvg = page.locator('[data-plan-viewport="true"]').first();

  await expect(planSvg).toBeVisible();
  await expect(planSvg).toHaveAttribute('data-plan-render-source', 'geometry-canvas');
  await expect(planSvg).toHaveAttribute('data-plan-render-status', 'ready');
  await expect(planSvg).toHaveAttribute('data-plan-screen-axis', 'world_x_left_world_y_down');
  await expect(page.locator('[data-top-projection-role="hidden_from_top"]')).toHaveCount(0);
  await expect(
    page.locator(
      '[data-plan-layer="committedBodies"] [data-plan-shape-id="house_surface_solid:active-module-house-roof"]',
    ),
  ).toHaveCount(0);
  await expect
    .poll(async () => Number(await planSvg.getAttribute('data-plan-committed-body-count')))
    .toBeGreaterThan(0);
  await expect
    .poll(async () => Number(await planSvg.getAttribute('data-plan-hit-target-count')))
    .toBeGreaterThan(0);

  const screenshot = await planSvg.screenshot();
  expect(screenshot.byteLength).toBeGreaterThan(5_000);
}

async function expectWorkbenchPricingDisconnected(page: Page, fixtureSlug: string) {
  const route = page.locator(`main[data-workbench-context="fixture_ready"][data-workbench-fixture="${fixtureSlug}"]`).first();

  await expect(route).toBeVisible();
  await expect(route).not.toHaveAttribute('data-workbench-pricing-source');
  await expect(route).not.toHaveAttribute('data-workbench-pricing-readiness');
}

async function openFixtureDrawingWorkbench(page: Page, fixtureSlug: string) {
  await page.goto(`/staff/projects/fixture-roof/design-workbench?fixture=${fixtureSlug}`);
  const workbench = page.getByRole('region', { name: 'Drawing workbench' });
  const unavailable = page.getByText(/Project unavailable|This page could not be found|404|not found/i).first();
  const login = page.getByRole('heading', { name: 'Staff Login' }).first();
  const routeState = await Promise.race([
    workbench.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'workbench' as const),
    unavailable.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'unavailable' as const),
    login.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'login' as const),
  ]).catch(() => null);
  if (routeState === 'unavailable') {
    throw new Error('Fixture workbench route is not enabled in this portal environment; browser smoke coverage did not run.');
  }
  if (routeState === 'login') {
    throw new Error('Fixture workbench route requires staff auth in this portal environment; browser smoke coverage did not run.');
  }
  await expect(workbench).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-fixture-workbench-hydrated="true"]').first()).toBeVisible({ timeout: 30_000 });
}

test('drawing workbench snapshot-only mono fixture does not synthesize object-first geometry', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize({ width: 1680, height: 1050 });
  await openFixtureDrawingWorkbench(page, 'mono-standard');
  await expectWorkbenchPricingDisconnected(page, 'mono-standard');

  const workbench = page.getByRole('region', { name: 'Drawing workbench' });
  await expect(workbench).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Staff Login' })).toHaveCount(0);
  await expect(page.getByText(/Project unavailable|This page could not be found|404|not found/i)).toHaveCount(0);
  await expect(page.getByText(/fixture route is not enabled|requires staff auth/i)).toHaveCount(0);
  await expect(workbench).toContainText('No object-first workbench geometry is available.');

  await page.getByRole('tab', { name: 'Plan' }).click();
  await expect(workbench).toContainText('Plan view unavailable: no solved geometry artifact.');

  await page.getByRole('tab', { name: '3D' }).click();
  await expect(workbench).toContainText('3D Preview Error');
  await expect(workbench).not.toContainText(/legacy fallback|unsupported geometry fallback|Project unavailable|Staff Login/i);

  expectNoUnexpectedRuntimeErrors(pageErrors);
});

test('drawing workbench object-first U hipped roof fixture keeps Plan and 3D trustworthy', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize({ width: 1680, height: 1050 });
  await openFixtureDrawingWorkbench(page, 'gable-u-hipped-screenshot');
  await expectWorkbenchPricingDisconnected(page, 'gable-u-hipped-screenshot');

  const workbench = page.getByRole('region', { name: 'Drawing workbench' });
  await expect(workbench).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Staff Login' })).toHaveCount(0);
  await expect(page.getByText(/Project unavailable|This page could not be found|404|not found/i)).toHaveCount(0);
  await expect(page.getByText(/No plan or section drawing is available|fixture route is not enabled|requires staff auth/i)).toHaveCount(0);

  await page.getByRole('tab', { name: 'Plan' }).click();
  await expectTopProjectionPlanParity(page);

  await page.getByRole('tab', { name: '3D' }).click();
  await expectContained3DCanvas(page);

  const diagnostics = page.getByTestId('geometry-3d-viewport-diagnostics');
  await expect(diagnostics).toHaveAttribute('data-finite-bounds', 'true');
  await expect
    .poll(async () => Number(await diagnostics.getAttribute('data-scene-object-count')))
    .toBeGreaterThan(0);

  const shell = page.getByTestId('geometry-3d-canvas-shell');
  const screenshot = await shell.screenshot();
  expect(screenshot.byteLength).toBeGreaterThan(10_000);
  await expect(workbench).not.toContainText(/legacy fallback|unsupported geometry fallback|Project unavailable|Staff Login/i);

  expectNoUnexpectedRuntimeErrors(pageErrors);
});

for (const fixtureSlug of ['mono-join-screenshot', 'multi-house-u-two-pergola'] as const) {
  test(`drawing workbench ${fixtureSlug} fixture keeps plan and 3D smoke trustworthy`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.setViewportSize({ width: 1680, height: 1050 });
    await openFixtureDrawingWorkbench(page, fixtureSlug);
    await expectWorkbenchPricingDisconnected(page, fixtureSlug);

    const workbench = page.getByRole('region', { name: 'Drawing workbench' });
    await expect(workbench).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Staff Login' })).toHaveCount(0);
    await expect(page.getByText(/Project unavailable|This page could not be found|404|not found/i)).toHaveCount(0);
    await expect(page.getByText(/No plan or section drawing is available|fixture route is not enabled|requires staff auth/i)).toHaveCount(0);

    await page.getByRole('tab', { name: 'Plan' }).click();
    await expectTopProjectionPlanParity(page);

    await page.getByRole('tab', { name: '3D' }).click();
    await expectContained3DCanvas(page);

    const diagnostics = page.getByTestId('geometry-3d-viewport-diagnostics');
    await expect(diagnostics).toHaveAttribute('data-finite-bounds', 'true');

    const shell = page.getByTestId('geometry-3d-canvas-shell');
    const screenshot = await shell.screenshot();
    expect(screenshot.byteLength).toBeGreaterThan(10_000);
    await expect(workbench).not.toContainText(/legacy fallback|unsupported geometry fallback|Project unavailable|Staff Login/i);

    expectNoUnexpectedRuntimeErrors(pageErrors);
  });
}

test('drawing workbench fixture route rejects unknown fixtures without ready pricing diagnostics', async ({ page }) => {
  await page.goto('/staff/projects/fixture-roof/design-workbench?fixture=not-real');

  const invalidFixture = page.locator('main[data-workbench-context="invalid_fixture"][data-workbench-fixture="not-real"]').first();
  await expect(invalidFixture).toBeVisible({ timeout: 30_000 });
  await expect(invalidFixture.getByText('Route state: Invalid Fixture')).toBeVisible();
  await expect(invalidFixture.getByText('Unknown fixture slug: not-real')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Drawing workbench' })).toHaveCount(0);
  await expect(page.locator('[data-workbench-pricing-source]')).toHaveCount(0);
  await expect(page.locator('[data-workbench-pricing-readiness]')).toHaveCount(0);
});

test('drawing workbench Plan Editor smoke', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'portal-fixture' && !process.env.PORTAL_DRAWING_URL?.trim()) {
    test.skip(true, 'Auth-backed project discovery is covered by the portal-chromium project.');
  }

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

  await expect(page.getByRole('region', { name: 'Drawing workbench' })).toBeVisible({ timeout: 30_000 });
  const appliedMovedHouseContext = await maybeApplyMovedHouse3DContext(page);

  await page.getByRole('tab', { name: 'Plan' }).click();
  await expect(page.getByRole('img', { name: 'Plan editor' })).toBeVisible();

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
  const centerWorkspace = page.locator('[data-estimates-workspace-scroll="true"]').first();
  await expect(centerWorkspace).toBeVisible();
  await expect
    .poll(async () => {
      return await centerWorkspace.evaluate((node) => getComputedStyle(node as HTMLElement).overflowY);
    })
    .toBe('auto');

  const planToggleBackground = await page.getByRole('tab', { name: 'Plan' }).evaluate((node) => getComputedStyle(node).backgroundColor);
  const configuratorActionBackground = await page.getByRole('button', { name: 'Open full calculator' }).evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(planToggleBackground).toBeTruthy();
  expect(configuratorActionBackground).toBeTruthy();

  const geometry3dTab = page.getByRole('tab', { name: '3D' });
  if (await geometry3dTab.isVisible().catch(() => false)) {
    await geometry3dTab.click();
    await expectContained3DCanvas(page);
    if (appliedMovedHouseContext) {
      const diagnostics = page.getByTestId('geometry-3d-viewport-diagnostics');
      await expect(diagnostics).toHaveAttribute('data-house-roof-qa-status', 'valid');
      await expect
        .poll(async () => Number(await diagnostics.getAttribute('data-house-roof-solid-expected-count')))
        .toBeGreaterThan(0);
      await expect
        .poll(async () => Number(await diagnostics.getAttribute('data-house-roof-solid-rendered-count')))
        .toBeGreaterThan(0);
      await expect(diagnostics).toHaveAttribute('data-house-roof-solid-skipped-count', '0');
    }
  } else {
    test.info().annotations.push({
      type: 'note',
      description: 'Selected embedded drawing workbench does not expose a 3D tab.',
    });
  }

  await page.getByRole('tab', { name: 'Quotes' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Model configurator')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Drawing workbench' })).toHaveCount(0);

  expectNoUnexpectedRuntimeErrors(pageErrors);
});
