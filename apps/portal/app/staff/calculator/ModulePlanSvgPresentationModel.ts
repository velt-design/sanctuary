import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { ObjectInteractionPreviewOverlay } from '@/lib/drawings/interactions/objectInteractionEngine';
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
  topProjectionShapeIsCommittedBody,
  topProjectionShapeVisible,
} from '@/lib/drawings/views/plan/planRenderGraph';
import { topProjectionPointToPlanSvg, topProjectionPolygonToPlanSvg } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type {
  ObjectWorkbenchCustomEdgeAnnotation,
  ObjectWorkbenchOverlayShape,
  ObjectWorkbenchPresetDimensionAnnotation,
  ObjectWorkbenchPreviewShape,
  TopProjectionLayerItem,
} from './ModulePlanLayerRenderers';

export type PlanSvgPresentationDiagnostics = {
  renderContract: 'top_projection_only' | 'legacy_or_fallback';
  topProjectionParityStatus: 'pass' | 'fail' | null;
  topProjectionScreenAxis: string | null;
  topProjectionTopVisibleCount: number;
  topProjectionContextCount: number;
  topProjectionHiddenCount: number;
  topProjectionRenderedCount: number;
  topProjectionHiddenRenderedCount: number;
  renderedTopProjectionContextLineCount: number;
  renderedTopProjectionWallDetailCount: number;
  selectedDeckSnapFrameSource: string | null;
  committedTopProjectionBodyCount: number;
  committedTopProjectionObjectCount: number;
  objectWorkbenchRenderedBodyCount: number;
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

export type PlanSvgPresentationModel = {
  topProjectionShapes: Array<Omit<TopProjectionLayerItem, 'layer'>>;
  renderedTopProjectionShapes: TopProjectionLayerItem[];
  committedTopProjectionBodies: TopProjectionLayerItem[];
  renderedTopProjectionContextLines: TopProjectionLayerItem[];
  topProjectionPergolaHitPoints: Array<{ x: number; y: number }>;
  visibleObjectWorkbenchDeckIds: Set<string>;
  objectWorkbenchOverlayShapes: ObjectWorkbenchOverlayShape[];
  renderObjectWorkbenchCommittedBodies: boolean;
  objectWorkbenchPresetAnnotations: ObjectWorkbenchPresetDimensionAnnotation[];
  objectWorkbenchCustomEdgeCandidates: ObjectWorkbenchCustomEdgeAnnotation[];
  objectWorkbenchPreviewShape: ObjectWorkbenchPreviewShape;
  diagnostics: PlanSvgPresentationDiagnostics;
};

export function buildPlanSvgPresentationModel(input: {
  isModel: boolean;
  useTopProjectionBackedPlan: boolean;
  useProjectionOnlyModelSpacePlan: boolean;
  modelSpaceTopProjection: GeometryTopProjectionViewModel | null;
  familyVisibility: DrawingWorkbenchVisibilityState;
  baseX: number;
  baseY: number;
  scale: number;
  rawObjectWorkbenchOverlayShapes: ObjectWorkbenchPlanOverlay['shapes'];
  rawObjectWorkbenchPresetAnnotations: ObjectWorkbenchPlanPresetDimensionAnnotation[];
  rawObjectWorkbenchCustomEdgeCandidates: ObjectWorkbenchPlanCustomEdgeCandidate[];
  rawObjectWorkbenchPreviewShape: ObjectInteractionPreviewOverlay<PlanPoint> | null;
}): PlanSvgPresentationModel {
  const projectObjectWorkbenchPoint =
    input.useTopProjectionBackedPlan && input.modelSpaceTopProjection
      ? (point: PlanPoint) =>
          topProjectionPointToPlanSvg(
            { x: point.x * 1000, y: point.y * 1000 },
            input.modelSpaceTopProjection!,
            input.baseX,
            input.baseY,
            input.scale,
          )
      : (point: PlanPoint) => ({
          x: input.baseX + point.x * input.scale,
          y: input.baseY + point.y * input.scale,
        });

  const topProjectionShapes =
    input.useTopProjectionBackedPlan && input.modelSpaceTopProjection
      ? input.modelSpaceTopProjection.shapes
          .filter((shape) => topProjectionShapeVisible(shape, input.familyVisibility))
          .map((shape) => ({
            shape,
            points: topProjectionPolygonToPlanSvg(
              shape.polygon,
              input.modelSpaceTopProjection!,
              input.baseX,
              input.baseY,
              input.scale,
            ),
          }))
      : [];

  const planRenderGraph = buildProjectionPlanRenderGraph(topProjectionShapes, {
    projectionOnlyModelSpace: input.useProjectionOnlyModelSpacePlan,
  });
  const committedTopProjectionBodies = planRenderGraph.committedBodies;
  const renderedTopProjectionContextLines = planRenderGraph.contextLines;
  const renderedTopProjectionShapes = [
    ...committedTopProjectionBodies,
    ...renderedTopProjectionContextLines,
  ];
  const suppressedTopProjectionOwnershipBodyCount = planRenderGraph.suppressed.filter(({ shape }) =>
    topProjectionShapeIsCommittedBody(shape),
  ).length;

  const visibleRawObjectWorkbenchOverlayShapesAllSources = input.rawObjectWorkbenchOverlayShapes.filter((shape) => {
    switch (shape.ownerKind) {
      case 'footprint':
        return input.familyVisibility.house;
      case 'deck':
        return input.familyVisibility.decks;
      case 'opening':
        return input.familyVisibility.openings;
      default:
        return true;
    }
  });
  const visibleRawObjectWorkbenchOverlayShapes = visibleRawObjectWorkbenchOverlayShapesAllSources.filter(
    (shape) => !input.useProjectionOnlyModelSpacePlan || shape.source === 'top_projection_committed',
  );
  const selectedDeckSnapFrameSource =
    input.rawObjectWorkbenchOverlayShapes.find((shape) => shape.ownerKind === 'deck' && shape.selected)?.deckInteraction?.snapFrameSource ?? null;
  const projectionCommittedOverlayOwnerKeys = new Set(
    visibleRawObjectWorkbenchOverlayShapes
      .filter((shape) => shape.source === 'top_projection_committed')
      .map((shape) => `${shape.ownerKind}:${shape.ownerId}`),
  );
  const visibleObjectWorkbenchDeckIds = new Set(
    visibleRawObjectWorkbenchOverlayShapes
      .filter((shape) => shape.ownerKind === 'deck')
      .map((shape) => shape.ownerId),
  );

  const objectWorkbenchOverlayShapes =
    input.isModel
      ? visibleRawObjectWorkbenchOverlayShapes.map((shape) => ({
          ...shape,
          points: shape.polygon.map((point) => projectObjectWorkbenchPoint(point)),
          detailSegments: (shape.detailSegments ?? []).map((segment) => ({
            start: projectObjectWorkbenchPoint(segment.start),
            end: projectObjectWorkbenchPoint(segment.end),
          })),
          deckInteraction: shape.deckInteraction,
          deckInteractionSvg: shape.deckInteraction
            ? {
                ...shape.deckInteraction,
                hostEdgeStart: projectObjectWorkbenchPoint(shape.deckInteraction.hostEdgeStart),
                hostEdgeEnd: projectObjectWorkbenchPoint(shape.deckInteraction.hostEdgeEnd),
              }
            : null,
          openingInteraction: shape.openingInteraction
            ? {
                ...shape.openingInteraction,
                hostEdgeStart: projectObjectWorkbenchPoint(shape.openingInteraction.hostEdgeStart),
                hostEdgeEnd: projectObjectWorkbenchPoint(shape.openingInteraction.hostEdgeEnd),
              }
            : null,
        }))
      : [];

  const renderObjectWorkbenchCommittedBodies = !input.useTopProjectionBackedPlan;
  const objectWorkbenchRenderedBodyCount = renderObjectWorkbenchCommittedBodies ? objectWorkbenchOverlayShapes.length : 0;
  const objectWorkbenchVisibleBodyOverlayShapes = renderObjectWorkbenchCommittedBodies
    ? objectWorkbenchOverlayShapes
    : objectWorkbenchOverlayShapes.filter((shape) => shape.selected);
  const countVisibleOverlayBodiesBySource = (source: ObjectWorkbenchPlanOverlay['shapes'][number]['source']) =>
    objectWorkbenchVisibleBodyOverlayShapes.filter((shape) => shape.source === source).length;
  const visibleLegacyPlanOverlayBodyCount = countVisibleOverlayBodiesBySource('geometry');
  const visibleGeometryFallbackOverlayBodyCount =
    countVisibleOverlayBodiesBySource('geometry_derived') + countVisibleOverlayBodiesBySource('geometry_plan_fallback');
  const visibleTopProjectionContextOverlayBodyCount = countVisibleOverlayBodiesBySource('top_projection_context');
  const visibleTopProjectionCommittedOverlayBodyCount = countVisibleOverlayBodiesBySource('top_projection_committed');
  const wrongSourceVisibleOverlayBodyCount = input.useTopProjectionBackedPlan
    ? visibleLegacyPlanOverlayBodyCount + visibleGeometryFallbackOverlayBodyCount + visibleTopProjectionContextOverlayBodyCount
    : 0;

  const objectWorkbenchPresetAnnotations =
    input.isModel
      ? input.rawObjectWorkbenchPresetAnnotations
          .filter((annotation) => {
            if (
              input.useProjectionOnlyModelSpacePlan &&
              !projectionCommittedOverlayOwnerKeys.has(`${annotation.ownerKind}:${annotation.ownerId}`)
            ) {
              return false;
            }
            switch (annotation.ownerKind) {
              case 'footprint':
                return input.familyVisibility.house;
              case 'deck':
                return input.familyVisibility.decks;
              case 'opening':
                return input.familyVisibility.openings;
              default:
                return true;
            }
          })
          .map((annotation) => ({
            ...annotation,
            witnessStart: projectObjectWorkbenchPoint(annotation.witnessStart),
            witnessEnd: projectObjectWorkbenchPoint(annotation.witnessEnd),
            lineStart: projectObjectWorkbenchPoint(annotation.lineStart),
            lineEnd: projectObjectWorkbenchPoint(annotation.lineEnd),
          }))
      : [];
  const objectWorkbenchCustomEdgeCandidates =
    input.isModel
      ? input.rawObjectWorkbenchCustomEdgeCandidates
          .filter((annotation) => {
            if (
              input.useProjectionOnlyModelSpacePlan &&
              !projectionCommittedOverlayOwnerKeys.has(`${annotation.ownerKind}:${annotation.ownerId}`)
            ) {
              return false;
            }
            return annotation.ownerKind === 'footprint' ? input.familyVisibility.house : input.familyVisibility.decks;
          })
          .map((annotation) => ({
            ...annotation,
            witnessStart: projectObjectWorkbenchPoint(annotation.witnessStart),
            witnessEnd: projectObjectWorkbenchPoint(annotation.witnessEnd),
            lineStart: projectObjectWorkbenchPoint(annotation.lineStart),
            lineEnd: projectObjectWorkbenchPoint(annotation.lineEnd),
          }))
      : [];
  const objectWorkbenchPreviewShape =
    input.isModel &&
    input.rawObjectWorkbenchPreviewShape &&
    (!input.useProjectionOnlyModelSpacePlan ||
      projectionCommittedOverlayOwnerKeys.has(`${input.rawObjectWorkbenchPreviewShape.ownerKind}:${input.rawObjectWorkbenchPreviewShape.ownerId}`))
      ? {
          ownerKind: input.rawObjectWorkbenchPreviewShape.ownerKind,
          ownerId: input.rawObjectWorkbenchPreviewShape.ownerId,
          points: input.rawObjectWorkbenchPreviewShape.polygon.map((point) => projectObjectWorkbenchPoint(point)),
          bodyState: input.rawObjectWorkbenchPreviewShape.bodyState,
          anchorPoint: input.rawObjectWorkbenchPreviewShape.anchorPoint
            ? projectObjectWorkbenchPoint(input.rawObjectWorkbenchPreviewShape.anchorPoint)
            : null,
          lockedCornerPoint: input.rawObjectWorkbenchPreviewShape.lockedCornerPoint
            ? projectObjectWorkbenchPoint(input.rawObjectWorkbenchPreviewShape.lockedCornerPoint)
            : null,
          endCatchPoint: input.rawObjectWorkbenchPreviewShape.endCatchPoint
            ? projectObjectWorkbenchPoint(input.rawObjectWorkbenchPreviewShape.endCatchPoint)
            : null,
          referenceGuide: input.rawObjectWorkbenchPreviewShape.referenceGuide
            ? {
                start: projectObjectWorkbenchPoint(input.rawObjectWorkbenchPreviewShape.referenceGuide.start),
                end: projectObjectWorkbenchPoint(input.rawObjectWorkbenchPreviewShape.referenceGuide.end),
                state: input.rawObjectWorkbenchPreviewShape.referenceGuide.state,
              }
            : null,
          targetHighlights: input.rawObjectWorkbenchPreviewShape.targetHighlights.map((targetHighlight) => ({
            start: projectObjectWorkbenchPoint(targetHighlight.start),
            end: projectObjectWorkbenchPoint(targetHighlight.end),
            state: targetHighlight.state,
          })),
        }
      : null;

  const topProjectionAllShapes =
    input.useTopProjectionBackedPlan && input.modelSpaceTopProjection ? input.modelSpaceTopProjection.shapes : [];
  const topProjectionHiddenRenderedCount = renderedTopProjectionShapes.filter(({ shape }) => topProjectionRole(shape) === 'hidden_from_top').length;
  const renderedTopProjectionContextBodyCount = renderedTopProjectionShapes.filter(
    ({ shape }) => topProjectionRole(shape) === 'context' && topProjectionShapeIsCommittedBody(shape),
  ).length;
  const topProjectionScreenAxis = input.modelSpaceTopProjection
    ? `${input.modelSpaceTopProjection.screenAxis.x}_${input.modelSpaceTopProjection.screenAxis.y}`
    : null;
  const topProjectionPergolaHitPoints =
    input.useTopProjectionBackedPlan
      ? topProjectionShapes
          .filter(({ shape }) => shape.family === 'pergola' && (shape.kind === 'roof_plane' || shape.kind === 'roof_cladding'))
          .sort((left, right) => polygonAreaAbs(right.points) - polygonAreaAbs(left.points))[0]?.points ?? []
      : [];

  const diagnostics: PlanSvgPresentationDiagnostics = {
    renderContract: input.isModel
      ? input.useProjectionOnlyModelSpacePlan
        ? 'top_projection_only'
        : 'legacy_or_fallback'
      : 'legacy_or_fallback',
    topProjectionParityStatus:
      input.useTopProjectionBackedPlan && input.modelSpaceTopProjection
        ? topProjectionScreenAxis === 'world_x_left_world_y_down' && topProjectionHiddenRenderedCount === 0
          ? 'pass'
          : 'fail'
        : null,
    topProjectionScreenAxis,
    topProjectionTopVisibleCount: topProjectionAllShapes.filter((shape) => topProjectionRole(shape) === 'top_visible').length,
    topProjectionContextCount: topProjectionAllShapes.filter((shape) => topProjectionRole(shape) === 'context').length,
    topProjectionHiddenCount: topProjectionAllShapes.filter((shape) => topProjectionRole(shape) === 'hidden_from_top').length,
    topProjectionRenderedCount: renderedTopProjectionShapes.length,
    topProjectionHiddenRenderedCount,
    renderedTopProjectionContextLineCount: renderedTopProjectionShapes.filter(
      ({ shape }) => topProjectionPlanLayer(shape) === 'contextLines',
    ).length,
    renderedTopProjectionWallDetailCount: renderedTopProjectionShapes.filter(
      ({ shape }) =>
        shape.sourceType === 'house_line' &&
        shape.kind === 'wall_segment' &&
        shape.metadata?.planDetailRole === 'wall_edge',
    ).length,
    selectedDeckSnapFrameSource,
    committedTopProjectionBodyCount: renderedTopProjectionShapes.filter(({ shape }) =>
      topProjectionShapeIsCommittedBody(shape),
    ).length,
    committedTopProjectionObjectCount: new Set(
      committedTopProjectionBodies.map(({ shape }) => `${shape.family}:${shape.kind}:${shape.sourceId ?? shape.sourceObjectId}`),
    ).size,
    objectWorkbenchRenderedBodyCount,
    visibleLegacyPlanOverlayBodyCount,
    visibleGeometryFallbackOverlayBodyCount,
    visibleTopProjectionContextOverlayBodyCount,
    visibleTopProjectionCommittedOverlayBodyCount,
    renderedTopProjectionContextBodyCount,
    suppressedTopProjectionContextBodyCount: topProjectionShapes.filter(
      ({ shape }) => topProjectionRole(shape) === 'context' && topProjectionPlanLayer(shape) === null,
    ).length,
    suppressedTopProjectionTopVisibleBodyCount:
      topProjectionShapes.filter(
        ({ shape }) => topProjectionRole(shape) === 'top_visible' && topProjectionPlanLayer(shape) === null,
      ).length + suppressedTopProjectionOwnershipBodyCount,
    duplicateCommittedBodyCount: input.useTopProjectionBackedPlan
      ? objectWorkbenchRenderedBodyCount + renderedTopProjectionContextBodyCount + wrongSourceVisibleOverlayBodyCount
      : 0,
    duplicateSemanticOwnerCount: input.useTopProjectionBackedPlan
      ? objectWorkbenchRenderedBodyCount + renderedTopProjectionContextBodyCount + wrongSourceVisibleOverlayBodyCount
      : 0,
  };

  return {
    topProjectionShapes,
    renderedTopProjectionShapes,
    committedTopProjectionBodies,
    renderedTopProjectionContextLines,
    topProjectionPergolaHitPoints,
    visibleObjectWorkbenchDeckIds,
    objectWorkbenchOverlayShapes,
    renderObjectWorkbenchCommittedBodies,
    objectWorkbenchPresetAnnotations,
    objectWorkbenchCustomEdgeCandidates,
    objectWorkbenchPreviewShape,
    diagnostics,
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
