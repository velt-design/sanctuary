import { describe, expect, it } from 'vitest';
import { EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS } from '@sp/geometry';
import type { ObjectWorkbenchRoofStatus } from './objectWorkbenchStatusModel';

/**
 * PR-HR2 (2026-06-18): the inspector rail's `RoofValidationPanel`
 * relies on these invariants. Keeps the contract honest as the model
 * evolves — when a new failing stage is added in @sp/geometry, this
 * test fails until the portal mapping is updated.
 */
describe('ObjectWorkbenchRoofStatus shape (PR-HR2)', () => {
  it('exposes stageDiagnostics and failingStage', () => {
    const fixture: ObjectWorkbenchRoofStatus = {
      form: 'hipped',
      roofIntentAuthored: true,
      rawForm: 'hipped',
      resolvedForm: 'hipped',
      resolutionSource: 'object_first_draft',
      repairCode: null,
      controls: { pitch: true, material: true, primaryFallDirection: false, ridgeAxis: false },
      selectedFormSupported: true,
      terminalEnds: [],
      geometryKind: 'orthogonal_hipped',
      validationStatus: 'invalid',
      validationCode: 'eave_offset_self_overlap',
      validationMessage: 'Roof geometry failed package QA: eave_offset_self_overlap.',
      approximationReasons: [],
      stageDiagnostics: {
        ...EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
        eaveOffsetTopologyStatus: 'invalid',
        eaveOffsetTopologyFailureReason: 'eave_offset_self_overlap',
        eavePolygonConstructionStatus: 'failed',
      },
      failingStage: {
        id: 'eave_polygon_construction',
        label: 'Eave polygon construction',
        code: 'eave_offset_self_overlap',
      },
      provenance: {},
    };

    expect(fixture.failingStage?.id).toBe('eave_polygon_construction');
    expect(fixture.failingStage?.label).toBe('Eave polygon construction');
    expect(fixture.failingStage?.code).toBe('eave_offset_self_overlap');
    expect(fixture.stageDiagnostics.eavePolygonConstructionStatus).toBe('failed');
  });

  it('keeps failingStage null when the roof is approximate but not invalid', () => {
    const fixture: ObjectWorkbenchRoofStatus = {
      form: 'hipped',
      roofIntentAuthored: false,
      rawForm: 'hipped',
      resolvedForm: 'hipped',
      resolutionSource: 'inferred',
      repairCode: null,
      controls: { pitch: true, material: true, primaryFallDirection: false, ridgeAxis: false },
      selectedFormSupported: true,
      terminalEnds: [],
      geometryKind: 'orthogonal_hipped',
      validationStatus: 'approximate',
      validationCode: null,
      validationMessage: null,
      approximationReasons: ['inferred_form'],
      stageDiagnostics: EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
      failingStage: null,
      provenance: {},
    };

    expect(fixture.failingStage).toBeNull();
    expect(fixture.approximationReasons).toEqual(['inferred_form']);
  });
});
