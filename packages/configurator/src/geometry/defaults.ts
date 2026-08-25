import type {
  ConnectionType,
  HouseAttachmentStrategy,
  PergolaGeometryInput,
} from '@sp/geometry';
import type {
  CustomerConnectionIntentV1,
  CustomerPergolaFamilyV1,
  CustomerPergolaIntentV1,
  CustomerSiteLevelV1,
} from '../core';

export const CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1 = {
  roofPitchDeg: {
    mono: 5,
    gable: 25,
    hip: 25,
    box: 3,
  },
  house: {
    singleStoreyHeightM: 2.4,
    doubleStoreyHeightM: 4.8,
    roofPitchDeg: 25,
    soffitDepthMm: 450,
    fasciaHeightMm: 180,
    gutterWidthMm: 125,
    gutterDepthMm: 90,
    gutterProjectionMm: 125,
    eaveOverhangMm: 450,
  },
} as const;

export type CustomerRepresentativeStructuralHeightsV1 = {
  houseUndersideM: number;
  outerUndersideM: number;
  referenceUndersideM: number;
};

export function representativeRoofPitchDeg(
  family: CustomerPergolaFamilyV1,
): number {
  return CUSTOMER_GEOMETRY_REPRESENTATIVE_DEFAULTS_V1.roofPitchDeg[family];
}

export function representativeStructuralHeights(
  pergola: CustomerPergolaIntentV1,
): CustomerRepresentativeStructuralHeightsV1 {
  const clearHeightM = pergola.dimensions.clearHeightMm / 1_000;
  if (pergola.family !== 'mono') {
    return {
      houseUndersideM: clearHeightM,
      outerUndersideM: clearHeightM,
      referenceUndersideM: clearHeightM,
    };
  }

  const pitchRadians = (representativeRoofPitchDeg('mono') * Math.PI) / 180;
  const referenceUndersideM =
    clearHeightM +
    (pergola.dimensions.projectionMm / 1_000) * Math.tan(pitchRadians);
  return {
    houseUndersideM: referenceUndersideM,
    outerUndersideM: clearHeightM,
    referenceUndersideM,
  };
}

export function representativeConnection(
  intent: CustomerConnectionIntentV1,
): {
  type: Exclude<ConnectionType, 'freestanding'>;
  attachmentStrategy: Exclude<HouseAttachmentStrategy, 'none'>;
} {
  if (intent === 'fascia') {
    return { type: 'fascia', attachmentStrategy: 'fascia_under_gutter' };
  }
  if (intent === 'wall') {
    return { type: 'wall', attachmentStrategy: 'facade_ledger' };
  }
  return { type: 'soffit', attachmentStrategy: 'soffit_brackets' };
}

export function representativePostCount(
  family: CustomerPergolaFamilyV1,
  freestanding: boolean,
): number {
  if (freestanding) return 4;
  return family === 'box' ? 3 : 2;
}

export function representativePostConnectionType(
  level: CustomerSiteLevelV1,
): NonNullable<PergolaGeometryInput['supports']>['postConnectionType'] {
  if (level === 'deck') return 'deck_bracket';
  if (level === 'elevated') return 'pile_1m';
  return 'slab_anchors';
}
