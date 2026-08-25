import { describe, expect, it } from 'vitest';
import { buildHouseFootprintPolygon, solvePergolaGeometry } from '@sp/geometry';
import {
  CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1,
  CUSTOMER_GEOMETRY_HOUSE_ID_V1,
  CUSTOMER_GEOMETRY_NOTICE_CODES_V1,
  CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1,
  customerConfigurationToPergolaGeometryInputV1,
  customerSiteToRawHouseInputV1,
  type CustomerGeometryRuntimeIdentityV1,
} from '@sp/configurator/geometry';
import type {
  CustomerAttachmentSideV1,
  CustomerConnectionIntentV1,
  CustomerHouseFootprintV1,
  CustomerHouseRoofFormV1,
  CustomerHouseStoreysV1,
  CustomerMixedRoofLayoutV1,
  CustomerPergolaConfigurationV1,
  CustomerPergolaFamilyV1,
  CustomerRoofIntentV1,
  CustomerSiteLevelV1,
} from '../core';
import { CUSTOMER_DIMENSION_BOUNDS } from '../core';
import { createTestCustomerConfiguration } from '../core/testFixtures';

const RUNTIME_IDENTITY: CustomerGeometryRuntimeIdentityV1 = {
  projectId: 'runtime-project',
  estimateId: 'runtime-estimate',
  designRequestId: 'runtime-design-request',
};

type ConfigurationOptions = {
  family?: CustomerPergolaFamilyV1;
  roof?: CustomerRoofIntentV1;
  lengthMm?: number;
  projectionMm?: number;
  placementMode?: 'attached' | 'freestanding';
  attachmentSide?: CustomerAttachmentSideV1;
  connectionIntent?: CustomerConnectionIntentV1;
  siteLevel?: CustomerSiteLevelV1;
  housePresent?: boolean;
  houseFootprint?: CustomerHouseFootprintV1;
  houseStoreys?: CustomerHouseStoreysV1;
  houseRoofForm?: CustomerHouseRoofFormV1;
  clearHeightMm?: number;
};

function makeConfiguration(
  options: ConfigurationOptions = {},
): CustomerPergolaConfigurationV1 {
  const base = createTestCustomerConfiguration();
  const placementMode = options.placementMode ?? base.intent.pergola.placement.mode;
  return {
    ...base,
    intent: {
      pergola: {
        ...base.intent.pergola,
        family: options.family ?? base.intent.pergola.family,
        dimensions: {
          ...base.intent.pergola.dimensions,
          lengthMm: options.lengthMm ?? base.intent.pergola.dimensions.lengthMm,
          projectionMm:
            options.projectionMm ?? base.intent.pergola.dimensions.projectionMm,
          clearHeightMm:
            options.clearHeightMm ?? base.intent.pergola.dimensions.clearHeightMm,
        },
        placement: {
          ...base.intent.pergola.placement,
          mode: placementMode,
          attachmentSide:
            options.attachmentSide ?? base.intent.pergola.placement.attachmentSide,
          connectionIntent:
            options.connectionIntent ??
            (placementMode === 'freestanding'
              ? 'none'
              : base.intent.pergola.placement.connectionIntent),
        },
        roof: options.roof ?? base.intent.pergola.roof,
      },
      site: {
        ...base.intent.site,
        level: options.siteLevel ?? base.intent.site.level,
        house: {
          ...base.intent.site.house,
          present: options.housePresent ?? base.intent.site.house.present,
          footprint: options.houseFootprint ?? base.intent.site.house.footprint,
          storeys: options.houseStoreys ?? base.intent.site.house.storeys,
          roofForm: options.houseRoofForm ?? base.intent.site.house.roofForm,
        },
      },
    },
  };
}

function requireGeometryInput(configuration: CustomerPergolaConfigurationV1) {
  const result = customerConfigurationToPergolaGeometryInputV1(
    configuration,
    RUNTIME_IDENTITY,
  );
  if (!result.ok) {
    throw new Error(`Expected geometry mapping to succeed: ${result.code}`);
  }
  return result;
}

