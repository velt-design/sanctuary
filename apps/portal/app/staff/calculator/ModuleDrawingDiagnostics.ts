import type { AttachmentSide } from '@sp/costing';
import type { GeometryTopProjectionViewModel, Vector2 } from '@sp/geometry';
import styles from './CalculatorGrid.module.css';
import {
  attachmentSideQuarterTurns,
  buildHouseFootprintLocalLayout,
  type HouseFootprintHandleId,
  type HouseFootprintPoint,
  type ModulePlanModel,
  type ModuleSectionModel,
} from './moduleViews';
import {
  DEFAULT_ESTIMATE_DRAWING_SCALE,
  getEstimateDrawingScaleOptions,
  type EstimateDrawingFixedScaleValue,
  type EstimateDrawingScale,
} from '@/lib/estimates/drawingSheet';
import {
  getDrawingSheetViewportMm,
  getViewBoxUnitsPerMetreAtScale,
  getViewBoxUnitsPerMm,
  type DrawingSheetFitResult,
} from '@/lib/estimates/drawingSheetLayout';
import type {
  GeometryConsistency,
  ModuleDrawingDisplayMode,
  ModuleDrawingPresentation,
  ModuleDrawingScaleDiagnostic,
  ModuleDrawingScaleState,
  ModuleFootprintCanvasPoint,
  ModuleFootprintEditorProps,
  ModuleViewsTab,
} from './ModuleDrawingContracts';
import {
  ArrowHead,
  DebugOutline,
  FocusTarget,
  MODEL_SPACE_CSS_PX_PER_UNIT,
  MODEL_SPACE_UNITS_PER_METRE,
  MODEL_SPACE_VIEWBOX_PADDING,
  TickDimension,
  boundsFromLine,
  boundsFromPoints,
  boundsFromRect,
  boundsToPaddedRect,
  buildSheetDebugMetrics,
  clamp,
  createBounds,
  estimateArrowHeadBounds,
  estimateTextBounds,
  estimateTickDimensionBounds,
  evaluateAnnotatedSheetFit,
  fitsWithinArea,
  formatMetres,
  formatMetresPrecise,
  getBoundsHeight,
  getBoundsWidth,
  getDimensionPresentationSpec,
  getSheetDrawingField,
  insetRect,
  memberSizeM,
  rectToPoints,
  resolveBoundsPlacement,
  resolveMeasuredFitLayout,
  rotateBoundsQuarterTurns,
  rotatePointQuarterTurns,
  rotatePointsQuarterTurns,
  segmentDownNormal,
  toPointsAttr,
  translateBounds,
  unionBounds,
  viewBoxUnitsToMm,
  type AnnotatedBounds,
  type Point,
  type ResolvedModelSpaceLayout,
  type ResolvedSheetLayout,
  type SheetDebugMetrics,
  type SheetDrawingField,
  type SheetFitArea,
  type SheetRect,
  type SvgDebugScaleProps,
} from './ModuleDrawingSurfacePrimitives';
import { hasFullLengthPlanRidge } from './ModuleDrawingChromePresentation';
import { sectionOuterGutterUndersideM } from './ModuleSectionPresentation';
export function summariseConsistency(issues: string[]): GeometryConsistency {
  if (issues.length === 0) {
    return {
      level: 'ok',
      summary: 'Geometry consistency checks passed.',
      details: [],
    };
  }
  return {
    level: 'warn',
    summary: `${issues.length} geometry consistency issue${issues.length === 1 ? '' : 's'} detected.`,
    details: issues,
  };
}


