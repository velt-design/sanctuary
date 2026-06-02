import { expect, type Page } from '@playwright/test';

export async function openWorkbenchFixture(page: Page, fixtureSlug: string) {
  await page.goto(`/qa/design-workbench-fixture?fixture=${encodeURIComponent(fixtureSlug)}`);
  await expect(page.locator('[data-workbench-fixture]').first()).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState('networkidle');
}

export async function switchWorkbenchMode(page: Page, modeName: string) {
  await page.getByRole('tab', { name: modeName }).first().click();
}

export async function selectRailObject(page: Page, family: string, objectId: string) {
  await page.locator(`[data-workbench-object-button="${family}:${objectId}"]`).click();
  await expect(page.locator(`[data-active-workbench-object="${family}:${objectId}"]`).first()).toBeVisible();
}

export async function clearPlanSelection(page: Page) {
  await page.locator('[data-plan-viewport="true"]').click({ position: { x: 8, y: 8 } });
  await expect(page.locator('[data-plan-viewport="true"]')).toHaveAttribute(
    'data-plan-selection-halo-count',
    '0',
  );
}

async function readPlanShapeIds(page: Page, selector = '[data-plan-shape-id]'): Promise<string[]> {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute('data-plan-shape-id'))
      .filter((value): value is string => Boolean(value))
      .sort(),
  );
}

export async function readVisibleHouseBodyIds(page: Page): Promise<string[]> {
  const ids = await readPlanShapeIds(
    page,
    '[data-plan-shape-family="house"][data-plan-shape-id]',
  );
  return ids.filter((id) => id.startsWith('house_roof_material:') || id.startsWith('house_surface_solid:'));
}

export async function readVisibleHouseReferenceFallbackIds(page: Page): Promise<string[]> {
  const ids = await readPlanShapeIds(
    page,
    '[data-plan-visible-reference-fallback="true"][data-plan-shape-id]',
  );
  return ids.sort();
}

export async function readPlanHouseRenderDiagnostics(page: Page): Promise<Array<{
  houseFormId: string;
  referenceIds: string[];
  roofBodyIds: string[];
  roofMaterialBodyIds: string[];
  visibleReferenceFallbackIds: string[];
  hitTargetIds: string[];
}>> {
  const raw = await page.locator('[data-plan-viewport="true"]').getAttribute('data-plan-house-render-diagnostics');
  if (!raw) return [];
  return JSON.parse(raw);
}

export async function readPlanHouseProjectionHealth(page: Page): Promise<Array<{
  houseFormId: string;
  geometryInputPresent: boolean;
  rawHouseInputPresent: boolean;
  footprintPointCount: number;
  referencePresent: boolean;
  modelPresent: boolean;
  wallCount: number;
  roofPlaneCount: number;
  roofBodyCount: number;
  roofMaterialBodyCount: number;
  planBodyIds: string[];
  roofBodyIds: string[];
  roofMaterialBodyIds: string[];
  sceneBodyCount: number;
  sceneRoofBodyCount: number;
  sceneRoofMaterialBodyCount: number;
  canRenderCommittedBody: boolean;
  visibleReferenceFallbackIds: string[];
  failureStage: string;
  diagnosticCode: string | null;
  roofValidationStatus: string | null;
  roofValidationCode: string | null;
  eavePolygonPointCount: number;
  roofIntentForm: string | null;
  roofIntentPitchDeg: number | null;
  roofIntentRidgeAxis: string | null;
  roofGeometry: string | null;
  roofFacetMergeMode: string | null;
  roofTopologyFailureReason: string | null;
  roofTopologyFinalFaceCount: number | null;
  roofTopologySourceEdgeCount: number | null;
  roofTopologyDisconnectedSourceFaceCount: number | null;
  roofTopologyInternalEaveHeightSegmentCount: number | null;
  roofTopologyProjectionViolationCount: number | null;
  roofWavefrontFailureReason: string | null;
  roofQaStatus: string | null;
  roofQaFailureReason: string | null;
  roofQaRejectedFacetCount: number | null;
  roofQaFacetAreaMm2: number | null;
  roofQaEaveAreaMm2: number | null;
  roofQaAreaDeltaMm2: number | null;
  roofPlaneCountBeforeQa: number;
  roofPlaneCountAfterQa: number;
  roofMaterialVisualCount: number;
  roofSolidCount: number;
}>> {
  const raw = await page.locator('[data-plan-viewport="true"]').getAttribute('data-plan-house-projection-health');
  if (!raw) return [];
  return JSON.parse(raw);
}

