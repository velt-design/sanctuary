import type { AttachmentSide, CostOutputV1, RoofType, SlopeDirection } from '@sp/costing';
import {
  DEFAULT_CALCULATOR_ATTACHMENT_SIDE,
  DEFAULT_CALCULATOR_DRAWING_ROTATION_QUARTER_TURNS,
  DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_PRESET,
  makeDefaultHouseFootprintParams,
  normalizeAttachmentSide,
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPreset,
  supportsHouseFootprints,
  type CalculatorDrawingRotationQuarterTurns,
  type CalculatorHouseFootprintParams,
  type CalculatorHouseFootprintPreset,
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';

export type ModulePlanDataSource = 'derived' | 'input_fallback';
export type ModuleSectionDataSource = ModulePlanDataSource;

export type ModulePlanModel = {
  dataSource: ModulePlanDataSource;
  pergolaStyle: CalculatorModuleInputs['pergolaStyle'];
  roofType: RoofType;
  boxPerimeterEnabled: boolean;
  houseConnectionType: CalculatorModuleInputs['houseConnectionType'];
  attachmentSide: AttachmentSide;
  drawingRotationQuarterTurns: CalculatorDrawingRotationQuarterTurns;
  houseFootprintPreset: CalculatorHouseFootprintPreset;
  houseFootprintParams: CalculatorHouseFootprintParams;
  supportsHouseFootprints: boolean;
  overhangEnabled: boolean;
  overhangAmountM: number;
  slopeDirection: SlopeDirection;
  lengthA: number;
  spanA: number;
  lengthB: number | null;
  spanB: number | null;
  rafterWidthM: number;
  rafterDepthM: number;
  ledgerBeamWidthM: number;
  ledgerBeamDepthM: number;
  supportBeamWidthM: number;
  supportBeamDepthM: number;
  gutterWidthM: number;
  gutterDepthM: number;
  ridgeBeamWidthM: number;
  ridgeBeamDepthM: number;
  rafterMaxSpacingM: number;
  rafterCountA: number;
  rafterSpacingA: number;
  rafterPositionsA: number[];
  rafterEdgeLengthM: number;
  rafterCountB: number | null;
  rafterSpacingB: number | null;
  rafterPositionsB: number[] | null;
  attachmentEdgeLengthM: number;
  soffitBracketOffsetM: number;
  soffitBracketMaxSpacingM: number;
  soffitBracketPositionsA: number[];
};

export type ModuleSectionModel = {
  dataSource: ModuleSectionDataSource;
  pergolaStyle: CalculatorModuleInputs['pergolaStyle'];
  roofType: RoofType;
  boxPerimeterEnabled: boolean;
  houseConnectionType: CalculatorModuleInputs['houseConnectionType'];
  attachmentSide: AttachmentSide;
  sectionSpanField: 'lengthM' | 'projectionM';
  overhangEnabled: boolean;
  overhangAmountM: number;
  slopeDirection: SlopeDirection;
  sectionKind: 'mono' | 'gable';
  spanA: number;
  spanB: number | null;
  pitchDeg: number;
  postWidthM: number;
  postDepthM: number;
  rafterWidthM: number;
  rafterDepthM: number;
  ledgerBeamWidthM: number;
  ledgerBeamDepthM: number;
  supportBeamWidthM: number;
  supportBeamDepthM: number;
  gutterWidthM: number;
  gutterDepthM: number;
  ridgeBeamWidthM: number;
  ridgeBeamDepthM: number;
  leftEdgeHeightM: number;
  rightEdgeHeightM: number;
  ridgeHeightM: number | null;
  boxRiseM: number | null;
};

function toPositiveNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function toNonNegativeNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function roofTypeFromModule(module: CalculatorModuleInputs): RoofType {
  if (module.pergolaStyle === 'gable') return 'gable';
  if (module.pergolaStyle === 'hip') return 'hip';
  if (module.pergolaStyle === 'hip_corner') return 'hip_corner';
  return 'pitched';
}

function slopeDirectionFromInputs(module: CalculatorModuleInputs): SlopeDirection {
  return module.invertedEnabled ? 'toward_house' : 'away_from_house';
}

function pitchFromInputs(module: CalculatorModuleInputs): number {
  const parsed = Number.parseFloat(String(module.roofPitchDeg ?? ''));
  if (Number.isFinite(parsed)) return Math.max(0, Math.min(85, parsed));
  if (module.pergolaStyle === 'gable' || module.pergolaStyle === 'hip' || module.pergolaStyle === 'hip_corner') return 25;
  return 5;
}

function normalizeSlopeDirection(value: unknown): SlopeDirection | null {
  if (value === 'toward_house') return 'toward_house';
  if (value === 'away_from_house') return 'away_from_house';
  return null;
}

function hasValidHipCorner(lengthB: number | null, spanB: number | null): boolean {
  return typeof lengthB === 'number' && Number.isFinite(lengthB) && lengthB > 0 && typeof spanB === 'number' && Number.isFinite(spanB) && spanB > 0;
}

function isGableLike(roofType: RoofType): boolean {
  return roofType === 'gable' || roofType === 'low_gable' || roofType === 'hip';
}

function supportsPresetFootprints(module: CalculatorModuleInputs): boolean {
  return supportsHouseFootprints(module.pergolaStyle);
}

function attachmentSideFromModule(module: CalculatorModuleInputs): AttachmentSide {
  if (module.houseConnectionType === 'none') return DEFAULT_CALCULATOR_ATTACHMENT_SIDE;
  if (!supportsPresetFootprints(module)) return DEFAULT_CALCULATOR_ATTACHMENT_SIDE;
  return normalizeAttachmentSide((module as Partial<CalculatorModuleInputs>).attachmentSide);
}

function drawingRotationQuarterTurnsFromModule(module: CalculatorModuleInputs): CalculatorDrawingRotationQuarterTurns {
  if (!supportsPresetFootprints(module)) return DEFAULT_CALCULATOR_DRAWING_ROTATION_QUARTER_TURNS;
  return normalizeDrawingRotationQuarterTurns((module as Partial<CalculatorModuleInputs>).drawingRotationQuarterTurns);
}

function houseFootprintPresetFromModule(module: CalculatorModuleInputs): CalculatorHouseFootprintPreset {
  if (!supportsPresetFootprints(module)) return DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_PRESET;
  return normalizeHouseFootprintPreset((module as Partial<CalculatorModuleInputs>).houseFootprintPreset);
}

function houseFootprintParamsFromModule(module: CalculatorModuleInputs): CalculatorHouseFootprintParams {
  if (!supportsPresetFootprints(module)) return makeDefaultHouseFootprintParams();
  return normalizeHouseFootprintParams((module as Partial<CalculatorModuleInputs>).houseFootprintParams);
}

function attachmentEdgeLengthForRectangularPlan(lengthA: number, spanA: number, attachmentSide: AttachmentSide): number {
  return attachmentSide === 'left' || attachmentSide === 'right' ? spanA : lengthA;
}

function sectionSpanFieldForModule(module: CalculatorModuleInputs, roofType: RoofType, attachmentSide: AttachmentSide): 'lengthM' | 'projectionM' {
  if (roofType === 'hip_corner' || module.houseConnectionType === 'none') return 'projectionM';
  return attachmentSide === 'left' || attachmentSide === 'right' ? 'lengthM' : 'projectionM';
}

const RAFTER_MAX_SPACING_M = 0.642;
const SOFFIT_BRACKET_OFFSET_M = 0.5;
const SOFFIT_BRACKET_MAX_SPACING_M = 1.5;
const DEFAULT_RAFTER_WIDTH_M = 0.05;
const DEFAULT_RAFTER_DEPTH_M = 0.15;
const DEFAULT_POST_WIDTH_M = 0.1;
const DEFAULT_POST_DEPTH_M = 0.1;
const DEFAULT_LEDGER_WIDTH_M = 0.05;
const DEFAULT_LEDGER_DEPTH_M = 0.1;
const DEFAULT_SUPPORT_BEAM_WIDTH_M = 0.05;
const DEFAULT_SUPPORT_BEAM_DEPTH_M = 0.15;
const DEFAULT_GUTTER_WIDTH_M = 0.1;
const DEFAULT_GUTTER_DEPTH_M = 0.15;
const DEFAULT_RIDGE_BEAM_WIDTH_M = 0.05;
const DEFAULT_RIDGE_BEAM_DEPTH_M = 0.15;

function parseProfilePairMm(value: unknown): { aMm: number; bMm: number } | null {
  const text = String(value ?? '').toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const a = Number.parseFloat(match[1] ?? '');
  const b = Number.parseFloat(match[2] ?? '');
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  return { aMm: a, bMm: b };
}

function profileDimsFromAny(
  value: unknown,
  fallbackDepthM: number,
  fallbackWidthM: number,
): { depthM: number; widthM: number } {
  const parsed = parseProfilePairMm(value);
  if (parsed) {
    return {
      depthM: Math.max(parsed.aMm, parsed.bMm) / 1000,
      widthM: Math.min(parsed.aMm, parsed.bMm) / 1000,
    };
  }
  const text = String(value ?? '').toLowerCase();
  if (text.includes('sp gutter')) return { depthM: 0.15, widthM: 0.1 };
  if (text.includes('box_gutter_100x100') || text.includes('box gutter 100x100')) return { depthM: 0.1, widthM: 0.1 };
  return { depthM: fallbackDepthM, widthM: fallbackWidthM };
}

function profileDimsStrict(
  value: unknown,
  fallbackDepthM: number,
  fallbackWidthM: number,
): { depthM: number; widthM: number } {
  const parsed = parseProfilePairMm(value);
  if (parsed) {
    return {
      depthM: Math.max(parsed.aMm, parsed.bMm) / 1000,
      widthM: Math.min(parsed.aMm, parsed.bMm) / 1000,
    };
  }
  return { depthM: fallbackDepthM, widthM: fallbackWidthM };
}

function resolveMemberProfileDims(
  module: CalculatorModuleInputs,
  moduleResult: CostOutputV1 | null,
): {
  postWidthM: number;
  postDepthM: number;
  rafterWidthM: number;
  rafterDepthM: number;
  ledgerBeamWidthM: number;
  ledgerBeamDepthM: number;
  supportBeamWidthM: number;
  supportBeamDepthM: number;
  gutterWidthM: number;
  gutterDepthM: number;
  ridgeBeamWidthM: number;
  ridgeBeamDepthM: number;
} {
  const normalized = moduleResult?.inputs_normalized as any;
  const derived = moduleResult?.derived as any;
  const rafterProfileRaw =
    normalized?.rafter_profile ??
    derived?.rafter_profile_auto ??
    derived?.overhang_stringer_profile_used ??
    module.overrides?.rafterProfile ??
    null;
  const rafterDims = profileDimsFromAny(rafterProfileRaw, DEFAULT_RAFTER_DEPTH_M, DEFAULT_RAFTER_WIDTH_M);
  const postProfileRaw = derived?.post_profile_used ?? (module.overrides as any)?.postProfile ?? null;
  const postDims = profileDimsStrict(postProfileRaw, DEFAULT_POST_DEPTH_M, DEFAULT_POST_WIDTH_M);

  const gutterTypeRaw = normalized?.gutter_type ?? derived?.gutter_mode ?? null;
  const frontBeamProfileRaw = derived?.front_beam_profile_used ?? module.overrides?.frontBeamProfile ?? 'SP Gutter';
  const gutterDims = profileDimsFromAny(gutterTypeRaw || frontBeamProfileRaw, DEFAULT_GUTTER_DEPTH_M, DEFAULT_GUTTER_WIDTH_M);
  const ledgerBeamProfileRaw = derived?.ledger_profile_used ?? (module.overrides as any)?.ledgerProfile ?? null;
  const ledgerBeamDims = profileDimsStrict(ledgerBeamProfileRaw, DEFAULT_LEDGER_DEPTH_M, DEFAULT_LEDGER_WIDTH_M);
  const supportBeamProfileRaw = derived?.support_beam_profile_used ?? (module.overrides as any)?.supportBeamProfile ?? derived?.front_beam_profile_used ?? null;
  const supportBeamDims = profileDimsStrict(supportBeamProfileRaw, DEFAULT_SUPPORT_BEAM_DEPTH_M, DEFAULT_SUPPORT_BEAM_WIDTH_M);
  const ridgeBeamProfileRaw = derived?.ridge_beam_profile_used ?? (module.overrides as any)?.ridgeBeamProfile ?? null;
  const ridgeBeamDims = profileDimsStrict(ridgeBeamProfileRaw, DEFAULT_RIDGE_BEAM_DEPTH_M, DEFAULT_RIDGE_BEAM_WIDTH_M);

  return {
    postWidthM: postDims.widthM,
    postDepthM: postDims.depthM,
    rafterWidthM: rafterDims.widthM,
    rafterDepthM: rafterDims.depthM,
    ledgerBeamWidthM: ledgerBeamDims.widthM,
    ledgerBeamDepthM: ledgerBeamDims.depthM,
    supportBeamWidthM: supportBeamDims.widthM,
    supportBeamDepthM: supportBeamDims.depthM,
    gutterWidthM: gutterDims.widthM,
    gutterDepthM: gutterDims.depthM,
    ridgeBeamWidthM: ridgeBeamDims.widthM,
    ridgeBeamDepthM: ridgeBeamDims.depthM,
  };
}

function resolveOverhangFromDerived(
  module: CalculatorModuleInputs,
  derived: Record<string, unknown>,
): { enabled: boolean; amountM: number } {
  const enabled = typeof derived.overhang_enabled === 'boolean' ? derived.overhang_enabled : Boolean(module.overhangEnabled);
  if (!enabled) return { enabled: false, amountM: 0 };
  const derivedAmount = toNonNegativeNumber(derived.overhang_amount_m);
  const fallbackAmount = toNonNegativeNumber(module.overhangAmountM) ?? 0;
  return { enabled: true, amountM: derivedAmount ?? fallbackAmount };
}

function calcRafterLayout(lengthM: number, preferredCount?: number): { count: number; spacingM: number; positionsM: number[] } {
  const safeLength = Math.max(0, lengthM);
  const fallbackCount = Math.max(2, Math.ceil((safeLength * 1000) / (RAFTER_MAX_SPACING_M * 1000)) + 1);
  const preferred = typeof preferredCount === 'number' && Number.isFinite(preferredCount) ? Math.round(preferredCount) : null;
  const count = Math.max(2, fallbackCount, preferred ?? 0);
  const bays = Math.max(1, count - 1);
  const spacingM = safeLength / bays;
  const positionsM = Array.from({ length: count }, (_, idx) => spacingM * idx);
  return { count, spacingM, positionsM };
}

function calcSoffitBracketPositions(lengthM: number, enabled: boolean, preferredCount?: number): number[] {
  if (!enabled) return [];
  const safeLength = Math.max(0, lengthM);
  if (!safeLength) return [];
  if (safeLength <= SOFFIT_BRACKET_OFFSET_M * 2 + 0.05) return [safeLength / 2];

  const start = SOFFIT_BRACKET_OFFSET_M;
  const end = Math.max(start, safeLength - SOFFIT_BRACKET_OFFSET_M);
  const span = Math.max(0, end - start);
  const fallbackCount = Math.max(2, Math.ceil(span / SOFFIT_BRACKET_MAX_SPACING_M) + 1);
  const preferred = typeof preferredCount === 'number' && Number.isFinite(preferredCount) ? Math.round(preferredCount) : null;
  const count = Math.max(2, fallbackCount, preferred ?? 0);
  const spacing = span / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, idx) => start + spacing * idx);
}

