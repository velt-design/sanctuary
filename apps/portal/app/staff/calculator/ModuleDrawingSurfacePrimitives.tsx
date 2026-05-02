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
  ModuleDrawingInteractiveField,
  ModuleDrawingPresentation,
  ModuleDrawingScaleDiagnostic,
  ModuleDrawingScaleState,
  ModuleFootprintCanvasPoint,
  ModuleFootprintEditorProps,
  ModuleViewsTab,
} from './ModuleDrawingContracts';
export type Point = { x: number; y: number };

export type TickDimensionProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  textX?: number;
  textY?: number;
  rotateDeg?: number;
  overrun?: number;
  showTermBars?: boolean;
  presentation?: ModuleDrawingPresentation;
  interactiveField?: ModuleDrawingInteractiveField;
  lineClassName?: string;
  tickClassName?: string;
  textClassName?: string;
};

export type DimensionPresentationSpec = {
  tickHalf: number;
  barHalf: number;
  barOffset: number;
  labelClearance: number;
  horizontalLabelGap: number;
  verticalLabelGap: number;
};

export type TickDimensionGeometry = {
  lineStartX: number;
  lineStartY: number;
  lineEndX: number;
  lineEndY: number;
  tick1StartX: number;
  tick1StartY: number;
  tick1EndX: number;
  tick1EndY: number;
  tick2StartX: number;
  tick2StartY: number;
  tick2EndX: number;
  tick2EndY: number;
  labelX: number;
  labelY: number;
  labelRotate?: number;
  termBar1?: { x1: number; y1: number; x2: number; y2: number };
  termBar2?: { x1: number; y1: number; x2: number; y2: number };
};

export type SvgDebugScaleProps = {
  scaleState?: ModuleDrawingScaleState | null;
  scaleDiagnostics?: ModuleDrawingScaleDiagnostic[];
};

export function formatMetres(value: number): string {
  return `${value.toFixed(2)}m`;
}

export function formatMetresPrecise(value: number, decimals = 3): string {
  return `${value.toFixed(decimals)}m`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getDimensionPresentationSpec(presentation: ModuleDrawingPresentation): DimensionPresentationSpec {
  if (presentation === 'sheet') {
    return {
      tickHalf: 0.74,
      barHalf: 0.52,
      barOffset: 0.42,
      labelClearance: 2.05,
      horizontalLabelGap: 2.15,
      verticalLabelGap: 3.05,
    };
  }

  return {
    tickHalf: 0.96,
    barHalf: 0.68,
    barOffset: 0.52,
    labelClearance: 1.82,
    horizontalLabelGap: 2.05,
    verticalLabelGap: 2.78,
  };
}

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

export function memberSizeM(value: number | null | undefined, fallbackM: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallbackM;
}

export const MODEL_SPACE_UNITS_PER_METRE = 12;
export const MODEL_SPACE_CSS_PX_PER_UNIT = 8;
export const MODEL_SPACE_VIEWBOX_PADDING = 6;

export type PlanFitBox = {
  x: number;
  y: number;
  scale: number;
  houseBandHeight: number;
  houseBandOffset: number;
  houseInset: number;
  fallGap: number;
};

export type SheetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SheetDrawingField = SheetRect;
export type SheetFitArea = SheetRect;
export type AnnotatedBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type BoundsInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type LayoutOffset = {
  dx: number;
  dy: number;
};

export type DebugOutlineProps = {
  rect: SheetRect;
  className: string;
  marker: string;
};

export type ResolvedModelSpaceLayout = ResolvedSheetLayout & {
  viewBox: SheetRect;
  viewBoxValue: string;
  worldBounds: AnnotatedBounds;
  worldBox: SheetRect;
  worldBoxValue: string;
  focusBounds: AnnotatedBounds;
  focusBox: SheetRect;
  focusBoxValue: string;
  svgWidthPx: number;
  svgHeightPx: number;
};

export function getSheetDrawingField(): SheetDrawingField {
  // Keep the outer field flush to the top/left/right edges, but reserve the
  // lower title-block band so the sheet field stops at the top of the block.
  // The footer metadata has been compacted into the right rail, so the sheet
  // can reclaim a little more vertical drawing area than before.
  return {
    x: 0,
    y: 0,
    width: 120,
    height: 86.0,
  };
}

export function DebugOutline({ rect, className, marker }: DebugOutlineProps) {
  const inset = 0.16;
  const rawX1 = rect.x;
  const rawY1 = rect.y;
  const rawX2 = rect.x + rect.width;
  const rawY2 = rect.y + rect.height;
  const x1 = rawX1 <= 0 ? rawX1 + inset : rawX1;
  const y1 = rawY1 <= 0 ? rawY1 + inset : rawY1;
  const x2 = rawX2 >= 120 ? rawX2 - inset : rawX2;
  const y2 = rawY2 >= 90 ? rawY2 - inset : rawY2;

  return (
    <g data-debug-crop={marker} aria-hidden="true">
      <line x1={x1} y1={y1} x2={x2} y2={y1} className={className} />
      <line x1={x1} y1={y1} x2={x1} y2={y2} className={className} />
      <line x1={x2} y1={y1} x2={x2} y2={y2} className={className} />
      <line x1={x1} y1={y2} x2={x2} y2={y2} className={className} />
    </g>
  );
}

export function insetRect(rect: SheetRect, insets: BoundsInsets): SheetRect {
  return {
    x: rect.x + insets.left,
    y: rect.y + insets.top,
    width: Math.max(0.1, rect.width - insets.left - insets.right),
    height: Math.max(0.1, rect.height - insets.top - insets.bottom),
  };
}

export function createBounds(minX: number, minY: number, maxX: number, maxY: number): AnnotatedBounds {
  return { minX, minY, maxX, maxY };
}

export function boundsFromRect(x: number, y: number, width: number, height: number): AnnotatedBounds {
  return createBounds(
    Math.min(x, x + width),
    Math.min(y, y + height),
    Math.max(x, x + width),
    Math.max(y, y + height),
  );
}

export function boundsFromLine(x1: number, y1: number, x2: number, y2: number, pad = 0): AnnotatedBounds {
  return createBounds(Math.min(x1, x2) - pad, Math.min(y1, y2) - pad, Math.max(x1, x2) + pad, Math.max(y1, y2) + pad);
}

export function boundsFromPoints(points: Point[], pad = 0): AnnotatedBounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return createBounds(Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad);
}

export function unionBounds(bounds: Array<AnnotatedBounds | null | undefined>): AnnotatedBounds {
  const valid = bounds.filter((entry): entry is AnnotatedBounds => Boolean(entry));
  if (valid.length === 0) return createBounds(0, 0, 0, 0);

  return createBounds(
    Math.min(...valid.map((entry) => entry.minX)),
    Math.min(...valid.map((entry) => entry.minY)),
    Math.max(...valid.map((entry) => entry.maxX)),
    Math.max(...valid.map((entry) => entry.maxY)),
  );
}

export function translateBounds(bounds: AnnotatedBounds, dx: number, dy: number): AnnotatedBounds {
  return createBounds(bounds.minX + dx, bounds.minY + dy, bounds.maxX + dx, bounds.maxY + dy);
}

export function getBoundsWidth(bounds: AnnotatedBounds): number {
  return Math.max(0, bounds.maxX - bounds.minX);
}

export function getBoundsHeight(bounds: AnnotatedBounds): number {
  return Math.max(0, bounds.maxY - bounds.minY);
}

export function boundsToPaddedRect(bounds: AnnotatedBounds, padding: number): SheetRect {
  const width = Math.max(1, getBoundsWidth(bounds) + padding * 2);
  const height = Math.max(1, getBoundsHeight(bounds) + padding * 2);
  return {
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width,
    height,
  };
}

export function formatViewBoxNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(3).replace(/\.?0+$/, '');
}

export function rectToViewBox(rect: SheetRect): string {
  return [rect.x, rect.y, rect.width, rect.height].map(formatViewBoxNumber).join(' ');
}

export function resolveModelSpaceSvgMetrics(bounds: AnnotatedBounds): Pick<ResolvedModelSpaceLayout, 'viewBox' | 'viewBoxValue' | 'svgWidthPx' | 'svgHeightPx'> {
  const viewBox = boundsToPaddedRect(bounds, MODEL_SPACE_VIEWBOX_PADDING);
  return {
    viewBox,
    viewBoxValue: rectToViewBox(viewBox),
    svgWidthPx: Math.round(viewBox.width * MODEL_SPACE_CSS_PX_PER_UNIT),
    svgHeightPx: Math.round(viewBox.height * MODEL_SPACE_CSS_PX_PER_UNIT),
  };
}

export function resolveModelSpaceFocusMetrics(bounds: AnnotatedBounds): Pick<ResolvedModelSpaceLayout, 'focusBounds' | 'focusBox' | 'focusBoxValue'> {
  const focusBox = boundsToPaddedRect(bounds, MODEL_SPACE_VIEWBOX_PADDING);
  return {
    focusBounds: bounds,
    focusBox,
    focusBoxValue: rectToViewBox(focusBox),
  };
}

export function resolveModelSpaceWorldMetrics(bounds: AnnotatedBounds): Pick<ResolvedModelSpaceLayout, 'worldBounds' | 'worldBox' | 'worldBoxValue'> {
  const worldBox = boundsToPaddedRect(bounds, MODEL_SPACE_VIEWBOX_PADDING);
  return {
    worldBounds: bounds,
    worldBox,
    worldBoxValue: rectToViewBox(worldBox),
  };
}

export function FocusTarget({ rect }: { rect: SheetRect }) {
  return (
    <rect
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      fill="transparent"
      opacity={0}
      pointerEvents="none"
      aria-hidden="true"
      data-model-space-focus-target="true"
    />
  );
}

export function topProjectionExtentsToModelSpaceBounds(
  topProjection: GeometryTopProjectionViewModel | null | undefined,
  scale: number,
): AnnotatedBounds | null {
  const extents = topProjection?.extents;
  if (!extents || extents.widthMm <= 0 || extents.heightMm <= 0) return null;
  return createBounds(
    (extents.minX / 1000) * scale,
    (extents.minY / 1000) * scale,
    (extents.maxX / 1000) * scale,
    (extents.maxY / 1000) * scale,
  );
}

export function resolveBoundsPlacement(bounds: AnnotatedBounds, fitArea: SheetFitArea, verticalBias: number): LayoutOffset {
  const slackX = Math.max(0, fitArea.width - getBoundsWidth(bounds));
  const slackY = Math.max(0, fitArea.height - getBoundsHeight(bounds));
  return {
    dx: fitArea.x - bounds.minX + slackX / 2,
    dy: fitArea.y - bounds.minY + slackY * verticalBias,
  };
}

export function fitsWithinArea(bounds: AnnotatedBounds, fitArea: SheetFitArea): boolean {
  return getBoundsWidth(bounds) <= fitArea.width + 1e-6 && getBoundsHeight(bounds) <= fitArea.height + 1e-6;
}

