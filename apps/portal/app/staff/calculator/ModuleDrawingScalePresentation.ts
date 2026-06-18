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
import { resolvePlanSheetLayout } from './ModulePlanLayoutPresentation';
import { resolveSectionSheetLayout } from './ModuleSectionPresentation';
function getPlanScaleFit(
  model: ModulePlanModel,
  ratio: EstimateDrawingFixedScaleValue,
  viewportMm?: { widthMm: number; heightMm: number },
): DrawingSheetFitResult {
  const layout = resolvePlanSheetLayout({
    model,
    drawingScale: { mode: 'fixed', ratio },
    viewportMm,
  });
  return evaluateAnnotatedSheetFit({
    bounds: layout.annotatedBounds,
    fitArea: layout.fitArea,
    viewportMm,
  });
}


function getSectionScaleFit(
  model: ModuleSectionModel,
  ratio: EstimateDrawingFixedScaleValue,
  viewportMm?: { widthMm: number; heightMm: number },
): DrawingSheetFitResult {
  const layout = resolveSectionSheetLayout({
    model,
    drawingScale: { mode: 'fixed', ratio },
    viewportMm,
  });
  return evaluateAnnotatedSheetFit({
    bounds: layout.annotatedBounds,
    fitArea: layout.fitArea,
    viewportMm,
  });
}


function toScaleDiagnostic(scale: EstimateDrawingScale, fit: DrawingSheetFitResult | null): ModuleDrawingScaleDiagnostic {
  const availableWidthMm = fit?.availableWidthMm ?? 0;
  const availableHeightMm = fit?.availableHeightMm ?? 0;
  const requiredWidthMm = fit?.requiredWidthMm ?? 0;
  const requiredHeightMm = fit?.requiredHeightMm ?? 0;
  return {
    scale,
    fits: fit?.fits ?? scale.mode === 'fit',
    requiredWidthMm,
    requiredHeightMm,
    availableWidthMm,
    availableHeightMm,
    utilizationX: availableWidthMm > 0 ? requiredWidthMm / availableWidthMm : 0,
    utilizationY: availableHeightMm > 0 ? requiredHeightMm / availableHeightMm : 0,
  };
}


export function getModuleDrawingScaleDiagnostics(input: {
  view: ModuleViewsTab;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  viewportMm?: { widthMm: number; heightMm: number };
}): ModuleDrawingScaleDiagnostic[] {
  const viewportMm = input.viewportMm ?? getDrawingSheetViewportMm();
  return getEstimateDrawingScaleOptions(input.view)
    .filter((scale): scale is Extract<EstimateDrawingScale, { mode: 'fixed' }> => scale.mode === 'fixed')
    .map((scale) => {
      const fit =
        input.view === 'plan'
          ? input.planModel
            ? getPlanScaleFit(input.planModel, scale.ratio, viewportMm)
            : null
          : input.sectionModel
            ? getSectionScaleFit(input.sectionModel, scale.ratio, viewportMm)
            : null;
      return toScaleDiagnostic(scale, fit);
    });
}


export function getSuggestedModuleDrawingScale(input: {
  view: ModuleViewsTab;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  viewportMm?: { widthMm: number; heightMm: number };
}): EstimateDrawingScale {
  const viewportMm = input.viewportMm ?? getDrawingSheetViewportMm();

  for (const option of getEstimateDrawingScaleOptions(input.view)) {
    if (option.mode !== 'fixed') continue;
    const fit =
      input.view === 'plan'
        ? input.planModel
          ? getPlanScaleFit(input.planModel, option.ratio, viewportMm)
          : null
        : input.sectionModel
          ? getSectionScaleFit(input.sectionModel, option.ratio, viewportMm)
          : null;

    if (fit?.fits) return option;
  }

  return DEFAULT_ESTIMATE_DRAWING_SCALE;
}


export function resolveModuleDrawingScaleState(input: {
  view: ModuleViewsTab;
  requestedScale?: EstimateDrawingScale;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  viewportMm?: { widthMm: number; heightMm: number };
}): ModuleDrawingScaleState {
  const requestedScale = input.requestedScale ?? DEFAULT_ESTIMATE_DRAWING_SCALE;
  const viewportMm = input.viewportMm ?? getDrawingSheetViewportMm();
  const suggestedScale = getSuggestedModuleDrawingScale({
    view: input.view,
    planModel: input.planModel,
    sectionModel: input.sectionModel,
    viewportMm,
  });

  if (requestedScale.mode !== 'fixed') {
    return {
      requestedScale,
      appliedScale: requestedScale,
      fit: null,
      fits: true,
      suggestedScale,
    };
  }

  const fit =
    input.view === 'plan'
      ? input.planModel
        ? getPlanScaleFit(input.planModel, requestedScale.ratio, viewportMm)
        : null
      : input.sectionModel
        ? getSectionScaleFit(input.sectionModel, requestedScale.ratio, viewportMm)
        : null;

  return {
    requestedScale,
    appliedScale: fit?.fits ? requestedScale : DEFAULT_ESTIMATE_DRAWING_SCALE,
    fit,
    fits: fit?.fits ?? false,
    suggestedScale,
  };
}




