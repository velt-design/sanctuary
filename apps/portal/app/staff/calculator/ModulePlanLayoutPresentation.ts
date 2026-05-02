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
  attachmentFrameForRect,
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
  pointOnAttachmentFrame,
  rectToPoints,
  resolveBoundsPlacement,
  resolveMeasuredFitLayout,
  resolveModelSpaceFocusMetrics,
  resolveModelSpaceSvgMetrics,
  resolveModelSpaceWorldMetrics,
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
  type PlanAttachmentFrame,
  type ResolvedModelSpaceLayout,
  type ResolvedSheetLayout,
  type SheetDebugMetrics,
  type SheetDrawingField,
  type SheetFitArea,
  type SheetRect,
  type SvgDebugScaleProps,
} from './ModuleDrawingSurfacePrimitives';
import { hasFullLengthPlanRidge } from './ModuleDrawingChromePresentation';
import { resolveFootprintCanvasLayout } from './ModulePlanFootprintPresentation';
import { buildPlanFallAnnotationSpec, buildPlanInternalAngleAnnotationSpec, buildPlanRafterSpacingAnnotationSpec, estimatePinnedSheetPlanPrimaryDimensionBounds, estimatePlanFallAnnotationBounds, estimatePlanLineTextAnnotationBounds, estimatePlanSpacingAnnotationBounds } from './ModulePlanAnnotations';
export { attachmentFrameForRect, buildSheetDebugMetrics, getSheetDrawingField, pointOnAttachmentFrame } from './ModuleDrawingSurfacePrimitives';
export { hasFullLengthPlanRidge } from './ModuleDrawingChromePresentation';
export type PlanFitBox = {
  x: number;
  y: number;
  scale: number;
  houseBandHeight: number;
  houseBandOffset: number;
  houseInset: number;
  fallGap: number;
};


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




