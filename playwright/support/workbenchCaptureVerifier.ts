import type { Page, TestInfo } from '@playwright/test';

import { redactEvidenceValue, type PortalBrowserEvidenceContext } from './portalBrowserEvidence';
import {
  readWorkbenchCapturedReproPayload,
  type NormalizedWorkbenchCapturedRepro,
  type UnknownRecord,
} from './workbenchCapturedRepro';

type WorkbenchCaptureFailureReason =
  | 'missing_object_first'
  | 'missing_house_forms'
  | 'not_multi_house'
  | 'missing_house_diagnostics'
  | 'no_failing_house';

type WorkbenchMultiHouseRoofFailureVerification = {
  ok: boolean;
  reason: WorkbenchCaptureFailureReason | null;
  message: string;
  houseFormIds: string[];
  failingHouseFormIds: string[];
  details: string[];
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function getObjectFirstHouseFormIds(payload: NormalizedWorkbenchCapturedRepro): string[] {
  const objectFirst = asRecord(payload.objectFirst);
  const houseAssembly = asRecord(objectFirst?.houseAssembly);
  const houseForms = Array.isArray(houseAssembly?.houseForms) ? houseAssembly.houseForms : null;
  if (!houseForms) return [];

  return houseForms
    .map((houseForm) => asString(asRecord(houseForm)?.id))
    .filter((id): id is string => Boolean(id))
    .sort();
}

function mapRecordsById(records: unknown[], idField: string): Map<string, UnknownRecord> {
  const byId = new Map<string, UnknownRecord>();
  for (const item of records) {
    const record = asRecord(item);
    const id = asString(record?.[idField]);
    if (record && id) byId.set(id, record);
  }
  return byId;
}

function stageIsFailing(stage: unknown): boolean {
  return typeof stage === 'string' && stage.length > 0 && stage !== 'none';
}

function hasDiagnosticCode(record: UnknownRecord | null): boolean {
  return Boolean(asString(record?.diagnosticCode) ?? asString(record?.roofPipelineDiagnosticCode));
}

function houseHasInconsistentRenderHealth(health: UnknownRecord | null): boolean {
  if (!health) return true;

  const roofBodyCount = asNumber(health.roofBodyCount) ?? 0;
  const sceneBodyCount = asNumber(health.sceneBodyCount) ?? 0;
  const canRenderCommittedBody = health.canRenderCommittedBody === true;
  const visibleFallbackIds = asStringArray(health.visibleReferenceFallbackIds);

  return (
    stageIsFailing(health.failureStage) ||
    hasDiagnosticCode(health) ||
    !canRenderCommittedBody ||
    visibleFallbackIds.length > 0 ||
    roofBodyCount <= 0 ||
    sceneBodyCount <= 0
  );
}

function houseHasFailingGeometryInput(input: UnknownRecord | null): boolean {
  if (!input) return true;
  return (
    stageIsFailing(input.failureStage) ||
    stageIsFailing(input.roofPipelineFailureStage) ||
    hasDiagnosticCode(input)
  );
}

function explainHouseFailure(
  houseFormId: string,
  input: UnknownRecord | null,
  health: UnknownRecord | null,
): string {
  const parts = [
    `houseFormId=${houseFormId}`,
    `inputStage=${asString(input?.failureStage) ?? 'missing_input'}`,
    `roofPipelineStage=${asString(input?.roofPipelineFailureStage) ?? 'none'}`,
    `healthStage=${asString(health?.failureStage) ?? 'missing_health'}`,
    `diagnosticCode=${asString(health?.diagnosticCode) ?? asString(input?.diagnosticCode) ?? asString(input?.roofPipelineDiagnosticCode) ?? 'none'}`,
    `roofBodies=${asNumber(health?.roofBodyCount) ?? 0}`,
    `sceneBodies=${asNumber(health?.sceneBodyCount) ?? 0}`,
    `canRenderCommittedBody=${health?.canRenderCommittedBody === true}`,
    `fallbacks=${asStringArray(health?.visibleReferenceFallbackIds).length}`,
  ];
  return parts.join(' ');
}

function failure(
  reason: WorkbenchCaptureFailureReason,
  message: string,
  houseFormIds: string[],
  failingHouseFormIds: string[] = [],
  details: string[] = [],
): WorkbenchMultiHouseRoofFailureVerification {
  return { ok: false, reason, message, houseFormIds, failingHouseFormIds, details };
}

export function verifyWorkbenchMultiHouseRoofFailureCapture(
  payload: NormalizedWorkbenchCapturedRepro,
): WorkbenchMultiHouseRoofFailureVerification {
  const objectFirst = asRecord(payload.objectFirst);
  if (!objectFirst) {
    return failure(
      'missing_object_first',
      'Capture is not the multi-house bug: objectFirst state is missing.',
      payload.validation.houseFormIds,
    );
  }

  const houseFormIds = getObjectFirstHouseFormIds(payload);
  if (houseFormIds.length === 0) {
    return failure(
      'missing_house_forms',
      'Capture is not the multi-house bug: objectFirst.houseAssembly.houseForms is missing or empty.',
      payload.validation.houseFormIds,
    );
  }

  if (houseFormIds.length < 2) {
    return failure(
      'not_multi_house',
      `Capture is not the multi-house bug: expected at least 2 object-first house forms, found ${houseFormIds.length}.`,
      houseFormIds,
    );
  }

  const houseInputs = payload.renderDiagnostics.houseGeometryInputsById;
  const houseHealthById = mapRecordsById(payload.renderDiagnostics.projectHouseProjectionHealth, 'houseFormId');
  const missingDiagnostics = houseFormIds.filter(
    (houseFormId) => !asRecord(houseInputs[houseFormId]) || !houseHealthById.has(houseFormId),
  );

  if (missingDiagnostics.length > 0) {
    return failure(
      'missing_house_diagnostics',
      `Capture is not usable for the multi-house roof bug: missing per-house diagnostics for ${missingDiagnostics.join(', ')}.`,
      houseFormIds,
      missingDiagnostics,
      missingDiagnostics.map((houseFormId) =>
        explainHouseFailure(houseFormId, asRecord(houseInputs[houseFormId]), houseHealthById.get(houseFormId) ?? null),
      ),
    );
  }

  const failingHouseFormIds = houseFormIds.filter((houseFormId) => {
    const input = asRecord(houseInputs[houseFormId]);
    const health = houseHealthById.get(houseFormId) ?? null;
    return houseHasFailingGeometryInput(input) || houseHasInconsistentRenderHealth(health);
  });

  const details = houseFormIds.map((houseFormId) =>
    explainHouseFailure(houseFormId, asRecord(houseInputs[houseFormId]), houseHealthById.get(houseFormId) ?? null),
  );

  if (failingHouseFormIds.length === 0) {
    return failure(
      'no_failing_house',
      'Capture is not the multi-house roof bug: all object-first houses report healthy geometry/render stages.',
      houseFormIds,
      [],
      details,
    );
  }

  return {
    ok: true,
    reason: null,
    message: `Accepted multi-house roof failure capture with failing house form(s): ${failingHouseFormIds.join(', ')}.`,
    houseFormIds,
    failingHouseFormIds,
    details,
  };
}

export async function readAndVerifyWorkbenchMultiHouseRoofFailureCapture(
  page: Page,
): Promise<{
  payload: NormalizedWorkbenchCapturedRepro;
  verification: WorkbenchMultiHouseRoofFailureVerification;
}> {
  const payload = await readWorkbenchCapturedReproPayload(page);
  if (!payload) {
    throw new Error('Workbench capture verifier could not find a workbench debug fixture payload on the page.');
  }
  return {
    payload,
    verification: verifyWorkbenchMultiHouseRoofFailureCapture(payload),
  };
}

export async function attachWorkbenchCaptureVerification(
  testInfo: TestInfo,
  payload: NormalizedWorkbenchCapturedRepro,
  verification: WorkbenchMultiHouseRoofFailureVerification,
  context: PortalBrowserEvidenceContext = {},
) {
  await testInfo.attach('workbench-capture-verification.json', {
    body: JSON.stringify(redactEvidenceValue({ context, verification, payload }), null, 2),
    contentType: 'application/json',
  });
}
