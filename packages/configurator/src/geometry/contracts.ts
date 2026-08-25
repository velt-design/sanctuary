import type { PergolaGeometryInput } from '@sp/geometry';
import type { CustomerPergolaConfigurationV1 } from '../core';

export const CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1 = {
  mixedRoofPlacementUnavailable: 'mixed_roof_placement_unavailable',
  attachedHouseRequired: 'attached_house_required',
  freestandingBoxUnavailable: 'freestanding_box_unavailable',
} as const;

export const CUSTOMER_GEOMETRY_NOTICE_CODES_V1 = {
  connectionAssumedSoffit: 'connection_assumed_soffit',
  houseStoreysAssumedSingle: 'house_storeys_assumed_single',
  houseRoofAssumedHipped: 'house_roof_assumed_hipped',
  siteLevelAssumedGround: 'site_level_assumed_ground',
  freestandingHouseContextUnplaced: 'freestanding_house_context_unplaced',
} as const;

export type CustomerGeometryCapabilityCodeV1 =
  (typeof CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1)[keyof typeof CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1];

export type CustomerGeometryNoticeCodeV1 =
  (typeof CUSTOMER_GEOMETRY_NOTICE_CODES_V1)[keyof typeof CUSTOMER_GEOMETRY_NOTICE_CODES_V1];

export type CustomerGeometryRuntimeIdentityV1 = Pick<
  PergolaGeometryInput,
  'projectId' | 'estimateId' | 'designRequestId'
>;

/**
 * Stable public-intent IDs plus the adapter-owned, assembly-scoped house ID.
 * These identifiers never stand in for project or estimate identity.
 */
export type CustomerGeometryIdentifiersV1 = {
  configurationId: CustomerPergolaConfigurationV1['configurationId'];
  pergolaId: CustomerPergolaConfigurationV1['intent']['pergola']['id'];
  houseId: 'house-1' | null;
};

export type CustomerGeometryNoticeV1 = {
  code: CustomerGeometryNoticeCodeV1;
  message: string;
};

export type CustomerGeometryAdapterResultV1 =
  | {
      ok: true;
      identifiers: CustomerGeometryIdentifiersV1;
      geometryInput: PergolaGeometryInput;
      notices: CustomerGeometryNoticeV1[];
    }
  | {
      ok: false;
      identifiers: CustomerGeometryIdentifiersV1;
      code: CustomerGeometryCapabilityCodeV1;
      message: string;
    };