function tryBuildFromDerived(module: CalculatorModuleInputs, moduleResult: CostOutputV1): ModulePlanModel | null {
  const roofType = moduleResult.inputs_normalized?.roof_type;
  if (!roofType) return null;
  const derived = moduleResult.derived as any;
  const memberDims = resolveMemberProfileDims(module, moduleResult);
  const supportsFootprints = supportsPresetFootprints(module);
  const attachmentSide = attachmentSideFromModule(module);
  const drawingRotationQuarterTurns = drawingRotationQuarterTurnsFromModule(module);
  const houseFootprintPreset = houseFootprintPresetFromModule(module);
  const houseFootprintParams = houseFootprintParamsFromModule(module);

  const lengthA = toPositiveNumber(derived?.length_m);
  const spanA = toPositiveNumber(derived?.projection_m);
  if (!lengthA || !spanA) return null;

  const lengthB = toPositiveNumber(derived?.hip_corner_length_b_m);
  const spanB = toPositiveNumber(derived?.hip_corner_projection_b_m);
  if (roofType === 'hip_corner' && !hasValidHipCorner(lengthB, spanB)) return null;

  const attachmentEdgeLengthM = roofType === 'hip_corner' ? lengthA : attachmentEdgeLengthForRectangularPlan(lengthA, spanA, attachmentSide);
  const rafterLayoutA = calcRafterLayout(
    roofType === 'hip_corner' ? lengthA : attachmentEdgeLengthM,
    roofType === 'hip_corner' || attachmentSide === 'rear' || attachmentSide === 'front'
      ? roofType === 'hip_corner'
        ? toPositiveNumber(derived?.hip_corner_rafter_count_a) ?? toPositiveNumber(derived?.rafter_count) ?? undefined
        : toPositiveNumber(derived?.rafter_count) ?? undefined
      : undefined,
  );
  const rafterLayoutB =
    roofType === 'hip_corner' && lengthB
      ? calcRafterLayout(lengthB, toPositiveNumber(derived?.hip_corner_rafter_count_b) ?? undefined)
      : null;
  const bracketCount = toPositiveNumber(derived?.bracket_count);
  const soffitBracketPositionsA = calcSoffitBracketPositions(attachmentEdgeLengthM, module.houseConnectionType === 'soffit', bracketCount ?? undefined);
  const overhang = resolveOverhangFromDerived(module, derived);

  return {
    dataSource: 'derived',
    pergolaStyle: module.pergolaStyle,
    roofType,
    boxPerimeterEnabled: Boolean(module.boxPerimeterEnabled),
    houseConnectionType: module.houseConnectionType,
    attachmentSide,
    drawingRotationQuarterTurns,
    houseFootprintPreset,
    houseFootprintParams,
    supportsHouseFootprints: supportsFootprints,
    overhangEnabled: overhang.enabled,
    overhangAmountM: overhang.amountM,
    slopeDirection: normalizeSlopeDirection(derived?.slope_direction) ?? slopeDirectionFromInputs(module),
    lengthA,
    spanA,
    lengthB: roofType === 'hip_corner' ? lengthB : null,
    spanB: roofType === 'hip_corner' ? spanB : null,
    rafterWidthM: memberDims.rafterWidthM,
    rafterDepthM: memberDims.rafterDepthM,
    ledgerBeamWidthM: memberDims.ledgerBeamWidthM,
    ledgerBeamDepthM: memberDims.ledgerBeamDepthM,
    supportBeamWidthM: memberDims.supportBeamWidthM,
    supportBeamDepthM: memberDims.supportBeamDepthM,
    gutterWidthM: memberDims.gutterWidthM,
    gutterDepthM: memberDims.gutterDepthM,
    ridgeBeamWidthM: memberDims.ridgeBeamWidthM,
    ridgeBeamDepthM: memberDims.ridgeBeamDepthM,
    rafterMaxSpacingM: RAFTER_MAX_SPACING_M,
    rafterCountA: rafterLayoutA.count,
    rafterSpacingA: rafterLayoutA.spacingM,
    rafterPositionsA: rafterLayoutA.positionsM,
    rafterEdgeLengthM: roofType === 'hip_corner' ? lengthA : attachmentEdgeLengthM,
    rafterCountB: rafterLayoutB?.count ?? null,
    rafterSpacingB: rafterLayoutB?.spacingM ?? null,
    rafterPositionsB: rafterLayoutB?.positionsM ?? null,
    attachmentEdgeLengthM,
    soffitBracketOffsetM: SOFFIT_BRACKET_OFFSET_M,
    soffitBracketMaxSpacingM: SOFFIT_BRACKET_MAX_SPACING_M,
    soffitBracketPositionsA,
  };
}