export function estimateTextBounds(input: {
  text: string;
  x: number;
  y: number;
  anchor?: 'start' | 'middle' | 'end';
  fontHeight: number;
  charWidth: number;
  paddingX?: number;
  paddingY?: number;
  rotateDeg?: number;
}): AnnotatedBounds {
  const width = Math.max(input.fontHeight * 0.9, input.text.length * input.charWidth + (input.paddingX ?? 0) * 2);
  const height = input.fontHeight + (input.paddingY ?? 0) * 2;
  const anchor = input.anchor ?? 'middle';
  const baseX = anchor === 'middle' ? input.x - width / 2 : anchor === 'end' ? input.x - width : input.x;
  const baseY = input.y - height / 2;
  const rect = boundsFromRect(baseX, baseY, width, height);

  if ((input.rotateDeg ?? 0) % 180 === 0) return rect;

  const corners: Point[] = [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ];
  const rad = ((input.rotateDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return boundsFromPoints(
    corners.map((corner) => ({
      x: input.x + (corner.x - input.x) * cos - (corner.y - input.y) * sin,
      y: input.y + (corner.x - input.x) * sin + (corner.y - input.y) * cos,
    })),
  );
}

export function evaluateAnnotatedSheetFit(input: {
  bounds: AnnotatedBounds;
  fitArea: SheetFitArea;
  viewportMm?: { widthMm: number; heightMm: number };
}): DrawingSheetFitResult {
  return {
    fits: fitsWithinArea(input.bounds, input.fitArea),
    requiredWidthMm: viewBoxUnitsToMm(getBoundsWidth(input.bounds), input.viewportMm),
    requiredHeightMm: viewBoxUnitsToMm(getBoundsHeight(input.bounds), input.viewportMm),
    availableWidthMm: viewBoxUnitsToMm(input.fitArea.width, input.viewportMm),
    availableHeightMm: viewBoxUnitsToMm(input.fitArea.height, input.viewportMm),
  };
}

export type PlanSheetFrame = {
  outerField: SheetDrawingField;
  fitArea: SheetFitArea;
  annotationPadLeft: number;
  annotationPadRight: number;
  annotationPadTop: number;
  annotationPadBottom: number;
  houseBandHeight: number;
  houseBandOffset: number;
  houseInset: number;
  fallGap: number;
  verticalBias: number;
};

export function getPlanSheetFrame(isHipCorner: boolean): PlanSheetFrame {
  const outerField = getSheetDrawingField();
  const annotationPadLeft = 0;
  const annotationPadRight = 0;
  const annotationPadTop = 0;
  const annotationPadBottom = 0;
  return {
    outerField,
    fitArea: outerField,
    annotationPadLeft,
    annotationPadRight,
    annotationPadTop,
    annotationPadBottom,
    houseBandHeight: 5.3,
    houseBandOffset: 1.15,
    houseInset: 1.7,
    fallGap: 5.0,
    verticalBias: 0.5,
  };
}

export function resolvePlanFitBox(totalW: number, totalH: number, presentation: ModuleDrawingPresentation, isHipCorner: boolean): PlanFitBox {
  const safeW = Math.max(totalW, 0.1);
  const safeH = Math.max(totalH, 0.1);
  if (presentation === 'sheet') {
    const frame = getPlanSheetFrame(isHipCorner);
    const maxW = frame.fitArea.width;
    const maxH = frame.fitArea.height;
    const scale = Math.min(maxW / safeW, maxH / safeH);
    const widthPx = safeW * scale;
    const heightPx = safeH * scale;
    const slackY = Math.max(0, maxH - heightPx);
    return {
      x: frame.fitArea.x + (maxW - widthPx) / 2,
      y: frame.fitArea.y + slackY * frame.verticalBias,
      scale,
      houseBandHeight: frame.houseBandHeight,
      houseBandOffset: frame.houseBandOffset,
      houseInset: frame.houseInset,
      fallGap: frame.fallGap,
    };
  }

  if (presentation === 'model') {
    const maxW = 92;
    const maxH = 64;
    const scale = Math.min(maxW / safeW, maxH / safeH);
    const widthPx = safeW * scale;
    const heightPx = safeH * scale;
    return {
      x: 14 + (maxW - widthPx) / 2,
      y: 11 + (maxH - heightPx) / 2,
      scale,
      houseBandHeight: 10,
      houseBandOffset: 2.1,
      houseInset: 2.4,
      fallGap: 7,
    };
  }

  const maxW = 74;
  const maxH = 42;
  const scale = Math.min(maxW / safeW, maxH / safeH);
  const widthPx = safeW * scale;
  const heightPx = safeH * scale;
  return {
    x: 23 + (maxW - widthPx) / 2,
    y: 20 + (maxH - heightPx) / 2,
    scale,
    houseBandHeight: 8,
    houseBandOffset: 2,
    houseInset: 2,
    fallGap: 8,
  };
}

export function resolvePlanFixedScaleBox(
  totalW: number,
  totalH: number,
  isHipCorner: boolean,
  ratio: EstimateDrawingFixedScaleValue,
  viewportMm?: { widthMm: number; heightMm: number },
): PlanFitBox {
  const frame = getPlanSheetFrame(isHipCorner);
  const safeW = Math.max(totalW, 0.1);
  const safeH = Math.max(totalH, 0.1);
  const maxW = frame.fitArea.width;
  const maxH = frame.fitArea.height;
  const scale = getViewBoxUnitsPerMetreAtScale(ratio, viewportMm);
  const widthPx = safeW * scale;
  const heightPx = safeH * scale;
  const slackY = Math.max(0, maxH - heightPx);

  return {
    x: frame.fitArea.x + (maxW - widthPx) / 2,
    y: frame.fitArea.y + slackY * frame.verticalBias,
    scale,
    houseBandHeight: frame.houseBandHeight,
    houseBandOffset: frame.houseBandOffset,
    houseInset: frame.houseInset,
    fallGap: frame.fallGap,
  };
}

export type SectionFitFrame = {
  outerField: SheetDrawingField;
  fitArea: SheetFitArea;
  verticalBias: number;
  annotationPadLeft: number;
  annotationPadRight: number;
  annotationPadTop: number;
  annotationPadBottom: number;
};

export function getSectionSheetFrame(sectionKind: ModuleSectionModel['sectionKind']): SectionFitFrame {
  const outerField = getSheetDrawingField();
  return {
    outerField,
    fitArea: outerField,
    verticalBias: 0.5,
    annotationPadLeft: 0,
    annotationPadRight: 0,
    annotationPadTop: 0,
    annotationPadBottom: 0,
  };
}

export function resolveSectionFitFrame(presentation: ModuleDrawingPresentation, sectionKind: ModuleSectionModel['sectionKind']): SectionFitFrame {
  if (presentation === 'sheet') {
    return getSectionSheetFrame(sectionKind);
  }

  if (presentation === 'model') {
    return {
      outerField: { x: 8, y: 8, width: 104, height: 74 },
      fitArea: { x: 12, y: 10, width: 96, height: 68 },
      verticalBias: 0.5,
      annotationPadLeft: 0,
      annotationPadRight: 0,
      annotationPadTop: 0,
      annotationPadBottom: 0,
    };
  }

  return {
    outerField: { x: 18, y: 16, width: 84, height: 56 },
    fitArea: { x: 27, y: 22, width: 66, height: 40 },
    verticalBias: 0.3,
    annotationPadLeft: 9,
    annotationPadRight: 9,
    annotationPadTop: 6,
    annotationPadBottom: 10,
  };
}

export function viewBoxUnitsToMm(value: number, viewportMm?: { widthMm: number; heightMm: number }): number {
  return value / getViewBoxUnitsPerMm(viewportMm);
}

export function getPlanRealExtents(model: ModulePlanModel): { widthM: number; heightM: number } {
  const housePoints = [
    ...(model.houseContext?.surfaces ?? []).flatMap((surface) => surface.boundary),
    ...(model.houseContext?.lines ?? []).flatMap((line) => [line.line.start, line.line.end]),
  ];
  const xValues = [0, model.roofType === 'hip_corner' ? Math.max(model.lengthA, model.lengthB ?? 0) : model.lengthA, ...housePoints.map((point) => point.x)];
  const yValues = [0, model.roofType === 'hip_corner' ? model.spanA + (model.spanB ?? 0) : model.spanA, ...housePoints.map((point) => point.y)];
  const widthM = Math.max(...xValues) - Math.min(...xValues);
  const heightM = Math.max(...yValues) - Math.min(...yValues);
  if (model.roofType === 'hip_corner' || model.drawingRotationQuarterTurns % 2 === 0) {
    return { widthM, heightM };
  }
  return { widthM: heightM, heightM: widthM };
}

export function getSectionRealExtents(model: ModuleSectionModel): { widthM: number; heightM: number } {
  const housePoints = [
    ...(model.houseContext?.surfaces ?? []).flatMap((surface) => surface.boundary),
    ...(model.houseContext?.lines ?? []).flatMap((line) => [line.line.start, line.line.end]),
  ];
  const houseProjectionValues = housePoints.map((point) => point.x);
  const houseHeightValues = housePoints.map((point) => point.y);
  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const leftEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : sectionLedgerBeamDepthM(model);
  const rightEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : sectionSupportBeamDepthM(model);
  const ridgeBeamDepthM = sectionRidgeBeamDepthM(model);
  const rafterPlumbCutDropM = sectionRafterPlumbCutDropM(model);
  const houseLedgerUndersideM = model.leftEdgeHeightM;
  const houseRafterUndersideM = houseLedgerUndersideM + leftEaveBeamDepthM - rafterPlumbCutDropM;
  const outerGutterUndersideM = sectionOuterGutterUndersideM(model);
  const outerRafterUndersideM = outerGutterUndersideM + model.gutterDepthM - rafterPlumbCutDropM;
  const supportUndersideM = sectionSupportUndersideM(model);
  const supportBeamTopM = supportUndersideM + sectionSupportBeamDepthM(model);
  const supportRafterUndersideM =
    model.sectionKind === 'mono'
      ? sectionMonoRafterUndersideAtM(model, supportXFromHouseM)
      : model.rightEdgeHeightM + rightEaveBeamDepthM - rafterPlumbCutDropM;

  const maxHeightM = Math.max(
    0.1,
    houseLedgerUndersideM,
    model.rightEdgeHeightM,
    supportUndersideM,
    outerGutterUndersideM,
    houseRafterUndersideM,
    supportRafterUndersideM,
    supportBeamTopM,
    outerRafterUndersideM,
    houseRafterUndersideM + model.rafterDepthM,
    outerRafterUndersideM + model.rafterDepthM,
    typeof model.ridgeHeightM === 'number' ? model.ridgeHeightM : 0,
    typeof model.ridgeHeightM === 'number' ? model.ridgeHeightM + ridgeBeamDepthM + model.rafterDepthM : 0,
    ...houseHeightValues,
  );

  return {
    widthM: Math.max(model.spanA, 0.001, Math.max(model.spanA, ...houseProjectionValues) - Math.min(0, ...houseProjectionValues)),
    heightM: maxHeightM,
  };
}

export function getPlanScaleFit(
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

export function getSectionScaleFit(
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

export function toScaleDiagnostic(scale: EstimateDrawingScale, fit: DrawingSheetFitResult | null): ModuleDrawingScaleDiagnostic {
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

export function sectionOverhangM(model: ModuleSectionModel): number {
  return model.sectionKind === 'mono' && model.overhangEnabled ? Math.max(0, Math.min(model.overhangAmountM, Math.max(0, model.spanA - 0.01))) : 0;
}

export function sectionSupportXFromHouseM(model: ModuleSectionModel): number {
  const overhangM = sectionOverhangM(model);
  return model.sectionKind === 'mono' ? Math.max(0.05, model.spanA - overhangM) : model.spanA;
}

export function sectionLedgerBeamDepthM(model: ModuleSectionModel): number {
  return memberSizeM(model.ledgerBeamDepthM, 0.1);
}

export function sectionLedgerBeamWidthM(model: ModuleSectionModel): number {
  return memberSizeM(model.ledgerBeamWidthM, 0.05);
}

export function sectionSupportBeamDepthM(model: ModuleSectionModel): number {
  return memberSizeM(model.supportBeamDepthM, 0.15);
}

export function sectionSupportBeamWidthM(model: ModuleSectionModel): number {
  return memberSizeM(model.supportBeamWidthM, 0.05);
}

export function sectionRidgeBeamDepthM(model: ModuleSectionModel): number {
  return memberSizeM(model.ridgeBeamDepthM, 0.15);
}

export function sectionRidgeBeamWidthM(model: ModuleSectionModel): number {
  return memberSizeM(model.ridgeBeamWidthM, 0.05);
}

export type MonoDatumResolution = {
  rightEdgeRole: 'gutter' | 'support';
  supportUndersideM: number;
  outerGutterUndersideM: number;
};

export function resolveMonoDatums(model: ModuleSectionModel): MonoDatumResolution {
  const overhangM = sectionOverhangM(model);
  if (model.sectionKind !== 'mono' || overhangM <= 0) {
    return {
      rightEdgeRole: 'gutter',
      supportUndersideM: model.rightEdgeHeightM,
      outerGutterUndersideM: model.rightEdgeHeightM,
    };
  }

  const spanM = Math.max(model.spanA, 0.001);
  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const leftUndersideM = model.leftEdgeHeightM;
  const rightRawM = model.rightEdgeHeightM;
  const pitchRad = (model.pitchDeg * Math.PI) / 180;
  const fallPerM = Math.tan(pitchRad) * (model.slopeDirection === 'toward_house' ? 1 : -1);
  const expectedSupportUndersideM = leftUndersideM + fallPerM * supportXFromHouseM;
  const expectedOuterUndersideM = leftUndersideM + fallPerM * spanM;
  const errAsSupport = Math.abs(rightRawM - expectedSupportUndersideM);
  const errAsGutter = Math.abs(rightRawM - expectedOuterUndersideM);

  // Derived right post height is often the support-post underside when overhang is enabled.
  const treatRightAsSupport = errAsSupport + 0.03 < errAsGutter;
  if (treatRightAsSupport) {
    return {
      rightEdgeRole: 'support',
      supportUndersideM: rightRawM,
      outerGutterUndersideM: Math.max(0, expectedOuterUndersideM),
    };
  }

  const tSupport = clamp(supportXFromHouseM / spanM, 0, 1);
  return {
    rightEdgeRole: 'gutter',
    supportUndersideM: Math.max(0, leftUndersideM + (rightRawM - leftUndersideM) * tSupport),
    outerGutterUndersideM: rightRawM,
  };
}

export function sectionOuterGutterUndersideM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return model.rightEdgeHeightM;
  return resolveMonoDatums(model).outerGutterUndersideM;
}

export function sectionRafterBearingStartM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return 0;
  return Math.max(0, Math.min(model.spanA, sectionLedgerBeamWidthM(model)));
}

export function sectionRafterBearingEndM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return model.spanA;
  const startM = sectionRafterBearingStartM(model);
  const endM = model.spanA - Math.max(0, Math.min(model.spanA, model.gutterWidthM));
  return Math.max(startM + 0.01, endM);
}

export function sectionRafterPlumbCutDropM(model: ModuleSectionModel): number {
  const pitchRad = (Math.max(0, Math.min(85, model.pitchDeg)) * Math.PI) / 180;
  const cosPitch = Math.max(0.12, Math.cos(pitchRad));
  return model.rafterDepthM / cosPitch;
}

export function sectionRafterPreCutAllowanceM(model: ModuleSectionModel): number {
  const pitchRad = (Math.max(0, Math.min(85, model.pitchDeg)) * Math.PI) / 180;
  const tanPitch = Math.max(0, Math.tan(pitchRad));
  const allowancePerEnd = Math.max(0, model.rafterWidthM) * tanPitch;
  return allowancePerEnd * 2;
}

export function sectionMonoRafterCutLengthM(model: ModuleSectionModel): number {
  const startM = sectionRafterBearingStartM(model);
  const endM = sectionRafterBearingEndM(model);
  const runM = Math.max(0.01, endM - startM);
  const houseTopM = model.leftEdgeHeightM + sectionLedgerBeamDepthM(model);
  const outerTopM = sectionOuterGutterUndersideM(model) + model.gutterDepthM;
  const finishedCutLengthM = Math.hypot(runM, outerTopM - houseTopM);
  return finishedCutLengthM + sectionRafterPreCutAllowanceM(model);
}

export function sectionGableRafterCutLengthsM(model: ModuleSectionModel): { leftM: number; rightM: number } | null {
  if (model.sectionKind !== 'gable' || typeof model.ridgeHeightM !== 'number' || !Number.isFinite(model.ridgeHeightM)) return null;

  const ridgeWidthM = sectionRidgeBeamWidthM(model);
  const eaveWidthM = memberSizeM(model.gutterWidthM, 0.1);
  const leftRunM = Math.max(0.01, model.spanA / 2 - eaveWidthM - ridgeWidthM / 2);
  const rightRunM = Math.max(0.01, model.spanA / 2 - eaveWidthM - ridgeWidthM / 2);
  const plumbCutDropM = sectionRafterPlumbCutDropM(model);
  const leftRafterUnderM = model.leftEdgeHeightM + model.gutterDepthM - plumbCutDropM;
  const rightRafterUnderM = model.rightEdgeHeightM + model.gutterDepthM - plumbCutDropM;
  const preCutAllowanceM = sectionRafterPreCutAllowanceM(model);
  const leftM = Math.hypot(leftRunM, model.ridgeHeightM - leftRafterUnderM) + preCutAllowanceM;
  const rightM = Math.hypot(rightRunM, model.ridgeHeightM - rightRafterUnderM) + preCutAllowanceM;
  return { leftM, rightM };
}

export function sectionRafterCutLengthLabel(model: ModuleSectionModel): string | null {
  if (model.sectionKind === 'mono') {
    return `Rafter length: ${formatMetresPrecise(sectionMonoRafterCutLengthM(model))}`;
  }

  const gableCuts = sectionGableRafterCutLengthsM(model);
  if (!gableCuts) return null;
  if (Math.abs(gableCuts.leftM - gableCuts.rightM) <= 0.01) {
    return `Rafter length: ${formatMetresPrecise((gableCuts.leftM + gableCuts.rightM) / 2)} ea`;
  }
  return `Rafter length: L ${formatMetresPrecise(gableCuts.leftM)} / R ${formatMetresPrecise(gableCuts.rightM)}`;
}

export function sectionMonoRafterUndersideAtM(model: ModuleSectionModel, xFromHouseM: number): number {
  const startM = sectionRafterBearingStartM(model);
  const endM = sectionRafterBearingEndM(model);
  const runM = Math.max(0.001, endM - startM);
  const t = clamp((xFromHouseM - startM) / runM, 0, 1);
  const plumbCutDropM = sectionRafterPlumbCutDropM(model);
  const houseRafterUndersideM = model.leftEdgeHeightM + sectionLedgerBeamDepthM(model) - plumbCutDropM;
  const outerRafterUndersideM = sectionOuterGutterUndersideM(model) + model.gutterDepthM - plumbCutDropM;
  return houseRafterUndersideM + (outerRafterUndersideM - houseRafterUndersideM) * t;
}

export function sectionSupportUndersideM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return model.rightEdgeHeightM;
  const resolved = resolveMonoDatums(model);
  const overhangM = sectionOverhangM(model);
  if (overhangM <= 0) return resolved.supportUndersideM;

  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const supportTopM = sectionMonoRafterUndersideAtM(model, supportXFromHouseM);
  const supportFromStackM = Math.max(0, supportTopM - sectionSupportBeamDepthM(model));
  return supportFromStackM;
}

export function toPointsAttr(points: Point[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

export function geometryFallDirectionToCardinal(direction: Vector2): CardinalDirection {
  if (Math.abs(direction.x) >= Math.abs(direction.y)) {
    return direction.x >= 0 ? 'right' : 'left';
  }
  return direction.y >= 0 ? 'down' : 'up';
}

export function segmentDownNormal(x1: number, y1: number, x2: number, y2: number): { nx: number; ny: number; len: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (ny < 0) {
    nx *= -1;
    ny *= -1;
  }
  return { nx, ny, len };
}

export function sectionMemberPolygon(x1: number, y1: number, x2: number, y2: number, depthPx: number): Point[] {
  const { nx, ny } = segmentDownNormal(x1, y1, x2, y2);
  return [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x2 + nx * depthPx, y: y2 + ny * depthPx },
    { x: x1 + nx * depthPx, y: y1 + ny * depthPx },
  ];
}

export function sectionMemberPolygonPlumbCuts(
  x1: number,
  yUnder1: number,
  x2: number,
  yUnder2: number,
  depthNormalPx: number,
): { points: Point[]; yTop1: number; yTop2: number } {
  const dx = x2 - x1;
  if (Math.abs(dx) < 1e-6) {
    const points = sectionMemberPolygon(x1, yUnder1, x2, yUnder2, depthNormalPx);
    const yTop1 = Math.min(...points.map((point) => point.y));
    const yTop2 = yTop1;
    return { points, yTop1, yTop2 };
  }
  const slope = (yUnder2 - yUnder1) / dx;
  const deltaY = depthNormalPx * Math.sqrt(1 + slope * slope);
  const yTop1 = yUnder1 - deltaY;
  const yTop2 = yUnder2 - deltaY;
  return {
    points: [
      { x: x1, y: yUnder1 },
      { x: x2, y: yUnder2 },
      { x: x2, y: yTop2 },
      { x: x1, y: yTop1 },
    ],
    yTop1,
    yTop2,
  };
}

export function hipCornerInnerPoints(x: number, y: number, aW: number, bW: number, splitY: number, bottomY: number, inset: number): Point[] {
  const t = Math.max(0.2, inset);
  return [
    { x: x + t, y: y + t },
    { x: x + aW - t, y: y + t },
    { x: x + aW - t, y: splitY - t },
    { x: x + bW - t, y: splitY - t },
    { x: x + bW - t, y: bottomY - t },
    { x: x + t, y: bottomY - t },
  ];
}

export function projectLinearPositions(positionsM: number[] | null, lengthM: number | null, startX: number, drawWidth: number): number[] {
  if (!positionsM || !positionsM.length || !lengthM || lengthM <= 0) return [];
  return positionsM.map((posM) => startX + (Math.max(0, posM) / lengthM) * drawWidth);
}

export function interiorPlanRafterXs(xs: number[]): number[] {
  if (xs.length <= 2) return [];
  return xs.slice(1, -1);
}

export function rotatePointQuarterTurns(point: Point, center: Point, turns: number): Point {
  const normalized = ((turns % 4) + 4) % 4;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (normalized === 1) return { x: center.x + dy, y: center.y - dx };
  if (normalized === 2) return { x: center.x - dx, y: center.y - dy };
  if (normalized === 3) return { x: center.x - dy, y: center.y + dx };
  return point;
}

export function rotatePointsQuarterTurns(points: Point[], center: Point, turns: number): Point[] {
  return points.map((point) => rotatePointQuarterTurns(point, center, turns));
}

export function rotateBoundsQuarterTurns(bounds: AnnotatedBounds, center: Point, turns: number): AnnotatedBounds {
  return boundsFromPoints(
    rotatePointsQuarterTurns(
      [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
        { x: bounds.minX, y: bounds.maxY },
      ],
      center,
      turns,
    ),
  );
}

export function rectToPoints(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

export function planHousePointToSvg(
  point: Point,
  baseX: number,
  baseY: number,
  scale: number,
): Point {
  return {
    x: baseX + point.x * scale,
    y: baseY + point.y * scale,
  };
}

export function planRotationTurnsForPresentation(input: {
  roofType: ModulePlanModel['roofType'];
  drawingRotationQuarterTurns: ModulePlanModel['drawingRotationQuarterTurns'];
  presentation: ModuleDrawingPresentation;
}): number {
  if (input.roofType === 'hip_corner') return 0;
  if (input.presentation === 'model') return 0;
  return input.drawingRotationQuarterTurns;
}

export function sectionHousePointToSvg(point: Point, xLeft: number, yGround: number, scale: number): Point {
  return {
    x: xLeft + point.x * scale,
    y: yGround - point.y * scale,
  };
}

export function planHouseSurfaceClass(kind: NonNullable<ModulePlanModel['houseContext']>['surfaces'][number]['kind']): string {
  if (kind === 'roof') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseRoof}`;
  if (kind === 'soffit') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseSoffit}`;
  if (kind === 'fascia') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFascia}`;
  if (kind === 'attachment_zone') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseAttachmentZone}`;
  return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFootprint}`;
}

export function planHouseLineClass(kind: NonNullable<ModulePlanModel['houseContext']>['lines'][number]['kind']): string {
  if (kind === 'gutter') return `${styles.modulePlanHouseLine} ${styles.modulePlanHouseGutter}`;
  if (kind === 'roof_feature') return `${styles.modulePlanHouseLine} ${styles.modulePlanHouseRoofFeature}`;
  if (kind === 'attachment_target') return `${styles.modulePlanHouseLine} ${styles.modulePlanHouseAttachmentTarget}`;
  return `${styles.modulePlanHouseLine} ${styles.modulePlanHouseWallSemantic}`;
}

export function sectionHouseSurfaceClass(kind: NonNullable<ModuleSectionModel['houseContext']>['surfaces'][number]['kind']): string {
  if (kind === 'roof') return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseRoof}`;
  if (kind === 'soffit') return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseSoffit}`;
  if (kind === 'fascia') return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseFascia}`;
  if (kind === 'attachment_zone') return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseAttachmentZone}`;
  return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseWallSemantic}`;
}

