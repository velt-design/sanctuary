import type { RoofType } from '@sp/costing';
import type { GeometrySectionMember2D, GeometrySectionViewModel } from '@sp/geometry';
import type { ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import {
  DEFAULT_CALCULATOR_ATTACHMENT_SIDE,
  normalizeAttachmentSide,
  supportsHouseFootprints,
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';

function roofTypeFromGeometry(geometrySection: GeometrySectionViewModel): RoofType {
  if (geometrySection.family === 'gable') return 'gable';
  return 'pitched';
}

function attachmentSideFromModule(module: CalculatorModuleInputs): ModuleSectionModel['attachmentSide'] {
  if (module.houseConnectionType === 'none') return DEFAULT_CALCULATOR_ATTACHMENT_SIDE;
  if (!supportsHouseFootprints(module.pergolaStyle)) return DEFAULT_CALCULATOR_ATTACHMENT_SIDE;
  return normalizeAttachmentSide(module.attachmentSide);
}

function profileDimsMetres(
  members: GeometrySectionMember2D[],
  fallbackWidthM: number,
  fallbackDepthM: number,
): { widthM: number; depthM: number } {
  const member = members[0];
  if (!member) {
    return { widthM: fallbackWidthM, depthM: fallbackDepthM };
  }
  return {
    widthM: Number((member.profile.widthMm / 1000).toFixed(6)),
    depthM: Number((member.profile.depthMm / 1000).toFixed(6)),
  };
}

function slopeDirectionFromGeometry(geometrySection: GeometrySectionViewModel): ModuleSectionModel['slopeDirection'] {
  if (geometrySection.family === 'gable') {
    return 'away_from_house';
  }
  return geometrySection.anchors.pitch?.fallDirection === 'negativeY' ? 'toward_house' : 'away_from_house';
}

export function buildLegacyModuleSectionModelFromGeometry(input: {
  geometrySection: GeometrySectionViewModel;
  module: CalculatorModuleInputs;
  fallbackMetadata?: ModuleSectionModel | null;
}): ModuleSectionModel {
  const { geometrySection, module, fallbackMetadata = null } = input;
  const postDims = profileDimsMetres(
    geometrySection.members.posts,
    fallbackMetadata?.postWidthM ?? 0.1,
    fallbackMetadata?.postDepthM ?? 0.1,
  );
  const rafterDims = profileDimsMetres(
    geometrySection.members.rafters,
    fallbackMetadata?.rafterWidthM ?? 0.05,
    fallbackMetadata?.rafterDepthM ?? 0.15,
  );
  const ledgerDims = profileDimsMetres(
    geometrySection.members.ledgers,
    fallbackMetadata?.ledgerBeamWidthM ?? 0.05,
    fallbackMetadata?.ledgerBeamDepthM ?? 0.1,
  );
  const supportBeamDims = profileDimsMetres(
    geometrySection.members.supportBeams,
    fallbackMetadata?.supportBeamWidthM ?? 0.05,
    fallbackMetadata?.supportBeamDepthM ?? 0.15,
  );
  const gutterDims = profileDimsMetres(
    geometrySection.members.gutters,
    fallbackMetadata?.gutterWidthM ?? 0.1,
    fallbackMetadata?.gutterDepthM ?? 0.15,
  );
  const ridgeDims = profileDimsMetres(
    geometrySection.members.ridge,
    fallbackMetadata?.ridgeBeamWidthM ?? 0.05,
    fallbackMetadata?.ridgeBeamDepthM ?? 0.15,
  );

  return {
    dataSource: fallbackMetadata?.dataSource ?? 'derived',
    pergolaStyle: module.pergolaStyle,
    roofType: roofTypeFromGeometry(geometrySection),
    boxPerimeterEnabled: geometrySection.roofForm.box,
    houseConnectionType: module.houseConnectionType,
    attachmentSide: attachmentSideFromModule(module),
    sectionSpanField: fallbackMetadata?.sectionSpanField ?? 'projectionM',
    overhangEnabled: Boolean(module.overhangEnabled),
    overhangAmountM: module.overhangEnabled ? Number.parseFloat(String(module.overhangAmountM ?? '0')) || 0 : 0,
    slopeDirection: slopeDirectionFromGeometry(geometrySection),
    sectionKind: geometrySection.sectionKind,
    spanA: Number((geometrySection.metrics.spanMm / 1000).toFixed(6)),
    spanB: null,
    pitchDeg: Number((geometrySection.metrics.pitchDeg ?? 0).toFixed(1)),
    postWidthM: postDims.widthM,
    postDepthM: postDims.depthM,
    rafterWidthM: rafterDims.widthM,
    rafterDepthM: rafterDims.depthM,
    ledgerBeamWidthM: ledgerDims.widthM,
    ledgerBeamDepthM: ledgerDims.depthM,
    supportBeamWidthM: supportBeamDims.widthM,
    supportBeamDepthM: supportBeamDims.depthM,
    gutterWidthM: gutterDims.widthM,
    gutterDepthM: gutterDims.depthM,
    ridgeBeamWidthM: ridgeDims.widthM,
    ridgeBeamDepthM: ridgeDims.depthM,
    leftEdgeHeightM: Number(((geometrySection.metrics.leftEdgeHeightMm ?? 0) / 1000).toFixed(6)),
    rightEdgeHeightM: Number(((geometrySection.metrics.rightEdgeHeightMm ?? 0) / 1000).toFixed(6)),
    ridgeHeightM:
      geometrySection.metrics.ridgeHeightMm === null ? null : Number((geometrySection.metrics.ridgeHeightMm / 1000).toFixed(6)),
    boxRiseM: geometrySection.metrics.boxRiseMm === null ? null : Number((geometrySection.metrics.boxRiseMm / 1000).toFixed(6)),
  };
}