export function checkPlanConsistency(model: ModulePlanModel): GeometryConsistency {
  const issues: string[] = [];
  const tolM = 0.02;
  const spacingTolM = 0.03;

  if (!(model.lengthA > 0)) issues.push('A length must be > 0.');
  if (!(model.spanA > 0)) issues.push('A span must be > 0.');
  if (model.overhangEnabled && model.overhangAmountM >= model.spanA - 1e-6) {
    issues.push(`Overhang ${formatMetres(model.overhangAmountM)} is not less than span ${formatMetres(model.spanA)}.`);
  }

  if (hasFullLengthPlanRidge(model.roofType)) {
    const sideFrameWidthM = memberSizeM(model.supportBeamWidthM, 0.05);
    const ridgeLengthM = model.lengthA - sideFrameWidthM * 2;
    if (ridgeLengthM <= 0) {
      issues.push('Ridge beam does not fit between end frame members.');
    }
  }

  if (model.rafterPositionsA.length !== model.rafterCountA) {
    issues.push(`Rafter count mismatch: positions=${model.rafterPositionsA.length}, count=${model.rafterCountA}.`);
  }
  if (model.rafterPositionsA.length >= 2) {
    const start = model.rafterPositionsA[0] ?? 0;
    const end = model.rafterPositionsA[model.rafterPositionsA.length - 1] ?? 0;
    if (Math.abs(start) > tolM || Math.abs(end - model.rafterEdgeLengthM) > tolM) {
      issues.push('Rafter extents do not align with A length bounds.');
    }

    const spacings = model.rafterPositionsA.slice(1).map((pos, idx) => pos - (model.rafterPositionsA[idx] ?? 0));
    const maxSpacing = Math.max(...spacings);
    if (maxSpacing > model.rafterMaxSpacingM + 1e-6) {
      issues.push(`Rafter spacing exceeds max (${formatMetres(maxSpacing)} > ${formatMetres(model.rafterMaxSpacingM)}).`);
    }
    const maxSpacingDelta = Math.max(...spacings.map((spacing) => Math.abs(spacing - model.rafterSpacingA)));
    if (maxSpacingDelta > spacingTolM) {
      issues.push(`Rafter spacing is non-uniform beyond tolerance (${formatMetres(maxSpacingDelta)}).`);
    }
  }

  if (model.houseConnectionType === 'soffit' && model.soffitBracketPositionsA.length >= 2) {
    const start = model.soffitBracketPositionsA[0] ?? 0;
    const end = model.soffitBracketPositionsA[model.soffitBracketPositionsA.length - 1] ?? 0;
    if (
      Math.abs(start - model.soffitBracketOffsetM) > tolM ||
      Math.abs(end - (model.attachmentEdgeLengthM - model.soffitBracketOffsetM)) > tolM
    ) {
      issues.push('Soffit bracket start/end offsets do not match configured offset.');
    }
    const bracketSpacings = model.soffitBracketPositionsA.slice(1).map((pos, idx) => pos - (model.soffitBracketPositionsA[idx] ?? 0));
    if (bracketSpacings.some((spacing) => spacing > model.soffitBracketMaxSpacingM + 1e-6)) {
      issues.push('Soffit bracket spacing exceeds configured maximum.');
    }
  }

  if (model.roofType === 'hip_corner' && model.lengthB && model.rafterPositionsB) {
    if (model.rafterPositionsB.length !== (model.rafterCountB ?? model.rafterPositionsB.length)) {
      issues.push('Hip corner B rafter count mismatch.');
    }
    if (model.rafterPositionsB.length >= 2) {
      const start = model.rafterPositionsB[0] ?? 0;
      const end = model.rafterPositionsB[model.rafterPositionsB.length - 1] ?? 0;
      if (Math.abs(start) > tolM || Math.abs(end - model.lengthB) > tolM) {
        issues.push('Hip corner B rafter extents do not align with B length.');
      }
    }
  }

  return summariseConsistency(issues);
}


export function checkSectionConsistency(model: ModuleSectionModel): GeometryConsistency {
  const issues: string[] = [];
  const pitchTolDeg = 0.35;
  const heightTolM = 0.03;

  if (!(model.spanA > 0)) issues.push('Span must be > 0.');
  if (model.leftEdgeHeightM < 0 || model.rightEdgeHeightM < 0) issues.push('Post underside heights must be non-negative.');

  const overhangM = model.sectionKind === 'mono' && model.overhangEnabled ? Math.max(0, model.overhangAmountM) : 0;
  if (overhangM > model.spanA + 1e-6) {
    issues.push(`Overhang ${formatMetres(overhangM)} exceeds span ${formatMetres(model.spanA)}.`);
  }

  const supportXFromHouseM = model.sectionKind === 'mono' ? model.spanA - overhangM : model.spanA;
  if (model.sectionKind === 'mono' && overhangM > 0 && supportXFromHouseM <= 0) {
    issues.push('Support position is non-positive after overhang.');
  }

  if (model.sectionKind === 'mono' && model.spanA > 0) {
    const outerGutterUndersideM = sectionOuterGutterUndersideM(model);
    const fallM = outerGutterUndersideM - model.leftEdgeHeightM;
    const impliedPitchDeg = (Math.atan(Math.abs(fallM) / model.spanA) * 180) / Math.PI;
    if (Math.abs(impliedPitchDeg - model.pitchDeg) > pitchTolDeg) {
      issues.push(`Pitch mismatch: model ${model.pitchDeg.toFixed(2)} deg vs implied ${impliedPitchDeg.toFixed(2)} deg.`);
    }

    if (model.slopeDirection === 'away_from_house' && outerGutterUndersideM > model.leftEdgeHeightM + heightTolM) {
      issues.push('Slope direction says away from house, but outer underside is higher than house underside.');
    }
    if (model.slopeDirection === 'toward_house' && outerGutterUndersideM < model.leftEdgeHeightM - heightTolM) {
      issues.push('Slope direction says toward house, but outer underside is lower than house underside.');
    }
  }

  if (model.sectionKind === 'gable' && typeof model.ridgeHeightM === 'number' && Number.isFinite(model.ridgeHeightM)) {
    const eaveHeight = Math.max(model.leftEdgeHeightM, model.rightEdgeHeightM);
    const impliedRiseM = Math.tan((model.pitchDeg * Math.PI) / 180) * (model.spanA / 2);
    const expectedRidgeM = eaveHeight + impliedRiseM;
    if (Math.abs(expectedRidgeM - model.ridgeHeightM) > heightTolM) {
      issues.push(`Ridge height mismatch: model ${formatMetres(model.ridgeHeightM)} vs implied ${formatMetres(expectedRidgeM)}.`);
    }
  }

  return summariseConsistency(issues);
}