function tryBuildFromInputs(module: CalculatorModuleInputs): ModulePlanModel | null {
  const roofType = roofTypeFromModule(module);
  const memberDims = resolveMemberProfileDims(module, null);
  const supportsFootprints = supportsPresetFootprints(module);
  const attachmentSide = attachmentSideFromModule(module);
  const drawingRotationQuarterTurns = drawingRotationQuarterTurnsFromModule(module);
  const houseFootprintPreset = houseFootprintPresetFromModule(module);
  const houseFootprintParams = houseFootprintParamsFromModule(module);
  const lengthA = toPositiveNumber(module.lengthM);
  const spanA = toPositiveNumber(module.projectionM);
  if (!lengthA || !spanA) return null;

  const lengthB = toPositiveNumber(module.hipCornerLengthBM);
  const spanB = toPositiveNumber(module.hipCornerProjectionBM);
  if (roofType === 'hip_corner' && !hasValidHipCorner(lengthB, spanB)) return null;

  const attachmentEdgeLengthM = roofType === 'hip_corner' ? lengthA : attachmentEdgeLengthForRectangularPlan(lengthA, spanA, attachmentSide);
  const rafterLayoutA = calcRafterLayout(roofType === 'hip_corner' ? lengthA : attachmentEdgeLengthM);
  const rafterLayoutB = roofType === 'hip_corner' && lengthB ? calcRafterLayout(lengthB) : null;
  const soffitBracketPositionsA = calcSoffitBracketPositions(attachmentEdgeLengthM, module.houseConnectionType === 'soffit');
  const overhangAmountM = toNonNegativeNumber(module.overhangAmountM) ?? 0;

  return {
    dataSource: 'input_fallback',
    pergolaStyle: module.pergolaStyle,
    roofType,
    boxPerimeterEnabled: Boolean(module.boxPerimeterEnabled),
    houseConnectionType: module.houseConnectionType,
    attachmentSide,
    drawingRotationQuarterTurns,
    houseFootprintPreset,
    houseFootprintParams,
    supportsHouseFootprints: supportsFootprints,
    overhangEnabled: Boolean(module.overhangEnabled),
    overhangAmountM: module.overhangEnabled ? overhangAmountM : 0,
    slopeDirection: slopeDirectionFromInputs(module),
    lengthA,
    spanA,
    lengthB: roofType === 'hip_corner' ? lengthB : null,
    spanB: roofType === 'hip_corner' ? spanB : null,
    rafterWidthM: memberDims.rafterWidthM,
    rafterDepthM: memberDims.rafterDepthM,
    ledgerBeamWidthM: memberDims.ledgerBeamWidthM,
    ledgerBeamDepthM: memberDims.ledgerBeamDepthM,
    supportBeamWidthM: memberDims.supportBeamWidthM,
    supportBeamDepthM: memberDims.supportBeamDepthM,
    gutterWidthM: memberDims.gutterWidthM,
    gutterDepthM: memberDims.gutterDepthM,
    ridgeBeamWidthM: memberDims.ridgeBeamWidthM,
    ridgeBeamDepthM: memberDims.ridgeBeamDepthM,
    rafterMaxSpacingM: RAFTER_MAX_SPACING_M,
    rafterCountA: rafterLayoutA.count,
    rafterSpacingA: rafterLayoutA.spacingM,
    rafterPositionsA: rafterLayoutA.positionsM,
    rafterEdgeLengthM: roofType === 'hip_corner' ? lengthA : attachmentEdgeLengthM,
    rafterCountB: rafterLayoutB?.count ?? null,
    rafterSpacingB: rafterLayoutB?.spacingM ?? null,
    rafterPositionsB: rafterLayoutB?.positionsM ?? null,
    attachmentEdgeLengthM,
    soffitBracketOffsetM: SOFFIT_BRACKET_OFFSET_M,
    soffitBracketMaxSpacingM: SOFFIT_BRACKET_MAX_SPACING_M,
    soffitBracketPositionsA,
  };
}

