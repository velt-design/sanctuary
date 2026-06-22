'use client';

import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { PlanCanvas2D } from './PlanCanvas2D';
import type { PlanSeamIconTarget } from '../interactions/seams/seamIconTargets';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { PlanDimension } from './planDimension';
import type { EdgeDragHover, EdgeDragPreview } from '../tools/EdgeDragTool';
import type { MoveToolPreview } from '../tools/MoveTool';
import type { PlanLayout } from './planLayout';
import type { Point2 } from './polygonEdgeMath';
import type { PlanRenderItem } from './planRenderItem';
import type { PlanRenderDiagnostics } from '@/lib/drawings/views/plan/planRenderDiagnostics';
import type { ProjectHouseProjectionHealth } from '@/lib/drawings/state/projectHouseProjectionHealth';
import type { ProjectPergolaRenderHealth } from '@/lib/drawings/state/projectObjectRenderPipeline';

/**
 * PR-WB-CANVAS (Tier 3, 2026-06-22): the Plan view is now rendered by the
 * Canvas 2D renderer (`PlanCanvas2D`). The legacy SVG-DOM renderer + its 16
 * per-shape layer components were retired once canvas reached visual +
 * interaction parity (verified live; render-model + wiring covered by
 * usePlanRenderModel.test, PlanViewport.canvas.test, and the pure
 * selection/hover/dimension tests).
 *
 * `PlanCanvas` is now a thin seam mapping the render model (built by the
 * parent + usePlanRenderModel) onto the renderer. Pan/zoom, hit-testing,
 * hover, tool dispatch and the diagnostic overlay all live inside
 * PlanCanvas2D. A few props (`diagnostics`, `*Health`, `activeOutlinePolygon`)
 * are retained on the contract for callers but no longer rendered as SVG-root
 * data attributes — their behaviour is asserted directly on the render model.
 */
type PlanCanvasProps = {
  layout: PlanLayout;
  coordinateAdapter: PlanCoordinateAdapter;
  committedBodies: PlanRenderItem[];
  diagnosticFallbackItems: PlanRenderItem[];
  contextLines: PlanRenderItem[];
  detailLines: PlanRenderItem[];
  hitTargetItems: PlanRenderItem[];
  selectionHaloItems: PlanRenderItem[];
  /**
   * Cross-viewport hover halo items. Empty when no external hover (e.g. 3D
   * pointer-over) is active. Rendered as a lighter-weight outline than the
   * selection halo so the active selection still reads as primary.
   */
  hoverHaloItems?: PlanRenderItem[];
  diagnostics: PlanRenderDiagnostics;
  projectHouseProjectionHealth?: ReadonlyArray<ProjectHouseProjectionHealth>;
  projectPergolaRenderHealth?: ReadonlyArray<ProjectPergolaRenderHealth>;
  /**
   * Fires when the local pointer enters or leaves a top-projection shape.
   * Receives the full shape on enter, `null` on leave. Used by PlanViewport
   * to classify the shape into a `WorkbenchObjectRef` and emit cross-
   * viewport hover state.
   */
  onHoverShape?: (shape: GeometryTopProjectionShape | null) => void;
  dimensions?: ReadonlyArray<PlanDimension>;
  edgeDragPreview?: EdgeDragPreview | null;
  edgeDragHover?: EdgeDragHover | null;
  movePreview?: MoveToolPreview | null;
  /** World-coord polygon (mm) of the object being moved; used by the move preview. */
  movePreviewSourcePolygon?: ReadonlyArray<Point2> | null;
  /** Active outline polygon used for hit-testing — retained on the contract. */
  activeOutlinePolygon?: ReadonlyArray<Point2> | null;
  transform: DrawingWorkbenchViewportTransform;
  onTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
  screenAxisLabel: string;
  /** PR-COMP-PHASE4b.3: seam icons (Join + Detach) rendered above geometry. */
  seamIconTargets?: ReadonlyArray<PlanSeamIconTarget>;
  onJoinHouseForms?: (input: { formAId: string; formBId: string }) => void;
  onDetachHouseFormAtSeam?: (input: { houseFormId: string; joinIndex: number }) => void;
};

const EMPTY_DIMENSIONS: ReadonlyArray<PlanDimension> = [];
const EMPTY_HOVER_HALO_ITEMS: PlanRenderItem[] = [];

export function PlanCanvas({
  layout,
  coordinateAdapter,
  committedBodies,
  diagnosticFallbackItems,
  contextLines,
  detailLines,
  hitTargetItems,
  selectionHaloItems,
  hoverHaloItems = EMPTY_HOVER_HALO_ITEMS,
  onHoverShape,
  dimensions = EMPTY_DIMENSIONS,
  edgeDragPreview = null,
  edgeDragHover = null,
  movePreview = null,
  movePreviewSourcePolygon = null,
  transform,
  onTransformChange,
  screenAxisLabel,
  seamIconTargets,
  onJoinHouseForms,
  onDetachHouseFormAtSeam,
}: PlanCanvasProps) {
  return (
    <PlanCanvas2D
      layout={layout}
      coordinateAdapter={coordinateAdapter}
      committedBodies={committedBodies}
      diagnosticFallbackItems={diagnosticFallbackItems}
      contextLines={contextLines}
      detailLines={detailLines}
      hitTargetItems={hitTargetItems}
      selectionHaloItems={selectionHaloItems}
      hoverHaloItems={hoverHaloItems}
      dimensions={dimensions}
      edgeDragPreview={edgeDragPreview}
      edgeDragHover={edgeDragHover}
      movePreview={movePreview}
      movePreviewSourcePolygon={movePreviewSourcePolygon}
      seamIconTargets={seamIconTargets}
      onJoinHouseForms={onJoinHouseForms}
      onDetachHouseFormAtSeam={onDetachHouseFormAtSeam}
      onHoverShape={onHoverShape}
      transform={transform}
      onTransformChange={onTransformChange}
      screenAxisLabel={screenAxisLabel}
    />
  );
}
