'use client';

import type { ModuleViewsStatus, ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import type { WorkbenchDrawingSurfaceGeometry } from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import type { ObjectWorkbenchGeometryPreviewState } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
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
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
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
  drawingSurfaceGeometry?: WorkbenchDrawingSurfaceGeometry | null;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  planViewModel?: PlanViewModel | null;
  geometryPreview?: ObjectWorkbenchGeometryPreviewState | null;
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
  drawingSurfaceGeometry,
  planModel,
  sectionModel,
  planViewModel,
  geometryPreview,
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
  onCommitHouseFormFootprintDimension,
  onCommitDeckDimension,
  onCommitOpeningDimension,
  onDeckInteractionTelemetryChange,
}: DrawingWorkbenchProps) {
  void modules;
  void onActiveModuleIndexChange;

  return (
    <section className={styles.workbench} aria-label="Drawing workbench">
      <WorkbenchChrome
        view={view}
        onViewChange={onViewChange}
        viewportMode={viewportMode}
        onViewportModeChange={onViewportModeChange}
        availableViewportModes={availableViewportModes}
        trustGate={trustGate}
        backHref={backHref}
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
        drawingSurfaceGeometry={drawingSurfaceGeometry}
        planModel={planModel}
        sectionModel={sectionModel}
        planViewModel={planViewModel}
        geometryPreview={geometryPreview}
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
        onCommitHouseFormFootprintDimension={onCommitHouseFormFootprintDimension}
        onCommitDeckDimension={onCommitDeckDimension}
        onCommitOpeningDimension={onCommitOpeningDimension}
        onDeckInteractionTelemetryChange={onDeckInteractionTelemetryChange}
      />
    </section>
  );
}
