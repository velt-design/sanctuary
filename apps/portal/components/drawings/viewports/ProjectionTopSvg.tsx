import { useMemo } from 'react';
import type { GeometryTopProjectionViewModel, Point2 } from '@sp/geometry';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchViewportTargetSelection } from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import {
  buildProjectionPlanRenderGraph,
  topProjectionPlanLayer,
  topProjectionRole,
  topProjectionShapeVisible,
} from '@/lib/drawings/views/plan/planRenderGraph';
import {
  activeObjectMatchesProjectionTopShape,
  buildProjectionTopInteractionAdapter,
  projectionBoundsToSvgRect,
} from './ProjectionTopInteractionAdapter';
import {
  ProjectionTopCommittedBodyLayer,
  ProjectionTopContextLineLayer,
  ProjectionTopSelectionOutlineLayer,
  type ProjectionTopItem,
} from './ProjectionTopLayers';
import { ProjectionTopHitTargets } from './ProjectionTopHitTargets';
import { ProjectionTopDimensions } from './ProjectionTopDimensions';
import styles from '@/app/staff/calculator/CalculatorGrid.module.css';

type ProjectionBoundsMm = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthMm: number;
  heightMm: number;
};

type ProjectionTopDiagnostics = {
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
  renderedTopProjectionContextBodyCount: number;
  suppressedTopProjectionContextBodyCount: number;
  suppressedTopProjectionTopVisibleBodyCount: number;
  duplicateCommittedBodyCount: number;
  duplicateSemanticOwnerCount: number;
};

type ProjectionTopSvgProps = {
  artifact: WorkbenchSolvedGeometryArtifact;
  visibility?: DrawingWorkbenchVisibilityState;
  activeObjectRef?: WorkbenchObjectRef | null;
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onClearWorkbenchSelection?: () => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
};

function defaultVisibility(): DrawingWorkbenchVisibilityState {
  return {
    house: true,
    pergolas: true,
    decks: true,
    openings: true,
  };
}

