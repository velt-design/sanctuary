import type {
  AccessLevel,
  ExtrusionColour,
  GroundCondition,
  HeightCategory,
  HouseConnectionType,
  PergolaStyleUi,
  PostConnectionType,
  RoofMaterial,
  RoofType,
} from '@/src/costing/engine/types';

export type CalculatorModuleInputs = {
  pergolaStyle: PergolaStyleUi;
  roofMaterial: RoofMaterial;
  extrusionColour: ExtrusionColour;
  boxPerimeterEnabled: boolean;
  internalRoofType: RoofType;
  fallDistanceMm: string;
  roofPitchDeg: string;
  boxGutterHouseEdge: 'house' | 'our' | 'none';
  boxGutterFarEdge: 'house' | 'our' | 'none';
  downpipeCount: string;
  overhangEnabled: boolean;
  overhangAmountM: string;
  overhangSupportBeamProfile: '150x50' | '200x50';
  invertedEnabled: boolean;
  invertedHouseGutter: boolean;
  mixedSkylightStripCount: string;
  mixedSkylightStripWidthM: string;
  mixedAcrylicBaysMain: string;
  mixedAcrylicBaysA: string;
  mixedAcrylicBaysB: string;

  postCount: string;
  houseConnectionType: HouseConnectionType;
  postConnectionType: PostConnectionType;
  ground: GroundCondition;

  lengthM: string;
  projectionM: string;
  hipCornerLengthBM: string;
  hipCornerProjectionBM: string;
  postCutHeightM: string;

  timberRoofAllowanceExGst: string;
};

export type CalculatorInputs = {
  schemaVersion: 'v2';
  projectName: string;
  quoteRef: string;

  access: AccessLevel;
  height: HeightCategory;
  travelExGst: string;
  extrasAllowanceExGst: string;
  quoteDiscountPct: string;

  modules: CalculatorModuleInputs[];
};

export type LegacyCalculatorInputsV1 = {
  projectName: string;
  quoteRef: string;

  pergolaStyle: PergolaStyleUi;
  roofMaterial: RoofMaterial;
  extrusionColour: ExtrusionColour;
  boxPerimeterEnabled: boolean;
  internalRoofType: RoofType;
  fallDistanceMm: string;
  roofPitchDeg: string;
  boxGutterHouseEdge?: 'house' | 'our' | 'none';
  boxGutterFarEdge?: 'house' | 'our' | 'none';
  downpipeCount?: string;
  overhangEnabled?: boolean;
  overhangAmountM?: string;
  overhangSupportBeamProfile?: '150x50' | '200x50';
  invertedEnabled?: boolean;
  invertedHouseGutter?: boolean;
  mixedSkylightStripCount: string;
  mixedSkylightStripWidthM: string;
  mixedAcrylicBaysMain?: string;
  mixedAcrylicBaysA?: string;
  mixedAcrylicBaysB?: string;

  postCount: string;
  houseConnectionType: HouseConnectionType;
  postConnectionType: PostConnectionType;
  access: AccessLevel;
  height: HeightCategory;
  ground: GroundCondition;

  lengthM: string;
  projectionM: string;
  postCutHeightM: string;

  travelExGst: string;
  extrasAllowanceExGst: string;
  timberRoofAllowanceExGst: string;
  quoteDiscountPct: string;
};

export function isCalculatorInputsV2(value: unknown): value is CalculatorInputs {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return v.schemaVersion === 'v2' && Array.isArray(v.modules);
}

export function isLegacyCalculatorInputsV1(value: unknown): value is LegacyCalculatorInputsV1 {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return typeof v.projectName === 'string' && typeof v.pergolaStyle === 'string' && !Array.isArray(v.modules);
}

export function migrateLegacyCalculatorInputsToV2(legacy: LegacyCalculatorInputsV1): CalculatorInputs {
  return {
    schemaVersion: 'v2',
    projectName: legacy.projectName,
    quoteRef: legacy.quoteRef,
    access: legacy.access,
    height: legacy.height,
    travelExGst: legacy.travelExGst,
    extrasAllowanceExGst: legacy.extrasAllowanceExGst,
    quoteDiscountPct: legacy.quoteDiscountPct,
    modules: [
      {
        pergolaStyle: legacy.pergolaStyle,
        roofMaterial: legacy.roofMaterial,
        extrusionColour: legacy.extrusionColour,
        boxPerimeterEnabled: legacy.boxPerimeterEnabled,
        internalRoofType: legacy.internalRoofType,
        fallDistanceMm: legacy.fallDistanceMm,
        roofPitchDeg: legacy.roofPitchDeg,
        boxGutterHouseEdge: legacy.boxGutterHouseEdge ?? 'house',
        boxGutterFarEdge: legacy.boxGutterFarEdge ?? 'our',
        downpipeCount: legacy.downpipeCount ?? '0',
        overhangEnabled: legacy.overhangEnabled ?? false,
        overhangAmountM: legacy.overhangAmountM ?? '0.2',
        overhangSupportBeamProfile: legacy.overhangSupportBeamProfile ?? '150x50',
        invertedEnabled: legacy.invertedEnabled ?? false,
        invertedHouseGutter: legacy.invertedHouseGutter ?? true,
        mixedSkylightStripCount: legacy.mixedSkylightStripCount,
        mixedSkylightStripWidthM: legacy.mixedSkylightStripWidthM,
        mixedAcrylicBaysMain: legacy.mixedAcrylicBaysMain ?? '0',
        mixedAcrylicBaysA: legacy.mixedAcrylicBaysA ?? '0',
        mixedAcrylicBaysB: legacy.mixedAcrylicBaysB ?? '0',
        postCount: legacy.postCount,
        houseConnectionType: legacy.houseConnectionType,
        postConnectionType: legacy.postConnectionType,
        ground: legacy.ground,
        lengthM: legacy.lengthM,
        projectionM: legacy.projectionM,
        hipCornerLengthBM: '0',
        hipCornerProjectionBM: '0',
        postCutHeightM: legacy.postCutHeightM,
        timberRoofAllowanceExGst: legacy.timberRoofAllowanceExGst,
      },
    ],
  };
}

export type CalculatorDraftContext = {
  projectId?: string;
  estimateId?: string;
};
