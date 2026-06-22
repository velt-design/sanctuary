import { describe, expect, it } from 'vitest';

import { extractWorkbenchCapturedReproPayload } from './workbenchCapturedRepro';
import { verifyWorkbenchMultiHouseRoofFailureCapture } from './workbenchCaptureVerifier';

function buildPayload({
  objectFirstHouseIds,
  failingHouseId,
  includeObjectFirst = true,
}: {
  objectFirstHouseIds: string[];
  failingHouseId?: string;
  includeObjectFirst?: boolean;
}) {
  const houseGeometryInputsById = Object.fromEntries(
    objectFirstHouseIds.map((houseFormId) => [
      houseFormId,
      {
        houseFormId,
        failureStage: failingHouseId === houseFormId ? 'missing_plan_body' : 'none',
        roofPipelineFailureStage: 'none',
        diagnosticCode: failingHouseId === houseFormId ? 'missing_plan_body' : null,
      },
    ]),
  );

  return extractWorkbenchCapturedReproPayload({
    snapshot: { inputs: { modules: [{ id: 'module-1' }] } },
    objectFirst: includeObjectFirst
      ? {
          houseAssembly: {
            houseForms: objectFirstHouseIds.map((id) => ({ id })),
          },
          pergolas: [{ id: 'pergola-1' }],
        }
      : null,
    selectedState: {
      activeObjectRef: null,
      activePergolaId: null,
      activeModuleIndex: 0,
      viewportMode: 'plan',
    },
    renderDiagnostics: {
      projectPreviewSource: 'project_pipeline',
      houseGeometryInputsById,
      projectHouseProjectionHealth: objectFirstHouseIds.map((houseFormId) => ({
        houseFormId,
        failureStage: failingHouseId === houseFormId ? 'missing_plan_body' : 'none',
        diagnosticCode: failingHouseId === houseFormId ? 'missing_plan_body' : null,
        roofBodyCount: failingHouseId === houseFormId ? 0 : 1,
        sceneBodyCount: failingHouseId === houseFormId ? 0 : 4,
        canRenderCommittedBody: failingHouseId !== houseFormId,
        visibleReferenceFallbackIds: failingHouseId === houseFormId ? [`house_reference:${houseFormId}`] : [],
      })),
      projectPergolaRenderHealth: [
        {
          pergolaId: 'pergola-1',
          canRenderCommittedBody: true,
        },
      ],
    },
  });
}

describe('workbenchCaptureVerifier', () => {
  it('rejects a valid but one-house healthy payload as not the multi-house bug', () => {
    const result = verifyWorkbenchMultiHouseRoofFailureCapture(
      buildPayload({ objectFirstHouseIds: ['house-main'] }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_multi_house');
    expect(result.houseFormIds).toEqual(['house-main']);
  });

  it('rejects payloads without object-first state', () => {
    const result = verifyWorkbenchMultiHouseRoofFailureCapture(
      buildPayload({ objectFirstHouseIds: ['house-main'], includeObjectFirst: false }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing_object_first');
  });

  it('rejects multi-house captures when all houses are healthy', () => {
    const result = verifyWorkbenchMultiHouseRoofFailureCapture(
      buildPayload({ objectFirstHouseIds: ['house-form-1', 'house-form-2'] }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_failing_house');
    expect(result.houseFormIds).toEqual(['house-form-1', 'house-form-2']);
  });

  it('accepts multi-house captures with a failing house-form roof/render stage', () => {
    const result = verifyWorkbenchMultiHouseRoofFailureCapture(
      buildPayload({
        objectFirstHouseIds: ['house-form-1', 'house-form-2'],
        failingHouseId: 'house-form-2',
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.failingHouseFormIds).toEqual(['house-form-2']);
    expect(result.message).toContain('house-form-2');
  });

  it('treats missing per-house health as an unusable multi-house capture', () => {
    const payload = buildPayload({ objectFirstHouseIds: ['house-form-1', 'house-form-2'] });
    payload.renderDiagnostics.projectHouseProjectionHealth = [
      {
        houseFormId: 'house-form-1',
        failureStage: 'none',
      },
    ];

    const result = verifyWorkbenchMultiHouseRoofFailureCapture(payload);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing_house_diagnostics');
    expect(result.failingHouseFormIds).toEqual(['house-form-2']);
  });
});
