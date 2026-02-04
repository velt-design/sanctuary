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
} from '@sp/costing';

export type BlindSystemType = 'ZIPTRAK' | 'OMNI';
export type BlindFabric = 'MESH' | 'PVC' | 'FINE_MESH' | 'NONE';
export type BlindMotorised = 'NONE' | 'YES';

export type BlindLineItem = {
  id: string;
  label?: string;
  system: BlindSystemType;
  widthMm: string;
  coverLengthMm: string;
  fabric: BlindFabric;
  motorised: BlindMotorised;
};

export type CalculatorBlindsState = {
  items: BlindLineItem[];
};

export type LegacyBlindInputsV1 = {
  systemType: BlindSystemType;
  totalWidthMm: string;
  coverLengthMm: string;
  fabric: BlindFabric;
  motorised: 'NONE' | 'YES' | 'NO';
  panelCount: string;
  panelWidthsMm: string[];
};

export type CalculatorModuleOverrides = {
  ledgerProfile?: string;
  rafterProfile?: string;
  postProfile?: string;
  frontBeamProfile?: string;
  ridgeBeamProfile?: string;
  boxPerimeterBeamProfile?: string;
  overhangSupportBeamProfile?: string;
  tieBeamProfile?: string;
  strutProfile?: string;
};

export type CalculatorModuleInputs = {
  pergolaStyle: PergolaStyleUi;
  roofMaterial: RoofMaterial;
  extrusionColour: ExtrusionColour;
  powdercoatStandardColour?: string;
  powdercoatIsCustom?: boolean;
  powdercoatCustomColour?: string;
  boxPerimeterEnabled: boolean;
  internalRoofType: RoofType;
  fallDistanceMm: string;
  roofPitchDeg: string;
  gableEndFramesMode: 'none' | 'outer_end_only' | 'both_ends';
  boxGutterHouseEdge: 'house' | 'our' | 'none';
  boxGutterFarEdge: 'house' | 'our' | 'none';
  downpipeCount: string;
  downpipeJoinCount: string;
  downpipeElbowCount: string;
  separateGutterEnabled: boolean;
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
  timberRoofAboveType: 'insulated_panels' | 'steel_corrugated' | 'steel_tray';
  timberInsulatedPanelThicknessMm: string;
  timberTrayWidthMm: string;

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

  overrides?: CalculatorModuleOverrides;
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
  blinds?: CalculatorBlindsState;
};

export type LegacyCalculatorInputsV1 = {
  projectName: string;
  quoteRef: string;

  pergolaStyle: PergolaStyleUi;
  roofMaterial: RoofMaterial;
  extrusionColour: ExtrusionColour;
  powdercoatStandardColour?: string;
  powdercoatIsCustom?: boolean;
  powdercoatCustomColour?: string;
  boxPerimeterEnabled: boolean;
  internalRoofType: RoofType;
  fallDistanceMm: string;
  roofPitchDeg: string;
  boxGutterHouseEdge?: 'house' | 'our' | 'none';
  boxGutterFarEdge?: 'house' | 'our' | 'none';
  downpipeCount?: string;
  downpipeJoinCount?: string;
  downpipeElbowCount?: string;
  separateGutterEnabled?: boolean;
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

  blinds?: CalculatorBlindsState | LegacyBlindInputsV1;

  overrides?: CalculatorModuleOverrides;
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

export function isLegacyBlindInputsV1(value: unknown): value is LegacyBlindInputsV1 {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return typeof v.totalWidthMm === 'string' && typeof v.coverLengthMm === 'string';
}

export function isCalculatorBlindsState(value: unknown): value is CalculatorBlindsState {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return Array.isArray(v.items);
}

export function normalizeBlindsState(value: unknown): CalculatorBlindsState | undefined {
  if (isCalculatorBlindsState(value)) return value;
  if (!isLegacyBlindInputsV1(value)) return undefined;
  const legacy = value;
  const widths = Array.isArray(legacy.panelWidthsMm) && legacy.panelWidthsMm.length > 0 ? legacy.panelWidthsMm : [legacy.totalWidthMm];
  const items = widths.map((width, idx) => {
    const motorised: BlindMotorised = legacy.motorised === 'YES' ? 'YES' : 'NONE';
    return {
      id: `legacy-${idx + 1}`,
      label: widths.length > 1 ? `Panel ${idx + 1}` : undefined,
      system: (legacy.systemType ?? 'ZIPTRAK') as BlindSystemType,
      widthMm: String(width ?? ''),
      coverLengthMm: legacy.coverLengthMm ?? '',
      fabric: (legacy.fabric ?? 'MESH') as BlindFabric,
      motorised,
    };
  });
  return { items };
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
        powdercoatStandardColour: legacy.powdercoatStandardColour,
        powdercoatIsCustom: legacy.powdercoatIsCustom,
        powdercoatCustomColour: legacy.powdercoatCustomColour,
        boxPerimeterEnabled: legacy.boxPerimeterEnabled,
        internalRoofType: legacy.internalRoofType,
        fallDistanceMm: legacy.fallDistanceMm,
        roofPitchDeg: legacy.roofPitchDeg,
        gableEndFramesMode: legacy.houseConnectionType !== 'none' ? 'outer_end_only' : 'both_ends',
        boxGutterHouseEdge: legacy.boxGutterHouseEdge ?? 'house',
        boxGutterFarEdge: legacy.boxGutterFarEdge ?? 'our',
        downpipeCount: legacy.downpipeCount ?? '0',
        downpipeJoinCount: legacy.downpipeJoinCount ?? '0',
        downpipeElbowCount: legacy.downpipeElbowCount ?? '0',
        separateGutterEnabled: legacy.separateGutterEnabled ?? false,
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
        timberRoofAboveType: 'insulated_panels',
        timberInsulatedPanelThicknessMm: '50',
        timberTrayWidthMm: '500',
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
        overrides: legacy.overrides ?? {},
      },
    ],
    blinds: normalizeBlindsState(legacy.blinds),
  };
}

export type CalculatorDraftContext = {
  projectId?: string;
  estimateId?: string;
};
