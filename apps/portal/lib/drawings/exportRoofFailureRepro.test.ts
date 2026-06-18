import { describe, expect, it } from 'vitest';
import { EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS } from '@sp/geometry';
import type { HouseFormModel } from './state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchRoofInspectorModel } from './state/objectWorkbenchInspectorModel';
import {
  ROOF_FAILURE_REPRO_SCHEMA_VERSION,
  buildRoofFailureRepro,
  buildRoofFailureReproFilename,
} from './exportRoofFailureRepro';

const FIXED_NOW = '2026-06-18T08:30:00.000Z';

function makeHouseForm(): HouseFormModel {
  return {
    id: 'house-1',
    label: 'House 1',
    transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
    footprint: {
      mode: 'custom_polygon',
      preset: 'straight',
      params: {
        widthM: '8',
        offsetXM: '0',
        setbackM: '0',
        bandDepthM: '6',
        returnRunM: '0',
        recessWidthM: '0',
        recessDepthM: '0',
        leftLegRunM: '0',
        rightLegRunM: '0',
        sideRunM: '0',
      },
      polygon: [
        { alongM: '0', depthM: '0' },
        { alongM: '8', depthM: '0' },
        { alongM: '8', depthM: '6' },
        { alongM: '0', depthM: '6' },
      ],
      attachmentSide: 'rear',
    },
    roofIntent: {
      form: 'hipped',
      material: 'corrugated_iron',
      primaryPitchDeg: '22',
      primaryFallDirection: 'positive_y',
      ridgeAxis: 'x',
      openGableEndIds: ['end-1'],
    },
    storeyMode: 'single_storey',
    attachmentStrategy: null,
  };
}

function makeInspectorRoof(
  overrides?: Partial<ObjectWorkbenchRoofInspectorModel>,
): ObjectWorkbenchRoofInspectorModel {
  return {
    intent: {
      form: 'hipped',
      material: 'corrugated_iron',
      primaryPitchDeg: '22',
      primaryFallDirection: 'positive_y',
      ridgeAxis: 'x',
      openGableEndIds: ['end-1'],
    },
    controls: { pitch: true, material: true, primaryFallDirection: false, ridgeAxis: true },
    selectedFormSupported: true,
    terminalEnds: [
      { id: 'end-1', label: 'Front', isOpen: true },
      { id: 'end-2', label: 'Rear', isOpen: false },
    ],
    geometryKind: 'orthogonal_hipped',
    validationStatus: 'invalid',
    validationCode: 'eave_offset_self_overlap',
    validationMessage: 'Roof geometry failed package QA: eave_offset_self_overlap.',
    approximationReasons: [],
    stageDiagnostics: {
      ...EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
      eavePolygonConstructionStatus: 'failed',
      eaveOffsetTopologyStatus: 'invalid',
      eaveOffsetTopologyFailureReason: 'eave_offset_self_overlap',
    },
    failingStage: {
      id: 'eave_polygon_construction',
      label: 'Eave polygon construction',
      code: 'eave_offset_self_overlap',
    },
    provenance: {},
    ...overrides,
  };
}