export function sectionHouseLineClass(kind: NonNullable<ModuleSectionModel['houseContext']>['lines'][number]['kind']): string {
  if (kind === 'gutter') return `${styles.moduleSectionHouseLine} ${styles.moduleSectionHouseGutter}`;
  if (kind === 'roof_feature') return `${styles.moduleSectionHouseLine} ${styles.moduleSectionHouseRoofFeature}`;
  if (kind === 'attachment_target') return `${styles.moduleSectionHouseLine} ${styles.moduleSectionHouseAttachmentTarget}`;
  return `${styles.moduleSectionHouseLine} ${styles.moduleSectionHouseReference}`;
}

export function resolvePlanRotationFrame(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  turns: number;
}): { baseX: number; baseY: number; center: Point; turns: number } {
  const turns = ((input.turns % 4) + 4) % 4;
  if (turns % 2 === 0) {
    return {
      baseX: input.x,
      baseY: input.y,
      center: { x: input.x + input.width / 2, y: input.y + input.height / 2 },
      turns,
    };
  }

  const delta = (input.width - input.height) / 2;
  const baseX = input.x - delta;
  const baseY = input.y + delta;
  return {
    baseX,
    baseY,
    center: { x: baseX + input.width / 2, y: baseY + input.height / 2 },
    turns,
  };
}

export type PlanAttachmentFrame = {
  start: Point;
  end: Point;
  tangent: Point;
  outward: Point;
  length: number;
};

export function attachmentFrameForRect(side: ModulePlanModel['attachmentSide'], rect: { x: number; y: number; width: number; height: number }): PlanAttachmentFrame {
  if (side === 'front') {
    return {
      start: { x: rect.x, y: rect.y + rect.height },
      end: { x: rect.x + rect.width, y: rect.y + rect.height },
      tangent: { x: 1, y: 0 },
      outward: { x: 0, y: 1 },
      length: rect.width,
    };
  }
  if (side === 'left') {
    return {
      start: { x: rect.x, y: rect.y },
      end: { x: rect.x, y: rect.y + rect.height },
      tangent: { x: 0, y: 1 },
      outward: { x: -1, y: 0 },
      length: rect.height,
    };
  }
  if (side === 'right') {
    return {
      start: { x: rect.x + rect.width, y: rect.y },
      end: { x: rect.x + rect.width, y: rect.y + rect.height },
      tangent: { x: 0, y: 1 },
      outward: { x: 1, y: 0 },
      length: rect.height,
    };
  }
  return {
    start: { x: rect.x, y: rect.y },
    end: { x: rect.x + rect.width, y: rect.y },
    tangent: { x: 1, y: 0 },
    outward: { x: 0, y: -1 },
    length: rect.width,
  };
}

export function pointOnAttachmentFrame(frame: PlanAttachmentFrame, along: number, outward: number): Point {
  return {
    x: frame.start.x + frame.tangent.x * along + frame.outward.x * outward,
    y: frame.start.y + frame.tangent.y * along + frame.outward.y * outward,
  };
}

export function rotateVectorQuarterTurns(vector: Point, turns: number): Point {
  return rotatePointQuarterTurns(vector, { x: 0, y: 0 }, turns);
}

export type CardinalDirection = 'up' | 'down' | 'left' | 'right';

export type PlanFallAnnotationSpec = {
  lineStart: Point;
  lineEnd: Point;
  label: string;
  labelPoint: Point;
  arrowHeads: Array<{ point: Point; direction: CardinalDirection }>;
};

export type PlanSpacingAnnotationSpec = {
  witness1Start: Point;
  witness1End: Point;
  witness2Start: Point;
  witness2End: Point;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
};

export type PlanLineTextAnnotationSpec = {
  lineStart: Point;
  lineEnd: Point;
  text: string;
  textPoint: Point;
  anchor?: 'start' | 'middle' | 'end';
};

export function cardinalDirectionToVector(direction: CardinalDirection): Point {
  switch (direction) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
    default:
      return { x: 1, y: 0 };
  }
}

export function vectorToCardinalDirection(vector: Point): CardinalDirection {
  if (Math.abs(vector.x) >= Math.abs(vector.y)) {
    return vector.x >= 0 ? 'right' : 'left';
  }
  return vector.y >= 0 ? 'down' : 'up';
}

export function rotateCardinalDirectionQuarterTurns(direction: CardinalDirection, turns: number): CardinalDirection {
  return vectorToCardinalDirection(rotateVectorQuarterTurns(cardinalDirectionToVector(direction), turns));
}

export function buildPlanFallAnnotationSpec(input: {
  model: ModulePlanModel;
  attachmentSide: AttachmentSide;
  isHipCorner: boolean;
  isGableLike: boolean;
  baseX: number;
  baseY: number;
  aW: number;
  aH: number;
  bW: number;
  bH: number;
  bottomY: number;
  fallGap: number;
  rotationCenter: Point;
  rotationTurns: number;
  isSheet: boolean;
}): PlanFallAnnotationSpec {
  const { attachmentSide } = input;
  const fallIsHorizontal = attachmentSide === 'left' || attachmentSide === 'right';
  const fallAnchor =
    attachmentSide === 'rear' || attachmentSide === 'front'
      ? attachmentFrameForRect('right', {
          x: input.baseX + Math.max(input.aW, input.bW) + input.fallGap - 0.55,
          y: input.baseY,
          width: 0,
          height: input.isHipCorner ? input.aH + input.bH : input.aH,
        })
      : attachmentFrameForRect('front', {
          x: input.baseX,
          y: input.bottomY + input.fallGap - 0.55,
          width: input.aW,
          height: 0,
        });
  const fallStart = pointOnAttachmentFrame(fallAnchor, input.isSheet ? 1.5 : 1, 0);
  const fallEnd = pointOnAttachmentFrame(
    fallAnchor,
    Math.max(input.isSheet ? 1.5 : 1, fallAnchor.length - (input.isSheet ? 1.5 : 1)),
    0,
  );
  const fallLabelPoint = pointOnAttachmentFrame(
    fallAnchor,
    fallAnchor.length / 2,
    fallIsHorizontal ? (input.isSheet ? 0.8 : 2.2) : input.isSheet ? 0.62 : 2.3,
  );
  const localArrowHeads: Array<{ point: Point; direction: CardinalDirection }> = input.isGableLike
    ? [
        {
          point: fallStart,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : 'up',
        },
        {
          point: fallEnd,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'right' : 'left') : 'down',
        },
      ]
    : [
        {
          point: input.model.slopeDirection === 'toward_house' ? fallStart : fallEnd,
          direction: fallIsHorizontal
            ? attachmentSide === 'left'
              ? 'left'
              : 'right'
            : input.model.slopeDirection === 'toward_house'
              ? 'up'
              : 'down',
        },
      ];

  return {
    lineStart: rotatePointQuarterTurns(fallStart, input.rotationCenter, input.rotationTurns),
    lineEnd: rotatePointQuarterTurns(fallEnd, input.rotationCenter, input.rotationTurns),
    label: input.isGableLike ? 'fall both sides' : 'fall',
    labelPoint: rotatePointQuarterTurns(fallLabelPoint, input.rotationCenter, input.rotationTurns),
    arrowHeads: localArrowHeads.map((arrowHead) => ({
      point: rotatePointQuarterTurns(arrowHead.point, input.rotationCenter, input.rotationTurns),
      direction: rotateCardinalDirectionQuarterTurns(arrowHead.direction, input.rotationTurns),
    })),
  };
}

export function estimatePlanFallAnnotationBounds(spec: PlanFallAnnotationSpec, presentation: ModuleDrawingPresentation): AnnotatedBounds {
  return unionBounds([
    boundsFromLine(spec.lineStart.x, spec.lineStart.y, spec.lineEnd.x, spec.lineEnd.y, 0.25),
    ...spec.arrowHeads.map((arrowHead) =>
      estimateArrowHeadBounds({
        x: arrowHead.point.x,
        y: arrowHead.point.y,
        direction: arrowHead.direction,
        presentation,
      }),
    ),
    estimateTextBounds({
      text: spec.label,
      x: spec.labelPoint.x,
      y: spec.labelPoint.y,
      anchor: 'middle',
      fontHeight: presentation === 'sheet' ? 1.8 : 2.1,
      charWidth: presentation === 'sheet' ? 0.58 : 0.64,
      paddingX: 0.2,
      paddingY: 0.18,
    }),
  ]);
}

export function buildPlanRafterSpacingAnnotationSpec(input: {
  rafterXsA: number[];
  interiorRafterXsA: number[];
  splitY: number;
  gutterW: number;
  yBottomInner: number;
  rafterDimY: number;
  isHipCorner: boolean;
  rotationCenter: Point;
  rotationTurns: number;
  label: string;
}): PlanSpacingAnnotationSpec | null {
  if (input.rafterXsA.length < 2) return null;

  const spacingXs = input.interiorRafterXsA.length >= 2 ? input.interiorRafterXsA : input.rafterXsA;
  const baseIdx = Math.max(0, Math.floor((spacingXs.length - 2) / 2));
  const d1 = spacingXs[baseIdx]!;
  const d2 = spacingXs[baseIdx + 1]!;
  const witnessStartY = input.isHipCorner ? input.splitY - input.gutterW : input.yBottomInner;
  const witness1Start = rotatePointQuarterTurns({ x: d1, y: witnessStartY }, input.rotationCenter, input.rotationTurns);
  const witness1End = rotatePointQuarterTurns({ x: d1, y: input.rafterDimY }, input.rotationCenter, input.rotationTurns);
  const witness2Start = rotatePointQuarterTurns({ x: d2, y: witnessStartY }, input.rotationCenter, input.rotationTurns);
  const witness2End = rotatePointQuarterTurns({ x: d2, y: input.rafterDimY }, input.rotationCenter, input.rotationTurns);
  const dimensionStart = rotatePointQuarterTurns({ x: d1, y: input.rafterDimY }, input.rotationCenter, input.rotationTurns);
  const dimensionEnd = rotatePointQuarterTurns({ x: d2, y: input.rafterDimY }, input.rotationCenter, input.rotationTurns);

  return {
    witness1Start,
    witness1End,
    witness2Start,
    witness2End,
    x1: dimensionStart.x,
    y1: dimensionStart.y,
    x2: dimensionEnd.x,
    y2: dimensionEnd.y,
    label: input.label,
  };
}

export function estimatePlanSpacingAnnotationBounds(spec: PlanSpacingAnnotationSpec, presentation: ModuleDrawingPresentation): AnnotatedBounds {
  return unionBounds([
    boundsFromLine(spec.witness1Start.x, spec.witness1Start.y, spec.witness1End.x, spec.witness1End.y, 0.2),
    boundsFromLine(spec.witness2Start.x, spec.witness2Start.y, spec.witness2End.x, spec.witness2End.y, 0.2),
    estimateTickDimensionBounds({
      x1: spec.x1,
      y1: spec.y1,
      x2: spec.x2,
      y2: spec.y2,
      label: spec.label,
      presentation,
    }),
  ]);
}

export function buildPlanInternalAngleAnnotationSpec(input: {
  centerX: number;
  centerY: number;
  baseY: number;
  bottomY: number;
  aH: number;
  isHipCorner: boolean;
  rotationCenter: Point;
  rotationTurns: number;
}): PlanLineTextAnnotationSpec {
  return {
    lineStart: rotatePointQuarterTurns({ x: input.centerX, y: input.baseY + 2.8 }, input.rotationCenter, input.rotationTurns),
    lineEnd: rotatePointQuarterTurns(
      { x: input.centerX, y: (input.isHipCorner ? input.bottomY : input.baseY + input.aH) - 2.8 },
      input.rotationCenter,
      input.rotationTurns,
    ),
    text: 'internal roof angle',
    textPoint: rotatePointQuarterTurns({ x: input.centerX + 2.5, y: input.centerY + 0.5 }, input.rotationCenter, input.rotationTurns),
    anchor: 'start',
  };
}

export function estimatePlanLineTextAnnotationBounds(spec: PlanLineTextAnnotationSpec): AnnotatedBounds {
  return unionBounds([
    boundsFromLine(spec.lineStart.x, spec.lineStart.y, spec.lineEnd.x, spec.lineEnd.y, 0.2),
    estimateTextBounds({
      text: spec.text,
      x: spec.textPoint.x,
      y: spec.textPoint.y,
      anchor: spec.anchor ?? 'middle',
      fontHeight: 1.55,
      charWidth: 0.54,
      paddingX: 0.15,
      paddingY: 0.15,
    }),
  ]);
}

export type FootprintHandleSpec = {
  id: HouseFootprintHandleId;
  label: string;
  valueM: number;
  point: Point;
  pointRoot: Point;
  guideFrom: Point;
  guideTo: Point;
  axisX: number;
  axisY: number;
  deltaMultiplier: number;
  minValueM: number;
  maxValueM: number;
};

export type FootprintResizeEdgeSpec = {
  id: HouseFootprintHandleId;
  label: string;
  valueM: number;
  start: Point;
  end: Point;
  pointRoot: Point;
  axisX: number;
  axisY: number;
  deltaMultiplier: number;
  minValueM: number;
  maxValueM: number;
};

