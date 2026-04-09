import type { RoofType } from '@sp/costing';
import type { GeometryPlanMember2D, GeometryPlanViewModel } from '@sp/geometry';
import type { ModulePlanModel } from '@/app/staff/calculator/moduleViews';
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
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';

const DEFAULT_RAFTER_MAX_SPACING_M = 0.642;

function lineLengthM(line: { start: { x: number; y: number }; end: { x: number; y: number } } | null): number {
  if (!line) return 0;
  return Number((Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y) / 1000).toFixed(6));
}

function midpointXMetres(member: GeometryPlanMember2D): number {
  return ((member.centerline.start.x + member.centerline.end.x) / 2) / 1000;
}

function uniqueSortedPositionsMetres(members: GeometryPlanMember2D[]): number[] {
  return members
    .map(midpointXMetres)
    .sort((a, b) => a - b)
    .filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]!) > 0.0005)
    .map((value) => Number(value.toFixed(6)));
}

function averageSpacingMetres(positions: number[]): number {
  if (positions.length <= 1) return 0;
  const spacings = positions.slice(1).map((value, index) => value - positions[index]!);
  return Number((spacings.reduce((sum, value) => sum + value, 0) / spacings.length).toFixed(6));
}

function profileDimsMetres(
  members: GeometryPlanMember2D[],
  fallbackWidthM: number,
  fallbackDepthM: number,
): Pick<ModulePlanModel, 'rafterWidthM' | 'rafterDepthM'> {
  const member = members[0];
  if (!member) {
    return {
      rafterWidthM: fallbackWidthM,
      rafterDepthM: fallbackDepthM,
    };
  }

  return {
    rafterWidthM: Number((member.profile.widthMm / 1000).toFixed(6)),
    rafterDepthM: Number((member.profile.depthMm / 1000).toFixed(6)),
  };
}

function roofTypeFromGeometry(geometryPlan: GeometryPlanViewModel): RoofType {
  if (geometryPlan.family === 'gable') return 'gable';
  return 'pitched';
}

function slopeDirectionFromGeometry(geometryPlan: GeometryPlanViewModel): ModulePlanModel['slopeDirection'] {
  if (geometryPlan.family === 'gable') {
    return 'away_from_house';
  }

  return (geometryPlan.anchors.fall?.direction.y ?? 0) < 0 ? 'toward_house' : 'away_from_house';
}

