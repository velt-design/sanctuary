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
import { rotateVectorQuarterTurns } from './ModulePlanAnnotations';
export const HOUSE_FOOTPRINT_PRESET_OPTIONS: Array<{ id: ModulePlanModel['houseFootprintPreset']; label: string }> = [
  { id: 'straight', label: 'Straight' },
  { id: 'l_left', label: 'L left' },
  { id: 'l_right', label: 'L right' },
  { id: 'recess_left', label: 'Recess left' },
  { id: 'recess_right', label: 'Recess right' },
  { id: 'u_shape', label: 'U shape' },
  { id: 'wrap_left', label: 'Wrap left' },
  { id: 'wrap_right', label: 'Wrap right' },
];

export function canEditHouseFootprintPlan(model?: ModulePlanModel | null): boolean {
  return Boolean(model && model.houseConnectionType !== 'none' && model.supportsHouseFootprints && model.roofType !== 'hip_corner');
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


type FootprintCustomVertexSpec = {
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


type FootprintCustomEdgeSpec = {
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


function actualPergolaCenter(rect: { x: number; y: number; width: number; height: number }): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}


function localFootprintDimensionsM(model: ModulePlanModel, attachmentSide: AttachmentSide): { widthM: number; depthM: number } {
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


function mapLocalFootprintPointToPlan(input: {
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





