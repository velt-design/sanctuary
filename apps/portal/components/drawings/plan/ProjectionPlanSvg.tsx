import { useCallback, useMemo, useRef } from 'react';
import type { GeometryTopProjectionViewModel, Point2 } from '@sp/geometry';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';
import type {
  ObjectWorkbenchPlanCustomEdgeCandidate,
  ObjectWorkbenchPlanOverlay,
  ObjectWorkbenchPlanPresetDimensionAnnotation,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import {
  buildProjectionPlanRenderGraph,
  topProjectionPlanLayer,
  topProjectionRole,
  topProjectionShapeVisible,
} from '@/lib/drawings/views/plan/planRenderGraph';
import {
  buildTopProjectionPlanCoordinateAdapter,
  topProjectionPolygonToPlanSvg,
} from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { ObjectWorkbenchPreviewOverlay } from '@/app/staff/calculator/ModuleDrawingContracts';
import type { ModuleFootprintEditorProps } from '@/app/staff/calculator/ModuleDrawingContracts';
import type { ModulePlanModel } from '@/app/staff/calculator/moduleViews';
import { ModulePlanFootprintEditLayer } from '@/app/staff/calculator/ModulePlanFootprintEditLayer';
import { resolveFootprintCanvasLayout } from '@/app/staff/calculator/ModulePlanFootprintPresentation';
import styles from '@/app/staff/calculator/CalculatorGrid.module.css';
import { ProjectionPlanDimensions } from './ProjectionPlanDimensions';
import { ProjectionPlanHitTargets } from './ProjectionPlanHitTargets';
import {
  ProjectionCommittedBodyLayer,
  ProjectionContextLineLayer,
  ProjectionObjectBadges,
  ProjectionPreviewLayer,
  ProjectionSelectionOutlineLayer,
  type ProjectionPlanOverlayShape,
  type ProjectionPlanPreviewShape,
  type ProjectionPlanShapeDragStartMeta,
  type ProjectionPlanTopProjectionItem,
} from './ProjectionPlanLayers';

const PROJECTION_PLAN_PADDING = 6;
const PROJECTION_MODEL_UNITS_PER_METRE = 100;

type ProjectionPlanLayout = {
  baseX: number;
  baseY: number;
  scale: number;
  viewBox: string;
  width: number;
  height: number;
  worldBoxValue: string;
};

type ProjectionBoundsMm = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthMm: number;
  heightMm: number;
};

export type ProjectionPlanDiagnostics = {
  renderContract: 'top_projection_only';
  topProjectionParityStatus: 'pass' | 'fail';
  topProjectionScreenAxis: string;
  topProjectionTopVisibleCount: number;
  topProjectionContextCount: number;
  topProjectionHiddenCount: number;
  topProjectionRenderedCount: number;
  topProjectionHiddenRenderedCount: number;
  renderedTopProjectionContextLineCount: number;
  renderedTopProjectionWallDetailCount: number;
  committedTopProjectionBodyCount: number;
  committedTopProjectionObjectCount: number;
  visibleLegacyPlanOverlayBodyCount: number;
  visibleGeometryFallbackOverlayBodyCount: number;
  visibleTopProjectionContextOverlayBodyCount: number;
  visibleTopProjectionCommittedOverlayBodyCount: number;
  renderedTopProjectionContextBodyCount: number;
  suppressedTopProjectionContextBodyCount: number;
  suppressedTopProjectionTopVisibleBodyCount: number;
  duplicateCommittedBodyCount: number;
  duplicateSemanticOwnerCount: number;
};

