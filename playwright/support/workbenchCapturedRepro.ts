import type { Page, TestInfo } from '@playwright/test';

import { readPortalPageDebugExport, type PortalPageDebugExportPayload } from './portalAgent';
import { redactEvidenceValue, type PortalBrowserEvidenceContext } from './portalBrowserEvidence';

type UnknownRecord = Record<string, unknown>;

type WorkbenchCapturedReproPayload = {
  snapshot: UnknownRecord | null;
  objectFirst: UnknownRecord | null;
  selectedState: UnknownRecord;
  renderDiagnostics: {
    projectPreviewSource: string | null;
    houseGeometryInputsById: UnknownRecord;
    projectHouseProjectionHealth: unknown[];
    projectPergolaRenderHealth: unknown[];
  };
};

type WorkbenchCapturedReproValidation = {
  houseFormIds: string[];
  projectPreviewSource: string | null;
  projectHouseHealthCount: number;
  projectPergolaHealthCount: number;
};

type NormalizedWorkbenchCapturedRepro = WorkbenchCapturedReproPayload & {
  validation: WorkbenchCapturedReproValidation;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value: unknown, field: string): UnknownRecord {
  if (!isRecord(value)) {
    throw new Error(`Workbench captured repro payload requires ${field}.`);
  }
  return value;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Workbench captured repro payload requires ${field}.`);
  }
  return value;
}

function normalizeWorkbenchDebugFixturePayload(payload: unknown): NormalizedWorkbenchCapturedRepro {
  const root = requireRecord(payload, 'workbenchDebugFixture');

  if (!('snapshot' in root)) {
    throw new Error('Workbench captured repro payload requires snapshot.');
  }
  const snapshot = root.snapshot;
  if (snapshot !== null && !isRecord(snapshot)) {
    throw new Error('Workbench captured repro payload snapshot must be an object or null.');
  }

  if (!('objectFirst' in root)) {
    throw new Error('Workbench captured repro payload requires objectFirst.');
  }
  const objectFirst = root.objectFirst;
  if (objectFirst !== null && objectFirst !== undefined && !isRecord(objectFirst)) {
    throw new Error('Workbench captured repro payload objectFirst must be an object or null.');
  }

  const selectedState = requireRecord(root.selectedState, 'selectedState');
  const renderDiagnostics = requireRecord(root.renderDiagnostics, 'renderDiagnostics');
  const houseGeometryInputsById = requireRecord(
    renderDiagnostics.houseGeometryInputsById,
    'renderDiagnostics.houseGeometryInputsById',
  );
  const projectHouseProjectionHealth = requireArray(
    renderDiagnostics.projectHouseProjectionHealth,
    'renderDiagnostics.projectHouseProjectionHealth',
  );
  const projectPergolaRenderHealth = requireArray(
    renderDiagnostics.projectPergolaRenderHealth,
    'renderDiagnostics.projectPergolaRenderHealth',
  );

  if (!('projectPreviewSource' in renderDiagnostics) || renderDiagnostics.projectPreviewSource === undefined) {
    throw new Error('Workbench captured repro payload requires renderDiagnostics.projectPreviewSource.');
  }
  const projectPreviewSource = renderDiagnostics.projectPreviewSource;
  if (projectPreviewSource !== null && typeof projectPreviewSource !== 'string') {
    throw new Error('Workbench captured repro payload projectPreviewSource must be a string or null.');
  }

  const houseFormIds = Object.keys(houseGeometryInputsById).sort();
  if (houseFormIds.length === 0) {
    throw new Error('Workbench captured repro payload requires at least one house geometry input.');
  }

  return {
    snapshot: snapshot ?? null,
    objectFirst: objectFirst ?? null,
    selectedState,
    renderDiagnostics: {
      projectPreviewSource,
      houseGeometryInputsById,
      projectHouseProjectionHealth,
      projectPergolaRenderHealth,
    },
    validation: {
      houseFormIds,
      projectPreviewSource,
      projectHouseHealthCount: projectHouseProjectionHealth.length,
      projectPergolaHealthCount: projectPergolaRenderHealth.length,
    },
  };
}

export function extractWorkbenchCapturedReproPayload(
  debugExport: PortalPageDebugExportPayload | unknown,
): NormalizedWorkbenchCapturedRepro {
  if (isRecord(debugExport) && isRecord(debugExport.diagnostics)) {
    const nested = debugExport.diagnostics.workbenchDebugFixture;
    if (nested !== undefined) {
      return normalizeWorkbenchDebugFixturePayload(nested);
    }
    if ('version' in debugExport || 'pageId' in debugExport) {
      throw new Error('Portal page debug export does not include diagnostics.workbenchDebugFixture.');
    }
  }

  return normalizeWorkbenchDebugFixturePayload(debugExport);
}

async function readRawWorkbenchDebugExport(page: Page): Promise<unknown | null> {
  const locator = page.locator('[data-workbench-debug-export="true"]').first();
  if ((await locator.count()) === 0) return null;

  const raw = await locator.textContent();
  if (!raw) return null;

  return JSON.parse(raw) as unknown;
}

export async function readWorkbenchCapturedReproPayload(
  page: Page,
): Promise<NormalizedWorkbenchCapturedRepro | null> {
  const portalDebugExport = await readPortalPageDebugExport(page);
  if (portalDebugExport) {
    return extractWorkbenchCapturedReproPayload(portalDebugExport);
  }

  const rawWorkbenchDebugExport = await readRawWorkbenchDebugExport(page);
  if (!rawWorkbenchDebugExport) return null;

  return extractWorkbenchCapturedReproPayload(rawWorkbenchDebugExport);
}

export async function attachWorkbenchCapturedReproPayload(
  testInfo: TestInfo,
  page: Page,
  context: PortalBrowserEvidenceContext = {},
) {
  const payload = await readWorkbenchCapturedReproPayload(page).catch((error) => ({
    readError: String(error),
  }));

  if (!payload) return;

  await testInfo.attach('workbench-captured-repro-payload.json', {
    body: JSON.stringify(redactEvidenceValue({ context, payload }), null, 2),
    contentType: 'application/json',
  });
}