export type FootprintCustomVertexSpec = {
  index: number;
  kind: 'confirmed' | 'pending' | 'hover' | 'locked-distance';
  isLatestConfirmed: boolean;
  isCloseReady: boolean;
  isCloseHovered: boolean;
  point: Point;
  pointRoot: Point;
  alongAxisX: number;
  alongAxisY: number;
  depthAxisX: number;
  depthAxisY: number;
};

export type FootprintCustomEdgeSpec = {
  index: number;
  kind: 'confirmed' | 'preview';
  previewPointKind: 'pending' | 'hover' | 'locked-distance' | null;
  isClosePreview: boolean;
  isActive: boolean;
  start: Point;
  end: Point;
};

export type FootprintCanvasLayout = {
  polygon: Point[];
  handles: FootprintHandleSpec[];
  resizeEdges: FootprintResizeEdgeSpec[];
  customVertices: FootprintCustomVertexSpec[];
  customEdges: FootprintCustomEdgeSpec[];
  landingPoint: Point | null;
  lockedDistanceCenter: Point | null;
  sideTurns: number;
};

export function actualPergolaCenter(rect: { x: number; y: number; width: number; height: number }): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

export function localFootprintDimensionsM(model: ModulePlanModel, attachmentSide: AttachmentSide): { widthM: number; depthM: number } {
  if (attachmentSide === 'left' || attachmentSide === 'right') {
    return {
      widthM: model.spanA,
      depthM: model.lengthA,
    };
  }

  return {
    widthM: model.lengthA,
    depthM: model.spanA,
  };
}

export function mapLocalFootprintPointToPlan(input: {
  point: HouseFootprintPoint;
  rect: { x: number; y: number; width: number; height: number };
  canonicalWidthM: number;
  canonicalDepthM: number;
  scale: number;
  sideTurns: number;
}): Point {
  const center = actualPergolaCenter(input.rect);
  const canonicalWidth = input.canonicalWidthM * input.scale;
  const canonicalDepth = input.canonicalDepthM * input.scale;
  const canonicalPoint = {
    x: center.x - canonicalWidth / 2 + input.point.x * input.scale,
    y: center.y - canonicalDepth / 2 + input.point.y * input.scale,
  };
  return rotatePointQuarterTurns(canonicalPoint, center, input.sideTurns);
}

export function resolveFootprintCanvasLayout(input: {
  model: ModulePlanModel;
  rect: { x: number; y: number; width: number; height: number };
  scale: number;
  rotationCenter: Point;
  rotationTurns: number;
  customPolygonOverride?: ModulePlanModel['houseFootprintPolygon'] | null;
  customPolygonOpen?: boolean;
  customPolygonConfirmedPointCount?: number;
  customPolygonPreviewPointKind?: 'pending' | 'hover' | 'locked-distance' | null;
  customPolygonCloseReady?: boolean;
  customPolygonCloseHovered?: boolean;
  customPolygonLandingPoint?: ModuleFootprintCanvasPoint | null;
  customPolygonLockedDistanceM?: number | null;
  hideHouseFootprint?: boolean;
}): FootprintCanvasLayout {
  const { model, rect, scale, rotationCenter, rotationTurns } = input;
  const sideTurns = attachmentSideQuarterTurns(model.attachmentSide);
  const dims = localFootprintDimensionsM(model, model.attachmentSide);
  const localLayout = buildHouseFootprintLocalLayout({
    pergolaWidthM: dims.widthM,
    pergolaDepthM: dims.depthM,
    preset: model.houseFootprintPreset,
    params: model.houseFootprintParams,
  });
  const totalTurns = sideTurns + rotationTurns;
  const customPolygonOpen = Boolean(input.customPolygonOpen);
  const customPolygonSource = input.customPolygonOverride === undefined ? model.houseFootprintPolygon : input.customPolygonOverride;
  const hasCustomPolygonSource = customPolygonOpen || input.customPolygonOverride !== undefined || model.houseFootprintMode === 'custom_polygon';
  const customPolygonConfirmedPointCount =
    input.customPolygonConfirmedPointCount === undefined ? Number.POSITIVE_INFINITY : Math.max(0, input.customPolygonConfirmedPointCount);
  const customPolygonPreviewPointKind = input.customPolygonPreviewPointKind ?? null;
  const customPolygonCloseReady = Boolean(input.customPolygonCloseReady);
  const customPolygonCloseHovered = Boolean(input.customPolygonCloseHovered);
  const landingPoint =
    input.customPolygonLandingPoint &&
    Number.isFinite(input.customPolygonLandingPoint.numericAlongM) &&
    Number.isFinite(input.customPolygonLandingPoint.numericDepthM)
      ? mapLocalFootprintPointToPlan({
          point: {
            x: input.customPolygonLandingPoint.numericAlongM + localLayout.resolved.offsetXM,
            y: -localLayout.resolved.setbackM - input.customPolygonLandingPoint.numericDepthM,
          },
          rect,
          canonicalWidthM: dims.widthM,
          canonicalDepthM: dims.depthM,
          scale,
          sideTurns,
        })
      : null;
  const customPoints =
    hasCustomPolygonSource
      ? (customPolygonSource ?? [])
          .map((raw) => {
            const alongM = Number.parseFloat(raw.alongM);
            const depthM = Number.parseFloat(raw.depthM);
            if (!Number.isFinite(alongM) || !Number.isFinite(depthM)) return null;
            return {
              x: alongM + localLayout.resolved.offsetXM,
              y: -localLayout.resolved.setbackM - depthM,
            };
          })
          .filter((point): point is HouseFootprintPoint => Boolean(point))
      : [];
  const effectiveLocalPolygon = customPoints.length >= 3 ? customPoints : customPolygonOpen || input.hideHouseFootprint ? [] : localLayout.polygon;
  const polygon = effectiveLocalPolygon.map((localPoint) =>
    mapLocalFootprintPointToPlan({
      point: localPoint,
      rect,
      canonicalWidthM: dims.widthM,
      canonicalDepthM: dims.depthM,
      scale,
      sideTurns,
    }),
  );
  const customVertices =
    customPoints.length > 0
      ? customPoints.map((localPoint, index): FootprintCustomVertexSpec => {
          const point = mapLocalFootprintPointToPlan({
            point: localPoint,
            rect,
            canonicalWidthM: dims.widthM,
            canonicalDepthM: dims.depthM,
            scale,
            sideTurns,
          });
          const alongAxis = rotateVectorQuarterTurns({ x: 1, y: 0 }, totalTurns);
          const depthAxis = rotateVectorQuarterTurns({ x: 0, y: -1 }, totalTurns);
          const isConfirmed = index < customPolygonConfirmedPointCount;
          const isPreviewPoint = !isConfirmed && index === customPolygonConfirmedPointCount;
          return {
            index,
            kind: isPreviewPoint ? customPolygonPreviewPointKind ?? 'hover' : 'confirmed',
            isLatestConfirmed: isConfirmed && index === customPolygonConfirmedPointCount - 1,
            isCloseReady: customPolygonCloseReady && index === 0,
            isCloseHovered: customPolygonCloseHovered && index === 0,
            point,
            pointRoot: rotatePointQuarterTurns(point, rotationCenter, rotationTurns),
            alongAxisX: alongAxis.x,
            alongAxisY: alongAxis.y,
            depthAxisX: depthAxis.x,
            depthAxisY: depthAxis.y,
          };
        })
      : [];
  const customEdges =
    customVertices.length >= 2
      ? customVertices.flatMap((vertex, index): FootprintCustomEdgeSpec[] => {
          if (input.customPolygonOpen && index === customVertices.length - 1) return [];
          const next = customVertices[(index + 1) % customVertices.length]!;
          const isPreviewEdge =
            Boolean(customPolygonPreviewPointKind) &&
            index === customPolygonConfirmedPointCount - 1 &&
            next.index === customPolygonConfirmedPointCount;
          return [{
            index,
            kind: isPreviewEdge ? 'preview' : 'confirmed',
            previewPointKind: isPreviewEdge ? customPolygonPreviewPointKind : null,
            isClosePreview: Boolean(isPreviewEdge && customPolygonCloseHovered),
            isActive: !isPreviewEdge && next.isLatestConfirmed,
            start: vertex.point,
            end: next.point,
          }];
        })
      : [];
  const latestConfirmedVertex =
    customPolygonConfirmedPointCount > 0 ? customVertices[customPolygonConfirmedPointCount - 1] ?? null : null;
  const lockedDistanceCenter = latestConfirmedVertex?.point ?? null;
  const handles = customPolygonOpen ? [] : localLayout.handles.map((handle): FootprintHandleSpec => {
    const point = mapLocalFootprintPointToPlan({
      point: handle.point,
      rect,
      canonicalWidthM: dims.widthM,
      canonicalDepthM: dims.depthM,
      scale,
      sideTurns,
    });
    return {
      ...handle,
      point,
      pointRoot: rotatePointQuarterTurns(point, rotationCenter, rotationTurns),
      guideFrom: mapLocalFootprintPointToPlan({
        point: handle.guideFrom,
        rect,
        canonicalWidthM: dims.widthM,
        canonicalDepthM: dims.depthM,
        scale,
        sideTurns,
      }),
      guideTo: mapLocalFootprintPointToPlan({
        point: handle.guideTo,
        rect,
        canonicalWidthM: dims.widthM,
        canonicalDepthM: dims.depthM,
        scale,
        sideTurns,
      }),
      axisX: rotateVectorQuarterTurns({ x: handle.axisX, y: handle.axisY }, totalTurns).x,
      axisY: rotateVectorQuarterTurns({ x: handle.axisX, y: handle.axisY }, totalTurns).y,
    };
  });
  const resizeEdges = customPolygonOpen ? [] : localLayout.edges.map((edge): FootprintResizeEdgeSpec => {
    const start = mapLocalFootprintPointToPlan({
      point: edge.start,
      rect,
      canonicalWidthM: dims.widthM,
      canonicalDepthM: dims.depthM,
      scale,
      sideTurns,
    });
    const end = mapLocalFootprintPointToPlan({
      point: edge.end,
      rect,
      canonicalWidthM: dims.widthM,
      canonicalDepthM: dims.depthM,
      scale,
      sideTurns,
    });
    const midPoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return {
      ...edge,
      start,
      end,
      pointRoot: rotatePointQuarterTurns(midPoint, rotationCenter, rotationTurns),
      axisX: rotateVectorQuarterTurns({ x: edge.axisX, y: edge.axisY }, totalTurns).x,
      axisY: rotateVectorQuarterTurns({ x: edge.axisX, y: edge.axisY }, totalTurns).y,
    };
  });

  return {
    polygon,
    handles: hasCustomPolygonSource ? [] : handles,
    resizeEdges: hasCustomPolygonSource ? [] : resizeEdges,
    customVertices,
    customEdges,
    landingPoint,
    lockedDistanceCenter,
    sideTurns,
  };
}

