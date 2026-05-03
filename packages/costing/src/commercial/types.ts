import type {
  AccessLevel,
  AttachmentSide,
  ExtrusionColour,
  GableEndFramesMode,
  GroundCondition,
  HeightCategory,
  HouseConnectionType,
  JobType,
  PergolaStyleUi,
  PostConnectionType,
  RoofMaterial,
  RoofType,
} from '../engine/types';

export const COMMERCIAL_DESIGN_INPUT_SCHEMA_VERSION_V1 = 'commercial_design_v1' as const;

export type CommercialDesignInputSchemaVersionV1 = typeof COMMERCIAL_DESIGN_INPUT_SCHEMA_VERSION_V1;

export type CommercialDesignInputSourceV1 = 'calculator_compat' | 'workbench_solved';

export type CommercialTrustStatusV1 = 'ready' | 'approximate' | 'blocked' | 'unsupported';

export type CommercialDiagnosticSeverityV1 = 'info' | 'warning' | 'blocking';

export type CommercialDiagnosticV1 = {
  code: string;
  message: string;
  severity: CommercialDiagnosticSeverityV1;
};

export type CommercialIdentityV1 = {
  projectId?: string | null;
  estimateId?: string | null;
  designRequestId?: string | null;
};

export type CommercialSiteCommercialV1 = {
  jobType: JobType;
  access: AccessLevel;
  height: HeightCategory;
  travelExGst: number;
  extrasAllowanceExGst: number;
  quoteDiscountPct: number;
};

export type CommercialDesignIntentV1 = {
  pergolaStyle: PergolaStyleUi;
  roofMaterial: RoofMaterial;
  extrusionColour: ExtrusionColour;
  roofType?: RoofType | null;
  houseConnectionType: HouseConnectionType;
  attachmentSide?: AttachmentSide | null;
  postConnectionType: PostConnectionType;
  ground?: GroundCondition | null;
  roofPitchDeg?: number | null;
  dimensions?: {
    lengthM?: number | null;
    projectionM?: number | null;
    secondaryLengthM?: number | null;
    secondaryProjectionM?: number | null;
  };
  roofOptions?: {
    boxPerimeterEnabled?: boolean | null;
    gableEndFramesMode?: GableEndFramesMode | null;
    mixedRoofMode?: string | null;
    overhangEnabled?: boolean | null;
    invertedEnabled?: boolean | null;
  };
};

export type CommercialSolvedGeometryV1 = {
  status: CommercialTrustStatusV1;
  geometrySource: CommercialDesignInputSourceV1;
  primaryDimensionsM?: {
    length: number;
    projection: number;
  } | null;
  secondaryDimensionsM?: {
    length: number;
    projection: number;
  } | null;
  roofPlaneCount?: number | null;
  attachmentLengthM?: number | null;
  warnings?: string[];
};

export type CommercialQuantityTakeoffV1 = {
  primaryDimensions?: {
    lengthM?: number | null;
    projectionM?: number | null;
    roofAreaM2?: number | null;
  };
  roofPlanes?: Array<{
    id: string;
    label?: string;
    areaM2?: number | null;
    rafterCount?: number | null;
    rafterLengthM?: number | null;
    rafterSpacingMm?: number | null;
    rafterTotalLengthM?: number | null;
    bayCount?: number | null;
    claddingAreaM2?: number | null;
    claddingPanelCount?: number | null;
    joinerCount?: number | null;
    joinerTotalLengthM?: number | null;
  }>;
  posts?: {
    count?: number | null;
    cutHeightM?: number | null;
    profile?: string | null;
  };
  rafters?: {
    count?: number | null;
    bayCount?: number | null;
    spacingMm?: number | null;
    cutLengthM?: number | null;
    totalLengthM?: number | null;
    profile?: string | null;
  };
  beams?: {
    ledgerLengthM?: number | null;
    frontBeamLengthM?: number | null;
    ridgeLengthM?: number | null;
    tieBeamLengthM?: number | null;
    totalBeamLengthM?: number | null;
    ledgerProfile?: string | null;
    frontBeamProfile?: string | null;
    ridgeProfile?: string | null;
  };
  gutters?: {
    ourGutterLengthM?: number | null;
    houseGutterLengthM?: number | null;
    totalLengthM?: number | null;
    downpipeCount?: number | null;
    downpipeJoinCount?: number | null;
    downpipeElbowCount?: number | null;
  };
  roofCladding?: {
    acrylicAreaM2?: number | null;
    timberAreaM2?: number | null;
    sheetCount?: number | null;
    joinerRuns?: number | null;
    panelCount?: number | null;
    totalAreaM2?: number | null;
  };
  joiners?: {
    count?: number | null;
    totalLengthM?: number | null;
    averageLengthM?: number | null;
    profile?: string | null;
  };
  flashings?: {
    totalLengthM?: number | null;
    count?: number | null;
    surfaceAreaM2?: number | null;
    byBandM?: Record<string, number>;
    byGirthM?: Record<string, number>;
  };
  infills?: {
    itemCount?: number | null;
    sheetAreaM2?: number | null;
    stripPanelCount?: number | null;
  };
  blindsAndAccessories?: {
    blindCount?: number | null;
    accessoryCount?: number | null;
    notes?: string[];
  };
};

export type CommercialOptionSetV1 = {
  flashings?: unknown;
  infills?: unknown;
  blinds?: unknown;
  overrides?: Record<string, string | null | undefined>;
  powdercoat?: {
    standardColour?: string | null;
    isCustom?: boolean | null;
    customColour?: string | null;
  };
};

export type CommercialModuleInputV1 = {
  id: string;
  label?: string;
  sourceModuleIndex?: number | null;
  trustStatus: CommercialTrustStatusV1;
  designIntent: CommercialDesignIntentV1;
  solvedGeometry: CommercialSolvedGeometryV1;
  quantityTakeoff: CommercialQuantityTakeoffV1;
  options: CommercialOptionSetV1;
  diagnostics: CommercialDiagnosticV1[];
};

export type CommercialPergolaInputV1 = {
  id: string;
  label?: string;
  trustStatus: CommercialTrustStatusV1;
  modules: CommercialModuleInputV1[];
  diagnostics: CommercialDiagnosticV1[];
};

export type CommercialDesignInputV1 = {
  schemaVersion: CommercialDesignInputSchemaVersionV1;
  source: CommercialDesignInputSourceV1;
  trustStatus: CommercialTrustStatusV1;
  identity: CommercialIdentityV1;
  pergolas: CommercialPergolaInputV1[];
  siteCommercial: CommercialSiteCommercialV1;
  diagnostics: CommercialDiagnosticV1[];
};