function resolveProjectionBounds(points: Point2[]): ProjectionBoundsMm | null {
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
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

function committedObjectKey(item: ProjectionTopItem): string {
  return `${item.shape.family}:${item.shape.kind}:${item.shape.sourceId ?? item.shape.sourceObjectId ?? item.shape.id}`;
}

export function ProjectionTopSvg({
  artifact,
  visibility,
  activeObjectRef,
  onSelectObjectWorkbenchTarget,
  onClearWorkbenchSelection,
  onSelectPergolaTarget,
}: ProjectionTopSvgProps) {
  const projection: GeometryTopProjectionViewModel = artifact.topProjection;
  const familyVisibility = visibility ?? defaultVisibility();
  const interactionAdapter = useMemo(
    () => buildProjectionTopInteractionAdapter({ projection }),
    [projection],
  );
  const { coordinateAdapter, layout } = interactionAdapter;

  const topProjectionShapes = useMemo(
    () =>
      projection.shapes
        .filter((shape) => topProjectionShapeVisible(shape, familyVisibility))
        .map((shape) => ({
          shape,
          points: coordinateAdapter.projectionPolygonToSvg(shape.polygon),
        })),
    [coordinateAdapter, familyVisibility, projection.shapes],
  );
  const renderGraph = useMemo(
    () =>
      buildProjectionPlanRenderGraph(topProjectionShapes, {
        projectionOnlyModelSpace: true,
      }),
    [topProjectionShapes],
  );
  const committedBodies = renderGraph.committedBodies as ProjectionTopItem[];
  const contextLines = renderGraph.contextLines as ProjectionTopItem[];
  const selectedBodies = useMemo(
    () =>
      committedBodies.filter(({ shape }) =>
        activeObjectMatchesProjectionTopShape(activeObjectRef, shape),
      ),
    [activeObjectRef, committedBodies],
  );
  const renderedTopProjectionShapes = [...committedBodies, ...contextLines];
  const focusBounds = useMemo(() => {
    return (
      projection.extents ??
      resolveProjectionBounds(committedBodies.flatMap(({ shape }) => shape.polygon)) ?? {
        minX: 0,
        minY: 0,
        maxX: 1000,
        maxY: 1000,
        widthMm: 1000,
        heightMm: 1000,
      }
    );
  }, [committedBodies, projection.extents]);
  const focusBoxValue = useMemo(() => formatProjectionBounds(focusBounds), [focusBounds]);
  const focusTargetRect = useMemo(
    () =>
      projectionBoundsToSvgRect({
        minX: focusBounds.minX,
        minY: focusBounds.minY,
        maxX: focusBounds.maxX,
        maxY: focusBounds.maxY,
        adapter: coordinateAdapter,
      }),
    [coordinateAdapter, focusBounds],
  );

  const diagnostics = useMemo<ProjectionTopDiagnostics>(() => {
    const topProjectionHiddenRenderedCount = renderedTopProjectionShapes.filter(
      ({ shape }) => topProjectionRole(shape) === 'hidden_from_top',
    ).length;
    const topProjectionScreenAxis = `${projection.screenAxis.x}_${projection.screenAxis.y}`;
    const renderedTopProjectionContextBodyCount = renderedTopProjectionShapes.filter(
      ({ shape }) => topProjectionRole(shape) === 'context' && topProjectionPlanLayer(shape) === 'committedBodies',
    ).length;
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
      committedTopProjectionObjectCount: new Set(committedBodies.map(committedObjectKey)).size,
      renderedTopProjectionContextBodyCount,
      suppressedTopProjectionContextBodyCount: renderGraph.suppressed.filter(
        ({ shape }) => topProjectionRole(shape) === 'context',
      ).length,
      suppressedTopProjectionTopVisibleBodyCount: renderGraph.suppressed.filter(
        ({ shape }) => topProjectionRole(shape) === 'top_visible',
      ).length,
      duplicateCommittedBodyCount: 0,
      duplicateSemanticOwnerCount: 0,
    };
  }, [committedBodies, contextLines, projection, renderGraph.suppressed, renderedTopProjectionShapes]);

  return (
    <svg
      viewBox={layout.viewBox}
      width={layout.width}
      height={layout.height}
      overflow="visible"
      data-drawing-surface-source="solved_geometry"
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
      data-plan-visible-legacy-overlay-body-count="0"
      data-plan-visible-geometry-fallback-overlay-body-count="0"
      data-plan-visible-top-projection-context-overlay-body-count="0"
      data-plan-visible-top-projection-committed-overlay-body-count="0"
      data-plan-rendered-context-body-count={diagnostics.renderedTopProjectionContextBodyCount}
      data-plan-suppressed-context-body-count={diagnostics.suppressedTopProjectionContextBodyCount}
      data-plan-suppressed-top-visible-body-count={diagnostics.suppressedTopProjectionTopVisibleBodyCount}
      data-plan-duplicate-visual-body-count={diagnostics.duplicateCommittedBodyCount}
      data-plan-duplicate-semantic-owner-count={diagnostics.duplicateSemanticOwnerCount}
      data-plan-projection-native-surface="true"
      data-projection-top-viewport="true"
      role="img"
      aria-label="Module plan view"
      className={`${styles.modulePlanSvg} ${styles.modulePlanSvgBare} ${styles.modulePlanSvgModel}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClearWorkbenchSelection?.();
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && event.button === 0) onClearWorkbenchSelection?.();
      }}
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
      <ProjectionTopCommittedBodyLayer items={committedBodies} projection={projection} />
      <ProjectionTopContextLineLayer items={contextLines} projection={projection} />
      <ProjectionTopSelectionOutlineLayer items={selectedBodies} />
      <ProjectionTopDimensions />
      <ProjectionTopHitTargets
        items={committedBodies}
        onSelectObjectWorkbenchTarget={onSelectObjectWorkbenchTarget}
        onSelectPergolaTarget={onSelectPergolaTarget}
      />
    </svg>
  );
}
