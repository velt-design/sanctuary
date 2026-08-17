export const CUSTOMER_PERGOLA_CONFIGURATION_V1 = 'customer_pergola_configuration.v1' as const;
export const CUSTOMER_CONFIGURATION_PATCH_V1 = 'customer_configuration_patch.v1' as const;
export const CUSTOMER_CONFIGURATION_SEED_V1 = 'customer_configuration_seed.v1' as const;

export type CustomerConfigurationSourceKindV1 =
  | 'blank'
  | 'simple_cover_import'
  | 'product_seed'
  | 'project_seed';

export type CustomerPergolaFamilyV1 = 'mono' | 'gable' | 'hip' | 'box';
export type CustomerPlacementModeV1 = 'attached' | 'freestanding';
export type CustomerAttachmentSideV1 = 'rear' | 'front' | 'left' | 'right';
export type CustomerConnectionIntentV1 = 'unsure' | 'soffit' | 'fascia' | 'wall' | 'none';
export type CustomerFrameFinishV1 = 'black' | 'white' | 'other';
export type CustomerAcrylicTintV1 = 'clear' | 'light_grey' | 'dark_grey' | 'opal';
export type CustomerMixedRoofLayoutV1 =
  | 'central_skylight_narrow'
  | 'central_skylight_standard'
  | 'central_skylight_wide';
export type CustomerEdgeIdV1 = 'front' | 'left' | 'right' | 'rear';
export type CustomerBlindFabricV1 = 'mesh' | 'fine_mesh' | 'clear_pvc';
export type CustomerBlindOperationV1 = 'manual' | 'motorised';
export type CustomerDownlightIntentV1 = 'none' | 'subtle' | 'standard' | 'bright';
export type CustomerHeatingInterestV1 = 'none' | 'interested';
export type CustomerSiteLevelV1 = 'ground' | 'deck' | 'elevated' | 'unsure';
export type CustomerHouseFootprintV1 =
  | 'straight'
  | 'l_left'
  | 'l_right'
  | 'recess_left'
  | 'recess_right';
export type CustomerHouseStoreysV1 = 'one' | 'two' | 'unsure';
export type CustomerHouseRoofFormV1 = 'hipped' | 'gable' | 'mono' | 'flat' | 'unsure';

export type CustomerRoofIntentV1 =
  | {
      system: 'acrylic';
      tint: CustomerAcrylicTintV1;
    }
  | {
      system: 'solid_timber_sarking';
      ceilingIntent: 'natural_timber';
    }
  | {
      system: 'mixed';
      tint: CustomerAcrylicTintV1;
      layout: CustomerMixedRoofLayoutV1;
    };

export type CustomerEdgeTreatmentV1 = {
  edgeId: CustomerEdgeIdV1;
  treatment:
    | { kind: 'none' }
    | {
        kind: 'blind';
        fabric: CustomerBlindFabricV1;
        operation: CustomerBlindOperationV1;
      }
    | {
        kind: 'fixed_acrylic';
        tint: 'clear' | 'opal';
      };
};

export type CustomerPergolaIntentV1 = {
  id: 'pergola-1';
  family: CustomerPergolaFamilyV1;
  dimensions: {
    lengthMm: number;
    projectionMm: number;
    clearHeightMm: number;
  };
  placement: {
    mode: CustomerPlacementModeV1;
    attachmentSide: CustomerAttachmentSideV1;
    connectionIntent: CustomerConnectionIntentV1;
  };
  frame: {
    finish: CustomerFrameFinishV1;
    otherColourName: string | null;
  };
  roof: CustomerRoofIntentV1;
  edgeTreatments: CustomerEdgeTreatmentV1[];
  lighting: {
    downlights: CustomerDownlightIntentV1;
    dimmerRequested: boolean;
    ledStripInterest: boolean;
  };
  heatingInterest: CustomerHeatingInterestV1;
};

export type CustomerSiteIntentV1 = {
  level: CustomerSiteLevelV1;
  house: {
    present: boolean;
    footprint: CustomerHouseFootprintV1;
    storeys: CustomerHouseStoreysV1;
    roofForm: CustomerHouseRoofFormV1;
  };
};

export type CustomerPergolaConfigurationV1 = {
  schemaVersion: typeof CUSTOMER_PERGOLA_CONFIGURATION_V1;
  configurationId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  source: {
    kind: CustomerConfigurationSourceKindV1;
    sourcePath: string | null;
    sourceSlug: string | null;
  };
  intent: {
    pergola: CustomerPergolaIntentV1;
    site: CustomerSiteIntentV1;
  };
};

export type CustomerPergolaPatchV1 = {
  family?: CustomerPergolaFamilyV1;
  dimensions?: Partial<CustomerPergolaIntentV1['dimensions']>;
  placement?: Partial<CustomerPergolaIntentV1['placement']>;
  frame?: Partial<CustomerPergolaIntentV1['frame']>;
  roof?: CustomerRoofIntentV1;
  edgeTreatments?: CustomerEdgeTreatmentV1[];
  lighting?: Partial<CustomerPergolaIntentV1['lighting']>;
  heatingInterest?: CustomerHeatingInterestV1;
};

export type CustomerSitePatchV1 = {
  level?: CustomerSiteLevelV1;
  house?: Partial<CustomerSiteIntentV1['house']>;
};

export type CustomerConfigurationPatchV1 = {
  schemaVersion: typeof CUSTOMER_CONFIGURATION_PATCH_V1;
  pergola?: CustomerPergolaPatchV1;
  site?: CustomerSitePatchV1;
};

export type CustomerConfigurationSeedV1 = {
  schemaVersion: typeof CUSTOMER_CONFIGURATION_SEED_V1;
  source: Extract<CustomerConfigurationSourceKindV1, 'product_seed' | 'project_seed'>;
  sourceSlug: string;
  patch: CustomerConfigurationPatchV1;
};

export type ConfiguratorContextActionV1 =
  | {
      kind: 'apply_patch';
      source: 'product';
      sourceSlug: string;
      patch: CustomerConfigurationPatchV1;
    }
  | {
      kind: 'use_seed';
      source: 'project';
      sourceSlug: string;
      seed: CustomerConfigurationSeedV1;
    };