export function footprintLabelPoint(points: Point[]): Point {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
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

export function resolveTickDimensionGeometry({
  x1,
  y1,
  x2,
  y2,
  textX,
  textY,
  rotateDeg,
  overrun = 2.7,
  showTermBars = false,
  presentation = 'card',
}: Omit<TickDimensionProps, 'label'>): TickDimensionGeometry {
  const dimSpec = getDimensionPresentationSpec(presentation);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const tickHalf = dimSpec.tickHalf;
  const tx = (ux + nx) * tickHalf;
  const ty = (uy + ny) * tickHalf;
  const lineStartX = x1 - ux * overrun;
  const lineStartY = y1 - uy * overrun;
  const lineEndX = x2 + ux * overrun;
  const lineEndY = y2 + uy * overrun;
  const barHalf = dimSpec.barHalf;
  const barOffset = dimSpec.barOffset;
  const horizontalBias = Math.abs(dx) >= Math.abs(dy) * 1.35;
  const verticalBias = Math.abs(dy) > Math.abs(dx) * 1.35;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const labelX = textX ?? (verticalBias ? cx - dimSpec.verticalLabelGap : horizontalBias ? cx : cx - nx * dimSpec.labelClearance);
  const labelY = textY ?? (verticalBias ? cy : horizontalBias ? cy - dimSpec.horizontalLabelGap : cy - ny * dimSpec.labelClearance);
  const labelRotate = rotateDeg ?? (verticalBias ? -90 : undefined);

  return {
    lineStartX,
    lineStartY,
    lineEndX,
    lineEndY,
    tick1StartX: x1 - tx,
    tick1StartY: y1 - ty,
    tick1EndX: x1 + tx,
    tick1EndY: y1 + ty,
    tick2StartX: x2 - tx,
    tick2StartY: y2 - ty,
    tick2EndX: x2 + tx,
    tick2EndY: y2 + ty,
    labelX,
    labelY,
    labelRotate,
    termBar1: showTermBars
      ? {
          x1: x1 + ux * barOffset - nx * barHalf,
          y1: y1 + uy * barOffset - ny * barHalf,
          x2: x1 + ux * barOffset + nx * barHalf,
          y2: y1 + uy * barOffset + ny * barHalf,
        }
      : undefined,
    termBar2: showTermBars
      ? {
          x1: x2 - ux * barOffset - nx * barHalf,
          y1: y2 - uy * barOffset - ny * barHalf,
          x2: x2 - ux * barOffset + nx * barHalf,
          y2: y2 - uy * barOffset + ny * barHalf,
        }
      : undefined,
  };
}

export function TickDimension({
  x1,
  y1,
  x2,
  y2,
  label,
  textX,
  textY,
  rotateDeg,
  overrun = 2.7,
  showTermBars = false,
  presentation = 'card',
  interactiveField,
  lineClassName,
  tickClassName,
  textClassName,
}: TickDimensionProps) {
  const geometry = resolveTickDimensionGeometry({
    x1,
    y1,
    x2,
    y2,
    textX,
    textY,
    rotateDeg,
    overrun,
    showTermBars,
    presentation,
  });

  return (
    <g>
      <line
        x1={geometry.lineStartX}
        y1={geometry.lineStartY}
        x2={geometry.lineEndX}
        y2={geometry.lineEndY}
        className={[styles.moduleDimLine, lineClassName].filter(Boolean).join(' ')}
      />
      {geometry.termBar1 && geometry.termBar2 ? (
        <>
          <line
            x1={geometry.termBar1.x1}
            y1={geometry.termBar1.y1}
            x2={geometry.termBar1.x2}
            y2={geometry.termBar1.y2}
            className={styles.moduleDimTermBar}
          />
          <line
            x1={geometry.termBar2.x1}
            y1={geometry.termBar2.y1}
            x2={geometry.termBar2.x2}
            y2={geometry.termBar2.y2}
            className={styles.moduleDimTermBar}
          />
        </>
      ) : null}
      <line
        x1={geometry.tick1StartX}
        y1={geometry.tick1StartY}
        x2={geometry.tick1EndX}
        y2={geometry.tick1EndY}
        className={[styles.moduleDimTick, tickClassName].filter(Boolean).join(' ')}
      />
      <line
        x1={geometry.tick2StartX}
        y1={geometry.tick2StartY}
        x2={geometry.tick2EndX}
        y2={geometry.tick2EndY}
        className={[styles.moduleDimTick, tickClassName].filter(Boolean).join(' ')}
      />
      <text
        x={geometry.labelX}
        y={geometry.labelY}
        textAnchor="middle"
        className={[
          styles.moduleDimText,
          interactiveField ? styles.moduleDimTextEditable : '',
          textClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        transform={typeof geometry.labelRotate === 'number' ? `rotate(${geometry.labelRotate} ${geometry.labelX} ${geometry.labelY})` : undefined}
        data-editable-field-id={interactiveField?.fieldId}
        tabIndex={interactiveField?.onActivate ? 0 : undefined}
        onClick={interactiveField?.onActivate ? (event) => interactiveField.onActivate?.(interactiveField.fieldId, event.currentTarget) : undefined}
        onKeyDown={
          interactiveField?.onActivate
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                interactiveField.onActivate?.(interactiveField.fieldId, event.currentTarget as SVGTextElement);
              }
            : undefined
        }
      >
        {label}
      </text>
    </g>
  );
}

export function estimateTickDimensionBounds(
  props: TickDimensionProps,
  options?: {
    charWidth?: number;
    fontHeight?: number;
    paddingX?: number;
    paddingY?: number;
  },
): AnnotatedBounds {
  const geometry = resolveTickDimensionGeometry(props);
  return unionBounds([
    boundsFromLine(geometry.lineStartX, geometry.lineStartY, geometry.lineEndX, geometry.lineEndY, 0.45),
    boundsFromLine(geometry.tick1StartX, geometry.tick1StartY, geometry.tick1EndX, geometry.tick1EndY, 0.35),
    boundsFromLine(geometry.tick2StartX, geometry.tick2StartY, geometry.tick2EndX, geometry.tick2EndY, 0.35),
    geometry.termBar1 ? boundsFromLine(geometry.termBar1.x1, geometry.termBar1.y1, geometry.termBar1.x2, geometry.termBar1.y2, 0.25) : null,
    geometry.termBar2 ? boundsFromLine(geometry.termBar2.x1, geometry.termBar2.y1, geometry.termBar2.x2, geometry.termBar2.y2, 0.25) : null,
    estimateTextBounds({
      text: props.label,
      x: geometry.labelX,
      y: geometry.labelY,
      anchor: 'middle',
      fontHeight: options?.fontHeight ?? (props.presentation === 'sheet' ? 1.85 : 2.3),
      charWidth: options?.charWidth ?? (props.presentation === 'sheet' ? 0.62 : 0.78),
      paddingX: options?.paddingX ?? 0.35,
      paddingY: options?.paddingY ?? 0.18,
      rotateDeg: geometry.labelRotate,
    }),
  ]);
}

export function estimatePinnedSheetPlanPrimaryDimensionBounds(input: {
  rotatedPrimaryBounds: AnnotatedBounds;
  dimensionOffsets: { bottom: number; side: number };
  bottomLabel: string;
  leftLabel: string;
  presentation: ModuleDrawingPresentation;
}): AnnotatedBounds {
  const pinnedBottomDimensionY = Math.min(87.4, input.rotatedPrimaryBounds.maxY + input.dimensionOffsets.bottom);
  const pinnedLeftDimensionX = input.rotatedPrimaryBounds.minX - input.dimensionOffsets.side;

  return unionBounds([
    boundsFromLine(input.rotatedPrimaryBounds.minX, input.rotatedPrimaryBounds.maxY, input.rotatedPrimaryBounds.minX, pinnedBottomDimensionY, 0.2),
    boundsFromLine(input.rotatedPrimaryBounds.maxX, input.rotatedPrimaryBounds.maxY, input.rotatedPrimaryBounds.maxX, pinnedBottomDimensionY, 0.2),
    estimateTickDimensionBounds({
      x1: input.rotatedPrimaryBounds.minX,
      y1: pinnedBottomDimensionY,
      x2: input.rotatedPrimaryBounds.maxX,
      y2: pinnedBottomDimensionY,
      label: input.bottomLabel,
      presentation: input.presentation,
    }),
    boundsFromLine(input.rotatedPrimaryBounds.minX, input.rotatedPrimaryBounds.minY, pinnedLeftDimensionX, input.rotatedPrimaryBounds.minY, 0.2),
    boundsFromLine(input.rotatedPrimaryBounds.minX, input.rotatedPrimaryBounds.maxY, pinnedLeftDimensionX, input.rotatedPrimaryBounds.maxY, 0.2),
    estimateTickDimensionBounds({
      x1: pinnedLeftDimensionX,
      y1: input.rotatedPrimaryBounds.minY,
      x2: pinnedLeftDimensionX,
      y2: input.rotatedPrimaryBounds.maxY,
      label: input.leftLabel,
      presentation: input.presentation,
    }),
  ]);
}

export function ArrowHead({
  x,
  y,
  direction,
  presentation = 'card',
}: {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  presentation?: ModuleDrawingPresentation;
}) {
  const isSheet = presentation === 'sheet';
  const reach = isSheet ? 0.96 : 1.3;
  const span = isSheet ? 0.78 : 1.15;
  if (direction === 'up') {
    return (
      <g>
        <line x1={x} y1={y - reach} x2={x - span} y2={y + reach} className={styles.moduleFallHead} />
        <line x1={x} y1={y - reach} x2={x + span} y2={y + reach} className={styles.moduleFallHead} />
      </g>
    );
  }
  if (direction === 'left') {
    return (
      <g>
        <line x1={x - reach} y1={y} x2={x + reach} y2={y - span} className={styles.moduleFallHead} />
        <line x1={x - reach} y1={y} x2={x + reach} y2={y + span} className={styles.moduleFallHead} />
      </g>
    );
  }
  if (direction === 'right') {
    return (
      <g>
        <line x1={x + reach} y1={y} x2={x - reach} y2={y - span} className={styles.moduleFallHead} />
        <line x1={x + reach} y1={y} x2={x - reach} y2={y + span} className={styles.moduleFallHead} />
      </g>
    );
  }
  return (
    <g>
      <line x1={x} y1={y + reach} x2={x - span} y2={y - reach} className={styles.moduleFallHead} />
      <line x1={x} y1={y + reach} x2={x + span} y2={y - reach} className={styles.moduleFallHead} />
    </g>
  );
}

export function estimateArrowHeadBounds({
  x,
  y,
  presentation = 'card',
}: {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  presentation?: ModuleDrawingPresentation;
}): AnnotatedBounds {
  const isSheet = presentation === 'sheet';
  const reach = isSheet ? 0.96 : 1.3;
  const span = isSheet ? 0.78 : 1.15;
  return boundsFromRect(x - span - 0.25, y - reach - 0.25, span * 2 + 0.5, reach * 2 + 0.5);
}

export function formatScaleDebugLabel(scale: EstimateDrawingScale): string {
  return scale.mode === 'fit' ? 'NTS' : `1:${scale.ratio}`;
}

export function buildSheetDebugMetrics(
  layout: ResolvedSheetLayout,
  scaleState?: ModuleDrawingScaleState | null,
  diagnostics: ModuleDrawingScaleDiagnostic[] = [],
): SheetDebugMetrics {
  const boundsWidth = getBoundsWidth(layout.annotatedBounds);
  const boundsHeight = getBoundsHeight(layout.annotatedBounds);
  return {
    requestedScaleLabel: formatScaleDebugLabel(scaleState?.requestedScale ?? { mode: 'fit' }),
    appliedScaleLabel: formatScaleDebugLabel(scaleState?.appliedScale ?? { mode: 'fit' }),
    boundsWidth,
    boundsHeight,
    fitWidth: layout.fitArea.width,
    fitHeight: layout.fitArea.height,
    utilizationX: boundsWidth / Math.max(layout.fitArea.width, 0.001),
    utilizationY: boundsHeight / Math.max(layout.fitArea.height, 0.001),
    candidateLines: diagnostics.map((diagnostic) => {
      const scaleLabel = formatScaleDebugLabel(diagnostic.scale);
      return `${scaleLabel} ${diagnostic.fits ? 'ok' : 'no'} ${Math.round(diagnostic.utilizationX * 100)}%/${Math.round(diagnostic.utilizationY * 100)}%`;
    }),
  };
}

export function resolveMeasuredFitLayout(input: {
  initialScale: number;
  resolveForScale: (scale: number) => ResolvedSheetLayout;
}): ResolvedSheetLayout {
  let scale = Math.max(0.05, input.initialScale);
  let layout = input.resolveForScale(scale);

  for (let idx = 0; idx < 8; idx += 1) {
    const ratio = Math.min(
      layout.fitArea.width / Math.max(getBoundsWidth(layout.annotatedBounds), 0.001),
      layout.fitArea.height / Math.max(getBoundsHeight(layout.annotatedBounds), 0.001),
    );
    const nextScale = Math.max(0.05, scale * ratio);
    if (Math.abs(nextScale - scale) <= 0.0005) {
      scale = nextScale;
      layout = input.resolveForScale(scale);
      break;
    }
    scale = nextScale;
    layout = input.resolveForScale(scale);
  }

  for (let idx = 0; idx < 12 && !fitsWithinArea(layout.annotatedBounds, layout.fitArea); idx += 1) {
    scale *= 0.995;
    layout = input.resolveForScale(scale);
  }

  return layout;
}

export type ResolvedSheetLayout = {
  outerField: SheetDrawingField;
  fitArea: SheetFitArea;
  annotatedBounds: AnnotatedBounds;
  x: number;
  y: number;
  scale: number;
  houseBandHeight: number;
  houseBandOffset: number;
  houseInset: number;
  fallGap: number;
};

export type SheetDebugMetrics = {
  requestedScaleLabel: string;
  appliedScaleLabel: string;
  boundsWidth: number;
  boundsHeight: number;
  fitWidth: number;
  fitHeight: number;
  utilizationX: number;
  utilizationY: number;
  candidateLines: string[];
};

export function measurePlanAnnotatedBounds(input: {
  model: ModulePlanModel;
  x: number;
  y: number;
  scale: number;
  presentation?: ModuleDrawingPresentation;
  displayMode?: ModuleDrawingDisplayMode;
  frame: PlanSheetFrame;
  includeHouseContext?: boolean;
  footprintEditor?: Partial<Pick<
    ModuleFootprintEditorProps,
    | 'customPolygonOverride'
    | 'customPolygonOpen'
    | 'customPolygonConfirmedPointCount'
    | 'customPolygonPreviewPointKind'
    | 'customPolygonCloseReady'
    | 'customPolygonCloseHovered'
    | 'customPolygonLandingPoint'
    | 'customPolygonLockedDistanceM'
    | 'hideHouseFootprint'
  >>;
}): AnnotatedBounds {
  const { model, x, y, scale, presentation = 'sheet', frame } = input;
  const includeHouseContext = input.includeHouseContext ?? true;
  const isHipCorner = model.roofType === 'hip_corner';
  const isGableLike = model.roofType === 'gable' || model.roofType === 'low_gable' || model.roofType === 'hip';
  const hasFullLengthRidge = hasFullLengthPlanRidge(model.roofType);
  const rotationTurns = planRotationTurnsForPresentation({
    roofType: model.roofType,
    drawingRotationQuarterTurns: model.drawingRotationQuarterTurns,
    presentation,
  });
  const rotationFrame = resolvePlanRotationFrame({
    x,
    y,
    width: model.lengthA * scale,
    height: model.spanA * scale,
    turns: rotationTurns,
  });
  const baseX = rotationFrame.baseX;
  const baseY = rotationFrame.baseY;
  const aW = model.lengthA * scale;
  const aH = model.spanA * scale;
  const bW = (model.lengthB ?? 0) * scale;
  const bH = (model.spanB ?? 0) * scale;
  const splitY = baseY + aH;
  const bottomY = splitY + bH;
  const topFrameW = memberSizeM(model.ledgerBeamWidthM, 0.05) * scale;
  const sideFrameW = memberSizeM(model.supportBeamWidthM, 0.05) * scale;
  const gutterW = memberSizeM(model.gutterWidthM, 0.1) * scale;
  const rafterW = memberSizeM(model.rafterWidthM, 0.05) * scale;
  const ridgeBandW = memberSizeM(model.ridgeBeamWidthM, 0.05) * scale;
  const ridgeBandX = baseX + sideFrameW;
  const ridgeBandWidth = Math.max(0, aW - sideFrameW * 2);
  const primaryPoints: Point[] = isHipCorner
    ? [
        { x: baseX, y: baseY },
        { x: baseX + aW, y: baseY },
        { x: baseX + aW, y: splitY },
        { x: baseX + bW, y: splitY },
        { x: baseX + bW, y: bottomY },
        { x: baseX, y: bottomY },
      ]
    : [
        { x: baseX, y: baseY },
        { x: baseX + aW, y: baseY },
        { x: baseX + aW, y: baseY + aH },
        { x: baseX, y: baseY + aH },
      ];
  const centerX = baseX + (isHipCorner ? Math.max(aW, bW) : aW) / 2;
  const centerY = baseY + (isHipCorner ? aH + bH : aH) / 2;
  const insetPoints = primaryPoints.map((point) => ({
    x: centerX + (point.x - centerX) * 0.92,
    y: centerY + (point.y - centerY) * 0.92,
  }));
  const hipInner = isHipCorner ? hipCornerInnerPoints(baseX, baseY, aW, bW, splitY, bottomY, Math.max(sideFrameW, topFrameW, gutterW)) : null;
  const gableMidY = baseY + aH / 2;
  const ridgeBandY = gableMidY - ridgeBandW / 2;
  const hipRidgeStartX = baseX + aW * 0.32;
  const hipRidgeEndX = baseX + aW * 0.68;
  const attachmentSide =
    model.houseConnectionType === 'none' || !model.supportsHouseFootprints || isHipCorner ? 'rear' : model.attachmentSide;
  const customPolygonOverrideActive = input.footprintEditor?.customPolygonOverride !== undefined;
  const hideHouseFootprint = Boolean(input.footprintEditor?.hideHouseFootprint);
  const showHouseFootprint = model.houseConnectionType !== 'none' && !hideHouseFootprint;
  const footprintRect = { x: baseX, y: baseY, width: aW, height: aH };
  const footprintCanvasLayout =
    (showHouseFootprint || customPolygonOverrideActive) && model.supportsHouseFootprints && !isHipCorner
      ? resolveFootprintCanvasLayout({
          model: { ...model, attachmentSide },
          rect: footprintRect,
          scale,
          rotationCenter: rotationFrame.center,
          rotationTurns: 0,
          customPolygonOverride: input.footprintEditor?.customPolygonOverride,
          customPolygonOpen: input.footprintEditor?.customPolygonOpen,
          customPolygonConfirmedPointCount: input.footprintEditor?.customPolygonConfirmedPointCount,
          customPolygonPreviewPointKind: input.footprintEditor?.customPolygonPreviewPointKind,
          customPolygonCloseReady: input.footprintEditor?.customPolygonCloseReady,
          customPolygonCloseHovered: input.footprintEditor?.customPolygonCloseHovered,
          customPolygonLandingPoint: input.footprintEditor?.customPolygonLandingPoint,
          customPolygonLockedDistanceM: input.footprintEditor?.customPolygonLockedDistanceM,
          hideHouseFootprint,
        })
      : null;
  const footprintBoundsPoints = includeHouseContext && footprintCanvasLayout
    ? [
        ...footprintCanvasLayout.polygon,
        ...footprintCanvasLayout.customVertices.map((vertex) => vertex.point),
        ...(footprintCanvasLayout.landingPoint ? [footprintCanvasLayout.landingPoint] : []),
      ]
    : [];
  const rafterXsA = projectLinearPositions(model.rafterPositionsA, model.rafterEdgeLengthM, baseX, aW);
  const rafterXsB = projectLinearPositions(model.rafterPositionsB ?? null, model.lengthB, baseX, bW);
  const interiorRafterXsA = interiorPlanRafterXs(rafterXsA);
  const interiorRafterXsB = interiorPlanRafterXs(rafterXsB);
  const footprintFrame = attachmentFrameForRect(attachmentSide, {
    x: baseX,
    y: baseY,
    width: Math.max(aW, bW),
    height: isHipCorner ? aH + bH : aH,
  });
  const soffitXs = projectLinearPositions(model.soffitBracketPositionsA, model.attachmentEdgeLengthM, 0, footprintFrame.length);
  const soffitGuideStart =
    soffitXs.length > 0 ? pointOnAttachmentFrame(footprintFrame, soffitXs[0]!, -1.2) : pointOnAttachmentFrame(footprintFrame, 0, -1.2);
  const soffitGuideEnd =
    soffitXs.length > 0
      ? pointOnAttachmentFrame(footprintFrame, soffitXs[soffitXs.length - 1]!, -1.2)
      : pointOnAttachmentFrame(footprintFrame, footprintFrame.length, -1.2);
  const soffitBracketLines = soffitXs.map((sx) => ({
    start: pointOnAttachmentFrame(footprintFrame, sx, -2.3),
    end: pointOnAttachmentFrame(footprintFrame, sx, 0.1),
  }));
  const semanticHouseSurfacePoints = includeHouseContext
    ? (model.houseContext?.surfaces ?? []).map((surface) =>
        surface.boundary.map((point) => planHousePointToSvg(point, baseX, baseY, scale)),
      )
    : [];
  const semanticHouseLines = includeHouseContext
    ? (model.houseContext?.lines ?? []).map((line) => ({
        start: planHousePointToSvg(line.line.start, baseX, baseY, scale),
        end: planHousePointToSvg(line.line.end, baseX, baseY, scale),
      }))
    : [];
  const fallIsHorizontal = attachmentSide === 'left' || attachmentSide === 'right';
  const fallAnchor =
    attachmentSide === 'rear' || attachmentSide === 'front'
      ? attachmentFrameForRect('right', {
          x: baseX + Math.max(aW, bW) + frame.fallGap - 0.55,
          y: baseY,
          width: 0,
          height: isHipCorner ? aH + bH : aH,
        })
      : attachmentFrameForRect('front', { x: baseX, y: (isHipCorner ? bottomY : baseY + aH) + frame.fallGap - 0.55, width: aW, height: 0 });
  const fallStart = pointOnAttachmentFrame(fallAnchor, 1.5, 0);
  const fallEnd = pointOnAttachmentFrame(fallAnchor, Math.max(1.5, fallAnchor.length - 1.5), 0);
  const fallLabelPoint = pointOnAttachmentFrame(fallAnchor, fallAnchor.length / 2, fallIsHorizontal ? 2.4 : 0.62);
  const dimensionOffsets = { bottom: 7.8, secondary: 5.4, tertiary: 6.15, side: 5.6, hipSide: 5.9 };
  const dimBaseY = bottomY + dimensionOffsets.bottom;
  const secondaryDimY = dimBaseY + dimensionOffsets.secondary;
  const rafterDimY = dimBaseY + dimensionOffsets.tertiary;
  const showPinnedSheetPrimaryDimensions = presentation === 'sheet' && !isHipCorner;
  const primaryDimensionSwap = showPinnedSheetPrimaryDimensions && rotationFrame.turns % 2 !== 0;
  const sheetFallAnnotationSpec =
    presentation === 'sheet'
      ? buildPlanFallAnnotationSpec({
          model,
          attachmentSide,
          isHipCorner,
          isGableLike,
          baseX,
          baseY,
          aW,
          aH,
          bW,
          bH,
          bottomY: isHipCorner ? bottomY : baseY + aH,
          fallGap: frame.fallGap,
          rotationCenter: rotationFrame.center,
          rotationTurns: rotationFrame.turns,
          isSheet: true,
        })
      : null;
  const yTopInner = baseY + topFrameW;
  const yBottomInner = baseY + aH - gutterW;
  const sheetSpacingAnnotationSpec =
    presentation === 'sheet'
      ? buildPlanRafterSpacingAnnotationSpec({
          rafterXsA,
          interiorRafterXsA,
          splitY,
          gutterW,
          yBottomInner,
          rafterDimY,
          isHipCorner,
          rotationCenter: rotationFrame.center,
          rotationTurns: rotationFrame.turns,
          label: `${formatMetres(model.rafterSpacingA)} c/c`,
        })
      : null;
  const sheetInternalAngleAnnotationSpec =
    presentation === 'sheet' && model.boxPerimeterEnabled
      ? buildPlanInternalAngleAnnotationSpec({
          centerX,
          centerY,
          baseY,
          bottomY,
          aH,
          isHipCorner,
          rotationCenter: rotationFrame.center,
          rotationTurns: rotationFrame.turns,
        })
      : null;
  const overhangFrameDepth = isHipCorner ? bH : aH;
  const overhangDepth = model.overhangEnabled
    ? Math.min(Math.max(0, model.overhangAmountM * scale), Math.max(0, overhangFrameDepth - topFrameW - gutterW))
    : 0;
  const overhangY = isHipCorner ? bottomY - overhangDepth : baseY + aH - overhangDepth;
  const overhangWidth = Math.max(0, (isHipCorner ? bW : aW) - sideFrameW * 2);
  const overhangX = baseX + sideFrameW;
  const spacingBounds =
    rafterXsA.length >= 2
      ? (() => {
          const spacingXs = interiorRafterXsA.length >= 2 ? interiorRafterXsA : rafterXsA;
          const baseIdx = Math.max(0, Math.floor((spacingXs.length - 2) / 2));
          const d1 = spacingXs[baseIdx]!;
          const d2 = spacingXs[baseIdx + 1]!;
          return unionBounds([
            boundsFromLine(d1, isHipCorner ? splitY - gutterW : yBottomInner, d1, rafterDimY, 0.2),
            boundsFromLine(d2, isHipCorner ? splitY - gutterW : yBottomInner, d2, rafterDimY, 0.2),
            estimateTickDimensionBounds({
              x1: d1,
              y1: rafterDimY,
              x2: d2,
              y2: rafterDimY,
              label: `${formatMetres(model.rafterSpacingA)} c/c`,
              textY: rafterDimY - 1.8,
              presentation,
            }),
          ]);
        })()
      : null;

  const localBounds = [
    ...semanticHouseSurfacePoints.map((points) => boundsFromPoints(points, 0.25)),
    ...semanticHouseLines.map((line) => boundsFromLine(line.start.x, line.start.y, line.end.x, line.end.y, 0.25)),
    presentation === 'model' && footprintBoundsPoints.length > 0 ? boundsFromPoints(footprintBoundsPoints, 0.35) : null,
    boundsFromPoints(primaryPoints, 0.35),
    hipInner ? boundsFromPoints(hipInner, 0.35) : null,
    model.boxPerimeterEnabled ? boundsFromPoints(insetPoints, 0.35) : null,
    hasFullLengthRidge && ridgeBandWidth > 0 ? boundsFromRect(ridgeBandX, ridgeBandY, ridgeBandWidth, ridgeBandW) : null,
    model.roofType === 'hip' ? boundsFromLine(baseX, baseY, hipRidgeStartX, gableMidY, 0.3) : null,
    model.roofType === 'hip' ? boundsFromLine(baseX + aW, baseY, hipRidgeEndX, gableMidY, 0.3) : null,
    model.roofType === 'hip' ? boundsFromLine(baseX, baseY + aH, hipRidgeStartX, gableMidY, 0.3) : null,
    model.roofType === 'hip' ? boundsFromLine(baseX + aW, baseY + aH, hipRidgeEndX, gableMidY, 0.3) : null,
    isHipCorner ? boundsFromLine(baseX, splitY, baseX + bW, splitY, 0.25) : null,
    ...interiorRafterXsA.map((rx) => boundsFromRect(rx - rafterW / 2, yTopInner, rafterW, Math.max(0.2, (isHipCorner ? splitY - gutterW : yBottomInner) - yTopInner))),
    ...interiorRafterXsB.map((rx) =>
      boundsFromRect(rx - rafterW / 2, splitY + topFrameW, rafterW, Math.max(0.2, bottomY - gutterW - (splitY + topFrameW))),
    ),
    model.houseConnectionType === 'soffit' && soffitXs.length > 0
      ? boundsFromLine(soffitGuideStart.x, soffitGuideStart.y, soffitGuideEnd.x, soffitGuideEnd.y, 0.25)
      : null,
    ...soffitBracketLines.map((line) => boundsFromLine(line.start.x, line.start.y, line.end.x, line.end.y, 0.25)),
    model.overhangEnabled && overhangDepth > 0 ? boundsFromRect(overhangX, overhangY, overhangWidth, overhangDepth) : null,
    presentation === 'sheet' ? null : boundsFromLine(fallStart.x, fallStart.y, fallEnd.x, fallEnd.y, 0.25),
    presentation !== 'sheet' && isGableLike
      ? estimateArrowHeadBounds({
          x: fallStart.x,
          y: fallStart.y,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : 'up',
          presentation,
        })
      : null,
    presentation !== 'sheet' && isGableLike
      ? estimateArrowHeadBounds({
          x: fallEnd.x,
          y: fallEnd.y,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'right' : 'left') : 'down',
          presentation,
        })
      : null,
    presentation !== 'sheet' && !isGableLike
      ? estimateArrowHeadBounds({
          x: model.slopeDirection === 'toward_house' ? fallStart.x : fallEnd.x,
          y: model.slopeDirection === 'toward_house' ? fallStart.y : fallEnd.y,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : model.slopeDirection === 'toward_house' ? 'up' : 'down',
          presentation,
        })
      : null,
    presentation === 'sheet'
      ? null
      : estimateTextBounds({
          text: isGableLike ? 'fall both sides' : 'fall',
          x: fallLabelPoint.x,
          y: fallLabelPoint.y,
          anchor: 'start',
          fontHeight: 1.8,
          charWidth: 0.58,
          paddingX: 0.2,
          paddingY: 0.18,
        }),
    ...(showPinnedSheetPrimaryDimensions
      ? []
      : [
          boundsFromLine(baseX, isHipCorner ? bottomY : baseY + aH, baseX, dimBaseY, 0.2),
          boundsFromLine(baseX + aW, isHipCorner ? splitY : baseY + aH, baseX + aW, dimBaseY, 0.2),
          estimateTickDimensionBounds({ x1: baseX, y1: dimBaseY, x2: baseX + aW, y2: dimBaseY, label: formatMetres(model.lengthA), presentation }),
          boundsFromLine(baseX, baseY, baseX - dimensionOffsets.side, baseY, 0.2),
          boundsFromLine(baseX, baseY + aH, baseX - dimensionOffsets.side, baseY + aH, 0.2),
          estimateTickDimensionBounds({
            x1: baseX - dimensionOffsets.side,
            y1: baseY,
            x2: baseX - dimensionOffsets.side,
            y2: baseY + aH,
            label: formatMetres(model.spanA),
            presentation,
          }),
        ]),
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX, bottomY, baseX, secondaryDimY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX + bW, bottomY, baseX + bW, secondaryDimY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB
      ? estimateTickDimensionBounds({
          x1: baseX,
          y1: secondaryDimY,
          x2: baseX + bW,
          y2: secondaryDimY,
          label: formatMetres(model.lengthB),
          presentation,
        })
      : null,
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX + bW, splitY, baseX + bW + dimensionOffsets.hipSide, splitY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX + bW, bottomY, baseX + bW + dimensionOffsets.hipSide, bottomY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB
      ? estimateTickDimensionBounds({
          x1: baseX + bW + dimensionOffsets.hipSide,
          y1: splitY,
          x2: baseX + bW + dimensionOffsets.hipSide,
          y2: bottomY,
          label: formatMetres(model.spanB),
          presentation,
        })
      : null,
    presentation === 'sheet' ? null : spacingBounds,
    presentation === 'sheet' || !model.boxPerimeterEnabled ? null : boundsFromLine(centerX, baseY + 2.8, centerX, (isHipCorner ? bottomY : baseY + aH) - 2.8, 0.2),
    presentation === 'sheet' || !model.boxPerimeterEnabled
      ? null
      : estimateTextBounds({
          text: 'internal roof angle',
          x: centerX + 2.5,
          y: centerY + 0.5,
          anchor: 'start',
          fontHeight: 1.55,
          charWidth: 0.54,
          paddingX: 0.15,
          paddingY: 0.15,
        }),
  ];

  const rotatedLocalBounds =
    rotationFrame.turns === 0
      ? unionBounds(localBounds)
      : unionBounds(localBounds.map((bounds) => (bounds ? rotateBoundsQuarterTurns(bounds, rotationFrame.center, rotationFrame.turns) : null)));
  const sheetAnnotationBounds = unionBounds([
    sheetFallAnnotationSpec ? estimatePlanFallAnnotationBounds(sheetFallAnnotationSpec, presentation) : null,
    sheetSpacingAnnotationSpec ? estimatePlanSpacingAnnotationBounds(sheetSpacingAnnotationSpec, presentation) : null,
    sheetInternalAngleAnnotationSpec ? estimatePlanLineTextAnnotationBounds(sheetInternalAngleAnnotationSpec) : null,
  ]);

  if (!showPinnedSheetPrimaryDimensions) {
    return unionBounds([rotatedLocalBounds, sheetAnnotationBounds]);
  }

  const rotatedPrimaryPoints =
    rotationFrame.turns === 0 ? primaryPoints : rotatePointsQuarterTurns(primaryPoints, rotationFrame.center, rotationFrame.turns);
  const rotatedPrimaryBounds = boundsFromPoints(rotatedPrimaryPoints);

  return unionBounds([
    rotatedLocalBounds,
    sheetAnnotationBounds,
    estimatePinnedSheetPlanPrimaryDimensionBounds({
      rotatedPrimaryBounds,
      dimensionOffsets,
      bottomLabel: formatMetres(primaryDimensionSwap ? model.spanA : model.lengthA),
      leftLabel: formatMetres(primaryDimensionSwap ? model.lengthA : model.spanA),
      presentation,
    }),
  ]);
}

export function measurePlanModelSpaceFocusBounds(input: {
  model: ModulePlanModel;
  x: number;
  y: number;
  scale: number;
  displayMode?: ModuleDrawingDisplayMode;
}): AnnotatedBounds {
  const { model, x, y, scale, displayMode = 'pergolas' } = input;
  const isHipCorner = model.roofType === 'hip_corner';
  const hasFullLengthRidge = hasFullLengthPlanRidge(model.roofType);
  const rotationFrame = resolvePlanRotationFrame({
    x,
    y,
    width: model.lengthA * scale,
    height: model.spanA * scale,
    turns: 0,
  });
  const baseX = rotationFrame.baseX;
  const baseY = rotationFrame.baseY;
  const aW = model.lengthA * scale;
  const aH = model.spanA * scale;
  const bW = (model.lengthB ?? 0) * scale;
  const bH = (model.spanB ?? 0) * scale;
  const splitY = baseY + aH;
  const bottomY = splitY + bH;
  const topFrameW = memberSizeM(model.ledgerBeamWidthM, 0.05) * scale;
  const sideFrameW = memberSizeM(model.supportBeamWidthM, 0.05) * scale;
  const gutterW = memberSizeM(model.gutterWidthM, 0.1) * scale;
  const rafterW = memberSizeM(model.rafterWidthM, 0.05) * scale;
  const ridgeBandW = memberSizeM(model.ridgeBeamWidthM, 0.05) * scale;
  const primaryPoints: Point[] = isHipCorner
    ? [
        { x: baseX, y: baseY },
        { x: baseX + aW, y: baseY },
        { x: baseX + aW, y: splitY },
        { x: baseX + bW, y: splitY },
        { x: baseX + bW, y: bottomY },
        { x: baseX, y: bottomY },
      ]
    : [
        { x: baseX, y: baseY },
        { x: baseX + aW, y: baseY },
        { x: baseX + aW, y: baseY + aH },
        { x: baseX, y: baseY + aH },
      ];
  const centerX = baseX + (isHipCorner ? Math.max(aW, bW) : aW) / 2;
  const centerY = baseY + (isHipCorner ? aH + bH : aH) / 2;
  const insetPoints = primaryPoints.map((point) => ({
    x: centerX + (point.x - centerX) * 0.92,
    y: centerY + (point.y - centerY) * 0.92,
  }));
  const hipInner = isHipCorner ? hipCornerInnerPoints(baseX, baseY, aW, bW, splitY, bottomY, Math.max(sideFrameW, topFrameW, gutterW)) : null;
  const gableMidY = baseY + aH / 2;
  const ridgeBandY = gableMidY - ridgeBandW / 2;
  const hipRidgeStartX = baseX + aW * 0.32;
  const hipRidgeEndX = baseX + aW * 0.68;
  const ridgeBandX = baseX + sideFrameW;
  const ridgeBandWidth = Math.max(0, aW - sideFrameW * 2);
  const overhangFrameDepth = isHipCorner ? bH : aH;
  const overhangDepth = model.overhangEnabled
    ? Math.min(Math.max(0, model.overhangAmountM * scale), Math.max(0, overhangFrameDepth - topFrameW - gutterW))
    : 0;
  const overhangY = isHipCorner ? bottomY - overhangDepth : baseY + aH - overhangDepth;
  const overhangWidth = Math.max(0, (isHipCorner ? bW : aW) - sideFrameW * 2);
  const overhangX = baseX + sideFrameW;
  const rafterXsA = projectLinearPositions(model.rafterPositionsA, model.rafterEdgeLengthM, baseX, aW);
  const rafterXsB = projectLinearPositions(model.rafterPositionsB ?? null, model.lengthB, baseX, bW);
  const interiorRafterXsA = interiorPlanRafterXs(rafterXsA);
  const interiorRafterXsB = interiorPlanRafterXs(rafterXsB);
  const semanticHouseSurfacePoints =
    displayMode === 'house'
      ? (model.houseContext?.surfaces ?? []).map((surface) =>
          surface.boundary.map((point) => planHousePointToSvg(point, baseX, baseY, scale)),
        )
      : [];
  const semanticHouseLines =
    displayMode === 'house'
      ? (model.houseContext?.lines ?? []).map((line) => ({
          start: planHousePointToSvg(line.line.start, baseX, baseY, scale),
          end: planHousePointToSvg(line.line.end, baseX, baseY, scale),
        }))
      : [];
  const yTopInner = baseY + topFrameW;
  const yBottomInner = baseY + aH - gutterW;
  const dimensionOffsets = { bottom: 7.8, secondary: 5.4, side: 5.6, hipSide: 5.9 };
  const dimBaseY = bottomY + dimensionOffsets.bottom;
  const secondaryDimY = dimBaseY + dimensionOffsets.secondary;

  const localBounds = unionBounds([
    ...semanticHouseSurfacePoints.map((points) => boundsFromPoints(points, 0.25)),
    ...semanticHouseLines.map((line) => boundsFromLine(line.start.x, line.start.y, line.end.x, line.end.y, 0.25)),
    boundsFromPoints(primaryPoints, 0.35),
    hipInner ? boundsFromPoints(hipInner, 0.35) : null,
    model.boxPerimeterEnabled ? boundsFromPoints(insetPoints, 0.35) : null,
    hasFullLengthRidge && ridgeBandWidth > 0 ? boundsFromRect(ridgeBandX, ridgeBandY, ridgeBandWidth, ridgeBandW) : null,
    model.roofType === 'hip' ? boundsFromLine(baseX, baseY, hipRidgeStartX, gableMidY, 0.3) : null,
    model.roofType === 'hip' ? boundsFromLine(baseX + aW, baseY, hipRidgeEndX, gableMidY, 0.3) : null,
    model.roofType === 'hip' ? boundsFromLine(baseX, baseY + aH, hipRidgeStartX, gableMidY, 0.3) : null,
    model.roofType === 'hip' ? boundsFromLine(baseX + aW, baseY + aH, hipRidgeEndX, gableMidY, 0.3) : null,
    isHipCorner ? boundsFromLine(baseX, splitY, baseX + bW, splitY, 0.25) : null,
    ...interiorRafterXsA.map((rx) => boundsFromRect(rx - rafterW / 2, yTopInner, rafterW, Math.max(0.2, (isHipCorner ? splitY - gutterW : yBottomInner) - yTopInner))),
    ...interiorRafterXsB.map((rx) =>
      boundsFromRect(rx - rafterW / 2, splitY + topFrameW, rafterW, Math.max(0.2, bottomY - gutterW - (splitY + topFrameW))),
    ),
    model.overhangEnabled && overhangDepth > 0 ? boundsFromRect(overhangX, overhangY, overhangWidth, overhangDepth) : null,
    boundsFromLine(baseX, isHipCorner ? bottomY : baseY + aH, baseX, dimBaseY, 0.2),
    boundsFromLine(baseX + aW, isHipCorner ? splitY : baseY + aH, baseX + aW, dimBaseY, 0.2),
    estimateTickDimensionBounds({ x1: baseX, y1: dimBaseY, x2: baseX + aW, y2: dimBaseY, label: formatMetres(model.lengthA), presentation: 'model' }),
    boundsFromLine(baseX, baseY, baseX - dimensionOffsets.side, baseY, 0.2),
    boundsFromLine(baseX, baseY + aH, baseX - dimensionOffsets.side, baseY + aH, 0.2),
    estimateTickDimensionBounds({
      x1: baseX - dimensionOffsets.side,
      y1: baseY,
      x2: baseX - dimensionOffsets.side,
      y2: baseY + aH,
      label: formatMetres(model.spanA),
      presentation: 'model',
    }),
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX, bottomY, baseX, secondaryDimY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX + bW, bottomY, baseX + bW, secondaryDimY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB
      ? estimateTickDimensionBounds({ x1: baseX, y1: secondaryDimY, x2: baseX + bW, y2: secondaryDimY, label: formatMetres(model.lengthB), presentation: 'model' })
      : null,
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX + bW, splitY, baseX + bW + dimensionOffsets.hipSide, splitY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX + bW, bottomY, baseX + bW + dimensionOffsets.hipSide, bottomY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB
      ? estimateTickDimensionBounds({
          x1: baseX + bW + dimensionOffsets.hipSide,
          y1: splitY,
          x2: baseX + bW + dimensionOffsets.hipSide,
          y2: bottomY,
          label: formatMetres(model.spanB),
          presentation: 'model',
        })
      : null,
  ]);

  if (rotationFrame.turns === 0) {
    return localBounds;
  }
  return rotateBoundsQuarterTurns(localBounds, rotationFrame.center, rotationFrame.turns);
}

export function resolvePlanSheetLayoutForScale(input: {
  model: ModulePlanModel;
  scale: number;
}): ResolvedSheetLayout {
  const frame = getPlanSheetFrame(input.model.roofType === 'hip_corner');
  const total = getPlanRealExtents(input.model);
  const totalW = total.widthM;
  const totalH = total.heightM;
  const initial = resolvePlanFitBox(totalW, totalH, 'sheet', input.model.roofType === 'hip_corner');
  let x = initial.x;
  let y = initial.y;
  let bounds = measurePlanAnnotatedBounds({ model: input.model, x, y, scale: input.scale, frame });
  for (let idx = 0; idx < 2; idx += 1) {
    const offset = resolveBoundsPlacement(bounds, frame.fitArea, frame.verticalBias);
    x += offset.dx;
    y += offset.dy;
    bounds = measurePlanAnnotatedBounds({ model: input.model, x, y, scale: input.scale, frame });
  }

  return {
    outerField: frame.outerField,
    fitArea: frame.fitArea,
    annotatedBounds: bounds,
    x,
    y,
    scale: input.scale,
    houseBandHeight: frame.houseBandHeight,
    houseBandOffset: frame.houseBandOffset,
    houseInset: frame.houseInset,
    fallGap: frame.fallGap,
  };
}

export function resolvePlanSheetLayout(input: {
  model: ModulePlanModel;
  drawingScale: EstimateDrawingScale;
  viewportMm?: { widthMm: number; heightMm: number };
}): ResolvedSheetLayout {
  if (input.drawingScale.mode === 'fixed') {
    return resolvePlanSheetLayoutForScale({
      model: input.model,
      scale: getViewBoxUnitsPerMetreAtScale(input.drawingScale.ratio, input.viewportMm),
    });
  }

  const total = getPlanRealExtents(input.model);
  return resolveMeasuredFitLayout({
    initialScale: resolvePlanFitBox(total.widthM, total.heightM, 'sheet', input.model.roofType === 'hip_corner').scale,
    resolveForScale: (scale) => resolvePlanSheetLayoutForScale({ model: input.model, scale }),
  });
}

export function getPlanModelSpaceFrame(isHipCorner: boolean): PlanSheetFrame {
  return {
    ...getPlanSheetFrame(isHipCorner),
    outerField: { x: 0, y: 0, width: 0, height: 0 },
    fitArea: { x: 0, y: 0, width: 0, height: 0 },
    houseBandHeight: 10,
    houseBandOffset: 2.1,
    houseInset: 2.4,
    fallGap: 7,
  };
}

export function resolvePlanModelSpaceLayout(
  model: ModulePlanModel,
  footprintEditor?: Partial<Pick<
    ModuleFootprintEditorProps,
    | 'customPolygonOverride'
    | 'customPolygonOpen'
    | 'customPolygonConfirmedPointCount'
    | 'customPolygonPreviewPointKind'
    | 'customPolygonCloseReady'
    | 'customPolygonCloseHovered'
    | 'customPolygonLandingPoint'
    | 'customPolygonLockedDistanceM'
    | 'hideHouseFootprint'
  >>,
  options?: {
    displayMode?: ModuleDrawingDisplayMode;
    topProjection?: GeometryTopProjectionViewModel | null;
  },
): ResolvedModelSpaceLayout {
  const frame = getPlanModelSpaceFrame(model.roofType === 'hip_corner');
  const scale = MODEL_SPACE_UNITS_PER_METRE;
  const x = 0;
  const y = 0;
  const legacyAnnotatedBounds = measurePlanAnnotatedBounds({
    model,
    x,
    y,
    scale,
    presentation: 'model',
    displayMode: options?.displayMode,
    frame,
    footprintEditor,
  });
  const legacyFocusBounds = measurePlanModelSpaceFocusBounds({
    model,
    x,
    y,
    scale,
    displayMode: options?.displayMode,
  });
  const topProjectionFocusBounds = topProjectionExtentsToModelSpaceBounds(options?.topProjection, scale);
  const focusBounds = topProjectionFocusBounds ?? legacyFocusBounds;
  const annotatedBounds = topProjectionFocusBounds
    ? unionBounds([legacyAnnotatedBounds, topProjectionFocusBounds])
    : legacyAnnotatedBounds;
  const svgMetrics = resolveModelSpaceSvgMetrics(focusBounds);
  const focusMetrics = resolveModelSpaceFocusMetrics(focusBounds);
  const worldMetrics = resolveModelSpaceWorldMetrics(annotatedBounds);

  return {
    outerField: svgMetrics.viewBox,
    fitArea: svgMetrics.viewBox,
    annotatedBounds,
    x,
    y,
    scale,
    houseBandHeight: frame.houseBandHeight,
    houseBandOffset: frame.houseBandOffset,
    houseInset: frame.houseInset,
    fallGap: frame.fallGap,
    ...svgMetrics,
    ...focusMetrics,
    ...worldMetrics,
  };
}

export function measureSectionAnnotatedBounds(input: {
  model: ModuleSectionModel;
  xLeft: number;
  yGround: number;
  scale: number;
  presentation?: ModuleDrawingPresentation;
  includeHouseContext?: boolean;
}): AnnotatedBounds {
  const { model, xLeft, yGround, scale, presentation = 'sheet' } = input;
  const isSheet = presentation === 'sheet';
  const isModel = presentation === 'model';
  const includeHouseContext = input.includeHouseContext ?? true;
  const overhangM = sectionOverhangM(model);
  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const ledgerBeamDepthM = sectionLedgerBeamDepthM(model);
  const ledgerBeamWidthM = sectionLedgerBeamWidthM(model);
  const supportBeamDepthM = sectionSupportBeamDepthM(model);
  const supportBeamWidthM = sectionSupportBeamWidthM(model);
  const tieBeamDepthM = sectionSupportBeamDepthM(model);
  const tieBeamWidthM = sectionSupportBeamWidthM(model);
  const ridgeBeamDepthM = sectionRidgeBeamDepthM(model);
  const ridgeBeamWidthM = sectionRidgeBeamWidthM(model);
  const leftEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : ledgerBeamDepthM;
  const leftEaveBeamWidthM = model.sectionKind === 'gable' ? model.gutterWidthM : ledgerBeamWidthM;
  const rightEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : supportBeamDepthM;
  const rightEaveBeamWidthM = model.sectionKind === 'gable' ? model.gutterWidthM : supportBeamWidthM;
  const outerGutterUndersideM = sectionOuterGutterUndersideM(model);
  const supportUndersideM = sectionSupportUndersideM(model);
  const rafterPlumbCutDropM = sectionRafterPlumbCutDropM(model);
  const houseLedgerUndersideM = model.leftEdgeHeightM;
  const houseRafterUndersideM = houseLedgerUndersideM + leftEaveBeamDepthM - rafterPlumbCutDropM;
  const outerRafterUndersideM = outerGutterUndersideM + model.gutterDepthM - rafterPlumbCutDropM;
  const supportRafterUndersideM =
    model.sectionKind === 'mono'
      ? sectionMonoRafterUndersideAtM(model, supportXFromHouseM)
      : model.rightEdgeHeightM + rightEaveBeamDepthM - rafterPlumbCutDropM;
  const supportBeamTopM = supportUndersideM + supportBeamDepthM;
  const postW = memberSizeM(model.postWidthM, 0.1) * scale;
  const rafterDepth = memberSizeM(model.rafterDepthM, 0.15) * scale;
  const gutterWidth = memberSizeM(model.gutterWidthM, 0.1) * scale;
  const leftEaveDepth = leftEaveBeamDepthM * scale;
  const leftEaveWidth = leftEaveBeamWidthM * scale;
  const supportCapDepth = supportBeamDepthM * scale;
  const supportCapWidth = supportBeamWidthM * scale;
  const tieBeamDepth = tieBeamDepthM * scale;
  const kingStrutWidth = tieBeamWidthM * scale;
  const rightEaveBeamDepth = rightEaveBeamDepthM * scale;
  const rightEaveBeamWidth = rightEaveBeamWidthM * scale;
  const ridgeBeamWidth = ridgeBeamWidthM * scale;
  const xRight = xLeft + model.spanA * scale;
  const xSupport = model.sectionKind === 'mono' ? xLeft + supportXFromHouseM * scale : xRight;
  const ridgeX = (xLeft + xRight) / 2;
  const yForHeight = (heightM: number) => yGround - Math.max(0, heightM) * scale;
  const yHouseUnder = yForHeight(houseLedgerUndersideM);
  const ySupportUnder = yForHeight(model.sectionKind === 'mono' ? supportUndersideM : model.rightEdgeHeightM);
  const yOuterGutterUnder = yForHeight(outerGutterUndersideM);
  const yHouseRafterUnder = yForHeight(houseRafterUndersideM);
  const yOuterRafterUnder = yForHeight(outerRafterUndersideM);
  const yOuterGutterTop = yForHeight(outerGutterUndersideM + model.gutterDepthM);
  const yRightEaveRafterUnder = yForHeight(model.rightEdgeHeightM + rightEaveBeamDepthM - rafterPlumbCutDropM);
  const ySupportBeamTop = yForHeight(supportBeamTopM);
  const yRidgeUnder = typeof model.ridgeHeightM === 'number' ? yForHeight(model.ridgeHeightM) : null;
  const yRidgeBeamTop = typeof model.ridgeHeightM === 'number' ? yForHeight(model.ridgeHeightM + ridgeBeamDepthM) : null;
  const tieBeamTopY = yHouseUnder;
  const tieBeamBottomY = Math.min(yGround - 0.4, tieBeamTopY + tieBeamDepth);
  const supportPostTopY = ySupportUnder;
  const supportCapTopY = ySupportBeamTop;
  const gutterTopY = yOuterGutterTop;
  const ledgerX = xLeft;
  const ledgerY = yForHeight(houseLedgerUndersideM + leftEaveBeamDepthM);
  const rightEaveX = xRight - rightEaveBeamWidth;
  const rightEaveY = yForHeight(model.rightEdgeHeightM + rightEaveBeamDepthM);
  const leftPostX = xLeft;
  const secondPostX = model.sectionKind === 'mono' ? (overhangM > 0 ? xSupport - postW / 2 : xRight - postW) : xRight - postW;
  const monoRafterStartX = ledgerX + leftEaveWidth;
  const monoRafterEndX = xRight - gutterWidth;
  const gableLeftRafterStartX = ledgerX + leftEaveWidth;
  const gableRightRafterEndX = xRight - rightEaveBeamWidth;
  const leftDimX = xLeft - 9.8;
  const rightDimX = xRight + 10.6;
  const spanAnchorLeftY = yHouseUnder;
  const spanAnchorSupportY = ySupportUnder;
  const spanAnchorRightY = yOuterGutterUnder;
  const spanDatumY = Math.max(spanAnchorLeftY, spanAnchorSupportY, spanAnchorRightY);
  const spanDimY = Math.max(yGround + 10.9, spanDatumY + 9.4);
  const overhangDimY = Math.max(spanAnchorRightY + 4.9, spanDimY - 5.8);
  const pitchLabelY = spanDimY + 6.2;
  const metaLabelY = pitchLabelY - 3.2;
  const roofLengthLabelGap = 1.6;
  const mainRoofNormal = segmentDownNormal(monoRafterStartX, yHouseRafterUnder, monoRafterEndX, yOuterRafterUnder);
  const ridgeLeftX = ridgeX - ridgeBeamWidth / 2;
  const ridgeRightX = ridgeX + ridgeBeamWidth / 2;
  const monoRoofGeom = model.sectionKind === 'mono' ? sectionMemberPolygonPlumbCuts(monoRafterStartX, yHouseRafterUnder, monoRafterEndX, yOuterRafterUnder, rafterDepth) : null;
  const gableLeftRoofGeom = model.sectionKind === 'gable' && yRidgeUnder !== null ? sectionMemberPolygonPlumbCuts(gableLeftRafterStartX, yHouseRafterUnder, ridgeLeftX, yRidgeUnder, rafterDepth) : null;
  const gableRightRoofGeom = model.sectionKind === 'gable' && yRidgeUnder !== null ? sectionMemberPolygonPlumbCuts(ridgeRightX, yRidgeUnder, gableRightRafterEndX, yRightEaveRafterUnder, rafterDepth) : null;
  const monoSupportSplice =
    model.sectionKind === 'mono' && overhangM > 0 && monoRoofGeom && monoRafterEndX - monoRafterStartX > 1e-6
      ? (() => {
          const t = clamp((xSupport - monoRafterStartX) / (monoRafterEndX - monoRafterStartX), 0, 1);
          const yUnder = yHouseRafterUnder + (yOuterRafterUnder - yHouseRafterUnder) * t;
          const topStart = monoRoofGeom.points[3]!;
          const topEnd = monoRoofGeom.points[2]!;
          const yTop = topStart.y + (topEnd.y - topStart.y) * t;
          return { yTop, yUnder };
        })()
      : null;
  const semanticHouseSurfacePoints = includeHouseContext
    ? (model.houseContext?.surfaces ?? []).map((surface) => surface.boundary.map((point) => sectionHousePointToSvg(point, xLeft, yGround, scale)))
    : [];
  const semanticHouseLines = includeHouseContext
    ? (model.houseContext?.lines ?? []).map((line) => ({
        start: sectionHousePointToSvg(line.line.start, xLeft, yGround, scale),
        end: sectionHousePointToSvg(line.line.end, xLeft, yGround, scale),
      }))
    : [];
  const depthDimAlongRoof = 0.18;
  const depthDimUnderX = monoRafterStartX + (monoRafterEndX - monoRafterStartX) * depthDimAlongRoof;
  const depthDimUnderY = yHouseRafterUnder + (yOuterRafterUnder - yHouseRafterUnder) * depthDimAlongRoof;
  const depthDimTop: Point = {
    x: depthDimUnderX - mainRoofNormal.nx * rafterDepth,
    y: depthDimUnderY - mainRoofNormal.ny * rafterDepth,
  };
  const depthDimBottom: Point = { x: depthDimUnderX, y: depthDimUnderY };
  const roofTopLengthDims = (() => {
    const offset = model.sectionKind === 'gable' ? 4.8 : 4.2;
    if (model.sectionKind === 'mono' && monoRoofGeom) {
      const topStart = monoRoofGeom.points[3]!;
      const topEnd = monoRoofGeom.points[2]!;
      const dimStart: Point = {
        x: topStart.x - mainRoofNormal.nx * offset,
        y: topStart.y - mainRoofNormal.ny * offset,
      };
      const dimEnd: Point = {
        x: topEnd.x - mainRoofNormal.nx * offset,
        y: topEnd.y - mainRoofNormal.ny * offset,
      };
      const lengthM = Math.hypot((topEnd.x - topStart.x) / scale, (topEnd.y - topStart.y) / scale);
      return [{ topStart, topEnd, dimStart, dimEnd, lengthM }];
    }
    if (model.sectionKind === 'gable' && gableLeftRoofGeom && gableRightRoofGeom) {
      const leftTopStart = gableLeftRoofGeom.points[3]!;
      const leftTopEnd = gableLeftRoofGeom.points[2]!;
      const rightTopStart = gableRightRoofGeom.points[3]!;
      const rightTopEnd = gableRightRoofGeom.points[2]!;
      const leftNormal = segmentDownNormal(leftTopStart.x, leftTopStart.y, leftTopEnd.x, leftTopEnd.y);
      const rightNormal = segmentDownNormal(rightTopStart.x, rightTopStart.y, rightTopEnd.x, rightTopEnd.y);
      const leftDimStart: Point = {
        x: leftTopStart.x - leftNormal.nx * offset,
        y: leftTopStart.y - leftNormal.ny * offset,
      };
      const leftDimEnd: Point = {
        x: leftTopEnd.x - leftNormal.nx * offset,
        y: leftTopEnd.y - leftNormal.ny * offset,
      };
      const rightDimStart: Point = {
        x: rightTopStart.x - rightNormal.nx * offset,
        y: rightTopStart.y - rightNormal.ny * offset,
      };
      const rightDimEnd: Point = {
        x: rightTopEnd.x - rightNormal.nx * offset,
        y: rightTopEnd.y - rightNormal.ny * offset,
      };
      const leftLengthM = Math.hypot((leftTopEnd.x - leftTopStart.x) / scale, (leftTopEnd.y - leftTopStart.y) / scale);
      const rightLengthM = Math.hypot((rightTopEnd.x - rightTopStart.x) / scale, (rightTopEnd.y - rightTopStart.y) / scale);
      return [
        { topStart: leftTopStart, topEnd: leftTopEnd, dimStart: leftDimStart, dimEnd: leftDimEnd, lengthM: leftLengthM },
        { topStart: rightTopStart, topEnd: rightTopEnd, dimStart: rightDimStart, dimEnd: rightDimEnd, lengthM: rightLengthM },
      ];
    }
    return [];
  })();
  const groundLeftX = isModel ? xLeft - 8 : Math.max(8, xLeft - 8);
  const groundRightX = isModel ? xRight + 8 : Math.min(104, xRight + 8);
  const groundLineRightX = isModel ? xRight + 8 : Math.min(112, xRight + 8);

  return unionBounds([
    ...semanticHouseSurfacePoints.map((points) => boundsFromPoints(points, 0.25)),
    ...semanticHouseLines.map((line) => boundsFromLine(line.start.x, line.start.y, line.end.x, line.end.y, 0.25)),
    boundsFromRect(groundLeftX, yGround + 1.3, groundRightX - groundLeftX, 8),
    boundsFromLine(groundLeftX, yGround, groundLineRightX, yGround, 0.25),
    boundsFromRect(leftPostX, yHouseUnder, postW, yGround - yHouseUnder),
    boundsFromRect(secondPostX, supportPostTopY, postW, yGround - supportPostTopY),
    boundsFromRect(ledgerX, ledgerY, leftEaveWidth, leftEaveDepth),
    model.houseConnectionType === 'facade' || model.houseConnectionType === 'fascia'
      ? boundsFromLine(ledgerX - 1.1, yHouseUnder - 2.2, ledgerX - 1.1, yGround, 0.2)
      : null,
    model.houseConnectionType === 'fascia' ? boundsFromLine(ledgerX - 1.1, ledgerY - 0.9, ledgerX + leftEaveWidth, ledgerY - 0.9, 0.2) : null,
    model.houseConnectionType === 'soffit' ? boundsFromLine(ledgerX - 0.25, ledgerY - 1.25, ledgerX + leftEaveWidth, ledgerY - 1.25, 0.2) : null,
    model.sectionKind === 'mono' && overhangM > 0 ? boundsFromRect(xSupport - supportCapWidth / 2, supportCapTopY, supportCapWidth, supportCapDepth) : null,
    model.sectionKind === 'gable' ? boundsFromRect(rightEaveX, rightEaveY, rightEaveBeamWidth, rightEaveBeamDepth) : null,
    model.sectionKind === 'gable' && yRidgeUnder !== null ? boundsFromRect(xLeft, tieBeamTopY, Math.max(0.4, xRight - xLeft), Math.max(0.2, tieBeamBottomY - tieBeamTopY)) : null,
    model.sectionKind === 'gable' && yRidgeUnder !== null ? boundsFromRect(ridgeX - kingStrutWidth / 2, yRidgeUnder, kingStrutWidth, Math.max(0.2, tieBeamTopY - yRidgeUnder)) : null,
    model.sectionKind === 'gable' && yRidgeUnder !== null ? boundsFromLine(ridgeX, yGround, ridgeX, yRidgeUnder, 0.2) : null,
    monoRoofGeom ? boundsFromPoints(monoRoofGeom.points, 0.35) : null,
    gableLeftRoofGeom ? boundsFromPoints(gableLeftRoofGeom.points, 0.35) : null,
    gableRightRoofGeom ? boundsFromPoints(gableRightRoofGeom.points, 0.35) : null,
    yRidgeBeamTop !== null ? boundsFromRect(ridgeX - ridgeBeamWidth / 2, yRidgeBeamTop, ridgeBeamWidth, Math.max(0.2, yRidgeUnder! - yRidgeBeamTop)) : null,
    monoSupportSplice ? boundsFromLine(xSupport, monoSupportSplice.yTop, xSupport, monoSupportSplice.yUnder, 0.2) : null,
    model.sectionKind === 'mono' ? boundsFromRect(xRight - gutterWidth, gutterTopY, gutterWidth, Math.max(0.2, yOuterGutterUnder - gutterTopY)) : null,
    ...roofTopLengthDims.flatMap((roofDim) => {
      const roofNormal = segmentDownNormal(roofDim.topStart.x, roofDim.topStart.y, roofDim.topEnd.x, roofDim.topEnd.y);
      return [
        boundsFromLine(roofDim.topStart.x, roofDim.topStart.y, roofDim.dimStart.x, roofDim.dimStart.y, 0.2),
        boundsFromLine(roofDim.topEnd.x, roofDim.topEnd.y, roofDim.dimEnd.x, roofDim.dimEnd.y, 0.2),
        estimateTickDimensionBounds({
          x1: roofDim.dimStart.x,
          y1: roofDim.dimStart.y,
          x2: roofDim.dimEnd.x,
          y2: roofDim.dimEnd.y,
          label: formatMetres(roofDim.lengthM),
          textX: (roofDim.dimStart.x + roofDim.dimEnd.x) / 2 - roofNormal.nx * (1.4 + roofLengthLabelGap),
          textY: (roofDim.dimStart.y + roofDim.dimEnd.y) / 2 - roofNormal.ny * 1.4,
          presentation,
        }),
      ];
    }),
    model.boxPerimeterEnabled && model.sectionKind === 'gable' && yRidgeUnder !== null
      ? boundsFromLine(gableLeftRafterStartX + 1.6, yHouseRafterUnder + 1.4, ridgeX, yRidgeUnder + 1.4, 0.2)
      : null,
    model.boxPerimeterEnabled && model.sectionKind === 'gable' && yRidgeUnder !== null
      ? boundsFromLine(ridgeX, yRidgeUnder + 1.4, gableRightRafterEndX - 1.6, yRightEaveRafterUnder + 1.4, 0.2)
      : null,
    model.boxPerimeterEnabled && model.sectionKind !== 'gable'
      ? boundsFromLine(monoRafterStartX + 1.6, yHouseRafterUnder + 1.4, monoRafterEndX - 1.6, yOuterRafterUnder + 1.4, 0.2)
      : null,
    model.boxPerimeterEnabled
      ? estimateTextBounds({
          text: `Internal roof angle ${model.pitchDeg.toFixed(1)} deg`,
          x: (xLeft + xRight) / 2,
          y: Math.min(yGround - 2.5, Math.max(yHouseUnder, ySupportUnder) + 8),
          anchor: 'middle',
          fontHeight: 1.75,
          charWidth: 0.58,
          paddingX: 0.25,
          paddingY: 0.18,
        })
      : null,
    model.sectionKind === 'mono'
      ? estimateTickDimensionBounds({
          x1: depthDimTop.x,
          y1: depthDimTop.y,
          x2: depthDimBottom.x,
          y2: depthDimBottom.y,
          label: `${Math.round(model.rafterDepthM * 1000)}mm`,
          textX: depthDimTop.x - 1.3,
          textY: depthDimTop.y - 2.5,
          overrun: 1.1,
          presentation,
        })
      : null,
    boundsFromLine(leftDimX - 2.4, yHouseUnder, xLeft + 2.4, yHouseUnder, 0.2),
    boundsFromLine(xRight - 2.4, yOuterGutterUnder, rightDimX + 2.4, yOuterGutterUnder, 0.2),
    overhangM > 0 ? boundsFromLine(xSupport, spanAnchorSupportY, xSupport, overhangDimY, 0.2) : null,
    overhangM > 0 ? boundsFromLine(xRight, spanAnchorRightY, xRight, overhangDimY, 0.2) : null,
    overhangM > 0
      ? estimateTickDimensionBounds({ x1: xSupport, y1: overhangDimY, x2: xRight, y2: overhangDimY, label: `OH ${formatMetres(overhangM)}`, presentation })
      : null,
    boundsFromLine(xLeft, spanAnchorLeftY, xLeft, spanDimY, 0.2),
    boundsFromLine(xRight, spanAnchorRightY, xRight, spanDimY, 0.2),
    estimateTickDimensionBounds({
      x1: xLeft,
      y1: spanDimY,
      x2: xRight,
      y2: spanDimY,
      label: formatMetres(model.spanA),
      textY: spanDimY - 1.8,
      presentation,
    }),
    boundsFromLine(xLeft, yGround, leftDimX, yGround, 0.2),
    boundsFromLine(xLeft, yHouseUnder, leftDimX, yHouseUnder, 0.2),
    estimateTickDimensionBounds({ x1: leftDimX, y1: yGround, x2: leftDimX, y2: yHouseUnder, label: formatMetres(model.leftEdgeHeightM), presentation }),
    boundsFromLine(xRight, yGround, rightDimX, yGround, 0.2),
    boundsFromLine(xRight, yOuterGutterUnder, rightDimX, yOuterGutterUnder, 0.2),
    estimateTickDimensionBounds({ x1: rightDimX, y1: yGround, x2: rightDimX, y2: yOuterGutterUnder, label: formatMetres(outerGutterUndersideM), presentation }),
    estimateTextBounds({
      text: `Pitch ${model.pitchDeg.toFixed(1)} deg`,
      x: (xLeft + xRight) / 2,
      y: pitchLabelY,
      anchor: 'middle',
      fontHeight: 1.9,
      charWidth: 0.6,
      paddingX: 0.25,
      paddingY: 0.18,
    }),
    model.roofType === 'hip_corner'
      ? estimateTextBounds({
          text: 'Primary wing section (A)',
          x: (xLeft + xRight) / 2,
          y: metaLabelY,
          anchor: 'middle',
          fontHeight: 1.75,
          charWidth: 0.58,
          paddingX: 0.25,
          paddingY: 0.18,
        })
      : null,
  ]);
}

export function resolveSectionSheetLayoutForScale(input: {
  model: ModuleSectionModel;
  scale: number;
}): ResolvedSheetLayout {
  const frame = getSectionSheetFrame(input.model.sectionKind);
  const extents = getSectionRealExtents(input.model);
  let xLeft = frame.fitArea.x + (frame.fitArea.width - extents.widthM * input.scale) / 2;
  let yGround = frame.fitArea.y + extents.heightM * input.scale + Math.max(0, frame.fitArea.height - extents.heightM * input.scale) * frame.verticalBias;
  let bounds = measureSectionAnnotatedBounds({ model: input.model, xLeft, yGround, scale: input.scale });
  for (let idx = 0; idx < 2; idx += 1) {
    const offset = resolveBoundsPlacement(bounds, frame.fitArea, frame.verticalBias);
    xLeft += offset.dx;
    yGround += offset.dy;
    bounds = measureSectionAnnotatedBounds({ model: input.model, xLeft, yGround, scale: input.scale });
  }

  return {
    outerField: frame.outerField,
    fitArea: frame.fitArea,
    annotatedBounds: bounds,
    x: xLeft,
    y: yGround,
    scale: input.scale,
    houseBandHeight: 0,
    houseBandOffset: 0,
    houseInset: 0,
    fallGap: 0,
  };
}

export function resolveSectionSheetLayout(input: {
  model: ModuleSectionModel;
  drawingScale: EstimateDrawingScale;
  viewportMm?: { widthMm: number; heightMm: number };
}): ResolvedSheetLayout {
  if (input.drawingScale.mode === 'fixed') {
    return resolveSectionSheetLayoutForScale({
      model: input.model,
      scale: getViewBoxUnitsPerMetreAtScale(input.drawingScale.ratio, input.viewportMm),
    });
  }

  const extents = getSectionRealExtents(input.model);
  const fitFrame = getSectionSheetFrame(input.model.sectionKind);
  return resolveMeasuredFitLayout({
    initialScale: Math.min(fitFrame.fitArea.width / Math.max(extents.widthM, 0.1), fitFrame.fitArea.height / Math.max(extents.heightM, 0.1)),
    resolveForScale: (scale) => resolveSectionSheetLayoutForScale({ model: input.model, scale }),
  });
}

export function resolveSectionModelSpaceLayout(model: ModuleSectionModel): ResolvedModelSpaceLayout {
  const scale = MODEL_SPACE_UNITS_PER_METRE;
  const extents = getSectionRealExtents(model);
  const x = 0;
  const y = extents.heightM * scale;
  const annotatedBounds = measureSectionAnnotatedBounds({ model, xLeft: x, yGround: y, scale, presentation: 'model' });
  const focusBounds = measureSectionAnnotatedBounds({ model, xLeft: x, yGround: y, scale, presentation: 'model', includeHouseContext: false });
  const svgMetrics = resolveModelSpaceSvgMetrics(focusBounds);
  const focusMetrics = resolveModelSpaceFocusMetrics(focusBounds);
  const worldMetrics = resolveModelSpaceWorldMetrics(annotatedBounds);

  return {
    outerField: svgMetrics.viewBox,
    fitArea: svgMetrics.viewBox,
    annotatedBounds,
    x,
    y,
    scale,
    houseBandHeight: 0,
    houseBandOffset: 0,
    houseInset: 0,
    fallGap: 0,
    ...svgMetrics,
    ...focusMetrics,
    ...worldMetrics,
  };
}