export function buildModulePlanModel(module: CalculatorModuleInputs, moduleResult: CostOutputV1 | null): ModulePlanModel | null {
  if (moduleResult) {
    const fromDerived = tryBuildFromDerived(module, moduleResult);
    if (fromDerived) return fromDerived;
  }
  return tryBuildFromInputs(module);
}

function toSafePitch(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(85, n));
}

function buildSectionHeights(
  roofType: RoofType,
  slopeDirection: SlopeDirection,
  pitchDeg: number,
  spanA: number,
  baseHeightM: number,
  houseHeightM: number | null,
  outerHeightM: number | null,
): Pick<ModuleSectionModel, 'sectionKind' | 'leftEdgeHeightM' | 'rightEdgeHeightM' | 'ridgeHeightM'> {
  if (isGableLike(roofType)) {
    const eaveHeight = Math.max(0, houseHeightM ?? outerHeightM ?? baseHeightM);
    const rise = Math.tan((pitchDeg * Math.PI) / 180) * (spanA / 2);
    return {
      sectionKind: 'gable',
      leftEdgeHeightM: eaveHeight,
      rightEdgeHeightM: eaveHeight,
      ridgeHeightM: Math.max(0, eaveHeight + rise),
    };
  }

  const rise = Math.tan((pitchDeg * Math.PI) / 180) * spanA;
  let leftEdgeHeightM = houseHeightM;
  let rightEdgeHeightM = outerHeightM;

  if (leftEdgeHeightM === null && rightEdgeHeightM === null) {
    if (slopeDirection === 'toward_house') {
      leftEdgeHeightM = Math.max(0, baseHeightM - rise);
      rightEdgeHeightM = baseHeightM;
    } else {
      leftEdgeHeightM = baseHeightM;
      rightEdgeHeightM = Math.max(0, baseHeightM - rise);
    }
  } else if (leftEdgeHeightM === null) {
    leftEdgeHeightM = Math.max(0, rightEdgeHeightM! + (slopeDirection === 'toward_house' ? -rise : rise));
  } else if (rightEdgeHeightM === null) {
    rightEdgeHeightM = Math.max(0, leftEdgeHeightM + (slopeDirection === 'toward_house' ? rise : -rise));
  }

  return {
    sectionKind: 'mono',
    leftEdgeHeightM: Math.max(0, leftEdgeHeightM ?? baseHeightM),
    rightEdgeHeightM: Math.max(0, rightEdgeHeightM ?? baseHeightM),
    ridgeHeightM: null,
  };
}