export function buildLegacyModulePlanModelFromGeometry(input: {
  geometryPlan: GeometryPlanViewModel;
  module: CalculatorModuleInputs;
  fallbackMetadata?: ModulePlanModel | null;
}): ModulePlanModel {
  const { geometryPlan, module, fallbackMetadata = null } = input;
  const supportsFootprintPresets = supportsHouseFootprints(module.pergolaStyle);
  const attachmentSide =
    module.houseConnectionType === 'none'
      ? DEFAULT_CALCULATOR_ATTACHMENT_SIDE
      : supportsFootprintPresets
        ? normalizeAttachmentSide(module.attachmentSide)
        : DEFAULT_CALCULATOR_ATTACHMENT_SIDE;
  const drawingRotationQuarterTurns = supportsFootprintPresets
    ? normalizeDrawingRotationQuarterTurns(module.drawingRotationQuarterTurns)
    : DEFAULT_CALCULATOR_DRAWING_ROTATION_QUARTER_TURNS;
  const houseFootprintPreset = supportsFootprintPresets
    ? normalizeHouseFootprintPreset(module.houseFootprintPreset)
    : DEFAULT_CALCULATOR_HOUSE_FOOTPRINT_PRESET;
  const houseFootprintParams = supportsFootprintPresets
    ? normalizeHouseFootprintParams(module.houseFootprintParams)
    : makeDefaultHouseFootprintParams();
  const rafterPositionsA = uniqueSortedPositionsMetres(geometryPlan.members.rafters);
  const attachmentEdgeLengthM = Number(
    (
      lineLengthM(geometryPlan.attachmentEdge) ||
      geometryPlan.extents.lengthMm / 1000
    ).toFixed(6),
  );
  const rafterDims = profileDimsMetres(
    geometryPlan.members.rafters,
    fallbackMetadata?.rafterWidthM ?? 0.05,
    fallbackMetadata?.rafterDepthM ?? 0.15,
  );
  const ledgerDims = profileDimsMetres(
    geometryPlan.members.ledgers,
    fallbackMetadata?.ledgerBeamWidthM ?? 0.05,
    fallbackMetadata?.ledgerBeamDepthM ?? 0.1,
  );
  const supportBeamDims = profileDimsMetres(
    geometryPlan.members.beams.filter((member) => member.role === 'beam'),
    fallbackMetadata?.supportBeamWidthM ?? 0.05,
    fallbackMetadata?.supportBeamDepthM ?? 0.15,
  );
  const gutterDims = profileDimsMetres(
    geometryPlan.members.gutters,
    fallbackMetadata?.gutterWidthM ?? 0.1,
    fallbackMetadata?.gutterDepthM ?? 0.15,
  );
  const ridgeDims = profileDimsMetres(
    geometryPlan.members.ridge,
    fallbackMetadata?.ridgeBeamWidthM ?? 0.05,
    fallbackMetadata?.ridgeBeamDepthM ?? 0.15,
  );

  return {
    dataSource: fallbackMetadata?.dataSource ?? 'derived',
    pergolaStyle: module.pergolaStyle,
    roofType: roofTypeFromGeometry(geometryPlan),
    boxPerimeterEnabled: geometryPlan.roofForm.box,
    houseConnectionType: module.houseConnectionType,
    attachmentSide,
    drawingRotationQuarterTurns,
    houseFootprintPreset,
    houseFootprintParams,
    supportsHouseFootprints: supportsFootprintPresets,
    overhangEnabled: Boolean(module.overhangEnabled),
    overhangAmountM: module.overhangEnabled ? Number.parseFloat(String(module.overhangAmountM ?? '0')) || 0 : 0,
    slopeDirection: slopeDirectionFromGeometry(geometryPlan),
    lengthA: Number((geometryPlan.extents.lengthMm / 1000).toFixed(6)),
    spanA: Number((geometryPlan.extents.projectionMm / 1000).toFixed(6)),
    lengthB: null,
    spanB: null,
    rafterWidthM: rafterDims.rafterWidthM,
    rafterDepthM: rafterDims.rafterDepthM,
    ledgerBeamWidthM: ledgerDims.rafterWidthM,
    ledgerBeamDepthM: ledgerDims.rafterDepthM,
    supportBeamWidthM: supportBeamDims.rafterWidthM,
    supportBeamDepthM: supportBeamDims.rafterDepthM,
    gutterWidthM: gutterDims.rafterWidthM,
    gutterDepthM: gutterDims.rafterDepthM,
    ridgeBeamWidthM: ridgeDims.rafterWidthM,
    ridgeBeamDepthM: ridgeDims.rafterDepthM,
    rafterMaxSpacingM: fallbackMetadata?.rafterMaxSpacingM ?? DEFAULT_RAFTER_MAX_SPACING_M,
    rafterCountA: rafterPositionsA.length,
    rafterSpacingA: averageSpacingMetres(rafterPositionsA),
    rafterPositionsA,
    rafterEdgeLengthM: Number((geometryPlan.extents.lengthMm / 1000).toFixed(6)),
    rafterCountB: null,
    rafterSpacingB: null,
    rafterPositionsB: null,
    attachmentEdgeLengthM,
    soffitBracketOffsetM: fallbackMetadata?.soffitBracketOffsetM ?? 0.5,
    soffitBracketMaxSpacingM: fallbackMetadata?.soffitBracketMaxSpacingM ?? 1.5,
    soffitBracketPositionsA: fallbackMetadata?.soffitBracketPositionsA ?? [],
  };
}
