'use client';

import type { ModuleViewsStatus, ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { ObjectWorkbenchGeometryPreviewState } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
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
import Geometry3DViewport, { type Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import ModelSpaceViewport from '@/components/drawings/viewports/ModelSpaceViewport';
import SheetViewport from '@/components/drawings/viewports/SheetViewport';
import styles from './DrawingWorkbench.module.css';

export type WorkbenchViewportHostProps = {
  moduleLabel: string;
  activeModuleIndex: number;
  view: ModuleViewsTab;
  viewportMode: DrawingWorkbenchViewportMode;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  status: ModuleViewsStatus;
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
}: WorkbenchViewportHostProps) {
  const routedDrawingSurfaceGeometry =
    drawingSurfaceGeometry ??
    buildWorkbenchDrawingSurfaceGeometry({
      viewportGeometry: viewportGeometry ?? null,
      planViewModel: planViewModel ?? null,
    });
  const routedPlanModel = routedDrawingSurfaceGeometry.planModel ?? planModel ?? null;
  const routedSectionModel = routedDrawingSurfaceGeometry.sectionModel ?? sectionModel ?? null;
  const routedGeometryPreview = viewportGeometry?.preview ?? geometryPreview ?? null;

  return (
    <div className={styles.viewport}>
      {viewportMode === 'sheet' ? (
        <SheetViewport
          moduleLabel={moduleLabel}
          view={view}
          status={status}
          drawingSurfaceGeometry={routedDrawingSurfaceGeometry}
          planModel={routedPlanModel}
          sectionModel={routedSectionModel}
          planViewModel={planViewModel}
          meta={meta}
          editableFields={editableFields}
          showDebugOverlays={showDebugOverlays}
          onCommitField={onCommitField}
          onCommitFootprintEdit={onCommitFootprintEdit}
        />
      ) : viewportMode === 'model' ? (
        <ModelSpaceViewport
          view={view}
          objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
          visibility={visibility}
          status={status}
          planModel={routedPlanModel}
          sectionModel={routedSectionModel}
          planViewModel={planViewModel}
          activeObjectRef={activeObjectRef}
          pergolaTargetId={pergolaTargetId}
          enableProjectionOnlyModelInteractions={enableProjectionOnlyModelInteractions}
          drawOutlineRequestId={drawOutlineRequestId}
          drawOutlineMode={drawOutlineMode}
          drawOutlineSeedPolygon={drawOutlineSeedPolygon}
          onConsumeDrawOutlineRequest={onDrawOutlineRequestConsumed}
          fitViewKey={modelViewportKey ?? `${activeModuleIndex}:${view}`}
          autoFitOnReady={modelViewportAutoFitOnReady}
          viewportTransform={modelViewportTransform}
          onViewportTransformChange={onModelViewportTransformChange}
          editableFields={modelEditableFields}
          onCommitField={onCommitModelField}
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
      ) : (
        <Geometry3DViewport
          geometryPreview={routedGeometryPreview}
          objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
          visibility={visibility}
          viewportKey={geometryViewportKey ?? `${objectWorkbenchDisplayFamily}:${activeModuleIndex}`}
          viewportState={geometryViewportState}
          onViewportStateChange={onGeometryViewportStateChange}
        />
      )}
    </div>
  );
}