function tryBuildSectionFromDerived(module: CalculatorModuleInputs, moduleResult: CostOutputV1): ModuleSectionModel | null {
  const roofType = moduleResult.inputs_normalized?.roof_type;
  if (!roofType) return null;
  const derived = moduleResult.derived as any;
  const memberDims = resolveMemberProfileDims(module, moduleResult);
  const attachmentSide = attachmentSideFromModule(module);
  const sectionSpanField = sectionSpanFieldForModule(module, roofType, attachmentSide);

  const spanA = sectionSpanField === 'lengthM' ? toPositiveNumber(derived?.length_m) : toPositiveNumber(derived?.projection_m);
  if (!spanA) return null;

  const pitchDeg =
    (module.boxPerimeterEnabled ? toSafePitch(derived?.box_pitch_deg_used) : null) ??
    toSafePitch(derived?.roof_pitch_deg_used) ??
    pitchFromInputs(module);

  const slopeDirection = normalizeSlopeDirection(derived?.slope_direction) ?? slopeDirectionFromInputs(module);
  const baseHeightM = toPositiveNumber(derived?.ledger_underside_height_m) ?? toPositiveNumber(module.postCutHeightM) ?? 2.4;
  const houseHeightM = toPositiveNumber(derived?.post_cut_height_house_side_m);
  const outerHeightM = toPositiveNumber(derived?.post_cut_height_outer_side_m);
  const spanB = roofType === 'hip_corner' ? toPositiveNumber(derived?.hip_corner_projection_b_m) : null;

  const heights = buildSectionHeights(roofType, slopeDirection, pitchDeg, spanA, baseHeightM, houseHeightM, outerHeightM);
  const overhang = resolveOverhangFromDerived(module, derived);

  return {
    dataSource: 'derived',
    pergolaStyle: module.pergolaStyle,
    roofType,
    boxPerimeterEnabled: Boolean(module.boxPerimeterEnabled),
    houseConnectionType: module.houseConnectionType,
    attachmentSide,
    sectionSpanField,
    overhangEnabled: overhang.enabled,
    overhangAmountM: overhang.amountM,
    slopeDirection,
    sectionKind: heights.sectionKind,
    spanA,
    spanB,
    pitchDeg,
    postWidthM: memberDims.postWidthM,
    postDepthM: memberDims.postDepthM,
    rafterWidthM: memberDims.rafterWidthM,
    rafterDepthM: memberDims.rafterDepthM,
    ledgerBeamWidthM: memberDims.ledgerBeamWidthM,
    ledgerBeamDepthM: memberDims.ledgerBeamDepthM,
    supportBeamWidthM: memberDims.supportBeamWidthM,
    supportBeamDepthM: memberDims.supportBeamDepthM,
    gutterWidthM: memberDims.gutterWidthM,
    gutterDepthM: memberDims.gutterDepthM,
    ridgeBeamWidthM: memberDims.ridgeBeamWidthM,
    ridgeBeamDepthM: memberDims.ridgeBeamDepthM,
    leftEdgeHeightM: heights.leftEdgeHeightM,
    rightEdgeHeightM: heights.rightEdgeHeightM,
    ridgeHeightM: heights.ridgeHeightM,
    boxRiseM: toPositiveNumber(derived?.box_rise_mm) ? Number(derived.box_rise_mm) / 1000 : null,
  };
}

