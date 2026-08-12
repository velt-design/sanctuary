import { normalizeBlindRollCover } from '@sp/costing';
import type {
  AttachmentSide,
  AccessLevel,
  BlindRollCover as CostingBlindRollCover,
  ExtrusionColour,
  GroundCondition,
  HeightCategory,
  HouseConnectionType,
  JobType,
  PergolaStyleUi,
  PostConnectionType,
  PricingClassificationV2,
  ApprovalRequirementV2,
  RoofMaterial,
  RoofType,
} from '@sp/costing';

export type BlindSystemType = 'ZIPTRAK' | 'OMNI';
export type BlindFabric = 'MESH' | 'PVC' | 'FINE_MESH' | 'NONE';
export type BlindRollCover = CostingBlindRollCover;
type BlindMotorised = 'NONE' | 'YES';
export type CalculatorDrawingRotationQuarterTurns = 0 | 1 | 2 | 3;
export type CalculatorHouseFootprintPreset =
  | 'straight'
  | 'l_left'
  | 'l_right'
  | 'recess_left'
  | 'recess_right'
  | 'u_shape'
  | 'wrap_left'
  | 'wrap_right';
export type CalculatorHouseFootprintMode = 'preset' | 'custom_polygon';
export type CalculatorHouseFootprintPolygonPoint = {
  alongM: string;
  depthM: string;
};
export type CalculatorHouseStoreyMode = 'single_storey' | 'double_storey' | 'custom';
export type CalculatorHouseAttachmentStrategy =
  | 'soffit_brackets'
  | 'fascia_under_gutter'
  | 'facade_ledger'
  | 'post_supported_tieback'
  | 'none';

export type CalculatorHouseFootprintParams = {
  widthM: string;
  offsetXM: string;
  setbackM: string;
  bandDepthM: string;
  returnRunM: string;
  recessWidthM: string;
  recessDepthM: string;
  leftLegRunM: string;
  rightLegRunM: string;
  sideRunM: string;
};

export const DEFAULT_CALCULATOR_ATTACHMENT_SIDE: AttachmentSide = 'rear';
export const DEFAULT_CALCULATOR_DRAWING_ROTATION_QUARTER_TURNS: CalculatorDrawingRotationQuarterTurns = 0;
export const DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_MODE: CalculatorHouseFootprintMode = 'preset';
export const DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_PRESET: CalculatorHouseFootprintPreset = 'straight';

export function makeDefaultHouseFootprintParams(): CalculatorHouseFootprintParams {
  return {
    widthM: '',
    offsetXM: '0',
    setbackM: '0',
    bandDepthM: '1.8',
    returnRunM: '2.4',
    recessWidthM: '2.4',
    recessDepthM: '1.2',
    leftLegRunM: '2.4',
    rightLegRunM: '2.4',
    sideRunM: '2.4',
  };
}

export function normalizeAttachmentSide(value: unknown): AttachmentSide {
  if (value === 'front' || value === 'left' || value === 'right') return value;
  return DEFAULT_CALCULATOR_ATTACHMENT_SIDE;
}

export function normalizeDrawingRotationQuarterTurns(value: unknown): CalculatorDrawingRotationQuarterTurns {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_CALCULATOR_DRAWING_ROTATION_QUARTER_TURNS;
  const normalized = ((Math.round(parsed) % 4) + 4) % 4;
  return normalized as CalculatorDrawingRotationQuarterTurns;
}

export function normalizeHouseFootprintPreset(value: unknown): CalculatorHouseFootprintPreset {
  if (
    value === 'l_left' ||
    value === 'l_right' ||
    value === 'recess_left' ||
    value === 'recess_right' ||
    value === 'u_shape' ||
    value === 'wrap_left' ||
    value === 'wrap_right'
  ) {
    return value;
  }
  return DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_PRESET;
}

export function normalizeHouseFootprintMode(value: unknown): CalculatorHouseFootprintMode {
  return value === 'custom_polygon' || value === 'orthogonal_polygon'
    ? 'custom_polygon'
    : DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_MODE;
}

