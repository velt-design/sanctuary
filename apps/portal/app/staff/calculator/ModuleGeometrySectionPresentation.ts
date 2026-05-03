import type {
  GeometrySectionHouseLineKind,
  GeometrySectionHouseSurfaceKind,
  GeometrySectionMember2D,
  GeometrySectionViewModel,
  Line2,
  Point2,
  Polygon2,
} from '@sp/geometry';
import { getViewBoxUnitsPerMetreAtScale } from '@/lib/estimates/drawingSheetLayout';
import type { EstimateDrawingScale } from '@/lib/estimates/drawingSheet';
import type {
  ModuleDrawingPresentation,
  ModuleDrawingScaleDiagnostic,
  ModuleDrawingScaleState,
} from './ModuleDrawingContracts';
import {
  MODEL_SPACE_UNITS_PER_METRE,
  boundsFromLine,
  boundsFromPoints,
  buildSheetDebugMetrics,
  resolveBoundsPlacement,
  resolveMeasuredFitLayout,
  resolveModelSpaceFocusMetrics,
  resolveModelSpaceSvgMetrics,
  resolveModelSpaceWorldMetrics,
  unionBounds,
  type Point,
  type ResolvedModelSpaceLayout,
  type ResolvedSheetLayout,
  type SheetDebugMetrics,
} from './ModuleDrawingSurfacePrimitives';
import {
  getSectionSheetFrame,
  resolveSectionFitFrame,
} from './ModuleSectionPresentation';

export type GeometrySectionRenderSource = 'solved_geometry' | 'legacy_fallback';

export type GeometrySectionSvgLine = {
  id: string;
  start: Point;
  end: Point;
};

export type GeometrySectionSvgMember = GeometrySectionSvgLine & {
  role: GeometrySectionMember2D['role'];
};

export type GeometrySectionSvgHouseSurface = {
  id: string;
  kind: GeometrySectionHouseSurfaceKind;
  points: Point[];
};

export type GeometrySectionSvgHouseLine = GeometrySectionSvgLine & {
  kind: GeometrySectionHouseLineKind;
};

export type GeometrySectionPresentationModel = {
  source: GeometrySectionRenderSource;
  sectionKind: GeometrySectionViewModel['sectionKind'];
  layout: ResolvedSheetLayout | ResolvedModelSpaceLayout | null;
  modelSvgStyle?: { width: string; height: string };
  scale: number;
  yGround: number;
  ground: {
    leftX: number;
    rightX: number;
    lineRightX: number;
  };
  members: GeometrySectionSvgMember[];
  roofLines: GeometrySectionSvgLine[];
  roofCladdingLines: GeometrySectionSvgLine[];
  houseSurfaces: GeometrySectionSvgHouseSurface[];
  houseLines: GeometrySectionSvgHouseLine[];
  dimensions: {
    span: GeometrySectionSvgLine & { label: string; textY?: number };
    leftHeight: (GeometrySectionSvgLine & { label: string }) | null;
    rightHeight: (GeometrySectionSvgLine & { label: string }) | null;
    ridgeHeight: (GeometrySectionSvgLine & { label: string }) | null;
    pitch: { point: Point; label: string } | null;
  };
  outlines: {
    outerField: ResolvedSheetLayout['outerField'] | null;
    fitArea: ResolvedSheetLayout['fitArea'] | null;
    annotatedBounds: ResolvedSheetLayout['annotatedBounds'] | null;
    debugMetrics: SheetDebugMetrics | null;
  };
};

type GeometrySectionLayoutFacts = {
  extents: {
    minProjectionM: number;
    maxProjectionM: number;
    minHeightM: number;
    maxHeightM: number;
    widthM: number;
    heightM: number;
  };
  originX: number;
  yGround: number;
  scale: number;
};

function metresFromMm(value: number): number {
  return value / 1000;
}

function formatMetresLabelFromMm(valueMm: number): string {
  return `${metresFromMm(valueMm).toFixed(2)}m`;
}

export function getGeometrySectionRealExtents(section: GeometrySectionViewModel): GeometrySectionLayoutFacts['extents'] {
  const minProjectionM = metresFromMm(section.extents.minProjectionMm);
  const maxProjectionM = metresFromMm(section.extents.maxProjectionMm);
  const minHeightM = metresFromMm(Math.min(0, section.extents.minHeightMm));
  const maxHeightM = metresFromMm(Math.max(0, section.extents.maxHeightMm));
  return {
    minProjectionM,
    maxProjectionM,
    minHeightM,
    maxHeightM,
    widthM: Math.max(0.1, maxProjectionM - minProjectionM),
    heightM: Math.max(0.1, maxHeightM - minHeightM),
  };
}