export async function readPlanPergolaRenderHealth(page: Page): Promise<Array<{
  pergolaId: string;
  moduleId: string;
  sourceKind: string;
  solveStatus: string;
  hostObjectId?: string | null;
  hostEdgeId?: string | null;
  attachmentEdgeId?: string | null;
  attachmentZoneId?: string | null;
  hostAttachmentStatus: string;
  hostAttachmentCode: string | null;
  placementStatus?: string;
  placementCode?: string | null;
  planBodyCount: number;
  sceneBodyCount: number;
  canRenderCommittedBody: boolean;
  suppressedCommittedBodyReason: string;
}>> {
  const raw = await page.locator('[data-plan-viewport="true"]').getAttribute('data-plan-pergola-render-health');
  if (!raw) return [];
  return JSON.parse(raw);
}

export async function readVisiblePergolaShapeIds(page: Page): Promise<string[]> {
  return readPlanShapeIds(
    page,
    '[data-plan-shape-family="pergola"][data-plan-shape-id]',
  );
}

export async function readPlanPergolaFallbackIds(page: Page): Promise<string[]> {
  const raw = await page.locator('[data-plan-viewport="true"]').getAttribute('data-plan-pergola-fallback-ids');
  return raw ? raw.split(',').filter(Boolean).sort() : [];
}

export async function expectPlanPergolaFallbackIsOutlineOnly(page: Page, pergolaId: string) {
  const style = await page
    .locator(`[data-plan-pergola-fallback="true"][data-plan-shape-id="pergola_reference:${pergolaId}"]`)
    .first()
    .evaluate((node) => {
      const computed = window.getComputedStyle(node);
      return { fill: computed.fill, stroke: computed.stroke };
    });
  expect(['none', 'transparent', 'rgba(0, 0, 0, 0)']).toContain(style.fill);
  expect(style.stroke).not.toBe('none');
  expect(style.stroke).not.toBe('rgba(0, 0, 0, 0)');
}

export async function readCommittedPergolaBodyIds(page: Page): Promise<string[]> {
  return readPlanShapeIds(
    page,
    '[data-plan-layer="committedBodies"] [data-plan-shape-family="pergola"][data-plan-shape-id]',
  );
}

export async function readCommittedBodyShapeIdsInPaintOrder(page: Page): Promise<string[]> {
  return page
    .locator('[data-plan-layer="committedBodies"] [data-plan-shape-id]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute('data-plan-shape-id'))
        .filter((value): value is string => Boolean(value)),
    );
}

export async function readHouseHitTargetIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-plan-shape-family="house"][data-plan-hit-shape-id]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute('data-plan-hit-shape-id'))
        .filter((value): value is string => Boolean(value))
        .sort(),
    );
}

export async function readPlanSelectionIds(page: Page): Promise<string[]> {
  return page.locator('[data-plan-selection-shape-id]').evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute('data-plan-selection-shape-id'))
      .filter((value): value is string => Boolean(value))
      .sort(),
  );
}

export async function readPlanLocalHoverIds(page: Page): Promise<string[]> {
  return page.locator('[data-plan-local-hover-shape-id]').evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute('data-plan-local-hover-shape-id'))
      .filter((value): value is string => Boolean(value))
      .sort(),
  );
}

export async function hoverPlanHitTarget(page: Page, shapeId: string) {
  await page.locator(`[data-plan-hit-shape-id="${shapeId}"]`).first().evaluate((node) => {
    node.dispatchEvent(
      new PointerEvent('pointerover', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
      }),
    );
  });
}

