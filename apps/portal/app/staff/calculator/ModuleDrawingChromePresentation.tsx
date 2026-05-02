import type { AttachmentSide } from '@sp/costing';
import type { GeometryTopProjectionViewModel, Vector2 } from '@sp/geometry';
import styles from './CalculatorGrid.module.css';
import {
  attachmentSideQuarterTurns,
  buildHouseFootprintLocalLayout,
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

export { formatMetres } from './ModuleDrawingSurfacePrimitives';
export function roofTypeLabel(roofType: ModulePlanModel['roofType']): string {
  if (roofType === 'hip_corner') return 'Hip corner';
  if (roofType === 'low_gable') return 'Low gable';
  if (roofType === 'gable') return 'Gable';
  if (roofType === 'hip') return 'Hip';
  return 'Pitched';
}


export function hasFullLengthPlanRidge(roofType: ModulePlanModel['roofType']): boolean {
  return roofType === 'gable' || roofType === 'low_gable';
}


export function LegendRow({ items }: { items: string[] }) {
  return (
    <div className={styles.moduleViewsLegend} aria-label="Drawing legend">
      {items.map((item) => (
        <span key={item} className={styles.moduleViewsLegendChip}>
          <span className={styles.moduleViewsLegendSwatch} aria-hidden="true" />
          {item}
        </span>
      ))}
    </div>
  );
}