function resolveGeometrySectionLayoutFacts(input: {
  section: GeometrySectionViewModel;
  presentation: ModuleDrawingPresentation;
  scale: number;
}): GeometrySectionLayoutFacts {
  const frame = resolveSectionFitFrame(input.presentation, input.section.sectionKind);
  const extents = getGeometrySectionRealExtents(input.section);
  const leftX = frame.fitArea.x + Math.max(0, frame.fitArea.width - extents.widthM * input.scale) / 2;
  const topY = frame.fitArea.y + Math.max(0, frame.fitArea.height - extents.heightM * input.scale) * frame.verticalBias;
  return {
    extents,
    originX: leftX - extents.minProjectionM * input.scale,
    yGround: topY + extents.maxHeightM * input.scale,
    scale: input.scale,
  };
}

function pointToSvg(point: Point2, facts: GeometrySectionLayoutFacts): Point {
  return {
    x: facts.originX + metresFromMm(point.x) * facts.scale,
    y: facts.yGround - metresFromMm(point.y) * facts.scale,
  };
}

function lineToSvg(id: string, line: Line2, facts: GeometrySectionLayoutFacts): GeometrySectionSvgLine {
  return {
    id,
    start: pointToSvg(line.start, facts),
    end: pointToSvg(line.end, facts),
  };
}

function polygonToSvg(polygon: Polygon2, facts: GeometrySectionLayoutFacts): Point[] {
  return polygon.map((point) => pointToSvg(point, facts));
}

function measureGeometrySectionBounds(input: {
  section: GeometrySectionViewModel;
  facts: GeometrySectionLayoutFacts;
  includeHouseContext?: boolean;
}): ReturnType<typeof unionBounds> {
  const facts = input.facts;
  const transformedLines = [
    input.section.baseline,
    input.section.anchors.span,
    ...input.section.surfaces.roofPlanes.map((line) => line.line),
    ...input.section.surfaces.roofCladding.map((line) => line.line),
    ...Object.values(input.section.members).flatMap((members) => members.map((member) => member.projection)),
    ...(input.includeHouseContext === false ? [] : input.section.house.lines ?? []).map((line) => line.line),
  ].map((line) => lineToSvg('measure', line, facts));

  const transformedPolygons =
    input.includeHouseContext === false
      ? []
      : (input.section.house.surfaces ?? []).map((surface) => polygonToSvg(surface.boundary, facts));

  const baseBounds = unionBounds([
    ...transformedLines.map((line) => boundsFromLine(line.start.x, line.start.y, line.end.x, line.end.y, 1.8)),
    ...transformedPolygons.map((points) => boundsFromPoints(points, 1.4)),
  ]);

  const dimPad = input.section.sectionKind === 'gable' ? 11 : 9;
  return unionBounds([
    baseBounds,
    {
      minX: baseBounds.minX - dimPad,
      minY: baseBounds.minY - 7,
      maxX: baseBounds.maxX + dimPad,
      maxY: baseBounds.maxY + 14,
    },
  ]);
}

export function resolveGeometrySectionSheetLayoutForScale(input: {
  section: GeometrySectionViewModel;
  scale: number;
}): ResolvedSheetLayout {
  const frame = getSectionSheetFrame(input.section.sectionKind);
  let facts = resolveGeometrySectionLayoutFacts({
    section: input.section,
    presentation: 'sheet',
    scale: input.scale,
  });
  let bounds = measureGeometrySectionBounds({ section: input.section, facts });

  for (let idx = 0; idx < 2; idx += 1) {
    const offset = resolveBoundsPlacement(bounds, frame.fitArea, frame.verticalBias);
    facts = {
      ...facts,
      originX: facts.originX + offset.dx,
      yGround: facts.yGround + offset.dy,
    };
    bounds = measureGeometrySectionBounds({ section: input.section, facts });
  }

  return {
    outerField: frame.outerField,
    fitArea: frame.fitArea,
    annotatedBounds: bounds,
    x: facts.originX,
    y: facts.yGround,
    scale: input.scale,
    houseBandHeight: 0,
    houseBandOffset: 0,
    houseInset: 0,
    fallGap: 0,
  };
}

