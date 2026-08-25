import {
  buildHouseFootprintPolygon,
  deriveHouseGableTerminalEnds,
  preferredMonoFallDirectionForAttachmentSide,
  type HouseAttachmentStrategy,
  type RawHouseInput,
} from '@sp/geometry';
import type {
  CustomerHouseRoofFormV1,
  CustomerHouseStoreysV1,
  CustomerPergolaConfigurationV1,
} from '../core';
import {
  CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1,
  representativeStructuralHeights,
} from './defaults';

export const CUSTOMER_GEOMETRY_HOUSE_ID_V1 = 'house-1' as const;

function houseStoreyMode(
  storeys: CustomerHouseStoreysV1,
): NonNullable<RawHouseInput['storeyMode']> {
  return storeys === 'two' ? 'double_storey' : 'single_storey';
}

function houseRoofMapping(
  configuration: CustomerPergolaConfigurationV1,
): Pick<
  RawHouseInput,
  | 'roofForm'
  | 'roofPrimaryFallDirection'
  | 'roofRidgeAxis'
  | 'openGableEndIds'
  | 'roofPitchDeg'
> {
  const pergola = configuration.intent.pergola;
  const roofForm: CustomerHouseRoofFormV1 = configuration.intent.site.house.roofForm;
  if (roofForm === 'flat') {
    return {
      roofForm: 'flat',
      roofPrimaryFallDirection: 'positive_y',
      roofRidgeAxis: 'x',
      openGableEndIds: [],
      roofPitchDeg: 0,
    };
  }
  if (roofForm === 'mono') {
    return {
      roofForm: 'mono',
      roofPrimaryFallDirection: preferredMonoFallDirectionForAttachmentSide(
        pergola.placement.attachmentSide,
      ),
      roofRidgeAxis: 'x',
      openGableEndIds: [],
      roofPitchDeg: CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1.house.roofPitchDeg,
    };
  }

  const footprint = buildHouseFootprintPolygon({
    pergolaWidthMm: pergola.dimensions.lengthMm,
    pergolaDepthMm: pergola.dimensions.projectionMm,
    preset: configuration.intent.site.house.footprint,
    params: null,
    attachmentSide: pergola.placement.attachmentSide,
  });
  const openGableEndIds =
    roofForm === 'gable'
      ? deriveHouseGableTerminalEnds({ footprint, ridgeAxis: 'x' })
          .map((terminal) => terminal.id)
          .sort()
      : [];
  return {
    roofForm: 'hipped',
    roofPrimaryFallDirection: 'positive_y',
    roofRidgeAxis: 'x',
    openGableEndIds,
    roofPitchDeg: CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1.house.roofPitchDeg,
  };
}

function houseAttachmentStrategy(
  configuration: CustomerPergolaConfigurationV1,
): HouseAttachmentStrategy {
  const connectionIntent = configuration.intent.pergola.placement.connectionIntent;
  if (connectionIntent === 'fascia') return 'fascia_under_gutter';
  if (connectionIntent === 'wall') return 'facade_ledger';
  return 'soffit_brackets';
}

/**
 * Map the public site/house intent into the package-owned raw house contract.
 * A freestanding pergola has no canonical house relationship in V1, so its
 * site house is intentionally not emitted as hosted geometry.
 */
export function customerSiteToRawHouseInputV1(
  configuration: CustomerPergolaConfigurationV1,
): RawHouseInput | null {
  const pergola = configuration.intent.pergola;
  const house = configuration.intent.site.house;
  if (pergola.placement.mode === 'freestanding' || !house.present) return null;

  const structuralHeights = representativeStructuralHeights(pergola);
  const attachmentHeightM = structuralHeights.referenceUndersideM;
  const selectedStoreyHeightM =
    house.storeys === 'two'
      ? CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1.house.doubleStoreyHeightM
      : CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1.house.singleStoreyHeightM;
  const eaveHeightM = Math.max(attachmentHeightM, selectedStoreyHeightM);

  return {
    houseId: CUSTOMER_GEOMETRY_HOUSE_ID_V1,
    footprintMode: 'preset',
    footprintPreset: house.footprint,
    footprintParams: null,
    footprintPolygon: null,
    position: null,
    storeyMode: houseStoreyMode(house.storeys),
    wallConstruction: 'timber_frame',
    ...houseRoofMapping(configuration),
    decks: [],
    openings: [],
    attachmentStrategy: houseAttachmentStrategy(configuration),
    eaveHeightM,
    wallHeightM: eaveHeightM,
    eave: {
      soffitDepthMm: CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1.house.soffitDepthMm,
      fasciaHeightMm: CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1.house.fasciaHeightMm,
      gutterWidthMm: CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1.house.gutterWidthMm,
      gutterDepthMm: CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1.house.gutterDepthMm,
      gutterProjectionMm:
        CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1.house.gutterProjectionMm,
      eaveOverhangMm: CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1.house.eaveOverhangMm,
    },
  };
}