export async function expectPlanHitTargetPaintIsInvisible(page: Page, shapeId: string) {
  const style = await page.locator(`[data-plan-hit-shape-id="${shapeId}"]`).first().evaluate((node) => {
    const computed = window.getComputedStyle(node);
    return { fill: computed.fill, stroke: computed.stroke };
  });
  expect(['transparent', 'rgba(0, 0, 0, 0)']).toContain(style.fill);
  expect(['none', 'rgba(0, 0, 0, 0)']).toContain(style.stroke);
}

export async function expectPlanVisibleReferenceFallbackIsOutlineOnly(page: Page, shapeId: string) {
  const style = await page.locator(`[data-plan-visible-reference-fallback="true"][data-plan-shape-id="${shapeId}"]`).first().evaluate((node) => {
    const computed = window.getComputedStyle(node);
    return { fill: computed.fill, stroke: computed.stroke };
  });
  expect(['transparent', 'rgba(0, 0, 0, 0)']).toContain(style.fill);
  expect(style.stroke).not.toBe('none');
  expect(style.stroke).not.toBe('rgba(0, 0, 0, 0)');
}

export async function expect3DViewportEvidence(page: Page) {
  const shell = page.locator('[data-testid="geometry-3d-canvas-shell"]').first();
  await expect(shell).toBeVisible();

  const diagnostics = page.locator('[data-testid="geometry-3d-viewport-diagnostics"]').first();
  await expect(diagnostics).toHaveAttribute('data-finite-bounds', 'true');

  const objectCount = Number(await diagnostics.getAttribute('data-scene-object-count'));
  const layerCount = Number(await diagnostics.getAttribute('data-layer-count'));
  expect(Number.isFinite(objectCount)).toBe(true);
  expect(Number.isFinite(layerCount)).toBe(true);
  expect(objectCount).toBeGreaterThan(0);
  expect(layerCount).toBeGreaterThan(0);

  const box = await shell.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(100);
  expect(box?.height ?? 0).toBeGreaterThan(100);
}

export async function read3DPergolaRenderHealth(page: Page): Promise<Array<{
  pergolaId: string;
  moduleId: string;
  sourceKind: string;
  solveStatus: string;
  hostObjectId?: string | null;
  hostEdgeId?: string | null;
  attachmentEdgeId?: string | null;
  attachmentZoneId?: string | null;
  hostAttachmentStatus: string;
  hostAttachmentCode: string | null;
  placementStatus?: string;
  placementCode?: string | null;
  planBodyCount: number;
  sceneBodyCount: number;
  canRenderCommittedBody: boolean;
  suppressedCommittedBodyReason: string;
}>> {
  const raw = await page
    .locator('[data-testid="geometry-3d-viewport-diagnostics"]')
    .first()
    .getAttribute('data-project-pergola-render-health');
  if (!raw) return [];
  return JSON.parse(raw);
}

export async function read3DPergolaFallbackIds(page: Page): Promise<string[]> {
  const raw = await page
    .locator('[data-testid="geometry-3d-viewport-diagnostics"]')
    .first()
    .getAttribute('data-project-pergola-fallback-ids');
  return raw ? raw.split(',').filter(Boolean).sort() : [];
}

export async function read3DProjectPreviewSource(page: Page): Promise<string> {
  return (
    (await page
      .locator('[data-testid="geometry-3d-viewport-diagnostics"]')
      .first()
      .getAttribute('data-project-preview-source')) ?? ''
  );
}

export async function readWorkbenchDebugExport(page: Page): Promise<unknown> {
  const raw = await page
    .locator('[data-workbench-debug-export="true"]')
    .first()
    .textContent();
  return raw ? JSON.parse(raw) : null;
}

export async function readWorkbenchDebugHouseGeometryInputs(page: Page): Promise<Record<string, unknown>> {
  const payload = await readWorkbenchDebugExport(page);
  if (!payload || typeof payload !== 'object') return {};
  const diagnostics = (payload as { renderDiagnostics?: { houseGeometryInputsById?: Record<string, unknown> } })
    .renderDiagnostics;
  return diagnostics?.houseGeometryInputsById ?? {};
}