export function resolveGeometrySectionSheetLayout(input: {
  section: GeometrySectionViewModel;
  drawingScale: EstimateDrawingScale;
  viewportMm?: { widthMm: number; heightMm: number };
}): ResolvedSheetLayout {
  if (input.drawingScale.mode === 'fixed') {
    return resolveGeometrySectionSheetLayoutForScale({
      section: input.section,
      scale: getViewBoxUnitsPerMetreAtScale(input.drawingScale.ratio, input.viewportMm),
    });
  }

  const frame = getSectionSheetFrame(input.section.sectionKind);
  const extents = getGeometrySectionRealExtents(input.section);
  return resolveMeasuredFitLayout({
    initialScale: Math.min(
      frame.fitArea.width / Math.max(extents.widthM, 0.1),
      frame.fitArea.height / Math.max(extents.heightM, 0.1),
    ),
    resolveForScale: (scale) => resolveGeometrySectionSheetLayoutForScale({ section: input.section, scale }),
  });
}

export function resolveGeometrySectionModelSpaceLayout(section: GeometrySectionViewModel): ResolvedModelSpaceLayout {
  const scale = MODEL_SPACE_UNITS_PER_METRE;
  const facts = {
    ...resolveGeometrySectionLayoutFacts({ section, presentation: 'model', scale }),
    originX: -getGeometrySectionRealExtents(section).minProjectionM * scale,
    yGround: getGeometrySectionRealExtents(section).maxHeightM * scale,
  };
  const annotatedBounds = measureGeometrySectionBounds({ section, facts });
  const focusBounds = measureGeometrySectionBounds({ section, facts, includeHouseContext: false });
  const svgMetrics = resolveModelSpaceSvgMetrics(focusBounds);
  const focusMetrics = resolveModelSpaceFocusMetrics(focusBounds);
  const worldMetrics = resolveModelSpaceWorldMetrics(annotatedBounds);

  return {
    outerField: svgMetrics.viewBox,
    fitArea: svgMetrics.viewBox,
    annotatedBounds,
    x: facts.originX,
    y: facts.yGround,
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

export function buildGeometrySectionPresentation(input: {
  section: GeometrySectionViewModel;
  presentation?: ModuleDrawingPresentation;
  drawingScale: EstimateDrawingScale;
  sheetViewportMm?: { widthMm: number; heightMm: number };
  debugScaleState?: ModuleDrawingScaleState | null;
  scaleDiagnostics?: ModuleDrawingScaleDiagnostic[];
}): GeometrySectionPresentationModel {
  const presentation = input.presentation ?? 'card';
  const isSheet = presentation === 'sheet';
  const isModel = presentation === 'model';
  const sectionSheetLayout = isSheet
    ? resolveGeometrySectionSheetLayout({
        section: input.section,
        drawingScale: input.drawingScale,
        viewportMm: input.sheetViewportMm,
      })
    : null;
  const modelSpaceLayout = isModel ? resolveGeometrySectionModelSpaceLayout(input.section) : null;
  const fixedScale =
    isSheet && input.drawingScale.mode === 'fixed'
      ? getViewBoxUnitsPerMetreAtScale(input.drawingScale.ratio, input.sheetViewportMm)
      : null;
  const fitFrame = resolveSectionFitFrame(presentation, input.section.sectionKind);
  const extents = getGeometrySectionRealExtents(input.section);
  const scale =
    sectionSheetLayout?.scale ??
    modelSpaceLayout?.scale ??
    fixedScale ??
    Math.min(
      Math.max(12, fitFrame.fitArea.width) / Math.max(extents.widthM, 0.1),
      Math.max(10, fitFrame.fitArea.height) / Math.max(extents.heightM, 0.1),
    );
  const layoutFacts =
    sectionSheetLayout || modelSpaceLayout
      ? {
          extents,
          originX: sectionSheetLayout?.x ?? modelSpaceLayout?.x ?? 0,
          yGround: sectionSheetLayout?.y ?? modelSpaceLayout?.y ?? 0,
          scale,
        }
      : resolveGeometrySectionLayoutFacts({ section: input.section, presentation, scale });

  const members = Object.values(input.section.members)
    .flat()
    .map((member) => ({
      ...lineToSvg(member.id, member.projection, layoutFacts),
      role: member.role,
    }));
  const roofLines = input.section.surfaces.roofPlanes.map((line) => lineToSvg(line.id, line.line, layoutFacts));
  const roofCladdingLines = input.section.surfaces.roofCladding.map((line) => lineToSvg(line.id, line.line, layoutFacts));
  const houseSurfaces = (input.section.house.surfaces ?? []).map((surface) => ({
    id: surface.id,
    kind: surface.kind,
    points: polygonToSvg(surface.boundary, layoutFacts),
  }));
  const houseLines = (input.section.house.lines ?? []).map((line) => ({
    ...lineToSvg(line.id, line.line, layoutFacts),
    kind: line.kind,
  }));
  const spanLine = lineToSvg('section-span', input.section.anchors.span, layoutFacts);
  const spanDimY = Math.max(layoutFacts.yGround + 10.2, Math.max(spanLine.start.y, spanLine.end.y) + 8.4);
  const span: GeometrySectionPresentationModel['dimensions']['span'] = {
    id: 'section-span-dimension',
    start: { x: spanLine.start.x, y: spanDimY },
    end: { x: spanLine.end.x, y: spanDimY },
    label: formatMetresLabelFromMm(input.section.metrics.spanMm),
    textY: spanDimY - (isSheet ? 1.8 : 1.4),
  };
  const leftDimX = Math.min(spanLine.start.x, spanLine.end.x) - (isModel ? 8.6 : isSheet ? 9.8 : 8.6);
  const rightDimX = Math.max(spanLine.start.x, spanLine.end.x) + (isModel ? 9.4 : isSheet ? 10.6 : 9.4);

  const heightDimension = (
    id: string,
    anchor: GeometrySectionViewModel['anchors']['leftEdgeHeight'],
    dimX: number,
  ): (GeometrySectionSvgLine & { label: string }) | null => {
    if (!anchor) return null;
    const top = pointToSvg(anchor.point, layoutFacts);
    return {
      id,
      start: { x: dimX, y: layoutFacts.yGround },
      end: { x: dimX, y: top.y },
      label: formatMetresLabelFromMm(anchor.valueMm),
    };
  };

  const pitch =
    input.section.anchors.pitch && typeof input.section.metrics.pitchDeg === 'number'
      ? {
          point: pointToSvg(input.section.anchors.pitch.point, layoutFacts),
          label: `Pitch ${input.section.metrics.pitchDeg.toFixed(1)} deg`,
        }
      : null;

  return {
    source: 'solved_geometry',
    sectionKind: input.section.sectionKind,
    layout: sectionSheetLayout ?? modelSpaceLayout,
    modelSvgStyle: modelSpaceLayout
      ? {
          width: `${modelSpaceLayout.svgWidthPx}px`,
          height: `${modelSpaceLayout.svgHeightPx}px`,
        }
      : undefined,
    scale,
    yGround: layoutFacts.yGround,
    ground: {
      leftX: isModel ? layoutFacts.originX + extents.minProjectionM * scale - 8 : Math.max(8, layoutFacts.originX + extents.minProjectionM * scale - 8),
      rightX: isModel ? layoutFacts.originX + extents.maxProjectionM * scale + 8 : Math.min(104, layoutFacts.originX + extents.maxProjectionM * scale + 8),
      lineRightX: isModel ? layoutFacts.originX + extents.maxProjectionM * scale + 8 : Math.min(112, layoutFacts.originX + extents.maxProjectionM * scale + 8),
    },
    members,
    roofLines,
    roofCladdingLines,
    houseSurfaces,
    houseLines,
    dimensions: {
      span,
      leftHeight: heightDimension('section-left-height', input.section.anchors.leftEdgeHeight, leftDimX),
      rightHeight: heightDimension('section-right-height', input.section.anchors.rightEdgeHeight, rightDimX),
      ridgeHeight: heightDimension('section-ridge-height', input.section.anchors.ridgeHeight, rightDimX + 4),
      pitch,
    },
    outlines: {
      outerField: sectionSheetLayout?.outerField ?? null,
      fitArea: sectionSheetLayout?.fitArea ?? null,
      annotatedBounds: sectionSheetLayout?.annotatedBounds ?? null,
      debugMetrics: sectionSheetLayout
        ? buildSheetDebugMetrics(sectionSheetLayout, input.debugScaleState, input.scaleDiagnostics)
        : null,
    },
  };
}
