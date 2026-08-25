import type {
  Assembly3D,
  GeometryConfig,
  GeometryPlanViewModel,
  GeometrySectionViewModel,
  GeometryTopProjectionViewModel,
  GeometryValidationReport,
  PergolaGeometryInput,
  ViewerSceneModel,
} from '@sp/geometry';
import type { CustomerPergolaConfigurationV1 } from '../core';
import type { CustomerInteractionAnchorsV1 } from './interactionAnchors';

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
  acrylicRoofDetailingReview: 'acrylic_roof_detailing_review',
} as const;

export const CUSTOMER_GEOMETRY_FAILURE_CODES_V1 = {
  solveFailed: 'geometry_solve_failed',
  capabilityUnavailable: 'geometry_capability_unavailable',
  validationFailed: 'geometry_validation_failed',
  validationUnsupported: 'geometry_validation_unsupported',
  interactionAnchorsFailed: 'interaction_anchors_failed',
} as const;

export type CustomerGeometryCapabilityCodeV1 =
  (typeof CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1)[keyof typeof CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1];

export type CustomerGeometryNoticeCodeV1 =
  (typeof CUSTOMER_GEOMETRY_NOTICE_CODES_V1)[keyof typeof CUSTOMER_GEOMETRY_NOTICE_CODES_V1];

export type CustomerGeometryFailureCodeV1 =
  (typeof CUSTOMER_GEOMETRY_FAILURE_CODES_V1)[keyof typeof CUSTOMER_GEOMETRY_FAILURE_CODES_V1];

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
      configuration: CustomerPergolaConfigurationV1;
      identifiers: CustomerGeometryIdentifiersV1;
      geometryInput: PergolaGeometryInput;
      notices: CustomerGeometryNoticeV1[];
    }
  | {
      ok: false;
      configuration: CustomerPergolaConfigurationV1;
      identifiers: CustomerGeometryIdentifiersV1;
      code: CustomerGeometryCapabilityCodeV1;
      message: string;
    };

export type CustomerSafeConfiguratorMessageV1 = {
  code:
    | CustomerGeometryCapabilityCodeV1
    | CustomerGeometryNoticeCodeV1
    | CustomerGeometryFailureCodeV1;
  kind: 'assumption' | 'error';
  message: string;
};

export type ConfiguratorSolvedGeometryV1 = {
  config: GeometryConfig;
  assembly: Assembly3D;
  viewerScene: ViewerSceneModel;
  topProjection: GeometryTopProjectionViewModel;
  plan: GeometryPlanViewModel;
  section: GeometrySectionViewModel;
  validation: GeometryValidationReport;
};

type ConfiguratorRenderableArtifactFieldsV1 = {
  configuration: CustomerPergolaConfigurationV1;
  geometryInput: PergolaGeometryInput;
  geometry: ConfiguratorSolvedGeometryV1;
  interactionAnchors: CustomerInteractionAnchorsV1;
  messages: CustomerSafeConfiguratorMessageV1[];
};

export type ConfiguratorReadyArtifactV1 =
  ConfiguratorRenderableArtifactFieldsV1 & {
    status: 'ready';
  };

export type ConfiguratorReviewRequiredArtifactV1 =
  ConfiguratorRenderableArtifactFieldsV1 & {
    status: 'review_required';
  };

export type ConfiguratorRenderableArtifactV1 =
  | ConfiguratorReadyArtifactV1
  | ConfiguratorReviewRequiredArtifactV1;

export type ConfiguratorUnavailableArtifactV1 = {
  status: 'invalid' | 'unsupported';
  configuration: CustomerPergolaConfigurationV1;
  messages: CustomerSafeConfiguratorMessageV1[];
  lastReadyArtifact?: ConfiguratorRenderableArtifactV1;
};

export type ConfiguratorSolvedArtifactV1 =
  | ConfiguratorRenderableArtifactV1
  | ConfiguratorUnavailableArtifactV1;

export type SolveCustomerConfigurationOptionsV1 = {
  /** Caller-owned fallback only. The configurator package stores no solve state. */
  lastReadyArtifact?: ConfiguratorRenderableArtifactV1;
};