describe('buildRoofFailureRepro (PR-HR1)', () => {
  it('produces a schema-versioned payload with geometry-only fields', () => {
    const payload = buildRoofFailureRepro(
      { houseForm: makeHouseForm(), roof: makeInspectorRoof() },
      { now: FIXED_NOW },
    );

    expect(payload.schemaVersion).toBe(ROOF_FAILURE_REPRO_SCHEMA_VERSION);
    expect(payload.capturedAt).toBe(FIXED_NOW);
    expect(payload.validationStatus).toBe('invalid');
    expect(payload.validationCode).toBe('eave_offset_self_overlap');
    expect(payload.failingStage?.id).toBe('eave_polygon_construction');
    expect(payload.footprint.polygonLocalM).toHaveLength(4);
    expect(payload.roofIntent.form).toBe('hipped');
    expect(payload.roofIntent.openGableEndIds).toEqual(['end-1']);
    expect(payload.terminalEnds).toHaveLength(2);
    expect(payload.stageDiagnostics.eaveOffsetTopologyFailureReason).toBe(
      'eave_offset_self_overlap',
    );
  });

  it('redacts customer-identifying fields by construction (no name, no project, no contact)', () => {
    const payload = buildRoofFailureRepro(
      { houseForm: makeHouseForm(), roof: makeInspectorRoof() },
      { now: FIXED_NOW },
    );
    const json = JSON.stringify(payload);

    // House display label is "House 1" in the fixture; the repro must
    // not carry it. Same for the id (which can leak ordering info).
    expect(json).not.toContain('House 1');
    expect(json).not.toContain('"house-1"');
    // No customer or project metadata anywhere.
    expect(json).not.toContain('contact');
    expect(json).not.toContain('siteAddress');
    expect(json).not.toContain('projectName');
    // Terminal-end labels (e.g. "Front", "Rear") ARE geometry
    // identifiers, not PII; assert they survive so the fixture is
    // engineer-usable.
    expect(json).toContain('"Front"');
  });

  it('round-trips through JSON.stringify/JSON.parse losslessly', () => {
    const payload = buildRoofFailureRepro(
      { houseForm: makeHouseForm(), roof: makeInspectorRoof() },
      { now: FIXED_NOW },
    );
    const round = JSON.parse(JSON.stringify(payload));
    expect(round).toEqual(payload);
  });

  it('supports approximate roofs as well as invalid ones', () => {
    const payload = buildRoofFailureRepro(
      {
        houseForm: makeHouseForm(),
        roof: makeInspectorRoof({
          validationStatus: 'approximate',
          validationCode: null,
          validationMessage: null,
          approximationReasons: ['inferred_form'],
          failingStage: null,
        }),
      },
      { now: FIXED_NOW },
    );

    expect(payload.validationStatus).toBe('approximate');
    expect(payload.approximationReasons).toEqual(['inferred_form']);
    expect(payload.failingStage).toBeNull();
  });

  it('throws when called with a valid roof status (no failure to report)', () => {
    expect(() =>
      buildRoofFailureRepro({
        houseForm: makeHouseForm(),
        roof: makeInspectorRoof({ validationStatus: 'valid' }),
      }),
    ).toThrow(/validationStatus=valid/);
  });

  it('throws when called with a null validation status (no solved model yet)', () => {
    expect(() =>
      buildRoofFailureRepro({
        houseForm: makeHouseForm(),
        roof: makeInspectorRoof({ validationStatus: null }),
      }),
    ).toThrow(/validationStatus=null/);
  });
});

describe('buildRoofFailureReproFilename (PR-HR1)', () => {
  it('embeds failing-stage id, validation code, and timestamp', () => {
    const payload = buildRoofFailureRepro(
      { houseForm: makeHouseForm(), roof: makeInspectorRoof() },
      { now: FIXED_NOW },
    );
    const filename = buildRoofFailureReproFilename(payload);
    expect(filename).toMatch(/^roof-failure_eave_polygon_construction_eave_offset_self_overlap_/);
    expect(filename).toContain('2026-06-18');
    expect(filename.endsWith('.json')).toBe(true);
  });

  it('falls back to validationStatus when no failing stage is present', () => {
    const payload = buildRoofFailureRepro(
      {
        houseForm: makeHouseForm(),
        roof: makeInspectorRoof({
          validationStatus: 'approximate',
          validationCode: null,
          failingStage: null,
        }),
      },
      { now: FIXED_NOW },
    );
    const filename = buildRoofFailureReproFilename(payload);
    expect(filename).toMatch(/^roof-failure_approximate_/);
  });

  it('sanitizes weird characters in validation code', () => {
    const payload = buildRoofFailureRepro(
      {
        houseForm: makeHouseForm(),
        roof: makeInspectorRoof({
          validationCode: 'eave/offset+bad',
          failingStage: {
            id: 'eave_polygon_construction',
            label: 'Eave polygon construction',
            code: 'eave/offset+bad',
          },
        }),
      },
      { now: FIXED_NOW },
    );
    const filename = buildRoofFailureReproFilename(payload);
    expect(filename).not.toContain('/');
    expect(filename).not.toContain('+');
  });
});
