'use client';

import type { WorkbenchViewStatus, WorkbenchViewTab } from '@/lib/drawings/workbenchViewTypes';
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
  WorkbenchTrustGateModel,
  WorkbenchViewportGeometry,
} from '@/lib/drawings/state/workbenchSolvedModel';
import type { WorkbenchSolvedProjectArtifact } from '@/lib/drawings/state/workbenchSolvedProjectArtifact';
import type { PlanSeamIconForm } from '@/components/drawings/viewports/PlanViewport/interactions/seams/seamIconTargets';
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import type {
  EdgeDragCommit,
  HouseTerminalEndToggleRequest,
  MoveRequest,
} from '@/components/drawings/viewports/PlanViewport/PlanViewport';
import WorkbenchChrome from './WorkbenchChrome';
import WorkbenchViewportHost from './WorkbenchViewportHost';
import styles from './DrawingWorkbench.module.css';

type DrawingWorkbenchProps = {
  sheetLabel: string;
  view: WorkbenchViewTab;
  onViewChange: (view: WorkbenchViewTab) => void;
  viewportMode: DrawingWorkbenchViewportMode;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  onViewportModeChange: (mode: DrawingWorkbenchViewportMode) => void;
  availableViewportModes?: DrawingWorkbenchViewportMode[];
  status: WorkbenchViewStatus;
  trustGate?: WorkbenchTrustGateModel | null;
  projectArtifact?: WorkbenchSolvedProjectArtifact | null;
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
  backHref?: string;
  /** Project name shown at the top-left of the workbench chrome. */
  projectLabel?: string | null;
  draftSaveAction?: {
    label: string;
    statusText: string | null;
    disabled: boolean;
    onSave: () => void;
  } | null;
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
  onToggleHouseTerminalEnd?: (request: HouseTerminalEndToggleRequest) => void;
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
  /** Cross-viewport hover state (milestone 16). Pass-through to viewports. */
  hoveredObjectRef?: WorkbenchObjectRef | null;
  onHoverObjectChange?: (next: WorkbenchObjectRef | null) => void;
  /** PR-COMP-PHASE4b.3: pass-through to PlanViewport's seam-icon layer. */
  projectHouseFormCompositions?: ReadonlyArray<PlanSeamIconForm>;
  onJoinHouseForms?: (input: { formAId: string; formBId: string }) => void;
  onDetachHouseFormAtSeam?: (input: { houseFormId: string; joinIndex: number }) => void;
};

export default function DrawingWorkbench({
  sheetLabel,
  view,
  onViewChange,
  viewportMode,
  objectWorkbenchDisplayFamily = 'pergolas',
  visibility,
  onViewportModeChange,
  availableViewportModes,
  status,
  trustGate,
  projectArtifact,
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
  backHref,
  projectLabel,
  draftSaveAction,
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
  hoveredObjectRef,
  onHoverObjectChange,
  projectHouseFormCompositions,
  onJoinHouseForms,
  onDetachHouseFormAtSeam,
}: DrawingWorkbenchProps) {
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
        draftSaveAction={draftSaveAction ?? null}
      />
      <WorkbenchViewportHost
        sheetLabel={sheetLabel}
        view={view}
        viewportMode={viewportMode}
        objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
        visibility={visibility}
        status={status}
        projectArtifact={projectArtifact}
        viewportGeometry={viewportGeometry}
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
        hoveredObjectRef={hoveredObjectRef}
        onHoverObjectChange={onHoverObjectChange}
        projectHouseFormCompositions={projectHouseFormCompositions}
        onJoinHouseForms={onJoinHouseForms}
        onDetachHouseFormAtSeam={onDetachHouseFormAtSeam}
      />
    </section>
  );
}