describe('@sp/configurator/geometry adapter', () => {
  it.each([
    ['mono', 5],
    ['gable', 25],
    ['hip', 25],
    ['box', 3],
  ] as const)(
    'maps the V1 %s family with deterministic representative defaults',
    (family, expectedPitchDeg) => {
      const result = requireGeometryInput(makeConfiguration({ family }));

      expect(result.geometryInput.family).toBe(family);
      expect(result.geometryInput.roof).toMatchObject({
        material: 'acrylic',
        pitchDeg: expectedPitchDeg,
        boxPerimeterEnabled: family === 'box',
      });
      expect(result.geometryInput.dimensions).toMatchObject({
        lengthM: 4,
        projectionM: 3,
      });
      expect(result.geometryInput.supports?.postCount).toBe(family === 'box' ? 3 : 2);
    },
  );

  it.each([
    ['ground', 'slab_anchors'],
    ['deck', 'deck_bracket'],
    ['elevated', 'pile_1m'],
    ['unsure', 'slab_anchors'],
  ] as const)(
    'maps %s site level to deterministic representative %s support geometry',
    (siteLevel, postConnectionType) => {
      const result = requireGeometryInput(makeConfiguration({ siteLevel }));
      expect(result.geometryInput.supports?.postConnectionType).toBe(postConnectionType);
      const noticeCodes = result.notices.map((notice) => notice.code);
      if (siteLevel === 'unsure') {
        expect(noticeCodes).toContain(
          CUSTOMER_GEOMETRY_NOTICE_CODES_V1.siteLevelAssumedGround,
        );
      } else {
        expect(noticeCodes).not.toContain(
          CUSTOMER_GEOMETRY_NOTICE_CODES_V1.siteLevelAssumedGround,
        );
      }
    },
  );

  it.each([
    ['mono', 'solid_timber_sarking'],
    ['gable', 'symmetrical'],
    ['hip', 'hip'],
    ['box', 'box_perimeter'],
  ] as const)(
    'maps and solves solid timber-sarking intent for the %s family',
    (family, expectedMode) => {
      const configuration = makeConfiguration({
        family,
        roof: { system: 'solid_timber_sarking', ceilingIntent: 'natural_timber' },
      });
      const baseResult = requireGeometryInput(configuration);
      const finishChangedResult = requireGeometryInput({
        ...configuration,
        intent: {
          ...configuration.intent,
          pergola: {
            ...configuration.intent.pergola,
            frame: { finish: 'white', otherColourName: null },
          },
        },
      });

      expect(baseResult.geometryInput.roof).toMatchObject({
        material: 'timber',
        mode: expectedMode,
      });
      expect(finishChangedResult.geometryInput).toEqual(baseResult.geometryInput);
      expect(finishChangedResult.identifiers).toEqual(baseResult.identifiers);
      expect(solvePergolaGeometry(baseResult.geometryInput).ok).toBe(true);
    },
  );

  it('preserves clearHeightMm as minimum representative clearance and exact post-cut height', () => {
    const monoResult = requireGeometryInput(
      makeConfiguration({ family: 'mono', clearHeightMm: 2_650 }),
    );
    expect(monoResult.geometryInput.supports?.postCutHeightM).toBe(2.65);
    expect(monoResult.geometryInput.structural?.heights?.outerUndersideM).toBe(2.65);
    expect(
      Number(monoResult.geometryInput.structural?.heights?.referenceUndersideM),
    ).toBeGreaterThan(2.65);

    for (const family of ['gable', 'hip', 'box'] as const) {
      const result = requireGeometryInput(
        makeConfiguration({ family, clearHeightMm: 2_650 }),
      );
      expect(result.geometryInput.supports?.postCutHeightM).toBe(2.65);
      expect(result.geometryInput.structural?.heights).toEqual({
        houseUndersideM: 2.65,
        outerUndersideM: 2.65,
        referenceUndersideM: 2.65,
      });
    }
  });

  it.each([
    ['unsure', 'soffit', 'soffit_brackets'],
    ['soffit', 'soffit', 'soffit_brackets'],
    ['fascia', 'fascia', 'fascia_under_gutter'],
    ['wall', 'wall', 'facade_ledger'],
  ] as const)(
    'maps attached %s connection intent to %s geometry',
    (connectionIntent, type, attachmentStrategy) => {
      const result = requireGeometryInput(makeConfiguration({ connectionIntent }));
      expect(result.geometryInput.connection).toMatchObject({ type, attachmentStrategy });
      const noticeCodes = result.notices.map((notice) => notice.code);
      if (connectionIntent === 'unsure') {
        expect(noticeCodes).toContain(
          CUSTOMER_GEOMETRY_NOTICE_CODES_V1.connectionAssumedSoffit,
        );
      } else {
        expect(noticeCodes).not.toContain(
          CUSTOMER_GEOMETRY_NOTICE_CODES_V1.connectionAssumedSoffit,
        );
      }
    },
  );

  it.each([
    'straight',
    'l_left',
    'l_right',
    'recess_left',
    'recess_right',
  ] as const)('maps the %s house preset through RawHouseInput', (houseFootprint) => {
    const house = customerSiteToRawHouseInputV1(
      makeConfiguration({ houseFootprint, houseStoreys: 'two' }),
    );

    expect(house).toMatchObject({
      houseId: CUSTOMER_GEOMETRY_HOUSE_ID_V1,
      footprintMode: 'preset',
      footprintPreset: houseFootprint,
      storeyMode: 'double_storey',
      wallConstruction: 'timber_frame',
    });
    expect(Number(house?.eaveHeightM)).toBeGreaterThanOrEqual(
      CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1.house.doubleStoreyHeightM,
    );
  });

  it.each([
    ['one', 'single_storey', 2.4],
    ['two', 'double_storey', 4.8],
    ['unsure', 'single_storey', 2.4],
  ] as const)(
    'maps %s-storey house intent to representative %s context',
    (houseStoreys, storeyMode, minimumEaveHeightM) => {
      const result = requireGeometryInput(makeConfiguration({ houseStoreys }));
      expect(result.geometryInput.hostHouse).toMatchObject({
        storeyMode,
      });
      expect(Number(result.geometryInput.hostHouse?.eaveHeightM)).toBeGreaterThanOrEqual(
        minimumEaveHeightM,
      );
      const noticeCodes = result.notices.map((notice) => notice.code);
      if (houseStoreys === 'unsure') {
        expect(noticeCodes).toContain(
          CUSTOMER_GEOMETRY_NOTICE_CODES_V1.houseStoreysAssumedSingle,
        );
      } else {
        expect(noticeCodes).not.toContain(
          CUSTOMER_GEOMETRY_NOTICE_CODES_V1.houseStoreysAssumedSingle,
        );
      }
    },
  );

  it.each([
    ['hipped', 'hipped', 0],
    ['gable', 'hipped', 2],
    ['mono', 'mono', 0],
    ['flat', 'flat', 0],
    ['unsure', 'hipped', 0],
  ] as const)(
    'maps %s house roof intent to deterministic %s geometry',
    (houseRoofForm, roofForm, minimumOpenEndCount) => {
      const result = requireGeometryInput(makeConfiguration({ houseRoofForm }));
      expect(result.geometryInput.hostHouse?.roofForm).toBe(roofForm);
      expect(result.geometryInput.hostHouse?.openGableEndIds?.length ?? 0).toBeGreaterThanOrEqual(
        minimumOpenEndCount,
      );
      const noticeCodes = result.notices.map((notice) => notice.code);
      if (houseRoofForm === 'unsure') {
        expect(noticeCodes).toContain(
          CUSTOMER_GEOMETRY_NOTICE_CODES_V1.houseRoofAssumedHipped,
        );
      } else {
        expect(noticeCodes).not.toContain(
          CUSTOMER_GEOMETRY_NOTICE_CODES_V1.houseRoofAssumedHipped,
        );
      }
    },
  );

  it.each(['rear', 'front', 'left', 'right'] as const)(
    'keeps representative house context adjacent to the %s attachment side',
    (attachmentSide) => {
      const configuration = makeConfiguration({ attachmentSide });
      const result = requireGeometryInput(configuration);
      const solve = solvePergolaGeometry(result.geometryInput);
      expect(solve.ok).toBe(true);
      if (!solve.ok) return;

      expect(solve.config.houseContext.footprint).toEqual(
        buildHouseFootprintPolygon({
          pergolaWidthMm: configuration.intent.pergola.dimensions.lengthMm,
          pergolaDepthMm: configuration.intent.pergola.dimensions.projectionMm,
          preset: configuration.intent.site.house.footprint,
          params: null,
          attachmentSide,
        }),
      );
    },
  );

  it('maps public gable house intent to hipped topology with geometry-derived open terminals', () => {
    const house = customerSiteToRawHouseInputV1(
      makeConfiguration({
        houseFootprint: 'recess_left',
        houseRoofForm: 'gable',
      }),
    );

    expect(house?.roofForm).toBe('hipped');
    expect(house?.roofRidgeAxis).toBe('x');
    expect(house?.openGableEndIds?.length).toBeGreaterThan(0);
    expect(house?.openGableEndIds?.every((id) => id.startsWith('house-gable-end-x-'))).toBe(
      true,
    );
  });

  it.each([
    ['mono', 'central_skylight_narrow'],
    ['gable', 'central_skylight_standard'],
    ['hip', 'central_skylight_wide'],
    ['box', 'central_skylight_narrow'],
  ] as const)(
    'blocks mixed roof for the %s family with layout %s using one stable customer-safe capability code',
    (family, layout: CustomerMixedRoofLayoutV1) => {
      const result = customerConfigurationToPergolaGeometryInputV1(
        makeConfiguration({ family, roof: { system: 'mixed', tint: 'clear', layout } }),
        RUNTIME_IDENTITY,
      );

      expect(result).toMatchObject({
        ok: false,
        code: CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1.mixedRoofPlacementUnavailable,
      });
      expect('geometryInput' in result).toBe(false);
      expect(result.message).not.toMatch(/rafter|profile|source/i);
    },
  );

  it('blocks attached-without-house instead of fabricating host geometry', () => {
    const result = customerConfigurationToPergolaGeometryInputV1(
      makeConfiguration({ housePresent: false }),
      RUNTIME_IDENTITY,
    );

    expect(result).toMatchObject({
      ok: false,
      code: CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1.attachedHouseRequired,
      identifiers: { houseId: null },
    });
  });

  it('keeps freestanding-with-house intent but omits unplaceable host geometry explicitly', () => {
    const result = requireGeometryInput(
      makeConfiguration({ placementMode: 'freestanding', housePresent: true }),
    );

    expect(result.geometryInput.connection).toMatchObject({
      type: 'freestanding',
      attachmentStrategy: 'none',
    });
    expect(result.geometryInput.hostHouse).toBeNull();
    expect(result.identifiers.houseId).toBeNull();
    expect(result.notices.map((notice) => notice.code)).toContain(
      CUSTOMER_GEOMETRY_NOTICE_CODES_V1.freestandingHouseContextUnplaced,
    );
  });

  it('blocks the current unsupported freestanding box capability', () => {
    const result = customerConfigurationToPergolaGeometryInputV1(
      makeConfiguration({ family: 'box', placementMode: 'freestanding' }),
      RUNTIME_IDENTITY,
    );
    expect(result).toMatchObject({
      ok: false,
      code: CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1.freestandingBoxUnavailable,
    });
  });

  it('passes runtime identity through unchanged without aliasing public identifiers', () => {
    const result = requireGeometryInput(makeConfiguration());

    expect(result.geometryInput).toMatchObject(RUNTIME_IDENTITY);
    expect(result.geometryInput.projectId).not.toBe(result.identifiers.configurationId);
    expect(result.geometryInput.estimateId).not.toBe(result.identifiers.pergolaId);
    expect(result.identifiers).toEqual({
      configurationId: '123e4567-e89b-42d3-a456-426614174000',
      pergolaId: 'pergola-1',
      houseId: 'house-1',
    });
  });

  it.each([
    [
      'minimum',
      CUSTOMER_DIMENSION_BOUNDS.lengthMm.minimum,
      CUSTOMER_DIMENSION_BOUNDS.projectionMm.minimum,
      CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.minimum,
    ],
    [
      'maximum',
      CUSTOMER_DIMENSION_BOUNDS.lengthMm.maximum,
      CUSTOMER_DIMENSION_BOUNDS.projectionMm.maximum,
      CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.maximum,
    ],
  ] as const)(
    'converts and solves the public %s dimension boundary',
    (_boundary, lengthMm, projectionMm, clearHeightMm) => {
      const result = requireGeometryInput(
        makeConfiguration({ lengthMm, projectionMm, clearHeightMm }),
      );
      expect(result.geometryInput.dimensions).toMatchObject({
        lengthM: lengthMm / 1_000,
        projectionM: projectionMm / 1_000,
      });
      expect(result.geometryInput.supports?.postCutHeightM).toBe(clearHeightMm / 1_000);
      expect(solvePergolaGeometry(result.geometryInput).ok).toBe(true);
    },
  );

  it.each([
    ['mono-attached', makeConfiguration({ family: 'mono' })],
    ['mono-freestanding', makeConfiguration({ family: 'mono', placementMode: 'freestanding' })],
    ['gable-attached', makeConfiguration({ family: 'gable' })],
    ['gable-freestanding', makeConfiguration({ family: 'gable', placementMode: 'freestanding' })],
    ['hip-attached', makeConfiguration({ family: 'hip' })],
    ['hip-freestanding', makeConfiguration({ family: 'hip', placementMode: 'freestanding' })],
    ['box-attached', makeConfiguration({ family: 'box' })],
  ] as const)('produces representative geometry input that solves for %s', (_name, configuration) => {
    const result = requireGeometryInput(configuration);
    const solve = solvePergolaGeometry(result.geometryInput);
    expect(solve.ok).toBe(true);
  });
});
