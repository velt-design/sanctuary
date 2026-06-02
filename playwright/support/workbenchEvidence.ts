import type { Locator, Page, TestInfo } from '@playwright/test';

import {
  redactEvidenceValue,
  shouldAttachRichPortalEvidence,
  type PortalBrowserEvidenceContext,
} from './portalBrowserEvidence';

type Attributes = Record<string, string>;

async function readAttributes(locator: Locator, prefix?: string): Promise<Attributes | null> {
  if ((await locator.count()) === 0) return null;

  return locator.first().evaluate(
    (node, attrPrefix) => {
      const entries: Array<[string, string]> = [];
      for (const attr of Array.from(node.attributes)) {
        if (!attrPrefix || attr.name.startsWith(attrPrefix)) {
          entries.push([attr.name, attr.value]);
        }
      }
      return Object.fromEntries(entries);
    },
    prefix,
  );
}

async function readShapeIds(locator: Locator, attrName: string): Promise<string[]> {
  if ((await locator.count()) === 0) return [];
  return locator.evaluateAll((nodes, name) =>
    nodes
      .map((node) => node.getAttribute(name))
      .filter((value): value is string => Boolean(value))
      .sort(),
    attrName,
  );
}

async function screenshotLocator(
  testInfo: TestInfo,
  name: string,
  locator: Locator,
): Promise<number | null> {
  if ((await locator.count()) === 0) return null;
  if (!(await locator.first().isVisible().catch(() => false))) return null;

  const screenshot = await locator.first().screenshot().catch(() => null);
  if (!screenshot) return null;

  await testInfo.attach(name, {
    body: screenshot,
    contentType: 'image/png',
  });

  return screenshot.byteLength;
}

export async function readPlanViewportEvidence(page: Page) {
  const viewport = page.locator('[data-plan-viewport="true"]').first();
  if ((await viewport.count()) === 0) return null;

  return {
    attributes: await readAttributes(viewport, 'data-plan-'),
    committedBodyIds: await readShapeIds(
      page.locator('[data-plan-layer="committedBodies"] [data-plan-shape-id]'),
      'data-plan-shape-id',
    ),
    diagnosticFallbackIds: await readShapeIds(
      page.locator('[data-plan-layer="diagnosticFallbacks"] [data-plan-shape-id]'),
      'data-plan-shape-id',
    ),
    hitTargetIds: await readShapeIds(page.locator('[data-plan-hit-shape-id]'), 'data-plan-hit-shape-id'),
    selectionIds: await readShapeIds(
      page.locator('[data-plan-selection-shape-id]'),
      'data-plan-selection-shape-id',
    ),
    localHoverIds: await readShapeIds(
      page.locator('[data-plan-local-hover-shape-id]'),
      'data-plan-local-hover-shape-id',
    ),
    bounds: await viewport.boundingBox().catch(() => null),
  };
}

export async function readGeometry3DViewportEvidence(page: Page) {
  const diagnostics = page.locator('[data-testid="geometry-3d-viewport-diagnostics"]').first();
  const shell = page.locator('[data-testid="geometry-3d-canvas-shell"]').first();
  const canvas = page.locator('[data-testid="geometry-3d-canvas"], [data-testid="geometry-3d-canvas-shell"] canvas, canvas').first();

  if ((await diagnostics.count()) === 0 && (await shell.count()) === 0) return null;

  return {
    diagnosticsAttributes: await readAttributes(diagnostics, 'data-'),
    shellBounds: (await shell.count()) > 0 ? await shell.boundingBox().catch(() => null) : null,
    canvasBounds: (await canvas.count()) > 0 ? await canvas.boundingBox().catch(() => null) : null,
  };
}

export async function attachWorkbenchViewportEvidence(
  testInfo: TestInfo,
  page: Page,
  context: PortalBrowserEvidenceContext = {},
  options: { forceRich?: boolean } = {},
) {
  const rich = shouldAttachRichPortalEvidence(testInfo, options.forceRich);
  const planViewport = page.locator('[data-plan-viewport="true"]').first();
  const geometryShell = page.locator('[data-testid="geometry-3d-canvas-shell"]').first();

  const plan = await readPlanViewportEvidence(page).catch((error) => ({
    readError: String(error),
  }));
  const geometry3d = await readGeometry3DViewportEvidence(page).catch((error) => ({
    readError: String(error),
  }));

  const screenshotByteLengths = rich
    ? {
        planViewport: await screenshotLocator(testInfo, 'workbench-plan-viewport.png', planViewport),
        geometry3d: await screenshotLocator(testInfo, 'workbench-3d-viewport.png', geometryShell),
      }
    : null;

  if (!plan && !geometry3d && !screenshotByteLengths) return;

  await testInfo.attach('workbench-viewport-evidence.json', {
    body: JSON.stringify(
      redactEvidenceValue({
        context,
        richEvidenceAttached: rich,
        screenshotByteLengths,
        plan,
        geometry3d,
      }),
      null,
      2,
    ),
    contentType: 'application/json',
  });
}