export type ProjectionPlanSvgProps = {
  artifact: WorkbenchSolvedGeometryArtifact;
  visibility?: DrawingWorkbenchVisibilityState;
  objectWorkbenchPlanOverlay?: ObjectWorkbenchPlanOverlay | null;
  objectWorkbenchPreviewOverlay?: ObjectWorkbenchPreviewOverlay | null;
  legacyFootprintEditPlanModel?: ModulePlanModel | null;
  footprintEditor?: ModuleFootprintEditorProps;
  pergolaTargetId?: string | null;
  hoveredObjectWorkbenchDeckId?: string | null;
  activeObjectWorkbenchCustomEdgeId?: string | null;
  onObjectWorkbenchShapeSelect?: (target: { ownerKind: 'footprint' | 'deck' | 'opening'; ownerId: string }) => void;
  onPergolaSelect?: (pergolaId: string) => void;
  onObjectWorkbenchDeckHoverChange?: (deckId: string | null) => void;
  onCanvasSelect?: () => void;
  onObjectWorkbenchShapeDragStart?: (
    meta: ProjectionPlanShapeDragStartMeta,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
  onObjectWorkbenchCustomEdgeSelect?: (target: { ownerKind: 'footprint' | 'deck'; ownerId: string; edgeIndex: number }) => void;
  onObjectWorkbenchDimensionActivate?: (
    annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate,
    target: SVGTextElement,
  ) => void;
  onSvgMount?: (node: SVGSVGElement | null) => void;
  onCanvasPointResolverChange?: ModuleFootprintEditorProps['onCanvasPointResolverChange'];
  onPlanPointResolverChange?: ((resolver: ((clientX: number, clientY: number) => PlanPoint | null) | null) => void) | undefined;
  onDeckDragPointResolverChange?: ((resolver: ((clientX: number, clientY: number) => PlanPoint | null) | null) => void) | undefined;
};

function defaultVisibility(): DrawingWorkbenchVisibilityState {
  return {
    house: true,
    pergolas: true,
    decks: true,
    openings: true,
  };
}

function resolveProjectionPlanLayout(projection: GeometryTopProjectionViewModel): ProjectionPlanLayout {
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
  const scale = PROJECTION_MODEL_UNITS_PER_METRE;
  const width = safeWidthM * scale + PROJECTION_PLAN_PADDING * 2;
  const height = safeHeightM * scale + PROJECTION_PLAN_PADDING * 2;

  return {
    baseX: PROJECTION_PLAN_PADDING - (extents.minX / 1000) * scale,
    baseY: PROJECTION_PLAN_PADDING - (extents.minY / 1000) * scale,
    scale,
    viewBox: `0 0 ${width.toFixed(2)} ${height.toFixed(2)}`,
    width,
    height,
    worldBoxValue: `${extents.minX} ${extents.minY} ${extents.widthMm} ${extents.heightMm}`,
  };
}

function resolveProjectionBounds(points: Point2[]): ProjectionBoundsMm | null {
  if (!points.length) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    widthMm: Math.max(1, maxX - minX),
    heightMm: Math.max(1, maxY - minY),
  };
}

function formatProjectionBounds(bounds: ProjectionBoundsMm): string {
  return `${bounds.minX} ${bounds.minY} ${bounds.widthMm} ${bounds.heightMm}`;
}

