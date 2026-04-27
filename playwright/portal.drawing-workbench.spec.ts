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
  const roofMaterial = page.getByLabel('Roof material').first();
  if (await roofMaterial.isVisible().catch(() => false)) {
    await roofMaterial.selectOption('acrylic').catch(() => undefined);
  }
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

async function openFixtureDrawingWorkbench(page: Page, fixtureSlug: string) {
  await page.goto(`/staff/projects/fixture-roof/design-workbench?fixture=${fixtureSlug}`);
  const workbench = page.getByLabel('Drawing workbench');
  const unavailable = page.getByText(/Project unavailable|404|not found/i).first();
  if (await unavailable.isVisible().catch(() => false)) {
    test.skip(true, 'Fixture workbench route is not enabled in this portal environment.');
  }
  await expect(workbench).toBeVisible({ timeout: 30_000 });
}

test('drawing workbench screenshot U hipped roof fixture renders valid topology', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize({ width: 1680, height: 1050 });
  await openFixtureDrawingWorkbench(page, 'gable-u-hipped-screenshot');

  await page.getByRole('tab', { name: '3D View' }).click();
  await expectContained3DCanvas(page);

  const diagnostics = page.getByTestId('geometry-3d-viewport-diagnostics');
  await expect(diagnostics).toHaveAttribute('data-house-roof-qa-status', 'valid');
  await expect(diagnostics).toHaveAttribute('data-house-roof-topology-valley-count', '2');
  await expect(diagnostics).toHaveAttribute('data-house-roof-topology-disconnected-source-face-count', '0');
  await expect(diagnostics).toHaveAttribute('data-house-roof-topology-internal-eave-height-segment-count', '0');
  await expect
    .poll(async () => Number(await diagnostics.getAttribute('data-house-roof-solid-rendered-count')))
    .toBeGreaterThan(0);
  await expect(diagnostics).toHaveAttribute('data-house-roof-solid-skipped-count', '0');

  const shell = page.getByTestId('geometry-3d-canvas-shell');
  const screenshot = await shell.screenshot();
  expect(screenshot.byteLength).toBeGreaterThan(10_000);

  expect(pageErrors, `Unexpected runtime errors: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('drawing workbench draw outline fixture places the first point at the landing marker', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize({ width: 1680, height: 1050 });
  await openFixtureDrawingWorkbench(page, 'mono-standard');

  await page.getByRole('tab', { name: 'Model Space' }).click();
  await page.getByRole('tab', { name: 'Plan' }).click();

  const modelViewport = page.getByLabel('Plan model space viewport');
  const scroller = modelViewport.locator('[data-model-space-scroller]').first();
  const scaleFrame = modelViewport.locator('[data-model-space-scale-frame]').first();
  const planSvg = modelViewport.locator('svg[data-model-space-svg="plan"]').first();
  const focusTarget = modelViewport.locator('[data-model-space-focus-target]').first();

  await expect(modelViewport).toBeVisible();
  await expect(scroller).toBeVisible();
  await expect(scroller).toHaveAttribute('data-draw-outline-state', 'inactive');
  await expect(scroller).toHaveAttribute('data-draw-outline-point-count', '0');
  await expect(scroller).toHaveAttribute('data-draw-outline-preview-kind', 'none');
  await expect(scroller).toHaveAttribute('data-draw-outline-has-error', 'false');
  await expect(planSvg).toBeVisible();
  await expect(focusTarget).toHaveCount(1);
  await expect(modelViewport.getByRole('button', { name: '-' })).toBeVisible();
  await expect(modelViewport.getByRole('button', { name: '+' })).toBeVisible();
  await expect(modelViewport.getByRole('button', { name: 'Fit view' })).toBeVisible();
  await expect(scroller).toHaveAttribute('data-model-space-gesture', 'idle');
  await expect(scroller).toHaveAttribute('data-model-space-active-touch-count', '0');
  await expect(scroller).toHaveAttribute('data-model-space-pinch-active', 'false');
  await expect(scroller).toHaveAttribute('data-model-space-pinch-source', 'none');

  const navigationPoint = await planSvg.evaluate((svg) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = 60;
    point.y = 34;
    const screenPoint = point.matrixTransform(ctm);
    return { x: screenPoint.x, y: screenPoint.y };
  });
  expect(navigationPoint).not.toBeNull();
  if (!navigationPoint) throw new Error('Missing plan SVG navigation point.');

  const transformBeforeWheel = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
  await page.mouse.move(navigationPoint.x, navigationPoint.y);
  await page.mouse.wheel(28, 42);
  await expect(scroller).toHaveAttribute('data-model-space-gesture', 'wheel-pan');
  const transformAfterWheel = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
  expect(transformAfterWheel).not.toBe(transformBeforeWheel);

  const transformBeforePinch = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
  await page.evaluate((point) => {
    const dispatchTouchPointer = (target: EventTarget, type: string, pointerId: number, clientX: number, clientY: number) => {
      const event =
        typeof PointerEvent === 'function'
          ? new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId,
              pointerType: 'touch',
              clientX,
              clientY,
              button: 0,
            })
          : new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              clientX,
              clientY,
              button: 0,
            });
      if (typeof PointerEvent !== 'function' || !(event instanceof PointerEvent)) {
        Object.defineProperty(event, 'pointerId', { configurable: true, value: pointerId });
        Object.defineProperty(event, 'pointerType', { configurable: true, value: 'touch' });
      }
      target.dispatchEvent(event);
    };
    const firstTarget = document.elementFromPoint(point.x - 30, point.y) ?? document.body;
    const secondTarget = document.elementFromPoint(point.x + 30, point.y) ?? document.body;
    dispatchTouchPointer(firstTarget, 'pointerdown', 501, point.x - 30, point.y);
    dispatchTouchPointer(secondTarget, 'pointerdown', 502, point.x + 30, point.y);
  }, navigationPoint);
  await expect(scroller).toHaveAttribute('data-model-space-pinch-active', 'true');
  await expect(scroller).toHaveAttribute('data-model-space-pinch-source', 'touch-pointer');
  await page.evaluate((point) => {
    const dispatchTouchPointer = (target: EventTarget, type: string, pointerId: number, clientX: number, clientY: number) => {
      const event =
        typeof PointerEvent === 'function'
          ? new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId,
              pointerType: 'touch',
              clientX,
              clientY,
              button: 0,
            })
          : new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              clientX,
              clientY,
              button: 0,
            });
      if (typeof PointerEvent !== 'function' || !(event instanceof PointerEvent)) {
        Object.defineProperty(event, 'pointerId', { configurable: true, value: pointerId });
        Object.defineProperty(event, 'pointerType', { configurable: true, value: 'touch' });
      }
      target.dispatchEvent(event);
    };
    dispatchTouchPointer(window, 'pointermove', 502, point.x + 62, point.y + 8);
    dispatchTouchPointer(window, 'pointerup', 502, point.x + 62, point.y + 8);
  }, navigationPoint);
  await expect(scroller).toHaveAttribute('data-model-space-pinch-active', 'false');
  await expect(scroller).toHaveAttribute('data-model-space-active-touch-count', '0');
  await expect(scroller).toHaveAttribute('data-model-space-pinch-source', 'none');
  const transformAfterPinch = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
  expect(transformAfterPinch).not.toBe(transformBeforePinch);

  const transformBeforeWebKitGesture = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
  await page.evaluate((point) => {
    const dispatchGesture = (target: EventTarget, type: string, scale: number | undefined, clientX: number, clientY: number) => {
      const event = new Event(type, {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'scale', { configurable: true, value: scale });
      Object.defineProperty(event, 'clientX', { configurable: true, value: clientX });
      Object.defineProperty(event, 'clientY', { configurable: true, value: clientY });
      target.dispatchEvent(event);
    };
    const target = document.elementFromPoint(point.x, point.y) ?? document.body;
    dispatchGesture(target, 'gesturestart', 1, point.x, point.y);
    dispatchGesture(target, 'gesturechange', 1.22, point.x, point.y);
  }, navigationPoint);
  await expect(scroller).toHaveAttribute('data-model-space-gesture', 'trackpad-pinch');
  await expect(scroller).toHaveAttribute('data-model-space-pinch-active', 'true');
  await expect(scroller).toHaveAttribute('data-model-space-pinch-source', 'webkit-gesture');
  await page.evaluate((point) => {
    const event = new Event('gestureend', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'clientX', { configurable: true, value: point.x });
    Object.defineProperty(event, 'clientY', { configurable: true, value: point.y });
    (document.elementFromPoint(point.x, point.y) ?? document.body).dispatchEvent(event);
  }, navigationPoint);
  await expect(scroller).toHaveAttribute('data-model-space-pinch-active', 'false');
  await expect(scroller).toHaveAttribute('data-model-space-pinch-source', 'none');
  const transformAfterWebKitGesture = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
  expect(transformAfterWebKitGesture).not.toBe(transformBeforeWebKitGesture);

  const attachmentSideControl = page.getByLabel('Attachment side').first();
  if (await attachmentSideControl.isVisible().catch(() => false)) {
    const attachmentTransformBefore = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
    const nextAttachmentSide = await attachmentSideControl.evaluate((node) => {
      if (!(node instanceof HTMLSelectElement)) return null;
      const current = node.value;
      return Array.from(node.options).find((option) => !option.disabled && option.value && option.value !== current)?.value ?? null;
    });
    if (nextAttachmentSide) {
      await attachmentSideControl.selectOption(nextAttachmentSide);
      await expect(attachmentSideControl).toHaveValue(nextAttachmentSide);
      await page.waitForTimeout(100);
      const attachmentTransformAfter = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
      expect(attachmentTransformAfter).toBe(attachmentTransformBefore);

      await modelViewport.getByRole('button', { name: 'Fit view' }).click();
      const transformAfterFitView = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
      expect(transformAfterFitView).not.toBe(attachmentTransformAfter);
    }
  }

  const hasExistingCustomOutline = (await scroller.getAttribute('data-draw-outline-can-redraw')) === 'true';
  if (hasExistingCustomOutline) {
    await expect(modelViewport.getByRole('button', { name: 'Redraw outline' })).toBeVisible();
    await expect(modelViewport.locator('[data-footprint-custom-vertex="0"]')).toHaveCount(1);
    await modelViewport.getByRole('button', { name: 'Redraw outline' }).click();
    await expect(scroller).toHaveAttribute('data-draw-outline-state', 'first-point');
    await expect(scroller).toHaveAttribute('data-draw-outline-point-count', '0');
    await expect(scroller).toHaveAttribute('data-draw-outline-redraw-active', 'true');
    await expect(modelViewport.locator('[data-footprint-custom-vertex="0"]')).toHaveCount(0);
    await modelViewport.getByRole('button', { name: 'Cancel' }).click();
    await expect(scroller).toHaveAttribute('data-draw-outline-state', 'inactive');
    await expect(scroller).toHaveAttribute('data-draw-outline-can-redraw', 'true');
    await expect(modelViewport.locator('[data-footprint-custom-vertex="0"]')).toHaveCount(1);
  }

  const footprintMode = page.getByLabel('House footprint mode').first();
  await expect(footprintMode).toBeVisible();
  if (hasExistingCustomOutline) {
    await modelViewport.getByRole('button', { name: 'Redraw outline' }).click();
  } else {
    await footprintMode.selectOption('custom_polygon');
  }

  await expect(page.locator('[data-draw-outline-controls="true"]').first()).toBeVisible();
  await expect(scroller).toHaveAttribute('data-draw-outline-state', 'first-point');
  await expect(scroller).toHaveAttribute('data-draw-outline-has-pending-point', 'false');
  await expect(scroller).toHaveAttribute('data-draw-outline-close-ready', 'false');
  await expect(scroller).toHaveAttribute('data-draw-outline-has-landing-point', 'false');
  await expect(scroller).toHaveAttribute('data-draw-outline-gesture', 'idle');
  await expect(scroller).toHaveAttribute('data-draw-outline-pan-threshold-px', '5');
  await expect(scroller).toHaveAttribute('data-draw-outline-has-error', 'false');
  await expect(scroller).toHaveAttribute('data-draw-outline-draft-source', 'active-draft');
  await expect(modelViewport.locator('[data-footprint-edge]').first()).toHaveCount(0);
  await expect(modelViewport.locator('[data-footprint-resize-edge-hit]').first()).toHaveCount(0);

  const hoverPoint = await planSvg.evaluate((svg) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = 45;
    point.y = 28;
    const screenPoint = point.matrixTransform(ctm);
    return { x: screenPoint.x, y: screenPoint.y };
  });
  expect(hoverPoint).not.toBeNull();
  if (!hoverPoint) throw new Error('Missing plan SVG hover point.');

  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  const landingMarker = modelViewport.locator('[data-draw-outline-landing-marker="true"]').first();
  await expect(landingMarker).toHaveCount(1);
  await expect(scroller).toHaveAttribute('data-draw-outline-has-landing-point', 'true');

  const landing = await scroller.evaluate((node) => ({
    alongM: Number.parseFloat(node.getAttribute('data-draw-outline-landing-along-m') ?? ''),
    depthM: Number.parseFloat(node.getAttribute('data-draw-outline-landing-depth-m') ?? ''),
  }));
  expect(Number.isFinite(landing.alongM)).toBe(true);
  expect(Number.isFinite(landing.depthM)).toBe(true);
  expect(landing.alongM).toBeCloseTo(3.75, 2);
  expect(landing.depthM).toBeCloseTo(-2.333, 2);

  const transformBeforeDrag = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(hoverPoint.x + 34, hoverPoint.y + 18);
  await expect(scroller).toHaveAttribute('data-model-space-gesture', 'mouse-pan');
  await page.mouse.up({ button: 'right' });
  await expect(scroller).toHaveAttribute('data-draw-outline-gesture', 'idle');
  await expect(scroller).toHaveAttribute('data-draw-outline-point-count', '0');
  await expect(scroller).toHaveAttribute('data-draw-outline-state', 'first-point');
  const transformAfterDrag = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
  expect(transformAfterDrag).not.toBe(transformBeforeDrag);

  const clickPoint = await planSvg.evaluate((svg) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = 45;
    point.y = 28;
    const screenPoint = point.matrixTransform(ctm);
    return { x: screenPoint.x, y: screenPoint.y };
  });
  expect(clickPoint).not.toBeNull();
  if (!clickPoint) throw new Error('Missing plan SVG click point.');

  await page.mouse.click(clickPoint.x, clickPoint.y);
  await expect(scroller).toHaveAttribute('data-draw-outline-point-count', '1');
  await expect(scroller).toHaveAttribute('data-draw-outline-state', 'placing');
  await expect(modelViewport.locator('[data-footprint-custom-latest-vertex="true"]')).toHaveCount(1);
  await expect(modelViewport.locator('[data-footprint-edge]').first()).toHaveCount(0);
  await expect(modelViewport.locator('[data-footprint-resize-edge-hit]').first()).toHaveCount(0);

  const firstVertexHit = modelViewport.locator('[data-footprint-custom-vertex-hit="0"]').first();
  await expect(firstVertexHit).toHaveCount(1);
  const firstVertexBox = await firstVertexHit.boundingBox();
  expect(firstVertexBox).not.toBeNull();
  if (!firstVertexBox) throw new Error('Missing first vertex hit target bounds.');

  const transformBeforeOverlayDrag = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
  await page.mouse.move(firstVertexBox.x + firstVertexBox.width / 2, firstVertexBox.y + firstVertexBox.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(firstVertexBox.x + firstVertexBox.width / 2 + 28, firstVertexBox.y + firstVertexBox.height / 2 + 16);
  await expect(scroller).toHaveAttribute('data-model-space-gesture', 'mouse-pan');
  await page.mouse.up({ button: 'right' });
  await expect(scroller).toHaveAttribute('data-draw-outline-point-count', '1');
  const transformAfterOverlayDrag = await scaleFrame.evaluate((node) => getComputedStyle(node).transform);
  expect(transformAfterOverlayDrag).not.toBe(transformBeforeOverlayDrag);

  const outsidePoint = await planSvg.evaluate((svg) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = 45;
    point.y = -12;
    const screenPoint = point.matrixTransform(ctm);
    return { x: screenPoint.x, y: screenPoint.y };
  });
  expect(outsidePoint).not.toBeNull();
  if (!outsidePoint) throw new Error('Missing outside plan SVG click point.');
  await page.mouse.move(outsidePoint.x, outsidePoint.y);
  await expect(scroller).toHaveAttribute('data-draw-outline-has-landing-point', 'true');
  await page.mouse.click(outsidePoint.x, outsidePoint.y);
  await expect(scroller).toHaveAttribute('data-draw-outline-preview-kind', 'pending');
  await expect(modelViewport.locator('[data-footprint-custom-preview-edge="pending"]').first()).toHaveCount(1);
  await modelViewport.getByRole('button', { name: 'Undo' }).click();
  await expect(scroller).toHaveAttribute('data-draw-outline-state', 'placing');

  const secondPoint = await planSvg.evaluate((svg) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = 75;
    point.y = 28;
    const screenPoint = point.matrixTransform(ctm);
    return { x: screenPoint.x, y: screenPoint.y };
  });
  expect(secondPoint).not.toBeNull();
  if (!secondPoint) throw new Error('Missing second plan SVG click point.');
  await page.mouse.move(secondPoint.x, secondPoint.y);
  await expect(scroller).toHaveAttribute('data-draw-outline-preview-kind', 'hover');
  await expect(modelViewport.locator('[data-footprint-custom-preview-edge="hover"]').first()).toHaveCount(1);
  await page.mouse.click(secondPoint.x, secondPoint.y);
  await expect(scroller).toHaveAttribute('data-draw-outline-preview-kind', 'pending');
  await expect(modelViewport.locator('[data-footprint-custom-preview-edge="pending"]').first()).toHaveCount(1);
  await modelViewport.getByRole('button', { name: 'Confirm' }).click();
  await expect(scroller).toHaveAttribute('data-draw-outline-point-count', '2');
  await expect(modelViewport.locator('[data-footprint-custom-active-edge="true"]').first()).toHaveCount(1);

  const thirdPoint = await planSvg.evaluate((svg) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = 75;
    point.y = 48;
    const screenPoint = point.matrixTransform(ctm);
    return { x: screenPoint.x, y: screenPoint.y };
  });
  expect(thirdPoint).not.toBeNull();
  if (!thirdPoint) throw new Error('Missing third plan SVG click point.');
  await page.mouse.click(thirdPoint.x, thirdPoint.y);
  await modelViewport.getByRole('button', { name: 'Confirm' }).click();
  await expect(scroller).toHaveAttribute('data-draw-outline-point-count', '3');
  await expect(scroller).toHaveAttribute('data-draw-outline-state', 'close-ready');
  await expect(modelViewport.locator('[data-footprint-custom-close-hit="0"]')).toHaveCount(1);

  const closeHoverPoint = await planSvg.evaluate((svg) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = 45.05;
    point.y = 28.05;
    const screenPoint = point.matrixTransform(ctm);
    return { x: screenPoint.x, y: screenPoint.y };
  });
  expect(closeHoverPoint).not.toBeNull();
  if (!closeHoverPoint) throw new Error('Missing close-hover plan SVG point.');
  await page.mouse.move(closeHoverPoint.x, closeHoverPoint.y);
  await expect(scroller).toHaveAttribute('data-draw-outline-state', 'close-hovered');
  await expect(scroller).toHaveAttribute('data-draw-outline-close-hovered', 'true');
  await expect(modelViewport.locator('[data-footprint-custom-close-hovered="true"]').first()).toBeVisible();
  await expect(modelViewport.locator('[data-footprint-custom-close-preview="true"]').first()).toHaveCount(1);
  const closeHoverScreenshot = await modelViewport.screenshot();
  expect(closeHoverScreenshot.byteLength).toBeGreaterThan(10_000);

  expect(pageErrors, `Unexpected runtime errors: ${pageErrors.join(' | ')}`).toEqual([]);
});

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
  const appliedMovedHouseContext = await maybeApplyMovedHouse3DContext(page);

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
  const centerWorkspace = page.locator('[data-estimates-workspace-scroll="true"]').first();
  await expect(centerWorkspace).toBeVisible();
  await expect
    .poll(async () => {
      return await centerWorkspace.evaluate((node) => getComputedStyle(node as HTMLElement).overflowY);
    })
    .toBe('auto');

  const sectionToggleBackground = await page.getByRole('tab', { name: 'Section' }).evaluate((node) => getComputedStyle(node).backgroundColor);
  const configuratorActionBackground = await page.getByRole('button', { name: 'Open full calculator' }).evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(configuratorActionBackground).toBe(sectionToggleBackground);

  await page.getByRole('tab', { name: '3D View' }).click();
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

  await page.getByRole('tab', { name: 'Quotes' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Model configurator')).toHaveCount(0);
  await expect(page.getByLabel('Drawing workbench')).toHaveCount(0);

  expect(pageErrors, `Unexpected runtime errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
