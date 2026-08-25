import type { PergolaGeometryInput } from '@sp/geometry';
import {
  normalizeCustomerPergolaConfigurationV1,
  type CustomerPergolaConfigurationV1,
} from '../core';
import {
  CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1,
  CUSTOMER_GEOMETRY_NOTICE_CODES_V1,
  type CustomerGeometryAdapterResultV1,
  type CustomerGeometryIdentifiersV1,
  type CustomerGeometryNoticeV1,
  type CustomerGeometryRuntimeIdentityV1,
} from './contracts';
import {
  representativeConnection,
  representativePostConnectionType,
  representativePostCount,
  representativeRoofPitchDeg,
  representativeStructuralHeights,
} from './defaults';
import {
  CUSTOMER_GEOMETRY_HOUSE_ID_V1,
  customerSiteToRawHouseInputV1,
} from './house';

const CAPABILITY_MESSAGES = {
  mixedRoofPlacementUnavailable:
    'Mixed roof placement is not available in the concept preview yet. Your choices are retained for Sanctuary review.',
  attachedHouseRequired:
    'Choose a house for an attached pergola, or change the pergola to freestanding.',
  freestandingBoxUnavailable:
    'A freestanding box-perimeter concept needs Sanctuary review. Your choices are retained.',
} as const;

const NOTICE_MESSAGES = {
  connectionAssumedSoffit:
    'The concept preview uses a representative soffit connection. Sanctuary will confirm the attachment.',
  houseStoreysAssumedSingle:
    'The concept preview uses a representative single-storey house height. Sanctuary will confirm it.',
  houseRoofAssumedHipped:
    'The concept preview uses a representative hipped house roof. Sanctuary will confirm it.',
  siteLevelAssumedGround:
    'The concept preview uses a representative ground-level base. Sanctuary will confirm the site level and footings.',
  freestandingHouseContextUnplaced:
    'The nearby house is not positioned in this freestanding concept preview. Your site choice is retained.',
} as const;

function identifiersFor(
  configuration: CustomerPergolaConfigurationV1,
  hasHostHouse: boolean,
): CustomerGeometryIdentifiersV1 {
  return {
    configurationId: configuration.configurationId,
    pergolaId: configuration.intent.pergola.id,
    houseId: hasHostHouse ? CUSTOMER_GEOMETRY_HOUSE_ID_V1 : null,
  };
}

function noticesFor(
  configuration: CustomerPergolaConfigurationV1,
): CustomerGeometryNoticeV1[] {
  const pergola = configuration.intent.pergola;
  const house = configuration.intent.site.house;
  const notices: CustomerGeometryNoticeV1[] = [];
  if (
    pergola.placement.mode === 'attached' &&
    pergola.placement.connectionIntent === 'unsure'
  ) {
    notices.push({
      code: CUSTOMER_GEOMETRY_NOTICE_CODES_V1.connectionAssumedSoffit,
      message: NOTICE_MESSAGES.connectionAssumedSoffit,
    });
  }
  if (pergola.placement.mode === 'attached' && house.present && house.storeys === 'unsure') {
    notices.push({
      code: CUSTOMER_GEOMETRY_NOTICE_CODES_V1.houseStoreysAssumedSingle,
      message: NOTICE_MESSAGES.houseStoreysAssumedSingle,
    });
  }
  if (pergola.placement.mode === 'attached' && house.present && house.roofForm === 'unsure') {
    notices.push({
      code: CUSTOMER_GEOMETRY_NOTICE_CODES_V1.houseRoofAssumedHipped,
      message: NOTICE_MESSAGES.houseRoofAssumedHipped,
    });
  }
  if (pergola.placement.mode === 'freestanding' && house.present) {
    notices.push({
      code: CUSTOMER_GEOMETRY_NOTICE_CODES_V1.freestandingHouseContextUnplaced,
      message: NOTICE_MESSAGES.freestandingHouseContextUnplaced,
    });
  }
  if (configuration.intent.site.level === 'unsure') {
    notices.push({
      code: CUSTOMER_GEOMETRY_NOTICE_CODES_V1.siteLevelAssumedGround,
      message: NOTICE_MESSAGES.siteLevelAssumedGround,
    });
  }
  return notices;
}

