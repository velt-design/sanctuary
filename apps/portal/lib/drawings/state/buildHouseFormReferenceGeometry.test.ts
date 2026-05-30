import { describe, expect, it } from 'vitest';
import { buildHouseFormReferenceGeometry } from './buildHouseFormReferenceGeometry';
import { buildHouseFormRawGeometryInput } from './houseFormRawGeometry';
import type { HouseFormModel } from './objectFirstWorkbenchModel';

const HOUSE_FORM_PRESET_REGRESSION_CASES = [
  'straight',
  'recess_right',
  'l_right',
  'wrap_right',
] as const;

function makeStraightHouseForm(overrides: Partial<HouseFormModel> = {}): HouseFormModel {
  return {
    id: 'house-form-2',
    label: 'House 2',
    transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
    footprint: {
      mode: 'preset',
      preset: 'straight',
      params: {
        widthM: '8',
        bandDepthM: '6',
        offsetXM: '0',
        setbackM: '0',
        returnRunM: '2.4',
        recessWidthM: '2.4',
        recessDepthM: '1.2',
        leftLegRunM: '2.4',
        rightLegRunM: '2.4',
        sideRunM: '2.4',
      },
      polygon: [],
      attachmentSide: 'rear',
    },
    roofIntent: {
      form: 'mono',
      material: 'corrugated_iron',
      primaryPitchDeg: '5',
      primaryFallDirection: 'negative_y',
      ridgeAxis: 'x',
      openGableEndIds: [],
    },
    storeyMode: 'single_storey',
    attachmentStrategy: null,
    eaveHeightM: '2.4',
    wallHeightM: '2.4',
    soffitDepthMm: '450',
    fasciaHeightMm: '180',
    gutterWidthMm: '125',
    gutterDepthMm: '90',
    gutterProjectionMm: '125',
    eaveOverhangMm: '450',
    ...overrides,
  };
}

function polygonMinX(polygon: ReadonlyArray<{ x: number }>): number {
  return Math.min(...polygon.map((point) => point.x));
}

describe('buildHouseFormReferenceGeometry', () => {
  it('builds the shared raw-house boundary from the form id and transform', () => {
    const result = buildHouseFormRawGeometryInput(
      makeStraightHouseForm({
        id: 'house-main',
        transform: { offsetXM: 2.5, offsetYM: -1.25, rotationQuarterTurns: 1 },
      }),
    );

    expect(result?.rawHouse).toEqual(expect.objectContaining({
      houseId: 'house-main',
      footprintMode: 'preset',
      footprintPreset: 'straight',
      position: {
        origin: { x: 2500, y: -1250 },
        rotationDeg: 90,
      },
      roofForm: 'mono',
      roofMaterial: 'corrugated_iron',
    }));
    expect(result?.footprint.length).toBeGreaterThanOrEqual(4);
  });

  it('produces a non-null geometry with walls and roof for a basic preset form', () => {
    // Sanity: the freestanding path (PR8b geometry lift + PR8c-i position
    // export + this PR8c-ii portal wiring) actually produces renderable
    // geometry. If this regresses we lost end-to-end coverage of multi-
    // form rendering before any viewport even sees it.
    const result = buildHouseFormReferenceGeometry({ houseForm: makeStraightHouseForm() });
    expect(result).not.toBeNull();
    expect(result?.model).not.toBeNull();
    expect(result?.model?.wallSegments.length).toBeGreaterThan(0);
    expect(result?.model?.roofPlanes.length).toBeGreaterThan(0);
  });

  it('leaves pergola-attachment fields null for a freestanding form', () => {
    // Freestanding reference forms have no pergola host in this path.
    // explicit decision). The geometry must not synthesise a wallPlane,
    // fasciaLine, roofEdgeLine, or attachmentTarget -- those concepts
    // belong to pergola-attached forms and would confuse downstream
    // consumers if non-null here.
    const result = buildHouseFormReferenceGeometry({ houseForm: makeStraightHouseForm() });
    expect(result?.wallPlane).toBeNull();
    expect(result?.fasciaLine).toBeNull();
    expect(result?.roofEdgeLine).toBeNull();
    expect(result?.attachmentTarget).toBeNull();
  });

  it('applies the form transform to the footprint (10 m east default offset survives into world coords)', () => {
    // The default `addHouseFormToObjectFirstDraft` (PR5) offsets cloned
    // forms by 10 m east so they don't render on top of the source.
    // PR8c-ii's job is to make sure that offset reaches the world-space
    // geometry. After this helper, every footprint vertex must have
    // x >= 10000 (the form is to the east of origin).
    const result = buildHouseFormReferenceGeometry({
      houseForm: makeStraightHouseForm({
        transform: { offsetXM: 10, offsetYM: 0, rotationQuarterTurns: 0 },
      }),
    });
    expect(result?.footprint).not.toBeNull();
    for (const vertex of result?.footprint ?? []) {
      expect(vertex.x).toBeGreaterThanOrEqual(10000);
    }
    // The wall segments are built from the local footprint then transformed.
    // Any wall vertex must also be at least 10m east -- proves the transform
    // reached the model, not just the outer footprint.
    for (const wall of result?.model?.wallSegments ?? []) {
      expect(wall.line.start.x).toBeGreaterThanOrEqual(10000);
      expect(wall.line.end.x).toBeGreaterThanOrEqual(10000);
    }
  });

  it('clears the position field so downstream applyAssemblyPosition3D does not double-translate', () => {
    // The transform has been baked into every vertex by applyHouseReference
    // Position. Leaving `position` set would cause a downstream caller to
    // re-apply the offset, doubling the placement. The contract test for
    // applyHouseReferencePosition (PR8c-i) already locks this in at the
    // geometry layer; this test mirrors it from the portal consumer side.
    const result = buildHouseFormReferenceGeometry({
      houseForm: makeStraightHouseForm({
        transform: { offsetXM: 10, offsetYM: 0, rotationQuarterTurns: 0 },
      }),
    });
    expect(result?.position).toBeNull();
  });

  it('accepts the primary house id without special-casing it out of reference geometry', () => {
    const result = buildHouseFormReferenceGeometry({
      houseForm: makeStraightHouseForm({
        id: 'house-main',
        label: 'House',
        transform: { offsetXM: 4, offsetYM: 0, rotationQuarterTurns: 0 },
      }),
    });

    expect(result?.model?.houseId).toBe('house-main');
    for (const vertex of result?.footprint ?? []) {
      expect(vertex.x).toBeGreaterThanOrEqual(4000);
    }
  });

  it.each(HOUSE_FORM_PRESET_REGRESSION_CASES)(
    'keeps two %s house-form references separated by each form transform',
    (preset) => {
      const primary = buildHouseFormReferenceGeometry({
        houseForm: makeStraightHouseForm({
          id: 'house-main',
          label: 'House',
          footprint: {
            ...makeStraightHouseForm().footprint,
            preset,
          },
        }),
      });
      const second = buildHouseFormReferenceGeometry({
        houseForm: makeStraightHouseForm({
          id: 'house-form-2',
          label: 'House 2',
          transform: { offsetXM: 10, offsetYM: 0, rotationQuarterTurns: 0 },
          footprint: {
            ...makeStraightHouseForm().footprint,
            preset,
          },
        }),
      });

      expect(primary?.model?.houseId).toBe('house-main');
      expect(second?.model?.houseId).toBe('house-form-2');
      expect(polygonMinX(second?.footprint ?? [])).toBeGreaterThanOrEqual(10000);
      expect(polygonMinX(second?.footprint ?? [])).toBeGreaterThan(polygonMinX(primary?.footprint ?? []));
    },
  );
});