function projectionBoundsToSvgRect(
  bounds: ProjectionBoundsMm,
  adapter: ReturnType<typeof buildTopProjectionPlanCoordinateAdapter>,
): { x: number; y: number; width: number; height: number } {
  const corners = [
    adapter.projectionToSvg({ x: bounds.minX, y: bounds.minY }),
    adapter.projectionToSvg({ x: bounds.maxX, y: bounds.minY }),
    adapter.projectionToSvg({ x: bounds.maxX, y: bounds.maxY }),
    adapter.projectionToSvg({ x: bounds.minX, y: bounds.maxY }),
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

function polygonAreaAbs(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area / 2);
}

function clientPointToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
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

function sourceVisibleForFamily(
  shape: ObjectWorkbenchPlanOverlay['shapes'][number],
  visibility: DrawingWorkbenchVisibilityState,
): boolean {
  if (shape.ownerKind === 'footprint') return visibility.house;
  if (shape.ownerKind === 'deck') return visibility.decks;
  if (shape.ownerKind === 'opening') return visibility.openings;
  return true;
}

function projectionInteractionShapeAllowed(shape: ObjectWorkbenchPlanOverlay['shapes'][number]): boolean {
  if (shape.source === 'top_projection_committed') return true;
  return shape.ownerKind === 'opening';
}

function projectionPointFromPlanPoint(point: PlanPoint): Point2 {
  return {
    x: point.x * 1000,
    y: point.y * 1000,
  };
}

export function ProjectionPlanSvg({
  artifact,
  visibility,
  objectWorkbenchPlanOverlay,
  objectWorkbenchPreviewOverlay,
  legacyFootprintEditPlanModel,
  footprintEditor,
  pergolaTargetId,
  hoveredObjectWorkbenchDeckId,
  activeObjectWorkbenchCustomEdgeId,
  onObjectWorkbenchShapeSelect,
  onPergolaSelect,
  onObjectWorkbenchDeckHoverChange,
  onCanvasSelect,
  onObjectWorkbenchShapeDragStart,
  onObjectWorkbenchCustomEdgeSelect,
  onObjectWorkbenchDimensionActivate,
  onSvgMount,
  onCanvasPointResolverChange,
  onPlanPointResolverChange,
  onDeckDragPointResolverChange,
}: ProjectionPlanSvgProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const projection = artifact.topProjection;
  const familyVisibility = visibility ?? defaultVisibility();
  const layout = useMemo(() => resolveProjectionPlanLayout(projection), [projection]);
  const adapter = useMemo(
    () =>
      buildTopProjectionPlanCoordinateAdapter({
        projection,
        baseX: layout.baseX,
        baseY: layout.baseY,
        scale: layout.scale,
      }),
    [layout.baseX, layout.baseY, layout.scale, projection],
  );

  const topProjectionShapes = useMemo(
    () =>
      projection.shapes
        .filter((shape) => topProjectionShapeVisible(shape, familyVisibility))
        .map((shape) => ({
          shape,
          points: topProjectionPolygonToPlanSvg(shape.polygon, projection, layout.baseX, layout.baseY, layout.scale),
        })),
    [familyVisibility, layout.baseX, layout.baseY, layout.scale, projection],
  );
  const renderGraph = useMemo(
    () =>
      buildProjectionPlanRenderGraph(topProjectionShapes, {
        projectionOnlyModelSpace: true,
      }),
    [topProjectionShapes],
  );
  const hideProjectionFootprint = Boolean(footprintEditor?.hideHouseFootprint);
  const committedBodies = (hideProjectionFootprint
    ? renderGraph.committedBodies.filter(
        ({ shape }) => !(shape.family === 'house' && shape.kind === 'footprint'),
      )
    : renderGraph.committedBodies) as ProjectionPlanTopProjectionItem[];
  const contextLines = renderGraph.contextLines as ProjectionPlanTopProjectionItem[];
  const renderedTopProjectionShapes = [...committedBodies, ...contextLines];
  const focusBounds = useMemo(() => {
    const preferredFocusBodies = committedBodies.filter(
      ({ shape }) => shape.family === 'pergola' && (shape.kind === 'roof_plane' || shape.kind === 'roof_cladding'),
    );
    const focusBodies = preferredFocusBodies.length ? preferredFocusBodies : committedBodies;
    return resolveProjectionBounds(focusBodies.flatMap(({ shape }) => shape.polygon)) ?? projection.extents;
  }, [committedBodies, projection.extents]);
  const focusBoxValue = useMemo(() => formatProjectionBounds(focusBounds), [focusBounds]);
  const focusTargetRect = useMemo(
    () => projectionBoundsToSvgRect(focusBounds, adapter),
    [adapter, focusBounds],
  );

  const projectionOverlayOwnerKeys = useMemo(() => {
    return new Set(
      (objectWorkbenchPlanOverlay?.shapes ?? [])
        .filter(projectionInteractionShapeAllowed)
        .filter((shape) => sourceVisibleForFamily(shape, familyVisibility))
        .map((shape) => `${shape.ownerKind}:${shape.ownerId}`),
    );
  }, [familyVisibility, objectWorkbenchPlanOverlay]);

  const projectOverlayPoint = useCallback(
    (point: PlanPoint) => adapter.projectionToSvg(projectionPointFromPlanPoint(point)),
    [adapter],
  );

  const overlayShapes = useMemo<ProjectionPlanOverlayShape[]>(() => {
    return (objectWorkbenchPlanOverlay?.shapes ?? [])
      .filter(projectionInteractionShapeAllowed)
      .filter((shape) => sourceVisibleForFamily(shape, familyVisibility))
      .map((shape) => ({
        ...shape,
        points: shape.polygon.map(projectOverlayPoint),
        detailSegments: [],
        deckInteractionSvg: shape.deckInteraction
          ? {
              ...shape.deckInteraction,
              hostEdgeStart: projectOverlayPoint(shape.deckInteraction.hostEdgeStart),
              hostEdgeEnd: projectOverlayPoint(shape.deckInteraction.hostEdgeEnd),
            }
          : null,
        openingInteractionSvg: shape.openingInteraction
          ? {
              ...shape.openingInteraction,
              hostEdgeStart: projectOverlayPoint(shape.openingInteraction.hostEdgeStart),
              hostEdgeEnd: projectOverlayPoint(shape.openingInteraction.hostEdgeEnd),
            }
          : null,
      }));
  }, [familyVisibility, objectWorkbenchPlanOverlay, projectOverlayPoint]);

  const footprintCanvasRect = useMemo(() => {
    const extents = projection.extents;
    if (!extents) return { x: PROJECTION_PLAN_PADDING, y: PROJECTION_PLAN_PADDING, width: 0.1, height: 0.1 };
    return {
      x: layout.baseX + (extents.minX / 1000) * layout.scale,
      y: layout.baseY + (extents.minY / 1000) * layout.scale,
      width: Math.max(0.1, (extents.widthMm / 1000) * layout.scale),
      height: Math.max(0.1, (extents.heightMm / 1000) * layout.scale),
    };
  }, [layout.baseX, layout.baseY, layout.scale, projection.extents]);
  const footprintCanvasLayout = useMemo(() => {
    if (!legacyFootprintEditPlanModel || !footprintEditor) return null;
    return resolveFootprintCanvasLayout({
      model: legacyFootprintEditPlanModel,
      rect: footprintCanvasRect,
      scale: layout.scale,
      rotationCenter: {
        x: footprintCanvasRect.x + footprintCanvasRect.width / 2,
        y: footprintCanvasRect.y + footprintCanvasRect.height / 2,
      },
      rotationTurns: 0,
      customPolygonOverride: footprintEditor.customPolygonOverride,
      customPolygonOpen: footprintEditor.customPolygonOpen,
      customPolygonConfirmedPointCount: footprintEditor.customPolygonConfirmedPointCount,
      customPolygonPreviewPointKind: footprintEditor.customPolygonPreviewPointKind,
      customPolygonCloseReady: footprintEditor.customPolygonCloseReady,
      customPolygonCloseHovered: footprintEditor.customPolygonCloseHovered,
      customPolygonLandingPoint: footprintEditor.customPolygonLandingPoint,
      customPolygonLockedDistanceM: footprintEditor.customPolygonLockedDistanceM,
      hideHouseFootprint: footprintEditor.hideHouseFootprint,
    });
  }, [footprintCanvasRect, footprintEditor, layout.scale, legacyFootprintEditPlanModel]);

  const presetAnnotations = useMemo(
    () =>
      (objectWorkbenchPlanOverlay?.presetAnnotations ?? [])
        .filter((annotation) => projectionOverlayOwnerKeys.has(`${annotation.ownerKind}:${annotation.ownerId}`))
        .filter((annotation) => sourceVisibleForFamily({ ownerKind: annotation.ownerKind } as ObjectWorkbenchPlanOverlay['shapes'][number], familyVisibility))
        .map((annotation) => ({
          ...annotation,
          witnessStart: projectOverlayPoint(annotation.witnessStart),
          witnessEnd: projectOverlayPoint(annotation.witnessEnd),
          lineStart: projectOverlayPoint(annotation.lineStart),
          lineEnd: projectOverlayPoint(annotation.lineEnd),
        })),
    [familyVisibility, objectWorkbenchPlanOverlay, projectOverlayPoint, projectionOverlayOwnerKeys],
  );
  const customEdgeCandidates = useMemo(
    () =>
      (objectWorkbenchPlanOverlay?.customEdgeCandidates ?? [])
        .filter((annotation) => projectionOverlayOwnerKeys.has(`${annotation.ownerKind}:${annotation.ownerId}`))
        .filter((annotation) => sourceVisibleForFamily({ ownerKind: annotation.ownerKind } as ObjectWorkbenchPlanOverlay['shapes'][number], familyVisibility))
        .map((annotation) => ({
          ...annotation,
          witnessStart: projectOverlayPoint(annotation.witnessStart),
          witnessEnd: projectOverlayPoint(annotation.witnessEnd),
          lineStart: projectOverlayPoint(annotation.lineStart),
          lineEnd: projectOverlayPoint(annotation.lineEnd),
        })),
    [familyVisibility, objectWorkbenchPlanOverlay, projectOverlayPoint, projectionOverlayOwnerKeys],
  );

  const previewShape = useMemo<ProjectionPlanPreviewShape>(() => {
    if (!objectWorkbenchPreviewOverlay) return null;
    if (!projectionOverlayOwnerKeys.has(`${objectWorkbenchPreviewOverlay.ownerKind}:${objectWorkbenchPreviewOverlay.ownerId}`)) return null;
    return {
      ownerKind: objectWorkbenchPreviewOverlay.ownerKind,
      ownerId: objectWorkbenchPreviewOverlay.ownerId,
      points: objectWorkbenchPreviewOverlay.polygon.map(projectOverlayPoint),
      bodyState: objectWorkbenchPreviewOverlay.bodyState,
      anchorPoint: objectWorkbenchPreviewOverlay.anchorPoint
        ? projectOverlayPoint(objectWorkbenchPreviewOverlay.anchorPoint)
        : null,
      lockedCornerPoint: objectWorkbenchPreviewOverlay.lockedCornerPoint
        ? projectOverlayPoint(objectWorkbenchPreviewOverlay.lockedCornerPoint)
        : null,
      endCatchPoint: objectWorkbenchPreviewOverlay.endCatchPoint
        ? projectOverlayPoint(objectWorkbenchPreviewOverlay.endCatchPoint)
        : null,
      referenceGuide: objectWorkbenchPreviewOverlay.referenceGuide
        ? {
            start: projectOverlayPoint(objectWorkbenchPreviewOverlay.referenceGuide.start),
            end: projectOverlayPoint(objectWorkbenchPreviewOverlay.referenceGuide.end),
            state: objectWorkbenchPreviewOverlay.referenceGuide.state,
          }
        : null,
      targetHighlights: objectWorkbenchPreviewOverlay.targetHighlights.map((targetHighlight) => ({
        start: projectOverlayPoint(targetHighlight.start),
        end: projectOverlayPoint(targetHighlight.end),
        state: targetHighlight.state,
      })),
    };
  }, [objectWorkbenchPreviewOverlay, projectOverlayPoint, projectionOverlayOwnerKeys]);

  const diagnostics = useMemo<ProjectionPlanDiagnostics>(() => {
    const topProjectionHiddenRenderedCount = renderedTopProjectionShapes.filter(({ shape }) => topProjectionRole(shape) === 'hidden_from_top').length;
    const topProjectionScreenAxis = `${projection.screenAxis.x}_${projection.screenAxis.y}`;
    const renderedTopProjectionContextBodyCount = renderedTopProjectionShapes.filter(
      ({ shape }) => topProjectionRole(shape) === 'context' && topProjectionPlanLayer(shape) === 'committedBodies',
    ).length;
    const committedOwnerKeys = new Set(
      committedBodies.map(({ shape }) => `${shape.family}:${shape.kind}:${shape.sourceId ?? shape.sourceObjectId}`),
    );
    return {
      renderContract: 'top_projection_only',
      topProjectionParityStatus:
        topProjectionScreenAxis === 'world_x_left_world_y_down' && topProjectionHiddenRenderedCount === 0
          ? 'pass'
          : 'fail',
      topProjectionScreenAxis,
      topProjectionTopVisibleCount: projection.shapes.filter((shape) => topProjectionRole(shape) === 'top_visible').length,
      topProjectionContextCount: projection.shapes.filter((shape) => topProjectionRole(shape) === 'context').length,
      topProjectionHiddenCount: projection.shapes.filter((shape) => topProjectionRole(shape) === 'hidden_from_top').length,
      topProjectionRenderedCount: renderedTopProjectionShapes.length,
      topProjectionHiddenRenderedCount,
      renderedTopProjectionContextLineCount: contextLines.length,
      renderedTopProjectionWallDetailCount: contextLines.filter(
        ({ shape }) =>
          shape.sourceType === 'house_line' &&
          shape.kind === 'wall_segment' &&
          shape.metadata?.planDetailRole === 'wall_edge',
      ).length,
      committedTopProjectionBodyCount: committedBodies.length,
      committedTopProjectionObjectCount: committedOwnerKeys.size,
      visibleLegacyPlanOverlayBodyCount: 0,
      visibleGeometryFallbackOverlayBodyCount: 0,
      visibleTopProjectionContextOverlayBodyCount: 0,
      visibleTopProjectionCommittedOverlayBodyCount: overlayShapes.filter((shape) => shape.selected).length,
      renderedTopProjectionContextBodyCount,
      suppressedTopProjectionContextBodyCount: renderGraph.suppressed.filter(({ shape }) => topProjectionRole(shape) === 'context').length,
      suppressedTopProjectionTopVisibleBodyCount: renderGraph.suppressed.filter(({ shape }) => topProjectionRole(shape) === 'top_visible').length,
      duplicateCommittedBodyCount: 0,
      duplicateSemanticOwnerCount: 0,
    };
  }, [committedBodies, contextLines, overlayShapes, projection, renderGraph.suppressed, renderedTopProjectionShapes]);

  const handleSvgRef = useCallback(
    (node: SVGSVGElement | null) => {
      svgRef.current = node;
      onSvgMount?.(node);
      const resolver = node
        ? (clientX: number, clientY: number) => {
            const svgPoint = clientPointToSvg(node, clientX, clientY);
            return svgPoint ? adapter.svgToProjectionPlanPoint(svgPoint) : null;
          }
        : null;
      const footprintResolver = node
        ? (clientX: number, clientY: number) => {
            const svgPoint = clientPointToSvg(node, clientX, clientY);
            const planPoint = svgPoint ? adapter.svgToProjectionPlanPoint(svgPoint) : null;
            if (!planPoint) return null;
            const alongM = Number(planPoint.x.toFixed(3));
            const depthM = Number(planPoint.y.toFixed(3));
            return {
              alongM: String(alongM),
              depthM: String(depthM),
              numericAlongM: alongM,
              numericDepthM: depthM,
            };
          }
        : null;
      onCanvasPointResolverChange?.(footprintResolver);
      onPlanPointResolverChange?.(resolver);
      onDeckDragPointResolverChange?.(resolver);
    },
    [adapter, onCanvasPointResolverChange, onDeckDragPointResolverChange, onPlanPointResolverChange, onSvgMount],
  );

  const handleCanvasClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget) return;
    onCanvasSelect?.();
  };

  const largestPergolaHitPoints =
    committedBodies
      .filter(({ shape }) => shape.family === 'pergola' && (shape.kind === 'roof_plane' || shape.kind === 'roof_cladding'))
      .sort((left, right) => polygonAreaAbs(right.points) - polygonAreaAbs(left.points))[0]?.points ?? [];

  return (
    <svg
      ref={handleSvgRef}
      viewBox={layout.viewBox}
      width={layout.width}
      height={layout.height}
      overflow="visible"
      data-model-space-svg="plan"
      data-model-space-render-contract={diagnostics.renderContract}
      data-model-space-view-box={layout.viewBox}
      data-model-space-world-box={layout.worldBoxValue}
      data-model-space-focus-box={focusBoxValue}
      data-plan-render-source="geometry"
      data-plan-render-status="geometry_ready"
      data-top-projection-parity-status={diagnostics.topProjectionParityStatus}
      data-top-projection-screen-axis={diagnostics.topProjectionScreenAxis}
      data-top-projection-top-visible-count={diagnostics.topProjectionTopVisibleCount}
      data-top-projection-context-count={diagnostics.topProjectionContextCount}
      data-top-projection-hidden-count={diagnostics.topProjectionHiddenCount}
      data-top-projection-rendered-count={diagnostics.topProjectionRenderedCount}
      data-top-projection-hidden-rendered-count={diagnostics.topProjectionHiddenRenderedCount}
      data-plan-rendered-context-line-count={diagnostics.renderedTopProjectionContextLineCount}
      data-plan-wall-detail-count={diagnostics.renderedTopProjectionWallDetailCount}
      data-plan-committed-top-projection-body-count={diagnostics.committedTopProjectionBodyCount}
      data-plan-committed-top-projection-object-count={diagnostics.committedTopProjectionObjectCount}
      data-plan-object-overlay-body-count="0"
      data-plan-visible-legacy-overlay-body-count={diagnostics.visibleLegacyPlanOverlayBodyCount}
      data-plan-visible-geometry-fallback-overlay-body-count={diagnostics.visibleGeometryFallbackOverlayBodyCount}
      data-plan-visible-top-projection-context-overlay-body-count={diagnostics.visibleTopProjectionContextOverlayBodyCount}
      data-plan-visible-top-projection-committed-overlay-body-count={diagnostics.visibleTopProjectionCommittedOverlayBodyCount}
      data-plan-rendered-context-body-count={diagnostics.renderedTopProjectionContextBodyCount}
      data-plan-suppressed-context-body-count={diagnostics.suppressedTopProjectionContextBodyCount}
      data-plan-suppressed-top-visible-body-count={diagnostics.suppressedTopProjectionTopVisibleBodyCount}
      data-plan-duplicate-visual-body-count={diagnostics.duplicateCommittedBodyCount}
      data-plan-duplicate-semantic-owner-count={diagnostics.duplicateSemanticOwnerCount}
      data-plan-projection-native-surface="true"
      data-plan-top-projection-hit-points={largestPergolaHitPoints.length}
      role="img"
      aria-label="Module plan view"
      className={`${styles.modulePlanSvg} ${styles.modulePlanSvgBare} ${styles.modulePlanSvgModel}`}
      onClick={handleCanvasClick}
    >
      <rect
        x={focusTargetRect.x}
        y={focusTargetRect.y}
        width={focusTargetRect.width}
        height={focusTargetRect.height}
        fill="transparent"
        pointerEvents="none"
        data-model-space-focus-target="true"
      />
      <ProjectionCommittedBodyLayer
        items={committedBodies}
        projection={projection}
        pergolaTargetId={pergolaTargetId}
        onPergolaSelect={onPergolaSelect}
      />
      <ProjectionContextLineLayer items={contextLines} projection={projection} />
      <ProjectionSelectionOutlineLayer shapes={overlayShapes} />
      <ProjectionPreviewLayer previewShape={previewShape} />
      <ProjectionPlanDimensions
        presetAnnotations={presetAnnotations}
        customEdgeCandidates={customEdgeCandidates}
        activeCustomEdgeId={activeObjectWorkbenchCustomEdgeId ?? null}
        previewShape={previewShape}
        onCustomEdgeSelect={onObjectWorkbenchCustomEdgeSelect}
        onDimensionActivate={onObjectWorkbenchDimensionActivate}
      />
      <ProjectionPlanHitTargets
        shapes={overlayShapes}
        previewShape={previewShape}
        hoveredDeckId={hoveredObjectWorkbenchDeckId}
        onDeckHoverChange={onObjectWorkbenchDeckHoverChange}
        onShapeSelect={onObjectWorkbenchShapeSelect}
        onShapeDragStart={onObjectWorkbenchShapeDragStart}
      />
      {footprintEditor && footprintCanvasLayout ? (
        <ModulePlanFootprintEditLayer
          allowAttachmentSideCanvasSelect={false}
          allowResizeEdgeDrag={false}
          canEditFootprint={true}
          customPolygonHasError={Boolean(footprintEditor.customPolygonHasError)}
          edgeFrames={[]}
          editorSurface="model"
          footprintCanvasLayout={footprintCanvasLayout}
          footprintEditor={footprintEditor}
          handleSpecs={[]}
          resizeEdgeSpecs={[]}
          scale={layout.scale}
          showFootprintControls={true}
          attachmentSideCanvasActiveSide="rear"
        />
      ) : null}
      <ProjectionObjectBadges shapes={overlayShapes} />
    </svg>
  );
}