function roofInput(
  configuration: CustomerPergolaConfigurationV1,
): NonNullable<PergolaGeometryInput['roof']> {
  const pergola = configuration.intent.pergola;
  const material = pergola.roof.system === 'acrylic' ? 'acrylic' : 'timber';
  const mode =
    pergola.family === 'box'
      ? 'box_perimeter'
      : pergola.family === 'gable'
        ? 'symmetrical'
        : pergola.family === 'hip'
          ? 'hip'
          : pergola.roof.system === 'solid_timber_sarking'
            ? 'solid_timber_sarking'
            : null;
  return {
    material,
    mode,
    pitchDeg: representativeRoofPitchDeg(pergola.family),
    slopeDirection: 'away_from_house',
    overhangEnabled: false,
    overhangM: null,
    boxPerimeterEnabled: pergola.family === 'box',
    mixedAcrylicBaysMain: null,
    mixedAcrylicBaysA: null,
    mixedAcrylicBaysB: null,
  };
}

function buildGeometryInput(
  configuration: CustomerPergolaConfigurationV1,
  identity: CustomerGeometryRuntimeIdentityV1,
): PergolaGeometryInput {
  const pergola = configuration.intent.pergola;
  const freestanding = pergola.placement.mode === 'freestanding';
  const connection = freestanding
    ? { type: 'freestanding' as const, attachmentStrategy: 'none' as const }
    : representativeConnection(pergola.placement.connectionIntent);
  return {
    projectId: identity.projectId,
    estimateId: identity.estimateId,
    designRequestId: identity.designRequestId ?? null,
    family: pergola.family,
    dimensions: {
      lengthM: pergola.dimensions.lengthMm / 1_000,
      projectionM: pergola.dimensions.projectionMm / 1_000,
      hipCornerLengthBM: null,
      hipCornerProjectionBM: null,
    },
    roof: roofInput(configuration),
    gable:
      pergola.family === 'gable' || pergola.family === 'hip'
        ? {
            endFramesMode: 'none',
            houseEaveGutterMode: freestanding ? 'our' : 'house',
            outerEaveGutterMode: 'our',
          }
        : null,
    box:
      pergola.family === 'box'
        ? { houseEdgeGutterMode: 'house', farEdgeGutterMode: 'our' }
        : null,
    connection: {
      type: connection.type,
      attachmentSide: pergola.placement.attachmentSide,
      attachmentStrategy: connection.attachmentStrategy,
    },
    position: null,
    supports: {
      postCount: representativePostCount(pergola.family, freestanding),
      postCutHeightM: pergola.dimensions.clearHeightMm / 1_000,
      postConnectionType: representativePostConnectionType(configuration.intent.site.level),
      ground: 'easy',
    },
    structural: {
      heights: representativeStructuralHeights(pergola),
    },
    hostHouse: customerSiteToRawHouseInputV1(configuration),
  };
}

/**
 * Convert normalized public intent into @sp/geometry input. Runtime project
 * and estimate identity is mandatory caller context and is never synthesized
 * from the public configuration or pergola IDs.
 */
export function customerConfigurationToPergolaGeometryInputV1(
  sourceConfiguration: CustomerPergolaConfigurationV1,
  identity: CustomerGeometryRuntimeIdentityV1,
): CustomerGeometryAdapterResultV1 {
  const configuration = normalizeCustomerPergolaConfigurationV1(sourceConfiguration);
  const pergola = configuration.intent.pergola;
  const house = configuration.intent.site.house;

  if (pergola.roof.system === 'mixed') {
    return {
      ok: false,
      configuration,
      identifiers: identifiersFor(configuration, false),
      code: CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1.mixedRoofPlacementUnavailable,
      message: CAPABILITY_MESSAGES.mixedRoofPlacementUnavailable,
    };
  }
  if (pergola.placement.mode === 'attached' && !house.present) {
    return {
      ok: false,
      configuration,
      identifiers: identifiersFor(configuration, false),
      code: CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1.attachedHouseRequired,
      message: CAPABILITY_MESSAGES.attachedHouseRequired,
    };
  }
  if (pergola.family === 'box' && pergola.placement.mode === 'freestanding') {
    return {
      ok: false,
      configuration,
      identifiers: identifiersFor(configuration, false),
      code: CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1.freestandingBoxUnavailable,
      message: CAPABILITY_MESSAGES.freestandingBoxUnavailable,
    };
  }

  const hostHouse = pergola.placement.mode === 'attached' && house.present;
  return {
    ok: true,
    configuration,
    identifiers: identifiersFor(configuration, hostHouse),
    geometryInput: buildGeometryInput(configuration, identity),
    notices: noticesFor(configuration),
  };
}