export function normalizeHouseFootprintParams(value: unknown): CalculatorHouseFootprintParams {
  const source = value && typeof value === 'object' ? (value as Partial<CalculatorHouseFootprintParams>) : {};
  const defaults = makeDefaultHouseFootprintParams();
  const pick = (raw: string | undefined, fallback: string) => {
    const trimmed = raw?.trim();
    return trimmed ? trimmed : fallback;
  };

  return {
    widthM: pick(source.widthM, defaults.widthM),
    offsetXM: pick(source.offsetXM, defaults.offsetXM),
    setbackM: pick(source.setbackM, defaults.setbackM),
    bandDepthM: pick(source.bandDepthM, defaults.bandDepthM),
    returnRunM: pick(source.returnRunM, defaults.returnRunM),
    recessWidthM: pick(source.recessWidthM, defaults.recessWidthM),
    recessDepthM: pick(source.recessDepthM, defaults.recessDepthM),
    leftLegRunM: pick(source.leftLegRunM, defaults.leftLegRunM),
    rightLegRunM: pick(source.rightLegRunM, defaults.rightLegRunM),
    sideRunM: pick(source.sideRunM, defaults.sideRunM),
  };
}

export function normalizeHouseFootprintPosition(
  value: unknown,
): NonNullable<CalculatorModuleInputs['houseFootprintPosition']> | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<NonNullable<CalculatorModuleInputs['houseFootprintPosition']>>;
  const originXMm = typeof source.originXMm === 'string' ? source.originXMm.trim() : '';
  const originYMm = typeof source.originYMm === 'string' ? source.originYMm.trim() : '';
  const rotationDeg = typeof source.rotationDeg === 'string' ? source.rotationDeg.trim() : '';
  if (!originXMm || !originYMm) return null;
  return { originXMm, originYMm, rotationDeg: rotationDeg || '0' };
}

export function normalizeHouseFootprintPolygon(value: unknown): CalculatorHouseFootprintPolygonPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => {
      if (!point || typeof point !== 'object') return null;
      const source = point as Partial<CalculatorHouseFootprintPolygonPoint>;
      return {
        alongM: typeof source.alongM === 'string' ? source.alongM.trim() : String(source.alongM ?? '').trim(),
        depthM: typeof source.depthM === 'string' ? source.depthM.trim() : String(source.depthM ?? '').trim(),
      };
    })
    .filter((point): point is CalculatorHouseFootprintPolygonPoint => Boolean(point && point.alongM && point.depthM));
}

export function supportsHouseFootprints(pergolaStyle: PergolaStyleUi): boolean {
  return pergolaStyle !== 'hip_corner';
}

export type BlindLineItem = {
  id: string;
  label?: string;
  system: BlindSystemType;
  widthMm: string;
  coverLengthMm: string;
  fabric: BlindFabric;
  motorised: BlindMotorised;
  rollCover?: BlindRollCover;
};

export type CalculatorBlindsState = {
  items: BlindLineItem[];
};

export type InfillResolvedAcrylicSourceInput = 'strip_620' | 'sheet_panels';
type InfillAcrylicSourceInput = InfillResolvedAcrylicSourceInput | 'auto';
type InfillWidthModeInput = 'match_roof_rafters' | 'target_width';
type InfillLocationInput = 'front' | 'house' | 'side' | 'gable_end' | 'wall' | 'custom';
type InfillPanelOrientationInput = 'vertical' | 'horizontal' | 'auto';
export type InfillMonoSlopeModeInput = 'heights' | 'pitch';
export type InfillMonoSlopeAnchorInput = 'left' | 'right';

export type InfillEdge = 'top' | 'bottom' | 'left' | 'right';
export type InfillEdgeConfirmation = 'yes' | 'no' | 'unsure';
export type InfillEdgeConfirmations = Record<InfillEdge, InfillEdgeConfirmation>;

export type InfillSupportInput = {
  hasTop: boolean;
  hasBottom: boolean;
  hasLeft: boolean;
  hasRight: boolean;
  edgeConfirmations?: InfillEdgeConfirmations;
  internalSupportMode?: 'none' | 'match_roof_rafters' | 'center' | 'custom';
  internalSupportPositionsM?: string[];
};