function tryBuildSectionFromInputs(module: CalculatorModuleInputs): ModuleSectionModel | null {
  const roofType = roofTypeFromModule(module);
  const memberDims = resolveMemberProfileDims(module, null);
  const attachmentSide = attachmentSideFromModule(module);
  const sectionSpanField = sectionSpanFieldForModule(module, roofType, attachmentSide);
  const spanA = sectionSpanField === 'lengthM' ? toPositiveNumber(module.lengthM) : toPositiveNumber(module.projectionM);
  if (!spanA) return null;

  const pitchDeg = pitchFromInputs(module);
  const slopeDirection = slopeDirectionFromInputs(module);
  const baseHeightM = toPositiveNumber(module.postCutHeightM) ?? 2.4;
  const spanB = roofType === 'hip_corner' ? toPositiveNumber(module.hipCornerProjectionBM) : null;

  if (roofType === 'hip_corner' && spanB === null) return null;

  const heights = buildSectionHeights(roofType, slopeDirection, pitchDeg, spanA, baseHeightM, null, null);
  const overhangAmountM = toNonNegativeNumber(module.overhangAmountM) ?? 0;

  return {
    dataSource: 'input_fallback',
    pergolaStyle: module.pergolaStyle,
    roofType,
    boxPerimeterEnabled: Boolean(module.boxPerimeterEnabled),
    houseConnectionType: module.houseConnectionType,
    attachmentSide,
    sectionSpanField,
    overhangEnabled: Boolean(module.overhangEnabled),
    overhangAmountM: module.overhangEnabled ? overhangAmountM : 0,
    slopeDirection,
    sectionKind: heights.sectionKind,
    spanA,
    spanB,
    pitchDeg,
    postWidthM: memberDims.postWidthM,
    postDepthM: memberDims.postDepthM,
    rafterWidthM: memberDims.rafterWidthM,
    rafterDepthM: memberDims.rafterDepthM,
    ledgerBeamWidthM: memberDims.ledgerBeamWidthM,
    ledgerBeamDepthM: memberDims.ledgerBeamDepthM,
    supportBeamWidthM: memberDims.supportBeamWidthM,
    supportBeamDepthM: memberDims.supportBeamDepthM,
    gutterWidthM: memberDims.gutterWidthM,
    gutterDepthM: memberDims.gutterDepthM,
    ridgeBeamWidthM: memberDims.ridgeBeamWidthM,
    ridgeBeamDepthM: memberDims.ridgeBeamDepthM,
    leftEdgeHeightM: heights.leftEdgeHeightM,
    rightEdgeHeightM: heights.rightEdgeHeightM,
    ridgeHeightM: heights.ridgeHeightM,
    boxRiseM: null,
  };
}

export function buildModuleSectionModel(module: CalculatorModuleInputs, moduleResult: CostOutputV1 | null): ModuleSectionModel | null {
  if (moduleResult) {
    const fromDerived = tryBuildSectionFromDerived(module, moduleResult);
    if (fromDerived) return fromDerived;
  }
  return tryBuildSectionFromInputs(module);
}
