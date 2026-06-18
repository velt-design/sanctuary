import type { AttachmentSide } from '@sp/costing';
import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import {
  attachmentSideQuarterTurns,
  buildHouseFootprintLocalLayout,
  type ModulePlanModel,
} from './moduleViews';
import type { PlanPoint } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import { topProjectionSvgPointToPlanPoint } from '@/lib/drawings/views/plan/planCoordinateAdapter';

type PlanSvgBridgePoint = {
  x: number;
  y: number;
};

export type PlanSvgFootprintCanvasPoint = {
  alongM: string;
  depthM: string;
  numericAlongM: number;
  numericDepthM: number;
};

export type PlanSvgFootprintCanvasPointResolver = (clientX: number, clientY: number) => PlanSvgFootprintCanvasPoint | null;

type PlanSvgPointerFootprintPointInput = {
  rootPoint: PlanSvgBridgePoint;
  rotationCenter: PlanSvgBridgePoint;
  rotationTurns: number;
  footprintRect: { x: number; y: number; width: number; height: number };
  scale: number;
  attachmentSide: AttachmentSide;
  lengthA: number;
  spanA: number;
  houseFootprintPreset: ModulePlanModel['houseFootprintPreset'];
  houseFootprintParams: ModulePlanModel['houseFootprintParams'];
  isHipCorner?: boolean;
};

type PlanSvgPointerFootprintPoint = {
  formatted: {
    alongM: string;
    depthM: string;
  };
  numeric: {
    alongM: number;
    depthM: number;
  };
};

type PlanSvgPointResolverInput = {
  origin: PlanSvgBridgePoint;
  scale: number;
  rotationFrame: {
    center: PlanSvgBridgePoint;
    turns: number;
  };
  footprintRect: { x: number; y: number; width: number; height: number };
  attachmentSide: AttachmentSide;
  lengthA: number;
  spanA: number;
  houseFootprintPreset: ModulePlanModel['houseFootprintPreset'];
  houseFootprintParams: ModulePlanModel['houseFootprintParams'];
  isHipCorner: boolean;
  useTopProjectionBackedPlan: boolean;
  topProjection?: GeometryTopProjectionViewModel | null;
};

export type PlanSvgPointResolverSet = {
  resolveFootprintCanvasPoint: (svg: SVGSVGElement, clientX: number, clientY: number) => PlanSvgFootprintCanvasPoint | null;
  resolveRawPlanPoint: (svg: SVGSVGElement, clientX: number, clientY: number) => PlanPoint | null;
  resolveDeckDragPlanPoint: (svg: SVGSVGElement, clientX: number, clientY: number) => PlanPoint | null;
};

type PlanSvgFootprintBridgeTarget = {
  onSvgMount?: (node: SVGSVGElement | null) => void;
  onCanvasPointResolverChange?: (resolver: PlanSvgFootprintCanvasPointResolver | null) => void;
};

type PlanSvgInteractionBridgeTarget = {
  onSvgMount?: (node: SVGSVGElement | null) => void;
  onPlanPointResolverChange?: ((resolver: ((clientX: number, clientY: number) => PlanPoint | null) | null) => void) | undefined;
  onDeckDragPointResolverChange?: ((resolver: ((clientX: number, clientY: number) => PlanPoint | null) | null) => void) | undefined;
};

export function createPlanSvgPointResolvers(input: PlanSvgPointResolverInput): PlanSvgPointResolverSet {
  const resolveFootprintCanvasPoint = (
    svg: SVGSVGElement,
    clientX: number,
    clientY: number,
  ): PlanSvgFootprintCanvasPoint | null => {
    const rootPoint = resolveSvgRootPoint(svg, clientX, clientY);
    if (!rootPoint) return null;
    const resolved = resolvePlanSvgPointerFootprintPoint({
      rootPoint,
      rotationCenter: input.rotationFrame.center,
      rotationTurns: input.rotationFrame.turns,
      footprintRect: input.footprintRect,
      scale: input.scale,
      attachmentSide: input.attachmentSide,
      lengthA: input.lengthA,
      spanA: input.spanA,
      houseFootprintPreset: input.houseFootprintPreset,
      houseFootprintParams: input.houseFootprintParams,
      isHipCorner: input.isHipCorner,
    });
    return resolved
      ? {
          alongM: resolved.formatted.alongM,
          depthM: resolved.formatted.depthM,
          numericAlongM: resolved.numeric.alongM,
          numericDepthM: resolved.numeric.depthM,
        }
      : null;
  };

  const resolveRawPlanPoint = (svg: SVGSVGElement, clientX: number, clientY: number): PlanPoint | null => {
    const rootPoint = resolveSvgRootPoint(svg, clientX, clientY);
    if (!rootPoint || !Number.isFinite(input.scale) || input.scale <= 0) return null;
    const unrotatedPoint = rotatePointQuarterTurns(rootPoint, input.rotationFrame.center, -input.rotationFrame.turns);
    const projectedX = (unrotatedPoint.x - input.origin.x) / input.scale;
    const projectedY = (unrotatedPoint.y - input.origin.y) / input.scale;
    if (!Number.isFinite(projectedX) || !Number.isFinite(projectedY)) return null;
    return {
      x: projectedX,
      y: projectedY,
    };
  };

  const resolveDeckDragPlanPoint = (svg: SVGSVGElement, clientX: number, clientY: number): PlanPoint | null => {
    const rootPoint = resolveSvgRootPoint(svg, clientX, clientY);
    if (!rootPoint || !Number.isFinite(input.scale) || input.scale <= 0) return null;
    const unrotatedPoint = rotatePointQuarterTurns(rootPoint, input.rotationFrame.center, -input.rotationFrame.turns);
    return input.useTopProjectionBackedPlan && input.topProjection
      ? topProjectionSvgPointToPlanPoint(unrotatedPoint, input.topProjection, input.origin.x, input.origin.y, input.scale)
      : resolveRawPlanPoint(svg, clientX, clientY);
  };

  return {
    resolveFootprintCanvasPoint,
    resolveRawPlanPoint,
    resolveDeckDragPlanPoint,
  };
}

