import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import type { ModuleDrawingDisplayMode, ModuleFootprintEditorProps } from './ModuleDrawingContracts';
import type { ModulePlanModel } from './moduleViews';
import {
  boundsFromLine,
  boundsFromPoints,
  boundsFromRect,
  createBounds,
  estimateTickDimensionBounds,
  formatMetres,
  memberSizeM,
  resolveModelSpaceFocusMetrics,
  resolveModelSpaceSvgMetrics,
  resolveModelSpaceWorldMetrics,
  rotateBoundsQuarterTurns,
  unionBounds,
  type AnnotatedBounds,
  type ResolvedModelSpaceLayout,
  MODEL_SPACE_UNITS_PER_METRE,
} from './ModuleDrawingSurfacePrimitives';
import { hasFullLengthPlanRidge } from './ModuleDrawingChromePresentation';
import {
  hipCornerInnerPoints,
  interiorPlanRafterXs,
  planHousePointToSvg,
  projectLinearPositions,
  resolvePlanRotationFrame,
} from './ModulePlanGeometryPresentation';
import { getPlanSheetFrame, measurePlanAnnotatedBounds, type PlanSheetFrame } from './ModulePlanSheetLayoutPresentation';

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
  const primaryPoints = isHipCorner
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
