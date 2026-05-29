'use client';

import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { ModuleViewsStatus, ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { DeckInteractionTelemetry } from '@/lib/drawings/interactions/deckInteractionContract';
import type {
  DrawingWorkbenchViewportMode,
  DrawingWorkbenchViewportTransform,
  DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchViewportGeometry } from '@/lib/drawings/state/workbenchSolvedModel';
import {
  buildWorkbenchDrawingSurfaceGeometry,
  type WorkbenchDrawingSurfaceGeometry,
} from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type {
  ObjectWorkbenchDeckPatch,
  ObjectWorkbenchDisplayFamily,
  ObjectWorkbenchOpeningPatch,
  ObjectWorkbenchViewportTargetSelection,
} from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type { PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import type { EstimateDrawingField, EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type { EstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { CalculatorHouseFootprintPolygonPoint } from '@/lib/types/calculator';
import { type Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import DesignViewport from '@/components/drawings/viewports/DesignViewport';
import PlanViewport, {
  type EdgeDragCommit,
  type MoveRequest,
  type ProjectHouseSnapSource,
} from '@/components/drawings/viewports/PlanViewport/PlanViewport';
import SheetViewport from '@/components/drawings/viewports/SheetViewport';
import styles from './DrawingWorkbench.module.css';

type WorkbenchViewportHostProps = {
  moduleLabel: string;
  activeModuleIndex: number;
  view: ModuleViewsTab;
  viewportMode: DrawingWorkbenchViewportMode;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  status: ModuleViewsStatus;
  viewportGeometry?: WorkbenchViewportGeometry | null;
  drawingSurfaceGeometry?: WorkbenchDrawingSurfaceGeometry | null;
  planViewModel?: PlanViewModel | null;
  activeObjectRef?: WorkbenchObjectRef | null;
  pergolaTargetId?: string | null;
  enableProjectionOnlyModelInteractions?: boolean;
  modelViewportKey?: string;
  modelViewportTransform: DrawingWorkbenchViewportTransform;
  modelViewportAutoFitOnReady?: boolean;
  geometryViewportKey?: string;
  geometryViewportState?: Geometry3DViewportState | null;
  drawOutlineRequestId?: number;
  drawOutlineMode?: 'footprint' | 'deck' | null;
  drawOutlineSeedPolygon?: CalculatorHouseFootprintPolygonPoint[];
  onDrawOutlineRequestConsumed?: (requestId: number) => void;
  onModelViewportTransformChange: (transform: DrawingWorkbenchViewportTransform) => void;
  onGeometryViewportStateChange?: (state: Geometry3DViewportState) => void;
  meta: EstimateDrawingSheetMeta;
  editableFields?: EstimateDrawingField[];
  modelEditableFields?: EstimateDrawingField[];
  showDebugOverlays?: boolean;
  onCommitField?: (
    field: EstimateDrawingField,
    nextValue: string,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitModelField?: (
    field: EstimateDrawingField,
    nextValue: string,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitFootprintEdit?: (
    edit: EstimateDrawingFootprintEdit,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitCustomPolygon?: (
    polygon: CalculatorHouseFootprintPolygonPoint[],
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
  onClearWorkbenchSelection?: () => void;
  onToggleHouseTerminalEnd?: (endId: string, currentlyOpen: boolean) => void;
  onCommitHouseFormFootprintDimension?: (
    edit: EstimateDrawingFootprintEdit,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitDeckDimension?: (
    deckId: string,
    patch: ObjectWorkbenchDeckPatch,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitOpeningDimension?: (
    openingId: string,
    patch: ObjectWorkbenchOpeningPatch,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onDeckInteractionTelemetryChange?: (telemetry: DeckInteractionTelemetry) => void;
  onCommitOutlineEdit?: (commit: EdgeDragCommit) => void;
  onCommitMove?: (request: MoveRequest) => void;
  /** Faded outline shapes for non-active pergolas (Step 5d Option A). */
  projectContextShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  /** Canonical house references promoted to active module hit targets. */
  houseCommittedShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  /** Project-level house models used as wall/eave snap sources. */
  projectHouseSnapSources?: ReadonlyArray<ProjectHouseSnapSource>;
  /**
   * Cross-viewport hover state (milestone 16). PlanViewport emits via
   * `onHoverObjectChange` when the local pointer enters a shape; the host
   * threads it through to whichever viewport is currently rendered. Phase
   * 1 wires the prop end-to-end without yet rendering hover styling in 3D.
   */
  hoveredObjectRef?: WorkbenchObjectRef | null;
  onHoverObjectChange?: (next: WorkbenchObjectRef | null) => void;
};

export default function WorkbenchViewportHost({
  moduleLabel,
  activeModuleIndex,
  view,
  viewportMode,
  objectWorkbenchDisplayFamily = 'pergolas',
  visibility,
  status,
  viewportGeometry,
  drawingSurfaceGeometry,
  planViewModel,
  activeObjectRef,
  pergolaTargetId,
  enableProjectionOnlyModelInteractions,
  modelViewportKey,
  modelViewportTransform,
  modelViewportAutoFitOnReady = true,
  geometryViewportKey,
  geometryViewportState,
  drawOutlineRequestId,
  drawOutlineMode,
  drawOutlineSeedPolygon,
  onDrawOutlineRequestConsumed,
  onModelViewportTransformChange,
  onGeometryViewportStateChange,
  meta,
  editableFields,
  modelEditableFields,
  showDebugOverlays,
  onCommitField,
  onCommitModelField,
  onCommitFootprintEdit,
  onCommitCustomPolygon,
  onSelectObjectWorkbenchTarget,
  onSelectPergolaTarget,
  onClearWorkbenchSelection,
  onToggleHouseTerminalEnd,
  onCommitHouseFormFootprintDimension,
  onCommitDeckDimension,
  onCommitOpeningDimension,
  onDeckInteractionTelemetryChange,
  onCommitOutlineEdit,
  onCommitMove,
  projectContextShapes,
  houseCommittedShapes,
  projectHouseSnapSources,
  hoveredObjectRef,
  onHoverObjectChange,
}: WorkbenchViewportHostProps) {
  const routedDrawingSurfaceGeometry =
    drawingSurfaceGeometry ??
    buildWorkbenchDrawingSurfaceGeometry({
      viewportGeometry: viewportGeometry ?? null,
      planViewModel: planViewModel ?? null,
    });
  const routedGeometryPreview = viewportGeometry?.preview ?? null;

  return (
    <div className={styles.viewport}>
      {viewportMode === 'sheet' ? (
        <SheetViewport
          moduleLabel={moduleLabel}
          view={view}
          status={status}
          drawingSurfaceGeometry={routedDrawingSurfaceGeometry}
          planViewModel={planViewModel}
          meta={meta}
          editableFields={editableFields}
          showDebugOverlays={showDebugOverlays}
          onCommitField={onCommitField}
          onCommitFootprintEdit={onCommitFootprintEdit}
        />
      ) : viewportMode === 'plan' || viewportMode === 'model' ? (
        <PlanViewport
          artifact={routedDrawingSurfaceGeometry?.artifact ?? null}
          objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
          visibility={visibility}
          activeObjectRef={activeObjectRef}
          projectContextShapes={projectContextShapes}
          houseCommittedShapes={houseCommittedShapes}
          projectHouseSnapSources={projectHouseSnapSources}
          viewportTransform={modelViewportTransform}
          onViewportTransformChange={onModelViewportTransformChange}
          onSelectObjectWorkbenchTarget={onSelectObjectWorkbenchTarget}
          onSelectPergolaTarget={onSelectPergolaTarget}
          onClearWorkbenchSelection={onClearWorkbenchSelection}
          onToggleHouseTerminalEnd={onToggleHouseTerminalEnd}
          onCommitOutlineEdit={onCommitOutlineEdit}
          onCommitMove={onCommitMove}
          hoveredObjectRef={hoveredObjectRef}
          onHoverObjectChange={onHoverObjectChange}
        />
      ) : (
        <DesignViewport
          geometryPreview={routedGeometryPreview}
          objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
          visibility={visibility}
          viewportKey={geometryViewportKey ?? `${objectWorkbenchDisplayFamily}:${activeModuleIndex}`}
          viewportState={geometryViewportState}
          onViewportStateChange={onGeometryViewportStateChange}
          selectedObjectId={activeObjectRef?.objectId}
          onSelectObjectWorkbenchTarget={onSelectObjectWorkbenchTarget}
          onSelectPergolaTarget={onSelectPergolaTarget}
          onClearWorkbenchSelection={onClearWorkbenchSelection}
          hoveredObjectId={hoveredObjectRef?.objectId ?? null}
        />
      )}
    </div>
  );
}