type InfillShapeInput =
  | { type: 'rect'; widthM: string; heightM: string; bottomOffsetM?: string }
  | {
      type: 'mono_slope';
      widthM: string;
      heightLowM: string;
      heightHighM: string;
      bottomOffsetM?: string;
      slopeMode?: InfillMonoSlopeModeInput;
      slopeDeg?: string;
      slopeAnchor?: InfillMonoSlopeAnchorInput;
    };

export type InfillLineItem = {
  id: string;
  label?: string;
  qty: string;
  location: InfillLocationInput;
  acrylicSource: InfillAcrylicSourceInput;
  panelOrientation: InfillPanelOrientationInput;
  widthMode: InfillWidthModeInput;
  targetPanelWidthM: string;
  maxPanelWidthM: string;
  support: InfillSupportInput;
  shape: InfillShapeInput;
};

export type CalculatorInfillsState = {
  items: InfillLineItem[];
};

export type CalculatorStandaloneInfillsState = CalculatorInfillsState & {
  extrusionColour: ExtrusionColour;
  powdercoatStandardColour?: string;
  powdercoatIsCustom?: boolean;
  powdercoatCustomColour?: string;
};

export type CalculatorLightingInput = {
  lightCount: string;
  dimmer: boolean;
};

type LegacyBlindInputsV1 = {
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

export type CalculatorFlashingBand = '0-200' | '201-300' | '301-400';
export type CalculatorFlashingPurpose = 'HEAD' | 'SIDE' | 'APRON' | 'CUSTOM';

type CalculatorFlashingRowInput = {
  id: string;
  kind: 'primary' | 'extra';
  band: CalculatorFlashingBand;
  lengthM: string;
  purpose?: CalculatorFlashingPurpose;
};

export type CalculatorFlashingsState = {
  rows: CalculatorFlashingRowInput[];
};

export type CalculatorAdditionalAluminiumRow = {
  id: string;
  profile: string;
  stockLengthM: string;
  quantity: string;
};

export type CalculatorAdditionalAluminiumState = {
  rows: CalculatorAdditionalAluminiumRow[];
};

export type CalculatorModuleInputs = {
  pergolaId?: string;
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
  /** Open-pergola target rafter spacing in millimetres. */
  rafterSpacingMm?: string;
  gableEndFramesMode: 'none' | 'outer_end_only' | 'both_ends';
  gableHouseEdgeGutter: 'house' | 'our';
  gableOuterEdgeGutter: 'house' | 'our';
  boxGutterHouseEdge: 'house' | 'our' | 'none';
  boxGutterFarEdge: 'house' | 'our' | 'none';
  downpipeCount: string;
  downpipeJoinCount: string;
  downpipeElbowCount: string;
  separateGutterEnabled: boolean;
  overhangEnabled: boolean;
  overhangAmountM: string;
  overhangSupportBeamProfile: '150x50' | '200x50' | 'RHS 150x50x3';
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
  attachmentSide?: AttachmentSide;
  drawingRotationQuarterTurns?: CalculatorDrawingRotationQuarterTurns;
  houseFootprintMode?: CalculatorHouseFootprintMode;
  houseFootprintPreset?: CalculatorHouseFootprintPreset;
  houseFootprintParams?: CalculatorHouseFootprintParams;
  houseFootprintPolygon?: CalculatorHouseFootprintPolygonPoint[];
  /**
   * House first-class spatial position (mm world origin + degrees rotation).
   * When set, geometry decodes `houseFootprintPolygon` against a unit (1m × 1m)
   * frame and applies this position post-decode — so the house is invariant
   * to pergola dimensions. When absent, legacy real-frame decoder runs.
   *
   * Auto-populated on first house edge-drag commit (stage 3.4 of the
   * first-class-spatial-entities migration). Stored as strings for parity
   * with sibling persisted fields.
   */
  houseFootprintPosition?: {
    originXMm: string;
    originYMm: string;
    rotationDeg: string;
  };
  houseStoreyMode?: CalculatorHouseStoreyMode;
  houseAttachmentStrategy?: CalculatorHouseAttachmentStrategy;
  houseEaveHeightM?: string;
  houseWallHeightM?: string;
  houseRoofPitchDeg?: string;
  houseSoffitDepthMm?: string;
  houseFasciaHeightMm?: string;
  houseGutterWidthMm?: string;
  houseGutterDepthMm?: string;
  houseGutterProjectionMm?: string;
  houseEaveOverhangMm?: string;
  postConnectionType: PostConnectionType;
  ground: GroundCondition;

  lengthM: string;
  projectionM: string;
  hipCornerLengthBM: string;
  hipCornerProjectionBM: string;
  postCutHeightM: string;

  timberRoofAllowanceExGst: string;

  flashings?: CalculatorFlashingsState;
  additionalAluminium?: CalculatorAdditionalAluminiumState;
  overrides?: CalculatorModuleOverrides;
  infills?: CalculatorInfillsState;
};

export type CalculatorPergola = {
  id: string;
  label: string;
  lighting?: CalculatorLightingInput;
};

export type CalculatorInputs = {
  schemaVersion: 'v2';
  projectName: string;
  quoteRef: string;

  access: AccessLevel;
  height: HeightCategory;
  jobType: JobType;
  pricingClassification?: PricingClassificationV2;
  approvalRequirement?: ApprovalRequirementV2;
  travelExGst: string;
  extrasAllowanceExGst: string;
  quoteDiscountPct: string;

  pergolas?: CalculatorPergola[];
  modules: CalculatorModuleInputs[];
  blinds?: CalculatorBlindsState;
  /** Add-on infills fitted to a pergola that is outside this estimate. */
  standaloneInfills?: CalculatorStandaloneInfillsState;
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
  overhangSupportBeamProfile?: '150x50' | '200x50' | 'RHS 150x50x3';
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
  flashings?: CalculatorFlashingsState;
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

function isLegacyBlindInputsV1(value: unknown): value is LegacyBlindInputsV1 {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return typeof v.totalWidthMm === 'string' && typeof v.coverLengthMm === 'string';
}

function isCalculatorBlindsState(value: unknown): value is CalculatorBlindsState {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return Array.isArray(v.items);
}

export function normalizeBlindsState(value: unknown): CalculatorBlindsState | undefined {
  if (isCalculatorBlindsState(value)) {
    const needsRollCoverDefaults = value.items.some(
      (item) => item.rollCover !== normalizeBlindRollCover(item.rollCover),
    );
    if (!needsRollCoverDefaults) return value;
    return {
      items: value.items.map((item) => ({
        ...item,
        rollCover: normalizeBlindRollCover(item.rollCover),
      })),
    };
  }
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
      rollCover: 'NONE' as const,
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
    jobType: 'residential',
    pricingClassification: 'bespoke',
    approvalRequirement: 'neither',
    travelExGst: legacy.travelExGst,
    extrasAllowanceExGst: legacy.extrasAllowanceExGst,
    quoteDiscountPct: legacy.quoteDiscountPct,
    pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
    modules: [
      {
        pergolaId: 'pergola-1',
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
        gableHouseEdgeGutter: legacy.houseConnectionType === 'none' ? 'our' : 'house',
        gableOuterEdgeGutter: 'our',
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
        attachmentSide: DEFAULT_CALCULATOR_ATTACHMENT_SIDE,
        drawingRotationQuarterTurns: DEFAULT_CALCULATOR_DRAWING_ROTATION_QUARTER_TURNS,
        houseFootprintMode: DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_MODE,
        houseFootprintPreset: DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_PRESET,
        houseFootprintParams: makeDefaultHouseFootprintParams(),
        houseFootprintPolygon: [],
        postConnectionType: legacy.postConnectionType,
        ground: legacy.ground,
        lengthM: legacy.lengthM,
        projectionM: legacy.projectionM,
        hipCornerLengthBM: '0',
        hipCornerProjectionBM: '0',
        postCutHeightM: legacy.postCutHeightM,
        timberRoofAllowanceExGst: legacy.timberRoofAllowanceExGst,
        flashings: { rows: [] },
        overrides: legacy.overrides ?? {},
        infills: { items: [] },
      },
    ],
    blinds: normalizeBlindsState(legacy.blinds),
  };
}

