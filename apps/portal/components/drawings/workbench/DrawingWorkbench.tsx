'use client';

import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { ModuleViewsStatus, ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import type { WorkbenchDrawingSurfaceGeometry } from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import type { EstimateDrawingField, EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type { EstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { DeckInteractionTelemetry } from '@/lib/drawings/interactions/deckInteractionContract';
import type {
  DrawingWorkbenchViewportMode,
  DrawingWorkbenchViewportTransform,
  DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { CalculatorHouseFootprintPolygonPoint } from '@/lib/types/calculator';
import type {
  ObjectWorkbenchDeckPatch,
  ObjectWorkbenchDisplayFamily,
  ObjectWorkbenchOpeningPatch,
  ObjectWorkbenchViewportTargetSelection,
} from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type {
  GeometryPreviewState,
  WorkbenchTrustGateModel,
  WorkbenchViewportGeometry,
} from '@/lib/drawings/state/workbenchSolvedModel';
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import type {
  EdgeDragCommit,
  MoveRequest,
  ProjectHouseSnapSource,
} from '@/components/drawings/viewports/PlanViewport/PlanViewport';
import WorkbenchChrome from './WorkbenchChrome';
import WorkbenchViewportHost from './WorkbenchViewportHost';
import styles from './DrawingWorkbench.module.css';

type DrawingWorkbenchProps = {
  moduleLabel: string;
  modules: Array<{ id: string; label: string }>;
  activeModuleIndex: number;
  onActiveModuleIndexChange: (index: number) => void;
  view: ModuleViewsTab;
  onViewChange: (view: ModuleViewsTab) => void;
  viewportMode: DrawingWorkbenchViewportMode;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  onViewportModeChange: (mode: DrawingWorkbenchViewportMode) => void;
  availableViewportModes?: DrawingWorkbenchViewportMode[];
  status: ModuleViewsStatus;
  trustGate?: WorkbenchTrustGateModel | null;
  viewportGeometry?: WorkbenchViewportGeometry | null;
  projectGeometryPreview?: GeometryPreviewState | null;
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
  backHref?: string;
  /** Project name shown at the top-left of the workbench chrome. */
  projectLabel?: string | null;
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
  /** Project-wide full pergola plan bodies, prefixed per pergola id. */
  projectPergolaPlanShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  /** Canonical pergola reference shapes used as snap targets. */
  projectPergolaSnapShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  /** Canonical house references promoted to active module hit targets. */
  houseCommittedShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  /** Project-level house models used as wall/eave snap sources. */
  projectHouseSnapSources?: ReadonlyArray<ProjectHouseSnapSource>;
  /** Cross-viewport hover state (milestone 16). Pass-through to viewports. */
  hoveredObjectRef?: WorkbenchObjectRef | null;
  onHoverObjectChange?: (next: WorkbenchObjectRef | null) => void;
};

export default function DrawingWorkbench({
  moduleLabel,
  modules,
  activeModuleIndex,
  onActiveModuleIndexChange,
  view,
  onViewChange,
  viewportMode,
  objectWorkbenchDisplayFamily = 'pergolas',
  visibility,
  onViewportModeChange,
  availableViewportModes,
  status,
  trustGate,
  viewportGeometry,
  projectGeometryPreview,
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
  backHref,
  projectLabel,
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
  projectPergolaPlanShapes,
  projectPergolaSnapShapes,
  houseCommittedShapes,
  projectHouseSnapSources,
  hoveredObjectRef,
  onHoverObjectChange,
}: DrawingWorkbenchProps) {
  void modules;
  void onActiveModuleIndexChange;
  void availableViewportModes;
  void trustGate;

  return (
    <section className={styles.workbench} aria-label="Drawing workbench">
      <WorkbenchChrome
        view={view}
        onViewChange={onViewChange}
        viewportMode={viewportMode}
        onViewportModeChange={onViewportModeChange}
        backHref={backHref}
        projectLabel={projectLabel ?? null}
      />
      <WorkbenchViewportHost
        moduleLabel={moduleLabel}
        activeModuleIndex={activeModuleIndex}
        view={view}
        viewportMode={viewportMode}
        objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
        visibility={visibility}
        status={status}
        viewportGeometry={viewportGeometry}
        projectGeometryPreview={projectGeometryPreview}
        drawingSurfaceGeometry={drawingSurfaceGeometry}
        planViewModel={planViewModel}
        activeObjectRef={activeObjectRef}
        pergolaTargetId={pergolaTargetId}
        enableProjectionOnlyModelInteractions={enableProjectionOnlyModelInteractions}
        modelViewportKey={modelViewportKey}
        modelViewportTransform={modelViewportTransform}
        modelViewportAutoFitOnReady={modelViewportAutoFitOnReady}
        geometryViewportKey={geometryViewportKey}
        geometryViewportState={geometryViewportState}
        drawOutlineRequestId={drawOutlineRequestId}
        drawOutlineMode={drawOutlineMode}
        drawOutlineSeedPolygon={drawOutlineSeedPolygon}
        onDrawOutlineRequestConsumed={onDrawOutlineRequestConsumed}
        onModelViewportTransformChange={onModelViewportTransformChange}
        onGeometryViewportStateChange={onGeometryViewportStateChange}
        meta={meta}
        editableFields={editableFields}
        modelEditableFields={modelEditableFields}
        showDebugOverlays={showDebugOverlays}
        onCommitField={onCommitField}
        onCommitModelField={onCommitModelField}
        onCommitFootprintEdit={onCommitFootprintEdit}
        onCommitCustomPolygon={onCommitCustomPolygon}
        onSelectObjectWorkbenchTarget={onSelectObjectWorkbenchTarget}
        onSelectPergolaTarget={onSelectPergolaTarget}
        onClearWorkbenchSelection={onClearWorkbenchSelection}
        onToggleHouseTerminalEnd={onToggleHouseTerminalEnd}
        onCommitHouseFormFootprintDimension={onCommitHouseFormFootprintDimension}
        onCommitDeckDimension={onCommitDeckDimension}
        onCommitOpeningDimension={onCommitOpeningDimension}
        onDeckInteractionTelemetryChange={onDeckInteractionTelemetryChange}
        onCommitOutlineEdit={onCommitOutlineEdit}
        onCommitMove={onCommitMove}
        projectContextShapes={projectContextShapes}
        projectPergolaPlanShapes={projectPergolaPlanShapes}
        projectPergolaSnapShapes={projectPergolaSnapShapes}
        houseCommittedShapes={houseCommittedShapes}
        projectHouseSnapSources={projectHouseSnapSources}
        hoveredObjectRef={hoveredObjectRef}
        onHoverObjectChange={onHoverObjectChange}
      />
    </section>
  );
}
