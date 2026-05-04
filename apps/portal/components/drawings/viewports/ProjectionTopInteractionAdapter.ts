import type { GeometryTopProjectionShape, GeometryTopProjectionViewModel, Point2 } from '@sp/geometry';
import {
  buildTopProjectionPlanCoordinateAdapter,
  type PlanCoordinateAdapter,
  type PlanSvgPoint,
} from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchViewportTargetSelection } from '@/lib/drawings/state/objectWorkbenchViewportTypes';

const PROJECTION_TOP_PADDING = 6;
const PROJECTION_TOP_MODEL_UNITS_PER_METRE = 100;

type ProjectionTopLayout = {
  baseX: number;
  baseY: number;
  scale: number;
  viewBox: string;
  width: number;
  height: number;
  worldBoxValue: string;
};

type ProjectionTopInteractionAdapter = {
  layout: ProjectionTopLayout;
  coordinateAdapter: PlanCoordinateAdapter;
  clientPointToSvg: (svg: SVGSVGElement, clientX: number, clientY: number) => PlanSvgPoint | null;
  clientPointToProjection: (svg: SVGSVGElement, clientX: number, clientY: number) => { x: number; y: number } | null;
};

function shapeIdentityValues(shape: GeometryTopProjectionShape): string[] {
  return [
    shape.id,
    shape.sourceId,
    shape.sourceObjectId,
    typeof shape.metadata?.deckId === 'string' ? shape.metadata.deckId : null,
    typeof shape.metadata?.openingId === 'string' ? shape.metadata.openingId : null,
    typeof shape.metadata?.pergolaId === 'string' ? shape.metadata.pergolaId : null,
    typeof shape.metadata?.houseFormId === 'string' ? shape.metadata.houseFormId : null,
  ].filter((value): value is string => Boolean(value));
}

function resolveProjectionTopLayout(projection: GeometryTopProjectionViewModel): ProjectionTopLayout {
  const extents = projection.extents ?? {
    minX: 0,
    minY: 0,
    maxX: 1000,
    maxY: 1000,
    widthMm: 1000,
    heightMm: 1000,
  };
  const safeWidthM = Math.max(0.1, extents.widthMm / 1000);
  const safeHeightM = Math.max(0.1, extents.heightMm / 1000);
  const scale = PROJECTION_TOP_MODEL_UNITS_PER_METRE;
  const width = safeWidthM * scale + PROJECTION_TOP_PADDING * 2;
  const height = safeHeightM * scale + PROJECTION_TOP_PADDING * 2;

  return {
    baseX: PROJECTION_TOP_PADDING - (extents.minX / 1000) * scale,
    baseY: PROJECTION_TOP_PADDING - (extents.minY / 1000) * scale,
    scale,
    viewBox: `0 0 ${width.toFixed(2)} ${height.toFixed(2)}`,
    width,
    height,
    worldBoxValue: `${extents.minX} ${extents.minY} ${extents.widthMm} ${extents.heightMm}`,
  };
}

function clientPointToTopSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): PlanSvgPoint | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

export function buildProjectionTopInteractionAdapter(input: {
  projection: GeometryTopProjectionViewModel;
}): ProjectionTopInteractionAdapter {
  const layout = resolveProjectionTopLayout(input.projection);
  const coordinateAdapter = buildTopProjectionPlanCoordinateAdapter({
    projection: input.projection,
    baseX: layout.baseX,
    baseY: layout.baseY,
    scale: layout.scale,
  });

  return {
    layout,
    coordinateAdapter,
    clientPointToSvg: clientPointToTopSvg,
    clientPointToProjection: (svg, clientX, clientY) => {
      const svgPoint = clientPointToTopSvg(svg, clientX, clientY);
      return svgPoint ? coordinateAdapter.svgToProjectionPlanPoint(svgPoint) : null;
    },
  };
}

export function projectionTopShapeToSelection(
  shape: GeometryTopProjectionShape,
): ObjectWorkbenchViewportTargetSelection | null {
  const targetId = shape.sourceId ?? shape.sourceObjectId ?? shape.id;
  if (shape.family === 'house') {
    if (shape.kind === 'deck') return { kind: 'deck', targetId };
    if (shape.kind === 'opening_marker' || shape.kind === 'opening_outline') {
      return { kind: 'opening', targetId };
    }
    if (shape.kind === 'footprint') return { kind: 'footprint', targetId };
    if (shape.kind === 'attachment_target') return { kind: 'attachment_zone', targetId };
    if (shape.kind === 'roof') return { kind: 'roof', targetId };
    return { kind: 'house', targetId };
  }
  return null;
}

export function projectionTopShapePergolaId(shape: GeometryTopProjectionShape): string | null {
  if (shape.family !== 'pergola') return null;
  if (typeof shape.metadata?.pergolaId === 'string') return shape.metadata.pergolaId;
  return shape.sourceObjectId ?? shape.sourceId ?? shape.id;
}

export function activeObjectMatchesProjectionTopShape(
  activeObjectRef: WorkbenchObjectRef | null | undefined,
  shape: GeometryTopProjectionShape,
): boolean {
  if (!activeObjectRef) return false;
  const identities = shapeIdentityValues(shape);
  const objectId = activeObjectRef.objectId;
  if (activeObjectRef.family === 'decks') {
    return shape.family === 'house' && shape.kind === 'deck' && Boolean(objectId && identities.includes(objectId));
  }
  if (activeObjectRef.family === 'openings') {
    return (
      shape.family === 'house' &&
      (shape.kind === 'opening_marker' || shape.kind === 'opening_outline') &&
      Boolean(objectId && identities.includes(objectId))
    );
  }
  if (activeObjectRef.family === 'pergolas') {
    return shape.family === 'pergola' && Boolean(objectId && identities.includes(objectId));
  }
  if (activeObjectRef.family === 'house_forms') {
    return (
      shape.family === 'house' &&
      shape.kind !== 'deck' &&
      shape.kind !== 'opening_marker' &&
      shape.kind !== 'opening_outline' &&
      (!objectId || identities.includes(objectId) || shape.sourceType.startsWith('house_'))
    );
  }
  return false;
}

export function projectionBoundsToSvgRect(input: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  adapter: PlanCoordinateAdapter;
}): { x: number; y: number; width: number; height: number } {
  const corners = [
    input.adapter.projectionToSvg({ x: input.minX, y: input.minY } satisfies Point2),
    input.adapter.projectionToSvg({ x: input.maxX, y: input.minY } satisfies Point2),
    input.adapter.projectionToSvg({ x: input.maxX, y: input.maxY } satisfies Point2),
    input.adapter.projectionToSvg({ x: input.minX, y: input.maxY } satisfies Point2),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(0.1, maxX - minX),
    height: Math.max(0.1, maxY - minY),
  };
}