export function syncPlanSvgInteractionBridge(input: {
  node: SVGSVGElement | null;
  footprintEditor?: PlanSvgFootprintBridgeTarget;
  planInteraction?: PlanSvgInteractionBridgeTarget;
  resolvers: PlanSvgPointResolverSet;
}): void {
  input.footprintEditor?.onSvgMount?.(input.node);
  input.planInteraction?.onSvgMount?.(input.node);
  input.footprintEditor?.onCanvasPointResolverChange?.(
    input.node ? (clientX, clientY) => input.resolvers.resolveFootprintCanvasPoint(input.node!, clientX, clientY) : null,
  );
  input.planInteraction?.onPlanPointResolverChange?.(
    input.node ? (clientX, clientY) => input.resolvers.resolveRawPlanPoint(input.node!, clientX, clientY) : null,
  );
  input.planInteraction?.onDeckDragPointResolverChange?.(
    input.node ? (clientX, clientY) => input.resolvers.resolveDeckDragPlanPoint(input.node!, clientX, clientY) : null,
  );
}

export function resolvePlanSvgPointerFootprintPoint(input: PlanSvgPointerFootprintPointInput): PlanSvgPointerFootprintPoint | null {
  if (
    input.isHipCorner ||
    !Number.isFinite(input.rootPoint.x) ||
    !Number.isFinite(input.rootPoint.y) ||
    !Number.isFinite(input.rotationCenter.x) ||
    !Number.isFinite(input.rotationCenter.y) ||
    !Number.isFinite(input.footprintRect.x) ||
    !Number.isFinite(input.footprintRect.y) ||
    !Number.isFinite(input.footprintRect.width) ||
    !Number.isFinite(input.footprintRect.height) ||
    !Number.isFinite(input.scale) ||
    input.scale <= 0 ||
    !Number.isFinite(input.lengthA) ||
    !Number.isFinite(input.spanA)
  ) {
    return null;
  }

  const unrotatedPlanPoint = rotatePointQuarterTurns(input.rootPoint, input.rotationCenter, -input.rotationTurns);
  const footprintCenter = actualPergolaCenter(input.footprintRect);
  const localDims =
    input.attachmentSide === 'left' || input.attachmentSide === 'right'
      ? { widthM: input.spanA, depthM: input.lengthA }
      : { widthM: input.lengthA, depthM: input.spanA };
  const sideLocalPoint = rotatePointQuarterTurns(unrotatedPlanPoint, footprintCenter, -attachmentSideQuarterTurns(input.attachmentSide));
  const localX = (sideLocalPoint.x - (footprintCenter.x - (localDims.widthM * input.scale) / 2)) / input.scale;
  const localY = (sideLocalPoint.y - (footprintCenter.y - (localDims.depthM * input.scale) / 2)) / input.scale;
  const localLayout = buildHouseFootprintLocalLayout({
    pergolaWidthM: localDims.widthM,
    pergolaDepthM: localDims.depthM,
    preset: input.houseFootprintPreset,
    params: input.houseFootprintParams,
  });
  const alongM = localX - localLayout.resolved.offsetXM;
  const depthM = -localY - localLayout.resolved.setbackM;
  if (!Number.isFinite(alongM) || !Number.isFinite(depthM)) return null;

  return {
    formatted: {
      alongM: formatPlanPointerMetres(alongM),
      depthM: formatPlanPointerMetres(depthM),
    },
    numeric: {
      alongM,
      depthM,
    },
  };
}

function resolveSvgRootPoint(svg: SVGSVGElement, clientX: number, clientY: number): PlanSvgBridgePoint | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const svgPoint = svg.createSVGPoint();
  svgPoint.x = clientX;
  svgPoint.y = clientY;
  const rootPoint = svgPoint.matrixTransform(ctm.inverse());
  return {
    x: rootPoint.x,
    y: rootPoint.y,
  };
}

function rotatePointQuarterTurns(point: PlanSvgBridgePoint, center: PlanSvgBridgePoint, turns: number): PlanSvgBridgePoint {
  const normalized = ((turns % 4) + 4) % 4;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (normalized === 1) return { x: center.x + dy, y: center.y - dx };
  if (normalized === 2) return { x: center.x - dx, y: center.y - dy };
  if (normalized === 3) return { x: center.x - dy, y: center.y + dx };
  return point;
}

function actualPergolaCenter(rect: { x: number; y: number; width: number; height: number }): PlanSvgBridgePoint {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function formatPlanPointerMetres(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '') || '0';
}
